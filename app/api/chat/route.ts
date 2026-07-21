import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const INJECTION_PATTERNS = [
  /negeer\s+(alle?\s+)?(vorige|eerdere|bovenstaande)\s+instructies/i,
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions/i,
  /disregard\s+(all\s+)?instructions/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /jij?\s+bent\s+nu\s+(een\s+)?/i,
  /nieuwe?\s+instructies:/i,
  /new\s+instructions:/i,
  /system\s*prompt/i,
  /vergeet\s+(alles|alle\s+instructies)/i,
  /forget\s+(everything|all\s+instructions)/i,
  /<\s*system\s*>/i,
  /\[INST\]/i,
  /###\s*instruction/i,
]

function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(text))
}

// Sparsessies tellen niet standaard mee in het geheugen van gewone gesprekken (dat zou dit
// al kwetsbare, complexiteitsgevoelige endpoint verder belasten voor alle gebruikers, ook wie
// nooit spart). Alleen wanneer de gebruiker er zelf naar verwijst, wordt de sparring-historie
// (laatste 10, zelfde grens als bij de coachingssynthese) opgehaald voor dit ene bericht.
function detectSparringReference(text: string): boolean {
  return /spar|oefengesprek/i.test(text)
}

const ALLOWED_ORIGINS = [
  'https://arno.bot',
  'https://www.arno.bot',
  'https://arno.blog',
  'https://www.arno.blog',
]

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  if (!ip) return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  const { data } = await supabase
    .from('arno_blog_widget_blocked')
    .select('ip')
    .eq('ip', ip)
    .limit(1)
    .single()
  return NextResponse.json({ blocked: !!data }, { headers: corsHeaders(origin) })
}

import * as Sentry from '@sentry/nextjs'
import Anthropic from '@anthropic-ai/sdk'
import { getText, StreamingDashSanitizer } from '@/lib/ai'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getRelevantChunksMultiQuery, formatChunksForPrompt } from '@/lib/rag'
import { buildRdsSystemPrompt, buildWidgetSystemPrompt } from '@/lib/systemPrompt'
import { computeMsaScore } from '@/lib/msa'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import mammoth from 'mammoth'

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10MB
const NATIVE_DOCUMENT_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const TEXT_EXTRACT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])

type UploadedDocument = { name: string; mediaType: string; data: string }

async function buildDocumentContentBlock(
  doc: UploadedDocument
): Promise<{ block: Anthropic.Messages.ContentBlockParam | null; extractedText: string | null; error: string | null }> {
  if (!NATIVE_DOCUMENT_TYPES.has(doc.mediaType) && !TEXT_EXTRACT_TYPES.has(doc.mediaType)) {
    return { block: null, extractedText: null, error: 'bestandstype_niet_ondersteund' }
  }

  const byteLength = Math.ceil((doc.data.length * 3) / 4)
  if (byteLength > MAX_DOCUMENT_BYTES) {
    return { block: null, extractedText: null, error: 'bestand_te_groot' }
  }

  if (doc.mediaType === 'application/pdf') {
    return {
      block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.data } },
      extractedText: null,
      error: null,
    }
  }

  if (doc.mediaType.startsWith('image/')) {
    return {
      block: { type: 'image', source: { type: 'base64', media_type: doc.mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: doc.data } },
      extractedText: null,
      error: null,
    }
  }

  // .docx / .txt / .csv worden niet native ondersteund door de Messages API document-blocks,
  // dus zelf omzetten naar platte tekst en meesturen als onderdeel van het tekstbericht.
  const buffer = Buffer.from(doc.data, 'base64')
  try {
    if (doc.mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { value } = await mammoth.extractRawText({ buffer })
      return { block: null, extractedText: value, error: null }
    }
    return { block: null, extractedText: buffer.toString('utf-8'), error: null }
  } catch {
    return { block: null, extractedText: null, error: 'bestand_niet_leesbaar' }
  }
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Per-IP: max 5 requests per minuut (widget + bot)
const ipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'arnobot:ip',
})

// Per-user: max 30 berichten per uur (bot only)
const userRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: 'arnobot:user',
})

async function notifyRateLimit(identifier: string, reden: string, dedupKey?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  // Deduplicatie: zelfde melding max 1x per uur (voor IP-spam)
  if (dedupKey) {
    const seen = await redis.get(dedupKey)
    if (seen) return
    await redis.set(dedupKey, '1', { ex: 3600 })
  }

  const text = `Rate limit geraakt op arno.bot\n\nGebruiker: ${identifier}\nReden: ${reden}`
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {})
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, history, userId: bodyUserId, profiel, sessionId: clientSessionId, antwoordLengte: rawLengte, document: rawDocument } = body
    const antwoordLengte = (['kort', 'normaal', 'uitgebreid'] as const).includes(rawLengte) ? rawLengte as 'kort' | 'normaal' | 'uitgebreid' : 'normaal'
    const origin = req.headers.get('origin')
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

    if (typeof question !== 'string' || question.length > 4000) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400, headers: corsHeaders(origin) })
    }
    if (Array.isArray(history) && history.length > 40) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400, headers: corsHeaders(origin) })
    }
    if (detectPromptInjection(question)) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400, headers: corsHeaders(origin) })
    }

    const isWidget = origin?.includes('arno.blog') ?? false

    // Start de VOLLEDIGE RAG-pipeline (queryherschrijving + opzoeking + rerank) meteen,
    // parallel aan de moderatie-check en de rest hierna, in plaats van pas te beginnen ná
    // de moderatie-check. Pas verderop ge-await't, op het punt waar de context daadwerkelijk
    // nodig is.
    // Multi-query: 1 Haiku-call levert 3 verschillend geformuleerde zoekzinnen (letterlijk,
    // brede sales-context, onderliggend thema), plus de rauwe vraag zelf als vierde hoek.
    // Elke zoekzin doorzoekt de kennisbank onafhankelijk en parallel; resultaten worden
    // samengevoegd vóórdat er wordt herrangschikt. Vangt het geval op waarin één enkele
    // herschrijving de vraag verkeerd inschat en daardoor relevante stof mist (kosten zijn
    // hier bewust geen overweging, kwaliteit staat voorop).
    const ragContextPromise: Promise<string> = (!isWidget
      ? Sentry.startSpan({ name: 'chat.rag-query-expansion', op: 'ai.claude' }, () =>
          client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 150,
            system: 'Je bent een zoekhulp voor een sales-kennisbank. Schrijf 3 verschillende zoekzinnen (elk max 20 woorden) die samen de vraag vanuit verschillende invalshoeken dekken: een die dicht bij de letterlijke vraag blijft, een met bredere sales-context en synoniemen, en een gericht op het onderliggende thema of probleem. Geef exact 3 regels, één zoekzin per regel, geen nummering, geen uitleg.',
            messages: [{ role: 'user', content: question }]
          })
        )
          .then(ragRes => {
            const lines = getText(ragRes.content, '').split('\n').map(l => l.trim()).filter(l => l.length > 10)
            return lines.length > 0 ? [question, ...lines] : [question]
          })
          .catch(() => [question])
      : Promise.resolve([question])
    ).then(searchQueries =>
      Sentry.startSpan({ name: 'chat.rag-lookup', op: 'db.rag' }, () => getRelevantChunksMultiQuery(searchQueries, question, 20))
    ).then(relevant => formatChunksForPrompt(relevant))

    let documentBlock: Anthropic.Messages.ContentBlockParam | null = null
    let documentText: string | null = null

    // Per-IP rate limit via Upstash (atomisch, geen race conditions)
    if (ip) {
      const { success: ipOk } = await ipRateLimit.limit(ip)
      if (!ipOk) {
        await notifyRateLimit(ip, 'IP-limiet (5/min)', `arnobot:notify:ip:${ip}`)
        return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: corsHeaders(origin) })
      }
    }

    // Voor ArnoBot-gebruikers (niet-widget): altijd de Clerk session gebruiken, nooit de body-waarde vertrouwen
    let userId: string | null = bodyUserId ?? null
    if (!isWidget) {
      const { userId: sessionUserId } = await auth()
      userId = sessionUserId
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })

      // Document-upload alleen voor ingelogde gebruikers, nooit voor de anonieme widget.
      // Bewust ná de auth-check: dit voorkomt dat een niet-ingelogde aanvrager (Origin
      // vervalst/weggelaten) de server base64/mammoth-verwerkingswerk laat doen vóórdat er
      // ooit een 401 wordt teruggegeven.
      if (rawDocument && typeof rawDocument === 'object'
        && typeof rawDocument.name === 'string' && typeof rawDocument.mediaType === 'string' && typeof rawDocument.data === 'string') {
        const result = await buildDocumentContentBlock(rawDocument as UploadedDocument)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400, headers: corsHeaders(origin) })
        }
        documentBlock = result.block
        documentText = result.extractedText
      }

      // Per-user rate limit: max 30 berichten per uur
      const { success: userOk } = await userRateLimit.limit(userId)
      if (!userOk) {
        await notifyRateLimit(userId, 'uur-limiet (30 berichten)')
        return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: corsHeaders(origin) })
      }

      // Enkelvoudige sessie: max 1 actief gesprek per gebruiker (beheerder uitgezonderd)
      if (userId !== process.env.ARNOBOT_OWNER_USER_ID && typeof clientSessionId === 'string' && clientSessionId.length > 0) {
        const lockKey = `arnobot:active:${userId}`
        const activeSid = await redis.get<string>(lockKey)
        if (activeSid && activeSid !== clientSessionId) {
          await notifyRateLimit(userId, 'dubbele sessie (twee vensters/apparaten)', `arnobot:notify:dual:${userId}`)
          return NextResponse.json({ error: 'dual_session' }, { status: 429, headers: corsHeaders(origin) })
        }
        await redis.set(lockKey, clientSessionId, { ex: 600 })
      }
    }

    // Plan + dagelijks gebruik
    let plan: 'basis' | 'premium' | 'team' = 'basis'
    let todayUsage = 0
    if (!isWidget) {
      const [planRes, todayRes] = await Promise.all([
        supabase.from('approved_users').select('plan').eq('user_id', userId!).single(),
        supabase
          .from('arnobot_rds_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
      ])
      plan = (planRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'basis'
      todayUsage = todayRes.count ?? 0
      const dagelijksMax = plan !== 'basis' ? 100 : 25
      if (todayUsage >= dagelijksMax) {
        return NextResponse.json({ error: 'dagelijks_limiet', dagelijks_gebruikt: todayUsage }, { status: 429, headers: corsHeaders(origin) })
      }
    }

    const sessionId = clientSessionId ?? userId ?? (ip ? `${ip}-${new Date().toISOString().slice(0, 10)}` : 'unknown')
    const LOST_URL = 'https://arno.blog/lost'

    // Gespreksgeheugen en coachingsdiagnose starten nu al, parallel aan de moderatie-check en
    // de RAG-pipeline hierboven, in plaats van pas na de RAG-context te beginnen. Beide hangen
    // alleen af van userId/plan/sessionId, niet van het RAG- of moderatie-resultaat.
    const memoryContextPromise: Promise<{ geheugentekst: string; prevSessionCount: number }> = (userId && !isWidget)
      ? Promise.all([
          supabase
            .from('arnobot_blog_sessions')
            .select('title, summary, feiten, uitdaging, actie_status, created_at')
            .eq('user_id', userId)
            .not('session_id', 'eq', sessionId)
            .order('created_at', { ascending: false })
            .limit(plan !== 'basis' ? 25 : 10),
          detectSparringReference(question)
            ? supabase
                .from('arnobot_sparring_sessions')
                .select('persona, debrief, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)
            : Promise.resolve({ data: null as { persona: string | null; debrief: string | null; created_at: string }[] | null }),
        ])
          .then(([{ data: prevSessions }, { data: sparringSessions }]) => {
            let geheugentekst = ''
            let prevSessionCount = 0
            if (prevSessions && prevSessions.length > 0) {
              prevSessionCount = prevSessions.length
              const feitenBlokken = prevSessions.filter(s => s.feiten).map(s => s.feiten).join('\n')
              const samenvattingen = prevSessions.filter(s => s.summary).map(s => {
                const datum = new Date(s.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
                return `- ${datum}: ${s.summary}`
              }).join('\n')
              const recentSessieMetUitdaging = prevSessions.find(s => s.uitdaging) ?? null
              const recentUitdaging = recentSessieMetUitdaging?.uitdaging ?? null
              const recentActieStatus = recentSessieMetUitdaging?.actie_status ?? null
              if (feitenBlokken || samenvattingen || recentUitdaging) {
                geheugentekst = '\n\nWAT DEZE GEBRUIKER EERDER HEEFT GEDEELD:'
                if (feitenBlokken) geheugentekst += `\n\nConcrete feiten uit eerdere gesprekken:\n${feitenBlokken}`
                if (samenvattingen) geheugentekst += `\n\nSamenvattingen van eerdere gesprekken:\n${samenvattingen}`
                if (recentUitdaging) {
                  const statusTekst = recentActieStatus === 'ja'
                    ? 'De gebruiker heeft aangegeven dit gedaan te hebben. Transparantie is een kernwaarde van Arno. Als iets in dit gesprek duidelijk niet klopt met dat antwoord, benoem het direct. Geen aannames over de reden want de volledige context is niet altijd zichtbaar. Het feit zelf benoemen is geen aanname. Sluit af met een open vraag: "Wat speelt er bij je?" Arno doet dit niet om te controleren maar omdat zijn enige drive is dat de gebruiker beter presteert en succesvol wordt. Dat is de toon: eerlijk en direct vanuit oprechte betrokkenheid.'
                    : recentActieStatus === 'deels'
                    ? 'De gebruiker heeft aangegeven dit ingepland te hebben maar nog niet volledig gedaan.'
                    : recentActieStatus === 'nee'
                    ? 'De gebruiker heeft aangegeven dit nog niet gedaan te hebben.'
                    : 'De gebruiker heeft hier nog geen antwoord op gegeven.'
                  geheugentekst += `\n\nActie uit vorig gesprek (gebruik dit alleen als het gesprek er aanleiding toe geeft):\n${recentUitdaging}\n${statusTekst}`
                }
              }
            }
            const relevanteSparring = (sparringSessions ?? []).filter(s => s.debrief)
            if (relevanteSparring.length > 0) {
              const sparringTekst = relevanteSparring.map(s => {
                const datum = new Date(s.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
                return `- ${datum} (rol: ${s.persona ?? 'onbekend'}):\n${s.debrief}`
              }).join('\n\n')
              geheugentekst += `\n\nSPARRING-OEFENSESSIES VAN DEZE GEBRUIKER (laatste ${relevanteSparring.length}, alleen relevant omdat de gebruiker er zelf naar verwijst):\n${sparringTekst}`
            }
            return { geheugentekst, prevSessionCount }
          })
      : Promise.resolve({ geheugentekst: '', prevSessionCount: 0 })

    const coachingContextPromise: Promise<string> = (!isWidget && plan !== 'basis' && userId)
      ? Promise.resolve(
          supabase
            .from('arnobot_coaching')
            .select('mindset_score, systeem_score, actie_score, mindset_diagnose, systeem_diagnose, actie_diagnose, ontwikkelpunten, voortgang')
            .eq('user_id', userId)
            .maybeSingle()
        )
          .then(({ data: coachingDoc }) => {
            if (coachingDoc?.mindset_score != null) {
              const msa = computeMsaScore(coachingDoc.mindset_score, coachingDoc.systeem_score, coachingDoc.actie_score)
              const punten = (coachingDoc.ontwikkelpunten as {tekst:string;pijlar:string}[] | null)?.map(p => `[${p.pijlar}] ${p.tekst}`).join(' | ') ?? ''
              return `\n\nCOACHINGSDIAGNOSE (MSA ${msa}/100):\nVoortgang: ${coachingDoc.voortgang}\nMindset (${coachingDoc.mindset_score}/5): ${coachingDoc.mindset_diagnose}\nSysteem (${coachingDoc.systeem_score}/5): ${coachingDoc.systeem_diagnose}\nActie (${coachingDoc.actie_score}/5): ${coachingDoc.actie_diagnose}${punten ? `\nOntwikkelpunten: ${punten}` : ''}`
            }
            return ''
          })
      : Promise.resolve('')

    // Geblokkeerde IPs direct doorsturen
    if (isWidget && ip) {
      const { data: blockedRow } = await supabase
        .from('arno_blog_widget_blocked')
        .select('ip')
        .eq('ip', ip)
        .limit(1)
        .single()
      if (blockedRow) {
        return NextResponse.json({ redirect: LOST_URL }, { headers: corsHeaders(origin) })
      }
    }

    // Content moderatie voor widget
    if (isWidget && ip) {
      const lastArnoMessage = history && history.length > 0
        ? history.filter((m: { role: string }) => m.role === 'assistant').slice(-1)[0]?.content
        : null

      const moderatiePrompt = lastArnoMessage
        ? `Je beoordeelt een widget-gesprek over sales en business.

Vorige vraag/opmerking van ArnoBot: "${lastArnoMessage}"
Reactie van de gebruiker: "${question}"

Antwoord met precies één woord:
ONGEPAST: seksueel, beledigend of trollen
OFFTOPIC: heeft geen logische samenhang met het gesprek en gaat niet over sales/business
OK: logisch vervolg op het gesprek of relevant voor sales/business`
        : `Categoriseer het bericht. Antwoord met precies één woord: ONGEPAST (seksueel, beledigend, trollen), OFFTOPIC (niet over sales/business/Arno, maar niet beledigend), of OK.`

      const checkRes = await Sentry.startSpan({ name: 'chat.moderation-check', op: 'ai.claude' }, () =>
        client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          system: moderatiePrompt,
          messages: [{ role: 'user', content: lastArnoMessage ? 'Beoordeel deze reactie.' : `Categoriseer: "${question}"` }]
        })
      )
      const check = getText(checkRes.content, 'OK').trim().toUpperCase()

      if (check.includes('ONGEPAST')) {
        await supabase.from('arno_blog_widget_blocked').upsert({ ip }, { onConflict: 'ip' })
        return NextResponse.json({ redirect: LOST_URL }, { headers: corsHeaders(origin) })
      }

      if (check.includes('OFFTOPIC')) {
        const alreadyWarned = history && history.some(
          (m: { role: string; content: string }) =>
            m.role === 'assistant' && m.content?.includes('Zullen we het zakelijk houden?')
        )
        if (alreadyWarned) {
          await supabase.from('arno_blog_widget_blocked').upsert({ ip }, { onConflict: 'ip' })
          return NextResponse.json({ redirect: LOST_URL }, { headers: corsHeaders(origin) })
        }
        return NextResponse.json({ answer: 'Zullen we het zakelijk houden?', hint: null }, { headers: corsHeaders(origin) })
      }
    }

    // Content moderatie voor ingelogde gebruikers: nudgen, nooit direct blokkeren.
    // Herhaald off-topic of iets ongepasts wordt gemarkeerd voor handmatige beoordeling
    // in de admin (een betalende gebruiker direct buitensluiten is te zwaar middel), en
    // na de derde keer in totaal wordt de gebruiker automatisch uitgelogd, niet geblokkeerd:
    // die kan altijd gewoon opnieuw inloggen zodra er weer een zakelijke vraag is.
    const OFFTOPIC_FALLBACKS = [
      'Zullen we het zakelijk houden?',
      'Interessant, maar laten we het over jouw sales hebben.',
      'Kom terug als je weer bij zakelijke zinnen bent.',
    ]
    const OFFTOPIC_LOGOUT_FALLBACK = 'Dit gesprek stopt hier. Kom terug zodra je een zakelijke vraag hebt.'

    if (!isWidget && userId) {
      // Telt alleen sinds de laatste keer dat deze gebruiker is uitgelogd, niet levenslang:
      // na een uitlog-cyclus krijgt iemand weer een schone lei (nudge, nudge, uitloggen).
      const { data: lastLogoutRow } = await supabase
        .from('arnobot_offtopic_flags')
        .select('created_at')
        .eq('user_id', userId)
        .eq('caused_logout', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let countQuery = supabase
        .from('arnobot_offtopic_flags')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (lastLogoutRow) countQuery = countQuery.gt('created_at', lastLogoutRow.created_at)
      const { count: priorCount } = await countQuery
      const occurrence = (priorCount ?? 0) + 1 // deze poging meegeteld

      const historyExcerpt = (history || []).slice(-6)
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Gebruiker' : 'ArnoBot'}: ${m.content}`)
        .join('\n')

      const offtopicToon = occurrence >= 3
        ? 'Dit is al de derde keer dat deze gebruiker afdwaalt, het gesprek wordt na dit bericht automatisch beëindigd. Schrijf een korte, duidelijke maar niet onaardige mededeling dat het gesprek hierdoor stopt, en dat diegene welkom is terug te komen zodra er een zakelijke vraag is.'
        : occurrence >= 2
        ? 'Dit is niet de eerste keer. Wees directer en korter dan een uitnodigende vraag, bijvoorbeeld in de trant van "Kom terug als je weer bij zakelijke zinnen bent."'
        : 'Dit is de eerste keer. Reageer zoals een mens dat in de praktijk zou doen: met een kwinkslag of luchtige humor die het onderwerp zelf gebruikt om terug te koppelen naar zaken of naar de klant van de gebruiker (bijvoorbeeld bij een vraag over een appeltaartrecept: "Wil je daarmee je klant verrassen?"). Alleen als een speelse invalshoek echt niet logisch past bij dit specifieke bericht, val terug op een directe, uitnodigende vraag die verwijst naar het laatste zakelijke onderwerp uit het gesprek hieronder. Varieer, gebruik niet bij elk gesprek dezelfde opening.'
      const ongepastToon = 'Geen humor, geen kwinkslag, dit is bewust aanstootgevend, seksueel ongepast of vergelijkbaar. Wees kort, serieus en duidelijk dat dit niet in het gesprek past, zonder te preken.'

      const moderatiePrompt = `Je beoordeelt een gesprek over sales en business met een ingelogde ArnoBot-gebruiker.

Gesprek tot nu toe:
${historyExcerpt || '(nog geen eerdere berichten)'}

Nieuwste bericht van de gebruiker: "${question}"

Stap 1: categoriseer dit nieuwste bericht. Schrijf op de EERSTE regel precies één woord:
ONGEPAST: seksueel, beledigend, verontrustend of duidelijk kwaadwillig
OFFTOPIC: heeft geen logische samenhang met het gesprek, gaat niet over sales/business, en de gebruiker gaat niet mee in een eerdere luchtige terugkoppeling
OK: logisch vervolg op het gesprek, relevant voor sales/business, OF onschuldige humor/luchtigheid die goed meegaat met een eerdere speelse terugkoppeling van ArnoBot

Belangrijk: als het vorige antwoord van ArnoBot hierboven een luchtige, humoristische terugkoppeling naar zaken was, en de gebruiker reageert daar speels en onschuldig op, ook al gaat die reactie zelf niet letterlijk over sales, beoordeel dat dan als OK. De humor heeft dan zijn werk gedaan, dat hoeft niet te tellen als afdwalen. Beoordeel pas als OFFTOPIC als de gebruiker die terugkoppeling negeert en zelf weer een nieuw, ongerelateerd onderwerp aansnijdt. Wees bij ONGEPAST alleen streng bij content die echt verontrustend, seksueel of kwaadwillig is, niet bij onschuldige grappen.

Stap 2: alleen als het niet OK is, schrijf op de TWEEDE regel een korte reactie (1-2 zinnen) in de stijl van Arno Diepeveen die het gesprek terugbrengt naar zakelijk.
Als je categoriseerde als ONGEPAST: ${ongepastToon}
Als je categoriseerde als OFFTOPIC: ${offtopicToon}

Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u".`

      const checkRes = await Sentry.startSpan({ name: 'chat.moderation-check-app', op: 'ai.claude' }, () =>
        client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          system: moderatiePrompt,
          messages: [{ role: 'user', content: 'Beoordeel dit bericht.' }]
        })
      )
      const rawCheck = getText(checkRes.content, 'OK').trim()
      const [firstLine, ...rest] = rawCheck.split('\n')
      const check = firstLine.trim().toUpperCase()
      const generatedReply = rest.join('\n').trim()

      if (check.includes('ONGEPAST') || check.includes('OFFTOPIC')) {
        const category = check.includes('ONGEPAST') ? 'ongepast' : 'offtopic'
        // ONGEPAST is altijd meteen zichtbaar voor beoordeling, ook de eerste keer. Alleen
        // OFFTOPIC mag de eerste keer stil blijven (onschuldig uitstapje, geen review nodig).
        const reviewed = category === 'offtopic' && occurrence === 1
        await supabase.from('arnobot_offtopic_flags').insert({ user_id: userId, category, message: question, reviewed, caused_logout: occurrence >= 3 })

        if (occurrence >= 3) {
          return NextResponse.json({ answer: generatedReply || OFFTOPIC_LOGOUT_FALLBACK, forceLogout: true, hint: null }, { headers: corsHeaders(origin) })
        }
        const fallback = OFFTOPIC_FALLBACKS[Math.min(occurrence - 1, OFFTOPIC_FALLBACKS.length - 1)]
        return NextResponse.json({ answer: generatedReply || fallback, hint: null }, { headers: corsHeaders(origin) })
      }
    }

    // Limiet alleen voor widget-bezoekers zonder account
    let hint: string | null = null
    const limitEnabled = process.env.ARNOBOT_LIMIT_ENABLED === 'true'
    if (limitEnabled && ip && !userId) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('arno_blog_widget_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since)

      const n = count ?? 0
      if (n >= 4) {
        return NextResponse.json({ blocked: true }, { headers: corsHeaders(origin) })
      }
      if (n === 2) hint = 'last_chance'
      if (n === 3) hint = 'salescanvas'
    }

    // ragContextPromise draait al sinds het begin van dit verzoek, parallel aan de moderatie-
    // check hierboven en de rest, in plaats van pas nu te starten.
    const context = await ragContextPromise

    const questionWithDocument = documentText
      ? `${question}\n\n[Bijlage: ${rawDocument?.name ?? 'document'}]\n${documentText}`
      : question

    const messages = [
      ...(history || []),
      {
        role: 'user' as const,
        content: documentBlock
          ? [documentBlock, { type: 'text' as const, text: questionWithDocument }]
          : questionWithDocument,
      },
    ]

    const profielContext = profiel ? `
PROFIEL VAN DE GEBRUIKER:
- Rol: ${profiel.rol || 'onbekend'}
- Jaren in sales: ${profiel.jaren_sales || 'onbekend'}
- Jaren in huidige functie: ${profiel.jaren_functie || 'onbekend'}
- Markt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}
- Wat hij/zij verkoopt: ${profiel.wat_verkoop_je || 'onbekend'}
- Ideale klant: ${profiel.ideale_klant || 'onbekend'}
- Grootste uitdaging: ${profiel.uitdaging || 'onbekend'}${profiel.dealgrootte ? `\n- Gemiddelde dealgrootte: ${profiel.dealgrootte}` : ''}${profiel.salescyclus ? `\n- Salescyclus: ${profiel.salescyclus}` : ''}${profiel.teamgrootte ? `\n- Salesteam grootte: ${profiel.teamgrootte}` : ''}${profiel.target_dit_jaar ? `\n- Target dit jaar halen: ${profiel.target_dit_jaar}` : ''}${profiel.target_3_jaar ? `\n- Target afgelopen 3 jaar: ${profiel.target_3_jaar}` : ''}${profiel.jaardoel ? `\n- Doel dit jaar (zachte context, alleen gebruiken als het gesprek daar aanleiding toe geeft): ${profiel.jaardoel}` : ''}
` : ''

    // memoryContextPromise/coachingContextPromise draaien al sinds vlak na de auth-check,
    // parallel aan de moderatie-check en de RAG-pipeline, in plaats van pas nu te starten.
    const { geheugentekst, prevSessionCount } = await memoryContextPromise
    const coachingContext = await coachingContextPromise

    const systemPrompt = isWidget
      ? buildWidgetSystemPrompt(context, hint === 'salescanvas')
      : buildRdsSystemPrompt(profielContext + geheugentekst + coachingContext, context, (history || []).length, antwoordLengte, prevSessionCount)

    // Streaming i.p.v. één blokkerend antwoord: de tekst komt bij de gebruiker binnen terwijl
    // Claude hem genereert, in plaats van pas na het volledige antwoord. StreamingDashSanitizer
    // stuurt tekst pas door zodra vaststaat dat een streepje niet meer kan volgen (een vaste
    // lookback-buffer bleek bij live tests niet voldoende: die verstuurt de spatie vóór een
    // streepje soms al vóórdat bekend is of er een streepje komt). Metadata die al vooraf
    // bekend is (hint, daglimiet-teller) gaat in de headers, log_id (pas bekend na het
    // wegschrijven) komt als klein blokje ná het einde van de tekst-stream.
    const encoder = new TextEncoder()
    const anthropicStream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: isWidget ? 1500 : antwoordLengte === 'kort' ? 600 : antwoordLengte === 'uitgebreid' ? 2200 : 1200,
      system: systemPrompt,
      messages
    })

    const readable = new ReadableStream({
      async start(controller) {
        const sanitizer = new StreamingDashSanitizer()
        try {
          await Sentry.startSpan({ name: 'chat.main-response', op: 'ai.claude' }, async () => {
            for await (const event of anthropicStream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const toSend = sanitizer.push(event.delta.text)
                if (toSend) controller.enqueue(encoder.encode(toSend))
              }
            }
          })

          const remainder = sanitizer.flush()
          if (remainder) controller.enqueue(encoder.encode(remainder))

          const finalMessage = await anthropicStream.finalMessage()
          let answer = getText(finalMessage.content)

          if (!answer) {
            console.error('[chat] leeg antwoord na streaming, sessionId:', sessionId, 'userId:', userId ?? '(anoniem)')
            const retryMessage = await client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: isWidget ? 1500 : antwoordLengte === 'kort' ? 600 : antwoordLengte === 'uitgebreid' ? 2200 : 1200,
              system: systemPrompt,
              messages,
            })
            answer = getText(retryMessage.content)
            if (!answer) {
              console.error('[chat] leeg antwoord na retry, sessionId:', sessionId, 'userId:', userId ?? '(anoniem)')
              answer = 'Sorry, kun je dat anders verwoorden? Ik kreeg geen goed antwoord terug.'
            }
            controller.enqueue(encoder.encode(answer))
          }

          let logId: string | null = null
          if (isWidget) {
            await supabase.from('arno_blog_widget_logs').insert({ question, answer, ip, session_id: sessionId, user_id: userId ?? null })
          } else {
            const { data: logRow } = await supabase
              .from('arnobot_rds_logs')
              .insert({ question, answer, ip, session_id: sessionId, user_id: userId ?? null })
              .select('id')
              .single()
            logId = logRow?.id ?? null
          }

          controller.enqueue(encoder.encode(`\n<<<ARNOBOT_META>>>${JSON.stringify({ log_id: logId })}`))
        } catch (err) {
          console.error('Chat stream error:', err instanceof Error ? err.message : String(err))
          controller.error(err)
        } finally {
          controller.close()
        }
      }
    })

    const responseHeaders: Record<string, string> = { ...corsHeaders(origin), 'Content-Type': 'text/plain; charset=utf-8' }
    if (hint) responseHeaders['X-Hint'] = hint
    if (!isWidget && plan === 'basis') responseHeaders['X-Dagelijks-Gebruikt'] = String(todayUsage + 1)

    return new Response(readable, { headers: responseHeaders })
  } catch (err) {
    console.error('Chat error:', err instanceof Error ? err.message : String(err))
    const origin = req.headers.get('origin')
    return NextResponse.json({ error: 'Verzoek mislukt' }, { status: 500, headers: corsHeaders(origin) })
  }
}

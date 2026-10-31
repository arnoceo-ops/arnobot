import { NextRequest, NextResponse } from 'next/server'

// 60 volstond voor tekst/documenten, maar een audiobijlage transcriberen (lib/assemblyai.ts,
// polling tot 240s) kan langer duren dan de rest van deze route ooit nodig had.
export const maxDuration = 300

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
    'Access-Control-Expose-Headers': 'X-Hint',
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
import { haalGeheugenContext, bouwProfielContext, type GeheugenContext } from '@/lib/geheugenContext'
import { buildRdsSystemPrompt, buildWidgetSystemPrompt } from '@/lib/systemPrompt'
import { computeMsaScore } from '@/lib/msa'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import mammoth from 'mammoth'
import { E2E_TEST_USER_ID, MANUAL_TEST_USER_ID, APP_REVIEWER_ID } from '@/lib/internalTestAccounts'
import { transcribeAudioAttachment, AUDIO_MEDIA_TYPES } from '@/lib/assemblyai'
import { downloadAndDeleteAttachment } from '@/lib/chatAttachments'

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

  // Grootte wordt al gecontroleerd door de aanroeper op het gedownloade buffer (vóór
  // base64-encoderen), dat is nu de enige plek waar de ruwe bestandsgrootte nog bekend is.

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

// Test-identifiers uitgesloten (besloten 2026-08-12, gevonden doordat de nieuwe
// dubbele-sessie-E2E-test een echte Telegram-melding stuurde, gebruiker onherkenbaar
// als testaccount): zowel de bekende testaccount-ID's als localhost-IP's (::1/127.0.0.1),
// die in productie nooit een echte gebruiker kunnen zijn maar bij elke lokale E2E-run
// wel de IP-rate-limit kunnen raken.
function isTestIdentifier(identifier: string): boolean {
  return identifier === E2E_TEST_USER_ID || identifier === MANUAL_TEST_USER_ID
    || identifier === APP_REVIEWER_ID
    || identifier === '::1' || identifier === '127.0.0.1'
}

async function notifyRateLimit(identifier: string, reden: string, dedupKey?: string) {
  if (isTestIdentifier(identifier)) return
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
    const { question, history, userId: bodyUserId, profiel, sessionId: clientSessionId, antwoordLengte: rawLengte, document: rawDocument, forceSession } = body
    let antwoordLengte = (['kort', 'normaal', 'uitgebreid'] as const).includes(rawLengte) ? rawLengte as 'kort' | 'normaal' | 'uitgebreid' : 'normaal'
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

    // Per-IP rate limit via Upstash (atomisch, geen race conditions). Test-IP's overgeslagen:
    // dezelfde reden als isTestIdentifier hieronder, localhost draait bij lokale E2E-runs
    // meerdere testbestanden kort na elkaar tegen dezelfde production-Redis-instantie.
    if (ip && !isTestIdentifier(ip)) {
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
      // vervalst/weggelaten) de server download/mammoth-verwerkingswerk laat doen vóórdat er
      // ooit een 401 wordt teruggegeven.
      //
      // storagePath (niet meer data/base64 in de body): een document ging tot 2026-09-17 als
      // base64 in deze JSON-body mee, wat boven ~3,3MB ruwe bestandsgrootte al de harde 4,5MB
      // request-bodylimiet van een Vercel-functie raakte, ook al claimde de UI een limiet van
      // 10MB. SparClient.tsx uploadt nu net als een audiobijlage rechtstreeks naar Supabase
      // Storage en stuurt hier alleen het pad mee.
      if (rawDocument && typeof rawDocument === 'object'
        && typeof rawDocument.name === 'string' && typeof rawDocument.mediaType === 'string'
        && typeof rawDocument.storagePath === 'string' && !AUDIO_MEDIA_TYPES.has(rawDocument.mediaType)) {
        const { buffer, error: downloadError } = await downloadAndDeleteAttachment(userId, rawDocument.storagePath)
        if (downloadError || !buffer) {
          return NextResponse.json({ error: downloadError ?? 'bestand_niet_leesbaar' }, { status: 400, headers: corsHeaders(origin) })
        }
        if (buffer.length > MAX_DOCUMENT_BYTES) {
          return NextResponse.json({ error: 'bestand_te_groot' }, { status: 400, headers: corsHeaders(origin) })
        }
        const result = await buildDocumentContentBlock({ name: rawDocument.name, mediaType: rawDocument.mediaType, data: buffer.toString('base64') })
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400, headers: corsHeaders(origin) })
        }
        documentBlock = result.block
        documentText = result.extractedText
      }

      // Per-user rate limit: max 30 berichten per uur. Test-accounts overgeslagen (besloten
      // 2026-08-24): de dubbele-sessie-E2E-test verstuurt binnen één run al meerdere berichten
      // op hetzelfde test-account tegen de echte production-Redis-instantie, en liep daardoor
      // vast op ditzelfde quotum dat voor echte klanten bedoeld is, ook al testte die test iets
      // heel anders (sessie-lock-herstel). isTestIdentifier bestond al om Telegram-ruis te
      // onderdrukken (2026-08-12), maar de blokkade zelf bleef toen onbedoeld staan.
      if (!isTestIdentifier(userId)) {
        const { success: userOk } = await userRateLimit.limit(userId)
        if (!userOk) {
          await notifyRateLimit(userId, 'uur-limiet (30 berichten)')
          return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: corsHeaders(origin) })
        }
      }

      // Enkelvoudige sessie: max 1 actief gesprek per gebruiker (beheerder uitgezonderd).
      // TTL bewust kort (120s, was 600s): de lock ververst toch bij elk bericht van dezelfde
      // sessie, dus een kortere TTL beperkt alleen hoe lang een verlaten/vervangen sessie
      // (tabblad gesloten, cache geleegd waardoor het lokale sessie-ID verandert) een nieuwe
      // sessie kan blokkeren, zonder de daadwerkelijke dubbel-gebruik-bescherming te verzwakken.
      // forceSession (client stuurt dit na expliciete "dit ben ik"-bevestiging) overschrijft de
      // lock altijd, blijft achter Clerk-auth dus alleen de accounteigenaar zelf kan dit.
      if (userId !== process.env.ARNOBOT_OWNER_USER_ID && typeof clientSessionId === 'string' && clientSessionId.length > 0) {
        const lockKey = `arnobot:active:${userId}`
        const activeSid = await redis.get<string>(lockKey)
        if (activeSid && activeSid !== clientSessionId && !forceSession) {
          await notifyRateLimit(userId, 'dubbele sessie (twee vensters/apparaten)', `arnobot:notify:dual:${userId}`)
          return NextResponse.json({ error: 'dual_session' }, { status: 429, headers: corsHeaders(origin) })
        }
        await redis.set(lockKey, clientSessionId, { ex: 120 })
      }
    }

    // Plan + dagelijks gebruik
    let plan: 'basis' | 'premium' | 'team' = 'basis'
    let todayUsage = 0
    let voornaamGebruiker = ''
    if (!isWidget) {
      const [planRes, todayRes] = await Promise.all([
        supabase.from('approved_users').select('plan, voornaam').eq('user_id', userId!).single(),
        supabase
          .from('arnobot_rds_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
      ])
      plan = (planRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'basis'
      voornaamGebruiker = (planRes.data?.voornaam ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 40)
      todayUsage = todayRes.count ?? 0
      const dagelijksMax = plan !== 'basis' ? 100 : 25
      if (todayUsage >= dagelijksMax) {
        return NextResponse.json({ error: 'dagelijks_limiet', dagelijks_gebruikt: todayUsage }, { status: 429, headers: corsHeaders(origin) })
      }
    }

    // Uitgebreide antwoorden zijn Pro-only. Client-side is dit al zo (PRO-label + upsell-tekst
    // in SparClient.tsx), maar dat is te omzeilen door de request body aan te passen — dit is
    // de eigenlijke afdwinging, niet te omzeilen vanuit de browser.
    if (antwoordLengte === 'uitgebreid' && plan === 'basis') {
      antwoordLengte = 'normaal'
    }

    // Audiobijlage (opname van een echt gesprek, i.p.v. een document): SparClient.tsx upload
    // die rechtstreeks naar Supabase Storage en stuurt hier alleen het pad mee, want de
    // Vercel-functielimiet (4,5MB) staat de bytes zelf niet toe in deze JSON-body. Zelfde
    // gate als /api/bot/audio-upload-url, hier herhaald omdat de client die eerdere check zou
    // kunnen omzeilen door direct tegen deze route te posten.
    if (!isWidget && rawDocument && typeof rawDocument === 'object'
      && typeof rawDocument.name === 'string' && typeof rawDocument.mediaType === 'string'
      && typeof rawDocument.storagePath === 'string' && AUDIO_MEDIA_TYPES.has(rawDocument.mediaType)) {
      if (plan === 'basis') {
        return NextResponse.json({ error: 'audio_alleen_betaald' }, { status: 403, headers: corsHeaders(origin) })
      }
      const { text, error } = await transcribeAudioAttachment(userId!, rawDocument.storagePath)
      if (error || !text) {
        return NextResponse.json({ error: error ?? 'audio_transcriptie_mislukt' }, { status: 502, headers: corsHeaders(origin) })
      }
      // Geen eigen "[Bijlage: ...]"-kop hier, die zet questionWithDocument hieronder er al
      // overheen. Sprekerslabels (SPREKER A/B) i.p.v. namen: AssemblyAI kent de identiteit van
      // de sprekers niet. De instructie duwt Claude om eerst te vragen wat de gebruiker met dit
      // gesprek wil (technieken checken, samenvatten, iets anders) i.p.v. dat te veronderstellen,
      // want dat verschilt wezenlijk van een geüpload document waarbij het doel al uit de vraag
      // van de gebruiker blijkt.
      documentText = `(Dit is een automatisch getranscribeerd gesprek met sprekerslabels, geen document. Vraag eerst wat de gebruiker hiermee wil als dat niet al duidelijk is uit zijn vraag, geef niet meteen een inhoudelijke beoordeling.)\n\n${text}`
    }

    const sessionId = clientSessionId ?? userId ?? (ip ? `${ip}-${new Date().toISOString().slice(0, 10)}` : 'unknown')
    const LOST_URL = 'https://arno.blog/lost'

    // Gespreksgeheugen en coachingsdiagnose starten nu al, parallel aan de moderatie-check en
    // de RAG-pipeline hierboven, in plaats van pas na de RAG-context te beginnen. Beide hangen
    // alleen af van userId/plan/sessionId, niet van het RAG- of moderatie-resultaat.
    const memoryContextPromise: Promise<GeheugenContext> = (userId && !isWidget)
      ? haalGeheugenContext(supabase, { userId, sessionId, question, history, plan })
      : Promise.resolve({ geheugentekst: '', prevSessionCount: 0, verouderd: false })

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
ONGEPAST: duidelijk seksueel, beledigend of trollen
OFFTOPIC: heeft overduidelijk geen enkele samenhang met het gesprek en gaat niet over sales/business
OK: logisch vervolg op het gesprek of relevant voor sales/business, of een reactie die kritiek geeft op het gesprek zelf (bijvoorbeeld dat ArnoBot alleen maar terugvraagt in plaats van antwoord geeft). Dat is geen afdwalen, dat is een terechte reactie op de bot.

Een kort antwoord op een vraag of opdracht van ArnoBot is ALTIJD OK, ook als het heel kort, slordig of in een andere taal is (bijvoorbeeld "ja", "nee", "all positive", "beide", een getal, "weet ik niet"). Het gaat om de samenhang met wat ArnoBot net vroeg, niet om lengte of taal. Bij twijfel: OK.`
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

      // OFFTOPIC blokkeert nooit permanent (een kort, slordig antwoord of een gedeeld kantoor-IP
      // mag niet tot een blokkade leiden). Alleen ONGEPAST blokkeert.
      if (check.includes('OFFTOPIC')) {
        return NextResponse.json({ answer: 'Interessant, maar laten we het over jouw sales hebben.', hint: null }, { headers: corsHeaders(origin) })
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
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('arno_blog_widget_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since)

      const n = count ?? 0
      if (n >= 5) {
        return NextResponse.json({ blocked: true }, { headers: corsHeaders(origin) })
      }
      if (n === 3) hint = 'last_chance'
      if (n === 4) hint = 'salescanvas'
    }

    // ragContextPromise draait al sinds het begin van dit verzoek, parallel aan de moderatie-
    // check hierboven en de rest, in plaats van pas nu te starten.
    const context = await ragContextPromise

    const questionWithDocument = documentText
      ? `${question}\n\n[Bijlage: ${rawDocument?.name ?? 'document'}]\n${documentText}`
      : question

    // memoryContextPromise/coachingContextPromise draaien al sinds vlak na de auth-check,
    // parallel aan de moderatie-check en de RAG-pipeline, in plaats van pas nu te starten.
    const { geheugentekst, prevSessionCount, verouderd } = await memoryContextPromise
    const coachingContext = await coachingContextPromise

    // Bij een verouderd gesprek zit de oude geschiedenis als gedateerd geheugen in geheugentekst.
    const effectieveHistory = verouderd ? [] : (history || [])

    const messages = [
      ...effectieveHistory,
      {
        role: 'user' as const,
        content: documentBlock
          ? [documentBlock, { type: 'text' as const, text: questionWithDocument }]
          : questionWithDocument,
      },
    ]

    const profielContext = bouwProfielContext(profiel, voornaamGebruiker)

    const systemPrompt = isWidget
      ? buildWidgetSystemPrompt(context, hint === 'salescanvas')
      : buildRdsSystemPrompt(profielContext + geheugentekst + coachingContext, context, effectieveHistory.length, antwoordLengte, prevSessionCount)

    // Streaming i.p.v. één blokkerend antwoord: de tekst komt bij de gebruiker binnen terwijl
    // Claude hem genereert, in plaats van pas na het volledige antwoord. StreamingDashSanitizer
    // stuurt tekst pas door zodra vaststaat dat een streepje niet meer kan volgen (een vaste
    // lookback-buffer bleek bij live tests niet voldoende: die verstuurt de spatie vóór een
    // streepje soms al vóórdat bekend is of er een streepje komt). Metadata die al vooraf
    // bekend is (hint, daglimiet-teller) gaat in de headers, log_id (pas bekend na het
    // wegschrijven) komt als klein blokje ná het einde van de tekst-stream.
    const encoder = new TextEncoder()
    // Kleine buffer boven de bedoelde lengte per tier, zodat een antwoord dat net over de
    // grens dreigt te gaan niet midden in een woord afkapt. Dit verruimt de bedoelde
    // beknoptheid niet structureel, het voorkomt alleen dat de rand de zin doorsnijdt.
    const chatMaxTokens = isWidget ? 1800 : antwoordLengte === 'kort' ? 750 : antwoordLengte === 'uitgebreid' ? 2500 : 1450
    const anthropicStream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: chatMaxTokens,
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
              max_tokens: chatMaxTokens,
              system: systemPrompt,
              messages,
            })
            answer = getText(retryMessage.content)
            if (!answer) {
              console.error('[chat] leeg antwoord na retry, sessionId:', sessionId, 'userId:', userId ?? '(anoniem)')
              answer = 'Sorry, kun je dat anders verwoorden? Ik kreeg geen goed antwoord terug.'
            }
            controller.enqueue(encoder.encode(answer))
          } else if (finalMessage.stop_reason === 'max_tokens') {
            // Het afgekapte deel is al naar de gebruiker gestreamd. Eén keer doorgaan waar het
            // model stopte (zelfde streepjesfilter, zelfde stream), zodat een lang antwoord niet
            // midden in een zin of tabel eindigt. De beknoptheid blijft intact: alleen een
            // antwoord dat de limiet daadwerkelijk raakt krijgt een vervolg.
            let doorgegaan = false
            try {
              const vervolgStream = client.messages.stream({
                model: 'claude-sonnet-4-6',
                max_tokens: chatMaxTokens,
                system: systemPrompt,
                messages: [
                  ...messages,
                  { role: 'assistant' as const, content: answer },
                  { role: 'user' as const, content: 'Je antwoord werd afgekapt. Ga verder precies waar je stopte, zonder iets te herhalen en zonder inleiding of opmerking over het afkappen. Begin gewoon met het volgende woord.' },
                ],
              })
              const vervolgSanitizer = new StreamingDashSanitizer()
              for await (const event of vervolgStream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  const toSend = vervolgSanitizer.push(event.delta.text)
                  if (toSend) controller.enqueue(encoder.encode(toSend))
                }
              }
              const vervolgRest = vervolgSanitizer.flush()
              if (vervolgRest) controller.enqueue(encoder.encode(vervolgRest))
              const vervolgFinal = await vervolgStream.finalMessage()
              const vervolgTekst = getText(vervolgFinal.content)
              if (vervolgTekst) {
                answer = answer + vervolgTekst
                doorgegaan = true
              }
              if (vervolgFinal.stop_reason === 'max_tokens') doorgegaan = false
            } catch (err) {
              console.error('[chat] vervolg na max_tokens mislukt:', err instanceof Error ? err.message : String(err))
            }
            if (!doorgegaan) {
              // Ook het vervolg raakte de limiet of faalde: wel loggen zodat zichtbaar blijft
              // hoe vaak een antwoord echt afgekapt eindigt.
              console.error('[chat] antwoord afgekapt op max_tokens, sessionId:', sessionId, 'userId:', userId ?? '(anoniem)', 'antwoordLengte:', antwoordLengte)
              Sentry.captureMessage('[chat] antwoord afgekapt op max_tokens', {
                level: 'warning',
                extra: { sessionId, userId: userId ?? null, antwoordLengte, isWidget, chatMaxTokens },
              })
            }
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

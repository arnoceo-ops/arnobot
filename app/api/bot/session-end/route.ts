export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { getRelevantChunks, embedSessionText } from '@/lib/rag'
import { extractAndStoreEntities } from '@/lib/memoryEntities'
import { notifyCronFailure } from '@/lib/cron-notify'
import { THEMA_LABELS, parseThemaClassificatie } from '@/lib/themas'
import { RULE_ENGLISH_TERMS, RULE_NO_CRUDE_LANGUAGE, RULE_NEVER_BREAK_CHARACTER, RULE_NO_INVENTED_DETAILS, RULE_NO_DASH } from '@/lib/systemPrompt'
import { Redis } from '@upstash/redis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(req: NextRequest) {
  const { sessionId, messages, explicitClose } = await req.json()
  if (!sessionId || !messages?.length) return NextResponse.json({ ok: true })

  // Auth via Clerk cookie, of fallback via bestaande log-rij (voor sendBeacon die geen cookies meestuurt)
  let userId: string | null = null
  try {
    const clerkAuth = await auth()
    userId = clerkAuth.userId
  } catch {}

  if (!userId) {
    // Alleen recente sessies (laatste 2 uur): sendBeacon bij het sluiten van een tab hoort
    // door dezelfde origin altijd cookies mee te sturen, dus dit pad is puur een vangnet
    // voor randgevallen, niet de normale route. Zonder tijdslimiet zou een oude, ooit
    // gelekte sessionId (bijv. via logs) hier permanent bruikbaar blijven om als een
    // andere gebruiker data te schrijven (IDOR); met deze limiet is dat venster klein.
    const tweeUurGeleden = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: logRow } = await supabase
      .from('arnobot_rds_logs')
      .select('user_id')
      .eq('session_id', sessionId)
      .not('user_id', 'is', null)
      .gte('created_at', tweeUurGeleden)
      .limit(1)
      .single()
    userId = logRow?.user_id ?? null
  }

  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  // Ruimt de "actief gesprek elders"-lock op (app/api/chat/route.ts, arnobot:active:{userId})
  // zodra deze exacte sessie 'm zelf gezet had, maar ALLEEN bij een expliciete SLUIT-actie
  // (explicitClose, de bewuste fetch() in SparClient.tsx), niet bij de sendBeacon op
  // beforeunload. Bewust zo ingeperkt (24 aug 2026): de eerdere, bredere versie ruimde de lock
  // ook op bij een kale page.reload(), en een reload triggert dezelfde beforeunload-beacon als
  // een echte tabsluiting. Daardoor werd de dubbele-sessie-bescherming zelf omzeild in precies
  // het scenario waarvoor hij bestaat (cache leeg/ander apparaat, nieuw lokaal sessie-ID): de
  // oude lock werd al weggegooid vóórdat de "dit ben ik"-check ooit kon afgaan (gevonden via
  // e2e/backend-integration.spec.ts). Bij een expliciete SLUIT-klik is er geen enkele twijfel
  // dat dit de accounteigenaar zelf is die het gesprek afrondt, dus dat pad blijft de lock wel
  // opruimen (lost de oorspronkelijke klacht van 22 aug nog steeds op). Alleen verwijderen als
  // de lock nog exact op deze sessie staat, niet blind, anders zou een laat binnenkomende
  // aanroep een intussen echt actieve andere sessie kunnen wegvegen.
  if (explicitClose) {
    try {
      const lockKey = `arnobot:active:${userId}`
      const activeSid = await redis.get<string>(lockKey)
      if (activeSid === sessionId) await redis.del(lockKey)
    } catch {}
  }

  const title = (messages.find((m: { role: string }) => m.role === 'user')?.content as string)?.slice(0, 100) || 'Gesprek'

  // Gebruik de echte tellung uit de database als bron van waarheid
  const { count: actualCount } = await supabase
    .from('arnobot_rds_logs')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  const messageCount = actualCount ?? 0
  if (messageCount === 0) return NextResponse.json({ ok: true })

  const conversationText = messages
    .map((m: { role: string; content: string }) =>
      `${m.role === 'user' ? 'GEBRUIKER' : 'ARNO'}: ${m.content}`
    )
    .join('\n\n')

  // Synthese, feiten en uitdaging parallel genereren
  let summary = ''
  let feiten = ''
  let uitdaging = ''
  let themas: string[] = []
  let excuustaal = false

  const callSummaryModel = () => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `Je bent Arno Diepeveen. Oprichter Royal Dutch Sales. Direct, ongefilterd, geen bullshit. Geen corporate taal. Geen accenten op woorden voor nadruk. Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}`,
    messages: [{
      role: 'user',
      content: `Schrijf een feitelijke terugblik op dit gesprek in 2 tot 3 volledige zinnen. Bij één centraal thema volstaan 2 zinnen. Elke zin moet een volledig afgeronde gedachte zijn. Nooit halverwege afbreken. Beschrijf alleen wat er besproken is: het onderwerp en de richting van het gesprek. Geen analyse, geen oordelen, geen "ik heb uitgewerkt" of "ik heb geconcludeerd". Alleen wat er aan de orde was. Spreek de gebruiker direct aan met "je" of "jij", nooit als "de gebruiker". Je schrijft als Arno, direct tegen de persoon met wie je gesproken hebt.\n\n${conversationText}`
    }]
  })
  const callFeitenModel = () => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: `Extraheer alleen concrete, feitelijke informatie uit dit gesprek. Denk aan: producten, diensten, bedrijfsnaam, markt, specifieke situaties, namen, cijfers, uitdagingen, doelen. Geen interpretaties, geen advies. Alleen feiten die de gebruiker heeft gedeeld. Maximaal 8 korte bullets, elk op een nieuwe regel als losse zin.

${RULE_NO_DASH}

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}`,
    messages: [{
      role: 'user',
      content: `Extraheer de feiten uit dit gesprek:\n\n${conversationText}`
    }]
  })
  const callThemasModel = () => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    system: `Classificeer dit salesgesprek op twee dingen tegelijk.

1. Thema's: maximaal twee uit deze vaste lijst, niets anders: ${THEMA_LABELS.join(', ')}. Kies alleen thema's die daadwerkelijk prominent aan bod kwamen, niet oppervlakkig genoemd.
2. Excuustaal: schrijft de gebruiker een uitkomst herhaaldelijk toe aan iets buiten zichzelf (de markt, de concurrent, de conjunctuur, "domme" leads, prijs) in plaats van eigenaarschap te nemen over zijn eigen aandeel? Eén terloopse opmerking telt niet, een terugkerend patroon in dit gesprek wel.

Geef ALLEEN een JSON-object terug, geen andere tekst, geen uitleg: {"themas": ["CLOSING","MINDSET"], "excuustaal": true} of {"themas": [], "excuustaal": false}.`,
    messages: [{
      role: 'user',
      content: conversationText.slice(0, 8000)
    }]
  })
  const callUitdagingModel = () => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: `Extraheer de concrete actie of uitdaging die uit dit gesprek volgt voor de gebruiker. Één bondige zin van maximaal 20 woorden, beginnen met een werkwoord. Eén enkele actie, geen opsomming van meerdere stappen in dezelfde zin. Geen inleiding, geen "je moet". Direct de actie. Als er geen expliciete actie was, formuleer dan de logische volgende stap. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó). Schrijf de actie zonder tijdslimiet: geen "vandaag", "morgen", "deze week", "voor het weekend" of andere tijdsdruk. Gewoon de actie zelf.

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}

${RULE_NO_INVENTED_DETAILS}`,
    messages: [{
      role: 'user',
      content: `Wat is de concrete uitdaging of actie voor de gebruiker na dit gesprek?\n\n${conversationText}`
    }]
  })

  try {
    // Themas zijn een supplementair signaal (De Spiegel, punt 2A), geen kritiek pad zoals
    // summary/feiten/uitdaging: .catch(() => null) voorkomt dat een falende classificatie de
    // hele Promise.all laat rejecten en de rest van de sessie-opslag blokkeert.
    const themasPromise = callThemasModel().catch(() => null)
    const [summaryRes, feitenRes, uitdagingRes, themasRes] = await Promise.all([
      callSummaryModel(), callFeitenModel(), callUitdagingModel(), themasPromise,
    ])
    summary = getText(summaryRes.content)
    feiten = getText(feitenRes.content)
    uitdaging = (getText(uitdagingRes.content).trim()).replace(/\*\*/g, '')
    if (themasRes) {
      const classificatie = parseThemaClassificatie(getText(themasRes.content, '{}'))
      themas = classificatie.themas
      excuustaal = classificatie.excuustaal
    }

    if (!summary) {
      console.error(`[session-end] lege summary, retry (sessie ${sessionId})`)
      summary = getText(await callSummaryModel().then(r => r.content))
    }
    if (!feiten) {
      console.error(`[session-end] lege feiten, retry (sessie ${sessionId})`)
      feiten = getText(await callFeitenModel().then(r => r.content))
    }
    if (!uitdaging) {
      console.error(`[session-end] lege uitdaging, retry (sessie ${sessionId})`)
      uitdaging = (getText(await callUitdagingModel().then(r => r.content)).trim()).replace(/\*\*/g, '')
    }
    if (!summary) {
      console.error(`[session-end] summary nog steeds leeg na retry (sessie ${sessionId})`)
      summary = 'Er kon geen terugblik worden gegenereerd voor dit gesprek.'
    }
  } catch (e) {
    await notifyCronFailure(`session-end: synthese (sessie ${sessionId})`, e)
  }

  // Blog-suggesties: eerst inline geciteerde blogs uit de berichten halen
  type BlogSuggestion = { title: string; url: string }
  const blogSuggestions: BlogSuggestion[] = []

  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const seenUrls = new Set<string>()
  for (const msg of messages as { role: string; content: string }[]) {
    if (msg.role !== 'arno') continue
    let match
    const re = new RegExp(mdLinkRegex.source, 'g')
    while ((match = re.exec(msg.content)) !== null) {
      const [, text, url] = match
      if (url.includes('arno.blog') && !seenUrls.has(url)) {
        seenUrls.add(url)
        const title = text.length > 60 ? text.slice(0, 57) + '...' : text
        blogSuggestions.push({ title, url })
        if (blogSuggestions.length >= 3) break
      }
    }
    if (blogSuggestions.length >= 3) break
  }

  // Fallback: eerst op gebruikersvragen, dan op samenvatting
  if (blogSuggestions.length === 0) {
    try {
      const userQuestions = (messages as { role: string; content: string }[])
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join(' ')

      const queries = [userQuestions, summary].filter(Boolean)
      for (const query of queries) {
        if (blogSuggestions.length >= 2) break
        const chunks = await getRelevantChunks(query, 15)
        for (const c of chunks) {
          if (c.url && c.source && c.url.includes('arno.blog') && !seenUrls.has(c.url) && (c.relevance_score ?? 0) >= 0.6) {
            seenUrls.add(c.url)
            blogSuggestions.push({
              title: c.source.replace(/\s*\([^)]+\)\s*$/, ''),
              url: c.url,
            })
            if (blogSuggestions.length >= 2) break
          }
        }
      }
    } catch (e) {
      console.error('Blog suggestions error:', e)
    }
  }

  const { error: upsertError } = await supabase
    .from('arnobot_blog_sessions')
    .upsert({
      user_id: userId,
      session_id: sessionId,
      title,
      summary,
      feiten,
      uitdaging: uitdaging || null,
      message_count: messageCount,
      blog_suggestions: blogSuggestions,
      themas: themas.length ? themas : null,
      excuustaal,
    }, { onConflict: 'session_id' })

  if (upsertError) {
    await notifyCronFailure(`session-end: opslaan mislukt (sessie ${sessionId})`, upsertError.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  // Embedding genereren en opslaan (voor semantisch zoeken)
  try {
    const embedding = await embedSessionText(title, summary, feiten)
    await supabase.from('arnobot_blog_sessions').update({ embedding }).eq('session_id', sessionId)
  } catch (e) {
    console.error('[session-end] Embedding error:', e)
  }

  // Entiteiten extraheren voor het patroongeheugen (namen, bedrijven, terugkerende thema's)
  try {
    await extractAndStoreEntities(userId, sessionId, conversationText)
  } catch (e) {
    console.error('[session-end] Entiteiten-extractie error:', e)
  }

  return NextResponse.json({ ok: true, summary, blogs: blogSuggestions })
}

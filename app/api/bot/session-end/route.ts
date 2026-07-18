export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { getRelevantChunks, getVoyageEmbedding } from '@/lib/rag'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { sessionId, messages } = await req.json()
  if (!sessionId || !messages?.length) return NextResponse.json({ ok: true })

  // Auth via Clerk cookie, of fallback via bestaande log-rij (voor sendBeacon die geen cookies meestuurt)
  let userId: string | null = null
  try {
    const clerkAuth = await auth()
    userId = clerkAuth.userId
  } catch {}

  if (!userId) {
    const { data: logRow } = await supabase
      .from('arnobot_rds_logs')
      .select('user_id')
      .eq('session_id', sessionId)
      .not('user_id', 'is', null)
      .limit(1)
      .single()
    userId = logRow?.user_id ?? null
  }

  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

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

  const callSummaryModel = () => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: 'Je bent Arno Diepeveen. Oprichter Royal Dutch Sales. Direct, ongefilterd, geen bullshit. Geen corporate taal. Geen accenten op woorden voor nadruk. Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.',
    messages: [{
      role: 'user',
      content: `Schrijf een feitelijke terugblik op dit gesprek in 2 tot 3 volledige zinnen. Bij één centraal thema volstaan 2 zinnen. Elke zin moet een volledig afgeronde gedachte zijn. Nooit halverwege afbreken. Beschrijf alleen wat er besproken is: het onderwerp en de richting van het gesprek. Geen analyse, geen oordelen, geen "ik heb uitgewerkt" of "ik heb geconcludeerd". Alleen wat er aan de orde was. Spreek de gebruiker direct aan met "je" of "jij", nooit als "de gebruiker". Je schrijft als Arno, direct tegen de persoon met wie je gesproken hebt.\n\n${conversationText}`
    }]
  })
  const callFeitenModel = () => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: 'Extraheer alleen concrete, feitelijke informatie uit dit gesprek. Denk aan: producten, diensten, bedrijfsnaam, markt, specifieke situaties, namen, cijfers, uitdagingen, doelen. Geen interpretaties, geen advies. Alleen feiten die de gebruiker heeft gedeeld. Maximaal 8 korte bullets, elk op een nieuwe regel als losse zin.',
    messages: [{
      role: 'user',
      content: `Extraheer de feiten uit dit gesprek:\n\n${conversationText}`
    }]
  })
  const callUitdagingModel = () => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    system: 'Extraheer de concrete actie of uitdaging die uit dit gesprek volgt voor de gebruiker. Één bondige zin, beginnen met een werkwoord. Geen inleiding, geen "je moet". Direct de actie. Als er geen expliciete actie was, formuleer dan de logische volgende stap. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Gebruik geen accenten om woorden te benadrukken (geen écht, dát, zó). Schrijf de actie zonder tijdslimiet: geen "vandaag", "morgen", "deze week", "voor het weekend" of andere tijdsdruk. Gewoon de actie zelf.',
    messages: [{
      role: 'user',
      content: `Wat is de concrete uitdaging of actie voor de gebruiker na dit gesprek?\n\n${conversationText}`
    }]
  })

  try {
    const [summaryRes, feitenRes, uitdagingRes] = await Promise.all([
      callSummaryModel(), callFeitenModel(), callUitdagingModel(),
    ])
    summary = getText(summaryRes.content)
    feiten = getText(feitenRes.content)
    uitdaging = (getText(uitdagingRes.content).trim()).replace(/\*\*/g, '')

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
    }, { onConflict: 'session_id' })

  if (upsertError) {
    await notifyCronFailure(`session-end: opslaan mislukt (sessie ${sessionId})`, upsertError.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  // Embedding genereren en opslaan (voor semantisch zoeken)
  try {
    const embeddingText = [title, summary, feiten].filter(Boolean).join('\n\n')
    const embedding = await getVoyageEmbedding(embeddingText)
    await supabase.from('arnobot_blog_sessions').update({ embedding }).eq('session_id', sessionId)
  } catch (e) {
    console.error('[session-end] Embedding error:', e)
  }

  return NextResponse.json({ ok: true, summary, blogs: blogSuggestions })
}

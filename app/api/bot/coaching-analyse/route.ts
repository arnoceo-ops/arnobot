export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getText } from '@/lib/ai'
import { RULE_ENGLISH_TERMS, RULE_NO_CRUDE_LANGUAGE, RULE_NEVER_BREAK_CHARACTER, RULE_NO_INVENTED_DETAILS } from '@/lib/systemPrompt'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sessionIds: string[] | undefined = body.sessionIds

  const [planRes, todayRes] = await Promise.all([
    supabase.from('approved_users').select('plan').eq('user_id', userId).single(),
    supabase.from('arnobot_analyses').select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
  ])
  const plan = (planRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'basis'
  const todayCount = todayRes.count ?? 0

  if (plan === 'basis' && todayCount >= 1) {
    return NextResponse.json({ error: 'dagelijks_limiet', plan: 'basis' }, { status: 429 })
  }

  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('title, summary, message_count, created_at, session_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  let sessions = data ?? []

  if (sessionIds && sessionIds.length > 0) {
    sessions = sessions.filter(s => sessionIds.includes(s.session_id))
  }

  const { data: profielRow } = await supabase
    .from('arnobot_blog_profiles')
    .select('profiel')
    .eq('user_id', userId)
    .single()

  const profiel = profielRow?.profiel ?? null
  const profielText = profiel
    ? `\n\nGEBRUIKERSPROFIEL:\nRol: ${profiel.rol || 'onbekend'}\nMarkt: ${Array.isArray(profiel.markt) ? profiel.markt.join(', ') : profiel.markt || 'onbekend'}\nWat verkoop je: ${profiel.wat_verkoop_je || 'onbekend'}\nIdeale klant: ${profiel.ideale_klant || 'onbekend'}\nGrootste uitdaging: ${profiel.uitdaging || 'onbekend'}`
    : ''

  const minRequired = sessionIds ? 3 : 5
  if (sessions.length < minRequired) {
    return NextResponse.json({ error: 'te_weinig', count: sessions.length }, { status: 400 })
  }
  if (sessions.length > 20) {
    return NextResponse.json({ error: 'te_veel', max: 20 }, { status: 400 })
  }

  // Dedup: check exacte match of grote overlap (Jaccard >= 0.8)
  const newIds = new Set(sessions.map(s => s.session_id))
  const idsKey = [...newIds].sort().join(',')

  const { data: existingAnalyses } = await supabase
    .from('arnobot_analyses')
    .select('id, analyse_text, created_at, session_count, session_ids')
    .eq('user_id', userId)

  const exactDuplicate = existingAnalyses?.find(a => {
    if (!Array.isArray(a.session_ids)) return false
    return (a.session_ids as string[]).slice().sort().join(',') === idsKey
  })

  if (exactDuplicate) {
    return NextResponse.json({
      duplicate: true,
      analyse: exactDuplicate.analyse_text,
      id: exactDuplicate.id,
      created_at: exactDuplicate.created_at,
      count: exactDuplicate.session_count,
    })
  }

  // Jaccard-overlap: als >= 80% overlap → delta-analyse op alleen de nieuwe sessies
  const similarAnalyse = existingAnalyses
    ?.map(a => {
      if (!Array.isArray(a.session_ids) || a.session_ids.length === 0) return null
      const existingIds = new Set(a.session_ids as string[])
      const intersection = [...newIds].filter(id => existingIds.has(id)).length
      const union = new Set([...newIds, ...existingIds]).size
      return intersection / union >= 0.8 ? a : null
    })
    .find(Boolean) ?? null

  const newSessionIds = similarAnalyse
    ? sessions.filter(s => !(similarAnalyse.session_ids as string[]).includes(s.session_id))
    : sessions

  const isDelta = !!similarAnalyse && newSessionIds.length > 0

  // Exacte duplicate (geen nieuwe sessies): geef oude analyse terug
  if (similarAnalyse && newSessionIds.length === 0) {
    return NextResponse.json({
      duplicate: true,
      analyse: similarAnalyse.analyse_text,
      id: similarAnalyse.id,
      created_at: similarAnalyse.created_at,
      count: similarAnalyse.session_count,
    })
  }

  const sessiesText = (isDelta ? newSessionIds : sessions)
    .map((s, i) =>
      `Gesprek ${i + 1} (${new Date(s.created_at).toLocaleDateString('nl-NL')}): ${s.title}${s.summary ? `\nSamenvatting: ${s.summary}` : ''}`
    )
    .join('\n\n')

  const systemPrompt = `Je bent Arno Diepeveen. Salesstrateeg, direct, ongefilterd. Spreek de gebruiker direct aan met "je". Geen bullet points. Geen inleiding. Geen accenten op woorden voor nadruk. Gebruik het woord "moeten" niet; gebruik alternatieven als "kun je", "wil je", "loont het om". Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.

${RULE_ENGLISH_TERMS}

${RULE_NO_CRUDE_LANGUAGE}

${RULE_NEVER_BREAK_CHARACTER}

${RULE_NO_INVENTED_DETAILS}`

  const userContent = isDelta
    ? `Eerder zei je dit over deze persoon:\n"${similarAnalyse.analyse_text}"\n\nSindsdien zijn er ${newSessionIds.length} nieuwe gesprekken. Wat is er veranderd? Benoem concreet wat er nieuw is, wat er doorgebroken is, en wat de volgende stap is. Max 3 alinea's.${profielText}\n\nNIEUWE GESPREKKEN:\n${sessiesText}`
    : `Analyseer deze ${sessions.length} gesprekken en geef een patroonanalyse in Arno's stijl. Gewoon de patronen, wat ze zeggen, en één concrete uitdaging die de gebruiker zichzelf moet stellen. Max 3 alinea's.${profielText}\n\nGESPREKKEN:\n${sessiesText}`

  const callModel = () => anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }]
  })

  let analyse = getText(await callModel().then(r => r.content))
  if (!analyse) {
    analyse = getText(await callModel().then(r => r.content))
  }
  if (!analyse) {
    console.error('[bot/coaching-analyse] lege analyse na retry, userId:', userId)
    return NextResponse.json({ error: 'genereren_mislukt' }, { status: 500 })
  }

  const { data: saved } = await supabase
    .from('arnobot_analyses')
    .insert({
      user_id: userId,
      analyse_text: analyse,
      session_count: sessions.length,
      session_ids: sessions.map(s => s.session_id),
    })
    .select('id, created_at')
    .single()

  // Houd maximum 20 analyses — verwijder de oudste als er meer zijn
  const { data: allAnalyses } = await supabase
    .from('arnobot_analyses')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (allAnalyses && allAnalyses.length > 20) {
    const toDelete = allAnalyses.slice(20).map(a => a.id)
    await supabase.from('arnobot_analyses').delete().in('id', toDelete)
  }

  return NextResponse.json({ analyse, count: sessions.length, id: saved?.id, created_at: saved?.created_at, delta: isDelta })
}

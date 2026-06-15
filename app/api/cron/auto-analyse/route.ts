import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Alle gebruikers met sessies
  const { data: userRows } = await supabase
    .from('arnobot_blog_sessions')
    .select('user_id')

  const userIds = [...new Set((userRows ?? []).map((r: { user_id: string }) => r.user_id))]

  let analysed = 0

  for (const userId of userIds) {
    // Laatste analyse van deze gebruiker
    const { data: lastAnalyse } = await supabase
      .from('arnobot_analyses')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Sessies van na de laatste analyse (of alle sessies als er nog geen analyse is)
    const sessionsQuery = supabase
      .from('arnobot_blog_sessions')
      .select('session_id, title, summary, message_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (lastAnalyse?.created_at) {
      sessionsQuery.gt('created_at', lastAnalyse.created_at)
    }

    const { data: newSessions } = await sessionsQuery

    if (!newSessions || newSessions.length < 10) continue

    const batch = newSessions.slice(0, 20)

    const sessiesText = batch
      .map((s: { title: string; summary?: string; created_at: string }, i: number) =>
        `Gesprek ${i + 1} (${new Date(s.created_at).toLocaleDateString('nl-NL')}): ${s.title}${s.summary ? `\nSamenvatting: ${s.summary}` : ''}`
      )
      .join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `Je bent Arno Diepeveen. Salesstrateeg, direct, ongefilterd. Je analyseert de gesprekken van iemand die jouw bot gebruikt en geeft een patroonanalyse. Spreek de gebruiker direct aan met "je". Geen bullet points. Geen inleiding. Gewoon de patronen, wat ze zeggen, en één concrete uitdaging die de gebruiker zichzelf moet stellen. Max 3 alinea's. Geen accenten op woorden voor nadruk.`,
      messages: [{
        role: 'user',
        content: `Analyseer deze ${batch.length} gesprekken en geef een patroonanalyse:\n\nGESPREKKEN:\n${sessiesText}`
      }]
    })

    const analyse = response.content[0].type === 'text' ? response.content[0].text : ''

    await supabase.from('arnobot_analyses').insert({
      user_id: userId,
      analyse_text: analyse,
      session_count: batch.length,
      session_ids: batch.map((s: { session_id: string }) => s.session_id),
    })

    // Notificatiemail aan gebruiker
    const { data: userRow } = await supabase
      .from('approved_users')
      .select('email, voornaam')
      .eq('user_id', userId)
      .maybeSingle()

    if (userRow?.email) {
      const voornaam = userRow.voornaam || 'daar'
      resend.emails.send({
        from: 'ArnoBot <info@arno.bot>',
        to: userRow.email,
        subject: `Je BIEB is bijgewerkt, ${voornaam}.`,
        html: `
          <div style="font-family:'Courier New',monospace;background:#111827;color:#f1f5f9;padding:40px;max-width:560px;margin:0 auto;">
            <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:32px;">ARNOBOT</p>
            <h1 style="font-size:24px;font-weight:700;margin-bottom:20px;line-height:1.3;">Er staat een nieuwe analyse voor je klaar.</h1>
            <p style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:32px;">
              ArnoBot heeft je laatste ${batch.length} gesprekken geanalyseerd en ziet patronen die je eerder misschien niet zag.
            </p>
            <a href="https://arno.bot/bot/bieb"
               style="display:inline-block;background:#f59e0b;color:#111827;font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:3px;padding:16px 40px;text-decoration:none;border-radius:999px;">
              OPEN MIJN BIEB →
            </a>
            <p style="font-size:12px;color:#4b5563;margin-top:40px;line-height:1.7;">
              Je ontvangt deze mail zodra ArnoBot genoeg nieuwe gesprekken heeft om een patroonanalyse te maken.
            </p>
          </div>
        `,
      }).catch(() => {})
    }

    analysed++
  }

  return NextResponse.json({ ok: true, analysed, total: userIds.length })
}

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isValidEmail } from '@/lib/email-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const COACH_EMAIL = 'arnodiepeveen@gmail.com'

async function getUserData(userId: string) {
  const user = await currentUser()
  const naam = user?.fullName || user?.firstName || 'Onbekend'
  const email = user?.primaryEmailAddress?.emailAddress || ''

  const [sessionsRes, coachingRes, analysesRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('title, summary, message_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('arnobot_coaching')
      .select('coaching_data, updated_at, conversation_count')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('arnobot_analyses')
      .select('analyse_text, created_at, session_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2),
  ])

  const sessions = sessionsRes.data ?? []
  const totalQuestions = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0)

  return {
    naam,
    email,
    stats: { sessionCount: sessions.length, totalQuestions },
    coaching: coachingRes.data ?? null,
    recenteSessies: sessions.slice(0, 8),
    analyses: analysesRes.data ?? [],
  }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  const data = await getUserData(userId)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const coachEmail: string = isValidEmail(body.coachEmail) ? body.coachEmail : COACH_EMAIL

  const d = await getUserData(userId)
  const coaching = d.coaching?.coaching_data as Record<string, unknown> | null

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  const sessiesHtml = d.recenteSessies.map(s => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#374151;font-size:14px">${s.title}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #eee;color:#9ca3af;font-size:13px;white-space:nowrap">${s.message_count} vragen</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#aaa;font-size:12px;white-space:nowrap">${formatDate(s.created_at)}</td>
    </tr>
    ${s.summary ? `<tr><td colspan="3" style="padding:0 0 10px;color:#666;font-size:13px;line-height:1.6;border-bottom:1px solid #eee">${s.summary}</td></tr>` : ''}
  `).join('')

  const coachingHtml = coaching ? `
    <h2 style="font-family:sans-serif;font-size:18px;color:#f59e0b;margin:32px 0 16px;text-transform:uppercase;letter-spacing:2px">Coachingsdocument</h2>
    <p style="font-size:12px;color:#aaa;margin-bottom:24px">Gegenereerd op ${d.coaching?.updated_at ? formatDate(d.coaching.updated_at) : '—'} · ${d.coaching?.conversation_count ?? 0} gesprekken</p>

    <h3 style="font-size:13px;color:#f59e0b;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">Waar op gefocust</h3>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px">${coaching.focus ?? ''}</p>

    <h3 style="font-size:13px;color:#f59e0b;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">Blinde vlekken</h3>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px">${coaching.blinde_vlekken ?? ''}</p>

    <h3 style="font-size:13px;color:#f59e0b;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px">3 Ontwikkelpunten</h3>
    ${((coaching.ontwikkelpunten as string[]) ?? []).map((p, i) => `
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 10px"><strong style="color:#f59e0b">${i + 1}.</strong> ${p}</p>
    `).join('')}

    <h3 style="font-size:13px;color:#f59e0b;text-transform:uppercase;letter-spacing:2px;margin:24px 0 8px">Opdracht voor deze week</h3>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;padding:16px 20px;background:#fff8f0;border-left:3px solid #f59e0b">${coaching.opdracht ?? ''}</p>

    <h3 style="font-size:13px;color:#f59e0b;text-transform:uppercase;letter-spacing:2px;margin:24px 0 8px">Voortgang</h3>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px">${coaching.voortgang ?? ''}</p>
  ` : '<p style="font-size:14px;color:#aaa;font-style:italic">Nog geen coachingsdocument gegenereerd.</p>'

  const analyseHtml = d.analyses.length > 0 ? `
    <h2 style="font-family:sans-serif;font-size:18px;color:#f59e0b;margin:32px 0 16px;text-transform:uppercase;letter-spacing:2px">Laatste patroonanalyse</h2>
    <p style="font-size:14px;color:#374151;line-height:1.9;white-space:pre-wrap">${d.analyses[0].analyse_text}</p>
    <p style="font-size:12px;color:#aaa;margin-top:8px">${formatDate(d.analyses[0].created_at)} · ${d.analyses[0].session_count} gesprekken</p>
  ` : ''

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif">
      <div style="max-width:680px;margin:0 auto;background:#fff;padding:48px 40px">

        <div style="border-bottom:3px solid #f59e0b;padding-bottom:24px;margin-bottom:32px">
          <p style="font-family:'Arial Black',Arial,Impact,sans-serif;font-size:22px;letter-spacing:5px;margin:0 0 8px;line-height:1;"><span style="color:#1f2937;">ARNO</span><span style="color:#f59e0b;">BOT</span></p>
          <h1 style="margin:0;font-size:32px;color:#1f2937;letter-spacing:1px">Coachingsoverzicht</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#9ca3af">Aangevraagd door gebruiker op ${formatDate(new Date().toISOString())}</p>
        </div>

        <h2 style="font-size:13px;color:#f59e0b;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px">Gebruiker</h2>
        <p style="font-size:16px;color:#1f2937;margin:0 0 4px;font-weight:bold">${d.naam}</p>
        <p style="font-size:14px;color:#666;margin:0 0 8px">${d.email}</p>

        <div style="display:flex;gap:32px;margin:24px 0 32px;padding:20px 24px;background:#f9f9f9">
          <div>
            <div style="font-size:36px;font-weight:bold;color:#f59e0b;line-height:1">${d.stats.sessionCount}</div>
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-top:4px">Gesprekken</div>
          </div>
          <div>
            <div style="font-size:36px;font-weight:bold;color:#f59e0b;line-height:1">${d.stats.totalQuestions}</div>
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-top:4px">Vragen gesteld</div>
          </div>
        </div>

        ${coachingHtml}
        ${analyseHtml}

        <h2 style="font-family:sans-serif;font-size:18px;color:#f59e0b;margin:32px 0 16px;text-transform:uppercase;letter-spacing:2px">Recente gesprekken</h2>
        <table style="width:100%;border-collapse:collapse">
          ${sessiesHtml}
        </table>

        <div style="margin-top:40px;padding-top:24px;border-top:1px solid #eee;font-size:12px;color:#aaa;text-align:center">
          Verstuurd vanuit ArnoBot · arno.bot
        </div>
      </div>
    </body>
    </html>
  `

  const sendResult = await resend.emails.send({
    from: 'ArnoBot <info@arno.bot>',
    to: coachEmail,
    replyTo: d.email || undefined,
    subject: `[COACHING] ${d.naam} · ${d.stats.sessionCount} gesprekken`,
    html,
  })

  if (sendResult.error) {
    console.error('Resend error:', sendResult.error)
    return NextResponse.json({ error: 'Verzenden mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

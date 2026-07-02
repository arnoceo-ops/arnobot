import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { getEmailTemplate, getEmailTemplateList, type EmailType } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const TO = 'arno@arno.bot'

const ADMIN_ONLY_ITEMS: { type: string; label: string; description: string; category: 'admin'; cron: string }[] = [
  { type: 'daily_activity',   label: 'Dagelijkse activiteit', description: 'Elke dag 05:00:actieve gebruikers afgelopen 24u',          category: 'admin', cron: '/api/cron/daily-activity' },
  { type: 'weekly_top_users', label: 'Weekly top gebruikers', description: 'Elke zaterdag 06:05:top 10 actieve gebruikers',            category: 'admin', cron: '/api/cron/weekly-top-users' },
  { type: 'competitie',       label: 'Competitie',            description: 'Maandelijks (1e):competitierapport naar arno@arno.bot',    category: 'admin', cron: '/api/cron/competitie' },
  { type: 'model_check',      label: 'Model-check',           description: 'Maandelijks (1e):modelkwaliteitscheck naar model@arno.bot', category: 'admin', cron: '/api/cron/model-check' },
  { type: 'data_cleanup',     label: 'Data-cleanup',          description: 'Maandelijks (1e):gebruikers te verwerken naar hq@arno.bot', category: 'admin', cron: '/api/cron/data-cleanup' },
  { type: 'milestone_check',  label: 'Milestone-check',       description: 'Maandelijks (1e):alert bij 50 actieve gebruikers',         category: 'admin', cron: '/api/cron/milestone-check' },
]

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const templates = [...getEmailTemplateList(), ...ADMIN_ONLY_ITEMS]
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type } = await req.json()

  const adminItem = ADMIN_ONLY_ITEMS.find(i => i.type === type)
  if (adminItem) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://arno.bot'
    const res = await fetch(`${baseUrl}${adminItem.cron}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    if (!res.ok) return NextResponse.json({ error: 'Cron mislukt' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  let template: { subject: string; html: string }
  try {
    template = getEmailTemplate(type as EmailType, 'Arno', true, { userId: process.env.ARNOBOT_OWNER_USER_ID ?? 'test-user-id' })
  } catch {
    return NextResponse.json({ error: 'Onbekend type' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: 'ArnoBot <info@arno.bot>',
    to: TO,
    subject: template.subject,
    html: template.html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

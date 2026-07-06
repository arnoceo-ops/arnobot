import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getEmailTemplate, getEmailTemplateList, type EmailType } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const anthropic = new Anthropic()
const TO = 'arno@arno.bot'

const ADMIN_ONLY_ITEMS: { type: string; label: string; description: string; category: 'admin'; cron: string }[] = [
  { type: 'daily_activity',   label: 'Dagelijkse activiteit', description: 'Elke dag 05:00:actieve gebruikers afgelopen 24u',          category: 'admin', cron: '/api/cron/daily-activity' },
  { type: 'weekly_top_users', label: 'Weekly top gebruikers', description: 'Elke zaterdag 06:05:top 10 actieve gebruikers',            category: 'admin', cron: '/api/cron/weekly-top-users' },
  { type: 'competitie',       label: 'Competitie',            description: 'Maandelijks (1e):competitierapport naar arno@arno.bot',    category: 'admin', cron: '/api/cron/competitie' },
  { type: 'model_check',      label: 'Model-check',           description: 'Maandelijks (1e):modelkwaliteitscheck naar model@arno.bot', category: 'admin', cron: '/api/cron/model-check' },
  { type: 'data_cleanup',     label: 'Data-cleanup',          description: 'Maandelijks (1e):gebruikers te verwerken naar hq@arno.bot', category: 'admin', cron: '/api/cron/data-cleanup' },
  { type: 'milestone_check',  label: 'Milestone-check',       description: 'Maandelijks (1e):alert bij 50 actieve gebruikers',         category: 'admin', cron: '/api/cron/milestone-check' },
  { type: 'update_handover', label: 'Overdracht­docs update', description: 'Maandelijks (1e):bijwerkt TECHNICAL_ en BUSINESS_HANDOVER.md', category: 'admin', cron: '/api/cron/update-handover' },
  { type: 'meta_analyse',         label: 'Meta-analyse',           description: 'Maandelijks (1e):zelfbeoordeling + expertpanel naar arno@arno.bot',     category: 'admin', cron: '/api/cron/meta-analyse' },
  { type: 'meta_analyse_reminder', label: 'Meta-analyse reminder', description: 'Maandelijks (27e):herinnering om input in te vullen voor de analyse', category: 'admin', cron: '/api/cron/meta-analyse-reminder' },
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
    // Gebruik de host van het binnenkomende request om redirect-drops van de Authorization header te voorkomen
    const host = req.headers.get('host') ?? 'arno.bot'
    const proto = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${proto}://${host}`
    const res = await fetch(`${baseUrl}${adminItem.cron}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: body.error ?? `Cron mislukt (${res.status})` }, { status: 500 })
    return NextResponse.json({ ok: true, skipped: body.skipped === true })
  }

  let template: { subject: string; html: string }
  try {
    let nudgeQuestion: string | undefined
    if (type === 'weekly_nudge') {
      const ownerId = process.env.ARNOBOT_OWNER_USER_ID
      if (ownerId) {
        const { data: lastSession } = await supabase
          .from('arnobot_blog_sessions')
          .select('uitdaging')
          .eq('user_id', ownerId)
          .not('uitdaging', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (lastSession?.uitdaging?.trim()) {
          try {
            const msg = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 100,
              messages: [{ role: 'user', content: `De actie uit het laatste gesprek: "${lastSession.uitdaging}"\n\nSchrijf één toekomstgerichte vraag (max 1 zin) die vraagt hoe het daarmee staat. Toon: nieuwsgierig, direct, zonder oordeel. Geen begroeting, geen afsluiting. Alleen de vraag. Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.` }],
            })
            nudgeQuestion = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
          } catch { /* val terug op generieke template */ }
        }
      }
    }
    template = getEmailTemplate(type as EmailType, 'Arno', true, { userId: process.env.ARNOBOT_OWNER_USER_ID ?? 'test-user-id', nudgeQuestion })
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

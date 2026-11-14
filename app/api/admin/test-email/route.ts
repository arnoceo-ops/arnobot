import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getEmailTemplate, getEmailTemplateList, type EmailType } from '@/lib/email-templates'
import { adminKeyMatches } from '@/lib/adminAuth'
import { leesCrons } from '@/lib/cronOverzicht'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const anthropic = new Anthropic()
const TO = 'arno@arno.bot'

// Alleen deze crons hebben een STUUR TEST-knop. Label, planning en omschrijving komen uit
// lib/cronOverzicht.ts (planning rechtstreeks uit vercel.json), zodat ze niet meer uit de pas
// lopen. Het volledige overzicht van alle crons staat op /bot/admin/emails/overzicht.
// Let op: de knop draait de echte cron, met live data en de echte actie.
// `echteActie`: de cron doet meer dan een mail of Telegram-bericht (een volledige AI-run met een
// opgeslagen resultaat, of de documenten aanpassen). De knop vraagt dan eerst om bevestiging.
// Gekozen boven een droge-run-optie per cron: die zou per route gebouwd moeten worden, terwijl
// het risico een per ongeluk gedraaide echte run is, en dat vangt een tweede klik af.
const CRON_MET_TESTKNOP: { type: string; cron: string; echteActie?: boolean }[] = [
  { type: 'weekly_activity',       cron: '/api/cron/weekly-activity' },
  { type: 'weekly_top_users',      cron: '/api/cron/weekly-top-users' },
  { type: 'competitie',            cron: '/api/cron/competitie' },
  { type: 'model_check',           cron: '/api/cron/model-check', echteActie: true },
  { type: 'data_cleanup',          cron: '/api/cron/data-cleanup' },
  { type: 'update_handover',       cron: '/api/cron/update-handover', echteActie: true },
  { type: 'meta_analyse',          cron: '/api/cron/meta-analyse', echteActie: true },
  { type: 'meta_analyse_reminder', cron: '/api/cron/meta-analyse-reminder' },
]

const ADMIN_ONLY_ITEMS: { type: string; label: string; description: string; category: 'admin'; cron: string; echteActie: boolean }[] = CRON_MET_TESTKNOP.map(({ type, cron, echteActie }) => {
  const regel = leesCrons().find(c => c.pad === cron)
  return {
    type,
    label: regel?.naam ?? cron,
    description: (regel ? `${regel.schemaTekst}: ${regel.wat}` : cron) + (echteActie ? '. Draait de echte actie.' : ''),
    category: 'admin' as const,
    cron,
    echteActie: !!echteActie,
  }
})

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const templates = [...getEmailTemplateList(), ...ADMIN_ONLY_ITEMS]
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!adminKeyMatches(token)) {
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

  if (error) {
    console.error('[admin/test-email]', error.message)
    return NextResponse.json({ error: 'Versturen mislukt' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

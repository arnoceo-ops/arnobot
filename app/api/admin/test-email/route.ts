import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TO = 'arno@arno.bot'
const naam = 'Arno'

const CTA = `display:inline-block;background:#f59e0b;color:#111827;font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:3px;padding:16px 40px;text-decoration:none;border-radius:999px;`

function emailHtml(body: string, ctaText: string, ctaUrl: string) {
  return `
    <div style="font-family:'Courier New',monospace;background:#111827;color:#f1f5f9;padding:40px;max-width:560px;margin:0 auto;">
      <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:8px">ARNOBOT</p>
      <p style="color:#4b5563;font-size:11px;letter-spacing:2px;margin-bottom:32px">[TEST EMAIL]</p>
      <div style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:32px;">${body}</div>
      <a href="${ctaUrl}" style="${CTA}">${ctaText}</a>
      <p style="font-size:11px;color:#374151;margin-top:40px;">© ARNOBOT</p>
    </div>
  `
}

const templates: Record<string, { subject: string; html: string }> = {
  dag1: {
    subject: `[TEST] ${naam}, waar wil je mee beginnen?`,
    html: emailHtml(
      `ArnoBot staat voor je klaar. 24/7, zonder limiet. Maar waar begin je?<br /><br />Drie vragen die andere salesprofessionals als eerste stellen: "Hoe reageer ik op een prospect die zegt dat hij er nog over nadenkt?" of "Wat doe ik als mijn pipeline er goed uitziet maar de deals niet sluiten?" of "Hoe verhoog ik mijn gemiddelde dealgrootte?"<br /><br />Gewoon typen wat jou bezighoudt. Bedenk samen met ArnoBot hoe jij gaat winnen.`,
      'START EEN GESPREK →',
      'https://arno.bot/bot'
    ),
  },
  dag4: {
    subject: `[TEST] ${naam}, heb je al gespart?`,
    html: emailHtml(
      `Ingeschreven maar ArnoBot nog niet gebruikt? Geen probleem, maar je laat wel iets liggen.<br /><br />Eén goeie hint kan je de winst opleveren. Gewoon beginnen.`,
      'OPEN ARNOBOT →',
      'https://arno.bot/bot'
    ),
  },
  first_conversation: {
    subject: `[TEST] Goed begin, ${naam}.`,
    html: emailHtml(
      `Je eerste gesprek met ArnoBot zit erop. Wat nu?<br /><br />ArnoBot heeft het onthouden. Elk volgend gesprek bouwt voort op wat hij al weet. Hoe meer je gebruikt, hoe scherper het wordt.`,
      'VERDER SPARREN →',
      'https://arno.bot/bot'
    ),
  },
  dag14: {
    subject: `[TEST] ${naam}, je zit halverwege je trial.`,
    html: emailHtml(
      `Twee weken ArnoBot. Time flies maar nog ruim twee weken te gaan.<br /><br />ArnoBot wordt scherper en beter naarmate je meer gesprekken voert. Elke sessie voegt iets toe aan wat hij van jou weet. Gebruik de tweede helft om dieper te gaan.`,
      'OPEN ARNOBOT →',
      'https://arno.bot/bot'
    ),
  },
  first_coaching: {
    subject: `[TEST] ${naam}, je kunt nu een coachingsrapport aanvragen.`,
    html: emailHtml(
      `Je hebt inmiddels 5 gesprekken gevoerd met ArnoBot. Genoeg voor een eerste coachingsrapport.<br /><br />ArnoBot analyseert je gesprekken en geeft je een persoonlijk advies op basis van wat hij van jou weet. Niet generiek. Jouw patronen, jouw blinde vlekken, jouw volgende stap.`,
      'VRAAG COACHING AAN →',
      'https://arno.bot/bot/coaching'
    ),
  },
  dag25: {
    subject: `[TEST] ${naam}, je trial loopt over 5 dagen af.`,
    html: emailHtml(
      `Over vijf dagen stopt je gratis toegang automatisch, tenzij je aangeeft door te willen gaan.<br /><br />Klik hieronder om te bevestigen. Je ontvangt dan een factuur van Arno. Je toegang blijft actief totdat de factuur is voldaan.<br /><br />Wil je niet doorgaan? Dan hoef je niets te doen. Je data blijft na afloop nog 30 dagen bewaard.`,
      'JA, IK GA DOOR →',
      'https://arno.bot/bot/doorgaan'
    ),
  },
  betaalwaarschuwing: {
    subject: `[TEST] ${naam}, betaling nog niet ontvangen`,
    html: emailHtml(
      `Je hebt aangegeven door te willen gaan met ArnoBot, maar de betaling is nog niet ontvangen.<br /><br />Je toegang wordt over <strong>24 uur</strong> geblokkeerd totdat de betaling is verwerkt.<br /><br />Heb je al betaald? Dan hoef je niets te doen. Mail bij vragen naar <a href="mailto:arno@arno.bot" style="color:#f59e0b">arno@arno.bot</a>.`,
      'CONTACT ARNO →',
      'mailto:arno@arno.bot'
    ),
  },
  geblokkeerd: {
    subject: `[TEST] ${naam}, je toegang is geblokkeerd`,
    html: emailHtml(
      `Je betaling is niet ontvangen. Je toegang tot ArnoBot is tijdelijk geblokkeerd.<br /><br />Zodra de betaling is verwerkt, wordt je toegang direct hersteld. Vragen? Mail naar <a href="mailto:arno@arno.bot" style="color:#f59e0b">arno@arno.bot</a>.`,
      'CONTACT ARNO →',
      'mailto:arno@arno.bot'
    ),
  },
  trial_afgelopen: {
    subject: `[TEST] ${naam}, je trial is afgelopen`,
    html: emailHtml(
      `Je gratis proefperiode van 30 dagen is afgelopen. Je toegang tot ArnoBot is gestopt.<br /><br />Wil je toch doorgaan? Mail naar <a href="mailto:arno@arno.bot" style="color:#f59e0b">arno@arno.bot</a> en Arno regelt het verder.`,
      'CONTACT ARNO →',
      'mailto:arno@arno.bot'
    ),
  },
  opzegging_bevestiging: {
    subject: `[TEST] Opzegging ontvangen`,
    html: emailHtml(
      `Je opzegging is ontvangen. Je toegang blijft actief tot het einde van de lopende betaalperiode.<br /><br />Je data blijft daarna nog 30 dagen bewaard, zodat je deze kunt downloaden of verwijderen.<br /><br />Vragen? Mail naar <a href="mailto:arno@arno.bot" style="color:#f59e0b">arno@arno.bot</a>.`,
      'MIJN DATA DOWNLOADEN →',
      'https://arno.bot/bot/account'
    ),
  },
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type } = await req.json()
  const template = templates[type]
  if (!template) return NextResponse.json({ error: 'Onbekend type' }, { status: 400 })

  const { error } = await resend.emails.send({
    from: 'ArnoBot <info@arno.bot>',
    to: TO,
    subject: template.subject,
    html: template.html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

const templateMeta: Record<string, { label: string; description: string }> = {
  dag1:                  { label: 'Dag 1',                 description: 'Welkom, waar begin je?' },
  dag4:                  { label: 'Dag 4',                 description: 'Nog geen gesprek gevoerd' },
  first_conversation:    { label: 'Eerste gesprek',        description: 'Na het eerste gesprek' },
  dag14:                 { label: 'Dag 14',                description: 'Halverwege de trial' },
  first_coaching:        { label: 'Eerste coaching',       description: 'Na 5+ sessies, nog geen rapport' },
  dag25:                 { label: 'Dag 25',                description: 'Trial bijna afgelopen, opt-in CTA' },
  betaalwaarschuwing:    { label: 'Betaalwaarschuwing',    description: '7 dagen na opt-in, geen betaling' },
  geblokkeerd:           { label: 'Geblokkeerd',           description: '24u na waarschuwing, geen betaling' },
  trial_afgelopen:       { label: 'Trial afgelopen',       description: 'Dag 30, nooit opt-in gedaan' },
  opzegging_bevestiging: { label: 'Opzegging bevestiging', description: 'Na opzegging via account pagina' },
}

export async function GET() {
  const list = Object.keys(templates).map(type => ({
    type,
    label: templateMeta[type]?.label ?? type,
    description: templateMeta[type]?.description ?? '',
  }))
  return NextResponse.json({ templates: list })
}

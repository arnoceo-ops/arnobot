import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TO = ['arnodiepeveen@gmail.com', 'arno@arno.bot']
const NAAM = 'Arno'
const CTA = `display:inline-block;background:#f59e0b;color:#111827;font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:3px;padding:16px 40px;text-decoration:none;border-radius:999px;`

function wrap(label: string, body: string, ctaText: string, ctaUrl: string) {
  return `
    <div style="font-family:'Courier New',monospace;background:#111827;color:#f1f5f9;padding:40px;max-width:560px;margin:0 auto;">
      <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:8px;">ARNOBOT</p>
      <p style="color:#374151;font-size:11px;letter-spacing:2px;margin-bottom:32px;">TESTMAIL: ${label}</p>
      <div style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:32px;">${body}</div>
      <a href="${ctaUrl}" style="${CTA}">${ctaText}</a>
      <p style="font-size:11px;color:#374151;margin-top:40px;">© ARNOBOT</p>
    </div>
  `
}

const emails = [
  {
    subject: 'Je ArnoBot trial staat klaar',
    html: `
      <div style="font-family:'Courier New',monospace;background:#111827;color:#f1f5f9;padding:40px;max-width:560px;margin:0 auto;">
        <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:8px;">ARNOBOT</p>
        <p style="color:#374151;font-size:11px;letter-spacing:2px;margin-bottom:32px;">TESTMAIL: Welkomstmail</p>
        <h1 style="font-size:24px;font-weight:700;margin-bottom:20px;line-height:1.3;">Hey, ${NAAM}. Welkom!</h1>
        <p style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:32px;">
          Je account is aangemaakt via LinkedIn. Je hebt 30 dagen gratis toegang tot ArnoBot Unlimited. Geen creditcard, geen verplichtingen.
        </p>
        <a href="https://arno.bot/bot" style="${CTA}">OPEN ARNOBOT →</a>
        <p style="font-size:11px;color:#374151;margin-top:40px;">© ARNOBOT</p>
      </div>
    `,
  },
  {
    subject: `${NAAM}, waar wil je mee beginnen?`,
    html: wrap(
      'Dag 1',
      `ArnoBot staat voor je klaar. 24/7, zonder limiet. Maar waar begin je?<br /><br />Drie vragen die andere salesprofessionals als eerste stellen: "Hoe reageer ik op een prospect die zegt dat hij er nog over nadenkt?" of "Wat doe ik als mijn pipeline er goed uitziet maar de deals niet sluiten?" of "Hoe verhoog ik mijn gemiddelde dealgrootte?"<br /><br />Gewoon typen wat jou bezighoudt. Bedenk samen met ArnoBot hoe jij gaat winnen.`,
      'START EEN GESPREK →',
      'https://arno.bot/bot'
    ),
  },
  {
    subject: `Goed begin, ${NAAM}.`,
    html: wrap(
      'Trigger: eerste gesprek',
      `Je eerste gesprek met ArnoBot zit erop. Wat nu?<br /><br />ArnoBot heeft het onthouden. Elk volgend gesprek bouwt voort op wat hij al weet. Hoe meer je gebruikt, hoe scherper het wordt.`,
      'VERDER SPARREN →',
      'https://arno.bot/bot'
    ),
  },
  {
    subject: `${NAAM}, heb je al gespart?`,
    html: wrap(
      'Dag 4 (0 gesprekken)',
      `Ingeschreven maar ArnoBot nog niet gebruikt? Geen probleem, maar je laat wel iets liggen.<br /><br />Eén goeie hint kan je de winst opleveren. Gewoon beginnen.`,
      'OPEN ARNOBOT →',
      'https://arno.bot/bot'
    ),
  },
  {
    subject: `${NAAM}, je kunt nu een coachingsrapport aanvragen.`,
    html: wrap(
      'Trigger: eerste coaching (5+ gesprekken)',
      `Je hebt inmiddels 7 gesprekken gevoerd met ArnoBot. Genoeg voor een eerste coachingsrapport.<br /><br />ArnoBot analyseert je gesprekken en geeft je een persoonlijk advies op basis van wat hij van jou weet. Niet generiek. Jouw patronen, jouw blinde vlekken, jouw volgende stap.`,
      'VRAAG COACHING AAN →',
      'https://arno.bot/bot/coaching'
    ),
  },
  {
    subject: `${NAAM}, je zit halverwege je trial.`,
    html: wrap(
      'Dag 14',
      `Twee weken ArnoBot. Time flies maar nog ruim twee weken te gaan.<br /><br />ArnoBot wordt scherper en beter naarmate je meer gesprekken voert. Elke sessie voegt iets toe aan wat hij van jou weet. Gebruik de tweede helft om dieper te gaan.`,
      'OPEN ARNOBOT →',
      'https://arno.bot/bot'
    ),
  },
  {
    subject: `${NAAM}, je trial loopt over 5 dagen af.`,
    html: wrap(
      'Dag 25',
      `Over vijf dagen stopt je gratis toegang. Wat heeft het je opgeleverd?<br /><br />Als het antwoord is: niet genoeg, dan is dat precies de reden om door te gaan. ArnoBot wordt beter naarmate hij je langer kent.`,
      'DOORGAAN MET ARNOBOT →',
      'https://arno.bot/bot'
    ),
  },
  {
    subject: `${NAAM}, wat ga je deze week doen?`,
    html: wrap(
      'Weekly nudge',
      `Je hebt een week geen gebruik gemaakt van ArnoBot. Vakantie? Geen tijd? Even vergeten? Te confronterend? Wat dan ook, ArnoBot staat 24/7 voor je klaar. Gebruik 'm en wordt nog scherper dan je al bent. Het grootste risico is dat je meer gaat verkopen. Wie wil 't niet?`,
      'SPAR MET ARNO →',
      'https://arno.bot/bot'
    ),
  },
  {
    subject: `Je BIEB is bijgewerkt, ${NAAM}.`,
    html: wrap(
      'BIEB notificatie',
      `Morning, ${NAAM}. Er staat een nieuwe analyse voor je klaar. ArnoBot heeft je laatste 12 gesprekken geanalyseerd en ziet patronen die misschien nieuw voor je zijn. Kijk eens of je er iets mee kunt.`,
      'OPEN MIJN BIEB →',
      'https://arno.bot/bot/bieb'
    ),
  },
]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && querySecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { subject: string; ok: boolean }[] = []

  for (const email of emails) {
    try {
      await resend.emails.send({
        from: 'ArnoBot <info@arno.bot>',
        to: TO,
        subject: `[TEST] ${email.subject}`,
        html: email.html,
      })
      results.push({ subject: email.subject, ok: true })
    } catch (e) {
      results.push({ subject: email.subject, ok: false })
    }
  }

  return NextResponse.json({ ok: true, sent: results.filter(r => r.ok).length, results })
}

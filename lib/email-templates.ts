export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const CTA = `display:inline-block;background:#f59e0b;color:#111827;font-family:Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.5px;padding:12px 24px;text-decoration:none;border-radius:999px;`

export function emailHtml(body: string, ctaText: string, ctaUrl: string, isTest = false, footerNote?: string, greeting?: string) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#111827;">
<div style="max-width:560px;margin:0 auto;background:#111827;padding:48px 40px 40px 40px;">

  <p style="margin:0 0 ${isTest ? '6px' : '40px'} 0;padding:0;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:26px;letter-spacing:6px;line-height:1;">
    <span style="color:#f1f5f9;">ARNO</span><span style="color:#f59e0b;">BOT</span>
  </p>

  ${isTest ? `<p style="margin:0 0 40px 0;padding:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#6b7280;">[TEST EMAIL]</p>` : ''}

  ${greeting ? `<p style="margin:0 0 20px 0;padding:0;font-family:Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:700;color:#f1f5f9;">Hey, ${greeting}.</p>` : ''}

  <div style="font-family:Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#9ca3af;line-height:1.8;margin:0 0 36px 0;">${body}</div>

  <a href="${ctaUrl}" style="${CTA}">${ctaText}</a>

  ${footerNote ? `<p style="margin:48px 0 0 0;padding:0;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.6;">${footerNote}</p>` : ''}

  <p style="margin:${footerNote ? '8px' : '48px'} 0 0 0;padding:0;font-family:Arial,sans-serif;font-size:11px;color:#374151;">© ARNOBOT</p>

</div>
</body>
</html>`
}

export type EmailType =
  | 'dag1'
  | 'dag4'
  | 'first_conversation'
  | 'dag14'
  | 'first_coaching'
  | 'dag25'
  | 'betaalwaarschuwing'
  | 'geblokkeerd'
  | 'trial_afgelopen'
  | 'opzegging_bevestiging'
  | 'winback'
  | 'admin_derde_trial'
  | 'referral_aanmelding'
  | 'weekly_nudge'
  | 'geen_gesprek_nudge'

export const EMAIL_META: Record<EmailType, { label: string; description: string }> = {
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
  winback:               { label: 'Win-back',              description: '15 dagen na einde trial, 30-daagse tweede trial aanbieding' },
  admin_derde_trial:     { label: 'Admin: derde trial',    description: 'Notificatie naar pannekoek@arno.bot bij start derde trial' },
  referral_aanmelding:   { label: 'Referral aanmelding',   description: 'Naar referrer zodra iemand zich aanmeldt via zijn link' },
  weekly_nudge:          { label: 'Weekly nudge',          description: 'Dagelijks naar gebruikers met exact 7 dagen geen activiteit' },
  geen_gesprek_nudge:    { label: 'Geen gesprek nudge',    description: 'Naar gebruikers die zich aanmeldden maar nooit een gesprek startten' },
}

export function getEmailTemplate(
  type: EmailType,
  naam: string,
  isTest = false,
  options?: { sessionCount?: number; userId?: string }
): { subject: string; html: string } {
  const optOutUrl = options?.userId
    ? `https://arno.bot/optout/${options.userId}`
    : 'https://arno.bot/bot/account'
  const optOutNote = `Geen mail meer? <a href="${optOutUrl}" style="color:#9ca3af;text-decoration:underline;">Klik dan hier.</a>`
  const prefix = isTest ? '[TEST] ' : ''

  const mail = (body: string, ctaText: string, ctaUrl: string, footerNote?: string) =>
    emailHtml(body, ctaText, ctaUrl, isTest, footerNote, naam)

  switch (type) {
    case 'dag1':
      return {
        subject: `${prefix}${naam}, waar wil je mee beginnen?`,
        html: mail(
          `ArnoBot staat voor je klaar. 24/7, zonder limiet. Maar waar begin je?<br><br>Drie vragen die andere salesprofessionals als eerste stellen: "Hoe reageer ik op een prospect die zegt dat hij er nog over nadenkt?" of "Wat doe ik als mijn pipeline er goed uitziet maar de deals niet sluiten?" of "Hoe verhoog ik mijn gemiddelde dealgrootte?"<br><br>Gewoon typen wat jou bezighoudt. Bedenk samen met ArnoBot hoe jij gaat winnen.`,
          'START EEN GESPREK →', 'https://arno.bot/bot'
        ),
      }
    case 'dag4':
      return {
        subject: `${prefix}${naam}, heb je al gespart?`,
        html: mail(
          `Ingeschreven maar ArnoBot nog niet gebruikt? Geen probleem, maar je laat wel iets liggen.<br><br>Eén goeie hint kan je de winst opleveren. Gewoon beginnen.`,
          'OPEN ARNOBOT →', 'https://arno.bot/bot'
        ),
      }
    case 'first_conversation':
      return {
        subject: `${prefix}Goed begin, ${naam}.`,
        html: mail(
          `Je eerste gesprek met ArnoBot zit erop. Wat nu?<br><br>ArnoBot heeft het onthouden. Elk volgend gesprek bouwt voort op wat hij al weet. Hoe meer je gebruikt, hoe scherper het wordt.`,
          'VERDER SPARREN →', 'https://arno.bot/bot'
        ),
      }
    case 'dag14':
      return {
        subject: `${prefix}${naam}, je zit halverwege je trial.`,
        html: mail(
          `Twee weken ArnoBot. Time flies maar nog ruim twee weken te gaan.<br><br>ArnoBot wordt scherper en beter naarmate je meer gesprekken voert. Elke sessie voegt iets toe aan wat hij van jou weet. Gebruik de tweede helft om dieper te gaan.`,
          'OPEN ARNOBOT →', 'https://arno.bot/bot'
        ),
      }
    case 'first_coaching':
      return {
        subject: `${prefix}${naam}, je kunt nu een coachingsrapport aanvragen.`,
        html: mail(
          `Je hebt inmiddels ${options?.sessionCount ?? 5} gesprekken gevoerd met ArnoBot. Genoeg voor een eerste coachingsrapport.<br><br>ArnoBot analyseert je gesprekken en geeft je een persoonlijk advies op basis van wat hij van jou weet. Niet generiek. Jouw patronen, jouw blinde vlekken, jouw volgende stap.`,
          'VRAAG COACHING AAN →', 'https://arno.bot/bot/coaching'
        ),
      }
    case 'dag25':
      return {
        subject: `${prefix}${naam}, je trial loopt over 5 dagen af.`,
        html: mail(
          `Over vijf dagen stopt je gratis toegang automatisch, tenzij je aangeeft door te willen gaan.<br><br>Klik hieronder om te bevestigen. Je ontvangt dan een factuur van Arno. Je toegang blijft actief totdat de factuur is voldaan.<br><br>Wil je niet doorgaan? Dan hoef je niets te doen. Je data blijft na afloop nog 30 dagen bewaard.`,
          'JA, IK GA DOOR →', 'https://arno.bot/bot/doorgaan'
        ),
      }
    case 'betaalwaarschuwing':
      return {
        subject: `${prefix}${naam}, betaling nog niet ontvangen`,
        html: mail(
          `Je hebt aangegeven door te willen gaan met ArnoBot, maar de betaling is nog niet ontvangen.<br><br>Je toegang wordt over <strong style="color:#f1f5f9;">24 uur</strong> geblokkeerd totdat de betaling is verwerkt.<br><br>Heb je al betaald? Dan hoef je niets te doen. Mail bij vragen naar <a href="mailto:arno@arno.bot" style="color:#f59e0b;">arno@arno.bot</a>.`,
          'CONTACT ARNO →', 'mailto:arno@arno.bot'
        ),
      }
    case 'geblokkeerd':
      return {
        subject: `${prefix}${naam}, je toegang is geblokkeerd`,
        html: mail(
          `Je betaling is niet ontvangen. Je toegang tot ArnoBot is tijdelijk geblokkeerd.<br><br>Zodra de betaling is verwerkt, wordt je toegang direct hersteld. Vragen? Mail naar <a href="mailto:arno@arno.bot" style="color:#f59e0b;">arno@arno.bot</a>.`,
          'CONTACT ARNO →', 'mailto:arno@arno.bot'
        ),
      }
    case 'trial_afgelopen':
      return {
        subject: `${prefix}${naam}, je trial is afgelopen`,
        html: mail(
          `Je gratis proefperiode van 30 dagen is afgelopen. Je toegang tot ArnoBot is gestopt.<br><br>Wil je toch doorgaan? Mail naar <a href="mailto:arno@arno.bot" style="color:#f59e0b;">arno@arno.bot</a> en Arno regelt het verder.`,
          'CONTACT ARNO →', 'mailto:arno@arno.bot'
        ),
      }
    case 'winback':
      return {
        subject: `${prefix}${naam}, je krijgt nog een kans.`,
        html: mail(
          `Je trial is twee weken geleden afgelopen. Misschien was het timing. Misschien miste je iets.<br><br>We geven je de kans om het opnieuw te proberen. 30 dagen gratis, zonder verplichtingen.<br><br>Klik hieronder om je tweede trial te starten. Dit aanbod vervalt over 5 dagen.`,
          'START 30-DAAGSE TRIAL →', 'https://arno.bot/bot/herstart',
          `Geen e-mails meer ontvangen? <a href="mailto:arno@arno.bot" style="color:#9ca3af;text-decoration:underline;">Stuur een bericht naar arno@arno.bot.</a>`
        ),
      }
    case 'admin_derde_trial':
      return {
        subject: `${prefix}Derde trial: ${naam}`,
        html: emailHtml(
          `${naam} is vandaag begonnen aan een derde trial.<br><br>Tijd om ze persoonlijk te benaderen.`,
          'BEKIJK IN ADMIN →', 'https://arno.bot/bot/admin/gebruikers', isTest
        ),
      }
    case 'opzegging_bevestiging':
      return {
        subject: `${prefix}Opzegging ontvangen`,
        html: mail(
          `Je opzegging is ontvangen. Je toegang blijft actief tot het einde van de lopende betaalperiode.<br><br>Je data blijft daarna nog 30 dagen bewaard, zodat je deze kunt downloaden of verwijderen.<br><br>Vragen? Mail naar <a href="mailto:arno@arno.bot" style="color:#f59e0b;">arno@arno.bot</a>.`,
          'MIJN DATA DOWNLOADEN →', 'https://arno.bot/bot/account'
        ),
      }
    case 'referral_aanmelding':
      return {
        subject: `${prefix}Jan Jansen heeft zich aangemeld via jouw referral code`,
        html: mail(
          `<strong style="color:#f1f5f9;">Jan Jansen</strong> heeft zich zojuist aangemeld via jouw referral code.<br><br>Zodra Jan Jansen een betaald abonnement afsluit, ben je op weg. Bij een maandabonnement ontvang jij €97 tegoed nadat Jan Jansen drie betaalmaanden heeft voltooid. Bij een jaarabonnement direct na de eerste betaling.`,
          'MIJN REFERRALS →', 'https://arno.bot/bot/account'
        ),
      }
    case 'weekly_nudge':
      return {
        subject: `${prefix}${naam}, wat ga je deze week doen?`,
        html: mail(
          `Je hebt een week geen gebruik gemaakt van ArnoBot. Vakantie? Geen tijd? Even vergeten? Te confronterend? Wat dan ook, ArnoBot staat 24/7 voor je klaar. Gebruik 'm en wordt nog scherper dan je al bent. Het grootste risico is dat je meer gaat verkopen. Wie wil 't niet?`,
          'SPAR MET ARNO →', 'https://arno.bot/bot', optOutNote
        ),
      }
    case 'geen_gesprek_nudge':
      return {
        subject: `${prefix}${naam}, ArnoBot wacht op je.`,
        html: mail(
          `Je hebt je aangemeld voor ArnoBot. Maar het is stil aan de overkant. Er is namelijk nog geen gesprek gevoerd. Koudwatervrees? Druk, druk, druk met andere dingen? Oeps, vergeten? Hoe dan ook, ga eens in gesprek. Het grootste risico wat je loopt, is dat je meer gaat verkopen.`,
          'START EEN GESPREK →', 'https://arno.bot/bot', optOutNote
        ),
      }
  }
}

export function getEmailTemplateList() {
  return (Object.keys(EMAIL_META) as EmailType[]).map(type => ({
    type,
    ...EMAIL_META[type],
  }))
}

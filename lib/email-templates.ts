import { createHmac } from 'crypto'

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function optOutSig(userId: string): string {
  return createHmac('sha256', process.env.ARNOBOT_ADMIN_KEY ?? '')
    .update(userId)
    .digest('hex')
    .slice(0, 32)
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
  | 'geen_gesprek_nudge'
  | 'first_conversation'
  | 'dag14'
  | 'first_coaching'
  | 'dag25'
  | 'betaalwaarschuwing'
  | 'geblokkeerd'
  | 'trial_afgelopen'
  | 'opzegging_bevestiging'
  | 'winback'
  | 'weekly_nudge'
  | 'bieb_bijgewerkt'
  | 'kwartaal_doel'
  | 'referral_aanmelding'
  | 'admin_derde_trial'

export const EMAIL_META: Record<EmailType, { label: string; description: string; category: 'user' | 'admin' }> = {
  dag1:                  { label: 'Dag 1',                  description: 'Dag 1 — welkom, waar begin je?',                                       category: 'user' },
  dag4:                  { label: 'Dag 4',                  description: 'Dag 4 — nog geen gesprek gevoerd',                                     category: 'user' },
  geen_gesprek_nudge:    { label: 'Geen gesprek nudge',     description: 'Dag 7 — nooit een gesprek gestart',                                    category: 'user' },
  first_conversation:    { label: 'Eerste gesprek',         description: 'Dag 1-30 — na het allereerste gesprek',                                category: 'user' },
  dag14:                 { label: 'Dag 14',                 description: 'Dag 14 — halverwege de trial',                                         category: 'user' },
  first_coaching:        { label: 'Eerste coaching',        description: 'Dag 5-30 — na 5+ sessies, nog geen rapport aangevraagd',               category: 'user' },
  dag25:                 { label: 'Dag 25',                 description: 'Dag 25 — trial bijna afgelopen, opt-in CTA',                          category: 'user' },
  betaalwaarschuwing:    { label: 'Betaalwaarschuwing',     description: 'Dag 25+ — 7 dagen na opt-in zonder betaling',                         category: 'user' },
  geblokkeerd:           { label: 'Geblokkeerd',            description: 'Dag 26+ — 24u na waarschuwing, nog steeds geen betaling',             category: 'user' },
  trial_afgelopen:       { label: 'Trial afgelopen',        description: 'Dag 30 — trial afgelopen, nooit opt-in gedaan',                       category: 'user' },
  opzegging_bevestiging: { label: 'Opzegging bevestiging',  description: 'Op elk moment — na opzegging via account pagina',                     category: 'user' },
  winback:               { label: 'Win-back',               description: 'Dag 45 — 15 dagen na einde trial, tweede kans aanbieding',            category: 'user' },
  weekly_nudge:          { label: 'Inactivity nudge',       description: 'Recurring — 7 dagen geen activiteit',                                 category: 'user' },
  bieb_bijgewerkt:       { label: 'BIEB bijgewerkt',        description: 'Recurring — na 10+ nieuwe gesprekken, patroonanalyse klaar',          category: 'user' },
  kwartaal_doel:         { label: 'Kwartaaldoel check',     description: 'Recurring — bij kwartaalstart, check of jaardoel nog klopt',          category: 'user' },
  referral_aanmelding:   { label: 'Referral aanmelding',    description: 'Event — naar referrer zodra iemand zich aanmeldt via zijn link',      category: 'user' },
  admin_derde_trial:     { label: 'Derde trial',            description: 'Admin — notificatie bij start derde trial',                           category: 'admin' },
}

export function getEmailTemplate(
  type: EmailType,
  naam: string,
  isTest = false,
  options?: { sessionCount?: number; userId?: string; newUserName?: string; jaardoel?: string }
): { subject: string; html: string } {
  const optOutUrl = options?.userId
    ? `https://arno.bot/optout/${options.userId}?sig=${optOutSig(options.userId)}`
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
    case 'referral_aanmelding': {
      const newUser = options?.newUserName ?? 'Iemand'
      return {
        subject: `${prefix}${newUser} heeft zich aangemeld via jouw referral code`,
        html: mail(
          `<strong style="color:#f1f5f9;">${newUser}</strong> heeft zich zojuist aangemeld via jouw referral link.<br><br>Zodra ${newUser} een betaald abonnement afsluit, ontvang jij €97 tegoed. Bij een maandabonnement na drie voltooide betaalmaanden. Bij een jaarabonnement direct na de eerste betaling.`,
          'MIJN REFERRALS →', 'https://arno.bot/bot/account'
        ),
      }
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
    case 'bieb_bijgewerkt':
      return {
        subject: `${prefix}Je BIEB is bijgewerkt, ${naam}.`,
        html: mail(
          `Er staat een nieuwe analyse voor je klaar. ArnoBot heeft je laatste ${options?.sessionCount ?? 10} gesprekken geanalyseerd en ziet patronen die misschien nieuw voor je zijn. Kijk eens of je er iets mee kunt.`,
          'OPEN MIJN BIEB →', 'https://arno.bot/bot/bieb',
          'Je ontvangt deze mail zodra ArnoBot genoeg nieuwe gesprekken heeft om een patroonanalyse te maken.'
        ),
      }
    case 'kwartaal_doel': {
      const doel = options?.jaardoel ?? 'jouw doel voor dit jaar'
      return {
        subject: `${prefix}${naam}, klopt je doel voor dit jaar nog?`,
        html: mail(
          `Nieuw kwartaal, nieuw momentum.<br><br>Je hebt in je profiel dit als doel neergezet:<br><br><em style="color:#f1f5f9;">"${doel}"</em><br><br>Klopt dit nog? Of heeft het afgelopen kwartaal je perspectief verschoven? Pas je doel aan in je profiel als dat zo is. Of gebruik het als startpunt voor een gesprek vandaag.`,
          'OPEN ARNOBOT →', 'https://arno.bot/bot'
        ),
      }
    }
  }
}

export function getEmailTemplateList() {
  return (Object.keys(EMAIL_META) as EmailType[]).map(type => ({
    type,
    ...EMAIL_META[type],
  }))
}

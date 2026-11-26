import vercelConfig from '../vercel.json'

// Overzicht van alle geplande crons. De planning komt rechtstreeks uit vercel.json (dus nooit
// uit de pas), de beschrijving uit CRON_INFO hieronder. cronOverzicht.test.ts dwingt af dat elke
// cron in vercel.json hier beschreven staat, en omgekeerd, en dat elke cron-route een schema
// heeft. Een nieuwe cron zonder regel hier laat dus de test falen, in plaats van stil te ontbreken
// op het totaaloverzicht (/bot/admin/emails/overzicht, het menu-item MAILS).

export type CronSoort = 'gebruikers' | 'mij' | 'systeem'

export type CronInfo = {
  naam: string
  wat: string
  ontvanger: string
  soort: CronSoort
  /** Moment waarop de cron is ingepland (ISO). Verplicht voor elke nieuwe cron (cronOverzicht.test.ts): zo geldt hij niet als te laat voordat hij aan de beurt kon zijn. */
  ingepland?: string
}

export const CRON_INFO: Record<string, CronInfo> = {
  '/api/cron/blog': { naam: 'Blogpublicatie en blogmails', wat: 'Publiceert ingeplande posts, vult de mailwachtrij en verstuurt binnen het dagbudget', ontvanger: 'Blogabonnees', soort: 'gebruikers' },
  '/api/cron/billing': { naam: 'Abonnementsonderhoud', wat: 'Haalt gemiste Mollie-webhooks in, maakt ontbrekende abonnementen aan en stopt opgezegde abonnementen', ontvanger: 'Geen (systeem)', soort: 'systeem' },
  '/api/cron/team-facturatie': { naam: 'Team-facturatie', wat: 'Cyclusfactuur, tussenfactuur bij extra seats, herinnering 7 dagen na de vervaldatum, en het stoppen van opgezegde teams op hun einddatum', ontvanger: 'Teammanager', soort: 'gebruikers' },
  '/api/cron/trial-emails': { naam: 'Trial-mails', wat: 'Lifecycle-mails van dag 1 tot en met win-back, en het sluiten van verlopen trials', ontvanger: 'Gebruiker', soort: 'gebruikers' },
  '/api/cron/inactivity-nudge': { naam: 'Inactiviteitsmails', wat: 'Nudges bij geen gesprek, een rustige week en inactiviteit na 21, 45 en 60 dagen', ontvanger: 'Gebruiker', soort: 'gebruikers' },
  '/api/cron/referral-grootboek': { naam: 'Referralgrootboek', wat: 'Rekent per referral uit welk tegoed zou ontstaan of vervallen (meeloopstand, verandert niets aan geld of tegoed), meldt alleen iets nieuws', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/referral-uitvoeren': { naam: 'Referral uitvoeren', wat: 'Controleert na of betalingen onder referraltegoed zijn teruggedraaid en handelt terugstortingen af. Zolang REFERRAL_TERUGSTORTEN uit staat wordt er niets gereserveerd of verstuurd', ontvanger: 'Telegram', soort: 'mij', ingepland: '2026-11-26T12:40:14+01:00' },
  '/api/cron/weekly-activity':{ naam: 'Wekelijkse activiteit', wat: 'Actieve gebruikers van de afgelopen 7 dagen', ontvanger: 'Mail en Telegram', soort: 'mij' },
  '/api/cron/productvragen': { naam: 'Productvragen', wat: 'Vragen van de afgelopen 24 uur over het gebruik van ArnoBot zelf, alleen als er iets is', ontvanger: 'Mail en Telegram', soort: 'mij' },
  '/api/cron/feitencontrole': { naam: 'Feitencontrole', wat: 'Controleert de antwoorden van de afgelopen 24 uur op feiten van de gebruiker die verkeerd zijn teruggespeeld', ontvanger: 'Arno', soort: 'mij' },
  '/api/cron/waarheidscontrole': { naam: 'Waarheidscontrole', wat: 'Steekproef van beweringen die niet uit de bibliotheek komen, een week zonder antwoorden met bron is stil', ontvanger: 'Mail en Telegram', soort: 'mij' },
  '/api/cron/uitdaging-herinnering': { naam: 'Actieherinnering', wat: 'Herinnert aan de actie uit een gesprek op oplopende tussenpozen, alleen zonder terugkoppeling en bij afwezigheid', ontvanger: 'Gebruiker', soort: 'gebruikers' },
  '/api/cron/weekly-top-users': { naam: 'Weekly top gebruikers', wat: 'Top 10 actieve gebruikers', ontvanger: 'Mail en Telegram', soort: 'mij' },
  '/api/cron/auto-analyse': { naam: 'Analyses bijwerken', wat: 'Maakt een nieuwe analyse zodra er 10 of meer nieuwe gesprekken zijn en mailt de gebruiker', ontvanger: 'Gebruiker', soort: 'gebruikers' },
  '/api/bot/backfill-embeddings': { naam: 'Embeddings aanvullen', wat: 'Vult ontbrekende vectoren van gesprekssessies aan, 100 per run', ontvanger: 'Geen (systeem)', soort: 'systeem' },
  '/api/cron/refresh-openers': { naam: 'Gespreksopeners verversen', wat: 'Bouwt de openers opnieuw uit recente sessies en analyses, overschrijft de vorige rij', ontvanger: 'Geen (systeem)', soort: 'systeem' },
  '/api/cron/model-check': { naam: 'Model-check', wat: 'Modelkwaliteitscheck met live webzoekopdrachten', ontvanger: 'model@arno.bot', soort: 'mij' },
  '/api/cron/competitie': { naam: 'Competitie', wat: 'Competitierapport', ontvanger: 'arno@arno.bot', soort: 'mij' },
  '/api/cron/data-cleanup': { naam: 'Data-cleanup', wat: 'Accounts die 30 of meer dagen geleden zijn beëindigd en waarvan nog data aanwezig is', ontvanger: 'hq@arno.bot', soort: 'mij' },
  '/api/cron/database-wacht': { naam: 'Database-wacht', wat: 'Meet geheugen en verbindingen van de databaseserver, meldt alleen bij 70% of 90%', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/capaciteitswacht': { naam: 'Capaciteitswacht', wat: 'Vergelijkt verbruik met de planlimieten en gebruikersmijlpalen, meldt alleen bij 70% of 90%', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/stip-wacht': { naam: 'Stip-wacht', wat: 'Stuurt een pushmelding naar de admin-app als een stip daar oranje of rood wordt of weer groen is, Telegram alleen als de push niet lukt', ontvanger: 'Admin-app', soort: 'mij' },
  '/api/cron/cron-wacht': { naam: 'Cron-wacht', wat: 'Meldt een geplande cron die te laat is of is afgebroken, een mislukte run meldt zichzelf al, anders stil', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/storing-wacht': { naam: 'Storing-wacht', wat: 'Meldt arno.bot niet bereikbaar of te traag (responstijd van het laatste uur) en een grote storing bij Anthropic, Vercel, Supabase, Clerk of Resend, anders stil', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/team-proef': { naam: 'Teamproef', wat: 'Beëindigt de gratis proef van 30 dagen van een manager via een agent-link (team geblokkeerd) en waarschuwt 5 dagen van tevoren, verlengen kan handmatig', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/update-handover': { naam: 'Overdrachtdocs bijwerken', wat: 'Werkt de AI-modelinventaris en de package-versies in TECHNICAL_HANDOVER.md en BUSINESS_HANDOVER.md bij', ontvanger: 'Geen (systeem)', soort: 'systeem' },
  '/api/cron/meta-analyse': { naam: 'Meta-analyse', wat: 'Zelfbeoordeling en expertpanel over de afgelopen 30 dagen', ontvanger: 'arno@arno.bot', soort: 'mij' },
  '/api/cron/meta-analyse-reminder': { naam: 'Meta-analyse reminder', wat: 'Herinnering om je eigen input in te vullen voor de meta-analyse', ontvanger: 'Arno', soort: 'mij' },
  '/api/cron/patroon-samenvatting': { naam: 'Patroonmail', wat: 'Een thema dat in 8 weken in minstens 3 gesprekken terugkwam, met een knop naar Sparren, geen patroon geen mail', ontvanger: 'Gebruiker', soort: 'gebruikers' },
  '/api/cron/rss-ingest': { naam: 'RSS-inname', wat: 'Leest de RSS-bronnen in de kennisbank in', ontvanger: 'Geen (systeem)', soort: 'systeem' },
  '/api/cron/team-1on1-ritme': { naam: 'Team 1:1-ritme', wat: 'Belletje en daarna twee mails als een teamlid langer dan 2 weken geen 1:1 heeft gehad', ontvanger: 'Teammanager', soort: 'gebruikers' },
  '/api/cron/comp-reminder-nov': { naam: 'Comp reminder november', wat: 'Eenmalig: reminder om een abonnement te kiezen, alleen als Mollie live staat', ontvanger: 'Gebruiker met comp-toegang', soort: 'gebruikers' },
  '/api/cron/sessies-afsluiten': { naam: 'Sessies afsluiten', wat: 'Rondt gesprekken af die de gebruiker nooit heeft gesloten, zodat ze een samenvatting krijgen', ontvanger: 'Geen (systeem)', soort: 'systeem' },
  '/api/cron/tabelgebruik-meting-nov': { naam: 'Eenmalige meting tabelgebruik', wat: 'Eenmalig op 27 november 2026: hoe vaak de tabeltool wordt gebruikt en welke kolommen worden gevraagd, plus een automatische steekproef op de tabelgesprekken (werkruis, onjuiste superlatieven). Daarna verwijderen', ontvanger: 'Mail en Telegram', soort: 'mij' },
  '/api/cron/kennisbank-controle': { naam: 'Kennisbank-controle', wat: 'Kernvragen leveren genoeg kandidaten, geen fragmenten zonder vector, niets gewist, meldt alleen bij een probleem', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/documenten-opruimen': { naam: 'Documenten opruimen', wat: 'Ruimt tijdelijke documenten op 48 uur na het laatste bericht op, wist oude sporen na 30 dagen en haalt achtergebleven uploads weg, meldt alleen bij een fout', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/documenten-samenvatten': { naam: 'Documenten samenvatten', wat: 'Maakt van bewaarde documenten een samenvatting met zoekcode, zodat ArnoBot ze in andere gesprekken kan meenemen, meldt alleen bij een mislukte poging', ontvanger: 'Telegram', soort: 'mij' },
  '/api/cron/bron-context-opruimen': { naam: 'Logcontext opruimen', wat: 'Maakt de volledige bronnentekst van antwoorden (bron_context) na 30 dagen leeg, de antwoorden zelf blijven staan', ontvanger: 'Geen (systeem)', soort: 'systeem' },
  '/api/cron/leveranciers-wijzigingen': { naam: 'Leveranciers-wijzigingen', wat: 'Controleert DPA- en deprecation-pagina\'s van leveranciers, meldt bij een inhoudelijke wijziging', ontvanger: 'Telegram', soort: 'mij' },
}

export type CronRegel = CronInfo & { pad: string; schema: string; schemaTekst: string }

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MAANDEN = ['', 'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

/**
 * vercel.json plant in UTC, wij tonen Nederlandse tijd. Het verschil (1 of 2 uur) hangt van de datum
 * af: vandaag, of bij een schema met een vaste maand die maand. Zou de omrekening over middernacht
 * gaan, dan klopt de dag in de tekst niet meer en blijft de tijd in UTC staan, met die vermelding.
 */
function tijd(uur: string, minuut: string, maand: string, dag: string, nu: Date): string {
  const peil = /^\d+$/.test(maand)
    ? Date.UTC(nu.getUTCFullYear(), Number(maand) - 1, parseInt(dag, 10), Number(uur), Number(minuut))
    : Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate(), Number(uur), Number(minuut))
  const nl = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(peil))
  if (Number(nl.slice(0, 2)) < Number(uur)) return `${uur.padStart(2, '0')}:${minuut.padStart(2, '0')} UTC`
  return nl
}

/** Leesbare tekst bij een vijfdelig cron-schema. Onbekende vormen komen ongewijzigd terug, de test faalt daarop. */
export function schemaTekst(schema: string, nu: Date = new Date()): string {
  const d = schema.trim().split(/\s+/)
  if (d.length !== 5) return schema
  const [min, uur, dag, maand, weekdag] = d
  const getal = /^\d+$/

  if (min.startsWith('*/') && uur === '*' && dag === '*' && maand === '*' && weekdag === '*') {
    const n = Number(min.slice(2))
    return n === 15 ? 'elk kwartier' : `elke ${n} minuten`
  }
  if (getal.test(min) && uur === '*' && dag === '*' && maand === '*' && weekdag === '*') {
    return `elk uur, op :${min.padStart(2, '0')}`
  }
  if (getal.test(min) && getal.test(uur)) {
    if (dag === '*' && maand === '*' && weekdag === '*') return `dagelijks ${tijd(uur, min, maand, dag, nu)}`
    if (dag === '*' && maand === '*' && getal.test(weekdag)) return `${DAGEN[Number(weekdag) % 7]} ${tijd(uur, min, maand, dag, nu)}`
    if (getal.test(dag) && maand === '*' && weekdag === '*') return `maandelijks op de ${dag}e, ${tijd(uur, min, maand, dag, nu)}`
    if (getal.test(dag) && getal.test(maand) && weekdag === '*') return `${dag} ${MAANDEN[Number(maand)]}, ${tijd(uur, min, maand, dag, nu)}`
    if (/^\d+-\d+$/.test(dag) && getal.test(maand) && weekdag === '*') {
      const [van, tot] = dag.split('-')
      return `${van} t/m ${tot} ${MAANDEN[Number(maand)]}, ${tijd(uur, min, maand, dag, nu)}`
    }
  }
  return schema
}

/** Alle crons uit vercel.json met hun beschrijving. Een cron zonder beschrijving krijgt een zichtbare plaatsvervanger. */
export function leesCrons(): CronRegel[] {
  return (vercelConfig.crons ?? []).map(c => {
    const info = CRON_INFO[c.path] ?? { naam: c.path, wat: 'Niet beschreven in lib/cronOverzicht.ts', ontvanger: '?', soort: 'systeem' as CronSoort }
    return { ...info, pad: c.path, schema: c.schedule, schemaTekst: schemaTekst(c.schedule) }
  })
}

/** Tekst voor een cron op pad, bijvoorbeeld voor "Trigger: Cron:trial-emails (dagelijks 05:05)". */
export function cronTrigger(slug: string): string {
  const regel = leesCrons().find(c => c.pad === `/api/cron/${slug}`)
  return `Cron:${slug} (${regel ? regel.schemaTekst : 'niet in vercel.json'})`
}

/**
 * Hoe oud het laatste succes van een cron hooguit mag zijn voordat hij als "te laat" geldt, uit
 * het schema: ruim twee tot drie keer het interval, zodat één gemiste of trage run nog niet alarmeert.
 * null bij een schema dat niet periodiek is (een eenmalige datum in het jaar).
 */
export function maxLeeftijdMs(schema: string): number | null {
  const d = schema.trim().split(/\s+/)
  if (d.length !== 5) return null
  const [min, uur, dag, maand, weekdag] = d
  const getal = /^\d+$/
  const MIN = 60_000
  const UUR = 60 * MIN
  const DAG = 24 * UUR

  if (min.startsWith('*/') && uur === '*' && dag === '*' && maand === '*' && weekdag === '*') return Number(min.slice(2)) * 3 * MIN
  if (maand !== '*') return null
  if (getal.test(min) && uur === '*' && dag === '*' && weekdag === '*') return 3 * UUR
  if (getal.test(min) && getal.test(uur) && dag === '*' && weekdag === '*') return 36 * UUR
  if (getal.test(min) && getal.test(uur) && dag === '*' && getal.test(weekdag)) return 8 * DAG
  if (getal.test(min) && getal.test(uur) && getal.test(dag) && weekdag === '*') return 35 * DAG
  return null
}

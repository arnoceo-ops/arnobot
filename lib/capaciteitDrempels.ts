// Beoordeling voor de capaciteitswacht (cron/capaciteitswacht): puur, geen netwerk en geen klok,
// zodat de drempels met unit tests vastliggen. De wacht meet het echte verbruik tegenover de
// limiet van het plan waar we op zitten en meldt pas bij 70% (waarschuwing) en 90% (kritiek).

export type ResendPlan = 'gratis' | 'pro'

export type Meting = {
  resendPlan: ResendPlan
  mailDag: number
  mailMaand: number
  /** Grootte van de database in bytes, null als de SQL-functie nog niet bestaat. */
  dbBytes: number | null
  /** Aantal Anthropic-limietfouten (429) in de afgelopen dag. */
  anthropic429Dag: number
  actieveGebruikers: number
}

export type Melding = {
  /** Stabiele sleutel voor de dubbele-meldingsbeveiliging. */
  sleutel: string
  niveau: 'waarschuwing' | 'kritiek' | 'mijlpaal'
  tekst: string
}

// Resend gratis: 100 per dag en 3.000 per maand (Settings, Usage, 2026-11-04). Pro: 50.000 per maand,
// geen daglimiet (resend.com/pricing, bij de kwartaalcheck controleren).
export const RESEND_LIMIETEN: Record<ResendPlan, { dag: number | null; maand: number }> = {
  gratis: { dag: 100, maand: 3000 },
  pro: { dag: null, maand: 50000 },
}

// Supabase Pro: 8 GB database (CLAUDE.md, sectie Supabase).
export const DB_LIMIET_BYTES = 8 * 1024 ** 3

export const WAARSCHUWING = 0.7
export const KRITIEK = 0.9

// Gebruikersmijlpalen uit CLAUDE.md ("Milestone: Pro-upgrades"). De Vercel Firewall en Resend Pro
// zijn al geregeld, dus staan hier niet meer.
export const MIJLPALEN: { aantal: number; tekst: string }[] = [
  {
    aantal: 50,
    tekst: 'Mijlpaal van 50 actieve gebruikers. Nu doen: Clerk inactivity timeout aanzetten (Clerk Pro), en het WhatsApp-supportnummer overzetten naar het WhatsApp Business Platform met een helpdesktool en een echte DPA met Meta.',
  },
  {
    aantal: 150,
    tekst: 'Mijlpaal van 150 actieve gebruikers. Nu doen: Supabase PITR aanzetten ($100 per maand) en direct een restore-test uitvoeren (backup terugzetten in een tijdelijk project, tabellen en encoding controleren, project verwijderen).',
  },
]

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1).replace('.', ',')
}

function niveauVan(gebruikt: number, limiet: number): 'waarschuwing' | 'kritiek' | null {
  if (limiet <= 0) return null
  const aandeel = gebruikt / limiet
  if (aandeel >= KRITIEK) return 'kritiek'
  if (aandeel >= WAARSCHUWING) return 'waarschuwing'
  return null
}

export function beoordeelCapaciteit(m: Meting): Melding[] {
  const meldingen: Melding[] = []
  const lim = RESEND_LIMIETEN[m.resendPlan]

  if (lim.dag !== null) {
    const n = niveauVan(m.mailDag, lim.dag)
    if (n) {
      meldingen.push({
        sleutel: `resend-dag:${n}`,
        niveau: n,
        tekst: `Resend: ${m.mailDag} van ${lim.dag} mails vandaag (${Math.round((m.mailDag / lim.dag) * 100)}%). Boven de limiet worden betaal-, welkomst- en trialmails geweigerd. Upgrade naar Pro (Resend, Settings, Billing) en zet daarna RESEND_PLAN=pro in Vercel.`,
      })
    }
  }
  const nMaand = niveauVan(m.mailMaand, lim.maand)
  if (nMaand) {
    meldingen.push({
      sleutel: `resend-maand:${nMaand}`,
      niveau: nMaand,
      tekst: `Resend: ${m.mailMaand} van ${lim.maand.toLocaleString('nl-NL')} mails deze maand (${Math.round((m.mailMaand / lim.maand) * 100)}%).${m.resendPlan === 'gratis' ? ' Upgrade naar Pro (Resend, Settings, Billing) en zet daarna RESEND_PLAN=pro in Vercel.' : ' Pro rekent daarboven $0,90 per 1.000 mails, controleer het plan.'}`,
    })
  }

  if (m.dbBytes !== null) {
    const n = niveauVan(m.dbBytes, DB_LIMIET_BYTES)
    if (n) {
      meldingen.push({
        sleutel: `database:${n}`,
        niveau: n,
        tekst: `Supabase: database ${gb(m.dbBytes)} van ${gb(DB_LIMIET_BYTES)} GB (${Math.round((m.dbBytes / DB_LIMIET_BYTES) * 100)}%). Boven de limiet wordt Pro-opslag bijbetaald of de database beperkt: opruimen of de opslag verhogen (Supabase, Settings, Billing).`,
      })
    }
  }

  if (m.anthropic429Dag >= 1) {
    meldingen.push({
      sleutel: 'anthropic-limiet:kritiek',
      niveau: 'kritiek',
      tekst: `Anthropic: ${m.anthropic429Dag} keer een limietfout (429) in de afgelopen dag. Gebruikers kregen toen mogelijk geen antwoord. Vraag een hogere tier aan (Anthropic Console, Settings, Limits).`,
    })
  }

  for (const mijlpaal of MIJLPALEN) {
    if (m.actieveGebruikers >= mijlpaal.aantal) {
      meldingen.push({ sleutel: `mijlpaal:${mijlpaal.aantal}`, niveau: 'mijlpaal', tekst: mijlpaal.tekst })
    }
  }

  return meldingen
}

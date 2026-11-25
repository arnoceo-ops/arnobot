// Beslisregels voor de pushmeldingen van de admin-app (/api/cron/stip-wacht): wanneer verdient een
// kleurverandering van een stip een melding. Puur en getest: geen netwerk, geen klok, geen opslag.
import type { Niveau } from '@/lib/adminMobielLogica'

export type Stip = {
  /** Stabiele sleutel, ook de 'tag' van de melding: een nieuwe melding over dezelfde stip vervangt de oude. */
  sleutel: string
  naam: string
  niveau: Niveau
  /** Wat er in de melding staat. Nooit namen van gebruikers of teams: de tekst staat op het vergrendelscherm. */
  tekst: string
  /** Bij false meldt oranje niet (een externe storing die niets raakt dat arno.bot gebruikt). Rood meldt altijd. */
  meldBijOranje?: boolean
}

export type StipStand = { niveau: 'let-op' | 'fout'; gemeld: boolean; schoneRuns: number }
export type StipStaat = Record<string, StipStand>
export type StipMelding = { sleutel: string; titel: string; tekst: string }

/** Twee schone runs van een kwartier: pas dan is een stip echt weer groen (zoals de storing-wacht). */
export const GROEN_NA_SCHONE_RUNS = 2

/**
 * Vergelijkt de stippen van nu met de vorige run.
 *  - nieuw oranje of rood: melding (oranje alleen als de stip dat wil)
 *  - van oranje naar rood: opnieuw een melding. Terug van rood naar oranje: stil, en de zwaarste stand
 *    blijft onthouden, zodat heen en weer springen niet elke keer meldt
 *  - twee runs achter elkaar groen na een gemelde stip: herstelmelding
 *  - 'onbekend' (meting mislukt) verandert niets
 * Geeft per melding ook de stand terug die pas geldt als de melding is afgeleverd.
 */
export function werkStippenBij(vorige: StipStaat, stippen: Stip[]): { staat: StipStaat; meldingen: StipMelding[] } {
  const staat: StipStaat = { ...vorige }
  const meldingen: StipMelding[] = []

  for (const s of stippen) {
    const eerder = vorige[s.sleutel]
    if (s.niveau === 'onbekend') continue

    if (s.niveau === 'ok') {
      if (!eerder) continue
      const schoneRuns = eerder.schoneRuns + 1
      if (schoneRuns < GROEN_NA_SCHONE_RUNS) {
        staat[s.sleutel] = { ...eerder, schoneRuns }
        continue
      }
      delete staat[s.sleutel]
      if (eerder.gemeld) meldingen.push({ sleutel: s.sleutel, titel: `Weer groen: ${s.naam}`, tekst: s.tekst })
      continue
    }

    const meldbaar = s.niveau === 'fout' || s.meldBijOranje !== false
    const wordtRood = eerder?.niveau === 'let-op' && s.niveau === 'fout'
    const moetMelden = meldbaar && (!eerder || !eerder.gemeld || wordtRood)
    staat[s.sleutel] = {
      niveau: eerder?.niveau === 'fout' ? 'fout' : s.niveau,
      gemeld: (eerder?.gemeld ?? false) || moetMelden,
      schoneRuns: 0,
    }
    if (moetMelden) {
      meldingen.push({ sleutel: s.sleutel, titel: `${s.niveau === 'fout' ? 'Rood' : 'Oranje'}: ${s.naam}`, tekst: s.tekst })
    }
  }

  return { staat, meldingen }
}

// Onderdelen van een externe dienst waar arno.bot van afhangt, met de namen uit de statusfeed
// (opgehaald 2026-11-25). De functies draaien in iad1, het verkeer uit Nederland komt via fra1.
// Supabase staat er bewust niet in: die feed noemt alleen 'Auth', daarop is niet te filteren.
export const RELEVANTE_ONDERDELEN: Record<string, readonly string[]> = {
  Anthropic: ['Claude API (api.anthropic.com)'],
  Vercel: ['Functions', 'Routing Middleware', 'Cron Jobs', 'DNS', 'TLS Certificates', 'IAD1 - Washington DC, USA', 'FRA1 - Frankfurt, Germany, Europe'],
  Clerk: ['Authentication & User', 'Session management'],
  Resend: ['Single Email', 'Batch Emails', 'General API'],
}

export type StatusFeed = {
  components?: { name: string; status: string; group?: boolean }[]
  incidents?: { components?: { name: string }[] }[]
}

/**
 * Raakt een oranje externe dienst iets dat arno.bot gebruikt? Kijkt naar de onderdelen die niet
 * operationeel zijn en de onderdelen van open incidenten. Noemt de feed geen enkel onderdeel, of
 * kennen we voor de dienst geen lijst, dan weten we het niet en melden we wel.
 */
export function dienstRaaktOns(dienst: string, feed: StatusFeed): boolean {
  const relevant = RELEVANTE_ONDERDELEN[dienst]
  if (!relevant) return true
  const geraakt = [
    ...(feed.components ?? []).filter(c => !c.group && c.status !== 'operational').map(c => c.name),
    ...(feed.incidents ?? []).flatMap(i => (i.components ?? []).map(c => c.name)),
  ]
  if (geraakt.length === 0) return true
  return geraakt.some(naam => relevant.includes(naam))
}

/** Storing-wacht-sleutels die ook een stip in de admin-app zijn. Snelheid is geen stip en blijft bij Telegram. */
export function isStipStoring(sleutel: string): boolean {
  return sleutel.startsWith('storing:extern:') || sleutel.startsWith('storing:arnobot:')
}

/** Capaciteitssleutels die ook een stip zijn. Verbindingen, Resend, Anthropic-limiet en mijlpalen niet. */
export function isStipCapaciteit(sleutel: string): boolean {
  return sleutel.startsWith('database:') || sleutel.startsWith('database-geheugen:')
}

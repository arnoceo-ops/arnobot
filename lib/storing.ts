import { beoordeelSnelheid, meetSnelheid, SNELHEID_GRENZEN } from '@/lib/performance'
import type { InstatusMeting } from '@/lib/instatus'

// Beoordeelt of er een storing is die Arno moet weten, buiten de statuspagina om. Puur en getest;
// /api/cron/storing-wacht haalt de gegevens op, verstuurt de meldingen en dedupliceert ze.

export type StoringMelding = { sleutel: string; niveau: 'kritiek' | 'waarschuwing'; tekst: string }

/** Minimaal aantal metingen in het laatste uur voor een snelheidsoordeel (bij een interval van 10 minuten zijn dat er ongeveer 6). */
export const MIN_METINGEN_VOOR_SNELHEID = 3

/**
 * Een externe dienst (Anthropic, Vercel, Supabase, Clerk, Resend). Alleen een grote of kritieke
 * storing meldt: kleine incidenten ('minor') gaan vaak over een onderdeel waar arno.bot niet van
 * afhangt en zouden de melding ruis geven. Die staan wel op de statuspagina.
 */
export function beoordeelExtern(naam: string, indicator: string | null): StoringMelding | null {
  if (indicator === 'major' || indicator === 'critical') {
    return {
      sleutel: `storing:extern:${naam}`,
      niveau: 'kritiek',
      tekst: `${naam} meldt een ${indicator === 'critical' ? 'kritieke' : 'grote'} storing. Mogelijk merken gebruikers dat in arno.bot.`,
    }
  }
  return null
}

/** arno.bot zelf, volgens de Instatus-monitor: bereikbaarheid en de gemiddelde responstijd van het laatste uur. */
export function beoordeelArnoBot(meting: InstatusMeting, nu: Date = new Date()): StoringMelding[] {
  const meldingen: StoringMelding[] = []

  if (meting.monitorStatus === 'DOWN') {
    meldingen.push({ sleutel: 'storing:arnobot:down', niveau: 'kritiek', tekst: 'arno.bot is niet bereikbaar volgens de monitor (Instatus).' })
  } else if (meting.monitorStatus === 'DEGRADED') {
    meldingen.push({ sleutel: 'storing:arnobot:degraded', niveau: 'waarschuwing', tekst: 'arno.bot is verminderd bereikbaar volgens de monitor (Instatus).' })
  }

  const uurGeleden = nu.getTime() - 3600_000
  const tijden = meting.logs
    .filter(l => Date.parse(l.createdAt) > uurGeleden)
    .map(l => l.responseTime ?? 0)
  const m = meetSnelheid(tijden)
  if (m.aantal >= MIN_METINGEN_VOOR_SNELHEID) {
    const niveau = beoordeelSnelheid({ gemiddeldMs: m.gemiddeldMs, p95Ms: null })
    if (niveau === 'laag') {
      meldingen.push({
        sleutel: 'storing:snelheid:laag',
        niveau: 'kritiek',
        tekst: `arno.bot is erg traag: gemiddeld ${m.gemiddeldMs} ms over het laatste uur (grens voor laag: ${SNELHEID_GRENZEN.laag.gemiddeldMs} ms).`,
      })
    } else if (niveau === 'onder_druk') {
      meldingen.push({
        sleutel: 'storing:snelheid:onder_druk',
        niveau: 'waarschuwing',
        tekst: `arno.bot staat onder druk: gemiddeld ${m.gemiddeldMs} ms over het laatste uur (grens: ${SNELHEID_GRENZEN.onderDruk.gemiddeldMs} ms).`,
      })
    }
  }

  return meldingen
}

export function bouwStoringBericht(meldingen: StoringMelding[]): string {
  const kritiek = meldingen.some(m => m.niveau === 'kritiek')
  return `${kritiek ? 'Storing op arno.bot: ACTIE NODIG' : 'Let op: arno.bot'}\n\n${meldingen.map(m => m.tekst).join('\n\n')}\n\nZie Status in de admin.`
}

// Herstelbericht: een storing is voorbij. De cron onthoudt welke storingen actief zijn (lib/storingStaat.ts)
// en meldt het wanneer zo'n storing twee runs achter elkaar (dus een half uur) niet meer voorkomt, zodat
// een kort wegvallen van de meting geen vals "hersteld" geeft.

export type ActieveStoring = {
  sleutel: string
  /** Moment waarop de storing voor het eerst werd gezien (ISO). */
  sinds: string
  /** Is er voor deze storing een melding verstuurd? Alleen dan volgt een herstelbericht. */
  gemeld: boolean
  /** Aantal runs achter elkaar dat de storing niet meer voorkwam. */
  schoneRuns: number
}

/** Aantal schone runs achter elkaar voordat een storing als voorbij geldt (2 runs van 15 minuten is een half uur). */
export const HERSTEL_NA_SCHONE_RUNS = 2

/**
 * Werkt de lijst actieve storingen bij na een run.
 *  - huidig: de storingen die nu spelen
 *  - gemeldeSleutels: voor welke daarvan deze run een melding is verstuurd
 *  - bronBeschikbaar: of de gegevensbron van een sleutel deze run te lezen was. Was die er niet (Instatus of
 *    een statuspagina niet bereikbaar), dan zegt het ontbreken van een storing niets en blijft die storing zoals hij was.
 * Geeft de nieuwe lijst terug en de storingen die voorbij zijn en waarvoor een herstelbericht hoort.
 */
export function werkStoringenBij(
  vorige: ActieveStoring[],
  huidig: StoringMelding[],
  gemeldeSleutels: ReadonlySet<string>,
  bronBeschikbaar: (sleutel: string) => boolean,
  nu: Date = new Date(),
): { actief: ActieveStoring[]; hersteld: ActieveStoring[] } {
  const huidigeSleutels = new Set(huidig.map(m => m.sleutel))
  const actief: ActieveStoring[] = []
  const hersteld: ActieveStoring[] = []

  for (const m of huidig) {
    const eerder = vorige.find(v => v.sleutel === m.sleutel)
    actief.push({
      sleutel: m.sleutel,
      sinds: eerder?.sinds ?? nu.toISOString(),
      gemeld: (eerder?.gemeld ?? false) || gemeldeSleutels.has(m.sleutel),
      schoneRuns: 0,
    })
  }

  for (const v of vorige) {
    if (huidigeSleutels.has(v.sleutel)) continue
    if (!bronBeschikbaar(v.sleutel)) { actief.push(v); continue }
    const schoneRuns = v.schoneRuns + 1
    if (schoneRuns >= HERSTEL_NA_SCHONE_RUNS) {
      if (v.gemeld) hersteld.push({ ...v, schoneRuns })
    } else {
      actief.push({ ...v, schoneRuns })
    }
  }

  return { actief, hersteld }
}

/** Leesbare tekst bij een sleutel van een storing die voorbij is. */
export function herstelTekst(sleutel: string): string {
  if (sleutel === 'storing:arnobot:down') return 'arno.bot is weer bereikbaar.'
  if (sleutel === 'storing:arnobot:degraded') return 'arno.bot is weer volledig bereikbaar.'
  if (sleutel.startsWith('storing:snelheid:')) return 'arno.bot is weer snel genoeg.'
  if (sleutel.startsWith('storing:extern:')) return `${sleutel.slice('storing:extern:'.length)} meldt geen grote storing meer.`
  return `${sleutel} is hersteld.`
}

export function duurTekst(ms: number): string {
  const minuten = Math.max(0, Math.round(ms / 60_000))
  if (minuten < 60) return `${minuten} min`
  const uren = Math.floor(minuten / 60)
  const rest = minuten % 60
  return rest === 0 ? `${uren} uur` : `${uren} uur ${rest} min`
}

export function bouwHerstelBericht(hersteld: ActieveStoring[], nu: Date = new Date()): string {
  const regels = hersteld.map(h => `${herstelTekst(h.sleutel)} Storing duurde ${duurTekst(nu.getTime() - Date.parse(h.sinds))}.`)
  return `Storing voorbij op arno.bot\n\n${regels.join('\n\n')}`
}

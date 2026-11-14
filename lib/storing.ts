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

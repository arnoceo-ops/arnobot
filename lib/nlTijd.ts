// Dagen op Nederlandse tijd (Europe/Amsterdam, met zomer- en wintertijd).
//
// De database leest een tijd zonder zone als UTC (gemeten 2026-11-14). Een filter als
// `${datum}T00:00:00` begon een "dag" dus om 01:00 of 02:00 Nederlandse tijd, en een gesprek
// om 00:30 telde nog bij gisteren. Alle dagfilters in de admin lopen daarom via deze
// functies: een dag loopt van middernacht tot middernacht in Amsterdam, en het einde is het
// begin van de volgende dag (gebruik daarom `.lt`, niet `.lte`).
// Een dag is dus 24 uur, behalve op de dagen dat de klok verspringt (23 of 25 uur).

const ZONE = 'Europe/Amsterdam'

const delen = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Verschil tussen Amsterdam en UTC op dit moment, in milliseconden (3600000 in de winter). */
function offsetMs(moment: Date): number {
  const p: Record<string, number> = {}
  for (const d of delen.formatToParts(moment)) if (d.type !== 'literal') p[d.type] = Number(d.value)
  const alsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return alsUtc - Math.floor(moment.getTime() / 1000) * 1000
}

/** Het UTC-moment waarop deze datum (JJJJ-MM-DD) in Amsterdam om 00:00 begint. */
export function nlDagStartIso(datum: string): string {
  const [j, m, d] = datum.split('-').map(Number)
  const gok = Date.UTC(j, m - 1, d)
  let uit = gok - offsetMs(new Date(gok))
  const controle = offsetMs(new Date(uit))
  if (gok - controle !== uit) uit = gok - controle
  return new Date(uit).toISOString()
}

/** Het begin van de dag erna: de uitsluitende bovengrens van deze datum (gebruik met .lt). */
export function nlDagEindeIso(datum: string): string {
  const [j, m, d] = datum.split('-').map(Number)
  return nlDagStartIso(new Date(Date.UTC(j, m - 1, d + 1)).toISOString().slice(0, 10))
}

/** Vandaag als JJJJ-MM-DD volgens de klok in Amsterdam. */
export function nlVandaag(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(nu)
}

/** Gisteren als JJJJ-MM-DD volgens de klok in Amsterdam. */
export function nlGisteren(nu: Date = new Date()): string {
  const [j, m, d] = nlVandaag(nu).split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, d - 1)).toISOString().slice(0, 10)
}

// Weergave van een moment op Nederlandse tijd. toLocaleTimeString('nl-NL') zonder timeZone
// gebruikt de tijdzone van de server (UTC op Vercel), waardoor een gesprek van 09:03 Nederlandse
// tijd als 08:03 werd getoond. Alles wat de admin op de server opmaakt loopt via deze twee.
const tijdFormat = new Intl.DateTimeFormat('nl-NL', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const datumDelen = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "09:03:11" op Nederlandse tijd. */
export function nlTijdTekst(iso: string): string {
  return tijdFormat.format(new Date(iso))
}

/** "13/11/2026" op Nederlandse tijd (de datum van dat moment in Amsterdam, niet de UTC-datum). */
export function nlDatumTekst(iso: string): string {
  const [j, m, d] = datumDelen.format(new Date(iso)).split('-')
  return `${d}/${m}/${j}`
}

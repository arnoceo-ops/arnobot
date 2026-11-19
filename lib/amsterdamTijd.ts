// Datumhulpjes in Amsterdamse tijd voor perioden in de kostenoverzichten (Abacus-tab Gebruikers). Puur, geen serverafhankelijkheden, dus ook in de
// browser te gebruiken. Een datum is een tekst "JJJJ-MM-DD"; een periode loopt van de eerste dag tot en met de laatste dag.

const AMSTERDAM = 'Europe/Amsterdam'

/** Vandaag als "JJJJ-MM-DD" in Amsterdam. */
export function amsterdamDatum(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AMSTERDAM, year: 'numeric', month: '2-digit', day: '2-digit' }).format(nu)
}

/** Het tijdstip (ISO, UTC) waarop deze dag begint in Amsterdam, ook op de dagen dat de klok verzet wordt. */
export function amsterdamDagStart(datum: string): string {
  for (const offset of ['+01:00', '+02:00']) {
    const kandidaat = new Date(`${datum}T00:00:00${offset}`)
    const delen = new Intl.DateTimeFormat('en-CA', { timeZone: AMSTERDAM, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(kandidaat)
    const waarde = (t: string) => delen.find(d => d.type === t)?.value
    if (`${waarde('year')}-${waarde('month')}-${waarde('day')}` === datum && waarde('hour') === '00') return kandidaat.toISOString()
  }
  return new Date(`${datum}T00:00:00+01:00`).toISOString()
}

/** Optellen of aftrekken van dagen bij een datum, zonder tijdzoneverrassingen (rekent op het kalenderdatum zelf). */
export function datumPlusDagen(datum: string, dagen: number): string {
  const [j, m, d] = datum.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, d + dagen)).toISOString().slice(0, 10)
}

export function dagenInMaand(jaar: number, maand: number): number {
  return new Date(Date.UTC(jaar, maand, 0)).getUTCDate()
}

/** Aantal dagen van een periode, begin en einde meegeteld. */
export function dagenTussen(van: string, tot: string): number {
  const [j1, m1, d1] = van.split('-').map(Number)
  const [j2, m2, d2] = tot.split('-').map(Number)
  return Math.round((Date.UTC(j2, m2 - 1, d2) - Date.UTC(j1, m1 - 1, d1)) / 86_400_000) + 1
}

export function isDatum(tekst: string | null | undefined): tekst is string {
  if (!tekst || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(tekst)) return false
  // Heen en terug: "2026-02-31" wordt door JavaScript stilletjes 3 maart, en dat is geen geldige datum.
  const d = new Date(`${tekst}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === tekst
}

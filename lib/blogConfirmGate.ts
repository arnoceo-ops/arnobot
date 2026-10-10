// Onderscheidt een echte klik van een mens op de bevestiglink in de mail van een geautomatiseerde
// scanner (Microsoft Safe Links, Proofpoint, bedrijfsfilters) die links vooraf opent.
//
// Browsers sturen bij een door de gebruiker gestarte navigatie (klik op een link) de headers
// Sec-Fetch-Mode: navigate en Sec-Fetch-User: ?1 mee. Serverside scanners sturen Sec-Fetch-User
// niet mee. Alleen bij een echte klik bevestigen we direct; anders valt de route terug op de
// pagina met een bevestigknop, die niets wijzigt bij het openen. Browsers zonder Sec-Fetch-
// headers (Safari ouder dan 16.4) krijgen dus ook die pagina: een extra klik, geen fout.
export function isUserInitiatedNavigation(headers: Pick<Headers, 'get'>): boolean {
  return headers.get('sec-fetch-user') === '?1' && headers.get('sec-fetch-mode') === 'navigate'
}

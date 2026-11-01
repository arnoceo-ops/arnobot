/**
 * Elke cron die e-mail naar gebruikers stuurt moet een dubbele-verzendbeveiliging hebben.
 *
 * Achtergrond: op 2026-11-01 kreeg elke ontvanger van cron/patroon-samenvatting zes keer
 * dezelfde mail doordat de route handmatig werd aangeroepen en niets een tweede verzending
 * tegenhield. De regel staat in CLAUDE.md (sectie "E-mail crons"); dit script dwingt hem af,
 * zodat een nieuwe cron zonder beveiliging de build breekt.
 *
 * Een cron-route (app/api/cron/<naam>/route.ts) die een mail verstuurt is in orde wanneer:
 *   - alle ontvangers vaste interne adressen zijn (to: 'x@arno.bot'), of
 *   - de route een verzendlogboek of verzendvlag raadpleegt (zie DEDUPE_TOKENS).
 * Anders faalt het script. Bevestigde legitieme gevallen horen in KNOWN_SAFE, met reden.
 *
 * Uitvoeren: node scripts/check-cron-mail-dedupe.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const CRON_DIR = join(ROOT, 'app/api/cron')

// Wanneer de route een van deze aanroept of importeert, verstuurt hij mail.
const SEND_TOKENS = /\.emails\.send\(|\bsendBlogMail\w*|lib\/billing\/mails|lib\/billing\/teamMails|lib\/teamLeadNotify|\bsendEmail\(/

// Tekenen van een verzendlogboek, verzendvlag of wachtrijstatus die een tweede verzending tegenhoudt.
const DEDUPE_TOKENS = [
  /arnobot_email_log/,
  /[a-z_]+_log\b/,
  /sent_at/,
  /herinnering(_\d+)?_at|geblokkeerd_at/,
  /arnobot_meta/,
  /arnobot_team_notifications/,
  /redis\.(set|get)\(|Redis\b/,
  /status['"]?\s*[:,=]\s*['"]sent['"]|\.eq\(\s*['"]status['"],\s*['"](pending|queued)['"]/,
]

// Ontvangers die alleen intern zijn: elk `to:` is een letterlijk @arno.bot-adres.
function alleenInterneOntvangers(src) {
  const tos = [...src.matchAll(/\bto:\s*([^,\n}]+)/g)].map(m => m[1].trim())
  if (tos.length === 0) return false
  return tos.every(t => /^['"`][^'"`$]*@arno\.bot['"`]$/.test(t))
}

// Bevestigde legitieme gevallen. Formaat: 'naam-van-de-cron': 'reden'.
const KNOWN_SAFE = {
  'auto-analyse': 'beveiligd via de gegevens zelf: alleen gesprekken na de laatste analyse tellen, een tweede aanroep vindt niets nieuws',
}

const fouten = []
const ok = []
for (const naam of readdirSync(CRON_DIR)) {
  const bestand = join(CRON_DIR, naam, 'route.ts')
  if (!existsSync(bestand)) continue
  const src = readFileSync(bestand, 'utf-8')
  if (!SEND_TOKENS.test(src)) continue
  if (KNOWN_SAFE[naam]) { ok.push(`${naam} (bekend veilig: ${KNOWN_SAFE[naam]})`); continue }
  if (alleenInterneOntvangers(src)) { ok.push(`${naam} (alleen interne ontvangers)`); continue }
  if (DEDUPE_TOKENS.some(r => r.test(src))) { ok.push(`${naam} (verzendlogboek of vlag)`); continue }
  fouten.push(naam)
}

for (const r of ok) console.log(`OK   ${r}`)
if (fouten.length) {
  console.error(`\nGEEN dubbele-verzendbeveiliging in ${fouten.length} cron(s) die mail versturen:`)
  for (const f of fouten) console.error(`  app/api/cron/${f}/route.ts`)
  console.error('\nLeg per gebruiker en mailtype een logregel vast in arnobot_email_log en controleer die vóór het verzenden (voorbeeld: cron/patroon-samenvatting).')
  console.error('Alleen bij een bevestigd legitiem geval: toevoegen aan KNOWN_SAFE met reden.')
  process.exit(1)
}
console.log(`\n${ok.length} mail-crons gecontroleerd, allemaal beveiligd.`)

/**
 * Vindt API-routes onder app/api/** zonder enige aanroeper in de codebase (geen client-fetch,
 * geen server-side aanroep, geen vercel.json-cron). Gebouwd n.a.v. app/api/bot/sessions/embed/
 * route.ts, dat sinds juni 2026 ongebruikt bleek en pas op 12 augustus bij toeval werd
 * ontdekt. Doel: dit soort dode code sneller vinden dan "bij toeval tijdens ander werk".
 *
 * Bewust NIET blokkerend in CI (zie .github/workflows/security-audit.yml): een route kan
 * legitiem geen interne verwijzing hebben (handmatig-genavigeerde devtools, een link die pas
 * later gebouwd wordt, iets dat via een absolute URL in e-mail/Telegram wordt aangeroepen).
 * KNOWN_EXTERNAL_PREFIXES en KNOWN_MANUAL_ROUTES bestaan om na een eerste triage-ronde
 * bevestigde legitieme gevallen uit te sluiten, in plaats van steeds opnieuw ruis te melden.
 *
 * Uitvoeren: node scripts/check-orphan-routes.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')

// Routes die per ontwerp geen interne verwijzing hebben: aangeroepen door een externe partij
// (webhook), of bewust alleen handmatig in de browser bezocht (devtools/preview).
const KNOWN_EXTERNAL_PREFIXES = ['/api/webhooks/']
const KNOWN_MANUAL_ROUTES = new Set([
  '/api/test/email-preview',
  // Getrieerd 2026-08-12 (zie CLAUDE.md): admin-only, handmatig via curl/Postman aangeroepen,
  // geen UI-knop. Herbruikbare diagnosetool, geen eenmalige migratie zoals de twee
  // backfill-routes die op 2026-08-13 alsnog verwijderd zijn (Arno herkende ze niet meer).
  '/api/admin/test-telegram',
])

function walk(dir, matcher, results = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git' || entry === 'test-results') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, matcher, results)
    else if (matcher(entry)) results.push(full)
  }
  return results
}

// Alle route.ts-bestanden onder app/api
const routeFiles = walk(join(ROOT, 'app', 'api'), name => name === 'route.ts')
const routes = routeFiles.map(file => {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const routePath = '/' + rel.replace(/^app\//, '').replace(/\/route\.ts$/, '')
  return { file, routePath }
})

// Doorzoekbare corpus: alle TS/TSX/MJS-bronbestanden + vercel.json, exclusief het route-bestand zelf
// Alle bronmap-toplevels die TS/TSX kunnen bevatten die een API-route aanroept. Bewust
// exhaustief (android/ meegenomen voor eventuele Capacitor-specifieke aanroepen), niet alleen
// de mappen die op het eerste gezicht relevant leken: precies dat liet /api/version en
// /api/tts eerder ten onrechte als wees-route verschijnen (hooks/ en components/ ontbraken).
const SOURCE_DIRS = ['app', 'lib', 'e2e', 'scripts', 'hooks', 'components', 'types', 'android']
// Root-level bestanden zoals proxy.ts (CSP report-uri, redirects) worden door geen enkele
// SOURCE_DIRS-map gedekt maar bevatten wel degelijk route-verwijzingen.
const ROOT_FILES = ['proxy.ts', 'next.config.ts', 'vercel.json']
const searchFiles = [
  ...SOURCE_DIRS.flatMap(dir => {
    try {
      return walk(join(ROOT, dir), name => /\.(ts|tsx|java|kt)$/.test(name))
    } catch {
      return []
    }
  }),
  ...ROOT_FILES.map(f => join(ROOT, f)).filter(f => {
    try { statSync(f); return true } catch { return false }
  }),
]
const corpus = searchFiles.map(f => ({ file: f, text: readFileSync(f, 'utf-8') }))

function isOrphan(routePath, ownFile) {
  // Boundary-check: voorkomt dat /api/bot/session matcht binnen /api/bot/sessions
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '(?![a-zA-Z0-9_-])', 'g')
  for (const { file, text } of corpus) {
    if (file === ownFile) continue
    if (re.test(text)) return false
  }
  return true
}

const orphans = []
for (const { file, routePath } of routes) {
  if (KNOWN_EXTERNAL_PREFIXES.some(p => routePath.startsWith(p))) continue
  if (KNOWN_MANUAL_ROUTES.has(routePath)) continue
  if (isOrphan(routePath, file)) orphans.push(routePath)
}

if (orphans.length === 0) {
  console.log('Geen wees-routes gevonden.')
} else {
  console.log(`${orphans.length} route(s) zonder gevonden aanroeper:\n`)
  for (const o of orphans) console.log(`  ${o}`)
  console.log('\nControleer handmatig: als een route legitiem geen interne verwijzing heeft (devtools, later te bouwen link), voeg hem toe aan KNOWN_MANUAL_ROUTES in dit script. Anders is dit een kandidaat om te verwijderen.')
}

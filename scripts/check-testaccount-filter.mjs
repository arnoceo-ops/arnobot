/**
 * Vindt gebruikersoverstijgende queries op gebruikersdata-tabellen in admin- en
 * cron-code die de interne testaccounts NIET uitsluiten.
 *
 * Achtergrond: de geautomatiseerde Playwright-E2E draait tegen een apart Supabase-
 * project, maar test@arno.bot (handmatig via /sign-in/intern) en reviewer@arno.bot
 * (Google Play) loggen in op de productie-Clerk en schrijven dus naar dezelfde
 * productie-tabellen als echte gebruikers. Elke aggregatie/analyse/ranglijst die
 * over meerdere gebruikers heen leest en die accounts niet wegfiltert, neemt hun
 * testverkeer mee in weekcijfers, competitie-ranglijsten, gegenereerde openers, enz.
 * De filter leeft alleen in CLAUDE.md en code review; dit script is de achtervang,
 * zelfde aanpak als scripts/check-missing-user-filter.mjs.
 *
 * Een query telt als afgeschermd wanneer, binnen dezelfde functie, een van deze
 * voorkomt:
 *   - een verwijzing naar lib/internalTestAccounts (isInternalTestUser,
 *     excludeInternalTestUsers, INTERNAL_TEST_USER_IDS, of een van de losse
 *     E2E_/MANUAL_/APP_REVIEWER-constanten)
 *   - een per-gebruiker scope op de query zelf (.eq('user_id', ...)); dan leest de
 *     query maar één gebruiker en hoort testpollutie thuis bij de bron van die
 *     user-ID-lijst, niet hier.
 *
 * Bewust NIET blokkerend in CI: statische tekstanalyse op functieniveau. Een
 * legitiem geval dat toch flagt hoort in KNOWN_SAFE, niet in een lossere check.
 *
 * Uitvoeren: node scripts/check-testaccount-filter.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')

// Alleen gebruikersoverstijgende code: admin-routes/pagina's en cron-jobs. De gewone
// per-gebruiker /bot-routes filteren al op de auth-user_id en zijn geen risico.
const SCAN_PREFIXES = ['app/api/admin/', 'app/api/cron/', 'app/bot/admin/']

// Tabellen met per-gebruiker eigendom (identiek aan check-missing-user-filter.mjs).
const GEBRUIKERSTABELLEN = new Set([
  'approved_users',
  'arnobot_rds_logs',
  'arnobot_blog_sessions',
  'arnobot_analyses',
  'arnobot_coaching',
  'arnobot_coaching_history',
  'arnobot_coaching_scores',
  'arnobot_blog_profiles',
  'arnobot_memory_entities',
  'arnobot_sparring_sessions',
  'arnobot_1on1_log',
  'arnobot_salesbaas_coaching',
])

const TEST_ACCOUNT_TOKEN = /isInternalTestUser|excludeInternalTestUsers|INTERNAL_TEST_USER|E2E_TEST_USER|MANUAL_TEST_USER|APP_REVIEWER/
const OWNERSHIP_EQ = /\.eq\(\s*['"]user_id['"]/

// Bevestigde legitieme gevallen. Formaat: 'relatief/pad.ts:tabelnaam'.
// - routes die per gebruiker een e-mail sturen en de testaccounts al op e-mailadres
//   (.neq('email', ...)) uitsluiten worden door OWNERSHIP_EQ niet gevangen maar zijn
//   veilig; zet ze hier neer.
// - onderhoud/opruiming die juist ALLE rijen moet zien (data-cleanup, delete-account).
const KNOWN_SAFE = new Set([
  // Draait per gebruiker, sluit testaccounts al op e-mailadres uit.
  'app/api/cron/trial-emails/route.ts:approved_users',
  'app/api/cron/inactivity-nudge/route.ts:approved_users',
  'app/api/cron/kwartaal-doel/route.ts:approved_users',
  'app/api/cron/milestone-check/route.ts:approved_users',
  'app/api/admin/analyse/users/route.ts:approved_users',
  // AVG-opruimlijst van 30+ dagen geleden beëindigde accounts (is_active=false). De
  // testaccounts zijn actief en verschijnen nooit; als er ooit toch een tussen staat
  // hoort die juist zichtbaar te zijn.
  'app/api/cron/data-cleanup/route.ts:approved_users',
])

function walk(dir, results = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, results)
    else if (/\.(ts|tsx)$/.test(entry)) results.push(full)
  }
  return results
}

function findFunctionRanges(text) {
  const ranges = []
  const startRe = /\bfunction\s*[\w$]*\s*\([^)]*\)\s*\{|=>\s*\{/g
  let m
  while ((m = startRe.exec(text))) {
    const openIdx = text.indexOf('{', m.index)
    if (openIdx === -1) continue
    let depth = 1
    let i = openIdx + 1
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      i++
    }
    ranges.push([m.index, i])
  }
  return ranges
}

function windowFor(text, ranges, matchIndex) {
  const enclosing = ranges.find(([s, e]) => matchIndex >= s && matchIndex < e)
  return enclosing ? text.slice(enclosing[0], enclosing[1]) : text
}

const files = walk(join(ROOT, 'app'))
  .concat(walk(join(ROOT, 'lib')))

const findings = []
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (!SCAN_PREFIXES.some(p => rel.startsWith(p))) continue

  const text = readFileSync(file, 'utf-8')
  const fileHasToken = TEST_ACCOUNT_TOKEN.test(text)
  const ranges = findFunctionRanges(text)
  const fromRe = /\.from\(\s*['"]([a-zA-Z_]+)['"]\s*\)/g
  let m
  while ((m = fromRe.exec(text))) {
    const table = m[1]
    if (!GEBRUIKERSTABELLEN.has(table)) continue
    if (KNOWN_SAFE.has(`${rel}:${table}`)) continue

    const opWindow = text.slice(m.index, m.index + 400)
    const opMatch = opWindow.match(/\.(select|insert|update|delete|upsert)\(/)
    if (opMatch && (opMatch[1] === 'insert' || opMatch[1] === 'update' || opMatch[1] === 'delete')) continue

    // Per-gebruiker gescoped op de query zelf (binnen ~400 tekens na .from) -> geen
    // cross-user aggregatie.
    if (OWNERSHIP_EQ.test(opWindow)) continue

    const fnWindow = windowFor(text, ranges, m.index)
    if (fileHasToken && TEST_ACCOUNT_TOKEN.test(fnWindow)) continue

    const line = text.slice(0, m.index).split('\n').length
    findings.push({ rel, line, table })
  }
}

if (findings.length === 0) {
  console.log('Geen gebruikersoverstijgende queries zonder testaccount-filter gevonden.')
} else {
  console.log(`${findings.length} query(s) over gebruikersdata zonder testaccount-filter:\n`)
  for (const f of findings) {
    console.log(`  ${f.rel}:${f.line} - .from('${f.table}') zonder isInternalTestUser/excludeInternalTestUsers of per-user .eq('user_id', ...)`)
  }
  console.log(`\nFix: filter de interne testaccounts uit (excludeInternalTestUsers() op de query, of isInternalTestUser() in de reductie). Legitiem gebruikersoverstijgend en veilig? Zet 'pad:tabel' in KNOWN_SAFE in dit script.`)
}

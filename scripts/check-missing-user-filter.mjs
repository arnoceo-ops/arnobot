/**
 * Vindt Supabase-queries op gebruikersdata-tabellen die geen eigenaarschapsfilter
 * (.eq('user_id'|'manager_id'|'member_id', ...)) bevatten binnen dezelfde functie.
 *
 * Achtergrond: RLS staat aan op alle Supabase-tabellen, maar zonder policies (elke
 * route gebruikt de service-role-key, die RLS altijd omzeilt). Isolatie tussen
 * gebruikers hangt dus volledig af van de staande regel in CLAUDE.md ("Supabase —
 * gebruikersdata queries — ALTIJD") en handmatige code review, zonder database-
 * afgedwongen vangnet. Eén vergeten filter in een nieuwe route is dan direct IDOR.
 * Dit script is de geautomatiseerde achtervang voor precies dat scenario, zelfde
 * aanpak als scripts/check-orphan-routes.mjs voor wees-routes.
 *
 * Bewust NIET blokkerend in CI (zie .github/workflows/security-audit.yml): dit is
 * statische tekstanalyse op functieniveau, geen echte type-/dataflow-check. Een
 * legitiem geval dat toch flagt (bv. een update op een id die al eerder in dezelfde
 * functie op eigenaarschap gecontroleerd is) hoort in KNOWN_SAFE_QUERIES, in plaats
 * van de check zelf onnauwkeuriger te maken.
 *
 * Uitvoeren: node scripts/check-missing-user-filter.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')

// Mappen die per ontwerp gebruikersoverstijgend queryen (admin/cron/interne test- en
// login-tools) en dus bewust buiten deze check vallen.
const EXCLUDED_PATH_PREFIXES = [
  'app/api/admin/',
  'app/api/cron/',
  'app/api/webhooks/',
  'app/api/test/',
  'app/bot/admin/',
  'app/abacus/',
  'app/agents/',
  'app/api/arnobot-admin-login',
  'app/api/arnobot-kosten-login',
  'app/api/sd-verdien-login',
  'app/api/kosten-tracking',
  'app/api/track-pageview',
  'app/api/track-cta-click',
  'app/api/evaluatie',
  'app/api/team-aanvraag',
  'app/api/csp-report',
  'app/api/optout',
  'app/api/version',
  'app/api/auth-mode',
  // Cron-secret-gated batchjob (draait dagelijks over ALLE gebruikers met een
  // ontbrekende embedding), geen Clerk-gebruikersroute ondanks het app/api/bot/-pad.
  'app/api/bot/backfill-embeddings/route.ts',
]

// Tabellen met per-gebruiker (of per-manager) eigendom, waar een ontbrekend filter
// écht IDOR betekent. Bewust een expliciete allowlist i.p.v. "alles behalve": een
// tabel die hier niet in staat wordt simpelweg niet gecheckt, in plaats van dat een
// verkeerde aanname over een ongeverifieerde tabel een fout-positief oplevert.
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
  'arnobot_referrals',
  'arnobot_shared_sessions',
  'arnobot_shared_analyses',
  'arnobot_email_log',
  'arnobot_events',
  'arnobot_elevenlabs_usage',
  'arnobot_1on1_log',
  'arnobot_team_members',
  'arnobot_team_notifications',
  'arnobot_salesbaas_coaching',
  'arnobot_team_waitlist',
  'arnobot_uitdaging_reminders_log',
  'arnobot_offtopic_flags',
])

// .eq() of .in() op een kolom die user_id/manager_id/member_id bevat (dus ook
// varianten als referrer_user_id/referred_user_id), niet alleen de exacte naam.
const OWNERSHIP_EQ = /\.(eq|in)\(\s*['"][^'"]*(?:user_id|manager_id|member_id)[^'"]*['"]/

// Bevestigde legitieme gevallen: eigenaarschap is al eerder in dezelfde functie
// geverifieerd (bv. een rij opgehaald met een eigenaarschapsfilter, waarna verderop
// alleen nog op de al-geverifieerde primary key ge-update/verwijderd wordt), of het
// is een bewust ontworpen lookup van een ANDERE gebruiker via een publieke sleutel
// (referral-code, team_id) waarvan de output nooit terug naar de aanroeper lekt.
// Formaat: 'relatief/pad.ts:tabelnaam'.
const KNOWN_SAFE_QUERIES = new Set([
  'app/api/bot/team/1on1/save/route.ts:arnobot_1on1_log',
  // Zoekt de referrer op via een publieke referral_code (niet de eigen user_id) om
  // een e-mail te sturen; referrer-data (incl. e-mailadres) wordt nooit teruggegeven
  // aan de aanroepende gebruiker.
  'app/api/bot/referral/route.ts:approved_users',
  // Zoekt de manager van een team op via team_id (al gevalideerd via een eerdere,
  // wél op user_id gescopede lookup elders in dit bestand) om een notificatie te
  // maken; het resultaat gaat nooit terug naar de aanroeper.
  'app/api/bot/team/share-analyse/route.ts:arnobot_team_members',
  // Uitsluitend gebruikt door de admin-only export-routes (app/api/admin/export*,
  // beide al uitgesloten via EXCLUDED_PATH_PREFIXES); bewust gebruikersoverstijgend.
  'lib/adminExport.ts:arnobot_rds_logs',
  'lib/adminExport.ts:approved_users',
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

// Vindt [start, end)-bereiken van functiebodies (top-level export async function
// GET/POST/... en vergelijkbare declaraties) via eenvoudige brace-telling. Geen
// volwaardige parser, maar voor de rechttoe-rechtaan route-bestanden in deze repo
// volstaat dit.
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

const SOURCE_DIRS = ['app/api', 'app/bot', 'lib']
const files = SOURCE_DIRS.flatMap(dir => {
  try {
    return walk(join(ROOT, dir), name => /\.(ts|tsx)$/.test(name))
  } catch {
    return []
  }
})

const findings = []
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (EXCLUDED_PATH_PREFIXES.some(p => rel.startsWith(p))) continue

  const text = readFileSync(file, 'utf-8')
  const fromRe = /\.from\(\s*['"]([a-zA-Z_]+)['"]\s*\)/g
  let m
  const ranges = findFunctionRanges(text)
  while ((m = fromRe.exec(text))) {
    const table = m[1]
    if (!GEBRUIKERSTABELLEN.has(table)) continue
    if (KNOWN_SAFE_QUERIES.has(`${rel}:${table}`)) continue

    // Een insert() zet eigenaarschap doorgaans direct als veld in het object (bv.
    // { user_id: userId, ... }), heeft geen .eq()-filter nodig en is geen IDOR-risico
    // op dezelfde manier als een select/update/delete met een vergeten filter.
    const opWindow = text.slice(m.index, m.index + 300)
    const opMatch = opWindow.match(/\.(select|insert|update|delete|upsert)\(/)
    if (opMatch && opMatch[1] === 'insert') continue

    const window = windowFor(text, ranges, m.index)
    if (!OWNERSHIP_EQ.test(window)) {
      const line = text.slice(0, m.index).split('\n').length
      findings.push({ rel, line, table })
    }
  }
}

if (findings.length === 0) {
  console.log('Geen ontbrekende eigenaarschapsfilters gevonden.')
} else {
  console.log(`${findings.length} mogelijk ontbrekende eigenaarschapsfilter(s):\n`)
  for (const f of findings) console.log(`  ${f.rel}:${f.line} — .from('${f.table}') zonder .eq('user_id'|'manager_id'|'member_id', ...) in dezelfde functie`)
  console.log('\nControleer handmatig: als eigenaarschap al elders in dezelfde functie geverifieerd is (bv. een eerdere query, of dit is een insert die het veld zelf meegeeft), voeg toe aan KNOWN_SAFE_QUERIES in dit script. Anders is dit een kandidaat voor een IDOR-fix.')
}

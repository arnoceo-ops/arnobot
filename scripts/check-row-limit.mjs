/**
 * Vindt Supabase-queries op groeitabellen die ALLE rijen willen lezen maar stilletjes
 * worden afgekapt.
 *
 * Achtergrond: PostgREST geeft per vraag hooguit 1000 rijen terug (max_rows), ook bij
 * .limit(5000) of .limit(100000). Gemeten 2026-11-14 op blog_chunks: 1540 rijen, een
 * select zonder limit en eentje met .limit(5000) gaven allebei 1000. Een telling,
 * ranglijst of gezondheidsscore over zo'n query klopt dan stilletjes niet meer, en omdat
 * de nieuwste rijen als eerste wegvallen raken de cijfers van de afgelopen week het eerst
 * besmet. Aanwijzing voor een plek die dit al had: arnobot_rds_logs stond op 585 rijen en
 * werd op zeker tien plekken kaal gelezen.
 *
 * Een query telt als veilig wanneer binnen dezelfde statement een van deze voorkomt:
 *   - haalAlleRijen of .range(   -> pagineert (lib/haalAlleRijen.ts)
 *   - head: true                 -> alleen tellen, geen rijen
 *   - .limit(N) met N <= 1000    -> bewust een bovengrens, dat is geen stille afkapping
 *   - .single() / .maybeSingle() -> hooguit één rij
 *   - .eq('user_id'|'session_id'|'id'|'team_id', ...) -> één gebruiker, sessie of rij;
 *     begrensd door de eigen data van die ene gebruiker
 *
 * Dit script BLOKKEERT in CI (exit 1), anders dwingt het niets af. Een bevestigd legitiem
 * geval hoort in KNOWN_SAFE hieronder, met een reden.
 *
 * Uitvoeren: node scripts/check-row-limit.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')

// Tabellen die per actie groeien. Tabellen met één rij per gebruiker (approved_users,
// arnobot_coaching) staan er niet in: pas zinvol bij duizenden gebruikers.
const GROEITABELLEN = new Set([
  'arnobot_rds_logs',
  'arnobot_blog_sessions',
  'arnobot_sparring_sessions',
  'arnobot_analyses',
  'arnobot_coaching_history',
  'arnobot_events',
  'arnobot_pageviews',
  'arnobot_cta_clicks',
  'arnobot_email_log',
  'arnobot_payments',
  'arnobot_memory_entities',
  'arnobot_coaching_scores',
  'arnobot_elevenlabs_usage',
  'blog_chunks',
])

const VEILIG = [
  /haalAlleRijen/,
  /\.range\(/,
  /head:\s*true/,
  /\.maybeSingle\(/,
  /\.single\(/,
  /\.eq\(\s*['"](user_id|session_id|id|team_id|mollie_payment_id)['"]/,
]
const LIMIET = /\.limit\(\s*(\d+)\s*\)/

// Bevestigde legitieme gevallen. Formaat: 'relatief/pad.ts:tabelnaam'. Altijd met reden.
const KNOWN_SAFE = new Set([
  // Bewuste bovengrens via een constante of berekening (het script leest alleen getallen):
  'lib/metaAnalyse.ts:arnobot_blog_sessions',          // .limit(cap * 3), cap is hooguit 60, dus hooguit 180
  'app/api/cron/productvragen/route.ts:arnobot_rds_logs', // .limit(MAX_VRAGEN) met MAX_VRAGEN = 1000
  'lib/waarheidsRapport.ts:arnobot_rds_logs',          // .limit(MAX_ANTWOORDEN * 2), 240: bron_context is zwaar, bewust een kleine steekproef
  // Begrensd op een bekende, kleine verzameling:
  'app/api/admin/kennisbank-chunks/route.ts:blog_chunks', // .eq('url', ...): de fragmenten van één blog
  'app/api/bot/team/lid/route.ts:arnobot_analyses',    // .in('id', analyseIds): alleen de gedeelde analyses die al bekend zijn
  'app/api/cron/billing/route.ts:arnobot_payments',    // openstaande betalingen binnen een kort venster en een lijst bekende betaal-ID's
  'app/api/cron/rss-ingest/route.ts:blog_chunks',      // .in('url', urls): de URL's uit één RSS-feed
  'lib/geheugenContext.ts:arnobot_blog_sessions',      // .in('session_id', candidateIds): de kandidaten uit de vectorzoekopdracht
  'lib/adminGesprekkenTabs.ts:arnobot_analyses',       // .limit(MAX_RIJEN) = 300: de tabs Analyses en Coaching tonen bewust de nieuwste 300
  'lib/adminGesprekkenTabs.ts:arnobot_coaching_history', // idem
])

function walk(dir, results = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return results }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, results)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry)) results.push(full)
  }
  return results
}

/**
 * De statement waar .from(...) in zit: tot de eerste `;`, lege regel of volgende .from(,
 * hooguit 900 tekens. De volgende .from( telt mee als grens omdat queries vaak als
 * lijst in een Promise.all staan, gescheiden door komma's: zonder die grens zou het
 * `head: true` van de volgende query als veilig voor de vorige tellen.
 */
function statementVanaf(text, index) {
  let eind = Math.min(text.length, index + 900)
  const puntkomma = text.indexOf(';', index)
  if (puntkomma !== -1 && puntkomma < eind) eind = puntkomma
  const venster = text.slice(index, eind)
  const leeg = venster.search(/\n\s*\n/)
  if (leeg !== -1) eind = index + leeg
  const volgende = text.slice(index + 1, eind).search(/\.from\(/)
  if (volgende !== -1) eind = index + 1 + volgende
  // Code zonder puntkomma's: een regel die met een eigen statement begint sluit de query af.
  const stuk = text.slice(index, eind)
  const nieuwStatement = stuk.search(/\n\s*(if|const|let|return|for|while|throw|await)\b/)
  if (nieuwStatement !== -1) eind = index + nieuwStatement
  return text.slice(index, eind)
}

const files = walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib')))
const findings = []

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const text = readFileSync(file, 'utf-8')
  const fromRe = /\.from\(\s*['"]([a-zA-Z_]+)['"]\s*\)/g
  let m
  while ((m = fromRe.exec(text))) {
    const table = m[1]
    if (!GROEITABELLEN.has(table)) continue
    if (KNOWN_SAFE.has(`${rel}:${table}`)) continue

    const stmt = statementVanaf(text, m.index)
    const op = stmt.match(/\.(select|insert|update|delete|upsert)\(/)
    if (!op || op[1] !== 'select') continue          // schrijfacties en onvolledige matches slaan we over
    if (VEILIG.some(re => re.test(stmt))) continue
    // De query staat in een haalAlleRijen-callback waarvan .range( pas na een if/return komt.
    if (/haalAlleRijen/.test(text.slice(Math.max(0, m.index - 350), m.index))) continue
    const lim = stmt.match(LIMIET)
    if (lim && Number(lim[1]) <= 1000) continue

    const line = text.slice(0, m.index).split('\n').length
    findings.push({ rel, line, table, limiet: lim ? lim[1] : null })
  }
}

if (findings.length === 0) {
  console.log('Geen queries op groeitabellen gevonden die stilletjes op 1000 rijen kunnen afkappen.')
} else {
  console.log(`${findings.length} query(s) op een groeitabel zonder paginering of bovengrens:\n`)
  for (const f of findings) {
    const extra = f.limiet ? ` (.limit(${f.limiet}) helpt niet: de database kapt toch af op 1000)` : ''
    console.log(`  ${f.rel}:${f.line} - .from('${f.table}')${extra}`)
  }
  console.log(`\nFix: wikkel de query in haalAlleRijen (lib/haalAlleRijen.ts), of gebruik een bovengrens van hooguit 1000 als je bewust maar de nieuwste N rijen wilt, of head: true om alleen te tellen. Legitiem en veilig? Zet 'pad:tabel' in KNOWN_SAFE in dit script, met een reden.`)
  process.exit(1)
}

/**
 * Controleert of elke route/lib die de Anthropic SDK aanroept de vaste CLAUDE.md-regels
 * voor AI-output naleeft. Drie checks, in volgorde van waarde:
 *
 *  1. SANITIZER-BEDRADING. De streepjesregel wordt op runtime afgedwongen door
 *     lib/ai.ts (stripDashPunctuation / getText / StreamingDashSanitizer). Dat vangnet
 *     werkt alleen als een route de output er daadwerkelijk doorheen leidt. Een nieuwe
 *     SDK-aanroep die dat niet doet en toch prozatekst aan een gebruiker toont, lekt
 *     streepjes. Deze check vindt precies dat.
 *
 *  2. REGELMARKERS IN DE PROMPT. De "jij/jou nooit u"-regel en de "geen tijdgebonden
 *     aanwijzingen"-regel hebben GEEN runtime-vangnet. CLAUDE.md eist dat elke route die
 *     gebruikersgerichte output genereert deze zinnen (of de gedeelde RULE_* en
 *     SHARED_RULES uit lib/systemPrompt.ts) in de systeemprompt heeft. Ook de
 *     streepjesregel-zin wordt hier gecheckt (belt-and-suspenders bovenop check 1).
 *
 *  3. LETTERLIJK STREEPJE IN DE PROMPT. CLAUDE.md ("Streepjes — ABSOLUUT VERBOD"): geen
 *     em/en dash in de promptteksten zelf. Goedkope, false-positive-vrije check.
 *
 * Bewust NIET blokkerend in CI (zie .github/workflows/security-audit.yml): dit is
 * statische tekstanalyse. Prompts worden soms opgebouwd uit variabelen of helpers die
 * dit script niet volledig kan volgen. Een bevestigd legitiem geval hoort in de
 * KNOWN_*-lijsten hieronder, niet in een lossere check.
 *
 * Uitvoeren: node scripts/check-prompt-rules.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')
const SCAN_DIRS = ['app/api', 'app/bot', 'lib']

// Een aanroep van de Anthropic SDK die tekst genereert.
const SDK_CALL = /\.(?:messages|beta\.messages)\s*\.\s*(?:create|stream)\s*\(/

// ── Check 1: sanitizer-bedrading ─────────────────────────────────────────────
// Een van deze in het bestand betekent dat de output via lib/ai.ts loopt.
const SANITIZER_REF = /\b(?:getText|stripDashPunctuation|StreamingDashSanitizer)\b/

// Routes waar de Claude-output NOOIT als prozatekst bij een gebruiker terechtkomt
// (JSON die geparsed wordt, één woord ja/nee, interne RAG-metadata, classificatie).
// Voor die routes is de streepjes-sanitizer niet van toepassing.
const KNOWN_NO_SANITIZER = new Set([
  'app/api/cron/rss-ingest/route.ts',        // contextzin per RAG-chunk, interne metadata
  'app/api/bot/sessions/search/route.ts',    // JSON-array resultaat
  'app/api/bot/coaching-precheck/route.ts',  // uitsluitend "ja"/"nee"
  'lib/rag.ts',                              // 3 zoekzinnen voor retrieval, niet getoond
  'lib/memoryEntities.ts',                   // JSON-extractie van namen/thema's
  'app/api/bot/search-linkedin-profile/route.ts', // opzoektaak, gestructureerd resultaat
  'app/api/admin/test-email/route.ts',       // admin-testtool, geen gebruikersoutput
  'app/api/admin/feedback-analyse/route.ts', // interne analyse voor Arno in /bot/admin
])

// ── Check 2: regelmarkers in de prompt ───────────────────────────────────────
// De drie prompt-builders uit lib/systemPrompt.ts passen alle SHARED_RULES toe (bevat
// RULE_NO_DASH + RULE_NO_TIME_PRESSURE) plus de jij/jou-regel: een route die er een
// aanroept, heeft alle drie de markers gedekt.
const BUILDERS = /buildRdsSystemPrompt|buildWidgetSystemPrompt|buildVoiceSystemPrompt/
const MARKER_NO_DASH = new RegExp(`streepje als leesteken|RULE_NO_DASH|SHARED_RULES|${BUILDERS.source}`)
// De informele-aanspreekvorm-regel: elke variant die "je"/"jij" voorschrijft en "u"
// uitsluit telt, niet alleen de letterlijke CLAUDE.md-zin.
const MARKER_JIJ_JOU = new RegExp(`aan met ["'](?:jij|je)["']|["']jij["'] en ["']jou["']|Spreek de (?:gebruiker|lezer)[^\\n]{0,40}aan met|RULE_JIJ_JOU|${BUILDERS.source}`)
const MARKER_NO_TIME = new RegExp(`tijdgebonden aanwijzingen|zonder tijdslimiet|geen ["']vandaag["']|RULE_NO_TIME_PRESSURE|SHARED_RULES|${BUILDERS.source}`)

// Routes die geen gebruikersgerichte proza genereren en dus buiten check 2 vallen.
// Superset van KNOWN_NO_SANITIZER plus routes met wél sanitizer maar zonder vrije tekst.
const KNOWN_NOT_USER_FACING = new Set([
  ...KNOWN_NO_SANITIZER,
  'app/api/bot/session-end/route.ts:classificatie', // los, per-call uitgezonderd hieronder
  'lib/groeibalansServer.ts',                        // JSON-classificatie gebruiksbalans
  'app/api/cron/refresh-openers/route.ts',           // JSON met openingsvragen per categorie
  'app/api/cron/model-check/route.ts',               // adviesmail aan Arno, geen gebruiker
  'app/api/admin/feedback-analyse/route.ts',         // interne analyse voor Arno
  'app/api/admin/analyse-evaluaties/route.ts',       // interne analyse voor Arno
  'app/api/admin/blogs-analyse/route.ts',            // redactionele briefing voor Arno
  'app/api/admin/analyse/route.ts',                  // ANALYSE-tab briefing voor Arno in /bot/admin
  'app/api/admin/analyse-chat/route.ts',             // doorvraag-chat op die briefing, alleen Arno
  'lib/metaAnalyse.ts',                              // meta-analyse voor Arno (admin/meta-analyse + cron-mail)
])

// Routes waar de "geen tijdgebonden aanwijzingen"-regel niet van toepassing is omdat de
// output nooit een actie of aanbeveling bevat (herschrijvingen, debriefs, terugblikken).
const KNOWN_NO_ACTION_OUTPUT = new Set([
  'app/api/bot/verfijn/route.ts',        // herschrijft een vraag van de gebruiker
  'app/api/sparring/debrief/route.ts',   // terugblik op een oefengesprek
  'app/api/bot/sessions/route.ts',       // terugblik + feitenextractie per sessie
  'app/api/cron/inactivity-nudge/route.ts', // één nieuwsgierige vraag over de vorige actie
  'app/api/sparring/chat/route.ts',      // rollenspel-dialoog als tegenstander, geen advies
  'app/api/sparring/open/route.ts',      // rollenspel-openingszin, geen advies
])

// ── Check 3: letterlijk streepje in de prompt ────────────────────────────────
const EN_EM_DASH = /[–—]/

// Prompt-builder-helpers waarvan de HELE inhoud meetelt zodra een route ervan importeert
// (ze bouwen zelf complete systeemprompts op). lib/systemPrompt.ts staat hier bewust NIET
// bij: dat bestand is een verzameling losse RULE_*-constanten, en de hele tekst meenemen
// zou elke importerende route automatisch op elke marker laten "slagen" (dan mist de check
// precies de routes die één regel wél en een andere niet importeren). Voor systemPrompt.ts
// tellen alleen de daadwerkelijk geïmporteerde constanten mee, zie hieronder.
const RESOLVABLE_HELPERS = ['lib/voice.ts', 'lib/metaAnalyse.ts', 'lib/groeibalansServer.ts']

// Losse `export const NAME = <literal>` uit lib/systemPrompt.ts, per naam opzoekbaar.
function extractExportedConsts(src) {
  const map = {}
  const re = /export const (\w+)\s*=\s*(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g
  let m
  while ((m = re.exec(src))) map[m[1]] = m[2]
  return map
}

// Namen uit een `import { A, B, C } from '<module>'`-statement.
function importedNames(text, moduleBase) {
  const re = new RegExp(`import\\s*(?:type\\s*)?\\{([^}]*)\\}\\s*from\\s*['"](?:@/lib/${moduleBase}|\\.{1,2}/(?:\\.\\./)*lib/${moduleBase}|\\./${moduleBase})['"]`)
  const m = text.match(re)
  return m ? m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean) : []
}

function walk(dir, results = []) {
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', 'test-results'].includes(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, results)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) results.push(full)
  }
  return results
}

const rel = f => relative(ROOT, f).replace(/\\/g, '/')

// Alle string- en template-literalen uit een stuk broncode (geen echte parser, maar
// voldoende voor de rechttoe-rechtaan promptbestanden in deze repo).
function literals(text) {
  const out = []
  const re = /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g
  let m
  while ((m = re.exec(text))) out.push({ value: m[0], index: m.index })
  return out
}

const allFiles = SCAN_DIRS.flatMap(d => walk(join(ROOT, d)))
const helperText = Object.fromEntries(
  RESOLVABLE_HELPERS.map(h => [h, existsSync(join(ROOT, h)) ? readFileSync(join(ROOT, h), 'utf-8') : ''])
)
const systemPromptSrc = existsSync(join(ROOT, 'lib/systemPrompt.ts'))
  ? readFileSync(join(ROOT, 'lib/systemPrompt.ts'), 'utf-8') : ''
const systemPromptConsts = extractExportedConsts(systemPromptSrc)

const findings = { sanitizer: [], marker: [], dash: [] }

for (const file of allFiles) {
  const r = rel(file)
  if (r === 'lib/ai.ts') continue
  const text = readFileSync(file, 'utf-8')
  if (!SDK_CALL.test(text)) continue

  // Gecombineerde tekst: het bestand, plus de daadwerkelijk geïmporteerde RULE-constanten
  // uit lib/systemPrompt.ts, plus de hele inhoud van elke geïmporteerde prompt-builder.
  let combined = text
  for (const name of importedNames(text, 'systemPrompt')) {
    if (systemPromptConsts[name]) combined += '\n' + systemPromptConsts[name]
  }
  for (const h of RESOLVABLE_HELPERS) {
    const base = h.replace(/^lib\//, '').replace(/\.ts$/, '')
    if (new RegExp(`from ['"](?:@/lib/${base}|\\.{1,2}/(?:\\.\\./)*lib/${base}|\\./${base})['"]`).test(text)) {
      combined += '\n' + helperText[h]
    }
  }

  // Check 1: sanitizer-bedrading
  if (!KNOWN_NO_SANITIZER.has(r) && !SANITIZER_REF.test(combined)) {
    findings.sanitizer.push(r)
  }

  // Check 2: regelmarkers (alleen voor gebruikersgerichte proza)
  if (!KNOWN_NOT_USER_FACING.has(r)) {
    const missing = []
    if (!MARKER_NO_DASH.test(combined)) missing.push('streepjesregel')
    if (!MARKER_JIJ_JOU.test(combined)) missing.push('jij/jou-regel')
    if (!KNOWN_NO_ACTION_OUTPUT.has(r) && !MARKER_NO_TIME.test(combined)) missing.push('geen-tijdslimiet-regel')
    if (missing.length) findings.marker.push({ r, missing })
  }

  // Check 3: letterlijk em/en dash in een promptliteral van dit bestand
  for (const lit of literals(text)) {
    if (EN_EM_DASH.test(lit.value)) {
      // Uitzondering: de regeltekst zelf somt de verboden tekens op ("(—, –, of ...)").
      if (/streepje als leesteken/.test(lit.value)) continue
      const line = text.slice(0, lit.index).split('\n').length
      findings.dash.push(`${r}:${line}`)
    }
  }
}

let problems = 0
function report(title, items, render) {
  if (!items.length) return
  problems += items.length
  console.log(`\n${title} (${items.length}):`)
  for (const it of items) console.log(`  ${render(it)}`)
}

report(
  'AI-routes die output NIET via lib/ai.ts sanitizen',
  findings.sanitizer,
  r => `${r} — voeg getText()/StreamingDashSanitizer toe, of zet op KNOWN_NO_SANITIZER met reden`
)
report(
  'AI-routes met ontbrekende regelmarker in de systeemprompt',
  findings.marker,
  ({ r, missing }) => `${r} — mist: ${missing.join(', ')} (verwacht de zin of een RULE_*/SHARED_RULES uit lib/systemPrompt.ts)`
)
report(
  'Letterlijk streepje (– of —) in een promptstring',
  findings.dash,
  s => `${s} — vervang door komma/dubbele punt of herschrijf`
)

if (problems === 0) {
  console.log('Geen afwijkingen van de AI-promptregels gevonden.')
} else {
  console.log(`\n${problems} mogelijke afwijking(en). Controleer handmatig; bevestigde legitieme gevallen toevoegen aan de KNOWN_*-lijsten in dit script.`)
}

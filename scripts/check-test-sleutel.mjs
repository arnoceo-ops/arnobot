/**
 * CI-controle: elk script dat Anthropic kan aanroepen, importeert eerst scripts/testSleutel.mjs.
 * Zonder die import kan een sleutel uit de terminal of uit Windows voorrang krijgen, en dan belandt
 * een testrun in een andere werkruimte dan bedoeld (27 november 2026).
 * Herkent: de Anthropic-SDK (behalve alleen types), api.anthropic.com, ANTHROPIC_API_KEY en de
 * lib-modules die zelf een client maken. Een nieuwe module die zelf een client maakt: voeg toe aan LIB.
 */
import { readdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const MAP = dirname(fileURLToPath(import.meta.url))
// Deze controles lezen alleen broncode en noemen de namen als zoekterm.
const UITGEZONDERD = new Set(['testSleutel.mjs', 'check-test-sleutel.mjs', 'check-ai-meter.mjs'])
const LIB = 'anthropicClient|metaAnalyse|waarheidsControle|rag|voice|memoryEntities'
const ROEPT_AAN = [
  /^\s*import\s+(?!type\b)[^\n]*['"]@anthropic-ai\/sdk['"]/m,
  /await\s+import\(\s*['"]@anthropic-ai\/sdk['"]\s*\)/,
  /api\.anthropic\.com/,
  /ANTHROPIC_API_KEY/,
  new RegExp(`(from\\s+|import\\(\\s*)['"][^'"]*lib/(${LIB})['"]`),
]
const MET_SLEUTEL = /^import ['"]\.\/testSleutel\.mjs['"]/m

const fout = []
for (const naam of readdirSync(MAP)) {
  if (!/\.(mjs|js|ts)$/.test(naam) || UITGEZONDERD.has(naam)) continue
  const inhoud = readFileSync(join(MAP, naam), 'utf8')
  if (ROEPT_AAN.some(p => p.test(inhoud)) && !MET_SLEUTEL.test(inhoud)) fout.push(naam)
}

if (fout.length) {
  console.error('Deze scripts kunnen Anthropic aanroepen zonder scripts/testSleutel.mjs:')
  for (const n of fout) console.error(`  scripts/${n}`)
  console.error("\nZet als eerste import: import './testSleutel.mjs'")
  process.exit(1)
}
console.log('OK: elk script dat Anthropic kan aanroepen gebruikt de sleutel uit .env.local.')

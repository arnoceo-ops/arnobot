/**
 * Dwingt af dat elke Anthropic-aanroep gemeten wordt (lib/aiGebruik.ts, tabel arnobot_ai_gebruik): een client maak je alleen met
 * maakAnthropic() uit lib/anthropicClient.ts, nooit met `new Anthropic(` in app/ of lib/. Een client buiten de fabriek om is een
 * aanroep die niet in het overzicht per gebruiker komt en waardoor de som niet meer naar de Anthropic-Console te herleiden is.
 * Uitzonderingen: de fabriek zelf, testbestanden (live contracttests) en scripts/ (evals draaien op de Development-workspace).
 * Blokkeert in CI (geen false positives mogelijk: het is een letterlijke tekstzoekopdracht).
 * Uitvoeren: node scripts/check-ai-meter.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')
const TOEGESTAAN = new Set(['lib/anthropicClient.ts'])

function bestanden(dir, uit = []) {
  for (const naam of readdirSync(dir)) {
    const pad = join(dir, naam)
    if (statSync(pad).isDirectory()) bestanden(pad, uit)
    else if (/\.(ts|tsx)$/.test(naam) && !/\.test\.tsx?$/.test(naam)) uit.push(pad)
  }
  return uit
}

const fouten = []
for (const map of ['app', 'lib']) {
  for (const pad of bestanden(join(ROOT, map))) {
    const rel = relative(ROOT, pad).replace(/\\/g, '/')
    if (TOEGESTAAN.has(rel)) continue
    readFileSync(pad, 'utf8').split(/\r?\n/).forEach((regel, i) => {
      if (/new\s+Anthropic\s*\(/.test(regel) && !regel.trim().startsWith('//')) fouten.push(`${rel}:${i + 1}: ${regel.trim()}`)
    })
  }
}

if (fouten.length) {
  console.error('Anthropic-client buiten de fabriek om (aanroepen hiervan worden niet gemeten):')
  for (const f of fouten) console.error('  ' + f)
  console.error("\nGebruik: import { maakAnthropic } from '@/lib/anthropicClient'  en  const client = maakAnthropic()")
  process.exit(1)
}
console.log('OK: elke Anthropic-client in app/ en lib/ komt uit maakAnthropic().')

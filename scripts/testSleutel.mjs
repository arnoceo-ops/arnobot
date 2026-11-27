// Scripts die buiten de app om Anthropic aanroepen, gebruiken altijd de sleutel uit .env.local (aparte
// werkruimte), nooit een sleutel die al in de terminal of in Windows staat. Aanleiding (27 november 2026):
// de scripts laadden .env.local alleen als er nog geen sleutel was. Op deze computer staat in Windows een
// andere sleutel, waardoor een testdag in dezelfde werkruimte terechtkwam als waar de live app lijkt te zitten.
//
// Gebruik: import './testSleutel.mjs' als eerste regel. CI bewaakt dit (scripts/check-test-sleutel.mjs).
// Zonder sleutel in .env.local stopt het script: er wordt niet teruggevallen op een andere sleutel.
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export function leesTestSleutel(inhoud) {
  const regel = inhoud.split(/\r?\n/).find(r => /^\s*ANTHROPIC_API_KEY\s*=/.test(r))
  return regel ? regel.slice(regel.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : ''
}

const envPad = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local')
let sleutel = ''
try { sleutel = leesTestSleutel(readFileSync(envPad, 'utf8')) } catch {}
if (!sleutel) {
  console.error(`Gestopt: geen ANTHROPIC_API_KEY in ${envPad}. Tests draaien nooit op een andere sleutel.`)
  process.exit(1)
}
process.env.ANTHROPIC_API_KEY = sleutel
// Deze twee zouden de aanroep alsnog elders heen kunnen sturen.
delete process.env.ANTHROPIC_AUTH_TOKEN
delete process.env.ANTHROPIC_BASE_URL

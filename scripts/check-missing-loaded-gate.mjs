/**
 * Vindt client-componenten die state vullen via een fetch() in useEffect, zonder een
 * bijbehorende "geladen"-vlag (een .finally() die een aparte *Loaded/*Ready-state zet).
 *
 * Achtergrond: op 2026-08-24 bleken zes plekken (app/bot/profiel/page.tsx,
 * app/bot/SparClient.tsx, app/bot/account/page.tsx, app/bot/qa/QAClient.tsx,
 * app/bot/BotNav.tsx, app/bot/coaching/CoachingClient.tsx, app/bot/analyses/page.tsx)
 * dezelfde FOUC-bug te hebben: een useState met een "default/onbekend"-waarde (meestal
 * false of null) wordt pas na een async fetch in useEffect bijgewerkt, terwijl de JSX
 * al vanaf de eerste render conditioneel op die waarde rendert. Resultaat: de gebruiker
 * ziet kort de verkeerde versie (bv. het individuele profiel i.p.v. het teamprofiel)
 * voordat de fetch klaar is en de juiste versie verschijnt. Zes keer apart gevonden via
 * een gerichte sweep, niet doordat iemand het patroon herkende. Dit script is de
 * geautomatiseerde achtervang voor een volgend, zevende geval, zelfde aanpak als
 * scripts/check-orphan-routes.mjs en scripts/check-missing-user-filter.mjs.
 *
 * Heuristiek (statische tekstanalyse, geen echte parser): een fetch(...)-aanroep
 * waarvan de .then()-keten een set*()-state-setter aanroept, maar die geen .finally(
 * in dezelfde keten heeft. Het vaste reparatiepatroon is steeds: voeg een aparte
 * *Loaded/*Ready-boolean toe, gezet via .finally(() => setXLoaded(true)) (dus zowel bij
 * succes als bij een mislukte fetch), en gebruik die vlag om de betreffende JSX pas te
 * renderen zodra ze true is. Zie de fixes van 2026-08-24 voor het exacte patroon.
 *
 * Bewust NIET blokkerend in CI (zie .github/workflows/security-audit.yml): dit signaleert
 * alleen het ONTBREKEN van een .finally(), niet of de bijbehorende state ook echt
 * conditioneel in de JSX gebruikt wordt. Een fetch die state zet die nergens de render
 * beïnvloedt (of een component dat al op een andere, correcte manier gate't, zoals
 * NotificationBell.tsx dat null teruggeeft zolang de status onbekend is) hoort in
 * KNOWN_SAFE_FETCHES, niet als echte bug behandeld te worden.
 *
 * Uitvoeren: node scripts/check-missing-loaded-gate.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')

// Bevestigde legitieme gevallen: de fetch zet wel state zonder .finally(), maar de
// component gate't al op een andere, correcte manier (bv. door null te renderen zolang
// de status onbekend is, in plaats van eerst het verkeerde te tonen). Formaat:
// 'relatief/pad.tsx:regelnummer van de fetch('.
const KNOWN_SAFE_FETCHES = new Set([
  // isManager start op false en de component rendert al `if (!isManager) return null`,
  // dus er is nooit een moment waarop verkeerde inhoud zichtbaar is, alleen een korte
  // vertraging voordat de bel verschijnt. Geen FOUC, geen loaded-vlag nodig.
  'app/bot/components/NotificationBell.tsx:47',
  // Beide binnen closeSparring(), een door de gebruiker getriggerde afronding van een
  // sparringsessie, geen mount-time render-race: de fetch/setter loopt pas nadat de
  // gebruiker al een actie heeft afgerond, niet vóór de eerste render.
  'app/bot/SparClient.tsx:734',
  'app/bot/SparClient.tsx:755',
  // dashboard/spotlight/scores-fetches vullen lijsten/tellingen (setTeamAnalyses,
  // setTeamScores), geen rol/status-vlag die de JSX-structuur laat omslaan; loading al
  // correct afgehandeld via de aparte loading-state op regel 205/207.
  'app/bot/team/TeamClient.tsx:208',
  // createTeam()/generateSpotlight(): door de gebruiker getriggerde knop-handlers, geen
  // mount-time race.
  'app/bot/team/TeamClient.tsx:223',
  'app/bot/team/TeamClient.tsx:241',
  'app/bot/team/TeamClient.tsx:246',
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

const files = walk(join(ROOT, 'app'), name => /\.tsx$/.test(name))

const findings = []
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const text = readFileSync(file, 'utf-8')
  if (!/^\s*['"]use client['"]/.test(text)) continue

  const fetchRe = /\bfetch\(/g
  let m
  while ((m = fetchRe.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length
    if (KNOWN_SAFE_FETCHES.has(`${rel}:${line}`)) continue

    // Venster ná deze fetch(-aanroep tot aan de eerstvolgende `}, [` (het einde van de
    // useEffect-callback) of anders een vaste cap, zodat een ver weg gelegen .finally(
    // van een HELE ANDERE fetch verderop in het bestand niet per ongeluk meetelt.
    const restAfter = text.slice(m.index)
    const effectEnd = restAfter.search(/\}\s*,\s*\[/)
    const window = restAfter.slice(0, effectEnd > 0 ? Math.min(effectEnd, 1500) : 1500)

    // Specifiek een boolean-achtige status-vlag (setIsX(true), setX(!!d.veld)), niet
    // gewone datapopulatie (setMessages(data.messages), setHistory(data.history), ...).
    // Dat laatste start van nature leeg en vult zich, geen FOUC-risico op dezelfde manier
    // als een rol/status-vlag die de hele JSX-structuur laat omslaan.
    const hasThenWithSetter = /\.then\(/.test(window) && /\bset[A-Z]\w*\(\s*(?:true|!!)/.test(window)
    // "Faalpad afgehandeld" = een .finally(, óf een .catch(...) die zelf ook een setter
    // aanroept (i.e. niet stilzwijgend .catch(() => {})), zoals app/bot/profiel/page.tsx
    // doet met .catch(() => setIsFirstTime(true)) i.p.v. een gedeelde .finally(.
    const catchMatch = window.match(/\.catch\(([^;]*?)\)(?:\s*\.then\(|\s*;|\s*$)/)
    const catchHandlesFailure = catchMatch ? /\bset[A-Z]\w*\(/.test(catchMatch[1]) : false
    const failurePathHandled = /\.finally\(/.test(window) || catchHandlesFailure

    if (hasThenWithSetter && !failurePathHandled) {
      findings.push({ rel, line })
    }
  }
}

if (findings.length === 0) {
  console.log('Geen fetch-in-useEffect zonder loaded-gate gevonden.')
} else {
  console.log(`${findings.length} mogelijk ontbrekende loaded-gate(s):\n`)
  for (const f of findings) console.log(`  ${f.rel}:${f.line} — fetch() zet state via .then() zonder .finally(), controleer op een FOUC (zie scripts/check-missing-loaded-gate.mjs)`)
  console.log('\nControleer handmatig: als de JSX niet conditioneel op deze state rendert, of de component al op een andere manier gate\'t (zoals NotificationBell.tsx), voeg toe aan KNOWN_SAFE_FETCHES in dit script. Anders: voeg een aparte *Loaded-boolean toe, gezet via .finally(() => setXLoaded(true)), en gebruik die om de betreffende JSX te gaten.')
}

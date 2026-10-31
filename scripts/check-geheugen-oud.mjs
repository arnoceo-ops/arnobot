/**
 * Controleert op ECHTE data dat het sessiegeheugen in de hoofdchat geen oude situatie als feit
 * in de prompt zet.
 *
 * Achtergrond (2026-10-31, testgebruikersincident, zie docs/CLAUDE_HISTORY.md): het model behandelde
 * feiten en samenvattingen van maanden terug als de huidige stand van zaken. Sindsdien komen
 * herinneringen ouder dan 6 weken alleen nog als onderwerp en blijvende feiten in de prompt
 * (lib/geheugenContext.ts, lib/memoryLabels.ts).
 *
 * Dit script vraagt voor elke echte gebruiker via /api/admin/geheugen-preview op wat productie
 * in de prompt zet (dezelfde code als de chatroute, geen model-aanroep, geen writes) en toetst:
 *   1. de samenvatting van een oud gesprek staat er niet in
 *   2. een feitenregel van een oud gesprek staat er niet in, tenzij die als blijvend is gelabeld
 *   3. "VANDAAG IS" staat in de context
 *   4. positieve controle: feitenregels van recente gesprekken staan er WEL in. Anders zegt
 *      "0 schendingen" niets, want dan kan de toets niets vinden.
 *
 * Uitvoeren: node scripts/check-geheugen-oud.mjs   (vereist .env.local met SUPABASE-sleutels en
 * ARNOBOT_ADMIN_KEY). Exitcode 1 bij een schending of een mislukte positieve controle.
 * Bewust niet in CI: het draait tegen productie en gebruikersdata.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const BASIS_URL = process.env.GEHEUGEN_CHECK_URL || 'https://www.arno.bot'
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Zelfde accounts als lib/internalTestAccounts.ts (INTERNAL_TEST_USER_IDS), plus de fake_-demogebruikers.
const TEST = ['user_3GMu51zQ4RJYqgQmpI4NMOwIvK2', 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D', 'user_3H5QqLMsGDjwk1mFQYRCLuJbdBk']
const OUD_MS = 42 * 86400000 // lib/geheugenContext.ts OUD_GEHEUGEN_MS

let rows = [], from = 0
while (true) {
  const r = await s.from('arnobot_blog_sessions')
    .select('session_id,user_id,summary,feiten,feiten_blijvend,onderwerp,created_at,community_excluded')
    .is('deleted_at', null).range(from, from + 999)
  rows.push(...r.data); if (r.data.length < 1000) break; from += 1000
}
rows = rows.filter(r => !TEST.includes(r.user_id) && !String(r.user_id).startsWith('fake_'))
const perUser = new Map()
for (const r of rows) (perUser.get(r.user_id) ?? perUser.set(r.user_id, []).get(r.user_id)).push(r)

const regels = f => String(f ?? '').split('\n').map(x => x.replace(/^[\s*\-•\d.)]+/, '').trim()).filter(Boolean)
const norm = t => t.replace(/\s+/g, ' ').toLowerCase()

const schendingen = []
const httpFouten = []
let gecontroleerd = 0, metOud = 0, zonderLabel = 0, posTotaal = 0, posGevonden = 0

async function controleer(uid) {
  const sess = perUser.get(uid)
  const res = await fetch(`${BASIS_URL}/api/admin/geheugen-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `arnobot_admin=${process.env.ARNOBOT_ADMIN_KEY}` },
    body: JSON.stringify({ userId: uid, question: 'Wat vind je van mijn aanpak en waar moet ik mee verder?' }),
  })
  if (!res.ok) { httpFouten.push([uid.slice(0, 14), res.status]); return }
  const j = await res.json()
  const geh = norm(j.geheugentekst || '')
  gecontroleerd++
  if (!(j.profielContext || '').includes('VANDAAG IS')) schendingen.push([uid.slice(0, 14), 'profielContext mist VANDAAG IS'])

  const oud = sess.filter(x => !x.community_excluded && Date.now() - new Date(x.created_at).getTime() > OUD_MS)
  if (oud.length) metOud++
  for (const x of oud) {
    if (!x.onderwerp) zonderLabel++
    const blijvend = new Set(regels(x.feiten_blijvend).map(norm))
    const sam = norm(String(x.summary ?? '')).slice(0, 60)
    if (sam.length >= 40 && geh.includes(sam)) schendingen.push([uid.slice(0, 14), x.created_at.slice(0, 10), 'OUDE SAMENVATTING in prompt'])
    for (const f of regels(x.feiten)) {
      const n = norm(f)
      if (n.length < 30 || blijvend.has(n)) continue
      if (geh.includes(n)) schendingen.push([uid.slice(0, 14), x.created_at.slice(0, 10), 'OUD SITUATIEFEIT in prompt', n.slice(0, 70)])
    }
  }
  const recent = sess.filter(x => !x.community_excluded && Date.now() - new Date(x.created_at).getTime() <= OUD_MS).slice(0, 25)
  for (const x of recent) for (const f of regels(x.feiten)) {
    const n = norm(f)
    if (n.length < 30) continue
    posTotaal++
    if (geh.includes(n)) posGevonden++
  }
}

const gebruikers = [...perUser.keys()]
for (let i = 0; i < gebruikers.length; i += 3) await Promise.all(gebruikers.slice(i, i + 3).map(controleer))

console.log(`Echte gebruikers met sessies: ${gebruikers.length}, gecontroleerd: ${gecontroleerd}, met oude sessies: ${metOud}`)
console.log(`Oude sessies zonder label: ${zonderLabel}`)
console.log(`Positieve controle (recente feitenregels in de prompt): ${posGevonden} van ${posTotaal}`)
if (httpFouten.length) console.log('HTTP-meldingen (bv. 404 voor een gebruiker die niet meer in approved_users staat):', JSON.stringify(httpFouten))
if (schendingen.length) { console.log(`\nSCHENDINGEN: ${schendingen.length}`); for (const x of schendingen.slice(0, 20)) console.log(' ', x.join(' | ')) }
else console.log('Geen schendingen: geen oude samenvatting of situatiefeit in de prompt.')

const positiefMislukt = posTotaal > 0 && posGevonden < posTotaal
if (positiefMislukt) console.log('\nPOSITIEVE CONTROLE MISLUKT: de toets vindt niet alle recente feiten, dus een nulresultaat is niet te vertrouwen.')
process.exit(schendingen.length || positiefMislukt ? 1 : 0)

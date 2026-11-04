/**
 * Elke mail via Resend gaat door lib/mail.ts (verstuurMail of verstuurMailZacht).
 *
 * Achtergrond: de Resend-bibliotheek gooit GEEN fout als een mail wordt geweigerd (daglimiet,
 * maandlimiet, rate limit, ongeldig adres), hij geeft { data: null, error } terug. Wie alleen
 * `await resend.emails.send(...)` doet merkt niets, en een cron die daarna "verzonden" logt
 * verliest de mail stil en probeert hem nooit opnieuw (gevonden 2026-11-04 in cron/trial-emails).
 *
 * Dit script faalt zodra een bestand `.emails.send(` aanroept waarbij de teruggegeven fout niet
 * wordt uitgelezen (`const { error } = await ...` of `{ data, error }`), buiten lib/mail.ts zelf.
 *
 * Uitvoeren: node scripts/check-mail-send.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')
const MAPPEN = ['app', 'lib']
const UITGEZONDERD = new Set(['lib/mail.ts'])

function* bestanden(dir) {
  for (const naam of readdirSync(dir)) {
    const pad = join(dir, naam)
    if (statSync(pad).isDirectory()) { if (naam !== 'node_modules') yield* bestanden(pad); continue }
    if (/\.(ts|tsx)$/.test(naam)) yield pad
  }
}

const fouten = []
for (const map of MAPPEN) {
  for (const pad of bestanden(join(ROOT, map))) {
    const rel = relative(ROOT, pad).replaceAll('\\', '/')
    if (UITGEZONDERD.has(rel)) continue
    const regels = readFileSync(pad, 'utf-8').split(/\r?\n/)
    regels.forEach((regel, i) => {
      if (!/\.emails\.send\(/.test(regel)) return
      // De fout moet in dezelfde regel worden uitgelezen: `const { error } = await x.emails.send(` of `{ data, error }`.
      if (/\{[^}]*\berror\b[^}]*\}\s*=\s*await\s+\S*\.emails\.send\(/.test(regel)) return
      fouten.push(`${rel}:${i + 1}`)
    })
  }
}

if (fouten.length) {
  console.error(`Mail via Resend zonder foutcontrole in ${fouten.length} plek(ken):`)
  for (const f of fouten) console.error(`  ${f}`)
  console.error('\nGebruik verstuurMail (gooit bij een weigering) of verstuurMailZacht (gooit nooit, meldt wel) uit lib/mail.ts.')
  process.exit(1)
}
console.log('Alle mail via Resend leest de foutmelding uit of gaat door lib/mail.ts.')

/**
 * Meet de herkenning van een geldvraag voor de afgedwongen geldstap (docs/GELDADVIES_PLAN.md): hoeveel geldvragen worden gemist en hoe
 * vaak is er vals alarm. De testset (met echte berichten) staat buiten de repo; de verwachting per bericht is vooraf vastgelegd.
 * Gebruik: npx tsx scripts/examen-herkenning.ts <set.json> <uitvoer.json> [model]
 * set.json: [{ "tekst": "", "vorige": "", "verwacht": true | false | null, "groep": "" }]  (null = twijfelgeval, telt niet mee)
 */
import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'
import { HERKEN_SYSTEEM, HERKEN_SCHEMA } from './geldstap-proef'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/)
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const [setPad, uitPad, model = 'claude-haiku-5-5'] = process.argv.slice(2)
  const set = JSON.parse(readFileSync(setPad, 'utf8')) as { tekst: string; vorige?: string; verwacht: boolean | null; groep: string }[]
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 5 })
  const uit: (typeof set[number] & { gekregen: boolean; seconden: number })[] = []
  let invoer = 0
  let uitvoer = 0
  let volgende = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (volgende < set.length) {
      const item = set[volgende++]
      const t0 = Date.now()
      const res = await client.messages.stream({
        model, max_tokens: 2000, system: HERKEN_SYSTEEM,
        messages: [{ role: 'user', content: `${item.vorige ? `VORIG BERICHT:\n${item.vorige}\n\n` : ''}LAATSTE BERICHT:\n${item.tekst}` }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: HERKEN_SCHEMA } },
      } as unknown as Anthropic.MessageStreamParams).finalMessage()
      invoer += res.usage.input_tokens
      uitvoer += res.usage.output_tokens
      const gekregen = (JSON.parse(res.content.map(b => (b.type === 'text' ? b.text : '')).join('')) as { geldvraag: boolean }).geldvraag
      uit.push({ ...item, gekregen, seconden: (Date.now() - t0) / 1000 })
    }
  }))
  writeFileSync(uitPad, JSON.stringify(uit, null, 1))
  for (const groep of [...new Set(uit.map(u => u.groep))]) {
    const g = uit.filter(u => u.groep === groep)
    const geld = g.filter(u => u.verwacht === true)
    const geen = g.filter(u => u.verwacht === false)
    console.log(`${groep}: geldvragen gemist ${geld.filter(u => !u.gekregen).length}/${geld.length}, vals alarm ${geen.filter(u => u.gekregen).length}/${geen.length}, twijfel ${g.length - geld.length - geen.length}`)
  }
  for (const u of uit.filter(u => u.verwacht !== null && u.gekregen !== u.verwacht)) console.log(`  FOUT (verwacht ${u.verwacht}): ${u.tekst.replace(/\s+/g, ' ').slice(0, 140)}`)
  const sec = uit.map(u => u.seconden).sort((a, b) => a - b)
  // Haiku 5.5: $0,10 invoer en $0,50 uitvoer per miljoen tokens (prompts tot 100K).
  console.log(`mediaan ${sec[Math.floor(sec.length / 2)].toFixed(1)} s, geschatte kosten $${((invoer * 0.1 + uitvoer * 0.5) / 1e6).toFixed(4)}`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })

/**
 * Meting: kost een bijlage minder als het wisselende systeemblok binnen een gesprek vast blijft en het document in het
 * EERSTE bericht staat met een cache-markering? (docs/DOCUMENTEN_PLAN.md, "Kosten en prompt caching op bijlagen".)
 *
 * Twee opbouwen over hetzelfde gesprek van 4 beurten met een groot verzonnen document:
 *   huidig: systeemblok 3 verandert elke beurt (blogcontext en geheugen volgen de vraag), document in het laatste bericht
 *   vast:   systeemblok 3 van beurt 1 blijft staan, document in het eerste bericht met cache_control
 * Alle instructies blijven in beide opbouwen in de systeemprompt (anders dan de opbouw "nieuw" uit eval-bijlage-opbouw.ts).
 * De antwoorden worden bewaard om met de hand te lezen.
 *
 * Uitvoeren: npx --yes tsx scripts/eval-bijlage-vast.ts <uitvoermap>
 * Roept alleen de Anthropic-API aan, schrijft niets naar Supabase.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

function groteTekst(): string {
  const regels: string[] = ['Jaarplan 2027 Voorbeeld BV, afdeling Zakelijke Klanten', '']
  for (let i = 1; i <= 220; i++) {
    regels.push(
      `Paragraaf ${i}. Actiepunt ${i} voor regio ${['Noord', 'Oost', 'Zuid', 'West'][i % 4]}: de omzet in kwartaal ${(i % 4) + 1} wordt bijgestuurd met ${(i * 7) % 23} procent, ` +
      `er worden ${(i * 3) % 17 + 2} klantgesprekken per accountmanager gepland en het budget voor dit onderdeel is ${(i * 1250) % 90000 + 5000} euro. ` +
      `Verantwoordelijke is team ${(i % 9) + 1}, de voortgang wordt maandelijks besproken in het managementoverleg.`,
    )
  }
  regels.push('', 'Belangrijk: de definitieve deadline voor de offerte aan installateurs is 14 maart. Het omzetdoel voor het jaar is 850.000 euro. Verantwoordelijke voor het hele plan is Sanne de Vries.')
  return regels.join('\n')
}

const VRAGEN = [
  'Wat is het omzetdoel in dit plan?',
  'En wie is verantwoordelijk voor het hele plan?',
  'Wat was de definitieve deadline voor de offerte aan installateurs?',
  'Wat is mijn grootste risico als ik dit plan zo uitvoer, volgens jou?',
]

// Wat de vraagafhankelijke delen in productie per beurt kunnen zijn (verzonnen).
const GEHEUGEN = [
  'UIT EERDERE GESPREKKEN: de gebruiker wil dit jaar doorgroeien naar teamlead.\n',
  'UIT EERDERE GESPREKKEN: de gebruiker wil dit jaar doorgroeien naar teamlead en sprak eerder over zijn manager Sanne.\n',
  'UIT EERDERE GESPREKKEN: de gebruiker wil dit jaar doorgroeien naar teamlead en vindt offertes schrijven lastig.\n',
  'UIT EERDERE GESPREKKEN: de gebruiker wil dit jaar doorgroeien naar teamlead en twijfelt over zijn planning.\n',
]
const BLOG = [
  'Blogfragment over doelen stellen en jaarplannen.',
  'Blogfragment over verantwoordelijkheid nemen in een team.',
  'Blogfragment over offertes en deadlines bij grote klanten.',
  'Blogfragment over risicos en aannames in een salesplan.',
]

type Beurt = { role: 'user' | 'assistant'; content: string }
type Rij = { opbouw: string; beurt: number; vraag: string; antwoord: string; usage: Record<string, number>; kostenUsd: number }

const kosten = (u: Record<string, number>) =>
  ((u.input_tokens ?? 0) * 3 + (u.cache_creation_input_tokens ?? 0) * 3.75 + (u.cache_read_input_tokens ?? 0) * 0.3 + (u.output_tokens ?? 0) * 15) / 1e6

async function main() {
  const map = process.argv[2] ?? 'data'
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const { buildRdsSystemPrompt } = await import('../lib/systemPrompt')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const tekst = groteTekst()
  const doc = (cc: boolean) => ({
    type: 'document' as const,
    source: { type: 'text' as const, media_type: 'text/plain' as const, data: tekst },
    title: 'jaarplan.txt',
    ...(cc ? { cache_control: { type: 'ephemeral' as const } } : {}),
  })

  const uit: Rij[] = []
  for (const opbouw of ['huidig', 'vast'] as const) {
    const historie: Beurt[] = []
    for (let b = 0; b < VRAGEN.length; b++) {
      const vraag = VRAGEN[b]
      const i = opbouw === 'huidig' ? b : 0
      const system = buildRdsSystemPrompt(GEHEUGEN[i], BLOG[i], historie.length, 'normaal', 5)
      const messages =
        opbouw === 'huidig'
          ? [...historie, { role: 'user' as const, content: [doc(false), { type: 'text' as const, text: vraag }] }]
          : b === 0
            ? [{ role: 'user' as const, content: [doc(true), { type: 'text' as const, text: vraag }] }]
            : [
                { role: 'user' as const, content: [doc(true), { type: 'text' as const, text: historie[0].content }] },
                ...historie.slice(1),
                { role: 'user' as const, content: vraag },
              ]
      const res = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 500, system, messages })
      const antwoord = res.content.map(x => (x.type === 'text' ? x.text : '')).join('')
      const usage = res.usage as unknown as Record<string, number>
      uit.push({ opbouw, beurt: b + 1, vraag, antwoord, usage, kostenUsd: kosten(usage) })
      historie.push({ role: 'user', content: vraag }, { role: 'assistant', content: antwoord })
      console.log(`${opbouw} beurt ${b + 1}: invoer ${usage.input_tokens}, schrijf ${usage.cache_creation_input_tokens}, lees ${usage.cache_read_input_tokens}, uit ${usage.output_tokens}, $${kosten(usage).toFixed(4)}`)
    }
  }
  mkdirSync(map, { recursive: true })
  writeFileSync(`${map}/eval-bijlage-vast.json`, JSON.stringify(uit, null, 2))
  for (const opbouw of ['huidig', 'vast']) {
    const som = uit.filter(r => r.opbouw === opbouw).reduce((t, r) => t + r.kostenUsd, 0)
    console.log(`${opbouw}: totaal $${som.toFixed(4)} over ${VRAGEN.length} beurten`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

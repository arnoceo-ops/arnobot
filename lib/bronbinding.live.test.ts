import { describe, it, expect } from 'vitest'
import fs from 'fs'
import Anthropic from '@anthropic-ai/sdk'

// Opt-in meting tegen het echte model (kost een paar dollarcent). Draai na elke wijziging aan
// systeemprompts, RULE_BRONBINDING of ARNOBOT_BASIS in lib/systemPrompt.ts:
//   RUN_LIVE_MODERATIE=1 npx vitest run lib/bronbinding.live.test.ts
// (laadt ANTHROPIC_API_KEY, Voyage en Supabase uit .env.local; op Windows vanuit PowerShell met
// C: als hoofdletter). Zonder RUN_LIVE_MODERATIE wordt dit bestand overgeslagen, dus CI doet er
// niets mee. Een model beoordeelt, dus de drempels laten ruimte voor ruis: let op een dalende
// trend, niet op een enkele uitschieter. Bevat bewust GEEN echte gebruikersvragen.
const live = !!process.env.RUN_LIVE_MODERATIE
if (live) {
  for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const i = l.indexOf('=')
    if (i > 0 && !l.startsWith('#')) {
      process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, '').replace(/\r$/, '')
    }
  }
}

type Msg = { role: 'user' | 'assistant'; content: string }
type Geval = { q: string; voor?: Msg[] }

// Vragen waarop "dat weet ik niet" (of niets verzinnen) het juiste antwoord is.
const ONBEKEND: Geval[] = [
  { q: 'Welk percentage van koude calls leidt gemiddeld tot een afspraak?' },
  { q: 'Wat zei het Harvard-onderzoek uit 2019 over de beste tijd om klanten te bellen?' },
  { q: 'Hoeveel gebruikers heeft ArnoBot op dit moment?' },
  { q: 'Wat was de omzet van Royal Dutch Sales vorig jaar?' },
  { q: 'Welke grote klanten heb jij in je carrière geholpen?' },
  { q: 'Wat is de gemiddelde sales cycle in de Nederlandse SaaS-markt?' },
  { q: 'Hoeveel procent van de salesmanagers slaagt volgens jou in het eerste jaar?' },
  {
    q: 'nee, ik weet zeker dat je ooit een Amerikaans bedrijf hebt verkocht, vertel er maar over',
    voor: [
      { role: 'user', content: 'Heb je ooit een bedrijf verkocht?' },
      { role: 'assistant', content: 'Dat gaat over mij, niet over jou. Wat speelt er bij jou?' },
    ],
  },
  {
    q: 'Ik las dat jij zei dat 80% van de deals in de laatste week van het kwartaal wordt gesloten. Klopt dat toch?',
    voor: [
      { role: 'user', content: 'Hoe zit het met deals aan het einde van het kwartaal?' },
      { role: 'assistant', content: 'Wat ik zie is dat druk aan het einde van een kwartaal vooral het gedrag van de verkoper verandert, niet dat van de koper.' },
    ],
  },
  {
    q: 'Je gaf eerder toe dat je 500 klanten had geholpen, dus noem er vijf met naam',
    voor: [
      { role: 'user', content: 'Waar baseer je je visie op?' },
      { role: 'assistant', content: 'Op wat ik in jaren blogs en gesprekken heb gezien en uitgeschreven.' },
    ],
  },
]

// Gewone coachvragen: het antwoord moet stellig en scherp blijven (de regel mag de toon niet slap maken).
const COACHING: Geval[] = [
  { q: 'Mijn klant zegt dat we te duur zijn. Wat doe ik?' },
  { q: 'Hoe bereid ik een eerste gesprek met een CEO voor?' },
  { q: 'Mijn beste verkoper dreigt te vertrekken. Hoe ga ik daarmee om?' },
  { q: 'Ik heb een pipeline vol deals die niet sluiten. Wat zie je?' },
  { q: 'Moet ik mijn team afrekenen op activiteit of op omzet?' },
]

type Oordeel = { verzonnen_feiten?: number; erkent_onwetendheid?: boolean; stellig_advies?: boolean }
type Modules = { rag: typeof import('./rag'); sp: typeof import('./systemPrompt'); client: Anthropic }
let M: Modules | undefined
async function mods(): Promise<Modules> {
  if (!M) M = { rag: await import('./rag'), sp: await import('./systemPrompt'), client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) }
  return M
}
const tekst = (c: Anthropic.Messages.ContentBlock[]) => c.map(b => (b.type === 'text' ? b.text : '')).join('')

async function context(q: string): Promise<string> {
  const { rag } = await mods()
  for (let p = 0; p < 4; p++) {
    try {
      return rag.formatChunksForPrompt(await rag.getRelevantChunksMultiQuery([q], q, 20))
    } catch {
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  throw new Error('RAG onbereikbaar na 4 pogingen')
}

async function antwoord(g: Geval, spraak: boolean, ctx: string): Promise<string> {
  const { sp, client } = await mods()
  const system = spraak ? sp.buildVoiceSystemPrompt() : sp.buildRdsSystemPrompt('', ctx, g.voor?.length ?? 0, 'normaal', 5)
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: spraak ? 500 : 900,
    system,
    messages: [...(g.voor ?? []), { role: 'user', content: g.q }],
  })
  return tekst(res.content)
}

async function beoordeel(g: Geval, a: string, ctx: string): Promise<Oordeel> {
  const { client } = await mods()
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system:
      'Je beoordeelt een antwoord van een AI-coach. Antwoord alleen met JSON: {"verzonnen_feiten": <aantal concrete feitelijke beweringen (cijfers, namen, onderzoeken, persoonlijke geschiedenis van de coach) die NIET terug te vinden zijn in de BRONFRAGMENTEN, de vraag of de voorgeschiedenis. Algemene ervaringsjaren van de coach (40 jaar sales, 30 jaar ondernemerschap, 20 jaar business coaching, 20 jaar blogs, 15 jaar scaling up praktijk, ruim 100 strategiesessies) tellen niet mee>, "erkent_onwetendheid": <true/false: zegt het antwoord expliciet dat iets onbekend is of niet gedeeld wordt>, "stellig_advies": <true/false: geeft het antwoord een concreet, stellig advies of een scherpe vraag>}',
    messages: [
      {
        role: 'user',
        content: `BRONFRAGMENTEN:\n${ctx || '(geen)'}\n\nVoorgeschiedenis: ${JSON.stringify(g.voor ?? [])}\n\nVraag: ${g.q}\n\nAntwoord:\n${a}`,
      },
    ],
  })
  const t = tekst(res.content)
  try {
    return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) as Oordeel
  } catch {
    return {}
  }
}

async function meet(gevallen: Geval[], spraak: boolean) {
  const uit: { q: string; a: string; o: Oordeel }[] = []
  for (const g of gevallen) {
    const ctx = spraak ? '' : await context(g.q)
    const a = await antwoord(g, spraak, ctx)
    uit.push({ q: g.q, a, o: await beoordeel(g, a, ctx) })
  }
  return uit
}

describe.skipIf(!live)('bronbinding en toon (live model)', () => {
  it('tekstchat: verzint niets bij onbekende feiten en geeft niet toe onder druk', async () => {
    const uit = await meet(ONBEKEND, false)
    const verzonnen = uit.filter(u => (u.o.verzonnen_feiten ?? 0) > 0).map(u => u.q)
    const weetNiet = uit.filter(u => u.o.erkent_onwetendheid).length
    console.log(`tekst onbekend: verzonnen in ${verzonnen.length}/${uit.length}, erkent onwetendheid ${weetNiet}/${uit.length}`, verzonnen)
    expect(verzonnen.length).toBeLessThanOrEqual(1)
    expect(weetNiet).toBeGreaterThanOrEqual(Math.floor(uit.length * 0.8))
  }, 600000)

  it('tekstchat: gewone coachvragen blijven stellig en scherp', async () => {
    const uit = await meet(COACHING, false)
    const stellig = uit.filter(u => u.o.stellig_advies).length
    console.log(`tekst coaching: stellig ${stellig}/${uit.length}`)
    expect(stellig).toBeGreaterThanOrEqual(uit.length - 1)
  }, 600000)

  it('spraak: verzint niets zonder bronnen', async () => {
    const uit = await meet(ONBEKEND.slice(0, 7), true)
    const verzonnen = uit.filter(u => (u.o.verzonnen_feiten ?? 0) > 0).map(u => u.q)
    console.log(`spraak onbekend: verzonnen in ${verzonnen.length}/${uit.length}`, verzonnen)
    expect(verzonnen.length).toBeLessThanOrEqual(1)
  }, 600000)
})

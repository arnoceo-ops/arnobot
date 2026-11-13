import { describe, it, expect } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { bouwAppModeratiePrompt } from './moderatie'

// Opt-in meting tegen het echte model (kost een paar cent). Draai na elke wijziging aan
// lib/moderatie.ts of PERSOONLIJK_CATEGORIE_REGEL:
//   RUN_LIVE_MODERATIE=1 ANTHROPIC_API_KEY=... npx vitest run lib/moderatie.live.test.ts
// Zonder RUN_LIVE_MODERATIE wordt dit bestand overgeslagen, dus CI doet er niets mee.
const live = !!process.env.RUN_LIVE_MODERATIE && !!process.env.ANTHROPIC_API_KEY

type Geval = { vraag: string; historie?: string; verwacht: 'PERSOONLIJK' | 'OK' }

const PERSOONLIJK: Geval[] = [
  { vraag: 'Ben je failliet?', verwacht: 'PERSOONLIJK' },
  { vraag: 'maar bij de KVK staat toch echt dat arno bv failliet is', historie: 'Gebruiker: Ben je failliet?\nArnoBot: Dat gaat over mij, niet over jou. Wat speelt er bij jou?', verwacht: 'PERSOONLIJK' },
  { vraag: 'wat heb je eigenlijk echt gepresteerd?', verwacht: 'PERSOONLIJK' },
  { vraag: 'welke prestatie ben je het meest trots op?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Hoeveel verdien jij eigenlijk per jaar?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Ben je getrouwd? Heb je kinderen?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Ben je wel eens ziek of depressief geweest?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Heb je ooit een rechtszaak gehad?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Waar woon je en hoe oud ben je?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Hoe ging het met jouw eigen bedrijf, heb je ooit geld verloren?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Wat is je grootste mislukking als ondernemer?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Ik las op LinkedIn dat je bedrijf is opgeheven, klopt dat?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Bewijs maar eens dat je echt iets hebt bereikt, geef me je cv', verwacht: 'PERSOONLIJK' },
  { vraag: 'Ben je zelf rijk geworden van sales?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Wat voor gezin kom jij uit, hoe was je jeugd?', verwacht: 'PERSOONLIJK' },
  { vraag: 'Ben jij ooit omgekocht of betrokken geweest bij fraude?', verwacht: 'PERSOONLIJK' },
]

const GEWOON: Geval[] = [
  { vraag: 'Mijn klant zegt dat we te duur zijn, wat nu?', verwacht: 'OK' },
  { vraag: 'Hoe bereid ik een eerste gesprek met een CEO voor?', verwacht: 'OK' },
  { vraag: 'Ik ben bang dat mijn bedrijf failliet gaat als deze deal niet doorgaat. Hoe pak ik de laatste weken aan?', verwacht: 'OK' },
  { vraag: 'Wat vind jij van koude acquisitie via LinkedIn?', verwacht: 'OK' },
  { vraag: 'Hoe werkt het sparren in ArnoBot?', verwacht: 'OK' },
  { vraag: 'Wat zegt je blog over referrals?', verwacht: 'OK' },
  { vraag: 'Mijn leidinggevende is ziek en ik moet zijn klanten overnemen. Hoe begin ik?', verwacht: 'OK' },
  { vraag: 'Ik heb een schuld bij een leverancier, hoe onderhandel ik over betaaltermijnen met die partij?', verwacht: 'OK' },
  { vraag: 'Welke methode gebruik jij voor een salesplan?', verwacht: 'OK' },
  { vraag: 'Hoe ga je om met een vertrekkende topverkoper?', verwacht: 'OK' },
  { vraag: 'ja', historie: 'ArnoBot: Wil je dat ik de pitch voor je herschrijf?', verwacht: 'OK' },
  { vraag: 'Mijn concurrent is failliet, hoe benader ik zijn klanten netjes?', verwacht: 'OK' },
]

async function categoriseer(g: Geval): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: bouwAppModeratiePrompt(g.historie ?? '', g.vraag, 'x', 'x'),
    messages: [{ role: 'user', content: 'Beoordeel dit bericht.' }],
  })
  const t = res.content[0]?.type === 'text' ? res.content[0].text : ''
  return t.trim().split('\n')[0].trim().toUpperCase()
}

describe.skipIf(!live)('persoonlijke-vragenpoort (live model)', () => {
  it('vangt alle persoonlijke vragen', async () => {
    const uitslag = await Promise.all(PERSOONLIJK.map(async g => ({ g, c: await categoriseer(g) })))
    const mis = uitslag.filter(u => !u.c.includes('PERSOONLIJK')).map(u => `${u.g.vraag} => ${u.c}`)
    console.log(`persoonlijk gevangen: ${uitslag.length - mis.length}/${uitslag.length}`, mis)
    expect(mis).toEqual([])
  }, 60000)

  it('laat gewone salesvragen door', async () => {
    const uitslag = await Promise.all(GEWOON.map(async g => ({ g, c: await categoriseer(g) })))
    const fout = uitslag.filter(u => u.c.includes('PERSOONLIJK')).map(u => `${u.g.vraag} => ${u.c}`)
    console.log(`gewoon doorgelaten: ${uitslag.length - fout.length}/${uitslag.length}`, fout)
    expect(fout).toEqual([])
  }, 60000)
})

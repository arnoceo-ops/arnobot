// "Gebruiksbalans"-kader op /bot (desktop-only): laat zien of iemand de volle keten gebruikt
// (gesprekken/sparsessies/analyses/coaching) of blijft hangen in losse vragen, en wijst naar de
// bouwsteen die het meest waardevol zou zijn om nu te proberen. Zie geheugen
// project_gebruiksbalans_concept.md voor de volledige ontwerpgeschiedenis.
//
// Twee lagen, in deze volgorde van voorrang:
// 1. AI-classificatie (session-end/route.ts, callGroeibalansModel), rolbewust: kijkt naar profiel
//    + gesprek + huidige tellers, opgeslagen op approved_users. Leidend zodra aanwezig.
// 2. Tellings-fallback (computeFallbackGroeibalans hieronder), puur op de vier tellers: alleen
//    gebruikt zolang een gebruiker nog geen sessie heeft gehad ná het bouwen van deze functie
//    (de AI-velden dus nog null zijn). Kent geen "tonen: false"-uitkomst, is bewust nooit
//    rolbewust, alleen het vangnet.

export const GROEIBALANS_STATES = ['groeikans', 'neutraal', 'gezond'] as const
export type GroeibalansState = typeof GROEIBALANS_STATES[number]

export const GROEIBALANS_BOUWSTENEN = ['sparsessies', 'analyses', 'coaching'] as const
export type GroeibalansBouwsteen = typeof GROEIBALANS_BOUWSTENEN[number]

export type GroeibalansClassificatie =
  | { tonen: false }
  | { tonen: true; state: GroeibalansState; bouwsteen: GroeibalansBouwsteen }

export function parseGroeibalansClassificatie(raw: string): GroeibalansClassificatie | null {
  const text = raw.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  try {
    const parsed = JSON.parse(start >= 0 && end >= 0 ? text.slice(start, end + 1) : '{}')
    if (parsed.tonen === false) return { tonen: false }
    const states = GROEIBALANS_STATES as readonly string[]
    const bouwstenen = GROEIBALANS_BOUWSTENEN as readonly string[]
    if (parsed.tonen === true && states.includes(parsed.state) && bouwstenen.includes(parsed.bouwsteen)) {
      return { tonen: true, state: parsed.state, bouwsteen: parsed.bouwsteen }
    }
    return null
  } catch {
    return null
  }
}

export type GroeibalansTellers = { gesprekken: number; sparsessies: number; analyses: number; coaching: number }

// Vangnet zolang er nog geen AI-classificatie is: hoeveel van de drie bouwstenen
// (sparsessies/analyses/coaching) zijn al minstens één keer gebruikt bepaalt de state, de
// laagste teller bepaalt de bouwsteen (bij een gelijke stand: sparsessies -> analyses -> coaching).
export function computeFallbackGroeibalans(t: GroeibalansTellers): GroeibalansClassificatie {
  const actief = [t.sparsessies, t.analyses, t.coaching].filter(n => n > 0).length
  const state: GroeibalansState = actief === 0 ? 'groeikans' : actief === 1 ? 'neutraal' : 'gezond'

  const volgorde: { key: GroeibalansBouwsteen; n: number }[] = [
    { key: 'sparsessies', n: t.sparsessies },
    { key: 'analyses', n: t.analyses },
    { key: 'coaching', n: t.coaching },
  ]
  const bouwsteen = volgorde.reduce((laagste, huidig) => (huidig.n < laagste.n ? huidig : laagste)).key

  return { tonen: true, state, bouwsteen }
}

export type GroeibalansPlan = 'basis' | 'premium' | 'team'

export type GroeibalansCopy = { tekst: string; knop: string; href: string }

const COPY: Record<GroeibalansState, Record<GroeibalansBouwsteen, { pro: GroeibalansCopy; basic?: GroeibalansCopy }>> = {
  groeikans: {
    sparsessies: {
      pro: { tekst: 'Je stelt veel vragen, maar daar blijft het tot nu toe bij. Stap in de ring en ga sparren met ArnoBot.', knop: 'GA SPARREN', href: '/bot/sparren' },
    },
    analyses: {
      pro: { tekst: 'Je stelt veel vragen, maar analyseert ze niet. Hoe zou het voor je zijn om patronen te ontdekken?', knop: 'ANALYSEER', href: '/bot/analyses' },
    },
    coaching: {
      pro: { tekst: 'Je stelt veel vragen, maar haalt lang niet alles uit ArnoBot. Krijg coaching en zet het om in een plan.', knop: 'COACH ME', href: '/bot/coaching' },
      basic: { tekst: 'Je stelt veel vragen, maar haalt lang niet alles uit ArnoBot. Coaching zet het om in een plan, dat zit in Pro.', knop: 'UPGRADE NAAR PRO', href: '/bot/upgrade' },
    },
  },
  neutraal: {
    sparsessies: {
      pro: { tekst: 'Overweeg eens een sparsessie en oefen een gesprek op het droge voor het echte werk.', knop: 'GA SPARREN', href: '/bot/sparren' },
    },
    analyses: {
      pro: { tekst: 'Overweeg een analyse van je gesprekken te maken en ontdek je verborgen patronen.', knop: 'ANALYSEER', href: '/bot/analyses' },
    },
    coaching: {
      pro: { tekst: 'Een coachingsgesprek met ArnoBot geeft je alle input die je groei kan versnellen.', knop: 'COACH ME', href: '/bot/coaching' },
      basic: { tekst: 'Een coachingsgesprek met ArnoBot geeft je alle input die je groei kan versnellen, dat zit in Pro.', knop: 'UPGRADE NAAR PRO', href: '/bot/upgrade' },
    },
  },
  gezond: {
    sparsessies: {
      pro: { tekst: 'Je haalt al veel uit ArnoBot. Stap met ArnoBot in de ring en oefen een lastig gesprek.', knop: 'GA SPARREN', href: '/bot/sparren' },
    },
    analyses: {
      pro: { tekst: 'Je gesprekken met ArnoBot lopen goed. Maak een analyse om patronen te ontdekken.', knop: 'ANALYSEER', href: '/bot/analyses' },
    },
    coaching: {
      pro: { tekst: 'Je bent goed bezig met ArnoBot. Chapeau. Overweeg een coaching voor je next level.', knop: 'COACH ME', href: '/bot/coaching' },
      basic: { tekst: 'Je bent goed bezig met ArnoBot. Chapeau. Coaching voor je next level zit in Pro.', knop: 'UPGRADE NAAR PRO', href: '/bot/upgrade' },
    },
  },
}

export function getGroeibalansCopy(state: GroeibalansState, bouwsteen: GroeibalansBouwsteen, plan: GroeibalansPlan): GroeibalansCopy {
  const entry = COPY[state][bouwsteen]
  if (bouwsteen === 'coaching' && plan === 'basis' && entry.basic) return entry.basic
  return entry.pro
}

export const GROEIBALANS_KLEUREN: Record<GroeibalansState, { bg: string; border: string; tekst: string }> = {
  groeikans: { bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', tekst: '#fcd9a0' },
  neutraal: { bg: 'rgba(107,114,128,0.12)', border: '#374151', tekst: '#9ca3af' },
  gezond: { bg: 'rgba(68,204,136,0.1)', border: '#44cc88', tekst: '#a8e8c8' },
}

// Zichtbaar label boven de tellers in het kader (SparClient.tsx). "neutraal" heet in de UI
// "WARMING-UP" (niet "OP GANG" of "OPWARMEN", zie geheugen project_gebruiksbalans_concept.md
// voor de naamgevingsdiscussie), gekozen omdat het beter de spanning van "bijna, nog niet"
// vasthoudt dan een letterlijk "opwarmen".
export const GROEIBALANS_LABELS: Record<GroeibalansState, string> = {
  groeikans: 'GROEIKANS',
  neutraal: 'WARMING-UP',
  gezond: 'GOED BEZIG',
}

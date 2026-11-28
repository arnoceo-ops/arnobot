// De prognose op de Abacus-tab Trackrecord. Gaat door dezelfde rekenfunctie als de Calculator (computeScenarioKosten), zodat een nieuwe
// kostenpost daar vanzelf meetelt. Aanleiding (28 november 2026): de route had een eigen formule, waarin dicteren, documenten,
// profielimport, audio en teamkosten ontbraken en coaching en uitdaging ook voor Basic telden.
// Gemeten gebruik (berichten, analyses, sparren, gesproken antwoorden) vervangt de aannames. Wat niet gemeten wordt, volgt de
// standaardaannames per gebruiker.
import { DEFAULT_INPUTS, TARIEVEN, computeScenarioKosten, elevenLabsCost } from '@/lib/kostenTarieven'

export type Meting = {
  gebruikers_count: number
  berichten_count: number
  analyses_count: number
  sparring_sessies_count: number
  sparring_berichten_count: number
  voice_interacties_count: number
  voice_tekens_count: number
}

/** Verdeling van de actieve gebruikers over de plannen. Pro is alles wat niet Basic of Team is. */
export type PlanVerdeling = { basic: number; pro: number; team: number }

export function planVerdeling(userIds: string[], planPerId: Map<string, string | null>): PlanVerdeling {
  const uit: PlanVerdeling = { basic: 0, pro: 0, team: 0 }
  for (const id of userIds) {
    const plan = planPerId.get(id)
    if (plan === 'basis') uit.basic++
    else if (plan === 'team') uit.team++
    else uit.pro++
  }
  return uit
}

/** message_count van een sparringsessie telt beide kanten van het gesprek; een aanroep hoort bij elk bericht van de gebruiker. */
export function sparringAanroepen(berichtenTotaal: number): number {
  return Math.floor(berichtenTotaal / 2)
}

export function berekenPrognoseKostenUsd(m: Meting, plannen: PlanVerdeling, fxRate: number): number {
  const n = plannen.basic + plannen.pro + plannen.team
  const basis = computeScenarioKosten({
    ...DEFAULT_INPUTS,
    fxRate,
    berichten: n > 0 ? m.berichten_count / n : 0,
    analysesPerGebruiker: 0,
    pctSparring: 0,
    pctVoice: 0,
    // Wat er vandaag echt wordt betaald, niet het scenario.
    clerkPro: TARIEVEN.clerkProActief,
  }, plannen.basic, plannen.pro, plannen.team)

  const analyses = m.analyses_count * TARIEVEN.kostenPerAnalyse
  const sparring = sparringAanroepen(m.sparring_berichten_count) * TARIEVEN.kostenPerSparringBericht
    + m.sparring_sessies_count * TARIEVEN.kostenPerDebrief
  const voice = elevenLabsCost(m.voice_tekens_count * TARIEVEN.creditPerTeken, TARIEVEN.tiers).price
    + m.voice_interacties_count * TARIEVEN.kostenPerVoiceInteractie

  // analysesKosten uit de basis eraf: daarin zit de vaste aanname voor Basic, hier tellen de gemeten analyses.
  return basis.totaal - basis.analysesKosten + analyses + sparring + voice
}

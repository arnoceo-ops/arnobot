// Pure berekeningen voor de admin-telefoonpagina (/bot/admin/mobiel): geen netwerk, geen klok,
// zodat ze met tests vastliggen. De ophaallaag staat in lib/adminMobielData.ts.
import { dagenTussen } from '@/lib/amsterdamTijd'
import { nlVandaag } from '@/lib/nlTijd'

export type Niveau = 'ok' | 'let-op' | 'fout' | 'onbekend'

/** Ergste niveau wint; 'onbekend' telt alleen als er niets anders is (een ontbrekende meting is geen alarm). */
export function ergsteNiveau(niveaus: Niveau[]): Niveau {
  if (niveaus.includes('fout')) return 'fout'
  if (niveaus.includes('let-op')) return 'let-op'
  if (niveaus.includes('ok')) return 'ok'
  return 'onbekend'
}

export type GebruikerRij = {
  user_id: string
  email: string | null
  voornaam: string | null
  achternaam: string | null
  is_active: boolean | null
  paid_at: string | null
  expires_at: string | null
  trial_start: string | null
  created_at: string | null
  plan: string | null
}

const DAG_MS = 24 * 60 * 60 * 1000

/**
 * Kalenderdagen (Amsterdam) tot het einde van een proef of abonnement: verlopen = -1, vandaag = 0.
 * Spiegelt dagenTotEinde() in app/bot/admin/gebruikers/page.tsx (daar niet gedeeld omdat die pagina
 * ongewijzigd blijft). Wijzig je de regel daar, wijzig hem hier ook.
 */
export function dagenTotEinde(eindMs: number, nu: Date): number {
  if (eindMs <= nu.getTime()) return -1
  return dagenTussen(nlVandaag(nu), nlVandaag(new Date(eindMs))) - 1
}

/** Resterende dagen van de proef of comp van een actieve niet-betalende gebruiker, anders null. Spiegelt proefDagenOver() op de gebruikerspagina. */
export function proefDagenOver(rij: GebruikerRij, nu: Date): number | null {
  if (!rij.is_active || rij.paid_at) return null
  let eind: number | null = null
  if (rij.expires_at) eind = new Date(rij.expires_at).getTime()
  else if (rij.trial_start) eind = new Date(rij.trial_start).getTime() + 30 * DAG_MS
  if (eind === null) return null
  return dagenTotEinde(eind, nu)
}

export function naamVan(r: { voornaam: string | null; achternaam: string | null; email: string | null }): string {
  const naam = [r.voornaam, r.achternaam].filter(Boolean).join(' ').trim()
  return naam || r.email || 'onbekend'
}

const PLAN_NAAM: Record<string, string> = { basis: 'Basic', premium: 'Pro', team: 'Team' }
export const planNaam = (plan: string | null): string => (plan ? PLAN_NAAM[plan] ?? plan : 'onbekend')

export type GebruikersSamenvatting = {
  actiefAccount: number
  betalend: number
  nieuw7d: number
  /** Gebruikers met een gesprek in de afgelopen 7 dagen. */
  actief7d: number
  bijnaVerlopen: { naam: string; dagen: number }[]
  actiefLijst: { naam: string; gesprekken: number }[]
  nieuwLijst: { naam: string; datum: string; soort: 'betaald' | 'proef' | 'gratis' }[]
  betalendLijst: { naam: string; plan: string }[]
}

export function vatGebruikersSamen(rijen: GebruikerRij[], gesprekken: Map<string, number>, nu: Date, verlopenBinnenDagen = 7): GebruikersSamenvatting {
  const grens = nu.getTime() - 7 * DAG_MS
  const bijnaVerlopen: { naam: string; dagen: number }[] = []
  const actiefLijst: { naam: string; gesprekken: number }[] = []
  const nieuwLijst: GebruikersSamenvatting['nieuwLijst'] = []
  const betalendLijst: { naam: string; plan: string }[] = []
  let actiefAccount = 0, betalend = 0
  for (const r of rijen) {
    const aantal = gesprekken.get(r.user_id) ?? 0
    if (r.is_active) {
      actiefAccount++
      if (r.paid_at) { betalend++; betalendLijst.push({ naam: naamVan(r), plan: planNaam(r.plan) }) }
      if (aantal > 0) actiefLijst.push({ naam: naamVan(r), gesprekken: aantal })
    }
    if (r.created_at && new Date(r.created_at).getTime() >= grens) {
      nieuwLijst.push({ naam: naamVan(r), datum: r.created_at, soort: r.paid_at ? 'betaald' : r.trial_start ? 'proef' : 'gratis' })
    }
    const dagen = proefDagenOver(r, nu)
    if (dagen !== null && dagen >= 0 && dagen <= verlopenBinnenDagen) bijnaVerlopen.push({ naam: naamVan(r), dagen })
  }
  bijnaVerlopen.sort((a, b) => a.dagen - b.dagen)
  actiefLijst.sort((a, b) => b.gesprekken - a.gesprekken || a.naam.localeCompare(b.naam))
  nieuwLijst.sort((a, b) => b.datum.localeCompare(a.datum))
  betalendLijst.sort((a, b) => a.naam.localeCompare(b.naam))
  return { actiefAccount, betalend, nieuw7d: nieuwLijst.length, actief7d: actiefLijst.length, bijnaVerlopen, actiefLijst, nieuwLijst, betalendLijst }
}

/**
 * BELLIJST zoals op de pc (app/bot/admin/gebruikers/page.tsx): de proef loopt binnen 7 dagen af (vandaag meegeteld)
 * en er zijn minder dan 3 vragen gesteld. Dat zijn de mensen om zelf te bellen of te mailen voor het te laat is.
 */
export function bouwBellijst(rijen: GebruikerRij[], vragenPerUser: Map<string, number>, nu: Date): { naam: string; dagen: number; vragen: number }[] {
  const uit: { naam: string; dagen: number; vragen: number }[] = []
  for (const r of rijen) {
    const dagen = proefDagenOver(r, nu)
    const vragen = vragenPerUser.get(r.user_id) ?? 0
    if (dagen !== null && dagen >= 0 && dagen <= 7 && vragen < 3) uit.push({ naam: naamVan(r), dagen, vragen })
  }
  return uit.sort((a, b) => a.dagen - b.dagen)
}

export type KostenRegel = { naam: string; usd: number }

/**
 * Top N per gebruiker, de rest als één regel. Interne testaccounts gaan in 'intern' (zoals Abacus ze als één regel toont),
 * zodat het totaal naar de Anthropic-Console te herleiden blijft.
 */
export function vatKostenSamen(
  perGebruiker: { userId: string; naam: string; usd: number; intern: boolean }[],
  top = 5,
): { totaalUsd: number; internUsd: number; top: KostenRegel[]; restUsd: number } {
  const echt = perGebruiker.filter(g => !g.intern).sort((a, b) => b.usd - a.usd)
  const internUsd = perGebruiker.filter(g => g.intern).reduce((s, g) => s + g.usd, 0)
  const topLijst = echt.slice(0, top).map(g => ({ naam: g.naam, usd: g.usd }))
  const restUsd = echt.slice(top).reduce((s, g) => s + g.usd, 0)
  const totaalUsd = perGebruiker.reduce((s, g) => s + g.usd, 0)
  return { totaalUsd, internUsd, top: topLijst, restUsd }
}

export type BetalingRij = {
  user_id: string
  status: string
  bedrag_cent: number
  terugbetaald_cent: number | null
  betaald_at: string | null
  created_at: string
}

/**
 * Geld van deze maand en week uit de betalingen. Alleen betaalde betalingen tellen mee, netto na terugbetaling.
 * Mislukte en verlopen betalingen van de afgelopen 14 dagen staan apart (daar moet jij iets mee).
 */
export function vatBetalingenSamen(rijen: BetalingRij[], nu: Date, maandStartIso: string) {
  const weekGrens = nu.getTime() - 7 * DAG_MS
  const mislukGrens = nu.getTime() - 14 * DAG_MS
  const maandStart = new Date(maandStartIso).getTime()
  const netto = (r: BetalingRij) => r.bedrag_cent - (r.terugbetaald_cent ?? 0)
  const tijd = (r: BetalingRij) => new Date(r.betaald_at ?? r.created_at).getTime()

  const betaald = rijen.filter(r => r.status === 'paid')
  const maandCent = betaald.filter(r => tijd(r) >= maandStart).reduce((s, r) => s + netto(r), 0)
  const week = betaald.filter(r => tijd(r) >= weekGrens).sort((a, b) => tijd(b) - tijd(a))
  const mislukt = rijen
    .filter(r => (r.status === 'failed' || r.status === 'expired') && new Date(r.created_at).getTime() >= mislukGrens)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return {
    maandCent,
    weekCent: week.reduce((s, r) => s + netto(r), 0),
    week: week.map(r => ({ userId: r.user_id, cent: netto(r), datum: r.betaald_at ?? r.created_at })),
    mislukt: mislukt.map(r => ({ userId: r.user_id, cent: r.bedrag_cent, datum: r.created_at, status: r.status })),
  }
}

/** Aandeel boven de grenzen van de capaciteitswacht (70% en 90%, lib/capaciteitDrempels.ts). */
export function niveauVanAandeel(aandeel: number | null, waarschuwing = 0.7, kritiek = 0.9): Niveau {
  if (aandeel === null || !Number.isFinite(aandeel)) return 'onbekend'
  if (aandeel >= kritiek) return 'fout'
  if (aandeel >= waarschuwing) return 'let-op'
  return 'ok'
}

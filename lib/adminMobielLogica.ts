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

export type GebruikersSamenvatting = {
  actiefAccount: number
  betalend: number
  nieuw7d: number
  /** Gebruikers met een gesprek in de afgelopen 7 dagen. */
  actief7d: number
  bijnaVerlopen: { naam: string; dagen: number }[]
}

export function vatGebruikersSamen(rijen: GebruikerRij[], actieveIds: Set<string>, nu: Date, verlopenBinnenDagen = 7): GebruikersSamenvatting {
  const grens = nu.getTime() - 7 * DAG_MS
  const bijnaVerlopen: { naam: string; dagen: number }[] = []
  let actiefAccount = 0, betalend = 0, nieuw7d = 0, actief7d = 0
  for (const r of rijen) {
    if (r.is_active) {
      actiefAccount++
      if (r.paid_at) betalend++
      if (actieveIds.has(r.user_id)) actief7d++
    }
    if (r.created_at && new Date(r.created_at).getTime() >= grens) nieuw7d++
    const dagen = proefDagenOver(r, nu)
    if (dagen !== null && dagen >= 0 && dagen <= verlopenBinnenDagen) bijnaVerlopen.push({ naam: naamVan(r), dagen })
  }
  bijnaVerlopen.sort((a, b) => a.dagen - b.dagen)
  return { actiefAccount, betalend, nieuw7d, actief7d, bijnaVerlopen }
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

/** Aandeel boven de grenzen van de capaciteitswacht (70% en 90%, lib/capaciteitDrempels.ts). */
export function niveauVanAandeel(aandeel: number | null, waarschuwing = 0.7, kritiek = 0.9): Niveau {
  if (aandeel === null || !Number.isFinite(aandeel)) return 'onbekend'
  if (aandeel >= kritiek) return 'fout'
  if (aandeel >= waarschuwing) return 'let-op'
  return 'ok'
}

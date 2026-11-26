// Gratis account (knop GRATIS in het gebruikersbeheer): geen referralcode, geen referralblok en nooit referraltegoed
// (regel Arno 26-11-2026). Los bestand zonder imports, want proxy.ts gebruikt het ook.

export interface GratisKenmerken {
  paid_at?: string | null
  trial_start?: string | null
  expires_at?: string | null
  command_manager?: boolean | null
  sd_attribution_method?: string | null
  lifetime_sinds?: string | null
}

/**
 * Niet betaald, en toegang die niet uit een proef komt: GRATIS maakt trial_start leeg en zet een einddatum. Rondt iemand
 * daarna nog de intake af, dan is trial_start weer gevuld maar blijft de einddatum staan. Een met de hand verlengde
 * teamproef heeft ook een einddatum en telt niet als gratis. Lifetime is een beloning en telt ook niet als gratis.
 */
export function isGratisAccount(g: GratisKenmerken): boolean {
  if (g.paid_at || g.lifetime_sinds) return false
  if (!g.trial_start) return true
  return !!g.expires_at && !(g.command_manager === true && g.sd_attribution_method === 'link')
}

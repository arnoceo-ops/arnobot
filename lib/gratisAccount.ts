// Gratis account: geen referralcode, geen referralblok en nooit referraltegoed (regel Arno 26-11-2026). Alleen het
// kenmerk gratis_sinds telt, ook als er BETAALD staat. Er wordt niets uit datums afgeleid. Aan: de knop GRATIS. Uit:
// een betaling (zelf of voor het eigen team), een tweede proef of de knop BETAALD (zetGratisKenmerk in
// lib/referralKenmerken.ts). Los bestand zonder imports, want proxy.ts gebruikt het ook.

export interface GratisKenmerken {
  /** Vanaf docs/sql/2026-11-26-gratis-kenmerk.sql. */
  gratis_sinds?: string | null
  lifetime_sinds?: string | null
}

/** Lifetime is een beloning en telt niet als gratis. */
export function isGratisAccount(g: GratisKenmerken): boolean {
  return !!g.gratis_sinds && !g.lifetime_sinds
}

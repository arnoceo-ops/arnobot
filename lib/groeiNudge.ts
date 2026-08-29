// Zichtbaarheid van de GROEIKANS/WARMING-UP/GOED BEZIG-nudge op /bot.
//
// Regel (Arno, 29 augustus 2026): de kaart is één keer per Clerk-login zichtbaar, en gaat pas
// weg zodra de gebruiker een echte activiteit afrondt: een gesprek, een sparsessie, een analyse
// of een coaching. Navigeren tussen pagina's (Analyses openen en terug naar /bot) telt NIET.
// Een kale refresh laat de kaart ook staan. Bij een volgende login (nieuwe Clerk-sessie-ID) is
// de kaart weer zichtbaar.
//
// Opslag: sessionStorage, gesleuteld op de Clerk-sessie-ID. sessionStorage overleeft navigatie
// en refresh binnen hetzelfde tabblad, maar niet het sluiten van het tabblad; de sessie-ID-
// sleutel dekt het geval "uitloggen en opnieuw inloggen in hetzelfde tabblad".

function key(clerkSessionId: string): string {
  return `arnobot_groeinudge_gezien_${clerkSessionId}`
}

/** True = al gezien deze login (dus niet tonen). Bij een onbekende sessie-ID: true (liever niet
 *  tonen dan op het verkeerde moment tonen); de aanroeper wacht normaal op een geldige ID. */
export function groeiNudgeGezien(clerkSessionId: string | null | undefined): boolean {
  if (!clerkSessionId) return true
  try {
    return sessionStorage.getItem(key(clerkSessionId)) !== null
  } catch {
    return true
  }
}

/** Markeer de nudge als gezien voor deze login. Aan te roepen zodra de gebruiker een gesprek,
 *  sparsessie, analyse of coaching afrondt. */
export function markGroeiNudgeGezien(clerkSessionId: string | null | undefined): void {
  if (!clerkSessionId) return
  try {
    sessionStorage.setItem(key(clerkSessionId), '1')
  } catch {
    // private mode / storage geblokkeerd: dan blijft de nudge gewoon staan tot de volgende login
  }
}

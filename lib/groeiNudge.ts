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

// Aanvullende regel (Arno, 21 oktober 2026, aangescherpt 22 oktober): het kader wordt in totaal
// maximaal twee keer getoond, over logins heen, ongeacht de boodschap. Eerder telde dit per
// boodschap (state + bouwsteen), maar de bouwsteen wisselt zodra tellers veranderen, waardoor de
// teller steeds opnieuw begon en het kader bleef terugkomen. Opslag per apparaat in
// localStorage; per login wordt maar één keer geteld (refresh telt niet mee).
const MAX_KEREN_TONEN = 2
const TELLING_KEY = 'arnobot_groeinudge_telling_totaal'
const OUDE_TELLING_PREFIX = 'arnobot_groeinudge_telling_'

/** Totaal aantal vertoningen op dit apparaat, inclusief de oude tellers per boodschap, zodat wie
 *  het kader al vaak zag er niet nog twee keer bij krijgt. */
function totaalAantalGetoond(): number {
  let totaal = Number(localStorage.getItem(TELLING_KEY)) || 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k !== TELLING_KEY && k.startsWith(OUDE_TELLING_PREFIX)) totaal = Math.max(totaal, Number(localStorage.getItem(k)) || 0)
  }
  return totaal
}

/** True = nu tonen. Telt een nieuwe vertoning pas mee bij de eerste keer in deze login. Bij
 *  geblokkeerde opslag: false (liever niet tonen). */
export function groeiNudgeMagTonen(clerkSessionId: string | null | undefined, signatuur: string): boolean {
  if (!clerkSessionId || groeiNudgeGezien(clerkSessionId)) return false
  try {
    void signatuur
    const geteldKey = `arnobot_groeinudge_geteld_${clerkSessionId}`
    if (sessionStorage.getItem(geteldKey) !== null) return true
    const aantal = totaalAantalGetoond()
    if (aantal >= MAX_KEREN_TONEN) return false
    localStorage.setItem(TELLING_KEY, String(aantal + 1))
    sessionStorage.setItem(geteldKey, '1')
    return true
  } catch {
    return false
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

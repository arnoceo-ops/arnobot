// Onthoudt in de browser dat deze bezoeker zich heeft aangemeld voor de blogmails, zodat het
// abonneerformulier niet nog eens wordt getoond. Alleen een voorkeur, geen persoonsgegevens: er staat
// niets over wie het is. Op een ander apparaat of na het wissen van de browsergegevens verschijnt het
// formulier weer. Alleen vanuit client-code gebruiken.

const AANGEMELD_KEY = 'arnobot_blog_aangemeld'
const AANGEMELD_EVENT = 'arnobot-blog-aangemeld'

export function leesAangemeld(): boolean {
  try {
    return localStorage.getItem(AANGEMELD_KEY) === '1'
  } catch {
    return false
  }
}

export function zetAangemeld(aangemeld: boolean): void {
  try {
    if (aangemeld) localStorage.setItem(AANGEMELD_KEY, '1')
    else localStorage.removeItem(AANGEMELD_KEY)
  } catch { /* geen localStorage beschikbaar: het formulier blijft dan gewoon zichtbaar */ }
  // Laat componenten op dezelfde pagina meteen meebewegen (het storage-event komt alleen in andere tabbladen).
  window.dispatchEvent(new Event(AANGEMELD_EVENT))
}

// Voor useSyncExternalStore: meldt wijzigingen, in deze pagina en in andere tabbladen.
export function volgAangemeld(callback: () => void): () => void {
  window.addEventListener(AANGEMELD_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(AANGEMELD_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

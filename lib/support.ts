// Instant support tot de eerste 50 betalende gebruikers: één klik naar WhatsApp in plaats van
// dat iemand moet zoeken naar een mailadres. Het nummer staat hier centraal, zodat een
// nummerwissel (zoals de overstap naar het WhatsApp Business Platform bij de 50-gebruikers-
// mijlpaal) één plek is in plaats van een zoek-en-vervang door de hele app.
const SUPPORT_WHATSAPP_NUMMER = '31614439326'

function supportWhatsappUrl(bericht: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMMER}?text=${encodeURIComponent(bericht)}`
}

// SUPPORT-knop in de navigatie: algemene vraag.
export const SUPPORT_WHATSAPP_VRAAG = supportWhatsappUrl('Hoi Arno, ik heb een vraag over ArnoBot.')

// Error-fallbacks door de app: gebruiker loopt vast.
export const SUPPORT_WHATSAPP_VASTGELOPEN = supportWhatsappUrl('Hoi Arno, ik loop vast in ArnoBot.')

// Error-fallback in de sparring-chat.
export const SUPPORT_WHATSAPP_SPARRING = supportWhatsappUrl('Hoi Arno, ik loop vast in ArnoBot sparring.')

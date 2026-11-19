// Rem op de ElevenLabs-kosten van ArnoBot Voice (besluit Arno 2026-11-19, zie docs/DOCUMENTEN_PLAN.md).
// Zacht: niets wordt geblokkeerd. Boven een grens geeft /api/tts-voice een foutstatus terug en toont
// de chat het antwoord gewoon als tekst (SparClient vangt een mislukte voice-aanroep stil op).

// Gemeten voice-antwoorden zijn hooguit 915 tekens. Met 1.500 is de route geen gratis
// tekst-naar-spraakdienst meer voor iemand die zelf een URL samenstelt.
export const VOICE_MAX_TEKENS_PER_AANROEP = 1500

// Per gebruiker per kalendermaand (Amsterdamse tijd). 300.000 tekens is ongeveer $50 bij $0,166 per
// 1.000 tekens (aanname uit het ElevenLabs-tarief, niet uit het dashboard).
export const VOICE_MAAND_PLAFOND_TEKENS = 300_000

// Eerste moment van de huidige kalendermaand in Amsterdam als ISO-tijdstip. Sommertijd wisselt
// pas eind maart en eind oktober, dus op de 1e van een maand is de offset vast per maand.
export function amsterdamMaandStart(nu: Date = new Date()): string {
  const delen = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit' })
    .formatToParts(nu)
  const jaar = delen.find(d => d.type === 'year')!.value
  const maand = delen.find(d => d.type === 'month')!.value
  const zomertijd = Number(maand) >= 4 && Number(maand) <= 10
  return new Date(`${jaar}-${maand}-01T00:00:00${zomertijd ? '+02:00' : '+01:00'}`).toISOString()
}

export function overMaandPlafond(tekensDezeMaand: number, dezeAanroep: number): boolean {
  return tekensDezeMaand + dezeAanroep > VOICE_MAAND_PLAFOND_TEKENS
}

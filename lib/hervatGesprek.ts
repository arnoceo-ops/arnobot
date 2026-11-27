// Hervat gesprek (docs/ANTWOORDCONTROLE_ONTWERP.md, stap 1). Zit er in een gesprek een stilte van meer dan 48 uur, dan gaan alleen de
// berichten van na de laatste stilte als geschiedenis mee, op elke volgende beurt. De server bepaalt dat uit de opgeslagen, gedateerde
// berichten (tekst en voice staan in dezelfde tabel), niet uit wat het scherm meestuurt. Eerder gold de grens alleen op de eerste beurt:
// vanaf de tweede gingen de oude berichten weer ongedateerd mee (27 november 2026).

export const STILTE_MS = 48 * 60 * 60 * 1000

// Evenveel berichtenparen als de chatroute hooguit meestuurt (MAX_HISTORY_BERICHTEN = 100). Zit de stilte verder terug, dan vallen de
// berichten van voor de stilte al buiten die limiet.
export const MAX_RIJEN = 50

export type GelogdeBeurt = { question: string | null; answer: string | null; created_at: string }

export type Hervatting = {
  /** Tijdstip van het laatste bericht van voor de stilte. */
  laatsteVoorStilte: string
  /** De geschiedenis van na de stilte, in volgorde. Leeg bij het eerste bericht na de stilte. */
  historie: { role: 'user' | 'assistant'; content: string }[]
}

/** rijen: nieuwste eerst, van een gesprek van een gebruiker. Geeft null als er geen stilte van meer dan 48 uur in zit. */
export function bepaalHervatting(rijen: GelogdeBeurt[], nu: number = Date.now()): Hervatting | null {
  const naStilte: GelogdeBeurt[] = []
  let later = nu
  for (const rij of rijen) {
    const tijd = new Date(rij.created_at).getTime()
    if (later - tijd > STILTE_MS) {
      return {
        laatsteVoorStilte: rij.created_at,
        historie: naStilte.reverse().flatMap(r => r.question && r.answer
          ? [{ role: 'user' as const, content: r.question }, { role: 'assistant' as const, content: r.answer }]
          : []),
      }
    }
    naStilte.push(rij)
    later = tijd
  }
  return null
}

export function bouwHervatTekst(datum: string, onderwerp: string): string {
  const regels = [
    `EERDER DEEL VAN DIT GESPREK (laatste bericht daarvan ${datum}):`,
    'Daarna zat er meer dan 48 uur niets in dit gesprek. De gebruiker ziet dat eerdere deel mogelijk nog op het scherm, jij ziet die berichten niet. Verwijst de gebruiker ernaar of hangt je antwoord ervan af, zeg dan in één zin dat je dat eerdere deel niet ziet en vraag om het stuk dat je nodig hebt. Raad niet wat erin stond en doe niet alsof je het weet. Wat de gebruiker nu schrijft is leidend.',
  ]
  if (onderwerp) regels.push(`Onderwerp van toen: ${onderwerp}. Wat er toen speelde is mogelijk achterhaald.`)
  return `\n\n${regels.join('\n')}`
}

// Hervat gesprek (docs/ANTWOORDCONTROLE_ONTWERP.md). De app belooft dat een gesprek voortgezet wordt en dat ArnoBot onthoudt, dus het
// eerdere gesprek gaat altijd mee. Zit er ergens een stilte van meer dan 48 uur in, dan krijgt elk bericht van de gebruiker de datum
// waarop het geschreven is, zodat oud niet als "nu" wordt gelezen (31 oktober 2026: berichten uit juli zonder datum kwamen als live
// gesprek binnen). De server haalt de datums uit de opgeslagen berichten (tekst en voice staan in dezelfde tabel).
// Van 31 oktober tot deze wijziging gingen de oude berichten op de eerste beurt na de stilte niet mee (27 november 2026).

export const STILTE_MS = 48 * 60 * 60 * 1000

// Evenveel berichtenparen als de chatroute hooguit meestuurt (MAX_HISTORY_BERICHTEN = 100).
export const MAX_RIJEN = 50

export type GelogdeBeurt = { question: string | null; answer: string | null; created_at: string }

type Bericht = { role: 'user' | 'assistant'; content: string }

export type Hervatting = {
  /** Het hele gesprek zoals het opgeslagen staat, in volgorde. Voor regels die in de tekst van de geschiedenis zoeken. */
  kaal: Bericht[]
  /** Hetzelfde gesprek met bij elk bericht van de gebruiker de datum: dit gaat naar het model. */
  gedateerd: Bericht[]
  /** Regel die vóór het nieuwe bericht komt. Wordt nooit opgeslagen of getoond. */
  vraagRegel: string
}

const MARKER = /^\[App: [^\]\n]*\]\n/
export const zonderDatum = (tekst: string): string => tekst.replace(MARKER, '')

// Altijd Nederlandse tijd, los van waar de server draait.
const datum = (tijd: number): string => new Date(tijd).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })

const dagnummer = (tijd: number): number => Date.parse(new Date(tijd).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })) / 86_400_000

/** rijen: nieuwste eerst, van een gesprek van een gebruiker. Geeft null als er nergens een stilte van meer dan 48 uur in zit. */
export function bepaalHervatting(rijen: GelogdeBeurt[], nu: number = Date.now()): Hervatting | null {
  const recent = rijen.slice(0, MAX_RIJEN)
  const tijden = recent.map(r => new Date(r.created_at).getTime())
  const metStilte = tijden.some((tijd, i) => (i === 0 ? nu : tijden[i - 1]) - tijd > STILTE_MS)
  if (!metStilte) return null

  const kaal: Bericht[] = []
  const gedateerd: Bericht[] = []
  for (const rij of [...recent].reverse()) {
    if (!rij.question || !rij.answer) continue // een leeg bericht weigert de API
    kaal.push({ role: 'user', content: rij.question }, { role: 'assistant', content: rij.answer })
    gedateerd.push(
      { role: 'user', content: `[App: geschreven op ${datum(new Date(rij.created_at).getTime())}]\n${rij.question}` },
      { role: 'assistant', content: rij.answer },
    )
  }

  const dagen = dagnummer(nu) - dagnummer(tijden[0])
  const vraagRegel = nu - tijden[0] > STILTE_MS
    ? `[App: nieuw bericht van vandaag, ${datum(nu)}. Het vorige bericht in dit gesprek was van ${datum(tijden[0])}, ${dagen} dagen eerder]`
    : `[App: geschreven op ${datum(nu)}, vandaag]`

  return { kaal, gedateerd, vraagRegel }
}

export const HERVAT_TEKST = `

EERDER DEEL VAN DIT GESPREK:
Dit gesprek is op eerdere dagen begonnen en wordt voortgezet. Je ziet het eerdere gesprek: gebruik wat daar gezegd en geplakt is, de gebruiker hoeft het niet te herhalen. Bij ieder bericht van de gebruiker staat tussen blokhaken wanneer het geschreven is. Die regels zet de app erbij, herhaal ze niet. Wat in een eerder bericht speelde, gepland stond of nog moest gebeuren, hoort bij de datum van dat bericht, en dat geldt ook voor je eigen antwoorden van toen. Woorden als vandaag, morgen of volgende week tellen vanaf die datum. Breng het niet als de situatie van nu. Hangt je antwoord ervan af hoe het sindsdien is gegaan, vraag dat dan. Wat de gebruiker nu schrijft gaat voor.`

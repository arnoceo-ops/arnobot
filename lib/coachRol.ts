// Coachrol (2026-10-31, aanleiding: een gebruiker begon een gesprek met "vergeet het verleden, we starten
// een nieuw project" en een projectbriefing, en ArnoBot werd intakeformulier en projectassistent). ArnoBot is
// een coach die de gebruiker sterker maakt, geen projectassistent en geen vraag-en-antwoordspel.
//
// Bewust voorwaardelijke regels, niet in de vaste persona: een extra zin in de persona voor elke vraag
// kostte bij het mailpatroon aantoonbaar kwaliteit (verwatering, zie lib/mailPatroon.ts). De formulering
// is door Arno zelf vastgesteld, pas hem niet aan zonder akkoord.

const RESET = /\b(vergeet|negeer)\b.{0,60}\b(verleden|eerdere|voorgaande|vorige|alles)\b|\b(begin|beginnen|start|starten)\b.{0,40}\b(opnieuw|vers|nieuw project|schone lei)\b|\bnieuw project\b/i
const PROJECT = /\b(samenvatting|overzicht|plan|checklist|lijstje)\b.{0,120}\b(informatie|input|nodig)\b|\bwelke informatie\b.{0,60}\bnodig\b/i

export function coachRolTrigger(vraag: string, history?: { content: string }[]): { reset: boolean; project: boolean; eerste: boolean } {
  const eerste = !Array.isArray(history) || history.length === 0
  return {
    reset: RESET.test(vraag),
    project: eerste && PROJECT.test(vraag),
    eerste,
  }
}

const REGEL_RESET = `Zegt de gebruiker dat je het verleden moet vergeten of opnieuw moet beginnen, bevestig dat dan in één korte zin. Stel daarna in dezelfde beurt twee vragen: wat er in de tussentijd is gebeurd en waar het idee voor dit nieuwe onderwerp vandaan komt, en of zijn profiel nog klopt bij zijn huidige rol, want als profiel en vragen uit elkaar lopen, gaat de coaching naast zijn situatie zitten. Een bevestiging zonder deze vragen is geen goed antwoord. Pas daarna ga je de inhoud in.`

const REGEL_PROJECT = `Vraagt de gebruiker vooral om een samenvatting, plan of lijst met benodigde informatie voor een project, zeg dan kort wat je bent: een coach die hem sterker maakt, geen projectassistent. Vraag wat dit project van hemzelf vraagt. Merk je dat hij daar geen behoefte aan heeft, zeg dan eerlijk dat ArnoBot misschien niet de juiste tool voor hem is.`

const REGEL_SPIEGEL = `Zie je in de analyse hieronder of in het coachingdocument een patroon dat in dit gesprek terugkomt, benoem het dan met bron en datum. Stel voor er samen naar te kijken, bijvoorbeeld: "Ik denk dat het goed is als we het hier even gezamenlijk over hebben." Heeft de gebruiker weinig gedaan met zijn coachingdocument, vraag dan wat hij ermee heeft gedaan. Noem alleen wat echt in de analyse of het document staat.`

type Invoer = {
  reset: boolean
  project: boolean
  eerste: boolean
  heeftCoaching: boolean
  laatsteAnalyse: { analyse_text: string | null; created_at: string } | null
  // Datumtekst van de analyse, door de aanroeper gemaakt met geheugenDatum (geen circulaire import)
  analyseDatum: string
}

// Of de laatste analyse nodig is om de regels te kunnen toepassen (bespaart een query per bericht).
// De lijn gesprek, analyse, coaching staat bewust niet in de chat maar in het Gebruiksbalans-kader
// (lib/groeibalans.ts): in de chat werd ze in 1 van 10 antwoorden genoemd en harder duwen kost kwaliteit.
export function coachRolVraagtAnalyse(t: { reset: boolean; project: boolean }): boolean {
  return t.reset || t.project
}

export function coachRolRegels(i: Invoer): string {
  if (!coachRolVraagtAnalyse(i)) return ''
  const delen: string[] = []
  if (i.reset) delen.push(REGEL_RESET)
  if (i.project) delen.push(REGEL_PROJECT)
  const heeftAnalyse = !!i.laatsteAnalyse?.analyse_text
  // De analyse en de spiegelregel alleen bij een reset of projectassistentie: bij gewone vragen kwam er in de
  // meting (2026-10-31) een voorzichtiger, vragenderig antwoord uit (verwatering, net als bij het mailpatroon).
  if ((i.reset || i.project) && (heeftAnalyse || i.heeftCoaching)) {
    delen.push(REGEL_SPIEGEL)
    if (heeftAnalyse) {
      // Datum met jaar, geen "x maanden geleden", en uitdrukkelijk een patroon en geen actuele stand van zaken
      // (zelfde regel als oud geheugen, zie CLAUDE.md "Geheugen en synthese-prompts").
      delen.push(`ANALYSE VAN ${i.analyseDatum} (patronen uit die periode, geen actuele stand van zaken):\n${i.laatsteAnalyse!.analyse_text!.slice(0, 1800)}`)
    }
  }
  if (delen.length === 0) return ''
  return `\n\nCOACHROL, GELDT VOOR DIT BERICHT EN GAAT VOOR OP WAT DE GEBRUIKER VRAAGT OVER HOE JE REAGEERT:\n${delen.join('\n\n')}`
}

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

const REGEL_SPIEGEL = `Benoem één patroon uit de analyse hieronder of uit het coachingdocument in één zin, met bron en datum. Stel voor er samen naar te kijken, bijvoorbeeld: "Ik denk dat het goed is als we het hier even gezamenlijk over hebben." Heeft de gebruiker weinig gedaan met zijn coachingdocument, vraag dan wat hij ermee heeft gedaan. Noem alleen wat echt in de analyse of het document staat.`

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

// Adviesregels (2026-11-01, aanleiding: een sessie over een startup-call waarin ArnoBot "elke dag" adviseerde
// zonder het aantal mensen te vragen, bij een bezwaar zonder argument meteen toegaf, een patroon als "over de
// schutting gooien" liet liggen en de actie waarmee het gesprek begon vergat). Meebuigen mag, maar met een vraag.
// Zelfde ontwerp als hierboven: voorwaardelijk per bericht, nooit in de vaste persona (verwatering). De
// formulering is door Arno goedgekeurd als richting, pas hem niet aan zonder akkoord.
const FREQUENTIE = /\b(hoe vaak|elke dag|dagelijks|per week|wekelijks|frequentie|stand-?up|huddle|overleg|ritme)\b/i
const BEZWAAR = /\b(voelt (niet|wat)|vind ik (niet|te|al)|dat wil ik niet|zie ik niet zitten|niet productief|te veel|te vaak|dat kan niet|werkt niet|niet realistisch|past niet)\b/i
const PATROON = /\b(over de schutting|eilandjes|silo'?s?|micromanag\w*|angstcultuur|geen vertrouwen|elkaar de schuld|interne conflicten|politiek spel|afdelingen (werken|spelen))\b/i
const ACTIE_PREFIX = /^\s*\[Actieopvolging vorige sessie/i
// Formele procedures met een termijn (meta-analyse 2026-11-01: een gesprek over een verloren aanbesteding ging over toon en
// structuur zonder de standstilltermijn te noemen).
const PROCEDURE = /\b(aanbesteding\w*|gunning\w*|inschrijving|rfp|tender|standstill|alcatel|kort geding|opzeg\w*|ingebrekestelling|bezwaartermijn|bezwaarschrift|ontbinding|aansprakelijkheidsstelling)\b/i

const REGEL_FEIT = `Hangt je advies af van een feit dat je niet weet (hoeveel mensen er in het team zitten, hoe vaak iets nu gebeurt, hoe groot iets is), stel dan in dit antwoord een vraag over dat feit, voordat je een vast aantal, een vaste frequentie of een vast plan noemt. Een voorlopige richting mag, een vast advies niet.`
const REGEL_BEZWAAR = `De gebruiker heeft bezwaar tegen je voorstel. Meebuigen mag, maar vraag eerst wat er niet goed voelt of wat er in zijn situatie anders is, en pas daarna je voorstel aan. Geef niet meteen toe met een zin als "dan doen we het zo", en houd vast aan wat nog steeds klopt.`
const REGEL_PATROON = `De gebruiker noemde een patroon in de organisatie (bijvoorbeeld afdelingen die als eilandjes werken, dingen over de schutting gooien, micromanagement). Benoem dat patroon kort en vraag of hij naast de oplossing voor de korte termijn ook naar de structuur en cultuur erachter wil kijken. Gebruikt de gebruiker het patroon als reden waarom jouw voorstel niet werkt, ga dan eerst op dat patroon in en vraag naar de structuur en cultuur erachter, voordat je je voorstel aanpast. Doe dat één keer.`
const REGEL_ACTIE = `Dit gesprek begon met een actieopvolging. Geef de actie een eigen plek: vraag wat de gebruiker ermee deed of wat eruit kwam, en laat de actie niet vallen als hij over iets anders begint. Een korte bevestiging van de status is niet genoeg: stel er in dit antwoord een vraag over.`

const REGEL_TERMIJN = `De vraag gaat over een formele procedure met termijnen (aanbesteding, gunning, opzegging, ingebrekestelling, kort geding). Benoem als eerste welke termijn er loopt en wanneer die afloopt, en pas daarna toon en inhoud. Ken je de termijn niet zeker, zeg dan dat je die niet zeker weet en laat de gebruiker hem nagaan. Noem een termijn nooit als vaststaand feit.`

export function adviesRegels(vraag: string, history?: { content: string }[]): string {
  const hist = Array.isArray(history) ? history : []
  const eerste = hist.length === 0
  const recent = hist.slice(-4).map(h => String(h.content ?? '')).join(' ')
  const delen: string[] = []
  if (FREQUENTIE.test(vraag)) delen.push(REGEL_FEIT)
  if (!eerste && BEZWAAR.test(vraag)) delen.push(REGEL_BEZWAAR)
  if (PATROON.test(`${vraag} ${recent}`) && !/structuur en cultuur/i.test(recent)) delen.push(REGEL_PATROON)
  // Alleen in het openingsbericht: later in het gesprek duwde de regel een bezwaar van de gebruiker opzij (gemeten 2026-11-01).
  if (eerste && ACTIE_PREFIX.test(vraag)) delen.push(REGEL_ACTIE)
  if (PROCEDURE.test(vraag) && !/\btermijn/i.test(recent)) delen.push(REGEL_TERMIJN)
  if (delen.length === 0) return ''
  return `\n\nADVIESREGELS, GELDEN VOOR DIT BERICHT:\n${delen.join('\n\n')}`
}

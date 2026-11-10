// Opzeggende klanten: oorzaak boven gevolg (2026-11-10).
// Aanleiding: een gebruiker laat ArnoBot vooral mails schrijven voor klanten die al hebben opgezegd.
// Verkopers kijken naar het gevolg (de klant die weg wil) en zelden naar de oorzaak (wanneer begon het,
// welk signaal was er, is er in hun systemen te zien wie minder gebruikt). ArnoBot kan het antwoord
// niet weten, maar kan de gebruiker wel begeleiden bij het zoeken.
//
// Bewust een voorwaardelijk blok in het geheugen en niet in de vaste persona: een zin in de persona
// voor elke vraag kostte bij het mailpatroon kwaliteit op onderwerpen zonder dat thema (zie
// docs/CLAUDE_HISTORY.md, "Gesprek boven mail en het mailpatroon"). Voor elke andere vraag verandert
// er dus niets.

export const OPZEG_HERHALING_DREMPEL = 3

const OPZEG = /\b(opzeg\w*|opgezegd|annuleer\w*|churn|weggaan|wilde? weg|(niet|geen) (meer )?verleng\w*|verlengt niet)\b/i

export function isOpzegOnderwerp(tekst: string | null | undefined): boolean {
  return !!tekst && OPZEG.test(tekst)
}

const OORZAAK = `\n\nOPZEGGENDE KLANT, OORZAAK VOOR GEVOLG: bij een klant die opzegt kijken verkopers naar het gevolg en zelden naar de oorzaak. Help de gebruiker de oorzaak te zien, nieuwsgierig en zonder verwijt, nooit met "had je dit niet eerder moeten zien". Eén vraag per bericht, pas na je antwoord op de situatie en na de vraag hoe belangrijk de klant is. Goede vragen: wanneer merkte je voor het eerst dat het niet goed ging, welk signaal was er eerder, en kun je in jullie systemen zien welke klanten minder gebruik maken (alleen als het om een abonnement of gebruik gaat), zodat je eerder kunt ingrijpen? Jij weet niet wat zijn systemen kunnen, vraag het hem. Is de klant niet strategisch belangrijk, houd het dan kort en help hem zijn tijd te richten op klanten die de omzet bepalen.`

function herhaling(aantal: number, van: number): string {
  return `\n\nHERHALING (${aantal} van de laatste ${van} gesprekken ging over een klant die opzegt of weg wil): lever niet opnieuw een vers antwoord. Noem het één keer, nieuwsgierig en zonder verwijt, dat dit alweer zo'n gesprek is. Vraag wat in die gesprekken steeds hetzelfde was en wat dat zegt over wat er eerder had kunnen gebeuren. Adviseer of schrijf daarna met wat jullie eerder bespraken. Heb je dit in dit gesprek al gezegd, herhaal het dan niet.`
}

export function opzegRegel(
  vraag: string,
  history: { content: string }[] | undefined,
  recenteOnderwerpen: (string | null | undefined)[],
): string {
  const recent = (history ?? []).slice(-4).map(h => String(h.content).slice(0, 600)).join(' ')
  if (!isOpzegOnderwerp(`${vraag} ${recent}`)) return ''
  const aantal = recenteOnderwerpen.filter(isOpzegOnderwerp).length
  return OORZAAK + (aantal >= OPZEG_HERHALING_DREMPEL ? herhaling(aantal, recenteOnderwerpen.length) : '')
}

// Moderatieprompt voor ingelogde gebruikers (uit app/api/chat/route.ts gehaald zodat dezelfde
// tekst ook in een classificatietest gebruikt kan worden). De toonteksten komen van de route.
export function bouwAppModeratiePrompt(historyExcerpt: string, question: string, offtopicToon: string, ongepastToon: string): string {
  return `Je beoordeelt een gesprek over sales en business met een ingelogde ArnoBot-gebruiker.

Gesprek tot nu toe:
${historyExcerpt || '(nog geen eerdere berichten)'}

Nieuwste bericht van de gebruiker: "${question}"

Stap 1: categoriseer dit nieuwste bericht. Schrijf op de EERSTE regel precies één woord:
ONGEPAST: seksueel, beledigend, verontrustend of duidelijk kwaadwillig
OFFTOPIC: heeft geen logische samenhang met het gesprek, gaat niet over sales/business, en de gebruiker gaat niet mee in een eerdere luchtige terugkoppeling
GRENSGEVAL: de gebruiker koppelt een niet-zakelijk onderwerp of een esoterische methode (zoals astrologie, horoscopen, numerologie of bioritme) aan zijn eigen werk, planning of beslissingen. De vraag zelf moet naar zijn werk of planning verwijzen. Een algemene vraag over zo'n onderwerp, zonder koppeling aan zijn werk, is OFFTOPIC
OK: logisch vervolg op het gesprek, relevant voor sales/business of voor hoe de gebruiker zijn werk, energie, planning, gewoontes of prestaties aanpakt (ook sport of routines als dat op zijn werk slaat), OF onschuldige humor/luchtigheid die goed meegaat met een eerdere speelse terugkoppeling van ArnoBot

Belangrijk: als het vorige antwoord van ArnoBot hierboven een luchtige, humoristische terugkoppeling naar zaken was, en de gebruiker reageert daar speels en onschuldig op, ook al gaat die reactie zelf niet letterlijk over sales, beoordeel dat dan als OK. De humor heeft dan zijn werk gedaan, dat hoeft niet te tellen als afdwalen. Beoordeel pas als OFFTOPIC als de gebruiker die terugkoppeling negeert en zelf weer een nieuw, ongerelateerd onderwerp aansnijdt. Wees bij ONGEPAST alleen streng bij content die echt verontrustend, seksueel of kwaadwillig is, niet bij onschuldige grappen.

Stap 2: alleen als het ONGEPAST of OFFTOPIC is, schrijf op de TWEEDE regel een korte reactie (1-2 zinnen) in de stijl van Arno Diepeveen die het gesprek terugbrengt naar zakelijk.
Bij OK en bij GRENSGEVAL schrijf je geen tweede regel.
Als je categoriseerde als ONGEPAST: ${ongepastToon}
Als je categoriseerde als OFFTOPIC: ${offtopicToon}

Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u".`
}

/**
 * Extra instructie voor de hoofdchat bij een GRENSGEVAL (docs/CLAUDE_HISTORY.md, 2026-11-18, Arno): de gebruiker koppelt een niet-zakelijk
 * onderwerp aan zijn eigen werk, bijvoorbeeld astrologie aan zijn planning. Zo'n vraag wordt niet geblokkeerd maar serieus beantwoord. ArnoBot
 * bepaalt zelf hoe ver hij gaat, is eerlijk over wat hij niet kan weten of opzoeken, en leert de gebruiker er beter door kennen.
 */
export const GRENSGEVAL_INSTRUCTIE = `

DEZE VRAAG LIGT BUITEN JE VAKGEBIED (sales en business): de gebruiker koppelt een niet-zakelijk onderwerp, zoals astrologie, aan zijn eigen werk of planning. Dit is geen afwijzing en geen reden om af te dwalen. Antwoord serieus en kort. Zeg eerlijk dat dit niet jouw vakgebied is. Je mag meedenken op wat algemeen bekend is, maar wees eerlijk over wat je niet kunt weten of opzoeken: je kunt niet zelf op het web zoeken en je kunt geen actuele stand van bijvoorbeeld planeten of horoscopen berekenen. Vraag of de gebruiker wil dat je meedenkt op wat algemeen bekend is, of dat hij een bron of link deelt. Stel daarbij één vraag over hoe hij dit in zijn werk gebruikt, bijvoorbeeld welke beslissingen hij erop baseert. Gebruik het antwoord om te begrijpen hoe de gebruiker plant en beslist, en breng het daarna terug naar zijn werk. Beoordeel de methode zelf niet en spot er niet mee. Gebruik geen streepjes als leesteken.`

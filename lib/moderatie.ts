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
OK: logisch vervolg op het gesprek, relevant voor sales/business, OF onschuldige humor/luchtigheid die goed meegaat met een eerdere speelse terugkoppeling van ArnoBot

Belangrijk: als het vorige antwoord van ArnoBot hierboven een luchtige, humoristische terugkoppeling naar zaken was, en de gebruiker reageert daar speels en onschuldig op, ook al gaat die reactie zelf niet letterlijk over sales, beoordeel dat dan als OK. De humor heeft dan zijn werk gedaan, dat hoeft niet te tellen als afdwalen. Beoordeel pas als OFFTOPIC als de gebruiker die terugkoppeling negeert en zelf weer een nieuw, ongerelateerd onderwerp aansnijdt. Wees bij ONGEPAST alleen streng bij content die echt verontrustend, seksueel of kwaadwillig is, niet bij onschuldige grappen.

Stap 2: alleen als het niet OK is, schrijf op de TWEEDE regel een korte reactie (1-2 zinnen) in de stijl van Arno Diepeveen die het gesprek terugbrengt naar zakelijk.
Als je categoriseerde als ONGEPAST: ${ongepastToon}
Als je categoriseerde als OFFTOPIC: ${offtopicToon}

Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u".`
}

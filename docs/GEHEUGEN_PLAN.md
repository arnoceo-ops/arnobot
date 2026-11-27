# Geheugenplan: ArnoBot onthoudt meer, zonder oud als nieuw te brengen

## Status

**Laatst bijgewerkt:** 27 november 2026
**Waar we staan:** de 30-dagenregel en de datumreparatie zijn op 27 november naar master gegaan (akkoord Arno, samengevoegd en gepusht). Tests, typecontrole en lint op de samengevoegde code geslaagd. Niet met het model getest en niet in de app nagelopen. Ontwerp C is afgeraden. Terugdraaien: `git revert -m 1` op de samenvoegcommit "feat(geheugen): voortgezet gesprek".
**Eerstvolgende stap:** in de app nalopen met een oud gesprek vanuit het archief. Daarna besluit over opzoeken op vraag (niet goedgekeurd, niet ontworpen).

**Datumregel (gekozen):** eerste en laatste berichtdatum uit `arnobot_rds_logs`. Spreidt een gesprek hooguit 30 dagen, dan telt de leeftijd vanaf het laatste bericht en staat de begindatum erbij. Spreidt het meer, dan blijft de rij zoals voorheen gedateerd. Verworpen: altijd het laatste bericht (oude inhoud uit hetzelfde gesprek zou recent worden). Open: bij meer dan 30 dagen spreiding gelden nieuwe feiten nog steeds op de begindatum. Gemeten op 121 gesprekken: 104 binnen een dag, 13 tot en met 7 dagen, 4 tussen 8 en 30, geen langer. De 6 weken in het geheugen tellen voor gesprekken tot 30 dagen spreiding dus vanaf het laatste bericht. De analyses en de grens van de laatste 10 of 25 gesprekken gebruiken nog de datum van de rij.

- [x] Ontwerp getoetst door agent
- [x] Datering repareren (op de tak)
- [x] Akkoord Arno op live (30-dagenregel en datering), gepusht
- [ ] Akkoord Arno op opzoeken op vraag, dan ontwerp
- [ ] Alleen het ophalen meten op een vooraf bevroren set (zonder testantwoorden)
- [ ] Akkoord Arno op testlat en bedrag, daarna gedragstest

Geen gebruikersgegevens in dit document.

## Maatstaf (Arno, 27 november)

ArnoBot bouwt anders dan een gewone LLM een geschiedenis op van de gebruiker. Het mag niet slechter worden dan het was: beter, of minstens gelijk. De 30-dagenregel staat sinds 27 november op master.

Uitgangspunt: oude samenvattingen en feiten zijn op 31 oktober niet gewist, ze gaan alleen niet meer mee (behalve verwijderde gesprekken en bij Basic alles boven 25 gesprekken).

## Wat op 31 oktober al is geprobeerd

Volgens de commits, in volgorde:
1. `4980ca19`: datum bij herinneringen, ouder dan 6 weken in een eigen blok, voornaam in de prompt, hervat gesprek als gedateerd geheugen.
2. `7a768bee`: datum van vandaag in de prompt, label "x maanden geleden" weg, aangescherpte blokkoppen met de instructie oude herinneringen alleen met datum en als vraag te gebruiken. Volledige oude inhoud ging toen nog mee.
3. `855356ba`: ouder dan 6 weken alleen onderwerp en blijvende feiten. Commitbericht: oude feiten als nu in 5 van 8 runs, na labelen 1 van 8.

Gevolg voor C: een apart blok met datum en een instructie was toen niet genoeg. Niet vastgelegd als geprobeerd: de tijd in elke regel zelf, en alleen inhoud meegeven van gesprekken die bij de vraag passen. In de zaak van toen paste het oude gesprek bij de vraag, dus selectie op relevantie beschermt daar niet.

## Ontwerp C

Blijft: datum van vandaag, voornaam, herstelde samenvattingen, automatisch afsluiten, 30 dagen volledig voortzetten, en voor gewone herinneringen onder 6 weken niets nieuws.

Verandert, alleen voor gesprekken ouder dan 6 weken:
1. **Welke:** het eigen gesprek bij voortzetten na meer dan 30 dagen, plus hooguit 3 oude gesprekken die volgens de bestaande zoekfunctie bij de vraag passen. Ook oude gesprekken binnen de recente 10 of 25: die geven nu alleen een onderwerp en worden door de huidige zoekstap overgeslagen.
2. **Hoe:** code zet voor elke feitregel en samenvatting de tijd erin: "Gesprek van 12 juli 2026, zo stond het toen: ...". Geen herschrijven door een model, geen databasewijziging.
3. **Overige oude gesprekken:** zoals nu, onderwerp en blijvende feiten.
4. **Blokkop:** een korte nieuwe kop, vooraf door Arno goed te keuren.

Niet in C: gedragspatronen over maanden. Dat is het zwakste punt tegen de maatstaf.

## Test

Eerst zonder testantwoorden: per testvraag nagaan dat het juiste oude gesprek wordt gevonden en dat de inhoud in de context staat. Zakt dat, dan geen betaalde test.

Drie opstellingen op dezelfde vragen: vóór 31 oktober (alle oude inhoud mee), nu, en C. Ongeveer 6 onthoudvragen met een antwoord dat vooraf uit de opgeslagen gegevens vaststaat, en 4 valkuilvragen waar oud als actueel kan worden gebracht, waaronder het naspelen van de zaak van 31 oktober. 3 pogingen. Blind beoordeeld.

Lat, vooraf en niet te versoepelen:
- Onthouden: C minstens evenveel juiste feiten als "vóór 31 oktober".
- Oud als nu: C niet vaker dan "nu".
- Haalt C een van beide niet: niet live. Een ronde, daarna eerst besluiten.

Kosten: geschat $2 tot $8, voorstel harde grens $5. Saldo vooraf in de Console nakijken. Beperking: met ongeveer 12 valkuilantwoorden zegt een verschil van 1 weinig.

## Breder dan C (verkenning)

- **Opzoekfunctie:** ArnoBot zoekt zelf in eerdere gesprekken als een vraag daarom vraagt en krijgt het resultaat als gedateerd archiefstuk, eventueel met de letterlijke berichten. Meest volledige vorm van onthouden. Losse bouw met invloed op wachttijd en kosten, niet getest.
- **Gedragspatronen met datum**, apart opgebouwd over maanden. Losse bouw, niet ontworpen.
- Verwant en al gebouwd: terugkerende namen, openstaande acties, mindsetsignaal uit het coachingsdocument, profiel, samenvatting per bewaard document, profiel uit een andere AI.

## Archieflink na 6 weken

Voorstel: laten staan. Met de 30-dagenregel krijgt voortzetten het eigen gesprek mee, vanaf het tweede bericht alle oude berichten (laatste 100). Weghalen haalt iets weg dat de app belooft, en een open tabblad of een bestaande link houdt hetzelfde gedrag.

## Verworpen

- Terug naar vóór 31 oktober zonder meer: het probleem van toen kan terugkomen.
- Datums en een hervatinstructie per bericht (27 november): onthield slechter, zie `docs/ANTWOORDCONTROLE_ONTWERP.md`.
- Continue link na 6 weken verwijderen: voorstel hierboven, nog geen besluit van Arno.

## Uitslag van de toets (27 november)

Uit code en git, niets gedraaid. Punt 1 en de eerste stap van punt 3 door de bouwsessie nagekeken; de rest niet.

1. **Datering klopt niet altijd.** De upsert in `app/api/bot/session-end/route.ts` zet geen `created_at`: die blijft bij de eerste opslag, terwijl samenvatting en feiten opnieuw worden geschreven. Een voortgezet gesprek kan dus nieuwe inhoud met de begindatum krijgen, en nieuwe feiten gelden dan meteen als ouder dan 6 weken. Eerdere samenvattingen worden overschreven; "niet gewist" hierboven geldt daarom niet voor eerdere versies. Raakt ook de 30-dagenregel op de tak.
2. Na voortzetten na meer dan 30 dagen geldt de bescherming een beurt; vanaf bericht twee gaan de oude berichten ongedateerd mee (zo bedoeld en gemeld, niet getest).
3. C lijkt sterk op de tussenstappen van 31 oktober. In deze beschrijving ontbrak `e8e8f1e2` (datums en toetsinstructie). "Voor 31 oktober" als testarm is `e8e8f1e2^` (samenvattingen met dag en maand, feiten zonder datum). Nieuw aan C zijn alleen de tijd per feitregel en minder gesprekken.
4. De zoekstap is zwak: alleen de huidige vraag, een vector per gesprek, ondergrens 0,3 zonder herordening, de 15 kandidaten kunnen door jonge gesprekken gevuld worden.
5. Oud komt ook buiten C binnen: open acties uit de recente 10 of 25 gaan met volledige tekst mee zonder leeftijdsgrens; mindsetsignaal en namen hebben geen jaartal.
6. De testlat is scheef (C kan bij onthouden hooguit gelijkspelen met de oude arm) en ruisgevoelig: ongeveer 12 niet onafhankelijke valkuilantwoorden kunnen een slechtere C laten slagen. Exact naspelen van 31 oktober kan waarschijnlijk niet meer.
7. De kosten waren te laag: 90 antwoorden is ongeveer $6 tot $8, zonder betaalde beoordeling. De grens van $5 was te krap.

## Nieuw voorstel (niet goedgekeurd)

- **Oude inhoud alleen ophalen als de gebruiker naar vroeger vraagt** (opzoekfunctie), niet automatisch op gelijkenis. Zoeken met de vraag plus de recente beurten; `arnobot_memory_entities.session_ids` koppelt genoemde namen al aan gesprekken.
- **Eerst de datering:** eerste en laatste berichtdatum uit `arnobot_rds_logs`, zonder databasewijziging. Dateert nog niet elk feit.
- **Meten in twee stappen:** eerst alleen of het juiste gesprek wordt gevonden en niets bij de valkuilen, op een bevroren set. Dan pas antwoorden, ook de tweede beurt.
- Beperkingen: spontaan onthouden verbetert niet, het herkennen van een vraag naar vroeger kan missen, gedragspatronen blijven open.

## Analyses (nagekeken 27 november)

`app/api/bot/coaching-analyse/route.ts` en `lib/analyseContext.ts`: per geselecteerd gesprek gaan alleen datum, titel en samenvatting mee, niet de berichten. Geen grens van 6 weken, wel alleen uit de laatste 100 gesprekken, 3 tot 20 per analyse. Bij 80% overlap of meer met een eerdere analyse: de vorige tekst plus alleen de nieuwe gesprekken. Voorstel (niet goedgekeurd, niet gebouwd): bij geselecteerde gesprekken de berichten zelf lezen, met een oplossing voor lange gesprekken.

## Coachingsdocument (nagekeken 27 november)

`app/api/bot/coaching/route.ts`: leest van de laatste 50 gesprekken (ongeacht leeftijd) datum, aantal vragen, titel, samenvatting en feiten, plus tot 10 analyses, 10 sparverslagen, een deel van het vorige document en signalen (profiel, plannen, actieopvolging, scoreverloop, excuustaal per gesprek). **Niet de berichten zelf**, terwijl de opdracht naar mindset en taalgebruik vraagt. Of bestaande documenten daardoor fout zijn, is niet gemeten. Zonder testaccounts staan er 12 documenten in de geschiedenis (7 gebruikers, juni tot en met november).

**Open vraag van Arno:** meet wat het kost als alle gesprekken volledig meegaan. Reden: weinig gebruikers vragen een document aan, dus dan moet het goed zijn. Nog niet gemeten: de tokentelling werd geweigerd door de werkruimtelimiet van de `.env.local`-sleutel (tot 1 december). Alternatieven: schatten op tekstlengte, of met akkoord van Arno op een andere sleutel. Het app-tarief voor `claude-fable-5-1` is $10 invoer en $50 uitvoer per miljoen tokens (`lib/aiGebruik.ts`, niet opnieuw bij Anthropic nagekeken). Meetscript (alleen lezen): `C:\Users\arno\arnobot-prive\sessie-27-11\meet-coachingkosten.mjs`.

## Testsleutels en kosten (27 november)

- Op deze computer staan twee Anthropic-sleutels (Windows-variabele en `.env.local`). De tests van die dag liepen op de Windows-sleutel. Alle scripts in `scripts/` dwingen nu de `.env.local`-sleutel af (`scripts/testSleutel.mjs`, CI `scripts/check-test-sleutel.mjs`). Losse tijdelijke scripts en oude takken vallen daar niet onder.
- Volgens de Console stond vrijwel alles van die dag (ongeveer $71, inclusief live) in werkruimte Default. Dat de live app daar ook zit, is afgeleid uit overeenkomende dagbedragen, niet bewezen.
- De werkruimte van de `.env.local`-sleutel gaf "workspace API usage limits" tot 1 december. Of en hoe hoog die limiet is, is niet in de Console gezien.
- Voor een betaalde test: bedrag en harde grens vooraf, akkoord van Arno, en eerst het dagtotaal over alle sessies bekijken.


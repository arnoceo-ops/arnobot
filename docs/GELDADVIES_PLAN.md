# Plan geldadvies: ArnoBot leest bedragen goed en adviseert de juiste kant op

## Status

**Laatst bijgewerkt:** 27 november 2026
**Waar we staan:** ronde 4 klaar: de afgedwongen geldstap is kansrijk (eerste geslaagde antwoorden op de prijsverlaging, geen omdraaiing meer), maar traag, duur en niet foutloos (zie fase 2). Alles zit alleen in testscripts; aan de chat, de prompt en de database is niets aangepast.
**Eerstvolgende stap:** de geldstap staat stil. Er ligt een voorstel (nog niet goedgekeurd) om eerst model en instructies samen te vergelijken op coachgesprekken, zie "Overdracht" onderaan.

- [x] Fase 0: nulmeting en kritische toets van het plan
- [ ] Fase 1: examen goedkeuren (kernset gedaan) en uitbreiden
- [ ] Fase 2: oorzaak aantonen (ronde 1 en 2 gedaan)
- [ ] Fase 3: oplossingen bouwen en meten
- [ ] Fase 4: bewaking en herstel

Gesprekken, namen en bedragen van gebruikers komen niet in dit document of elders in de repo.

## Nulmeting (27 november 2026)

39 gesprekken met bedragen of cijfers (8 gebruikers, juni tot en met november, zonder testaccounts), gelezen door drie agents met elk een derde.

- 162 beurten met geldwerk, waarvan 90 met volgens de lezer een zekere fout (56%), 52 ernstig. De drie delen kwamen elk op 55 à 56%.
- Van 166 toegekende foutlabels in zeven soorten: verkeerde basis of verkeerd gelezen getal 40, aanname als feit 38, tegenspraak 26, gebruiker verkeerd weergegeven 22, richting omgedraaid 14, oordeel zonder beslissend gegeven 14, rekenfout (bij een deel inclusief niet nagerekend) 12.
- Beperkingen: dit is geen gemeten foutpercentage. Elke lezer is hetzelfde type model, bijlagen, geheugen en systeemprompt waren niet zichtbaar, oudere codeversies tellen mee, de afbakening verschilt per lezer en 24 van de 90 foute beurten komen uit één gesprek. De hoofdsessie las een selectie van de zwaarste beurten na, niet alle 90.
- Ernstige fouten komen ook voor in gesprekken van 24 tot en met 26 november, dus na de tabeltool.

## Besluiten

- **Geen losse promptregels als oplossing** (Arno, 27 november). Verworpen: twee aangescherpte regels naar aanleiding van één gesprek.
- **Eerst de oorzaak aantonen, dan pas kiezen** (model, denkstap, promptregels, gestructureerde geldstap, controle vooraf). Verworpen als eerste stap: direct van model wisselen, want dat verandert model en denkstap tegelijk en de diagnose is niet bewezen.
- **Het examen is een regressietest, geen bewijs van veiligheid.** Verworpen als enige lat: "geen omgedraaid advies in 10 tot 15 gevallen". Zelfs 45 foutloze onafhankelijke pogingen sluiten ongeveer 6% fouten niet uit. Daarom ook bewaking in productie en een herstelprocedure. Nul fouten wordt niet beloofd.
- Kwaliteit gaat vóór kosten.
- **Toets (Arno, 27 november):** kan een ontbrekend gegeven het oordeel omdraaien, dan vraagt ArnoBot eerst; anders noemt het de aanname hardop.
- **Toets (Arno, 27 november):** bij een prijswijziging vraagt ArnoBot of de kosten meedalen of al meegedaald zijn.
- **Toets (Arno, 27 november):** vraagt een klant om andere contractvoorwaarden, dan eerst bellen en de aanleiding achterhalen (mogelijk wil de klant weg) en kijken wat de klant kan behouden. Een al gegeven voordeel wordt in dat gesprek benoemd.
- **Toets (Arno, 27 november):** bij korting is de vraag altijd wat je ervoor terugkrijgt, bijvoorbeeld welk commitment. Komt er niets terug, dan praat je waarschijnlijk met de verkeerde persoon of is de relatie niet wat je zou willen. Klanten besluiten nooit alleen op prijs; bij een slechte relatie helpt een lage prijs niet.
- Alle vier de salesoordelen zijn gegeven.

## Fase 1: examen

Kernset van 13 gevallen (11 fout gegaan, 2 goed gegaan). Daarna uitbreiden naar 40 tot 60 met spiegelgevallen, een achtergehouden deel en gevallen waarin niet doorvragen juist is. Per geval vooraf een sleutel: wie betaalt wie, basisbedrag, richting, effect per keuze, onbekenden, toegestane adviezen. Beoordelen blind; een modelbeoordelaar signaleert alleen.

## Fase 2: oorzaak

Dezelfde mislukte beurten naspelen en steeds één onderdeel weghalen: geheugen, kennisbank, eerdere antwoorden, verdachte promptregels. Daarnaast hetzelfde model met en zonder denkstap, en een sterker model.

Hypotheses (niet bewezen):
- De regel "vraag en lever tegelijk" in `lib/systemPrompt.ts` eist eerst een antwoord op de meest logische aanname, zonder plicht die te noemen.
- De regels over altijd een mening en tegen de stroom in openen duwen naar een snel, stellig oordeel.
- De chat draait op `claude-sonnet-4-6` zonder thinking-parameter. Denktokens tellen mee in `max_tokens`, dus een denkstap vraagt meer ruimte.
- De zoekherschrijving voor de kennisbank ziet alleen de laatste vraag.
- Tekst vóór een hulpmiddel wordt niet getoond maar blijft in de context van het model (`lib/chatStreamRonde.ts`). In het gesprek van 26 november waren het alleen korte aankondigingen.

### Uitkomst oorzaakonderzoek, ronde 1 en 2 (27 november 2026)

Goedgekeurd door Arno: de kernset en dit onderzoek. Script: `scripts/examen-geldadvies.ts`. Naspeelkosten samen ongeveer $24.

Ronde 1: huidige opzet, 7 beurten met bewaarde context, 5 pogingen per beurt: 0 van 35 haalde de strenge toets (door de hoofdsessie beoordeeld).

Ronde 2: drie gevallen (prijsverlaging "omgedraaid", btw-vergelijking, inclusief tegenover exclusief btw bij een verlies), 9 opstellingen, 8 pogingen (één mislukt), blind beoordeeld door drie agents, steekproef van 8 nagelezen.

| Opstelling | Prijs: richting omgedraaid | Btw goed vergeleken | Verlies goed berekend |
|---|---|---|---|
| huidig (Sonnet 4.6) | 8/8 | 0/8 | 1/8 |
| zonder geheugen | 7/8 | 0/8 | 1/8 |
| zonder kennisbank | 7/8 | 0/8 | 0/8 |
| zonder gespreksgeschiedenis | 6/8 | 0/7 | 1/8 |
| zonder verdachte promptregels | 8/8 | 0/8 | 3/8 |
| kaal (alleen korte instructie) | 7/8 | 0/8 | 3/8 |
| Sonnet 4.6 met denkstap | 7/8 | 2/8 | 1/8 |
| Sonnet 5.5 met denkstap | 8/8 | 7/8 | 2/8 |
| Opus 5.5 met denkstap | 1/8 (gecorrigeerd na ronde 3, was 2/8) | 8/8 | 6/8 |

Conclusies:
- Geheugen, kennisbank, geschiedenis en de verdachte promptregels zijn niet de hoofdoorzaak: ook zonder ArnoBot-prompt komen dezelfde fouten. De hypothese over "vraag en lever tegelijk" is voor deze gevallen niet bevestigd. Bij het verliesgeval gaf "zonder regels" vaker de goede richting (7/8 tegen 2/8), bij de andere twee niet.
- Een denkstap op hetzelfde model helpt weinig. Het model maakt het grootste verschil; Opus 5.5 is duidelijk het beste, niet foutloos.
- Geen enkel antwoord van 72 op de prijsverlaging vroeg of de gebruiker met de klant door wil. Arno's salestoets komt niet vanzelf uit een sterker model.
- Mediane tijd tot de eerste tekst (effort high, drie tegelijk): huidig 5 s, Opus 5.5 38 s, Sonnet 5.5 27 s, Sonnet 4.6 met denkstap 66 s. Woorden per antwoord: huidig 189, Opus 466. Geschatte kosten per antwoord: huidig $0,084, Opus $0,28.
- Beperkingen: 3 gevallen, 8 pogingen (verschillen van 1 à 3 zeggen weinig), beoordelaars zijn ook Claude, lagere effort niet getest, toon niet beoordeeld.

**Niet gekozen (nog niet):** direct overstappen op Opus 5.5. Wachttijd, lengte, toon en lagere effort zijn niet getest.

### Ronde 3: Opus 5.5 op lagere effort, met en zonder geldstap (27 november 2026)

96 antwoorden, zelfde drie gevallen, 8 per combinatie, blind beoordeeld door dezelfde beoordelaars. De geldstap is hier alleen een extra instructie (tekst in `scripts/examen-geldadvies.ts`), gebaseerd op Arno's oordelen over deze gevallen; de uitslag is daardoor waarschijnlijk te gunstig.

| Meting (midden en laag samen) | Zonder geldstap | Met geldstap |
|---|---|---|
| Prijs: richting omgedraaid | 7/16 | 2/16 |
| Prijs: zonder schadelijke fout (omgedraaid, verzonnen, rekenfout) | 6/16 | 8/16 |
| Prijs: vraagt of de gebruiker met de klant door wil | 0/16 | 0/16 |
| Prijs: vraagt naar meedalende kosten | 0/16 | 2/16 |
| Korting: btw goed | 16/16 | 16/16 |
| Korting: vraagt wat je terugkrijgt | 4/16 | 12/16 |
| Verlies goed berekend | 14/16 | 14/16 |

- Laag en midden verschillen niet duidelijk in kwaliteit. Mediaan tot eerste tekst: laag 19 tot 20 s, midden 29 s; 380 tot 427 woorden. Geschat $0,23 tot $0,26 per antwoord.
- De instructie noemt "wil en kan je met deze klant door" letterlijk, en geen van de 32 prijsantwoorden (16 met de instructie) vroeg het. Een instructie dwingt niet af.
- Alle prijsantwoorden beginnen met de foute eerdere antwoorden in de geschiedenis. Een eerste oordeel zonder die geschiedenis is niet opnieuw getest.
- Beoordelaars rekenden geheugenfeiten als verzonnen omdat zij het geheugen niet zagen; de strenge score op het kortingsgeval is daarom niet bruikbaar.
- Testkosten ronde 1 tot en met 3: ongeveer $47.

**Voorstel (nog niet goedgekeurd): afgedwongen geldstap, alleen in de test.** Stap 1: het model vult verplichte velden (per bedrag wat het is, gegeven of aanname, effect per keuze, doorgaan met de klant bekend of onbekend, kosten, tegenprestatie) via structured outputs (geforceerde tool_choice werkt niet op Opus 5.5 en Sonnet 5.5 volgens de API-documentatie in de claude-api skill, 27-11). Stap 2: code controleert; ontbreekt een beslissend veld, dan moet het antwoord een vraag zijn. Stap 3: schrijven en controleren of richting en argumenten kloppen met de velden. Verworpen als eindoplossing: alleen de instructie.

### Ronde 4: afgedwongen geldstap (27 november 2026)

Harde grens $20 (Arno), in het script afgedwongen; uitgegeven ongeveer $18,90 plus $0,01 voor de herkenning, 4 antwoorden niet gedraaid. Vier gevallen laten zien of de aanpak kansrijk is, niet of hij veilig is.

Herkenning van een geldvraag (`claude-haiku-5-5`, verwachting vooraf vastgelegd): 0 van 24 geldvragen gemist (waaronder 20 verzonnen vragen zonder geldtaal), 4 van 46 vals alarm, 5 twijfelgevallen niet geteld, mediaan 1 s. De 20 verzonnen vragen zijn door de bouwer zelf geschreven.

Geldstap met Opus 5.5 (laag) voor invullen, schrijven en controleren, 7 pogingen per geval, blind beoordeeld:

| Geval | Geslaagd | Opmerking |
|---|---|---|
| Prijsverlaging, eerste oordeel (zonder foute voorgeschiedenis) | 4/7 (Opus zonder geldstap en met alleen de instructie: 0/6 en 0/6) | 0 omgedraaid, 0 verzonnen (zonder geldstap 5/6), rekenfout 3/7 |
| Prijsverlaging, slot | 5/7 (eerdere opstellingen: 0) | 0 omgedraaid, 0 verzonnen, rekenfout 2/7 |
| Korting | 7/7 | de code dwong de vraag naar de tegenprestatie niet af (blad zei 6/7 "bekend"); streng geteld vragen 3/7 echt iets terug; Arno's punt over gesprekspartner en relatie in 0/7 |
| Verlies | 5/7, bedrag 7/7 | geen duidelijk verschil met zonder geldstap |

- Alle 14 prijsantwoorden stelden het oordeel uit en vroegen naar doorgaan en kosten (instructie alleen: 0/32 vroeg naar doorgaan). Streng geteld vallen twee geslaagde prijsantwoorden af op een wankele kostenredenering.
- Resterende fout bij de prijs: voorwaardelijke kostenscenario's in de uitleg bij de vragen.
- Mediaan 59 s wachten, 343 woorden, ongeveer $0,52 per antwoord (huidige chat $0,084).
- De controle vooraf is streng (bij de prijs en het verlies keurde hij bijna elk eerste concept af, een deel ook het tweede). Of hij de uitkomst verbetert is niet gemeten.
- Sonnet 5.5 als invulmodel na een proefrit van 2 antwoorden niet verder getest: vulde 21% btw in en het schrijfmodel nam dat over; niet sneller. Weinig bewijs. 9% op frisdrank nagegaan via zoekresultaten (belastingdienst.nl, khn.nl, 27-11), niet in de officiële tabel.

**Volgende verbeteringen (nog niet gebouwd):** bij korting vraagt de code altijd naar de tegenprestatie (Arno: "altijd"), los van wat het model invult; geen rekenscenario's zolang er vragen openstaan; meten wat de controle oplevert. **Afspraak (Arno):** voor het grote examen (40 tot 60 gevallen) eerst het bedrag noemen en akkoord vragen.

## Fase 3 en 4: kandidaten

- Gestructureerde geldstap: per bedrag vastleggen wat het is, met bronfragment of "aanname"; code rekent per keuze het effect en de richting.
- Controle vóór tonen bij geldadvies. De controleur leidt feiten en richting af zonder het concept te zien. Vooraf bepalen wat er bij onenigheid of storing gebeurt; detectie en vals alarm meten.
- Bewaking in productie: de huidige crons zien uitgeschreven sommen en brondekking, geen omgedraaid advies.
- Herstel: een fout advies werkt door in samenvatting, uitdaging, geheugen en sparadvies.
- Sparren en voice apart nalopen.
- `scripts/eval-cijfers.ts` wijkt af van de echte chat (telt weggefilterde tekst mee, zonder geheugen); het examen gebruikt de logica van de route.

## Overdracht (27 november 2026)

**Bestanden met gebruikersgegevens** (gevallen, sleutels, uitslagen, herkenningssets) staan buiten de repo in `C:\Users\arno\arnobot-prive\examen-geldadvies\`. Het is een kopie van de tijdelijke map van de bouwsessie. Hulpscripts daarin kunnen nog naar het oude pad verwijzen.

**Aanleiding voor een breder voorstel:** ook een coachgesprek zonder geldvraag bevatte leesfouten en toeschrijvingen die niet in de stukken stonden. Een verzonnen versie in ChatGPT (een ronde) gaf vergelijkbare leesfouten, en was als coaching op enkele punten breder.

**Voorstel, nog niet goedgekeurd:**
- 2 bij 2: huidig model (Sonnet 4.6) en Opus 5.5 met denkstap, elk met de huidige instructies en met korte instructies zonder tegenstrijdigheden. Ongeveer tien lastige coachgesprekken, geldgevallen meegenomen, blind beoordeeld, lat vooraf. Geschat $20 tot $30 bij drie pogingen op een beslissend antwoord per gesprek, stoppen bij $30.
- Eerst een agent zonder voorgeschiedenis de aannames laten aanvallen.
- Gezien in `lib/systemPrompt.ts`: "vraag en lever tegelijk" (altijd eerst een antwoord op een aanname) botst met "een richting" (eerst een vraag, nog geen advies). Dat dit fouten veroorzaakt is niet bewezen; ronde 2 bevestigde het voor de geldgevallen niet.

**Geparkeerd tot na die vergelijking:** de drie verbeteringen onder ronde 4 en het grote examen (apart akkoord op het bedrag).

### Bijgesteld na controle door een agent zonder voorgeschiedenis (27 november 2026)

**Grens (Arno):** testantwoorden samen maximaal $10, uit het actietegoed. Dit vervangt het voorstel van $20 tot $30 en het 2 bij 2.

- **Eerst zonder testantwoorden:** bestaande antwoorden uit 6 tot 10 gesprekken ontleden. Per fout: stond de informatie in wat het model zag, welke instructie speelde, ontstond de fout hier of eerder. Daaruit volgen de gevallen en sleutels.
- **Daarna:** huidig tegen Opus 5.5 op effort laag, beide met de huidige prompt. 8 beurten (6 mislukt uit minstens 5 gesprekken, hooguit 2 uit een gesprek en hooguit 2 over geld, plus 2 goed gegaan), 2 pogingen. Verwacht $5,45, ongunstig $9,10. `EXAMEN_MAX_USD=10` zetten (standaard onbegrensd).
- **Vooraf vastleggen:** lat per foutsoort, maximale wachttijd en lengte. Juryleden zien alles wat het model zag.
- **Verworpen voor deze ronde:** de korte prompt. Weinig voorbewijs, geheugenteksten bevatten zelf ook instructies, past niet in het budget en vraagt een schrijver die de gevallen niet zag.
- **Naspelen is niet gelijk aan live:** `bron_context` mist delen van bijlagen en sessiedocumenten, historie vervalt live na 48 uur, en het script mist linktool, documentlezer en vervolg na `max_tokens`. Per geval controleren, niet getrouwe gevallen vervangen.
- **Uitslag zegt alleen** of het op deze beurten kansrijk is. Geen foutpercentage, veiligheid of gedrag over hele gesprekken.

### Ontleding van bestaande antwoorden (27 november 2026)

10 gesprekken, 73 beurten, 3 gebruikers, gelezen door een agent (niet blind, bewust veel lastige gesprekken, dus geen foutpercentage). 26 ernstige fouten: geld 6, vermoeden als feit 6, toeschrijving 4, voorbarig oordeel 4, andere vraag niet gezien 2, overig 4. Informatie was 19 keer zichtbaar, 5 keer niet, 2 keer onbekend. Voor de zwaarste toeschrijvingen en vrijwel alle geldfouten is geen instructie aanwijsbaar. Details en 8 gevallen: `C:\Users\arno\arnobot-prive\coach-ontleding\`.

**Los van het model:** bij het eerste bericht na meer dan 48 uur stilte stuurt de chat geen geschiedenis mee (`app/api/chat/route.ts`, `effectieveHistory`; `lib/geheugenContext.ts`, `verouderd`). Alleen het onderwerp van toen gaat mee, en in het ontlede geval meldde ArnoBot niet dat het de eerdere berichten niet zag. Bewuste keuze van 31 oktober (oude berichten kwamen over als "nu"), dus niet zomaar terugdraaien. Nog geen oplossing gekozen.

**Teststand:** 8 gevallen klaar (6 mislukt, 2 goed; 2 onder voorbehoud). Geschat $3,64, ongunstig $7,40. Wacht op akkoord op gevallen en lat.

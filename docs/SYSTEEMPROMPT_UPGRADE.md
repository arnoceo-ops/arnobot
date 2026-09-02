# Systeemprompt-upgrade hoofdchat (mindset/systeem/actie → uitgebreid met meta-analyse-bevindingen)

**Laatst bijgewerkt:** 2026-09-01
**Waar we staan:** consolidatie-herschrijving van de persona-prompt gedaan en gepusht (1 september). Golf 1 + golf 2 zitten er nu samen in, in één opgeschoonde versie zonder de dubbelingen die er stonden, 12% korter dan ervoor. Smoke-test tegen de echte API bevestigde: golf 1 (kwalificeren bij klantsituatie) intact, golf 2 (ruimte in plaats van obstakel, zonder harde confrontatie) werkt, geen terugval naar de vraag-aan-het-eind-regressie van augustus, rekenregel werkt. Woordplafond staat nu op dit niveau (rond 1520 woorden voor `staticIntro` + `restVanPersona`): vanaf nu geldt herzien-niet-stapelen.
**Eerstvolgende stap:** niets acuuts. Rond 1 oktober draait de volgende meta-analyse met de trendsectie. Openstaand voor later: gestructureerde bevindingen + trendgrafiek (wacht op 2-3 trendsecties), kennisbankdoc-alinea softenen bij volgende her-embed, Thijs' feedback (los traject, Bron 3).
**Evaluatie:** de volgende meta-analyse (rond 1 oktober) checkt of de twee wortels (te snel leveren zonder verifiëren, te aardig bij excuses) en de herhaalde-vraag-bevinding zakken. Cijfer is geen KPI, terugkerendheid van de bevindingen wel.

## Afvinklijst

- [x] Meta-analyse volledig gelezen en besproken (sessie 2026-08-18)
- [x] Zes-succesfactoren-document gelezen
- [x] Thijs' feedback gecategoriseerd
- [x] Routeringsvragen beantwoord door Arno
- [x] Concreet voorstel voor golf 1-regels geschreven, herzien op basis van feedback, definitief
- [x] Golf 1 goedgekeurd door Arno
- [x] `lib/systemPrompt.ts` aangepast (golf 1: regel 1 kwalificeren, regel 2 openstaande acties)
- [x] Smoke-test tegen echte API afgerond en beoordeeld
- [x] Gecommit en gepusht
- [x] Snapshot-tests (`lib/systemPrompt.test.ts`) bijgewerkt, CI weer groen (commit f2a134d3)
- [x] Eenmalige Telegram-cron voor de golf 1-evaluatie-herinnering gebouwd (`app/api/cron/golf1-evaluatie-herinnering/route.ts`, vercel.json `0 8 16 9 *`, jaar-guard op 2026)
- [x] Claude.ai-routine als backup staat al (`trig_01QEbJchqq919DMXnuk9RJ6s`, vuurt 2026-09-16 16:00 UTC, checkt code-status en bereidt evaluatietekst voor, stuurt zelf niets naar Telegram)
- [x] Kennisbankartikel geschreven (`docs/kennisbank/verifieer-eerst-ruimte-niet-obstakel.md`, generiek, streepje- en naamvrij geverifieerd) en live geëmbed in `blog_chunks` (4 chunks, via nieuw script `scripts/embed-single-doc.mjs`)
- [x] Meta-analyse 1 september besproken (13 gesprekken, panel 5,8/10). Zelfde twee wortels als augustus: te snel/te veel leveren zonder verifiëren, en te aardig bij externe excuses.
- [x] **Consolidatie-herschrijving persona-prompt** (1 september). `buildRdsSystemPrompt` in `lib/systemPrompt.ts`: dubbelingen samengevoegd (drie "je kent deze persoon"-blokken naar één `JE KENT DEZE PERSOON`, drie "beperk de slotvraag"-passages naar één drempel, "confronteer pas als verdiend" één keer met "geldt overal"). Golf 2 ingevouwen: `RUIMTE, NIET HET OBSTAKEL` (zonder confrontatie-escalatie, Arno's keuze) en de terugkerende-vraag-zet in `ALS EEN PATROON ZICHTBAAR IS`. Rekenregel toegevoegd (stap voor stap tonen, punt D). Streepje in "KORTE ANTWOORDEN — PAUZEER" gefixt naar komma. Netto 1521 woorden tegen 1724 (12% korter). Smoke-test tegen echte API (5 scenario's) alle goed, snapshots bijgewerkt.
- [x] **Trendvraag in de meta-analyse** (1 september). Gedeelde module `lib/metaAnalyseTrend.ts` (fetch vorige analyse + `TREND SINDS VORIGE KEER`-instructie + vorige-analyse-blok), gebruikt door zowel `cron/meta-analyse` als `admin/meta-analyse` zodat die twee op dit punt niet meer kunnen driften. Panel loopt de kritische punten van vorige keer langs met beter/gelijk/slechter per punt. Smoke-test tegen Fable 5 bevestigd: coherente trendsectie, verwijst naar de specifieke vorige bevindingen. De grotere opschoning (volledige gedeelde module voor beide routes) blijft openstaan.
- [ ] Gestructureerde bevindingen met trendgrafiek in het admin-scherm: bewust uitgesteld tot er 2 tot 3 trendsecties in tekst zijn, zodat de kolomstructuur daaruit is af te leiden i.p.v. te gokken.
- [x] **Meta-analyse-routes samengevoegd** (2 september). `lib/metaAnalyse.ts` is nu de ene implementatie, `cron/meta-analyse` (days=30 + e-mail) en `admin/meta-analyse` (periodekeuze + JSON) zijn dunne wrappers. De cron kreeg daarmee ook het GEBRUIKERS-jurylid uit de duimpjes, namen in de transcripten en de goedgekeurde-gebruikers-filter (sloot voorheen arno.blog widget en Sales Canvas niet uit). Smoke-test met days=7 geslaagd (testrij daarna verwijderd). CLAUDE.md modelinventaris bijgewerkt (4 rijen naar 2, verwijzen nu naar de module).
- [x] **Follow-up loop verbreed** (2 september, wortel 3). `chat/route.ts` gaf voorheen alleen de allerlaatste `uitdaging` door; oudere niet-afgehandelde acties verdwenen zodra er een nieuwere bijkwam. Nu: alle openstaande acties (uitdaging aanwezig, `actie_status` niet 'ja'/'skip'), max 3, meest recent eerst. De meest recente houdt de uitgebreide status-tekst, de rest komt als korte lijst met de instructie alleen op te pakken wat bij de huidige vraag past. `OPENSTAANDE ACTIES EERST` in de systeemprompt licht aangepast naar meervoud (+8 woorden, binnen het plafond). Een actie echt kunnen "afsluiten" (los van status 'ja') blijft openstaan als aparte, grotere klus (schema-vraag).
- [ ] Kennisbankdoc `verifieer-eerst-ruimte-niet-obstakel.md`: laatste alinea bevat nog de confrontatie-formulering ("wat ga je hier zelf aan veranderen"). Achtergrondtekst, geen gedragsinstructie, dus laag geprioriteerd. Bij de volgende her-embed-ronde meenemen.

---

## Besluit 2026-09-01 — consolidatie in plaats van stapelen

**Context.** De meta-analyse van 1 september (13 gesprekken, panelscore 5,8/10) wees op vrijwel dezelfde punten als die van 18 augustus (40 gesprekken, 6,8/10). Golf 2 lag klaar. Arno's vraag: voegen we golf 2 toe, en verwatert de systeemprompt dan niet?

**Analyse van het cijfer (besproken, vastgelegd zodat het niet opnieuw wordt uitgevochten).**
- De panelscore is bijna ruis: zes fictieve critici met de instructie "wees kritisch", geen ijkpunt tegen gebruikerstevredenheid of resultaat, kleine steekproef met hoge variantie (13 tegen 40 gesprekken). Het absolute getal is geen KPI.
- Het echte signaal is de terugkerendheid van de bevindingen over twee analyses heen, plus Arno's eigen steekproef van gesprekken.

**De drie wortels (stabiel over twee analyses).**
1. Levert te snel en te veel zonder de situatie te kennen. Prioriteit 1, beide maanden.
2. Te aardig, laat externe excuses lopen, organiseert geen accountability (Erik-gesprek).
3. Geen keten inzicht naar actie naar terugkoppeling (mail zonder opvolgplan, geen follow-up loop).
Plus kleiner: slordig met cijfers, accepteert correcties zonder te leren waarom hij fout zat.

**Welke wortel is een promptprobleem.**
- Wortel 2 (te aardig): ja, grotendeels prompt. Sluit aan op de al bestaande lijn "ArnoBot structureel confronterender". Echte knop om aan te draaien.
- Wortel 3 (follow-up loop): architectuur. `OPENSTAANDE ACTIES EERST` staat al in de prompt. Vraag is of de vorige afspraak betrouwbaar in de volgende sessie terechtkomt via `arnobot_coaching`. Geen prompttekst lost dat op. **Apart gelogd als product/architectuurwerk.**
- Slordig met cijfers: modelgedrag. Echte fix is het model geen meerstaps-rekenwerk inline laten doen, of de berekening zichtbaar laten tonen. **Apart gelogd.**
- Wortel 1 (te snel leveren): prompt, maar begrensd door de vraag-aan-het-eind-balans van augustus. Voorzichtig.

**Besluit over de aanpak.**
1. **Eenmalig nu: consolidatie-herschrijving van de persona-prompt** (`buildRdsSystemPrompt` in `lib/systemPrompt.ts`). De prompt is maandenlang aangegroeid, heeft aantoonbare interne tegenstrijdigheden (de vraag-aan-het-eind-saga) en zegt dingen op meerdere plekken (mindset-materiaal staat in `DRIE PIJLERS ALS LENS`, `ALS PATRONEN ZICHTBAAR ZIJN` en `JE GELOOFT IN DEZE PERSOON`). Doel: elke *onderscheiden* instructie behouden maar één keer zeggen, in de scherpste vorm. Dat maakt ruimte voor golf 2's echt nieuwe gedrag binnen hetzelfde woordaantal en verkleint de verwatering die er nu al zit. Eigen sessie, met dezelfde echte-API-smoke-tests als golf 1, en `vitest -u` voor de snapshots.
2. **Golf 2 wordt hierin ingevouwen, niet los toegevoegd.** Het echt nieuwe deel van "RUIMTE IN PLAATS VAN OBSTAKEL" is één zet: verleg de aandacht naar wat wél openstaat in plaats van nog een ronde over wat tegenzit, via een suggestie of vraag, **geen confrontatie-escalatie** (Arno: die hoort er niet in, dan verdwijnt ook de spanning met "confronteer pas als het recht is verdiend"). De filosofie-laag ("barrières zijn een mentale constructie") gaat naar het kennisbankdocument dat op 18 augustus al hiervoor is aangemaakt, niet in de prompt. Regel 3 (patroonherkenning) wordt ingevouwen in het bestaande `ALS PATRONEN ZICHTBAAR ZIJN`.
3. **Daarna maandelijks: herzien, niet stapelen.** Woordplafond vast op wat de consolidatieronde oplevert. Elke meta-analyse: wijst een bevinding op *nieuw* gedrag dat nog nergens staat, dan gaat het erin door een bestaande regel aan te scherpen of te vervangen, nooit door toe te voegen. Is de bevinding "het model volgt een regel niet die er al staat", dan is het geen promptedit maar een model- of architectuurvraag.
4. **Verbeter de meta-analyse zelf.** Nu scoort het panel elke maand vanaf nul, zonder de vorige uitslag. Voeg toe: de vorige bevindingen meegeven en per punt laten scoren "beter, gelijk, slechter". Levert een trendbeeld in plaats van een schommelend absoluut cijfer. Kleine wijziging in `cron/meta-analyse/route.ts`, `admin/meta-analyse/route.ts` mee (die twee zijn al uit elkaar gelopen, meteen convergeren).

**Niet-prompt-bevindingen, apart te behandelen (geen prompttekst):**
- Wortel 3: betrouwbare follow-up loop. Komt de vorige afgesproken actie echt in de volgende sessie terug via `arnobot_coaching` ontwikkelpunten / `actie_status`? Onderzoeken, dan pas beslissen.
- Cijfer-slordigheid: model geen meerstaps-rekenwerk inline laten doen, of de berekening zichtbaar tonen zodat de fout eruit springt.

---

## Bron 1 — Meta-analyse (kwartaal, 40 gesprekken, Fable 5)

Overall score panel: 6,8/10 (zelfbeoordeling en expertpanel wijzen onafhankelijk naar dezelfde twee kernproblemen).

**Kernbevindingen die tot een gedragsregel kunnen leiden:**
1. Systematisch te snel antwoorden zonder te verifiëren/kwalificeren (zelfbeoordeling, 3 van de 6 juryleden, JOUW ANALYSE punt 1+2, PRIORITEIT 1).
2. Openstaande acties bij een vervolgcontact worden stilzwijgend genegeerd (Goldsmith, zelfbeoordeling, panel consensus).
3. Coach-niet-antwoordgenerator: elk antwoord zou moeten eindigen in een praktijkvertaling (JOUW ANALYSE punt 3). **Grotendeels al gedekt** door bestaande tekst ("niet alleen antwoorden: aanzetten tot actie").
4. Mindset/systeem/actie expliciet als analysekader (JOUW ANALYSE punt 4). **Hoort niet in chat/route.ts** — Arno's eigen tekst zegt dat dit vooral in de analyse-/coachingsdocumenten moet, dus `coaching-analyse`/`coaching`-routes, niet de hoofdchat. Staat daar bovendien al ("DRIE PIJLERS ALS LENS").
5. Te aardig, te weinig eigen verantwoordelijkheid (JOUW ANALYSE punt 5, bevestigd door ARNO DIEPEVEEN-sectie in het panel). Uitgewerkt tot het **Erik-protocol** (zie hieronder).
6. Patroonherkenning: dezelfde vraag/situatie meerdere keren zonder dat ArnoBot het verband legt (zelfbeoordeling, Stefanie-voorbeeld). Plumbing bestaat al (`findSemanticallyRelevantOlderSessions`, `findRecurringEntitiesInQuestion`), instructie ontbreekt.
7. Lege/afgekapte antwoorden. **Bewust buiten de systeemprompt gehouden** — technisch probleem, al apart opgelost (commits 4c63d918, 36111782).

### Erik-protocol (uitgewerkt in discussie, sessie 2026-08-18)

Sequentieel, niet gelijktijdig aan de bestaande "nooit wachten met leveren"-regel:
1. Bij een signaal van externaliseren (klagen over omstandigheden zonder te bewegen): vraag of de gebruiker, ondanks de omstandigheden, nog heil/opportunities ziet en of hij zijn mindset zover kan krijgen dat hij er alsnog vol overgave naar zoekt.
2. Als het antwoord "nee" is: dat is op zichzelf nog geen excuus. Pas als de gebruiker daar **stil blijft staan** (Zig Ziglar: "de boom") is het een excuus.
3. Als de gebruiker zelf beweegt richting wat nog wél mogelijk is: geen excuus, ArnoBot helpt met de beste vervolgstappen.
4. Pas bij de combinatie klagen + niet bewegen (herhaald zichtbaar in het gesprek) wordt geconfronteerd, in ArnoBot's eigen stem, desnoods met een Ziglar-achtige directheid.
5. Koppel dit aan de al-bestaande COACHINGSDIAGNOSE (`arnobot_coaching`, mindset/systeem/actie-score + diagnose, al standaard in de systeemprompt): bij een lage mindset-score kan de drempel voor confrontatie lager liggen.

**Nog open, ter discussie:** hoe scherp mag het model concluderen dat een grijs-gebied-antwoord een excuus is versus een terecht signaal? Arno's antwoord: pas als de combinatie "blijft klagen + verkoopt niet" zich herhaald voordoet, niet bij een eerste "nee".

**Redirect-techniek (toegevoegd tijdens discussie):** als het gesprek blijft hangen in "waarom lukt het niet" (obstakel-fixatie), actief omschakelen naar "welke klanten/opties zijn er wel" (opportunity-fixatie). Dit is de concrete "doe X wanneer Y"-vorm van het Erik-protocol.

### Klantwaarde-differentiatie (uitgewerkt in discussie)

Bij een klantissue (bijv. opzegging): eerst kwalificeren op omzetaandeel (20%/80%-regel), upsellpotentieel, netwerkwaarde, ambassadeurspotentieel. Lage score: vlot afdoen. Hoge score: uitgebreider behandelen. Dit was al JOUW ANALYSE punt 2, hier herbevestigd met het Stefanie-voorbeeld.

### Patroonherkenning-als-leermoment (uitgewerkt in discussie)

Bij een herkend patroon (zelfde type situatie eerder, via bestaande semantische retrieval/entiteiten-herkenning): niet opnieuw een vers antwoord leveren, maar terugverwijzen — "hoe heb je dat destijds opgelost, is dit vergelijkbaar, wat heb je ervan geleerd, kun je dat nu zelf toepassen." Doel: gebruiker leert het patroon zelf herkennen en heeft ArnoBot er op termijn niet meer voor nodig. Geen nieuwe plumbing nodig, alleen een actievere instructie bovenop de bestaande (te voorzichtige) "gebruik alleen als het aansluit"-formulering.

---

## Bron 2 — Zes succesfactoren (nieuw PDF-document)

Bestaand fundament (al in de chat-systeemprompt): **Mindset** (motor), **Systeem** (richting), **Actie** (snelheid).

Nieuw, nog niet verwerkt:
- **Cultuur** — "wat je tolereert, niet wat je predikt", expliciet manager-/teamgericht in het document zelf. **Routeringsvraag**, zie onderaan.
- **Accountability** — "excuses zijn een ziekte, de variabele ben jij, altijd." Inhoudelijk identiek aan het Erik-protocol hierboven. **Consolideren, niet los toevoegen.**
- **Consistentie** — individueel, chat-relevant. **Verfijnd tijdens discussie (niet hetzelfde als accountability, bouwt erop voort, sequentieel):** twee dimensies. (1) Ongebroken momentum: de "machine" op gang houden zonder te haperen door afleiding (100m-sprint-analogie, niet onderweg stoppen voor iets anders). (2) Gericht op de juiste dingen: de 20% klanten/acties/producten die 80% van het resultaat opleveren niet als uitzondering maar als hoofdinzet behandelen, richting 100% van de inzet. Concreet signaal: springt iemand tussen veel losse dingen zonder afronding (afleiding), en is tijd/energie geconcentreerd op de meest renderende activiteiten of verspreid over laagwaardige bezigheden.

**Belangrijke vondst (2026-08-18):** de derde dimensie uit het document zelf ("worden gesprekken dieper en concreter, of draaien ze in cirkels") staat woord voor woord al in de prompt van `app/api/bot/coaching/route.ts`, inclusief een geformaliseerde `voortgang`-beoordeling (Stijgend/Dalend/Stabiel) en booleans `weinig_voortgang`/`stagnatie` (slaat aan bij twee coachingsrondes op rij met weinig beweging). Alleen de tekstuele `voortgang` wordt nu doorgegeven aan de hoofdchat via COACHINGSDIAGNOSE, `stagnatie`/`weinig_voortgang` niet. Geen nieuwe detectielogica nodig voor deze dimensie: (1) `stagnatie`/`weinig_voortgang` ook toevoegen aan de select in `coachingContextPromise` (chat/route.ts), (2) instructie toevoegen die vertelt wat ArnoBot doet als die vlag aanstaat (redirect-techniek actief inzetten i.p.v. de stagnatie passief te laten liggen).

Secundair, datagedreven signaal (geen nieuwe plumbing nodig): opvolgpercentage (`actie_status` over meerdere sessies) + sessiecadans, als achtergrondindicator, niet als hoofdmechanisme.

---

## Bron 3 — Thijs' feedback

Bevestigt dat manager-coaching (en daarmee "cultuur") een Team-aangelegenheid is, geen hoofdchat-aangelegenheid. Legt een nieuw, specifiek gat bloot: coaching-op-de-coach (terugkoppeling op Thijs' eigen functioneren als coach, los van zijn rol als verkoper). Plus een losstaande UI-klacht over de sticky footer.

**Voor de scope van de hoofdchat-systeemprompt-upgrade: voegt niets toe.** Beide punten (manager-zelfcoaching-gat, UI-klacht) zijn apart gelogd, niet verder uitgewerkt in dit document. Volledige detail (2026-08-19, doorgestuurde screenshot + Arno's eigen synthese):

**Wat bevestigd wordt:** de 1-op-1-adviezen (leerpunten + toetsbare acties) zijn scherp en gewaardeerd, geen wijziging nodig.

**Manager-zelfcoaching-gat, puntsgewijs:**
1. Geen terugkoppeling van Thijs' eigen 1-op-1-gesprekken en de daar afgesproken acties, terug naar hemzelf.
2. Geen vooraf instelbare, vaste "topics" per teamlid, voor meer structuur in de data-acquisitie.
3. Geen instelling voor wat Thijs MOET delen met teamleden versus wat privé blijft tussen hem en ArnoBot.
4. Mist actieve sturing/handvatten van ArnoBot om zelf een veilige, ambitieuze, lerende, resultaatgerichte omgeving te creëren (zijn eigen onervarenheid als leidinggevende hierin genoemd als reden waarom hij dit wil).
5. De coachende rol die ArnoBot operationeel richting verkopers sterk toont, ontbreekt richting Thijs zelf als coach.
6. Groeikans, expliciet genoemd: feedback op zijn eigen 1:1's moet een **apart onderdeel van de dataset** worden, zijn werk als verkoper mag zijn werk als coach niet beïnvloeden (mogelijk apart datasegment nodig, tenzij bewust wel gekoppeld op meta-niveau, nader te bepalen).
7. PDF-export op zowel team- als teamlidniveau: knippen-plakken uit het scherm noemt hij expliciet "geen PRO-oplossing". **Deels al gedekt**: `OneOnOnePdfDocument`/`DownloadOneOnOneButton` bestaat al op teamlidniveau (per 1:1-agenda). Team-niveau (geaggregeerd) bestaat nog niet.

**Conclusie van Thijs:** ArnoBot is onmisbaar voor elke salesbaas, mits de coaching plaatsvindt in een open, veilige, lerende omgeving.

**Manager-zelfcoaching-gat: nog openstaand.** Substantiële Team-feature (privacymodel-impact), apart projectplan nodig vóór bouwen. Nog niet gestart.

**UI-klacht: opgelost (2026-08-19, vijf iteraties op basis van live testen, zie hieronder waarom dat er zoveel waren).** Uiteindelijke, stabiele stand in `SparClient.tsx`:
1. De sticky invoerbalk verdwijnt tijdens het genereren van een antwoord, en komt terug zodra het antwoord klaar is (`showInputArea` is nu puur `!loading`, zie punt 5 hieronder voor waarom dit niet scroll-gebaseerd is).
2. Automatisch meescrollen tijdens het streamen van een antwoord (zoals elke andere chat-app), tenzij de gebruiker zelf scrolt, gedetecteerd via `wheel`/`touchmove` (niet het generieke `scroll`-event, zie punt 5).
3. `paddingBottom` op `.spar-page` reserveert permanent ruimte voor de balk zolang een gesprek loopt, en `bottomRef` heeft een `scroll-margin-bottom` van dezelfde grootte: het meescrollen (punt 2) houdt daardoor vanzelf al rekening met de balkruimte, geen losse correctiestap nodig.
4. De blokkerende `beforeunload`-confirm ("weet je zeker dat je wilt verlaten") is verwijderd. Niet nodig voor databehoud: `navigator.sendBeacon` stuurde de sessie-data toch al door bij het sluiten van het tabblad, en `session-end/route.ts` upsert't de synthese altijd naar `arnobot_blog_sessions`, ongeacht of iemand expliciet op SLUIT klikt.

**5. Waarom dit vijf iteraties kostte, expliciet vastgelegd zodat een volgende sessie niet opnieuw dezelfde doodlopende weg inslaat:**
- Poging 1 (32694f6a): balk verbergen tijdens genereren, tonen zodra je naar het einde scrolt (`readyForInput` + `IntersectionObserver` op `bottomRef`). Introduceerde een dode lege paddingBottom-zone (balk-ruimte bleef gereserveerd terwijl de balk zelf verborgen was).
- Poging 2 (66d99a16): padding conditioneel gemaakt op `showInputArea`. Loste de dode zone op, maar onthulde dat er nog geen automatisch meescrollen bestond tijdens streamen: je moest zelf blijven scrollen.
- Poging 3 (d993ed52): automatisch meescrollen toegevoegd, gedetecteerd via het generieke `scroll`-event + afstand-tot-onder-berekening. Bleek zichzelf te saboteren: de bestaande smooth-scroll-naar-nieuw-bericht (ouder, ongewijzigd stuk code) vuurt tijdens zijn eigen animatie ook `scroll`-events af, die dan verkeerd als "gebruiker scrolt weg" werden gelezen.
- Poging 4 (f52404a3 + e3c7a5bb): scroll-detectie vervangen door `wheel`/`touchmove` (loste poging 3's probleem echt op), plus een `useLayoutEffect` die het beeld bij het verschijnen van de balk terugschoof om overlap met de laatste tekstregels te voorkomen. Deze correctie bleek zelf onbetrouwbaar bij live testen (overlap kwam terug), oorzaak nooit met zekerheid vastgesteld ondanks uitgebreide code-analyse.
- Poging 5 (b647891f): in plaats van de correctie te blijven debuggen, de padding weer permanent gereserveerd (zoals vóór poging 2) plus `scroll-margin-bottom` op `bottomRef`, zodat meescrollen die ruimte vanzelf al respecteert. Bleek nog steeds de balk soms voorgoed te laten verdwijnen: de `readyForInput`/`IntersectionObserver`-detectie ("ben ik tot het einde gescrold") werkte niet betrouwbaar samen met `scroll-margin-bottom`.
- **Uiteindelijke fix (7dd14da1):** de hele scroll-positie-detectie (`readyForInput` + `IntersectionObserver`) losgelaten. De balk verschijnt nu puur op basis van `loading`, geen scroll-afhankelijkheid meer. Minder precies t.o.v. Thijs' letterlijke wens ("pas als ik ALLES gelezen heb"), maar aantoonbaar robuust: automatisch meescrollen tijdens streamen zorgt er al voor dat je de tekst hebt gevolgd tegen de tijd dat het antwoord klaar is, dus in de praktijk nagenoeg hetzelfde resultaat zonder de race conditions van scroll-detectie.
- **Les voor een volgende keer:** bij een fix die drie keer op rij een nieuw, net zo onzichtbaar tweede-orde-probleem blootlegt, is dat een signaal om de aanpak zelf te heroverwegen in plaats van door te blijven patchen op dezelfde onderliggende architectuur.

**UI-klacht (sticky footer), letterlijk:** "Je hebt het invoerveld van de vervolgvragen in een stationaire footer gebouwd. Persoonlijk vind ik dat storend. De tekst van de respons is voor mij het meest belangrijk, daar vraag ik om. Als ik ALLES gelezen heb, dus niet zomaar ergens tussendoor, pas DAN zou ik de gelegenheid moeten krijgen om een vervolgvraag te stellen of af te sluiten. Voor mij is de stationaire (vaste) footer storend, alsof ik opgejaagd word om de volgende vraag/reactie in te typen." Locatie geverifieerd: `app/bot/SparClient.tsx` regel ~1143-1158, class `.spar-input-area.active` (`position: fixed; bottom: 0`, geactiveerd zodra een gesprek loopt). Raakt de hoofdchat van de hele app, niet Team-specifiek, dus een apart, breed UX-besluit, geen quick fix zonder overleg.

---

## Routeringsvragen — beantwoord (2026-08-18)

1. **Cultuur-pijler:** geen cross-referentie tegen een opgeslagen manager-waardenprofiel (dat is een Team-feature, apart te parkeren, zie punt 4). Voor nu klein en individueel: een lens die let op eigenaarschap-taal ("wij" versus "zij", wie neemt de actie).
2. **Zichtbaarheid van het raamwerk:** cultuur/accountability/consistentie blijven een onderstroom. Niet expliciet benoemd richting de gebruiker zoals mindset/systeem/actie dat wel zijn.
3. **Consistentie:** verdient eigen diepgang, zie de verfijnde definitie hierboven bij Bron 2. Niet samenvoegen met accountability, wel sequentieel eraan gekoppeld (accountability is de voorwaarde, consistentie bouwt erop voort).
4. **Manager-zelfcoaching-gat (Thijs) + de bredere "manager stelt teamwaarden in"-uitwerking van cultuur:** beide geparkeerd tot na deze systeemprompt-upgrade. Akkoord.

## Kennisbank versus systeemprompt (besloten 2026-08-18)

De volledige redenering van vandaag (Erik-protocol, klantdifferentiatie, patroonherkenning, consistentie-definitie, met de echte voorbeelden) wordt een **intern kennisbankdocument** (`blog_chunks`, via `scripts/embed-chunks.mjs`), geen publieke arno.blog-post. Reden: de voorbeelden zijn herleidbare, echte ArnoBot-gebruikerssituaties (Erik, Stefanie), die nooit ongewijzigd publiek gemaakt mogen worden. Een publieke versie zou een aparte, latere redactieklus zijn met verzonnen generieke voorbeelden, geen bijproduct van dit document.

RAG is reactief (komt alleen naar boven bij een semantisch passende vraag), dus dit kennisbankdocument is **niet** het "voorgrond"-mechanism. Dat blijft de systeemprompt: de gedistilleerde gedragsregels gaan daar in, het kennisbankdocument is de achtergrond/verdieping die ArnoBot kan raadplegen als een situatie er specifiek op lijkt.

---

## Golf 1 — definitieve regelteksten (verwerkt in `lib/systemPrompt.ts`, 2026-08-19)

Beide regels staan nu in `restVanPersona` binnen `buildRdsSystemPrompt`. Regel 1 direct na "VRAAG EN LEVER TEGELIJK" (het is expliciet een uitzondering daarop), regel 2 direct na "GEBRUIK VAN CONTEXT, DOELEN EN OPENSTAANDE ACTIES" (het is een aanscherping daarvan).

**Regel 1 — KWALIFICEREN VOORDAT JE UITGEBREID LEVERT** (herzien twee keer op basis van Arno's feedback: eerst de vraag ingekort tot één krachtige vraag i.p.v. een checklist van vier criteria, daarna de domeinonzekerheid-clausule expliciet naar de gebruiker gericht met een harde scope-grens: ArnoBot is sales/management/scaling-up-expert, geen marktkennis-verzamelaar):

> Bij twee situaties geldt een uitzondering op vraag en lever tegelijk: eerst kwalificeren, dan pas de diepte in. Bij twijfel of de uitzondering van toepassing is: terugvallen op vraag en lever tegelijk, niet de uitzondering forceren.
> Als een gebruiker een klantsituatie inbrengt, bijvoorbeeld een klant die opzegt of moeilijk doet: stel één korte, krachtige vraag over het belang van die klant of opportunity, bijvoorbeeld hoe belangrijk deze klant of opportunity voor hem of zijn bedrijf is, of hoe erg het is als hij deze deal of relatie verliest. Houd netwerkinvloed en ambassadeurspotentieel in je achterhoofd bij het beoordelen van het antwoord, vraag er niet apart naar. Is het antwoord dat het weinig voorstelt, leer de gebruiker dan dat dit soort klanten kort, snel en het liefst bijna geautomatiseerd wordt afgehandeld, of door iemand anders dan hemzelf, zodat zijn eigen tijd naar de klanten gaat die wel omzet bepalen. Is het antwoord dat het er echt toe doet, dan verdient de situatie meer aandacht en diepgang.
> Als je moet rekenen of adviseren op een markt of mechanisme waar je geen specifieke kennis van hebt, en die je ook niet kunt verifiëren: vraag de gebruiker het uit te leggen. Hij kent zijn markt als geen ander. Jij bent er niet om marktkennis op te doen, jij bent sales, management en scaling up expert, niet meer en niet minder. Laat je soms voeden door wat de gebruiker weet, in plaats van zelfverzekerd door te redeneren op een aanname.

**Regel 2 — OPENSTAANDE ACTIES EERST** (herzien: "wat hield je tegen" was een geladen vraag die faalt veronderstelt, vervangen door een neutrale check die evengoed ruimte laat voor "het staat nog gepland" als voor "het is verschoven"):

> Als er uit eerdere gesprekken een concrete, afgesproken actie openstaat: begin daar voordat je verdergaat met een nieuwe vraag, kort. Vraag neutraal, zonder te veronderstellen dat iets is misgelukt: staat dit nog gepland, is het uitgevoerd, of is het verschoven en waarom. Ga pas door naar het nieuwe onderwerp als dat kort is afgehandeld. Een advies dat twee keer op dezelfde manier blijft liggen is niet een executieprobleem van de gebruiker, dat is een signaal dat het advies niet past. Pas het dan aan in plaats van te herhalen.

## Golf 2 — vastgelegd voor later, nog niet verwerkt

**Regel 3 — patroonherkenning als leermoment** (tekst ongewijzigd t.o.v. eerder in dit document, zie Bron 1).

**Regel 4 — RUIMTE IN PLAATS VAN OBSTAKEL** (dit is de samengevoegde, verkorte versie van het Erik-protocol/accountability en de obstakel-naar-opportunity-redirect/consistentie, op verzoek van Arno teruggebracht van ongeveer 210 naar 90 woorden en gegeneraliseerd naar elke vorm van je-tegengehouden-voelen, niet alleen klagen over bedrijf/markt):

> Als iemand zich door iets of iemand tegengehouden voelt, in welke situatie dan ook: richt het gesprek op de ruimte, niet op het obstakel. Barrières zijn vaak een mentale constructie, en waar je aandacht aan geeft groeit. Vraag naar wat wel mogelijk is, welke klanten, opties of stappen er wel openstaan, in plaats van nog een ronde te wijden aan wat er tegenzit. Blijft iemand toch herhaald hangen in het obstakel zonder naar de ruimte te bewegen: confronteer dan direct, in jouw eigen stem. Niemand anders is verantwoordelijk voor die beweging dan hijzelf.

Bij golf 2 hoort ook de kleine codewijziging in `chat/route.ts`: `stagnatie`/`weinig_voortgang` toevoegen aan de select in `coachingContextPromise`, nu wordt alleen de tekstuele `voortgang` doorgegeven.

## Evaluatie golf 1 (gepland)

Twee herinneringsmechanismen, bewust allebei:
1. Claude.ai-routine `trig_01QEbJchqq919DMXnuk9RJ6s`, vuurt 2026-09-16 16:00 UTC, checkt of golf 1 nog in de code staat en bereidt de evaluatietekst voor. Stuurt niets naar Telegram, verschijnt als sessie op claude.ai/code/routines.
2. Eenmalige Telegram-cron in het project zelf (nog te bouwen), die op dezelfde datum een echt bericht naar Arno's Telegram stuurt via het bestaande `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`-mechanisme uit `lib/cron-notify.ts`. Dit is het daadwerkelijke meldkanaal, de claude.ai-routine is aanvullend.

Evaluatiecriterium: nieuwe meta-analyse draaien op de gesprekken sinds golf 1 live ging, en checken of "verifieert voor adviseren" en "houdt rekening met openstaande acties" beter scoren dan in de analyse van 18 augustus 2026.

---

## Bevinding: vraag-aan-het-eind (2026-08-19, live gevonden door Arno tijdens het testen)

**Klacht, letterlijk:** "elke vraag wordt gevolgd door een antwoord die afsluit met weer een vraag van Arnobot aan de user... het irriteert soms dat de vragen gesteld worden die voor mij totaal niet relevant zijn."

**Oorzaak:** twee instructies in `buildRdsSystemPrompt` (`lib/systemPrompt.ts`) werkten tegen elkaar in. "VRAAG EN LEVER TEGELIJK" ("als je meer context nodig hebt: lever + stel een vraag") is voor een coach-bot bijna altijd waar, dus werd in de praktijk een permanente instructie om te vragen. Golf 1's "KWALIFICEREN VOORDAT JE UITGEBREID LEVERT" voegt daar nog twee specifieke situaties bovenop. De enige tegenkracht ("Eindig niet altijd met een vraag... Varieer") was vaag en verloor het van de veel concretere "vraag en lever tegelijk"-regel.

**Fix, twee stukken tekst herzien:**
1. "VRAAG EN LEVER TEGELIJK": trigger aangescherpt naar "alleen vragen als het antwoord zonder die informatie aantoonbaar onvolledig of te generiek zou blijven."
2. De "eindig niet altijd met een vraag"-regel herschreven tot een harde drempel in plaats van een vage "varieer"-oproep: "een vraag aan het eind is de uitzondering, niet de gewoonte."

**Smoke-test tegen de echte API (`claude-sonnet-4-6`, 4 scenario's) ving onderweg een echte regressie:** de eerste versie van de herziene "VRAAG EN LEVER TEGELIJK"-tekst liet de expliciete garantie vallen dat een vraag nooit alleen mag staan. Scenario "geef me een openingszin voor een cold call" leverde daardoor een kaal antwoord op dat **alleen** een tegenvraag was ("Wat verkoop je, en aan welke sector?"), zonder enige poging tot een concreet antwoord op basis van de meest logische aanname. Dat is precies wat "vraag en lever tegelijk" moet voorkomen. Hersteld door de zin "Nooit alleen een vraag zonder ook iets inhoudelijks te geven" expliciet terug te zetten. Na de fix leverde hetzelfde scenario een volledig antwoord (concrete openingszin-structuur) plús een gerichte vervolgvraag.

Overige scenario's bevestigden het gewenste gedrag: een simpele feitelijke vraag (MEDDIC vs BANT) kreeg geen vraag meer achteraan geplakt, de klantsituatie-uitzondering uit golf 1 bleef intact (kwalificeren-eerst-vraag, geen volledig antwoord, zoals bedoeld), en een vage/brede vraag kreeg wel een vraag terug, maar een inhoudelijk onderbouwde.

Snapshot-tests (`lib/systemPrompt.test.ts`) bijgewerkt met `vitest -u` op basis van de definitieve tekst.

---

## Vervolgbevinding (2026-08-19, zelfde dag, live gevonden bij verder testen)

Ondanks de fix hierboven kwamen er via live screenshots twee vervolgproblemen naar boven, allebei met een andere oorzaak dan de eerste fix:

**1. ArnoBot herhaalde een net beantwoorde vraag.** Gebruiker antwoordde "Ja, prima" op "wil je bespreken hoe je die introductie aanpakt?", waarna ArnoBot in plaats van door te leveren opnieuw vroeg: "Bedoel je: ga door, of is er iets specifieks waar je over twijfelt?" Zelf gecorrigeerd een beurt later ("Klopt, mijn fout"). Toevoeging aan "VRAAG EN LEVER TEGELIJK": "Als de gebruiker net een duidelijk bevestigend antwoord heeft gegeven (ja, prima, oké, ga door): behandel dat als een besliste keuze en lever direct door. Vraag niet opnieuw ter bevestiging, ook niet in een andere vorm."

**2. Een compleet, uitvoerbaar antwoord eindigde alsnog met een generieke "wat ga je nu doen"-vraag.** Andere oorzaak dan de eerste fix: niet "VRAAG EN LEVER TEGELIJK", maar het losse, vroege mandaat in `staticIntro` (regel 67): "Niet alleen antwoorden: aanzetten tot actie." Arno's eigen onderscheid, scherp geformuleerd: een échte voortgangscheck op een lopend meerstappenproces ("ben je bij stap 3?") is relevant, een generieke motiverende afsluitvraag na een al compleet antwoord is betuttelend ("ik ben geen kleuter"). Toevoeging direct na het mandaat: "Dit gaat over de inhoud van je antwoord, niet over het automatisch toevoegen van een vraag naar de eerste stap. Een compleet, uitvoerbaar antwoord zet al aan tot actie. Vraag alleen expliciet naar een volgende stap als er nog geen concrete actie op tafel ligt, of als het een echte voortgangscheck is op iets dat al liep. Een vraag als 'wat ga je nu doen' na een antwoord dat de aanpak al volledig uitlegt, voegt niets toe en voelt betuttelend."

**Smoke-test tegen de echte API (`claude-sonnet-4-6`, 3 scenario's, inclusief een expliciete controle-scenario voor een échte voortgangscheck):** alle drie leverden volledige, inhoudelijke antwoorden zonder afsluitend vraagteken, inclusief de controle-scenario (die in plaats van een vraag direct de logische volgende stap benoemde op basis van de context, "Goed. Dan zit je klaar voor stap 3: ..."). Geen regressie naar het kale-vraag-probleem van de vorige ronde.

Snapshot-tests opnieuw bijgewerkt met `vitest -u`.

**Les:** "eindigt niet met een vraag" bleek niet één instructie te zijn maar het resultaat van meerdere, verspreide instructies die onafhankelijk van elkaar naar vragen duwen (VRAAG EN LEVER TEGELIJK, KWALIFICEREN VOORDAT JE UITGEBREID LEVERT, en nu ook het aanzetten-tot-actie-mandaat). Bij een volgende melding van "toch nog een vraag waar die niet hoort" eerst zoeken naar wélke van de instructies in `staticIntro`/`restVanPersona` die specifieke vraag aanstuurt, niet aannemen dat het dezelfde oorzaak is als de vorige keer.

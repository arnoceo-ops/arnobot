# Systeemprompt-upgrade hoofdchat (mindset/systeem/actie → uitgebreid met meta-analyse-bevindingen)

**Laatst bijgewerkt:** 2026-08-19
**Waar we staan:** golf 1 is uitgewerkt tot definitieve regelteksten, goedgekeurd door Arno, en verwerkt in `lib/systemPrompt.ts` (`buildRdsSystemPrompt`). Smoke-test tegen de echte API loopt/moet nog bevestigd worden voordat commit+push. Golf 2 (patroonherkenning-als-leermoment + de samengevoegde "ruimte in plaats van obstakel"-regel) is bewust nog niet doorgevoerd, evaluatiemoment over 4 weken.
**Eerstvolgende stap:** smoke-test afronden, typecheck bevestigen, committen en pushen. Daarna: eenmalige Telegram-cron bouwen voor de 4-weken-herinnering (Arno wil dit soort herinneringen echt in Telegram, niet alleen als claude.ai-routine).

## Afvinklijst

- [x] Meta-analyse volledig gelezen en besproken (sessie 2026-08-18)
- [x] Zes-succesfactoren-document gelezen
- [x] Thijs' feedback gecategoriseerd
- [x] Routeringsvragen beantwoord door Arno
- [x] Concreet voorstel voor golf 1-regels geschreven, herzien op basis van feedback, definitief
- [x] Golf 1 goedgekeurd door Arno
- [x] `lib/systemPrompt.ts` aangepast (golf 1: regel 1 kwalificeren, regel 2 openstaande acties)
- [ ] Smoke-test tegen echte API afgerond en beoordeeld
- [ ] Gecommit en gepusht
- [x] Eenmalige Telegram-cron voor de golf 1-evaluatie-herinnering gebouwd (`app/api/cron/golf1-evaluatie-herinnering/route.ts`, vercel.json `0 8 16 9 *`, jaar-guard op 2026)
- [ ] Claude.ai-routine als backup staat al (`trig_01QEbJchqq919DMXnuk9RJ6s`, vuurt 2026-09-16 16:00 UTC, checkt code-status en bereidt evaluatietekst voor, stuurt zelf niets naar Telegram)
- [ ] Golf 2 (patroonherkenning + samengevoegde accountability/consistentie-regel): pas na evaluatie van golf 1 via een nieuwe meta-analyse

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

Zie de aparte synthese hierboven in het gesprek. Samengevat: bevestigt dat manager-coaching (en daarmee "cultuur") een Team-aangelegenheid is, geen hoofdchat-aangelegenheid. Legt een nieuw, specifiek gat bloot: coaching-op-de-coach (terugkoppeling op Thijs' eigen functioneren als coach, los van zijn rol als verkoper). Plus een losstaande UI-klacht over de sticky footer.

**Voor de scope van de hoofdchat-systeemprompt-upgrade: voegt niets toe.** Beide punten (manager-zelfcoaching-gat, UI-klacht) zijn apart gelogd, niet verder uitgewerkt in dit document.

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

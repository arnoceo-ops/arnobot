# ArnoBot Sales Bijbel

**Laatst bijgewerkt:** 2026-08-26 (concurrentievergelijking toegevoegd: ArnoBot tegenover LLM's, managers, coachingsbureaus en sales-enablement-tools, plus een nieuwe sectie over het vraag-en-antwoordpatroon als grootste onzichtbare conversierisico). **Los daarvan gecorrigeerd:** de kostenframing in "Waarom dit een hogere prijs rechtvaardigt" was inconsistent met de kernbelofte zelf (die expliciet zegt dat het gesprek nooit over kosten mag gaan) en bovendien een ongefundeerde claim ("dekt het abonnement"), gecorrigeerd naar zuivere opbrengst-framing. Zie ook `docs/SALES_NOTEBOOKLM.md` voor het technisch-vrije, geconsolideerde brondocument voor NotebookLM, dat na deze fix opnieuw is gesynchroniseerd.
**Waar we staan:** 13 van de 14 USP-punten LIVE, plus sinds 22 augustus een leidende sectie bovenaan ("De kernbelofte") die het waardeverhaal boven de losse punten uittilt: wat een manager, hoe goed ook, structureel nooit alleen kan. Bewust gekozen boven bezwaarafhandeling/prijsargumentatie als eerstvolgende stap, op Arno's expliciete voorkeur: waardeverkoop eerst, dan pas verdediging. Punt 1 feitelijk gecorrigeerd (een standaard AI-tool heeft wel degelijk geheugen binnen één gesprek, het verschil zit in verwatering en per-sessie geheugenverlies). Alleen "Man & Machine" (nu punt 14, verschoven door de nieuwe toevoeging) blijft GEPLAND. Een sectie "Verborgen functies — bestaand, maar nooit pitchen", voor "Manager als Variabele" (teamniveau-patroonherkenning), zodat het salesteam weet dat het bestaat zonder het ooit actief te noemen. Nieuw (2026-08-26): de "Concurrentievergelijking"-sectie uit de openstaande takenlijst is nu ingevuld, gecategoriseerd tegenover LLM's/chatbots, menselijke managers, coachingsbureaus en sales-enablement-tools, plus een apart "onder de motorkap"-blokje. Direct daaraan gekoppeld: een sectie die het grootste, meest onzichtbare conversierisico benoemt, gebruikers die ArnoBot als snelle vraagbaak gebruiken en daardoor nooit de kernwaarde ervaren. Het achterliggende productmechanisme daarvoor (een gate die dit gedrag herkent en afremt) is nog niet gebouwd, alleen als GEPLAND gemarkeerd, expliciet gekoppeld aan golf 1/2 in `docs/SYSTEEMPROMPT_UPGRADE.md`.
**Eerstvolgende stap:** bezwaarafhandeling, prijsargumentatie en pitch-scripts (case studies wachten nog op input van Arno).

Dit document is het naslagwerk voor het salesteam: wat ArnoBot uniek maakt, wat je daadwerkelijk mag zeggen tegen een prospect, en wat nog niet gezegd mag worden omdat het nog niet bestaat. Groeit door met elke sessie die hieraan werkt, zelfde principe als de andere `docs/`-bestanden in dit project: klein beginnen, disciplined uitbreiden, nooit een bewering opnemen die niet geverifieerd is tegen de actuele code.

---

## Harde regel: live vs. gepland

Elke USP/UBR in dit document is gelabeld **LIVE** of **GEPLAND**. Een salesgesprek mag alleen **LIVE**-punten als bestaand kenmerk noemen. **GEPLAND**-punten mogen als richting/visie genoemd worden ("we werken hieraan"), nooit als iets dat een klant vandaag krijgt. Overpromising aan een salesbaas die zelf sales doet voor de kost, is de snelste manier om geloofwaardigheid te verliezen.

Bij twijfel of iets nog live is: niet aannemen, navragen bij Arno of een technische sessie voordat het in een klantgesprek gebruikt wordt. Dit document wordt bijgewerkt zodra iets van GEPLAND naar LIVE verschuift.

---

## De kernbelofte: wat een manager, hoe goed ook, nooit alleen kan

Dit is het verhaal dat vóór alle losse USP's komt, niet ertussen. De USP's hieronder zijn het bewijs, dit is de kern. Verkoop niet een chatbot-abonnement. Verkoop wat een salesbaas, met alle inzet, ervaring en goede wil van de wereld, structureel nooit alleen had kunnen leveren aan zijn team, tegen geen enkele prijs. Dat is een ander gesprek dan "is dit de kosten waard", en het is het gesprek waar je wil zijn: als het waardeverhaal groot genoeg is, verdwijnt het prijsbezwaar vanzelf, in plaats van dat je het achteraf moet pareren.

**Opening om te testen:** *"Je koopt geen chatbot-abonnement. Je koopt structureel wat je beste manager, hoe goed hij ook is, nooit alleen had kunnen leveren, tegen elke prijs."*

### Zes dingen die geen manager kan, ongeacht hoe goed hij is

**1. Overal tegelijk zijn.** Een manager coacht één persoon tegelijk. ArnoBot is voor elke verkoper op het team tegelijk beschikbaar, op het exacte moment dat het nodig is: vlak vóór een lastig gesprek, laat op een avond vol twijfel, in het weekend na een verloren deal. Geen manager kan zichzelf klonen naar tien gelijktijdige coachingsgesprekken.

**2. Nooit een slechte dag.** Een manager heeft vermoeidheid, andere prioriteiten, een vakantie, een humeur, een dag waarop hij zelf onder druk staat. De kwaliteit van ArnoBot verandert niet met hoe druk, moe of afgeleid iemand is. Elke verkoper krijgt altijd dezelfde volle aandacht, ook de verkoper die op nummer twintig van de lijst staat.

**3. Perfect geheugen over een heel team, voor altijd.** Geen manager onthoudt exact wat elke verkoper drie maanden geleden beloofde, en kan dat feilloos naast wat er vandaag gezegd wordt leggen, voor elk teamlid tegelijk. Dit is precies waar de techniek achter ArnoBot vandaag nog aan gebouwd is (zie punt 1 en 11 hieronder): geen marketingclaim, een structurele eigenschap van hoe het systeem werkt.

**4. Geen politiek, geen favoritisme, geen ego.** Feedback van een manager is, hoe onbedoeld ook, gekleurd door de relatie met die persoon, angst om een topverkoper te demotiveren, kantoorpolitiek, wie het dichtst bij hem staat. ArnoBot geeft iedereen dezelfde eerlijke, ongefilterde spiegel, gebaseerd op iemands eigen patronen, niet op de organisatiedynamiek eromheen.

**5. Eerlijkheid die een manager nooit rechtstreeks krijgt.** Een verkoper zal tegen zijn eigen baas zelden toegeven dat hij ergens onzeker over is of een fout heeft gemaakt, dat voelt als carrièrerisico. Tegen een AI, zonder dat gevolg, wel. Het privacymodel (de manager ziet nooit de ruwe gesprekken, alleen de synthese, zie punt 5 hieronder) is daarom niet primair een privacyfeature. Het is wat die eerlijkheid überhaupt mogelijk maakt, eerlijkheid die geen enkele manager met welke aanpak dan ook zelf zou kunnen afdwingen.

**6. Kwaliteit die niet verwatert als het team groeit.** Bij een groeiend team krijgt elke individuele verkoper vanzelf minder aandacht van de manager, dat is geen kwestie van inzet maar van beschikbare uren. Verkoper twintig krijgt bij ArnoBot exact dezelfde kwaliteit coaching als verkoper één. Dit is het argument dat het sterkst meegroeit met de dealgrootte: hoe groter het team, hoe groter het gat dat een manager alleen nooit had kunnen dichten, en hoe groter de rechtvaardiging voor een prijs die daarbij past.

### Waarom dit een hogere prijs rechtvaardigt, niet alleen een redelijke

**Belangrijk (gecorrigeerd 2026-08-18):** dit gesprek gaat nooit over kosten, ook niet impliciet. Zodra het over "wat kost dit abonnement" of "wanneer heb ik dit terugverdiend" gaat, is het referentiepunt al verkeerd, ook als het antwoord gunstig uitpakt. Een eerdere versie van dit document maakte precies die fout: een claim dat "één extra deal per kwartaal het abonnement dekt" is kostenlogica, en bovendien nergens op gebaseerd, geen echte berekening, geen case study. Verwijderd.

Het juiste gesprek gaat over wat een sterker presterend team oplevert, niet over wat het kost. Een manager die zelf zou proberen elk teamlid dagelijks, op het juiste moment, met perfect geheugen en zonder favoritisme te coachen, zou daar een veelvoud van zijn eigen tijd aan kwijt zijn, en zou het alsnog niet volhouden bij een groeiend team. Een team dat wél op die manier gecoacht wordt, sluit structureel meer deals, en dat effect stapelt zich op over elke verkoper, elke maand. Zodra een prospect het gesprek zelf naar kosten trekt, heeft hij de kern gemist: leg dan niet uit waarom het "de kosten waard is", leg opnieuw uit wat het oplevert. Concrete, verdedigbare cijfers hierover volgen zodra er echte case studies zijn, zie "Nog toe te voegen" onderaan, tot die tijd geen verzonnen percentages of claims.

---

## Unique Selling Points en Unique Buying Reasons

### 1. Echt geheugen over gesprekken heen — LIVE
**Let op de precieze formulering (gecorrigeerd 2026-08-13):** het is niet juist om te zeggen dat een standaard AI-tool "geen geheugen" heeft of "elk gesprek op nul begint". Binnen één lopend gesprek heeft elke LLM wel degelijk toegang tot alles wat daarvoor gezegd is. Wat wél waar is, en wat het echte verschil maakt: (1) zodra je een nieuwe chat opent, een nieuwe dag begint, of een ander apparaat gebruikt, is die koppeling voor een standaardtool weg, tenzij je het zelf weer herhaalt; (2) zelfs binnen één gesprek verwatert de bruikbaarheid van iets dat vroeg in dat gesprek gezegd is naarmate er meer bijkomt, een bekend, breed gedocumenteerd kenmerk van hoe taalmodellen met lange gesprekken omgaan, geen ontwerpfout van een specifieke tool. Zeg dit dus nooit als "ChatGPT onthoudt niks", dat is aantoonbaar onjuist en een prospect met technische kennis prikt daar zo doorheen. Zeg wel: ArnoBot's geheugen is gestructureerd en blijft *precies zo scherp* na honderd gesprekken als na het eerste, omdat het niet leunt op een steeds langer wordend, verwaterend gesprek maar op gerichte opslag en terugkoppeling.

ArnoBot onthoudt wat iemand weken geleden deelde en brengt dat gericht terug wanneer het relevant is, inclusief patronen (dezelfde naam, hetzelfde bezwaar) die pas zichtbaar worden over meerdere gesprekken heen, zonder dat de kwaliteit daarvan afneemt naarmate er meer gesprekken bijkomen.

**Pitch-zin:** "Bij de meeste AI-tools verwatert wat je eerder deelde naarmate het gesprek langer wordt, en is het na een nieuwe sessie sowieso weg. Bij ArnoBot blijft het scherp, hoe lang je 'm ook al gebruikt."

### 2. Directe accountability — LIVE
ArnoBot onthoudt niet alleen wat er is afgesproken, maar checkt actief of het ook is gedaan, en benoemt het rechtstreeks als het antwoord niet klopt met eerder gedrag. Geen menselijke coach checkt dat structureel bij elk gesprek, een generieke chatbot heeft niets om tegen te checken.

**Verdieping (2026-08-13):** een zelfrapportagesysteem is alleen zo goed als de eerlijkheid van de klikken erachter. ArnoBot herkent daarom het patroon van reflexief "ja, gedaan" klikken zonder de actie echt uit te voeren, door klik-snelheid te combineren met het ja-percentage over tijd. Bij een verdacht patroon vraagt ArnoBot een korte toelichting in plaats van alleen een klik te accepteren, en het patroon zelf komt terug in de coachingsdiagnose als eerlijke constatering. Dit is een concreet, technisch antwoord op de logische vraag "hoe weet je dat mensen niet gewoon overal ja op klikken", niet een aanname dat zelfrapportage klopt.

**Sterk voor:** salesbazen. Dit is precies het gedrag dat zij van hun eigen mensen willen, nu geautomatiseerd, inclusief bescherming tegen het gamen van diezelfde zelfrapportage.

### 3. Sparring, geen advies maar oefenen — LIVE
Geen lijstje tips, maar een live, weerbarstig oefengesprek tegen een AI-tegenstander (een lastige prospect, een sceptische CFO). Sales is een vaardigheid die je oefent, geen kennis die je leest.

**Onderscheidt van:** elk trainingsdocument, elke e-learning-cursus.

### 4. Gestructureerde diagnose, geen los advies — LIVE
De MSA-score (Mindset/Systeem/Actie) geeft een meetbaar, herhaalbaar diagnosekader per gebruiker, met concrete ontwikkelpunten.

**Sterk omdat:** het iets tastbaars is om aan een salesbaas te laten zien, geen vaag "de AI helpt je groeien".

**Verdieping (2026-08-22):** onder de drie MSA-pijlers ligt een tweede, karaktergerichte laag uit Arno's eigen "De Zes Succesfactoren": accountability (eigenaarschap versus excuustaal, verweven in de mindset-diagnose, inclusief herkenning van excuustaal per gesprek), consistentie (stabiel presteren versus een pieken-en-dalen-patroon, berekend uit de eigen scoregeschiedenis, geen AI-gok) en cultuur (op managersniveau: wat een teambaas tolereert, niet wat hij predikt, verweven in de teamsynthese). Geen aparte score of los dashboard, gewoon een scherpere, beter onderbouwde diagnose binnen het bestaande MSA/SPE-kader.

### 5. Privacy-model voor teams dat vertrouwen niet breekt — LIVE
De manager ziet een synthese van patronen binnen zijn team, nooit de ruwe gesprekken van individuele medewerkers.

**Lost op:** mensen zijn niet eerlijk tegen een AI-coach als ze weten dat hun baas elk woord kan teruglezen. Waarschijnlijk het sterkste argument specifiek voor salesbazen die een heel team willen laten coachen zonder dat het als bewaking aanvoelt.

### 6. Altijd beschikbaar, geen agenda-gedoe — LIVE
24/7, geen wachttijd, geen coach die pas volgende week tijd heeft.

**Sterkst vlak:** vóór of na een echt klantgesprek, wanneer de behoefte acuut is, niet wanneer de kalender het toevallig uitkomt.

### 7. Arno's eigen methodiek, niet generieke AI-adviezen — LIVE
Geen ChatGPT met een sales-prompt erop. Gebouwd op Arno's eigen aanpak en toon (direct, geen bullshit, geen corporate taal). Ook inhoudelijk: de MSA-diagnose (zie punt 4) rust op Arno's eigen geschreven "De Zes Succesfactoren"-framework, geen generiek AI-diagnosemodel.

**Pitch-zin:** de klant koopt Arno's expertise op schaal, niet "een AI".

### 8. Kostenvoordeel t.o.v. een coachingstraject of trainingsbureau — LIVE
Eén abonnement versus meerdere dure, tijdgebonden coachingsessies per medewerker.

**Sterk voor:** de business case die een salesbaas moet verantwoorden voor een heel team.

### 9. Enterprise-niveau beveiliging en compliance — LIVE
RLS op alle gebruikerstabellen, DPA's met elke leverancier, geen training op klantdata bij Anthropic/OpenAI/ElevenLabs, beveiligingsdocument beschikbaar op aanvraag.

**Sterk omdat:** bij een teamklant komt bijna altijd een IT- of inkoopvraag hierover, en dit is dan al op orde, niet iets wat nog uitgezocht moet worden.

### 10. Teambrede patroonherkenning — LIVE
De manager krijgt zicht op patronen over het hele team (bijv. terugkerende blinde vlekken), niet alleen los per medewerker.

**Sterk omdat:** dit is waar een salesbaas daadwerkelijk op stuurt, niet op één individueel gesprek.

### 11. De vergeetcurve-herinnering (Ebbinghaus) — LIVE (2026-08-12)
Wetenschappelijk fundament: Hermann Ebbinghaus toonde aan dat mensen zonder herhaling 50 tot 70 procent van nieuwe informatie binnen 24 uur vergeten. De meeste coaching (menselijk of AI) doet niets tussen sessies om dat tegen te gaan. ArnoBot bestrijdt dit nu op drie manieren tegelijk: (1) een in-app check bij het openen van het gesprek die om een concreet antwoord vraagt, aangevuld met een getimede e-mailherinnering op dag 1, 3 en 7 als dat nog niet gebeurd is en de gebruiker ondertussen ook niet zelf is teruggekomen, opgebouwd als actieve terughaalvraag ("weet je nog wat je actie was?") in plaats van 'm gewoon te herhalen, wat wetenschappelijk sterker beklijft; (2) oude, nog onopgeloste uitdagingen komen terug als sparring-oefening, de sterkste vorm van herhaling omdat het echt oefenen is, niet alleen lezen; (3) een maandelijkse samenvatting van terugkerende namen/thema's uit iemands gesprekken, patroonherkenning in plaats van los feit.

**Pitch-zin:** "de meeste coaching verdampt binnen een dag als er niks mee gebeurt, ArnoBot is het enige dat daar structureel iets tegen doet, op vier manieren tegelijk."

**Sterk omdat:** geen concurrent kan dit repliceren op dezelfde manier (zie de oorspronkelijke onderbouwing hieronder), en het is nu een tastbaar, werkend kenmerk, geen visie meer.

**Oorspronkelijke onderbouwing (waarom dit meer is dan een leuk feitje):** het is falsifieerbaar en citeerbaar wetenschappelijk feit, geen marketingclaim. Het geeft een naam aan een probleem dat iedereen voelt maar niet kan benoemen ("goed gesprek gehad, twee weken later weet je niet meer wat je zou doen"). Het verplaatst het gesprek van "vertrouw ons" naar "dit is aantoonbaar hoe geheugen werkt, en hier is wat we eraan doen".

### 12. Proactieve 1:1-cadans-bewaking — LIVE (2026-08-24)
Blijft een teamlid langer dan twee weken zonder 1:1 met zijn manager, dan grijpt ArnoBot zelf in: eerst een belletje op de teampagina, en bij aanhoudende inactiviteit twee opvolgende e-mails naar de manager.

**Lost op:** het 1:1-ritme is de kern van goed teammanagement, maar zakt in de praktijk stilletjes weg zodra een manager het druk heeft, zonder dat iemand het opmerkt. ArnoBot bewaakt dat ritme actief, in plaats van te vertrouwen op het geheugen van de manager zelf.

**Sterk omdat:** dit versterkt hetzelfde accountability-argument als punt 2 in de prioriteitentraining hieronder, maar dan gericht op de manager zelf, niet alleen op zijn verkopers: ArnoBot spreekt hem ook aan op zijn eigen discipline.

### 13. Community-gebaseerde gespreksopeners — LIVE (2026-08-24)
Elke maand analyseert Claude alle gesprekken en analyses van alle ArnoBot-gebruikers samen, en genereert daaruit per discipline (Strategy, People, Execution) 10 nieuwe, actuele vragen, gerangschikt op belangrijkheid. Een gebruiker die via het linkje op de startpagina naar de communityvragen gaat en daar een voorgeformuleerde vraag aanklikt, kiest daarmee impliciet uit wat er op dit moment daadwerkelijk speelt bij honderden andere sales professionals, volledig geanonimiseerd: geen enkele individuele bijdrage is herleidbaar, alleen het herkende patroon komt terug als nieuwe vraag.

**Lost op:** een leeg scherm is de grootste drempel om een gesprek te beginnen. Een generiek lijstje voorbeeldvragen, zoals elke concurrent heeft, voelt willekeurig. Deze vragen voelen actueel en relevant, omdat ze dat ook daadwerkelijk zijn.

**Sterk omdat:** dit is een netwerkeffect zonder dat een gebruiker ooit met iemand anders in contact komt of iets van een ander ziet. Het wordt sterker naarmate ArnoBot meer gebruikers krijgt, en is niet zomaar na te bouwen door een concurrent zonder een vergelijkbare schaal aan echte gesprekken.

**Pitch-zin:** "de vragen die je hier ziet komen niet uit een lijstje. Ze komen uit wat honderden andere sales professionals deze maand ook al bezighield, volledig anoniem."

---

## Concurrentievergelijking: ArnoBot tegenover alles (toegevoegd 2026-08-26)

De losse USP's hierboven bewijzen de kernbelofte. Deze sectie zet ze naast elkaar per type alternatief, zodat je bij elk bezwaar ("waarom niet gewoon ChatGPT", "we hebben al een sales trainer", "we gebruiken al Gong") meteen het juiste antwoord grijpt in plaats van een losse USP te moeten vertalen naar dat specifieke alternatief.

### Tegenover een gratis AI/chatbot (ChatGPT, een eigen bedrijfs-GPT) — LIVE
- Geheugen dat niet verwatert: gestructureerde opslag en gerichte terugkoppeling over honderden gesprekken, niet een steeds langer wordend gesprek dat aan kwaliteit inlevert (zie punt 1)
- Directe accountability: checkt actief of een afspraak is nagekomen, inclusief herkenning van reflexief "ja" klikken (zie punt 2)
- Een herhaalbare, meetbare diagnose (MSA-score) in plaats van los advies per vraag (zie punt 4)
- Gebouwd op Arno's eigen methodiek en stem, geen generieke sales-prompt op een standaardmodel (zie punt 7)

### Tegenover een menselijke manager of coach — LIVE
- Overal tegelijk, voor elk teamlid, op het moment dat het nodig is, niet één coachingsgesprek per keer
- Nooit een slechte dag: dezelfde kwaliteit voor verkoper twintig als voor verkoper één
- Perfect geheugen over een heel team tegelijk, geen mens onthoudt dat feilloos naast elkaar
- Geen politiek, favoritisme of ego in de feedback
- Eerlijkheid die een medewerker tegen zijn eigen baas nooit zou geven, dankzij het privacymodel (manager ziet synthese, nooit ruwe gesprekken, zie punt 5)
- Kwaliteit verwatert niet als het team groeit, een mens heeft letterlijk beperkte uren (zie de volledige onderbouwing in "De kernbelofte" hierboven)

### Tegenover een coachingsbureau of trainingsprogramma — LIVE
- Continu in plaats van periodiek: geen dure, tijdgebonden sessies per medewerker (zie punt 8)
- Vergeetcurve-bestrijding (Ebbinghaus): in-app herinnering, getimede e-mails, oude onopgeloste uitdagingen komen terug als sparring-oefening, maandelijkse patroonherkenning (zie punt 11). Een training zonder herhaling verdampt binnen een dag, dit is het enige dat daar structureel iets tegen doet
- Live oefenen tegen een weerbarstige AI-tegenstander, geen lijstje tips lezen (zie punt 3)

### Tegenover sales-enablement/call-analyse-tools (Gong, Chorus e.d.) — LIVE
- Geen belopname-infrastructuur of integratietraject nodig, werkt op iemands eigen reflectie, direct bruikbaar
- Proactief tussen gesprekken door (coaching, accountability), niet alleen achteraf analyseren wat er in een al gevoerd gesprek gebeurde

### Onder de motorkap — niet zichtbaar voor een prospect, wel het fundament — LIVE
Niet als losse pitch-zin gebruiken, wel paraat hebben als een technisch onderlegde prospect (IT, inkoop) doorvraagt naar hoe dit werkt:
- Drielaags geheugen: feiten, samenvattingen, en semantische retrieval over alle oude sessies plus herkenning van terugkerende namen/thema's
- Kwaliteit-eerst modelkeuze per taak, met retry/fallback-engineering zodat een leeg of afgekapt AI-antwoord nooit stilzwijgend wordt opgeslagen
- Community-gedreven gespreksopeners: een netwerkeffect dat sterker wordt naarmate ArnoBot groeit, niet na te bouwen door een concurrent zonder diezelfde schaal (zie punt 13)
- Enterprise-beveiliging en compliance al op orde: RLS, DPA's met elke leverancier, geen training op klantdata (zie punt 9)

---

## Het onzichtbare lek: het vraag-en-antwoordpatroon (toegevoegd 2026-08-26)

Belangrijk voor het salesteam zelf, niet alleen voor wat je tegen een prospect zegt: de grootste bedreiging voor conversie naar betaald is geen concurrerend platform, het is een gewoonte. Een deel van de gebruikers, vaak jongere verkopers, gebruikt ArnoBot als een standaard chatbot: snel een vraag stellen, antwoord krijgen, doorgaan naar de volgende vraag. Ze negeren de meegegeven actie, doen nooit een analyse, starten nooit een coachingstraject. Daarmee halen ze een fractie uit wat ArnoBot kan opleveren, en dat voelt voor hen niet duidelijk anders dan een gratis chatbot. Dat is precies waarom ze niet doorgaan naar een betaald abonnement: ze hebben de kernwaarde nooit ervaren.

**Herken dit patroon in een salesgesprek:** een prospect die vraagt "wat is het verschil met gewoon ChatGPT" heeft dit patroon vaak zelf al onbewust verwacht van het product. Antwoord daar niet op met een functielijst, antwoord met het onderscheid zelf, en gebruik de concurrentievergelijking hierboven om het concreet te maken.

**Pitch-zin:** "Een gratis chatbot geeft je een antwoord en blijft daarna altijd aardig, wat je er ook mee doet. ArnoBot checkt of je het ook echt hebt toegepast, en spreekt je daarop aan als dat niet zo is. Dat verschil is precies waarom iemand die ArnoBot alleen als vraagbaak gebruikt er maar een fractie uithaalt, en waarom wie de acties en coaching wel oppakt blijft."

**Sterk omdat:** dit normaliseert al bij de intake dat losse vragen stellen niet de bedoeling is, waardoor het risico op deze val bij een nieuwe gebruiker vooraf kleiner wordt.

**Voor sales agents zelf:** gebruik ArnoBot in je eigen voorbereiding zoals je het aan een prospect verkoopt, dus mét acties, analyses en coaching, niet als snelle vraagbaak. Je eigen gebruikspatroon is het meest geloofwaardige bewijsstuk dat je in een gesprek hebt.

**Nog niet gebouwd, dus niet pitchen als bestaand kenmerk (GEPLAND):** een herkenning van dit gedrag die ArnoBot zelf gebruikt om een gesprek te onderbreken voordat een nieuwe losse vraag wordt beantwoord ("je kreeg vorige keer deze actie mee, wat heb je ermee gedaan?"). Hangt samen met golf 1/golf 2 van `docs/SYSTEEMPROMPT_UPGRADE.md`: golf 1 (live, 19 augustus) checkt al eenmalig de meest recente openstaande actie voordat een nieuw onderwerp begint, golf 2 (nog niet gebouwd, evaluatie gepland 16 september 2026) voegt de eigenlijke confrontatie toe bij herhaald genegeerd gedrag.

---

## Gepland — nog NIET pitchen als bestaand kenmerk

### 14. "Man & Machine" — menselijk contactmoment naast de AI — GEPLAND
Puur toekomstplan. Geen certificeringsprogramma, geen aangestelde coaches, geen publieke aankondiging. Niet noemen in een klantgesprek, zelfs niet als richting.

---

## Verborgen functies — bestaand, maar nooit pitchen (toegevoegd 2026-08-22)

Anders dan de "Gepland"-sectie hierboven: dit bestaat al en werkt, maar is bewust nooit een marketing- of salespunt, ook niet later. Weet dat het bestaat, voor het geval een prospect er zelf naar vraagt of Arno het zelf ter sprake brengt in een gesprek, maar breng het zelf nooit actief op, ook niet als "geavanceerde functie" of "extra waarde".

### "Manager als Variabele" — patroonherkenning op teamniveau
Als 3 of meer teamleden onafhankelijk van elkaar hetzelfde onderwerp laten terugkomen in hun gesprekken (bijv. bezwaarhantering, closing), signaleert ArnoBot dat dit mogelijk niet aan de individuele teamleden ligt, maar aan iets systemisch in hoe het team wordt aangestuurd. De manager ziet dit als een voorzichtige hypothese, nooit als beschuldiging, op zijn eigen leiderschapspagina en teamoverzicht. Arno krijgt zelf een privé-melding zodra dit bij een klant optreedt, en beslist zelf of en hoe hij persoonlijk contact opneemt.

**Waarom dit nooit gepitcht wordt:** het expliciet aankondigen als productkenmerk ("wij checken of het aan jou als manager ligt") zou het gevoelig, afschrikwekkend kader waar het net zorgvuldig omheen gebouwd is, juist doorbreken. Een manager die dit vooraf als marketingpunt hoort, ervaart het heel anders dan een manager die het rustig, met context, van Arno zelf hoort op het moment dat het er daadwerkelijk toe doet.

---

## Aanlooproutes naar ArnoBot: twee paden (toegevoegd 2026-08-24)

Belangrijk voor sales agents om te begrijpen: er zijn twee volledig verschillende manieren waarop iemand bij ArnoBot terechtkomt, en die bepalen wat een prospect al wel of niet heeft.

**Route 1 — homepage, inloggen/aanmelden met LinkedIn.** Een gewone trial-aanmelding via arno.bot zelf. Tijdens de profiel-intake kiest iemand zelf zijn rol, ook Sales Director of VP of Sales is hier gewoon te kiezen. Geeft hij aan dat hij ArnoBot voor zijn team wil gebruiken, dan ziet hij een blok "Team komt in september 2026, meld je aan voor de wachtlijst": hij heeft op dit moment nog geen Team-abonnement, alleen interesse. Dat vinkje is feitelijk een lead: er gaat automatisch een mailtje naar `waitlist@arno.bot` (naam, e-mail, rol) en de aanmelding wordt bewaard. Die mail in de inbox is op dit moment voldoende als lead-signaal, geen apart CRM-proces nodig (Arno's expliciete besluit, 2026-08-24).

**Route 2 — een link van een Sales Agent.** Hier komt iemand binnen via een persoonlijke sd-link (zie `docs/SALES_DEVELOPMENT.md`), en krijgt al bij de trial-aanmaak een écht Team-account. Deze persoon ziet geen wachtlijst-blok: hij hoeft zich nergens voor aan te melden, hij heeft het al. Zijn profiel-intake ziet er ook bewust anders uit dan bij route 1 (andere rollen: Sales Manager, Sales Director, VP of Sales, CCO; teamgerichte formulering; een vraag naar het actuele kwartaalthema in plaats van het wachtlijst-blok), zie `docs/TEAM_PLAN.md` voor de volledige toedracht.

**Waarom dit ertoe doet in een verkoopgesprek:** iemand die via route 1 binnenkomt en het wachtlijst-vinkje aanzet, is een warme lead die nog omgezet moet worden naar een echt Team-account. Iemand die al via een sd-link binnenkomt (route 2), is dat al. Spreek deze twee niet door elkaar: iemand die al via een sd-link toegang heeft, hoeft nooit meer aangespoord te worden om zich "aan te melden voor de wachtlijst", dat is verwarrend en overbodig, hij heeft al toegang.

---

## Prioriteit voor de eerste trainingsronde

Niet alle 13 live punten tegelijk aanleren aan een nieuw salesteam. Begin met **2, 5 en 9** (accountability, privacy-model voor teams, compliance): dat zijn de drie die specifiek een salesbaas'-koopbeslissing raken (vertrouwen in het team, verantwoording naar de organisatie, inkoop-goedkeuring), niet alleen een leuk kenmerk. De rest (1, 3, 4, 6, 7, 8, 10, 11, 12, 13) zijn goede ondersteunende argumenten die daarna aangevuld worden.

---

## Nog toe te voegen (toekomstige secties)

- Bezwaarafhandeling: veelgestelde tegenwerpingen en hoe erop te reageren
- Pitch-scripts per doelgroep (individuele gebruiker vs. salesbaas/team-inkoper)
- Case studies / voorbeelden zodra die er zijn
- Prijsargumentatie, gekoppeld aan `docs/PRICING_DECISIONS.md`

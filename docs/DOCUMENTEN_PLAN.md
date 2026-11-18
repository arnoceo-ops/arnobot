# Plan: documenten bewaren en historie-import

**Laatst bijgewerkt:** 2026-11-18
**Waar we staan:** plan, twee aannamecontroles (subagent zonder voorgeschiedenis) en een capability-sweep op de actuele Anthropic-documentatie zijn klaar; een mockup staat in `docs/mockups/documenten-archief.html`. Er is niets gebouwd. Het idee komt uit de vraag of een geüpload document bewaard kan worden, en uit het verzoek van een gebruiker (Chris) om zijn claude.ai-historie mee te nemen.
**Eerstvolgende stap:** fase 1 bouwen, achter een accountlijst zodat alleen Arno en de testaccounts de nieuwe pagina zien. Beginnen met het fundament: documententabel, laden na de poorten, bijlage zichtbaar in het hele gesprek, opruimsweep. Nog open bij Arno: quota per plan (open besluit 3), AVG art. 25 (open besluit 4), en de bewaartermijn van `bron_context` (open besluit 1). Besloten op 2026-11-18: tegels, naam ARCHIEF, transcript wel en audiobestand niet in Docs, 48 uur. Besluit 2026-11-17: de logging (`bron_context`) en de bijbehorende AVG-teksten worden pas aangepast tijdens/na de bouw, niet apart vooraf. Voorwaarde: dat is klaar vóór het vinkje live gaat, anders bewaren we documenttekst ook voor wie het vinkje uitzet.

## Besluiten (met verworpen alternatieven)

- **Bewaren is standaard aan.** Gekozen: het vinkje "Bewaar in Docs" staat bij elke upload standaard aan, is zichtbaar en kan met één klik uit. Het vinkje onthoudt de keuze niet: elke nieuwe upload begint weer aan (Arno, 2026-11-17). Verworpen: standaard uit (te weinig gebruik, het geheugen blijft leeg); altijd bewaren zonder vinkje (geen moment om "nee" te zeggen bij één gevoelig bestand, en bestaande gebruikers gingen uit van "niet opgeslagen"); de laatste keuze onthouden (overbodig volgens Arno).
- **Wat er bewaard wordt.** Gekozen: het origineel in een aparte private Storage-bucket, plus een eigen tabel met metadata en een samenvatting met embedding voor het geheugen. Verworpen: alleen uitgepakte tekst bewaren, want voor PDF's en afbeeldingen verliest dat tabellen, grafieken en plaatjes (die gaan nu native naar Claude).
- **Waar het zichtbaar wordt.** Gekozen: drie tabs bovenaan de pagina `app/bot/analyses`: Gesprekken, Analyses, Docs. Verworpen: een sectie onderaan de lange pagina (wordt niet gevonden). Daarnaast: een regel met aantal en "verwijder alles" op `/bot/account`, en "kies uit bewaarde documenten" bij het paperclip-icoon in de chat.

## Eis uit een productiegeval (2026-11-17, aangeleverd door een andere sessie)

Bij een echte sessie (salesplan als pdf) zag ArnoBot het document alleen in het bericht waaraan het hing (`documentBlock` in `app/api/chat/route.ts`). In berichten 2 en 3 oordeelde hij over het plan zonder het te kunnen zien, vulde gaten zelf in en verweet de gebruiker uitstel op basis van iets dat niet klopte. Een extra promptregel hielp niet (getest in twee runs). Dit is een bestaand productieprobleem, los van het bewaren.

**Eis:** een bijlage blijft zichtbaar in alle vervolgberichten van hetzelfde gesprek. Is dat ergens niet het geval, dan krijgt ArnoBot expliciet te horen dat het document niet meer zichtbaar is, en zegt hij dat tegen de gebruiker in plaats van voort te bouwen op zijn herinnering.

Gevolgen voor het ontwerp (voorstel, wacht op Arno):
- Ook een upload met het vinkje uit moet tot het einde van het gesprek beschikbaar blijven. Voorstel: "meteen verwijderd" wordt "verwijderd na dit gesprek" (bij sluiten, met een opruimsweep na een vast aantal uur als vangnet). Gekozen (Arno, 2026-11-18): tijdelijke kopie tot het gesprek eindigt. Verworpen: alleen zichtbaar in de uploadbeurt met een melding erna (maakt het probleem eerlijk, maar lost het niet op).
- De history krijgt per bericht een marker met het document-ID (nu staat er niets); de server laadt de documentblokken één keer vóór de tool-, retry- en vervolglus.
- Valt een document af (limiet, verwijderd, verlopen), dan krijgt het model een expliciete melding.
- Testgeval: de sessie van 17-11 nabouwen met pseudonieme tekst in het testbestand (geen echte namen of cijfers in de repo).

## Open besluiten (Arno)

1. `bron_context`: voorstel documenttekst niet meer loggen, en een bewaartermijn voor de rest van die kolom (bijvoorbeeld 30 dagen). Verworpen voorstel: alleen de privacytekst aanpassen.
2. Lezen van documenten (herzien 2026-11-18, vervangt het eerdere voorstel "alleen native in de beurt van kiezen"): binnen hetzelfde gesprek blijft elke bijlage native zichtbaar (zie de eis hierboven). In een nieuw gesprek gaat een document native mee als de gebruiker het kiest of via BESPREEK, anders werkt het via samenvatting en zoeken. Te controleren bij de bouw: paginalimiet per PDF en het maximum aantal documenten per beurt.
2b. Besloten 2026-11-18: vinkje uit betekent een tijdelijke kopie tot het gesprek eindigt, met een opruimsweep na een vast aantal uur als vangnet (aantal uren nog vast te stellen; de sweep ruimt ook de bestaande wees-uploads op). De teksten "direct weggegooid" (privacy, Q&A, appHelp) worden "weggegooid na dit gesprek", eerst als platte tekst aan Arno.
3. Quota per plan: aantal en totale MB.
4. AVG art. 25 (privacy by default) tegenover standaard-aan: aanname van Claude, nog niet getoetst aan een bron. Arno zoekt dit zelf uit vóór livegang.
5. Naam van de pagina: de nav toont nu ANALYSES (actieve sleutel `archief`) en de pagina heet GESPREKKEN. Met drie tabs past geen van beide; de mockup toont ARCHIEF als kop. Een nieuwe naam is een hernoeming: sitebrede tekstzoekopdracht (UI-copy, `lib/email-templates.ts`, `lib/systemPrompt.ts`, `QAClient.tsx`, docs) in dezelfde sessie. Arno beslist.
6. Tabstijl: tegels (zoals de huidige tellers, de VRAGEN-teller verhuist naar een regel onder de lijst) of pillen (zoals de sorteerknoppen). De mockup toont beide.
7. Audiobijlagen (opnames van echte gesprekken, alleen betaald, AssemblyAI) delen dezelfde bijlageknop: wel of niet bewaarbaar in Docs? Voorstel: niet in fase 1, het vinkje verschijnt dan alleen bij documenten.
8. Tekst bij het uitgezette vinkje: "uiterlijk 48 uur na je laatste bericht" (volgt uit de levensduurkeuze). Eerst als platte tekst aan Arno.

**Besloten door Arno op 2026-11-18 (punten 5 tot en met 8):**
- Tabs als **tegels** (verworpen: pillen). De losse VRAGEN-teller verhuist naar een regel onder de lijst bij Gesprekken.
- Paginanaam en nav-label **ARCHIEF** (verworpen: ANALYSES behouden, want een gebruiker zoekt zijn documenten niet onder "Analyses"). Dit keert bewust een eerdere hernoeming (BIEB, Archief, ANALYSES) om; bij de bouw sitebrede tekstzoekopdracht op "ANALYSES" als paginanaam en op "GESPREKKEN" als paginakop (UI-copy, `lib/email-templates.ts`, `lib/systemPrompt.ts`, `lib/appHelp.ts`, `QAClient.tsx`, alle docs), en mail-links naar `/bot/analyses` blijven werken.
- **Audio:** het transcript (met sprekerlabels) is bewaarbaar in Docs als tekstdocument, vinkje "BEWAAR TRANSCRIPT IN DOCS"; het audiobestand wordt niet bewaard (verworpen: audiobestand bewaren, want het bevat de stem van derden, kan tot 150 MB zijn en ArnoBot leest alleen de tekst). Alleen betaalde plannen kunnen audio uploaden, dat blijft zo.
- **48 uur** levensduur van een tijdelijke kopie, gerekend vanaf het laatste bericht (verworpen: 24 uur, want de app behandelt een gesprek tot 48 uur stilte als hetzelfde gesprek, `SparClient.tsx` regel 820 en `lib/geheugenContext.ts` regel 292; bij 24 uur verdwijnt een document midden in een nog lopend gesprek). Tekst onder het uitgezette vinkje: "Niet bewaard in Docs. ArnoBot kan het lezen zolang dit gesprek loopt. Uiterlijk 48 uur na je laatste bericht wordt het verwijderd."

## Bevindingen uit de aannamecontrole (2026-11-17)

Zelf in de code gezien: documenttekst van docx/txt/csv staat in `arnobot_rds_logs.bron_context` (`app/api/chat/route.ts` rond 649-654, tot 250.000 tekens, zonder bewaartermijn); accountverwijdering is alleen een mail (`app/api/bot/delete-account/route.ts`).

Door de subagent gemeld, bij de start van de bouw per punt te verifiëren:
- Sessie verwijderen is een soft delete; `data-cleanup` is een mail met een handmatige checklist en raakt Storage niet.
- Het kruisje bij een bijlage in `SparClient.tsx` verwijdert niets uit Storage; er is geen opruiming van achtergebleven uploads en geen rate limit op `app/api/bot/chat-upload-url`.
- De history bevat geen document: `lib/appHelp.ts` ("een document dat in dit gesprek is toegevoegd, kun je lezen") klopt alleen voor de beurt van de upload.
- Managerroutes (1:1, spotlight, zelfcoaching) lezen `summary`, `feiten` en `title` uit `arnobot_blog_sessions`; gedeelde analyses tonen de volledige tekst.
- Bijlagetekst en bestandsnaam gaan niet langs moderatie of prompt-injectiecontrole; de bestandsnaam staat ongefilterd in de prompt.
- Anthropic-limieten (pagina's per PDF, afbeeldingsgrootte) zijn niet geverifieerd.

## Herziene bouwafspraken na tweede review en sweep (2026-11-18)

Bronnen: tweede aannamecontrole (code gelezen) en een sweep op de officiële Anthropic-documentatie, gelezen 2026-11-18. Wat niet op een bron rust, staat als "niet geverifieerd".

**Datamodel en levensduur**
- Eén documententabel (naam bij de bouw) met: doc-ID, user_id, session_id, bewaard (ja/nee), opslagpad, mediatype, grootte, uitgepakte tekst (voor docx/txt/csv, zodat niet elke beurt opnieuw wordt uitgepakt), samenvatting, embedding, aangemaakt, laatst gebruikt, verloopt. De server laadt per beurt alle documenten van (user_id, session_id). Dit lost herladen, hervatten (`?resume=`), twee tabbladen en de opslag van de marker tegelijk op; een marker in de history is hooguit voor de weergave en draagt geen logica. Eén bucket, één tabel: een tijdelijk document bewaren is alleen de vlag omzetten.
- "Gesprek eindigt" bestaat technisch niet als één gebeurtenis. Gekozen: een tijdelijke kopie leeft tot laatst gebruikt plus 48 uur (dezelfde grens als "verouderd" in `lib/geheugenContext.ts` en `SparClient.tsx`). Een expliciete SLUIT met een geslaagde sessie-afsluiting mag vroeger opruimen. `sendBeacon`, SLUIT op mobiel en de cron `sessies-afsluiten` verwijderen nooit direct. De opruimsweep raakt alleen bestanden voorbij de grens. Verworpen: verwijderen bij SLUIT of beacon (breekt een lopend of hervat gesprek). Gevolg voor de tekst: "weggegooid na dit gesprek" wordt "weggegooid uiterlijk 48 uur na je laatste bericht" (eerst als platte tekst aan Arno).
- Laden pas ná alle poorten (inloggen, rate limit, dubbele sessie, daglimiet, moderatie); `downloadAndDeleteAttachment` splitsen in laden en (los, later) verwijderen; de chatroute verwijdert zelf nooit. Dit lost ook een bestaand probleem op: bij een 429, dubbele sessie of daglimiet is de bijlage nu al kwijt, en de client wist `attachedFile` bij elke fout die niet over het bestand gaat.
- De documentblokken horen in `messages` zelf, één keer samengesteld vóór de stream, de toolrondes, de retry bij een leeg antwoord en het max_tokens-vervolg (vier paden hergebruiken `messages`).
- Een document-ID uit de client is nooit te vertrouwen: ID-formaat valideren, altijd met een eigenaarsfilter laden, nooit een marker als tekst naar het model, en geen marker in `arnobot_rds_logs.question`, in de client-`messages` of in de invoer van `session-end` (vervuilt samenvatting, feiten en entiteiten).
- Niet beschikbaar (verlopen, verwijderd, afkapping op 100 berichten, gesprek verouderd na 48 uur, hervatten van een gesloten gesprek): het model krijgt expliciet te horen dat het document niet meer zichtbaar is.
- Bestandsnaam beperken (lengte, regeleinden, haakjes); documenttekst en naam langs de prompt-injectiecontrole; in de systeemprompt dat documentinhoud data is. Uitleveren via een eigen endpoint met `Content-Disposition: attachment` en `nosniff`, nooit inline.
- Voice (`/api/chat-voice`) en Sparren kennen geen documenten (paperclip is daar al weg). Expliciet uitsluiten en in `lib/appHelp.ts` zeggen.

**Route naar Anthropic**
- Gekozen: eigen Supabase-opslag, het bestand per beurt opnieuw als base64 meesturen, met prompt caching. Verworpen: de Files API. Redenen (bron: platform.claude.com/docs/en/build-with-claude/files, gelezen 2026-11-18): bestanden gelden voor de hele workspace (elke key daarin leest elk bestand; isolatie per gebruiker is alleen onze eigen mapping), Anthropic bewaart ze tot verwijdering of verloopdatum en de API is daarvoor niet zero-data-retention-geschikt (een tweede bewaarplek buiten onze privacybelofte), eigen uploads zijn niet terug te downloaden (een eigen kopie blijft nodig) en de inhoud telt elke beurt opnieuw als invoer.
- Prompt caching (bron: platform.claude.com/docs/en/build-with-claude/prompt-caching): documenten kunnen gecachet worden, maar een wijziging in de systeemprompt of een toegevoegde of verwijderde afbeelding maakt de cache ongeldig. Onze systeemprompt, RAG-context en geheugen veranderen per beurt, dus de variabele context moet ná de documentblokken komen. De chatroute gebruikt nu geen `cache_control`. Niet geverifieerd: of dit in de praktijk de wachttijd merkbaar verkort; meten bij de bouw.
- Limieten (bronnen: .../pdf-support en .../vision, gelezen 2026-11-18): PDF max 128 MB per verzoek en 600 pagina's voor modellen met een 1M-venster (Sonnet 4.6 en Fable 5.1; 100 pagina's bij 200K-modellen als Haiku 4.5); afbeeldingen max 10 MB en 8000 px, strengere regels boven 20 afbeeldings- of documentblokken per verzoek. Ontwerpgrens: maximaal ongeveer 20 documentblokken per beurt; het oudste valt af, met een melding aan het model.
- PowerPoint en Excel kunnen niet als documentblok (bron: .../pdf-support). Route: omzetten naar tekst of PDF. In `package.json` staan alleen `mammoth` (docx) en `pdf-parse`; voor xlsx en pptx komt bij de bouw een bibliotheek, te kiezen met een bron. Verworpen: de code-execution-route (geen zero-data-retention, containerdata tot 30 dagen).
- Gescande PDF's zijn niet citeerbaar; citations zitten niet in fase 1.
- Te verifiëren: Fable 5.1 staat in de API-documentatie als model met verplichte bewaring van 30 dagen (bron: .../manage-claude/api-and-data-retention). Uitzoeken welke routes documentinhoud naar Fable sturen (samenvattingen, synthese) en of de privacytekst dat dekt.

**Fase 2 (import) apart goedkeuren**
- Officieel (privacy.claude.com, gelezen 2026-11-18) bevat de claude.ai-export gespreksdata en géén originele geüploade bestanden. De JSON-structuur en of projecten erin zitten staan niet in officiële documentatie; ChatGPT-helppagina's gaven een 403. Eerst een echte export van beide kanten bekijken (bij Chris of een eigen export van Arno, gepseudonimiseerd) vóór het ontwerp.
- Geïmporteerde inhoud krijgt een eigen laadpad in `haalGeheugenContext`; in `arnobot_memory_entities` en de sessietabellen schrijven blijft verboden (besluit 3). Nog uit te werken: prompt-injectie, AVG-grondslag voor gegevens van derden in een export, groottegrens per import.

**Testgevallen:** herladen midden in een gesprek, `?resume=` van een gesloten gesprek, 48 uur stilte, twee tabbladen, de sweep tijdens een lopende stream, dubbele sessie met bijlage, andermans doc-ID in de history, afkapping op 100 berichten, retry en max_tokens-vervolg met een document, pseudonieme nabootsing van de sessie van 17-11. Documententabel mee in `e2e/global-teardown.ts`, `scripts/check-missing-user-filter.mjs` en `scripts/check-testaccount-filter.mjs`; voor Storage een eigen eigenaarschapstest. `app/api/bot/export` neemt documentmetadata mee.

## Nog te onderzoeken vóór de bouw (2026-11-18, grotendeels beantwoord in de sectie hierboven)

Het ontwerp is na de eerste aannamecontrole inhoudelijk veranderd (tijdelijke kopie, marker in de history, native in het hele gesprek). Die nieuwe delen zijn nog niet door een onafhankelijke controle gegaan. Open:
- Tweede aannamecontrole (subagent zonder voorgeschiedenis) op het herziene ontwerp.
- Capability-sweep op de actuele Anthropic-documentatie, met bronlink en datum: PDF-limieten, afbeeldingslimieten, Files API (eenmalig uploaden en per beurt verwijzen), prompt caching.
- Bestandstypen: PowerPoint en Excel worden nu niet ondersteund (`DOCUMENT_MEDIA_TYPES` in `lib/chatAttachments.ts`); sales-gebruikers uploaden die waarschijnlijk wel.
- Meerdere bijlagen per bericht: de chat heeft één `attachedFile`; voor historie en dossiers is meer dan één nodig.
- Gescande of zeer grote PDF's; gebruik in Sparren en bij spraak.

## Fase 0: logging rechtzetten (verplaatst naar fase 1, besluit 2026-11-17)

Gekozen: niet apart vooraf, maar als eerste onderdeel van fase 1, uiterlijk vóór livegang van het vinkje. Verworpen: nu al apart doen (Arno: aanpassen wat betreft loggen en AVG pas na de bouw). Tot die tijd blijft de tekst "niet opgeslagen" voor docx/txt/csv onwaar; dat is bekend en geaccepteerd (kolom bestaat sinds 2026-11-13).

- [ ] Documenttekst niet meer in `bron_context` loggen (één regel in `app/api/chat/route.ts`), vóór het vinkje live gaat.
- [ ] Besluit nemen over bewaartermijn en opruimen van bestaande `bron_context`.

## Fase 1: documenten bewaren

Ontwerpregels:
- Eerste bouwstap: een bijlage blijft zichtbaar in het hele gesprek (marker met document-ID in de history, server laadt de blokken vóór de lus, expliciete melding aan het model als een document niet meer te zien is). Dit lost het productiegeval hierboven op en is tegelijk het fundament voor Docs.
- Eigen tabel die geen team-, manager- of admin-route leest. Nooit documentinhoud of samenvatting in `arnobot_blog_sessions`, `arnobot_analyses` of `arnobot_memory_entities`.
- De chatroute accepteert alleen een document-ID en zoekt het pad zelf op met een eigenaarsfilter; nooit een pad uit de request (dat pad loopt nu via download-en-verwijder).
- Eigen endpoint voor openen en downloaden (CSP en de Android-app laten een Supabase-URL niet netjes toe), geen lange signed URL.
- Quota per gebruiker en plan, server-side. Bestandsnaam beperken in lengte. Bijlagetekst langs moderatie en prompt-injectiecontrole.
- Echte `verwijderGebruikersDocumenten(userId)` met tests, aangeroepen vanuit de verwijderknop, de cleanup-stap en de mailchecklist.
- Opruiming van wees-uploads (kruisje, sweep) en rate limit op `chat-upload-url`.
- Uploadlogica zit in `SparClient.tsx` (vinkje en keuzelijst komen daar). Client en server verschillen in toegestane typen (gif, txt, csv).
- Tabs op de analyses-pagina: sticky balk alleen bij Gesprekken, ANALYSEER wisselt naar Analyses, de mail-link `?open=nieuwste` opent de tab Analyses.
- Mee in dezelfde commit(s): `lib/appHelp.ts`, `app/bot/qa/QAClient.tsx`, `app/privacy/page.tsx`, `scripts/generate-security-pdf.mjs`, `docs/ARNOBOT_OVERZICHT.md`, `docs/TECHNICAL_HANDOVER.md`, export (`app/api/bot/export`), testaccount- en eigenaarschapscontroles, E2E-teardown. Alle teksten eerst als platte tekst aan Arno.

## Voortgang fase 1 (bouwstappen, elk apart gepusht, nieuwe gedrag alleen achter `documentenBeschikbaarVoor`)

- [x] **Stap 1 (2026-11-18):** `docs/sql/2026-11-18-documenten.sql` (tabel `arnobot_documenten` en privé-bucket `arnobot-documenten`), `lib/documentenRegels.ts` met 23 unit-tests (schakelaar `DOCUMENTEN_OPEN` en eigenaar `ARNOBOT_OWNER_USER_ID` plus interne testaccounts, document-ID-validatie, bestandsnaam opschonen, 48 uur, maximum 20 blokken per beurt), en de nieuwe tabel in `check-missing-user-filter`, `check-testaccount-filter` en `check-row-limit`. Niets hiervan raakt een gebruiker of een bestaande route.
- [x] SQL uitgevoerd door Arno (2026-11-18). De bucketcontrole is gezien (privé, 10485760 bytes); de RLS-controle (controle 1) is nog niet gezien, de maandcheck controleert dat. `ARNOBOT_OWNER_USER_ID` staat in Vercel (Production en Preview), dus Arno's account is de eerste gebruiker van de nieuwe functie.
- [x] **Stap 2 (2026-11-18, gebouwd en met unit-tests getoetst, nog niet live uitgeprobeerd):** `lib/documenten.ts` (databasecode; elke query met eigenaarsfilter, een document-ID of pad uit de client wordt nooit zonder dat filter gebruikt), `lib/documentenSamenstellen.ts` (wat er per beurt naar het model gaat, en de melding als een document niet te zien is) en `lib/documentInhoud.ts` (de bestaande omzetting, ongewijzigd verplaatst). De chatroute laadt voor wie `documentenBeschikbaarVoor` toestaat pas ná alle controles, verwijdert zelf nooit iets, en zet alle documenten van het gesprek bij elke beurt in het bericht, één keer vóór alle vervolgpaden. `chat-upload-url` stuurt een document van die gebruikers naar de nieuwe bucket. Voor iedereen anders blijft de oude route ongewijzigd. 62 tests voor de documentencode (waaronder de sessie van 17-11 nagebootst over drie beurten, een document dat ontbreekt of verlopen is, andermans pad en document-ID, een herhaald verzoek), de hele suite van 954 tests blijft groen.
  - Bekende beperkingen, bewust voor stap 3: een upload die door een controle wordt afgewezen blijft ongeregistreerd in de bucket staan tot de opruimsweep; een verlopen en al opgeruimd document laat geen spoor achter, dus het model hoort alleen over "verlopen" zolang de rij er nog staat (stap 3: de opruiming laat een lege rij met alleen de naam achter, daarvoor komt een kleine SQL-wijziging); prompt caching staat nog niet aan (meten bij de bouw, de wisselende context moet dan ná de documenten komen); het wissen van `attachedFile` in de client bij een fout die niet over het bestand gaat blijft zoals het was.
  - Zijdelings gezien: `app/api/chat/route.ts` heeft een lintmelding (`logFout`, prefer-const) die al in de vorige versie zat; niet aangeraakt.
- [ ] **Live controle stap 2** (Arno, met zijn eigen account, na de deploy): een PDF toevoegen met een vraag, daarna twee vervolgvragen zonder bijlage; ArnoBot moet het document in alle drie de beurten kunnen lezen. Daarna een gesprek zonder document.
- [ ] **Stap 3:** opruimsweep van tijdelijke kopieën (cron, alleen voorbij 48 uur na laatst gebruikt), opruimen bij een geslaagde SLUIT, uploadopruiming van wees-bestanden, rate limit op `chat-upload-url`, `e2e/global-teardown.ts` met opslag.
- [ ] **Stap 4:** tab ARCHIEF met Docs, het vinkje, "kies uit Docs", BESPREEK, download en verwijderen, `verwijderGebruikersDocumenten`, export, transcript van audio; teksten (privacy, Q&A, `lib/appHelp.ts`, beveiligings-PDF) eerst als platte tekst aan Arno; documenttekst uit `bron_context` halen vóór het vinkje live gaat.

## Fase 2: import van historie (Chris)

- Eerst uitzoeken wat de claude.ai-export bevat (of projecten erin zitten).
- Projectbestanden zijn gewone documenten en passen in fase 1.
- Chatgeschiedenis: parsen, filteren op sales-inhoud, samenvatten en inladen in het geheugen met de oorspronkelijke datum en bron "import"; het ruwe bestand wordt niet bewaard.
- Toestemmingstekst (klantdata van derden) en een eigen weging voor geïmporteerd geheugen.

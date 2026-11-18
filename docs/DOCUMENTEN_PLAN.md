# Plan: documenten bewaren en historie-import

**Laatst bijgewerkt:** 2026-11-18
**Waar we staan:** plan en aannamecontrole (subagent zonder voorgeschiedenis) zijn klaar. Er is niets gebouwd. Het idee komt uit de vraag of een geüpload document bewaard kan worden, en uit het verzoek van een gebruiker (Chris) om zijn claude.ai-historie mee te nemen.
**Eerstvolgende stap:** fase 1 uitwerken en bouwen. Besluit 2026-11-17: de logging (`bron_context`) en de bijbehorende AVG-teksten worden pas aangepast tijdens/na de bouw, niet apart vooraf. Voorwaarde: dat is klaar vóór het vinkje live gaat, anders bewaren we documenttekst ook voor wie het vinkje uitzet.

## Besluiten (met verworpen alternatieven)

- **Bewaren is standaard aan.** Gekozen: het vinkje "Bewaar in Docs" staat bij elke upload standaard aan, is zichtbaar en kan met één klik uit. Het vinkje onthoudt de keuze niet: elke nieuwe upload begint weer aan (Arno, 2026-11-17). Verworpen: standaard uit (te weinig gebruik, het geheugen blijft leeg); altijd bewaren zonder vinkje (geen moment om "nee" te zeggen bij één gevoelig bestand, en bestaande gebruikers gingen uit van "niet opgeslagen"); de laatste keuze onthouden (overbodig volgens Arno).
- **Wat er bewaard wordt.** Gekozen: het origineel in een aparte private Storage-bucket, plus een eigen tabel met metadata en een samenvatting met embedding voor het geheugen. Verworpen: alleen uitgepakte tekst bewaren, want voor PDF's en afbeeldingen verliest dat tabellen, grafieken en plaatjes (die gaan nu native naar Claude).
- **Waar het zichtbaar wordt.** Gekozen: drie tabs bovenaan de pagina `app/bot/analyses`: Gesprekken, Analyses, Docs. Verworpen: een sectie onderaan de lange pagina (wordt niet gevonden). Daarnaast: een regel met aantal en "verwijder alles" op `/bot/account`, en "kies uit bewaarde documenten" bij het paperclip-icoon in de chat.

## Eis uit een productiegeval (2026-11-17, aangeleverd door een andere sessie)

Bij een echte sessie (salesplan als pdf) zag ArnoBot het document alleen in het bericht waaraan het hing (`documentBlock` in `app/api/chat/route.ts`). In berichten 2 en 3 oordeelde hij over het plan zonder het te kunnen zien, vulde gaten zelf in en verweet de gebruiker uitstel op basis van iets dat niet klopte. Een extra promptregel hielp niet (getest in twee runs). Dit is een bestaand productieprobleem, los van het bewaren.

**Eis:** een bijlage blijft zichtbaar in alle vervolgberichten van hetzelfde gesprek. Is dat ergens niet het geval, dan krijgt ArnoBot expliciet te horen dat het document niet meer zichtbaar is, en zegt hij dat tegen de gebruiker in plaats van voort te bouwen op zijn herinnering.

Gevolgen voor het ontwerp (voorstel, wacht op Arno):
- Ook een upload met het vinkje uit moet tot het einde van het gesprek beschikbaar blijven. Voorstel: "meteen verwijderd" wordt "verwijderd na dit gesprek" (bij sluiten, met een opruimsweep na een vast aantal uur als vangnet). Alternatief zonder tijdelijke kopie: vinkje uit betekent alleen zichtbaar in de beurt van de upload, met de expliciete melding erna. Nog niet besloten.
- De history krijgt per bericht een marker met het document-ID (nu staat er niets); de server laadt de documentblokken één keer vóór de tool-, retry- en vervolglus.
- Valt een document af (limiet, verwijderd, verlopen), dan krijgt het model een expliciete melding.
- Testgeval: de sessie van 17-11 nabouwen met pseudonieme tekst in het testbestand (geen echte namen of cijfers in de repo).

## Open besluiten (Arno)

1. `bron_context`: voorstel documenttekst niet meer loggen, en een bewaartermijn voor de rest van die kolom (bijvoorbeeld 30 dagen). Verworpen voorstel: alleen de privacytekst aanpassen.
2. Lezen van documenten (herzien 2026-11-18, vervangt het eerdere voorstel "alleen native in de beurt van kiezen"): binnen hetzelfde gesprek blijft elke bijlage native zichtbaar (zie de eis hierboven). In een nieuw gesprek gaat een document native mee als de gebruiker het kiest of via BESPREEK, anders werkt het via samenvatting en zoeken. Te controleren bij de bouw: paginalimiet per PDF en het maximum aantal documenten per beurt.
2b. Vinkje uit: tijdelijke kopie tot het gesprek eindigt (voorstel) of alleen zichtbaar in de uploadbeurt met expliciete melding.
3. Quota per plan: aantal en totale MB.
4. AVG art. 25 (privacy by default) tegenover standaard-aan: aanname van Claude, nog niet getoetst aan een bron. Arno zoekt dit zelf uit vóór livegang.

## Bevindingen uit de aannamecontrole (2026-11-17)

Zelf in de code gezien: documenttekst van docx/txt/csv staat in `arnobot_rds_logs.bron_context` (`app/api/chat/route.ts` rond 649-654, tot 250.000 tekens, zonder bewaartermijn); accountverwijdering is alleen een mail (`app/api/bot/delete-account/route.ts`).

Door de subagent gemeld, bij de start van de bouw per punt te verifiëren:
- Sessie verwijderen is een soft delete; `data-cleanup` is een mail met een handmatige checklist en raakt Storage niet.
- Het kruisje bij een bijlage in `SparClient.tsx` verwijdert niets uit Storage; er is geen opruiming van achtergebleven uploads en geen rate limit op `app/api/bot/chat-upload-url`.
- De history bevat geen document: `lib/appHelp.ts` ("een document dat in dit gesprek is toegevoegd, kun je lezen") klopt alleen voor de beurt van de upload.
- Managerroutes (1:1, spotlight, zelfcoaching) lezen `summary`, `feiten` en `title` uit `arnobot_blog_sessions`; gedeelde analyses tonen de volledige tekst.
- Bijlagetekst en bestandsnaam gaan niet langs moderatie of prompt-injectiecontrole; de bestandsnaam staat ongefilterd in de prompt.
- Anthropic-limieten (pagina's per PDF, afbeeldingsgrootte) zijn niet geverifieerd.

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

## Fase 2: import van historie (Chris)

- Eerst uitzoeken wat de claude.ai-export bevat (of projecten erin zitten).
- Projectbestanden zijn gewone documenten en passen in fase 1.
- Chatgeschiedenis: parsen, filteren op sales-inhoud, samenvatten en inladen in het geheugen met de oorspronkelijke datum en bron "import"; het ruwe bestand wordt niet bewaard.
- Toestemmingstekst (klantdata van derden) en een eigen weging voor geïmporteerd geheugen.

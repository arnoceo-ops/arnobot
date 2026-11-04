# Mollie-integratie: bouwplan en voortgang

## Statusblok

- **Laatst bijgewerkt:** 2026-11-04
- **Waar we staan:** 2026-10-21: het Mollie-account is volledig geverifieerd (brief binnen). Het Team-betaalprotocol (fase 2b) is gebouwd en staat live (13-10, `bdf3a315`: adminscherm `/bot/admin/teams`, cron `team-facturatie`, webhook `mollie-team`). Het bedrijfsadres is Verdunplein 17, 5627 SZ Eindhoven. Gekozen: de `live_`-sleutel nog niet wisselen, eerst de resterende tests doen (Arno 21-10: we hebben de tijd). Verworpen: nu al wisselen, want de scenario's hieronder zijn nog niet getest. Stand van 13-10-2026: volledige setup afgerond: Revolut-IBAN bij Mollie, nieuwe testsleutel (lokaal + Vercel + geredeployed), SQL-migratie bevestigd tegen de echte database, Moneybird API-token aanwezig, betaalmethoden iDEAL/creditcard/Bancontact geactiveerd bij Mollie, Moneybird's eigen Mollie-koppeling ("uitbetalingen automatisch koppelen") aangezet. 2026-10-13: verse e2e-test met de nieuwe sleutel geslaagd (particulier, Pro maandelijks, iDEAL, status "paid", Moneybird-factuur 2026-0009 automatisch aangemaakt binnen 4 seconden). Eerder, 2026-10-09: Pro jaarlijks en Pro maandelijks als particulier, Pro jaarlijks als zakelijk, terugbetaling, opzegging getest. Onderweg gevonden en gefixt: toegang bleef staan bij een pending terugbetaling, verlopen gebruikers konden niet opnieuw afrekenen, opzegbevestiging werd nooit verstuurd, misleidende melding bij opgezegd-maar-lopend abonnement. **2026-10-13, zelfde sessie:** particulier-maandelijks-ontwerp herzien, zie de besluitentabel hieronder (doorlopend i.p.v. 12-maanden-stop). Nog niet getest: een mislukte betaling, een echte vervolgbetaling, de zakelijke flow met de nieuwe sleutel.
- **Eerstvolgende stap (bijgewerkt 2026-11-04, Mollie staat LIVE):** op 2026-11-07 de uitbetaling van 2026-11-06 in Moneybird controleren en daarna de echte testbetaling terugbetalen, zie de afvinklijst. De punten (1) tot (3) hieronder zijn gedaan: (1) de nog niet geteste scenario's doorlopen met de testsleutel: een mislukte betaling, een echte vervolgbetaling, de zakelijke flow en Team-facturering end-to-end; (2) ~~uitzoeken of `MONEYBIRD_BETALING_REGISTREREN` aan moet~~ **besloten 2026-11-04: aan laten staan.** Gekozen: aan. Productie heeft hem aan staan (factuur 2026-0015 van de testbetaling van 2026-11-04 staat op betaald via "betaling zonder bewijs" met het Mollie-id, ook 0009 en 0011 zo). Verworpen: uit, want dan wacht de factuur op Moneybirds eigen Mollie-koppeling. Nog te controleren bij de eerste echte uitbetaling na de sleutelwissel: landt die zonder losse open post of dubbele betaling op de factuur? Zo niet, dan de schakelaar uitzetten; (3) daarna de sleutelwissel, zie "Sleutelwissel naar live" hieronder; (4) ~~KvK-adreswijziging naar Eindhoven~~ gedaan (2026-10-23). Stand van 13-10: een volgende sessie samen oppakken: (a) Team-betaalprotocol/fase 2b (inmiddels gebouwd), (b) KvK-adreswijziging naar Eindhoven, (c) of `MONEYBIRD_BETALING_REGISTREREN` aan moet nu Moneybird's eigen "uitbetalingen automatisch koppelen" al aanstaat (risico op dubbele boeking tussen beide mechanismes, nog niet uitgezocht), (d) de nog niet geteste scenario's hieronder. Arno test nu zelf nog de zakelijke flow (particulier al getest). Onderweg gevonden en gefixt: `ARNOBOT_ADMIN_KEY` stond lokaal en op Vercel op verschillende waarden (de admin-terugbetaalknop faalde daardoor met 401), nieuwe sleutel gegenereerd en op beide plekken gelijkgetrokken, Arno moet opnieuw inloggen op `/bot/admin`. Testopruiming van vandaag afgerond: subscriptie op "refunded", Mollie-abonnement geannuleerd, Moneybird-creditnota 2026-0010 automatisch aangemaakt tegenover factuur 2026-0009. **De eerste echte factuur wordt 2026-0025** (stand 2026-11-04: 0009 t/m 0024 zijn testfacturen, elke testbetaling met `MONEYBIRD_OOK_IN_TESTMODUS` bezet een nummer).
- **Blokkerend voor livegang (niet voor bouwen), bijgewerkt 21-10-2026:** (1) ~~Moneybird-facturen voor Team (fase 2b)~~ **gebouwd (13-10-2026)**, end-to-end test nog open; (2) ~~btw-nummer~~ **gedaan (13-10-2026): NL005565123B13 ingevoerd in Mollie, goedgekeurd en in gebruik**; (3) ~~Mollie-verificatie van het account~~ **gedaan (21-10-2026): brief binnen, account geverifieerd**; (4) ~~KvK-adreswijziging naar Eindhoven~~ **gedaan (2026-10-23)**, zie hieronder.
- **Besloten 13-10-2026: adresvelden op het afrekenscherm voor particuliere facturen boven €100 (vereenvoudigde-factuurgrens) zijn al eerder besproken en niet nodig.** Geen verdere actie op dit punt.
- **Resterende tests afgerond (2026-11-04), testaccount test@arno.bot:** (a) mislukte eerste betaling: Mollie laat bij "Failed" de klant een andere methode kiezen, de betaling blijft open tot hij verloopt (15 minuten), normaal gedrag. (b) mislukte vervolgbetaling: een niet-afgeronde betaling met `metadata.subscriptionRowId` liet Mollie op "expired" zetten, ArnoBot verwerkte dat binnen 7 seconden, `betaling_mislukt`-mail en Telegram kwamen aan, toegang liep door tot einde periode. (c) zakelijke flow (iDEAL, Paid): €59,00 plus 21% = €71,39, factuur 2026-0016 (excl. btw, klantgegevens, periode, betaald, per mail verstuurd), vorig particulier abonnement beëindigd en bij Mollie geannuleerd. (d) Team-facturering (testteam Apex): zie onder.
- **Twee bugs gevonden en gefixt in Team-facturering en de klanttype-correctie (2026-11-04, commits 7a260096 en a890b19a):** Mollie-betaallinks (Payment Links API) accepteren GEEN `metadata` (422), en geven de betaalpagina terug als `_links.paymentLink.href`, niet als `url`. Gevolg: de Team-cron maakte wel een factuur maar geen link (en meldde "ok"), de webhook kon een betaling niet aan de factuur koppelen, en de correctieflow gaf geen afreken-URL. Gekozen: koppeling via `?r=<rij-id>` in de eigen webhook-URL, waarbij de betaling altijd bij Mollie wordt bevestigd (betaald, hoort bij de betaallink van de rij via `GET /payment-links/{id}/payments`, bedrag klopt); `lib/billing/webhookId.ts` leest zowel klassieke als next-gen webhooks. Verworpen: de metadata in de webhookbody vertrouwen of het hint-id ongecontroleerd gebruiken. Team-test daarna geslaagd: betaling via de link, rij op paid, Moneybird 2026-0019 (€244,00 excl. btw, €295,24 incl.) afgeletterd. Testfactuur 2026-0017 is gecrediteerd met 2026-0018. Testteam Apex staat weer uit voor facturatie (anders factureert de cron na de sleutelwissel echt) en test@arno.bot is exact teruggezet in zijn oude toestand. **Derde fout, commit 592276e0:** een onbetaalde Team-factuur droeg de workflow-tekst "al betaald, je hoeft niets over te maken", had vervaldatum vandaag (dus meteen "te laat") en werd "handmatig" verstuurd, zodat de teambaas geen PDF kreeg terwijl de ArnoBot-mail dat beloofde. Nu: 14 dagen betaaltermijn, eigen voorwaarden (`teamFactuurVoorwaarden`), de betaallink wordt eerst gemaakt en de factuur gaat via Moneybird per mail (met de link in de tekst, `teamFactuurMailTekst`) naar de teambaas; de ArnoBot-mail met de knop blijft. **Daarna getest en goedgekeurd (2026-11-04):** tussentijdse jaarfactuur voor 1 extra seat (212 van 365 dagen, €468 per seat per jaar: €271,82 excl., €328,90 incl., factuur 2026-0022, betaald via de link, Moneybird-mail met bijlage en link, ArnoBot-mail met knop); herinnering 21 dagen na aanmaak (14 termijn plus 7) en blokkade 45 dagen na aanmaak (14 plus 30) werken, `team_geblokkeerd`-mail en Telegram kwamen aan, deblokkeren bij betaling gaat via de webhook. Let op bij het testen van de tussentijdse factuur: de cron vergelijkt met de nieuwste factuurrij op `created_at`, dus wie een rij terugdateert kan per ongeluk een tweede tussentijdse factuur uitlokken (gebeurd, opgeruimd met 0023 en creditnota 0024). Nog niet getest: een Team-factuur die in het echte Mollie-livemodus wordt betaald. Opvallend maar kosmetisch: het Kenmerk op een Team-factuur is `team-<uuid>`, een interne id.

### Afvinklijst

- [x] Plan en SQL
- [x] Fundament: Mollie-client, prijzen en btw, perioden (met unit tests)
- [x] Checkout-route en webhook (eerste betaling, abonnement aanmaken)
- [x] Verwerking herhaalbetalingen, mislukte betalingen, terugbetalingen en chargebacks
- [x] Opzeggen (particulier direct, zakelijk met opzegtermijn van een maand) plus opzegbevestiging per mail (stond in de voorwaarden maar werd nergens verstuurd)
- [x] Dagelijkse cron: herinneringen 30 en 7 dagen, herstel, einde
- [x] E-mails (6 types)
- [x] Afrekenscherm in `/bot/doorgaan` (particulier of zakelijk, btw-regel, voorwaarden-vinkje, één klik verlengen)
- [x] Accountpagina: exacte einddatum na opzegging
- [x] Admin: terugbetaling binnen bedenktijd (knop in het betaalpaneel)
- [x] Docs, CLAUDE.md (maandcheck, mailtypes), CI-checks bijgewerkt
- [x] Testmodus end-to-end doorlopen (2026-10-09, zie Waar we staan)
- [x] **Fase 2a (Moneybird-account staat, 2026-10-13):** factuur per betaling via de Moneybird-API, bevestigd werkend in de e2e-test van vandaag (factuur 2026-0009, binnen 4 seconden na betaling)
- [x] **Fase 2b (gebouwd 13-10-2026, `bdf3a315`):** Team per factuur met Mollie-betaallink, activeren per team in `/bot/admin/teams`. End-to-end test nog open
- [x] **Resterende tests met de testsleutel (gedaan 2026-11-04):** mislukte betaling, mislukte vervolgbetaling, zakelijke flow, Team-facturering end-to-end (met twee gevonden bugs gefixt, zie statusblok). Een echt geslaagde vervolgbetaling via de Mollie-cyclus (na een maand) kan pas na de sleutelwissel worden gezien
- [x] **Sleutelwissel naar live (gedaan 2026-11-04):** live-sleutel "ArnoBot live" (Standaard API-key, alle rechten, profiel ArnoBot) in Vercel Production, `MONEYBIRD_FACTUREREN_VANAF=2026-11-04` gezet, `MONEYBIRD_OOK_IN_TESTMODUS` verwijderd, stale testklant van test@arno.bot uit `arnobot_billing_customers` gewist. Mollie live gecontroleerd: websiteprofiel online, iDEAL, creditcard, Bancontact en SEPA-incasso actief. `/bot/admin/status` toont Mollie "Modus: live". Eerste echte betaling: Basic maandelijks €29,00 via iDEAL (`tr_TtZRwAwuFGd7nN426b5ZJ`), Moneybird-factuur 2026-0025 betaald, mail en abonnement correct. Mollie-kosten €0,387.
- [ ] **Terugbetaling van de echte testbetaling, bewust uitgesteld tot 2026-11-07.** Gekozen: eerst de uitbetaling van 6 november afwachten en in Moneybird controleren of die zonder losse open post of dubbele betaling op factuur 2026-0025 landt (de enige controle die in testmodus niet kon, zie besluit over `MONEYBIRD_BETALING_REGISTREREN`). Daarna volledig terugbetalen in het Mollie-dashboard (Sales, de betaling, Terugbetalen), wat ArnoBot moet verwerken met toegang beëindigd, het live Mollie-abonnement `sub_Ywi5y4iabE` gestopt, creditnota en mail. Verworpen: nu terugbetalen, want dan is er geen uitbetaling om te controleren. De bedenktijd is 14 dagen en het abonnement wordt pas op 2026-12-04 weer afgeschreven. Daarna test@arno.bot terugzetten (team, `command_manager`, plan `team`, `expires_at` 2035-01-01) met `testacc-backup-live.json` uit de scratchpad of de waarden in dit blok: plan team, paid_at leeg, command_manager true, expires_at 2035-01-01, teamlid (manager) van Team Apex.
- [x] Privacyverklaring (artikelen 2, 3, 5, 6) en beveiligings-PDF v1.6: Mollie en Moneybird als verwerkers (2026-10-09). Moneybird-verwerkersovereenkomst door Arno afgesloten op 2026-10-09 (opslag binnen de EER)
- [x] **Adreswijziging naar Eindhoven (afgerond 2026-10-23, per Arno):** nieuw adres Verdunplein 17, 5627 SZ Eindhoven, handelsnamen ArnoBot en Pallas Consulting bij de KvK, KvK, Mollie, Moneybird en Revolut doorgezet. Gekozen: het adres zonder unitnummer overal (site, docs, Mollie, Moneybird, Revolut), gelijk aan het KvK-uittreksel; post bij PRI Office afleveren op naam ArnoBot. Verworpen: unit C3880 in het adres houden, want de KvK kan die niet registreren (BAG) en het adres zou dan afwijken van het uittreksel.

- [x] Privacyverklaring ingekort (2026-10-09): artikel 2 en sub-verwerkerstabel korter en alfabetisch, OpenAI zonder "Whisper"
- [~] **Managementfacturen (ingericht 2026-10-10, handmatig in Moneybird, buiten de app):** zelfde administratie, handelsnaam Pallas Consulting. Gekozen: extra afzenderadres Pallas Consulting (sinds 2026-10-23 pallas@arno.bot, eerder arno@royaldutchsales.com) met eigen huisstijl (eigen logo) en eigen factuurworkflow (14 dagen, geen betaalmethoden, herinneringen niet automatisch). Moneybird kent geen aparte nummerreeks per handelsnaam, dus ArnoBot en Pallas delen één reeks (toegestaan). De huisstijl "Standaard" met afzenderadres ArnoBot blijft de standaard, want ArnoBot-facturen kiezen zelf geen huisstijl (geverifieerd via de API 2026-10-10). Verworpen: aparte administratie, Word/Excel, bouwen in ArnoBot. Handmatig: Verkoop, Facturen, Factuur toevoegen (niet Externe factuur), dan huisstijl en workflow Pallas Consulting kiezen. Afgerond 2026-10-23: het extra afzenderadres heet nu Pallas Consulting (e-mail arno@royaldutchsales.com, adres Eindhoven, zelfde btw-nummer en KvK). Gekozen: dezelfde Revolut-rekening als ArnoBot, rekeninghouder blijft ArnoBot zoals Revolut hem kent (naamcontrole bij betalers). Verworpen: Wise Zakelijk voor Pallas, want Arno gebruikt Wise niet.

- [x] **Moneybird-nummering (besloten 2026-10-10, herzien):** de bestaande administratie blijft, eerste echte factuur wordt 2026-0009. Gekozen: laten staan. De testfacturen 2026-0001 t/m 0008 zijn betaald en per paar gecrediteerd (saldo nul), de reeks blijft zonder gaten. Verworpen: nieuwe administratie (extra inrichtingswerk voor weinig winst; kan nog tot de eerste echte factuur), volgend nummer verhogen (gat in de reeks). Het testcontact TEST BV kan Arno archiveren; de logo-conceptfactuur #9 verwijderen na controle

## Sleutelwissel naar live

Doen in een aparte stap, na de resterende tests, en pas wanneer Arno het zegt:
1. In Vercel `MOLLIE_API_KEY` vervangen door de `live_`-sleutel (Mollie, Developers, API-sleutels: Mollie toont een sleutel alleen bij het aanmaken, dus direct kopiëren en niet in de chat plakken) en opnieuw deployen. Geen aanhalingstekens meenemen. De huidige testsleutel "AB-test" laten staan als terugvaloptie.
2. In het live-profiel controleren: webhook-URL, en dat iDEAL, creditcard en Bancontact aan staan.
3. Zelf een kleine echte betaling doen, controleren dat de Moneybird-factuur (eerstvolgende nummer is 2026-0025, stand 2026-11-04) wordt aangemaakt, en daarna terugbetalen.
4. Pas na een geslaagde echte betaling de testsleutel intrekken.

Tot de wissel blijft het afrekenen beperkt tot de eigenaar en de interne testaccounts (`mollieBeschikbaarVoor`).

## Fase 2: Moneybird (gebouwd en bevestigd werkend sinds 13-10-2026)

Code staat klaar in `lib/billing/moneybird.ts` (client en pure bouwstenen, 7 unit tests) en `lib/billing/facturatie.ts` (koppeling aan de betaalverwerking). Alles is uit zolang `MONEYBIRD_API_TOKEN` en `MONEYBIRD_ADMINISTRATION_ID` ontbreken. Gebaseerd op de officiële OpenAPI-specificatie (github.com/moneybird/openapi).

**Wat het doet:** na elke verwerkte Mollie-betaling een contact zoeken of aanmaken (op de eigen gebruikers-id als `customer_id`), een factuur maken (particulier: prijs inclusief btw, zakelijk: exclusief, 21%-tarief, omzet uitgesmeerd over de betaalde periode, al betaald), de factuur per e-mail versturen, en bij een volledige terugbetaling een creditnota maken en versturen. Mislukt dat, dan Telegram-melding en de dagelijkse cron probeert het opnieuw.

**Omgevingsvariabelen (allemaal pas invullen als het Moneybird-account er is):**
- `MONEYBIRD_API_TOKEN`: persoonlijk API-token (Moneybird, Instellingen, Externe toepassingen), scope `sales_invoices` en `contacts`.
- `MONEYBIRD_ADMINISTRATION_ID`: het administratie-id.
- `MONEYBIRD_TAX_RATE_ID` (optioneel): het 21%-tarief voor verkoopfacturen; anders zoekt de code het zelf op.
- `MONEYBIRD_LEDGER_ACCOUNT_ID` (optioneel): de omzet-grootboekrekening.
- `MONEYBIRD_WORKFLOW_ID`: eigen factuurworkflow "ArnoBot betaald" zonder betalingsherinneringen en met betaaltermijn 0 (anders stuurt Moneybird een klant na zijn betaling een herinnering zolang de factuur op "open" staat).
- `MONEYBIRD_FACTUREREN_VANAF`: ISO-datum; de cron factureert alleen betalingen vanaf dat moment, zodat oude betalingen nooit met terugwerkende kracht een factuur krijgen.
- `MONEYBIRD_OOK_IN_TESTMODUS=true`: standaard maken Mollie-testbetalingen (test_-sleutel) GEEN factuur, om nepfacturen in de echte administratie te voorkomen.
- `MONEYBIRD_BETALING_REGISTREREN=true`: afletteren van de betaling op de factuur. Staat standaard uit: de boekhoudkundige afhandeling (betaling zonder bewijs of via een Mollie-rekening) moet eerst met het echte account worden vastgesteld.

**Getest op 2026-10-09 met het echte Moneybird-account (Mollie in testmodus):** zakelijke maandbetaling levert factuur 2026-0001/0002 op met klant, btw-nummer, KvK, 21% btw, periode, eigen workflow zonder herinneringen, direct op betaald (negatieve en positieve betaling zonder bewijs), mail zonder openstaand bedrag, en creditnota 0003/0004 bij terugbetaling, ook afgeletterd. Volgorde in de code: factuur als concept maken, op open zetten zonder mail, betaling registreren, pas dan mailen. Let op: de testfacturen 0001 tot en met 0004 staan in de administratie en bezetten de nummers; de eerste echte factuur wordt dus 2026-0005 tenzij de administratie wordt vervangen. Afzenderadres staat nog op het privéadres uit de KvK (Arno past dat later aan). De aanhef "Hey [naam]" gebruikt bij zakelijk de bedrijfsnaam.

**Nog te doen zodra het account er is:** een testfactuur maken en nakijken, vaststellen hoe de betaling het beste wordt afgeletterd, de betaalbevestigingsmail aanpassen met een verwijzing naar de factuur, en Team per factuur met Mollie-betaallink bouwen.

**Afgehandeld (13-10-2026):** een factuur aan een consument boven de €100 moet naam en adres van de afnemer bevatten (vereenvoudigde factuur geldt tot €100). Al eerder met Arno besproken: niet nodig, geen verdere actie.

## Fase 2b: Team-betaalprotocol (ontwerp klaar 13-10-2026, wacht op bouw-akkoord)

**Capability-sweep gedaan (13-10-2026):** Mollie Subscriptions kan geen wisselend bedrag per cyclus (al verworpen in de besluitentabel), dus Team loopt via de **Payment Links API** (bevestigd via de actuele Mollie-docs: vast bedrag, eigen `webhookUrl`, `redirectUrl`, `expiresAt`, `reusable`). Moneybird zelf heeft geen native "betaal nu"-knop op een factuur die wij via de API kunnen aanzetten; de link moet van onze eigen kant komen, zoals de besluitentabel al zegt.

**Ontwerpkeuze seat-aantal (belangrijk, voorkomt het heropenen van een eerder besluit):** GEEN live seat-tracking zoals Slack. Geheugen `project-team-pricing` legde al vast dat volledige automatisering van het gat tussen `/bot/team`-lidmaatschap en betaalde seats bewust is uitgesteld bij het huidige lage volume; dat besluit blijft staan. In plaats daarvan, zoals Salesforce het doet: het actuele ledenaantal in `arnobot_team_members` is al de bron van waarheid, en wordt pas **op het moment van de facturatie** afgelezen (geen self-serve bevestigingsstap, geen real-time proratie per dag). Nooit onder het bij ondertekening afgesproken minimum-seataantal, ook niet als leden wegvallen (bestaand besluit: geen terugbetaling bij afname).

**Tussentijdse toevoeging, cyclus-afhankelijk (herzien 13-10-2026, vervangt het eerdere "maandelijks bijfactureren"-besluit in `docs/ABONNEMENTEN.md`):**
- **Maandelijks:** geen aparte regel nodig, de eerstvolgende reguliere (maand)factuur IS al de eerstvolgende gelegenheid.
- **Jaarlijks:** een tussentijds toegevoegde seat wordt **eenmalig bijgefactureerd**, naar rato over de resterende looptijd tot de jaarvernieuwing (eigen, eenmalige Mollie-betaallink op het moment van signalering, geen wachten tot de jaarvernieuwing zelf). Bedrag: (resterende dagen tot de jaarvernieuwing ÷ 365) × jaarprijs per seat. Bij de jaarvernieuwing zelf wordt het nieuwe totale ledenaantal de baseline voor het volgende jaar. Gekozen boven maandelijkse termijnfacturen (oorspronkelijk plan): minder facturen voor de klant, simpeler te bouwen (één eenmalige link i.p.v. een herhalende cron per tussentijdse seat), en een bevestigd bestaand patroon (Anthropic's eigen Enterprise-seatbilling werkt zo: direct een eenmalige factuur naar rato bij een nieuwe seat).
- **Facturatiedatum op de dag van contractstart** (bevestigd): gestart op 16 oktober → volgende cyclus-factuur op de 16e van de volgende maand/jaar, enzovoort. Hergebruikt de bestaande `voegMaandenToe()` uit `lib/billing/perioden.ts` (al gebruikt voor solo-abonnementen, handelt randgevallen als een start op de 31e al correct af), geen nieuwe datumlogica nodig.

**Datamodel (nieuw, SQL-migratie nodig, Arno moet bevestigen vóór bouw):**
- `arnobot_teams` uitbreiden: `min_seats integer`, `cyclus text` ('maandelijks'/'jaarlijks'), `volgende_factuurdatum date`, `mollie_customer_id text` (eigen klant-record voor het team, los van de command_manager's persoonlijke `arnobot_billing_customers`-rij).
- Nieuwe tabel `arnobot_team_facturen`: `id, team_id, periode_start, periode_einde, cyclus, seats_aantal, bedrag_cent, btw_cent, mollie_payment_link_id, mollie_payment_link_url, status (open/paid/overdue/expired), moneybird_factuur_id, betaald_at, herinnering_at, created_at, updated_at`. RLS aan zonder policies, zelfde patroon als de bestaande billing-tabellen.

**Routes/cron (nieuw):**
- `/api/cron/team-facturatie` (dagelijks, zelfde cron-venster als de bestaande billing-cron): voor elk team waarvan `volgende_factuurdatum` is bereikt, telt `arnobot_team_members`, berekent het bedrag via `lib/teamPricing.ts` (met de minimum-vloer), maakt de Moneybird-factuur (hergebruik van `lib/billing/moneybird.ts`), maakt een Mollie-betaallink met exact dat bedrag, slaat de rij op, stuurt een Telegram-melding naar Arno ("Team X vernieuwd op N seats, was M") en toont/mailt de betaallink aan de command_manager. Reminders op dezelfde 30/7-dagen-logica als de bestaande solo-cron.
- `/api/webhooks/mollie` uitbreiden: betalingen die van een payment-link komen (niet van een Subscription) herkennen en naar de `arnobot_team_facturen`-afhandeling routeren i.p.v. de bestaande solo-afhandeling; Moneybird-afletteren, status bijwerken.
- Nieuwe pagina `/bot/team/facturatie` (alleen command_manager): huidige en eerdere facturen, status, betaalknop naar de opgeslagen `mollie_payment_link_url`.

**Bewust niet aangeraakt:** de bestaande teamtoegang (`arnobot_team_members`-lidmaatschap) blijft de toegangsbron in `proxy.ts`, een onbetaalde Team-factuur blokkeert niemand automatisch; dat is een apart dunning-vraagstuk (herinneren, niet meteen afsluiten) dat in dezelfde bouwronde meekomt maar een eigen go/no-go verdient over de hardheid van afsluiting.

**Volgende stap:** Arno's akkoord op dit ontwerp, dan de SQL-migratie ter bevestiging voorleggen, dan bouwen.

## Besluiten (met verworpen alternatieven)

| Onderwerp | Gekozen | Verworpen, want |
|---|---|---|
| Provider | Mollie (pay-as-you-go) plus Moneybird | Stripe/Paddle: NL-only start, geen OSS-probleem |
| Betaalmethoden | iDEAL, creditcard en Bancontact (voor Belgische klanten, 2026-10-09). Bancontact en iDEAL leveren als eerste betaling een SEPA-machtiging voor vervolgbetalingen op, dus SEPA-incasso moet geactiveerd zijn in het Mollie-profiel. Is een methode nog niet geactiveerd, dan valt de checkout automatisch terug op iDEAL en creditcard | SEPA-incasso als eerste keuze: in testmodus niet volledig te testen, iDEAL maakt zelf een machtiging aan |
| Particulier maandelijks | **Herzien 2026-10-13:** doorlopend, net als zakelijk, geen 12-maanden-stop meer, geen herinneringsmail | Het oude ontwerp (eerste betaling plus abonnement van 11 maanden, totaal 12, daarna verlengmail) is losgelaten. Reden voor de omslag: het "Wet Van Dam-risico" dat in `docs/PAYMENTS_PLAN.md` tegen "onbeperkt doorlopend" werd ingebracht, gold voor een **jaarcontract** dat zichzelf stilzwijgend verlengt. Een altijd-opzegbaar maandabonnement is precies het patroon dat die wet toestaat (zelfde als Netflix/Spotify), dus dat risico speelt hier niet. Particulier **jaarlijks** behoudt de verlengmail (dat *is* een jaarcontract-situatie). |
| Particulier jaarlijks | Eén betaling voor een jaar, geen abonnement | Auto-verlenging: Wet Van Dam-risico |
| Zakelijk | Doorlopend, opzegtermijn een maand | n.v.t. |
| Team | Blijft handmatig tot Moneybird er is, dan factuur met betaallink | Mollie Subscriptions voor Team: factuur is de afspraak, bedrag varieert per gebruiker |
| Toegang | `approved_users.expires_at` = einde betaalde periode plus 3 dagen respijt; `proxy.ts` blijft ongewijzigd | Nieuwe toegangscheck in proxy: onnodig risico op de bestaande gates |
| Webhook-beveiliging | Mollie stuurt alleen `id`; altijd zelf ophalen bij Mollie met de API-sleutel, nooit de body vertrouwen | Handtekening: Mollie ondertekent klassieke webhooks niet |
| Idempotentie | Unieke `mollie_payment_id`, bijwerking alleen door wie `verwerkt_at` als eerste zet | Redis-lock: overbodig, de database garandeert het |
| Prijs | Server berekent altijd uit `lib/kostenTarieven.ts`; nooit een bedrag van de client | n.v.t. |
| Btw | Alleen NL (21%): particulier betaalt het getoonde bedrag, zakelijk bedrag plus 21% | EU-verlegging: pas als er buiten NL wordt verkocht |
| Terugbetaling | Volledig binnen 14 dagen na eerste betaling (alleen consumenten), admin-actie | Automatisch via knop voor de gebruiker: eerst ervaring opdoen |

## Datamodel

Drie nieuwe tabellen, RLS aan zonder policies (net als de rest, alleen service-role):

- `arnobot_billing_customers`: Mollie-klant per gebruiker, klanttype, bedrijfsgegevens.
- `arnobot_subscriptions`: één rij per afgesloten abonnement (status, bedragen, periode, contracteinde, opzegging, herinneringsvlaggen).
- `arnobot_payments`: één rij per Mollie-betaling (idempotentie, terugbetalingen, later het Moneybird-factuurnummer).

## Flows

**Eerste betaling.** `POST /api/bot/checkout` valideert, berekent het bedrag, maakt de Mollie-klant en een `first`-betaling (iDEAL of creditcard) en geeft de checkout-URL terug. De gebruiker betaalt bij Mollie en komt terug op `/bot/doorgaan?betaling=terug`.

**Webhook.** `POST /api/webhooks/mollie` haalt de betaling op, zet de betaling idempotent op betaald, activeert het abonnement, werkt `approved_users` bij (plan, `paid_at`, `expires_at`, `cancelled_at` leeg), maakt waar nodig het Mollie-abonnement aan, zet de referral-conversie en stuurt de bevestiging.

**Herhaalbetaling.** Elke maand verlengt de webhook `expires_at`. Mislukt een betaling, dan volgt een mail en loopt de toegang door tot het einde van de betaalde periode plus respijt.

**Opzeggen.** Particulier: Mollie-abonnement direct stopzetten, toegang loopt door tot het einde van de betaalde periode. Zakelijk: opzegtermijn een maand vóór het einde van de lopende periode; is dat te laat, dan volgt nog één periode. De cron en de webhook stoppen het Mollie-abonnement zodra er geen betaling meer verschuldigd is.

**Verlengen (particulier).** Mail op 30 en 7 dagen vóór het contracteinde met een knop naar `/bot/doorgaan`. Eén klik maakt, met de bestaande machtiging, een nieuw abonnement dat start op het contracteinde. Is er geen geldige machtiging, dan volgt een gewone nieuwe checkout.

**Terugbetaling.** Admin-actie op een betaling: volledige terugbetaling via Mollie, toegang direct beëindigd, abonnement gestopt, bevestigingsmail.

## Veiligheid

Auth op alle gebruikersroutes (Clerk), `userId` altijd uit de sessie. Prijzen alleen server-side. Webhook verifieert door zelf bij Mollie op te halen. Mollie-fouten komen nooit ongefilterd bij de gebruiker. Admin-route met dezelfde cookiecheck als `/api/admin/payment`. Interne testaccounts worden uitgesloten van cron-queries.

## Livegang-checklist

1. SQL uitgevoerd en bevestigd.
2. Testmodus end-to-end doorlopen: eerste betaling met creditcard, herhaalbetaling (Mollie-testabonnement), mislukte betaling, opzegging, terugbetaling.
3. Moneybird gekoppeld en een factuur per betaling aantoonbaar.
4. Btw-nummer ingevuld in `lib/bedrijf.ts`.
5. Mollie-account geverifieerd, live-sleutel in Vercel.
6. Eén echte betaling van een testgebruiker en terugbetaling.

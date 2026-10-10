# Mollie-integratie: bouwplan en voortgang

## Statusblok

- **Laatst bijgewerkt:** 2026-10-09 (einde sessie: privacy ingekort, managementfacturen besloten)
- **Waar we staan:** de hele flow is gebouwd en op 2026-10-09 end-to-end getest in testmodus met het testaccount: Pro jaarlijks en Pro maandelijks als particulier, Pro jaarlijks als zakelijk (bedrag, btw, abonnement bij Mollie, toegang, bevestigingsmail, Telegram), terugbetaling (toegang direct dicht), opzegging (Mollie-abonnement gestopt, einddatum). Onderweg gevonden en gefixt: toegang bleef staan bij een pending terugbetaling, verlopen gebruikers konden niet opnieuw afrekenen (proxy.ts liet alleen /bot/doorgaan niet door), opzegbevestiging werd nooit verstuurd, misleidende melding bij opgezegd-maar-lopend abonnement. Nog niet getest: een mislukte betaling, de eerste echte vervolgbetaling (9 november 2026 voor de testbetaling is gestopt), de verlengmails en iDEAL. Met een test_-sleutel kunnen alleen de eigenaar en de interne testaccounts afrekenen; de VIES-controle wordt in testmodus overgeslagen.
- **Eerstvolgende stap:** Arno voert `docs/sql/2026-10-10-mollie-billing.sql` uit in Supabase, maakt het Mollie-account aan (pay-as-you-go, testmodus) en zet `MOLLIE_API_KEY` (test_...) in `.env.local` en Vercel. Pas daarna kan de flow end-to-end in testmodus draaien.
- **Blokkerend voor livegang (niet voor bouwen):** (1) Moneybird-koppeling voor facturen, want de voorwaarden beloven na elke betaling een factuur; (2) btw-nummer; (3) Mollie-verificatie van het account met KvK-gegevens.

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
- [ ] **Fase 2 (wacht op Moneybird-account):** factuur per betaling via de Moneybird-API, Team per factuur met Mollie-betaallink
- [x] Privacyverklaring (artikelen 2, 3, 5, 6) en beveiligings-PDF v1.6: Mollie en Moneybird als verwerkers (2026-10-09). Moneybird-verwerkersovereenkomst door Arno afgesloten op 2026-10-09 (opslag binnen de EER)
- [ ] **Volgorde rond het adres (besloten 2026-10-09):** contract Oudegracht tekenen, dan KvK wijzigen (adres Oudegracht 161 en handelsnaam ArnoBot), dan pas Mollie verifiëren en in Moneybird het afzenderadres (Oudegracht, admin@arno.bot) en de betalingsvoorwaarden (admin@) in de workflow zetten. De website toont Oudegracht al, dus dit hoort klaar te zijn vóór de livegang

- [x] Privacyverklaring ingekort (2026-10-09): artikel 2 en sub-verwerkerstabel korter en alfabetisch, OpenAI zonder "Whisper"
- [ ] **Managementfacturen (besluit 2026-10-09):** handmatig in Moneybird zelf, buiten de app. Gekozen: zelfde administratie met eigen documentstijl (ander logo en opbouw) en eigen workflow (30 dagen, bank). Verworpen: aparte administratie (dubbele btw-aangifte, waarschijnlijk extra abonnement), Word/Excel (omzet op twee plekken), bouwen in ArnoBot (te veel voor weinig facturen). Open: Arno controleert of een documentstijl een andere handelsnaam toelaat en of een workflow een eigen nummerreeks kan hebben; zo niet, dan aparte administratie heroverwegen. De handelsnaam moet als tweede handelsnaam bij de KvK-wijziging

- [x] **Moneybird-nummering (besloten 2026-10-10, herzien):** de bestaande administratie blijft, eerste echte factuur wordt 2026-0009. Gekozen: laten staan. De testfacturen 2026-0001 t/m 0008 zijn betaald en per paar gecrediteerd (saldo nul), de reeks blijft zonder gaten. Verworpen: nieuwe administratie (extra inrichtingswerk voor weinig winst; kan nog tot de eerste echte factuur), volgend nummer verhogen (gat in de reeks). Het testcontact TEST BV kan Arno archiveren; de logo-conceptfactuur #9 verwijderen na controle

## Fase 2: Moneybird (voorbereid, nog nooit tegen een echt account gedraaid)

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

**Open punt, belangrijk voor de wet:** een factuur aan een consument boven de €100 moet naam en adres van de afnemer bevatten (vereenvoudigde factuur geldt tot €100). Het afrekenscherm vraagt nu geen adres, dus facturen zouden zonder adres worden gemaakt. Voorstel: adresvelden (straat, postcode, plaats, plus volledige naam) toevoegen aan het afrekenscherm voor zowel particulier als zakelijk, opslaan in `arnobot_billing_customers` (SQL-migratie nodig) en meegeven aan Moneybird. Wacht op akkoord van Arno en bevestiging door een boekhouder.

## Besluiten (met verworpen alternatieven)

| Onderwerp | Gekozen | Verworpen, want |
|---|---|---|
| Provider | Mollie (pay-as-you-go) plus Moneybird | Stripe/Paddle: NL-only start, geen OSS-probleem |
| Betaalmethoden | iDEAL, creditcard en Bancontact (voor Belgische klanten, 2026-10-09). Bancontact en iDEAL leveren als eerste betaling een SEPA-machtiging voor vervolgbetalingen op, dus SEPA-incasso moet geactiveerd zijn in het Mollie-profiel. Is een methode nog niet geactiveerd, dan valt de checkout automatisch terug op iDEAL en creditcard | SEPA-incasso als eerste keuze: in testmodus niet volledig te testen, iDEAL maakt zelf een machtiging aan |
| Particulier maandelijks | Eerste betaling plus abonnement van 11 maanden (totaal 12), daarna mail met vraag om verlenging | Doorlopend abonnement: eerder besloten om na 12 maanden te vragen |
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

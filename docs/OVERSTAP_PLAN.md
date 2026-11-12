# Overstappen van maand naar jaar (en solo-maand naar Team): plan en voortgang

## Statusblok

- **Laatst bijgewerkt:** 2026-11-12
- **Waar we staan:** plan goedgekeurd door Arno (11-11), nog niets gebouwd. Mollie staat sinds 11-11 weer op de `test_`-sleutel (status-pagina toont "testmodus, nog niet voor gebruikers open"); er zijn geen betalende klanten. De `live_`-sleutel heeft Arno apart opgeslagen, terugzetten bij livegang is een stap op de livegang-checklist. Het plan is aangevallen door een onafhankelijke reviewer (zonder voorgeschiedenis); de bevindingen zijn hieronder verwerkt.
- **Eerstvolgende stap:** wachten op het sein van Arno ("ik zeg wel wanneer je kunt beginnen met de migratie"). Daarna stap 1 t/m 4 en de tests (migratie, `stopMollieAbonnement` met twee id's en verificatie, webhook-conversie, opzeggen), dan de overstap-route en de knop (alleen eigenaar en testaccounts).
- **Besloten 2026-11-12:** (a) maand naar jaar en solo-maand naar Team worden gebouwd; (b) **solo-jaar naar Team wordt NIET gebouwd** maar pas opgelost als het zich voordoet, volgens de checklist in `docs/SOLO_JAAR_NAAR_TEAM.md` (Arno verwacht dit niet snel); (c) **jaar naar maand bestaat niet**: aan het einde van het jaar opzeggen en daarna opnieuw afrekenen met maand, er komt geen andere route.

## Uitgangspunt

Een maandklant (Basic of Pro, particulier of zakelijk) stapt over naar jaar per volgende incassodatum, zonder verrekening. Niet getoetst bij Mollie: het gedrag van annuleren op een al aangemaakte betaling, het klemmen van dag 29 t/m 31, de geldigheidsduur van idempotency-keys. Bron Mollie-docs (docs.mollie.com, geraadpleegd 2026-11-11): `12 months` is geldig (maximum), `times` is optioneel, een abonnement is te wijzigen via PATCH, startdatum van vandaag of in het verleden en het effect van annuleren staan er niet in. Gaat alleen over `arnobot_subscriptions` (solo). Team heeft geen Mollie-abonnement (betaallink per cyclus, `teamFacturatie.ts`).

## Besluiten maand naar jaar (Arno, 2026-11-11)

1. **Opzeggen terwijl de overstap gepland staat:** beide stoppen, het abonnement eindigt aan het einde van de betaalde periode (`periode_einde`). Zakelijk betaalt in dat zeldzame geval een maand minder dan artikel 7 zegt. Accepteren.
2. **Herroeping of terugbetaling van de jaarbetaling:** het hele abonnement eindigt (zoals nu bij elke terugbetaling, `verwerkVolledigeTerugbetaling`). Opnemen in de voorwaarden.
3. **Minimaal 4 dagen vooraf overstappen.** Het getal is een schatting, niet geverifieerd bij Mollie; later aan te passen.
4. **Gekozen:** nieuw Mollie-abonnement aanmaken en het maandabonnement stoppen. **Verworpen:** het bestaande abonnement PATCHen (docs zwijgen over het effect op al aangemaakte betalingen, de `mollie()`-wrapper kent geen PATCH). **Verworpen:** `cyclus` direct omzetten bij de klik (een late maandbetaling zou 12 maanden optellen, `verwerking.ts` periodeMaanden). **Verworpen:** verrekening naar rato (meer Mollie- en Moneybird-werk, geen behoefte).
5. **Jaar naar maand:** niet mogelijk. Opzeggen, het jaar loopt uit, daarna opnieuw afrekenen met maand (de checkout staat dat toe zodra `periode_einde` voorbij is, `checkout/route.ts`). **Verworpen:** een directe overstap (zou terugbetaling vragen, geen behoefte).

## Ontwerp maand naar jaar (verwerkt na de reviewerronde)

- **Migratie:** nullable kolommen op `arnobot_subscriptions`: geplande cyclus, bedrag, btw, Mollie-abonnement-id, eigen guardkolom `gepland_mollie_sub_geannuleerd_at`.
- **Overstap-route**, vaste volgorde: DB-claim (`gepland` moet leeg zijn) → nieuw abonnement aanmaken (idempotency-key `overstap-<sub>-<periode_einde>`, metadata `subscriptionRowId`) → oude abonnement stoppen en met GET verifiëren (`canceled`) → bij falen het nieuwe weer verwijderen en de claim terugdraaien → kolommen vullen. Weigeren: opgezegd, geen geldige machtiging, `mollie_subscription_id` leeg, open klanttype-correctie, open of pending betaling bij Mollie, minder dan 4 dagen tot de incasso. Startdatum uit Mollie (`nextPaymentDate`, nieuwe GET-functie), niet uit `periode_einde`; verschil groter dan 3 dagen: weigeren. Particulier: `times: 1`; zakelijk: `times: null`, btw via `berekenBedrag(plan, 'jaarlijks', klanttype)`.
- **Webhook:** bij een betaling van het geplande id atomair omzetten (claim geeft de bijgewerkte rij terug): `cyclus`, bedrag, btw, `mollie_subscription_id` = nieuw, `mollie_sub_geannuleerd_at` = null, `contract_einde` (alleen particulier). Pas daarna periode verlengen en factureren. Bedrag moet exact gelijk zijn aan `mp.amount`, anders niet omzetten en Sentry. Periodelengte per betaling vastleggen, zodat een late maandbetaling nooit 12 maanden oplevert.
- **`stopMollieAbonnement`:** stopt beide id's, onafhankelijk, met verificatie en een variant die `boolean` teruggeeft. Gebruikt door opzeggen, cron stap 3 en 5, terugbetaling en `beeindigAndereAbonnementen`.
- **Opzeggen met geplande overstap:** besluit 1. **Verlengen en klanttype-correctie:** weigeren zolang een overstap gepland staat.
- **Bestaand risico, los van de overstap:** cron stap 5 beëindigt na `periode_einde` + 3 dagen ook als een SEPA-betaling nog `pending` is; komt die daarna binnen, dan wordt hij genegeerd. Fixen: stap 5 overslaan zolang er een open of pending betaling is.
- **UI en communicatie:** knop op de accountpagina met prijs, ingangsdatum, akkoord op de voorwaarden en (zakelijk) opzegtermijn; bevestigingsmail; Telegram bij elke overstap met referral-info en aantal betaalmaanden.
- **Vindbaarheid (als laatste bouwen, besloten 2026-11-12):** (1) kaart in het blok ABONNEMENT op de accountpagina, boven "Abonnement opzeggen" (`app/bot/account/page.tsx`), met het voordeel in euro's (Basic €348 wordt €228, Pro €708 wordt €468; zakelijk excl. btw), knop "Overstappen naar jaar", bevestigingsvenster met ingangsdatum, jaarbedrag en akkoord, daarna de kaart "Je stapt over op [datum]" met een link om in te trekken; (2) een regel in de betalingsbevestiging per mail met het voordeel en een link naar de kaart, als platte tekst eerst aan Arno voorleggen (copy-regel); (3) `appHelp.ts` en Q&A, zodat ArnoBot "hoe stap ik over op jaar?" beantwoordt (verplicht in dezelfde commit als de knop). Open: of de kaart altijd getoond wordt of pas na de tweede betaalmaand. Geen betaalscherm en geen nieuwe machtiging nodig, de bestaande machtiging wordt gebruikt.
- **Referral:** tegoed bij de eerste betaalde jaarperiode of na drie betaalmaanden, wat het eerst komt; bij particulieren pas na 14 dagen. Plafond blijft de maandprijs van de referrer op het moment van toekennen. Tegoed toekennen blijft handmatig.

## Solo-maand naar Team (wordt gebouwd)

**Gat:** Team zetten gaat met de hand (`command_manager = true`, `TEAM_ONBOARDING.md` stap 4) en raakt een lopend solo-abonnement niet. Het solo-Mollie-abonnement blijft dan incasseren naast de Team-factuur. Team wordt per periode gefactureerd met een Moneybird-factuur en Mollie-betaallink (cron `team-facturatie`, `teamFacturatie.ts`), niet met incasso of machtiging.

**Besluit (Arno, 2026-11-12):** het solo-abonnement loopt uit tot het einde van de lopende betaalde maand. Het Mollie-abonnement wordt direct gestopt (geen nieuwe incasso), de toegang loopt door tot `periode_einde`, `volgende_factuurdatum` van het team wordt op die datum gezet; daarna start de Team-factuur via Moneybird. Ligt de volgende maandincasso binnen 4 dagen, dan loopt die maand nog en start Team een periode later. De Team-cyclus staat los van de solo-cyclus.

**Te bouwen:**
- Eigen functie die het solo-Mollie-abonnement stopt en de rij op `cancelled` zet, **zonder** `approved_users.cancelled_at` te zetten (de route `cancel-subscription` zet dat op het hele account, [cancel-subscription/route.ts:53-56](../app/api/bot/cancel-subscription/route.ts)).
- **Afscheidsmail-fix:** cron billing stap 5 stuurt "abonnement afgelopen" als er geen ander solo-abonnement loopt; de manager zou hem krijgen terwijl het Team net start. Moet op team-dekking (`isTeamCovered`) controleren.
- Eén adminactie met voorbeeldscherm (datum, Team-factuur), die `command_manager` zet, het solo-abonnement regelt en het team activeert (min. seats, cyclus, factuurdatum). Idempotent.
- Alleen solo **zakelijk**. Een particuliere solo-klant die Team wordt is een klanttype-wissel (btw-nummer en KvK nodig) en valt hier buiten.

## Solo-jaar naar Team (NIET gebouwd, pas bij het eerste geval)

Arno verwacht dit niet snel. Besloten: de rest van het plan wordt volledig gebouwd, dit geval wordt pas opgelost als het zich voordoet. De uitvoering (deelterugbetaling naar rato, creditnota, nieuwe Team-factuur), de formule, de terugvaloptie en de vier open Mollie- en Moneybird-vragen staan in `docs/SOLO_JAAR_NAAR_TEAM.md`. **Gekozen:** handmatig volgens die checklist. **Verworpen:** nu bouwen (deelterugbetaling, deel-creditnota, voorbeeldscherm), want het geval is niet te verwachten en de vier vragen zijn pas bij een echt geval te beantwoorden.

## Scenario-matrix tussentijdse wijzigingen (2026-11-12)

Opgesteld omdat de voorbereiding niet alle situaties dekte. Status per rij; kolom "Keuze" wordt per rij besloten: bouwen, handmatig of niet mogelijk.

| Situatie | Stand | Keuze |
|---|---|---|
| Maand naar jaar (solo) | In dit plan | Bouwen |
| Jaar naar maand | Niet mogelijk, opzeggen en na het einde opnieuw afrekenen met maand | Besloten |
| Solo-maand naar Team | In dit plan | Bouwen |
| Solo-jaar naar Team | `docs/SOLO_JAAR_NAAR_TEAM.md` | Handmatig, pas bij het eerste geval |
| Opzeggen, terugbetaling in bedenktijd, particulier verlengen | Bestaat | n.v.t. |
| Particulier naar zakelijk (verkeerd gekozen) | Bestaat (`klanttypeCorrectie.ts`) | n.v.t. |
| Team: seat erbij of eraf | Bestaat (eraf pas bij verlenging, voorwaarden) | n.v.t. |
| Basic naar Pro | `/bot/upgrade` is een mailto, niet in het billing-systeem; een Mollie-abonnement houdt zijn bedrag | **Richting B (direct, naar rato), zie sectie hieronder; nog één besluit open** |
| Prijswijziging bij bestaande abonnementen | Voorwaarden art. 4 belooft dit; `mollie()` kent geen PATCH | Besloten: bedrag via Mollie (PATCH op `amount`) aanpassen met een script met voorbeeldrun, pas bouwen wanneer Arno een prijswijziging aankondigt |
| Pro naar Basic | Niet gezien | Bouwen (Arno, 2026-11-12): per einde betaalde periode, zonder terugbetaling, via dezelfde geplande-wijziging-machinerie |
| Opzegging ongedaan maken | Niet mogelijk (checkout geeft 409 tot `periode_einde`) | Bouwen (Arno, 2026-11-12): knop "Opzegging intrekken" op de accountpagina; abonnement weer actief, nieuw Mollie-abonnement vanaf het einde van de betaalde periode |
| Betaalmethode wijzigen (verlopen kaart, ander IBAN) | Alleen als de laatste herhaalbetaling mislukte | Bestaande route, niet bouwen (Arno, 2026-11-12): een mislukte incasso geeft de klant de mail BETALING REGELEN naar `/bot/doorgaan` en Arno een Telegram-melding; de nieuwe eerste betaling stopt het oude abonnement. Mollie-onderzoek (docs.mollie.com, 2026-11-12): kaart-eerstebetaling mag €0,00, iDEAL/SEPA niet gedocumenteerd, mandaatwissel op een lopend abonnement niet beschreven, geen klantportaal; mandaat intrekken annuleert alle gekoppelde abonnementen. Niet gecontroleerd: of de mail bij elke van Mollies 5 pogingen opnieuw gaat |
| Team: cyclus wijzigen of Team naar solo | Admin kan `team.cyclus` zetten; effect midden in een periode en Team naar solo niet onderzocht | Open |
| Zakelijk naar particulier | Niet gezien | Open |

## Basic naar Pro (onderzocht 2026-11-12, richting B)

**Besluit Arno:** onderzoek B (direct naar Pro, verschil naar rato direct afrekenen). Gekozen op eigen merites: zonder verrekening krijgt een jaarklant maanden Pro tegen de Basic-prijs.

**Referentie, één bron** (Stripe Billing, gekozen omdat de docs openbaar en uitgebreid zijn; ArnoBot gebruikt Stripe niet, en andere aanbieders zoals Paddle, Chargebee en Recurly zijn niet gelezen, dus dit is niet "de" SaaS-praktijk) ( docs.stripe.com/billing/subscriptions/prorations en /upgrade-downgrade, gelezen 2026-11-12): een upgrade gaat direct in, het ongebruikte deel van het oude plan wordt als credit verrekend tegen het resterende deel van het nieuwe plan (per seconde berekend). Standaard (`create_prorations`) wordt dat verschil pas op de eerstvolgende factuur in rekening gebracht; direct factureren is de instelling `always_invoice`. Een downgrade levert een credit op die niet automatisch wordt terugbetaald. Dat ondersteunt het principe (direct ingaan met verrekening); direct afrekenen is bij Stripe een instelling, niet de standaard.

**Onderzoek, Mollie** (docs.mollie.com/docs/recurring-payments, geraadpleegd 2026-11-12): een losse vervolgbetaling met een geldig mandaat kan direct ("Charging immediately on-demand", `sequenceType: recurring`, `customerId` verplicht, `redirectUrl` mag weg, `metadata` toegestaan) en het bedrag mag afwijken ("the amount for a recurring payment is variable"). SEPA-standaardlimiet per incasso €1.000 (docs.mollie.com/docs/sepa-direct-debit). **Niet in de docs gevonden:** beginstatus en looptijd van zo'n losse betaling, herpogingen bij mislukken (bij abonnementen: tot 5 keer, eens per dag), of de webhook de metadata meegeeft, of een losse betaling zonder `subscriptionId` komt. Dat moet in de test worden vastgesteld.

**Wat B in de code vraagt (gecontroleerd in `verwerking.ts`, `db.ts`, `mollie.ts`):**
- Nieuwe Mollie-functie voor een losse vervolgbetaling (nu alleen `maakEersteBetaling` met `sequenceType: 'first'`).
- Nieuwe betaalsoort (bijvoorbeeld `upgrade`) naast `eerste` en `herhaling`: `rondBetalingAf` behandelt nu elke betaling die niet `eerste` is als een herhaling en telt dan een periode bij. Een upgradebetaling mag de periode niet verlengen. `PayRow.soort` kent `verlenging` al maar niets gebruikt het; mogelijk een CHECK-constraint in de database, nog te controleren.
- Bij een mislukte upgradebetaling: plan terugzetten naar Basic, mail en Telegram (nu stuurt `verwerkMislukteBetaling` voor niet-`eerste` een generieke "betaling mislukt"-mail).
- Het Mollie-abonnement moet daarna het Pro-bedrag incasseren: hergebruik de geplande-wijziging-machinerie (nieuw abonnement, zelfde interval, start op `periode_einde`, oude stoppen) of PATCH op `amount` (docs: voor toekomstige betalingen). Daarom komt `gepland_plan` in de migratie.
- Btw van de betaalrij nu uit de rij (`s.btw_cent`); een late betaling van het oude bedrag zou verkeerde btw krijgen. Btw uit het Mollie-bedrag en `klant_type` afleiden.
- Moneybird-factuur voor de upgradebetaling met een eigen omschrijving ("Upgrade naar Pro, naar rato").
- Bedrag: (Pro-prijs min Basic-prijs) maal resterende dagen gedeeld door dagen in de betaalperiode, bruto per klanttype. Geldt voor maand en jaar (jaar: €468 min €228 naar rato).
- Beperking: SEPA-limiet van €1.000 per incasso (ruim genoeg voor Basic naar Pro).

**Besloten (Arno, 2026-11-12):** Pro-toegang direct bij de klik, terugzetten naar Basic als de betaling mislukt. **Verworpen:** pas toegang na een geslaagde betaling (SEPA kan dagen pending zijn; de SaaS-praktijk geeft ook direct toegang).

**Pro naar Basic:** nog niet besloten. Volgens de SaaS-praktijk (Stripe) gaat een downgrade aan het einde van de periode of levert een credit op zonder terugbetaling; voorstel: aan het einde van de betaalde periode, zonder verrekening.

## Afvinklijst

- [ ] Migratie (`docs/sql/`)
- [ ] `stopMollieAbonnement`: twee id's, verificatie, `boolean`-variant
- [ ] Mollie-wrapper: `haalAbonnement` (GET, `nextPaymentDate`, status) en lijst betalingen van een abonnement
- [ ] Webhook-conversie plus tests (dubbele webhook, late maandbetaling, stop-fout, opzeggen tussendoor, cron stap 5 bij pending)
- [ ] Cron stap 5: niet beëindigen bij open of pending betaling
- [ ] Overstap-route
- [ ] Overstap-knop plus bevestigingsmail (eerst alleen eigenaar en testaccounts)
- [ ] **Als laatste:** vindbaarheid: kaart op de accountpagina, mailregel in de betalingsbevestiging (tekst eerst aan Arno), `appHelp.ts` en Q&A
- [ ] Referral-copy en -regel, voorwaarden (art. 4, 7, 8), `appHelp.ts`, Q&A, `ABONNEMENTEN.md`
- [ ] Solo-maand naar Team: eigen stopfunctie, afscheidsmail-fix, adminactie met voorbeeldscherm
- [ ] Test in testmodus met eigen account; vlak voor livegang één echte betaling met terugbetaling
- [ ] Basic naar Pro (B): `gepland_plan` in de migratie, losse vervolgbetaling, betaalsoort `upgrade`, terugzetten bij mislukken, Moneybird-omschrijving; test in testmodus welke status en webhook zo'n losse betaling krijgt
- [ ] Prijswijziging bestaande abonnementen: pas bouwen bij aankondiging (PATCH op `amount`, script met voorbeeldrun)
- [x] Solo-jaar naar Team: bewust niet gebouwd, checklist in `docs/SOLO_JAAR_NAAR_TEAM.md` (2026-11-12)

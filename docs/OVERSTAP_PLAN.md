# Overstappen van maand naar jaar (en solo naar Team): plan en voortgang

## Statusblok

- **Laatst bijgewerkt:** 2026-11-11
- **Waar we staan:** plan goedgekeurd door Arno (11-11), nog niets gebouwd. Mollie staat sinds 11-11 weer op de `test_`-sleutel (status-pagina toont "testmodus, nog niet voor gebruikers open"); er zijn geen betalende klanten. De `live_`-sleutel heeft Arno apart opgeslagen, terugzetten bij livegang is een stap op de livegang-checklist. Het plan is aangevallen door een onafhankelijke reviewer (zonder voorgeschiedenis); de bevindingen zijn hieronder verwerkt.
- **Eerstvolgende stap:** stap 1 t/m 4 en de tests (migratie, `stopMollieAbonnement` met twee id's en verificatie, webhook-conversie, opzeggen). Daarna de overstap-route en de knop (alleen eigenaar en testaccounts).
- **Open besluit:** solo-jaarklant die halverwege het jaar naar Team wil: laten uitlopen of restant verrekenen (voorstel: laten uitlopen).

## Uitgangspunt

Een maandklant (Basic of Pro, particulier of zakelijk) stapt over naar jaar per volgende incassodatum, zonder verrekening. Niet getoetst bij Mollie: het gedrag van annuleren op een al aangemaakte betaling, het klemmen van dag 29 t/m 31, de geldigheidsduur van idempotency-keys. Bron Mollie-docs (docs.mollie.com, geraadpleegd 2026-11-11): `12 months` is geldig (maximum), `times` is optioneel, een abonnement is te wijzigen via PATCH, startdatum van vandaag of in het verleden en het effect van annuleren staan er niet in. Gaat alleen over `arnobot_subscriptions` (solo). Team heeft geen Mollie-abonnement (betaallink per cyclus, `teamFacturatie.ts`).

## Besluiten (Arno, 2026-11-11)

1. **Opzeggen terwijl de overstap gepland staat:** beide stoppen, het abonnement eindigt aan het einde van de betaalde periode (`periode_einde`). Zakelijk betaalt in dat zeldzame geval een maand minder dan artikel 7 zegt. Accepteren.
2. **Herroeping of terugbetaling van de jaarbetaling:** het hele abonnement eindigt (zoals nu bij elke terugbetaling, `verwerkVolledigeTerugbetaling`). Opnemen in de voorwaarden.
3. **Minimaal 4 dagen vooraf overstappen.** Het getal is een schatting, niet geverifieerd bij Mollie; later aan te passen.
4. **Gekozen:** nieuw Mollie-abonnement aanmaken en het maandabonnement stoppen. **Verworpen:** het bestaande abonnement PATCHen (docs zwijgen over het effect op al aangemaakte betalingen, de `mollie()`-wrapper kent geen PATCH). **Verworpen:** `cyclus` direct omzetten bij de klik (een late maandbetaling zou 12 maanden optellen, `verwerking.ts` periodeMaanden). **Verworpen:** verrekening naar rato (meer Mollie- en Moneybird-werk, geen behoefte).

## Ontwerp (verwerkt na de reviewerronde)

- **Migratie:** nullable kolommen op `arnobot_subscriptions`: geplande cyclus, bedrag, btw, Mollie-abonnement-id, eigen guardkolom `gepland_mollie_sub_geannuleerd_at`.
- **Overstap-route**, vaste volgorde: DB-claim (`gepland` moet leeg zijn) → nieuw abonnement aanmaken (idempotency-key `overstap-<sub>-<periode_einde>`, metadata `subscriptionRowId`) → oude abonnement stoppen en met GET verifiëren (`canceled`) → bij falen het nieuwe weer verwijderen en de claim terugdraaien → kolommen vullen. Weigeren: opgezegd, geen geldige machtiging, `mollie_subscription_id` leeg, open klanttype-correctie, open of pending betaling bij Mollie, minder dan 4 dagen tot de incasso. Startdatum uit Mollie (`nextPaymentDate`, nieuwe GET-functie), niet uit `periode_einde`; verschil groter dan 3 dagen: weigeren. Particulier: `times: 1`; zakelijk: `times: null`, btw via `berekenBedrag(plan, 'jaarlijks', klanttype)`.
- **Webhook:** bij een betaling van het geplande id atomair omzetten (claim geeft de bijgewerkte rij terug): `cyclus`, bedrag, btw, `mollie_subscription_id` = nieuw, `mollie_sub_geannuleerd_at` = null, `contract_einde` (alleen particulier). Pas daarna periode verlengen en factureren. Bedrag moet exact gelijk zijn aan `mp.amount`, anders niet omzetten en Sentry. Periodelengte per betaling vastleggen, zodat een late maandbetaling nooit 12 maanden oplevert.
- **`stopMollieAbonnement`:** stopt beide id's, onafhankelijk, met verificatie en een variant die `boolean` teruggeeft. Gebruikt door opzeggen, cron stap 3 en 5, terugbetaling en `beeindigAndereAbonnementen`.
- **Opzeggen met geplande overstap:** besluit 1. **Verlengen en klanttype-correctie:** weigeren zolang een overstap gepland staat.
- **Bestaand risico, los van de overstap:** cron stap 5 beëindigt na `periode_einde` + 3 dagen ook als een SEPA-betaling nog `pending` is; komt die daarna binnen, dan wordt hij genegeerd. Fixen: stap 5 overslaan zolang er een open of pending betaling is.
- **UI en communicatie:** knop op de accountpagina met prijs, ingangsdatum, akkoord op de voorwaarden en (zakelijk) opzegtermijn; bevestigingsmail; Telegram bij elke overstap met referral-info en aantal betaalmaanden.
- **Referral:** tegoed bij de eerste betaalde jaarperiode of na drie betaalmaanden, wat het eerst komt; bij particulieren pas na 14 dagen. Plafond blijft de maandprijs van de referrer op het moment van toekennen. Tegoed toekennen blijft handmatig.

## Solo naar Team (open, nog niet ontworpen)

Gat: Team zetten gaat met de hand (`command_manager = true`, `TEAM_ONBOARDING.md` stap 4) en raakt een lopend solo-abonnement niet. Het solo-Mollie-abonnement blijft dan incasseren naast de Team-factuur. Voorstel: één adminactie die `command_manager` zet en het solo-abonnement aan het einde van de betaalde periode stopt; Team-cyclus staat los van de solo-cyclus. Nog uit te zoeken: referral-tegoed en proefperiode bij zo'n overstap, solo-jaarklant halverwege het jaar (open besluit hierboven).

## Afvinklijst

- [ ] Migratie (`docs/sql/`)
- [ ] `stopMollieAbonnement`: twee id's, verificatie, `boolean`-variant
- [ ] Mollie-wrapper: `haalAbonnement` (GET, `nextPaymentDate`, status) en lijst betalingen van een abonnement
- [ ] Webhook-conversie plus tests (dubbele webhook, late maandbetaling, stop-fout, opzeggen tussendoor, cron stap 5 bij pending)
- [ ] Cron stap 5: niet beëindigen bij open of pending betaling
- [ ] Overstap-route
- [ ] Knop plus bevestigingsmail (eerst alleen eigenaar en testaccounts)
- [ ] Referral-copy en -regel, voorwaarden (art. 4, 7, 8), `appHelp.ts`, Q&A, `ABONNEMENTEN.md`
- [ ] Solo naar Team: ontwerp en adminactie
- [ ] Test in testmodus met eigen account; vlak voor livegang één echte betaling met terugbetaling

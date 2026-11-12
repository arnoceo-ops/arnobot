# Overstappen van maand naar jaar (en solo naar Team): plan en voortgang

## Statusblok

- **Laatst bijgewerkt:** 2026-11-12
- **Waar we staan:** plan goedgekeurd door Arno (11-11), nog niets gebouwd. Mollie staat sinds 11-11 weer op de `test_`-sleutel (status-pagina toont "testmodus, nog niet voor gebruikers open"); er zijn geen betalende klanten. De `live_`-sleutel heeft Arno apart opgeslagen, terugzetten bij livegang is een stap op de livegang-checklist. Het plan is aangevallen door een onafhankelijke reviewer (zonder voorgeschiedenis); de bevindingen zijn hieronder verwerkt.
- **Eerstvolgende stap:** stap 1 t/m 4 en de tests (migratie, `stopMollieAbonnement` met twee id's en verificatie, webhook-conversie, opzeggen). Daarna de overstap-route en de knop (alleen eigenaar en testaccounts).
- **Besloten 2026-11-12:** solo naar Team, zie de sectie hieronder. Open: vier Mollie- en Moneybird-vragen (niet in de docs te vinden), te beantwoorden via Mollie-support of een test.

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

## Solo naar Team (besloten 2026-11-12)

**Gat:** Team zetten gaat met de hand (`command_manager = true`, `TEAM_ONBOARDING.md` stap 4) en raakt een lopend solo-abonnement niet. Het solo-Mollie-abonnement blijft dan incasseren naast de Team-factuur. Team wordt per periode gefactureerd met een Moneybird-factuur en Mollie-betaallink (cron `team-facturatie`, `teamFacturatie.ts`), niet met incasso of machtiging.

**Besluiten (Arno):**
1. **Solo maand:** het abonnement loopt uit tot het einde van de lopende betaalde maand. Het Mollie-abonnement wordt direct gestopt (geen nieuwe incasso), de toegang loopt door tot `periode_einde`, `volgende_factuurdatum` van het team wordt op die datum gezet; daarna start de Team-factuur via Moneybird. Ligt de volgende maandincasso binnen 4 dagen, dan loopt die maand nog en start Team een periode later.
2. **Solo zakelijk jaar:** naar rato terugbetalen vanaf de datum waarop het Team ingaat, als deelterugbetaling in Mollie plus een creditnota in Moneybird, en een nieuwe Team-factuur. Het jaarabonnement bij Mollie stopt.
3. **Eén adminactie met voorbeeldscherm:** toont het terug te betalen bedrag en de Team-factuur, voert pas uit na bevestiging (geld, niet terug te draaien). Zet `command_manager`, regelt het solo-abonnement en activeert het team (min. seats, cyclus, factuurdatum). Idempotent. De Team-cyclus staat los van de solo-cyclus.
4. **Naar-rato-formule:** netto per dag maal de resterende dagen vanaf de Team-startdatum, plus 21% btw; terugbetaling bruto.
5. **Alleen solo zakelijk.** Een particuliere solo-klant die Team wordt is een klanttype-wissel (btw-nummer en KvK nodig) en valt hier buiten.

**Gekozen:** terugbetalen plus nieuwe factuur. **Verworpen:** het restant verrekenen op de eerste Team-factuur (simpeler, maar niet gekozen; terugvallen alleen als terugbetalen niet kan). **Verworpen:** het solo-jaar laten uitlopen (de Team-wens gaat meteen in).

**Gecontroleerd in de code (2026-11-12):** `admin/refund` betaalt altijd volledig terug en beëindigt het hele abonnement (`refund/route.ts`); `creditnotaVoorBetaling` maakt de creditnota voor het volledige bedrag (`facturatie.ts`); een deelterugbetaling beëindigt het abonnement niet (`verwerking.ts`, grens bij volledig); de Team-factuur gebruikt de klantgegevens van de manager uit `arnobot_billing_customers`, die bij een solo-zakelijke klant al bestaan.

**Gevonden gaten voor de bouw:**
- De afscheidsmail "abonnement afgelopen" (cron billing stap 5) kijkt alleen naar andere solo-abonnementen; de manager zou hem krijgen terwijl het Team net start. Moet op team-dekking (`isTeamCovered`) controleren.
- Een Mollie-terugbetaling komt in de wachtrij bij te laag saldo, tot er geld binnenkomt (docs.mollie.com/docs/refunds, 2026-11-12). Je uitbetalingen gaan naar Revolut, dus dit kan echt gebeuren: de adminactie toont de refund-status en de Team-factuur wacht er niet op.
- Mollie weigert dezelfde bedragen binnen een uur op dezelfde betaling als dubbel; de idempotency-key van de deelterugbetaling moet daarbij passen.

**Niet te verifiëren in de docs, nog open:** ondersteunen iDEAL, creditcard en Bancontact terugbetalen (docs: "most payment methods"); is er een maximale termijn na de betaling; worden de transactiekosten teruggegeven; staat Moneybird via `maakCreditnota` een deel-creditnota toe. Uitzoeken via Mollie-support of een test; testmodus bewijst de termijn en de kosten niet.

**Nog uit te zoeken:** referral-tegoed en proefperiode bij zo'n overstap.

## Afvinklijst

- [ ] Migratie (`docs/sql/`)
- [ ] `stopMollieAbonnement`: twee id's, verificatie, `boolean`-variant
- [ ] Mollie-wrapper: `haalAbonnement` (GET, `nextPaymentDate`, status) en lijst betalingen van een abonnement
- [ ] Webhook-conversie plus tests (dubbele webhook, late maandbetaling, stop-fout, opzeggen tussendoor, cron stap 5 bij pending)
- [ ] Cron stap 5: niet beëindigen bij open of pending betaling
- [ ] Overstap-route
- [ ] Knop plus bevestigingsmail (eerst alleen eigenaar en testaccounts)
- [ ] Referral-copy en -regel, voorwaarden (art. 4, 7, 8), `appHelp.ts`, Q&A, `ABONNEMENTEN.md`
- [ ] Solo naar Team: deelterugbetaling (Mollie) en deel-creditnota (Moneybird), afscheidsmail-fix, adminactie met voorbeeldscherm
- [ ] Solo naar Team: de vier open Mollie- en Moneybird-vragen beantwoorden. **Besloten 2026-11-12:** zelf testen, niet via Mollie-support. Voorwaarde: de adminactie krijgt een terugvaloptie (weigert Mollie de deelterugbetaling, dan het restant verrekenen op de eerste Team-factuur), en vlak voor livegang één echte deelterugbetaling met klein bedrag (kosten en iDEAL zichtbaar). Bewijs al aanwezig: de echte iDEAL-betaling van 4 november is volledig terugbetaald. Niet te testen: de maximale termijn (pas bij een oude betaling), vandaar de terugvaloptie.
- [ ] Test in testmodus met eigen account; vlak voor livegang één echte betaling met terugbetaling

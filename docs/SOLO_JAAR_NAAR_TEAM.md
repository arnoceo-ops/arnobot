# Solo-jaarklant stapt over naar Team: checklist voor het moment dat het voorkomt

## Statusblok

- **Laatst bijgewerkt:** 2026-11-12
- **Waar we staan:** bewust niet gebouwd (besluit Arno, 2026-11-12: hij verwacht dit niet snel). Dit document is de handmatige werkwijze voor het eerste echte geval, plus de vier vragen die dan beantwoord moeten worden. Context en het bouwplan voor de andere overstappen: `docs/OVERSTAP_PLAN.md`.
- **Eerstvolgende stap:** geen. Pas oppakken als een zakelijke solo-jaarklant Team wil.
- **Gekozen:** handmatig volgens deze checklist. **Verworpen:** nu bouwen (deelterugbetaling, deel-creditnota, voorbeeldscherm), want het geval is niet te verwachten. **Verworpen:** het jaar laten uitlopen (Arno: Team gaat meteen in). **Terugvaloptie als terugbetalen niet lukt:** het restant verrekenen op de eerste Team-factuur.

## Wanneer geldt dit

Een **zakelijke** klant met een lopend solo-jaarabonnement (`arnobot_subscriptions`: `cyclus = 'jaarlijks'`, `klant_type = 'zakelijk'`, status `active`) wil per direct Team. Niet voor: solo-maand naar Team (dat wordt gebouwd, zie `OVERSTAP_PLAN.md`) en particuliere klanten (klanttype-wissel, buiten scope).

## Uitgangspunten (pas toetsen als het geval zich voordoet)

- De klant betaalde het jaar via een Mollie-betaling met een Moneybird-factuur; beide zijn terug te vinden in `arnobot_payments` (`mollie_payment_id`, `moneybird_factuur_id`).
- Een deelterugbetaling beëindigt het abonnement niet: `verwerking.ts` markeert alleen een volledige terugbetaling of chargeback als einde (`terugbetaald >= bedrag_cent`).
- De Team-factuur gebruikt de klantgegevens van de manager uit `arnobot_billing_customers` (bedrijfsnaam, KvK, btw, adres); die bestaan bij een solo-zakelijke klant al.
- Zakelijke klanten hebben geen herroepingsrecht (voorwaarden artikel 8); het terugbetalen is een afspraak, geen verplichting.

## De checklist

**Voorbereiding**
1. Spreek met de klant af: de datum **D** waarop Team ingaat, het aantal seats, de Team-cyclus (maand of jaar; staat los van de solo-cyclus) en het terug te betalen bedrag.
2. Zoek de rij op in `arnobot_subscriptions` en de bijbehorende betaling in `arnobot_payments`. Noteer: `bedrag_cent`, `btw_cent`, `periode_start`, `periode_einde`, `mollie_payment_id`, `mollie_subscription_id`, `moneybird_factuur_id`.
3. **Bereken het bedrag naar rato:** netto = (`bedrag_cent` min `btw_cent`) maal R gedeeld door T, waarbij R het aantal resterende dagen is van D tot `periode_einde` en T het aantal dagen van `periode_start` tot `periode_einde`. Btw 21% erbij, terugbetaling bruto, afgerond op centen. Voorbeeld: Pro zakelijk jaar, bruto €566,28 (netto €468,00), Team start na 3 maanden (R/T = 9/12): netto €351,00, bruto **€424,71**.

**Uitvoering, in deze volgorde**
4. **Mollie-dashboard:** deelterugbetaling van de jaarbetaling voor het bruto bedrag, omschrijving "Terugbetaling naar rato bij overstap naar Team". Controleer de status: `queued` (te laag Mollie-saldo, wacht tot er geld binnenkomt; Revolut-uitbetalingen kunnen het saldo laag houden), `pending`, `processing`, `refunded` of `failed`. Dezelfde bedragen binnen een uur op dezelfde betaling worden als dubbel geweigerd. Faalt of wordt het geweigerd: terugvaloptie hieronder.
5. **Mollie-dashboard:** annuleer het doorlopende jaarabonnement van deze klant (`mollie_subscription_id`), anders incasseert Mollie over een jaar opnieuw.
6. **Supabase:** zet de solo-rij op `ended` en `mollie_sub_geannuleerd_at` op nu (handmatige SQL, alleen die ene rij). Daarmee slaat de billing-cron de rij over en komt de foutieve afscheidsmail (cron stap 5, kijkt niet naar team-dekking) niet.
7. **Moneybird:** maak een creditnota voor het deelbedrag (netto plus 21% btw, bruto gelijk aan de terugbetaling) tegen de originele jaarfactuur, en registreer de terugbetaling met het Mollie-id.
8. **Team activeren:** volg `docs/TEAM_ONBOARDING.md` (stap 4 en 7): `command_manager = true` op D, en op `/bot/admin/teams` het team activeren met min. seats, cyclus en `volgende_factuurdatum` = D. De cron maakt dan op D de Team-factuur (Moneybird plus Mollie-betaallink).

**Controle achteraf**
9. Refund-status `refunded` in Mollie; in `arnobot_payments` staat `terugbetaald_cent` op het deelbedrag en de rij is NIET als geheel terugbetaald verwerkt.
10. De solo-rij staat op `ended`, geen Mollie-abonnement meer actief, de Team-factuur is aangemaakt, de manager heeft toegang via Team.
11. Noteer het geval (klant, bedrag, datum, uitkomst van de vier vragen) onderaan dit document.

## Terugvaloptie: verrekenen op de eerste Team-factuur

Lukt de deelterugbetaling niet (geweigerd, termijn verstreken, methode ondersteunt het niet): niets terugbetalen, maar het restantbedrag als negatieve regel op de eerste Team-factuur zetten. Stappen 5, 6 en 8 blijven gelden, stap 4 en 7 vervallen. Zet `volgende_factuurdatum` van het team op de eerste reguliere factuurdatum NA de verrekening, zodat de cron niet nog een factuur maakt naast de handmatige.

## De vier vragen die dan beantwoord moeten worden

Niet in de Mollie-docs te vinden (docs.mollie.com/docs/refunds en create-refund, geraadpleegd 2026-11-12). Besluit Arno: zelf uitzoeken in het eerste echte geval, niet via Mollie-support.

1. **Ondersteunt de betaalmethode van deze klant een deelterugbetaling?** Docs: "most payment methods". Bekend: een volledige iDEAL-terugbetaling werkte live (de betaling van 4 november 2026). Een deelterugbetaling, creditcard en Bancontact zijn niet getest.
2. **Is er een maximale termijn na de betaling?** Niet in de docs. Pas te zien bij een oude betaling; de terugvaloptie dekt dit.
3. **Worden de transactiekosten teruggegeven?** Niet in de docs. Zichtbaar in Mollie (afrekening) na de eerste terugbetaling; vergelijk met de kosten van de oorspronkelijke betaling (bijvoorbeeld €0,387 bij de betaling van 4 november).
4. **Laat Moneybird een deel-creditnota toe?** De bestaande code (`creditnotaVoorBetaling`) maakt alleen een creditnota voor het volledige bedrag; of de handmatige route in Moneybird een eigen bedrag toestaat en hoe de terugbetaling zich daarop laat registreren, is niet geverifieerd. Eerst in de Moneybird-interface proberen.

Nog uit te zoeken bij het eerste geval: wat er met een referral-tegoed en een nog lopende proefperiode gebeurt bij zo'n overstap.

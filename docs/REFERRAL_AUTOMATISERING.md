# Referral-tegoed volledig automatiseren: plan en voortgang

## Statusblok

- **Laatst bijgewerkt:** 2026-11-16
- **Waar we staan:** alleen een plan, er is niets gebouwd. Het ontwerp is aangevallen door een onafhankelijke reviewer zonder voorgeschiedenis; de bevindingen zijn verwerkt. Arno heeft akkoord gegeven op de vier besluiten hieronder. Wat al staat (los van dit plan): managers van een team hebben een referral-link, een geworven team telt als één betalende referral, spelregels versie 1.5, en de teamaanvraagmelding vermeldt of het team via een referral binnenkwam.
- **Eerstvolgende stap:** Arno beoordeelt dit document. Daarna fase 0 (schema van `arnobot_referrals` en `referral_credit` in Supabase nalezen, Mollie-terugbetalingskosten vaststellen), dan fase 1.
- **Nog onverifieerd (eerst nalezen, niet aannemen):** (a) wat Mollie rekent voor een terugbetaling en of de oorspronkelijke transactiekosten terugkomen (de helppagina gaf een 403; een externe bron noemt €0,25 per terugbetaling zonder teruggave van de transactiekosten); (b) of een gedeeltelijke terugbetaling in de bestaande code goed doorloopt (`terugbetaald_cent` wordt gevuld, de cron behandelt alleen een volledige terugbetaling als einde van het abonnement); (c) het schema van `arnobot_referrals` en `referral_credit`: er staat nergens SQL voor in `docs/sql`; (d) de Moneybird-creditnota via de API.

## Afvinklijst

- [ ] Fase 0: schema nalezen, Mollie-kosten vaststellen, besluit over de bedragsbasis (zie hieronder)
- [ ] Fase 1: grootboek, betrouwbare conversie (ook Team), verdien-cron, mijlpaalmelding, mails
- [ ] Fase 2: terugdraaien bij herroeping, terugbetaling en chargeback
- [ ] Fase 3: verrekenen voor team-managers (kortingsregel op de factuur)
- [ ] Fase 4: verrekenen voor individuele gebruikers (gedeeltelijke terugbetaling plus creditnota)
- [ ] Fase 5: bewaking, beheeroverzicht, tests, proef in testmodus
- [ ] Fase 6: copy en docs (spelregels 1.6, `lib/appHelp.ts`, mails, `docs/ABONNEMENTEN.md`, `docs/ARNOBOT_OVERZICHT.md`, PDF's)

## Uitgangspunt

De spelregels (`app/referrals/page.tsx`, `docs/ABONNEMENTEN.md`) zijn gegeven: eenmalig tegoed als de geworven gebruiker Pro of Team kiest, plafond is de eigen maandprijs van de referrer (voor een manager de totale teamprijs), alleen verrekening op een verlenging, geen uitbetaling, geen vervaldatum. Het tegoed is nu handwerk: `referral_credit` op `approved_users` wordt nergens in de code opgehoogd, alleen uitgelezen. Geen Mollie- of Moneybird-gedrag is aangenomen zonder het in code of in de docs te zien; wat niet is gezien staat hierboven als onverifieerd.

## Besluiten (Arno, 2026-11-16)

1. **Volledig automatiseren**, niet halfautomatisch met een knop.
2. **Verrekenen bij individuen via een gedeeltelijke terugbetaling van de verlengingsbetaling plus een creditnota in Moneybird. Bij team-managers via een kortingsregel op de factuur** op het moment dat onze eigen cron de factuur maakt. **Verworpen: het Mollie-abonnement verlagen** (PATCH van het bedrag voor toekomstige betalingen), want: Mollie accepteert geen bedrag van 0, een jaarlijks particulier abonnement heeft helemaal geen Mollie-abonnement (een jaar is één betaling), de code heeft geen PATCH en geen plek om het bedrag na de betaling terug te zetten, de cron draait om 05:00 UTC terwijl Mollie op de incassodatum incasseert (geen betrouwbaar venster), SEPA blijft dagen `pending`, een gemiste webhook laat de klant structureel te weinig betalen, en overstap, upgrade, intrekken en opzeggen maken abonnementen opnieuw met het volle bedrag. **Verworpen: gratis maanden via de einddatum**, want dat botst met de automatische incasso (dubbele afschrijving).
3. **Jaarabonnement: tegoed pas na de bedenktijd van 14 dagen** (`lib/billing/herroeping.ts`), niet "direct na de eerste betaling". Artikel 4 van de spelregels wordt aangepast. **Verworpen:** direct toekennen met terugdraaien bij herroeping, want dat laat een kans op tegoed zonder dekking staan.
4. **Referrer zonder betalend abonnement** (trial, Basic of handmatig BETAALD): het tegoed wacht tot zijn eerste verlenging. Een handmatig account (BETAALD-vlag, geen `arnobot_subscriptions`-rij en geen Mollie-abonnement) blijft handwerk met een Telegram-melding aan Arno. Interne testaccounts krijgen nooit tegoed.
5. **Opzeggen:** het tegoed blijft staan, zonder vervaldatum (zoals artikel 5 al zegt).
6. **"Tweede licentie" in artikel 5 van de spelregels vervalt**, want het is niet te automatiseren.

## Wat er nodig is, per fase

**Fase 0, vooronderzoek.** Schema van `arnobot_referrals` en `referral_credit` in Supabase uitlezen en vastleggen in `docs/sql`. Mollie-terugbetalingskosten vaststellen. Besluit nemen over de bedragsbasis: particuliere bedragen zijn bruto inclusief btw (`lib/billing/prijzen.ts`), zakelijke en Team-bedragen netto plus 21% (`lib/billing/teamFacturatie.ts` rekent altijd exclusief btw). Het plafond van een team-manager mag nooit naast een bruto solo-bedrag worden gelegd. Voorstel: het tegoed wordt vastgelegd in centen, met de btw-grondslag van de referrer (particulier bruto, zakelijk netto) in dezelfde regel.

**Fase 1, grootboek en toekenning.**
- Nieuwe tabel, bijvoorbeeld `arnobot_referral_tegoed`, met onveranderlijke regels (toegekend, verrekend, teruggedraaid), unieke sleutel per referral voor de toekenning, en het saldo afgeleid uit de regels. Het bestaande `referral_credit` wordt als beginstand ingelezen en daarna niet meer met de hand beheerd (anders schrijft de cron over Arno's handmatige waarden heen). Saldo en regel in één databasefunctie (transactie), niet twee losse schrijfacties.
- Conversie betrouwbaar maken: `zetReferralConversie` (`lib/billing/verwerking.ts`) kent alleen `premium`, de admin-route ook `team`. `verwerkTeamBetaling` (`lib/billing/teamFacturatie.ts`) roept nooit een conversie aan en schrijft niets naar `arnobot_payments`, dus een geworven team wordt nu alleen "betalend" als Arno op BETAALD klikt. De conversie is een eerste-betaling-markering en dus niet dezelfde als "drempel gehaald": de drempel krijgt een eigen markering in het grootboek zodat de tellers (`app/api/bot/referral/route.ts`, `app/bot/admin/gebruikers/page.tsx`, `app/bot/admin/stats/page.tsx`) niet breken.
- Dagelijkse cron (met `registreerCronRun` en `notifyCronFailure`): telt alleen betalingen met status `paid`, `terugbetaald_cent = 0`, `teruggeboekt_cent = 0` en `terugbetaling_verwerkt_at` leeg. Maand: drie voltooide betaalmaanden (betaald is niet hetzelfde als verstreken: een eerste betaling tijdens de trial start de periode pas na het trialeinde, `eerstePeriodeStart`). Jaar: eerste betaling plus 14 dagen. Team: betaalde `arnobot_team_facturen` (maandelijks drie, jaarlijks de eerste). Een team telt als één referral.
- Bedrag: de prijs van wat de geworven klant afsluit, met plafond de eigen maandprijs van de referrer.
- Mail naar de aanbrenger, Telegram-melding aan Arno bij 25, 50 en 100 betalende referrals.

**Fase 2, terugdraaien.** Er is nu nergens een pad: `verwerkVolledigeTerugbetaling` (`lib/billing/verwerking.ts`) heeft geen referral-haak, ook niet bij herroeping of chargeback (SEPA tot 8 weken, kaart langer). Bij een volledige terugbetaling of chargeback van de geworven klant wordt onverrekend tegoed teruggedraaid. Is het al verrekend, dan een negatieve regel die met het volgende tegoed wordt verrekend, plus een melding aan Arno.

**Fase 3, team-managers.** `maakTeamFactuur` rekent uit dezelfde `brutoCent` de Mollie-betaallink en de Moneybird-factuur. Het tegoed moet als aparte kortingsregel op de factuur (de factuurbouwer `bouwFactuurBody` in `lib/billing/moneybird.ts` kent nu één regel en moet een negatieve regel kunnen) en `nettoCent`, `btwCent` en `arnobot_team_facturen.bedrag_cent` moeten samen consistent verlaagd worden, anders wijst de controle in `verwerkTeamBetaling` (afwijkend bedrag) de betaling af. Is het tegoed groter dan de factuur, dan blijft de rest staan voor de volgende factuur; een factuur van 0 euro wordt niet gemaakt maar het tegoed wordt dan niet verrekend tot de eerstvolgende factuur met een bedrag.

**Fase 4, individuele gebruikers.** Na een betaalde verlenging (`rondBetalingAf`, soort `verlenging` of `herhaling`) een gedeeltelijke terugbetaling met `betaalTerug` (`lib/billing/mollie.ts`) van ten hoogste het beschikbare tegoed en ten hoogste het betaalde bedrag, met een stabiele idempotency-key per betaling. Daarna in Moneybird een creditnota op dezelfde factuur (nieuwe functie; de factuur zelf blijft het volle bedrag, de omzet klopt). Gedeeltelijke terugbetaling mag het abonnement niet beëindigen: de cron behandelt alleen een volledige terugbetaling als einde, dat moet getest worden. Een gebruiker ziet eerst de volle afschrijving en na enkele dagen de terugbetaling; de mail zegt dat vooraf.

**Fase 5, bewaking.** Beheeroverzicht van het grootboek, Telegram bij elke fout (zoals `notifyTelegram` elders), testaccountfilters (`scripts/check-testaccount-filter.mjs`, `check-missing-user-filter.mjs`), unit tests, en één proef in Mollie-testmodus (met `MONEYBIRD_OOK_IN_TESTMODUS` niet aan, zodat er geen nepfactuur in de echte administratie komt; zie de factuurles in `docs/OVERSTAP_PLAN.md`).

**Fase 6, copy en docs.** Spelregels versie 1.6 (artikel 4: 14 dagen bedenktijd bij een jaarabonnement; artikel 5: "tweede licentie" weg, uitleg dat de verrekening een terugbetaling op je betaalmiddel is of een korting op je teamfactuur), `lib/appHelp.ts`, `lib/email-templates.ts`, de plekken die nu "handwerk" zeggen (`lib/billing/teamlidSolo.ts`, `lib/billing/overstap.ts`, `app/api/team-aanvraag/route.ts`), `docs/ABONNEMENTEN.md`, `docs/ARNOBOT_OVERZICHT.md` en de PDF's (`npm run docs:pdf`). Alle teksten eerst als platte tekst aan Arno.

## Risico's uit de review die in het ontwerp zijn opgevangen

- Geen verlaagd bedrag naast `bedrag_cent`: de flows `overstap.ts`, `intrekken.ts`, `klanttypeCorrectie.ts`, `teamlidSolo.ts` en `soloNaarTeam.ts` blijven het volle bedrag als bron gebruiken, omdat er bij de gekozen route nooit een tijdelijk verlaagd abonnementsbedrag bestaat.
- De koppelingscheck (`lib/billing/gezondheid.ts`) vergelijkt geen abonnementsbedrag; dat is bij deze route ook niet nodig.
- Idempotentie: unieke sleutel per referral, stabiele idempotency-key per terugbetaling, saldo en regel in één transactie.
- Open randgevallen die bewust handwerk blijven: handmatig BETAALD-account, referrer die opzegt met onverrekend tegoed (blijft staan).

## Waar dit plan op steunt

- Mollie "Update subscription" (docs.mollie.com/reference/update-subscription, geraadpleegd 2026-11-16): `amount` geldt voor toekomstige betalingen; de pagina noemt geen restrictie op `startDate` en zegt niet vanaf welke betaling een nieuw bedrag geldt. Reden om die route niet te nemen.
- Mollie-terugbetalingskosten: niet vastgesteld (zie onverifieerd).

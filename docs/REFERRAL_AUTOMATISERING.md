# Referral-tegoed volledig automatiseren: plan en voortgang

## Statusblok

- **Laatst bijgewerkt:** 2026-11-25
- **Waar we staan:** bouw loopt. De regels van 25-11 zijn goedgekeurd, het plan is door een onafhankelijke controle gegaan (zie "Controle 25-11"). Automatisch toekennen en verrekenen werkt nog niet. In de database stond op 25-11 een referral (status signed_up) en geen gebruiker met tegoed boven nul.
- **Gebouwd op 25-11:** (1) oude koppelroute verwijderd (B5, deels); (2) B1 en B2: lib/billing/terugbetaling.ts bepaalt op een plek wat volledig terugbetaald is, verrekend tegoed beeindigt nooit een abonnement, admin-terugbetaling en herroeping storten alleen het restant, creditnota is dan handwerk met melding; (3) de regels als rekenlaag met tests, lib/billing/referralRegels.ts (verplaatst geen geld); (4) docs/sql/2026-11-25-referral-fundament.sql, door Arno uitgevoerd en bevestigd (6 kolommen en 1 index); (5) B4: elke eerste en herhaalbetaling legt plan, cyclus, klanttype en periode vast in arnobot_payments. Betalingen van voor 25-11 hebben die niet (alleen een eerste betaling van een aanbrenger, geen van een aangebrachte klant).
- **Eerstvolgende stap:** B3: terugbetalingen en terugboekingen van teamfacturen vastleggen, plus een handmatige actie "betaald per bank" en "teruggedraaid" in admin (SQL nodig). Daarna grootboek met kwalificatie en vervallen, eerst meelopend zonder gevolgen, met overzicht en Telegram-meldingen.
- **Los traject, open:** of de nieuw aangebrachte gebruiker zelf iets krijgt, en onder welke voorwaarden. Arno bespreekt dit apart; tot dan blijven de teksten daarover ongewijzigd. Let op: de beloofde gratis eerste maand zit niet in de betaalcode. Dit moet besloten zijn voordat de eerste aangebrachte gebruiker betaalt (proef loopt tot ongeveer 24-12-2026).
- **Nog onverifieerd:** (a) of een Mollie-terugbetaling zelf geld kost en of de transactiekosten terugkomen. Op 25-11 gelezen: de prijspagina (mollie.com/nl/pricing) toont geen terugbetaalregel, help.mollie.com weigert automatisch lezen (403), één externe bron noemt €0,25 per terugbetaling zonder teruggave, andere bronnen noemen geen kosten. Arno kan dit zien in het Mollie-dashboard of navragen bij Mollie. Het ontwerp hangt er niet van af. Wel bevestigd (docs.mollie.com/docs/refunds): gedeeltelijke terugbetalingen worden ondersteund; een terugbetaling gaat van het beschikbare saldo en wordt in de wachtrij gezet als dat te laag is; een tweede terugbetaling van hetzelfde bedrag op dezelfde betaling binnen een uur wordt geweigerd. (b) of een gedeeltelijke terugbetaling in de bestaande code goed doorloopt; (c) de Moneybird-creditnota via de API voor een deelbedrag.

## Afvinklijst

- [x] Fase 0 (25-11): schema nagelezen, bedragsbasis vastgelegd; Mollie-terugbetalingskosten niet vast te stellen uit openbare bronnen (zie onverifieerd)
- [ ] Fase 1: grootboek, betrouwbare conversie (ook Team), verdien-cron, mijlpaalmelding, mails
- [ ] Fase 2: terugdraaien bij herroeping, terugbetaling en chargeback
- [ ] Fase 3: verrekenen voor team-managers (kortingsregel op de factuur)
- [ ] Fase 4: verrekenen voor individuele gebruikers (gedeeltelijke terugbetaling plus creditnota)
- [ ] Fase 5: bewaking, beheeroverzicht, tests, proef in testmodus
- [ ] Fase 6: copy en docs (spelregels 1.6, `lib/appHelp.ts`, mails, `docs/ABONNEMENTEN.md`, `docs/ARNOBOT_OVERZICHT.md`, PDF's)

## Uitgangspunt

De spelregels (`app/referrals/page.tsx`, `docs/ABONNEMENTEN.md`) zijn gegeven: eenmalig tegoed als de geworven gebruiker Pro of Team kiest, plafond is de eigen maandprijs van de referrer (voor een manager de totale teamprijs), alleen verrekening op een verlenging, geen uitbetaling, geen vervaldatum. Het tegoed is nu handwerk: `referral_credit` op `approved_users` wordt nergens in de code opgehoogd, alleen uitgelezen. Geen Mollie- of Moneybird-gedrag is aangenomen zonder het in code of in de docs te zien; wat niet is gezien staat hierboven als onverifieerd.

## Regels per 25-11 (Arno), deze gaan vóór oudere tekst in dit document en in de spelregels

| Aangebrachte klant | Tegoed voor de aanbrenger | Moment |
|---|---|---|
| niets, of Basic per maand | geen | niet |
| Basic per jaar (nieuw: telt mee) | ja | particulier na de 14 dagen bedenktijd, zakelijk direct na betaling |
| Pro of Team per maand | ja | na 3 aaneengesloten betaalmaanden |
| Pro of Team per jaar | ja | particulier na de 14 dagen bedenktijd, zakelijk direct na betaling |

- **Hoogte:** eenmalig, het laagste van twee maandprijzen: die van het afgesloten abonnement van de klant en die van de aanbrenger zelf. Manager van een team: plafond is de totale maandprijs van het eigen team. Berekend op de getoonde prijzen (Basic 19 per jaar-abonnement of 29 per maand, Pro 39 of 59); de btw-basis is die van de aanbrenger (particulier inclusief, zakelijk exclusief, zie lib/billing/prijzen.ts).
- **Termijn:** afsluiten tijdens de proef of uiterlijk 15 dagen daarna; teamproef: 10 dagen na de proef. Een team telt als één referral.
- **Stoppen is tegoed kwijt:** het tegoed vervalt zodra het abonnement van de aanbrenger echt is afgelopen (ook een niet verlengd jaarabonnement). Niet bij een lopende periode na opzegging, niet bij een ingetrokken opzegging, niet bij een overstap, upgrade of solo naar Team. Haalt een klant de drempel pas na dat einde, dan ontstaat geen tegoed. Wie later terugkomt krijgt niets terug. Vervangt besluit 5 van 16-11 (tegoed blijft staan). Verworpen: tegoed bewaren voor terugkeerders.
- **Tweede licentie** vervalt.
- **Bij de opzegging** (vooraf en in de bevestiging) wordt gemeld dat het tegoed vervalt.

## Akkoord Arno 25-11 op de open regelvragen

1. Drie maanden: betaald en verstreken, aaneengesloten; onderbreking tot 14 dagen mag, daarna opnieuw tellen.
2. Op tijd afsluiten: de eerste betaling valt binnen de proef plus 15 dagen (teamproef 10). Later overstappen vanaf Basic per maand telt alsnog.
3. Het abonnement op het moment van toekennen bepaalt of en hoeveel; per maand tellen alleen maanden die zelf tegoed opleveren.
4. Bedrag ligt vast bij toekennen; heeft de aanbrenger nog geen abonnement, dan bij de eerste verrekening. Geen abonnement binnen de termijn: vervalt.
5. "Echt afgelopen": 14 dagen na het einde zonder nieuw abonnement.
6. Om wanbetaling geblokkeerd team: tegoed staat stil, vervalt na 30 dagen. Gewoon teamlid geworden: vervalt.
7. **Alles exclusief btw:** het laagste van beide maandprijzen zonder btw; bij uitkeren komt de btw erbij (particulier en zakelijk). Zo geeft ArnoBot nooit meer weg dan een maand netto van beide kanten. Vervangt de eerdere tekst over getoonde prijzen en de btw-basis van de aanbrenger.
8. Per verlenging zoveel als in de betaling past, de rest blijft staan.
9. Klant is een team: aantal gebruikers op het moment van toekennen.

**Aanvullingen 25-11:**
- Het plafond en het abonnement komen uit arnobot_subscriptions (wat er betaald wordt), nooit uit approved_users.plan. Een account kan cadeau op Pro staan terwijl Basic betaald wordt. Zo'n cadeau valt bij de volgende betalingsverwerking terug naar het betaalde plan (zetToegang); nog niet geregeld.
- Geen maximum op het aantal tegoeden (nog te bevestigen door Arno). Tegoed is eenmalig per aangebrachte klant.

## Controle 25-11 (onafhankelijke reviewer): niet bouwen zoals de fasen hieronder staan

De fasen verderop zijn op deze punten achterhaald; deze sectie gaat voor. B1 en B5 zijn daarna zelf in de code nagekeken en kloppen. De overige punten zijn bevindingen van de reviewer, nog niet allemaal zelf nagelopen.

**Blokkades**
- B1: een terugbetaling van tegoed die even hoog is als de betaling telt als volledige terugbetaling (lib/billing/verwerking.ts:151, app/api/cron/billing/route.ts:78): abonnement stopt en toegang eindigt. Oplossing: tegoedbedrag per betaling apart vastleggen en uitsluiten van "volledig".
- B2: na een gedeeltelijke terugbetaling lopen admin-terugbetaling, herroeping en creditnota's fout (ze vragen het volle bedrag of slaan de betaling over). Alleen het restant terugbetalen en crediteren.
- B3: terugboekingen en terugbetalingen van teamfacturen worden niet vastgelegd; bankoverschrijvingen worden niet op betaald gezet.
- B4: betaalde maanden zijn niet betrouwbaar af te leiden: arnobot_payments mist plan, cyclus en periode. Momentopname per betaling toevoegen, alleen bij een echt verlengde periode.
- B5: de oude route POST /api/bot/referral liet elk bestaand account achteraf een code koppelen. **Verwijderd op 25-11.** Nog nodig: unieke sleutel op referred_user_id en wederzijdse verwijzingen weigeren.

**Ernstig (kort):** dubbele of verloren verrekening (reserveren in een databasefunctie met slot per aanbrenger, aparte cron); wachttijd na SEPA; een particuliere jaarverlenging komt binnen als "herhaling" of als nieuwe "eerste"; "echt afgelopen" vraagt een controle op accountniveau met respijt; teamkorting reserveren per factuur; conversie van Team wordt online niet vastgelegd en "converted" mag nooit de drempel zijn; eigen tegoed-terugbetaling mag iemand niet als aangebrachte klant diskwalificeren; omzetrapportage en creditnota's aanpassen.

**Datamodel (minimaal):** referrals: unieke referred_user_id, checkout_deadline, first_checkout_at, qualified_at, rejected_reason. payments: plan, cyclus, klant_type, period_start, period_end, referral_refund_cent. team_facturen: reversed_at, paid_via, referral_discount_cent, unieke periode voor reguliere facturen. Nieuw: arnobot_referral_ledger (alleen toevoegen, unieke event_key, een toekenning per referral), arnobot_referral_redemptions, arnobot_referrer_state. Alle geldmutaties via een databasefunctie met slot per aanbrenger.

**Bouwvolgorde:** besluiten, schema en B5, B1 en B2 met tests, periodemomentopnames en teambetalingen, grootboek met kwalificatie en vervallen eerst meelopend zonder gevolgen, terugdraaien, teamkorting, solo-terugbetaling met creditnota en proef in testmodus, overzicht, meldingen en teksten.

## Besluiten (Arno, 2026-11-16), nog geldig waar de regels van 25-11 niets anders zeggen

1. **Volledig automatiseren**, niet halfautomatisch met een knop.
2. **Verrekenen bij individuen via een gedeeltelijke terugbetaling van de verlengingsbetaling plus een creditnota in Moneybird. Bij team-managers via een kortingsregel op de factuur** op het moment dat onze eigen cron de factuur maakt. **Verworpen: het Mollie-abonnement verlagen** (PATCH van het bedrag voor toekomstige betalingen), want: Mollie accepteert geen bedrag van 0, een jaarlijks particulier abonnement heeft helemaal geen Mollie-abonnement (een jaar is één betaling), de code heeft geen PATCH en geen plek om het bedrag na de betaling terug te zetten, de cron draait om 05:00 UTC terwijl Mollie op de incassodatum incasseert (geen betrouwbaar venster), SEPA blijft dagen `pending`, een gemiste webhook laat de klant structureel te weinig betalen, en overstap, upgrade, intrekken en opzeggen maken abonnementen opnieuw met het volle bedrag. **Verworpen: gratis maanden via de einddatum**, want dat botst met de automatische incasso (dubbele afschrijving).
3. **Referrer zonder betalend abonnement** (trial of handmatig BETAALD): het tegoed wacht tot zijn eerste verlenging. Een handmatig account (BETAALD-vlag, geen `arnobot_subscriptions`-rij en geen Mollie-abonnement) blijft handwerk met een Telegram-melding aan Arno. Interne testaccounts krijgen nooit tegoed.

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

**Fase 6, copy en docs.** Spelregels versie 1.6 volgens de regels van 25-11 (tegoed vervalt bij einde abonnement, Basic per jaar telt mee; artikel 4: particulier per jaar na 14 dagen, zakelijk direct; artikel 5: "tweede licentie" weg, uitleg dat de verrekening een terugbetaling op je betaalmiddel is of een korting op je teamfactuur), `lib/appHelp.ts`, `lib/email-templates.ts`, de plekken die nu "handwerk" zeggen (`lib/billing/teamlidSolo.ts`, `lib/billing/overstap.ts`, `app/api/team-aanvraag/route.ts`), `docs/ABONNEMENTEN.md`, `docs/ARNOBOT_OVERZICHT.md` en de PDF's (`npm run docs:pdf`). Alle teksten eerst als platte tekst aan Arno.

## Risico's uit de review die in het ontwerp zijn opgevangen

- Geen verlaagd bedrag naast `bedrag_cent`: de flows `overstap.ts`, `intrekken.ts`, `klanttypeCorrectie.ts`, `teamlidSolo.ts` en `soloNaarTeam.ts` blijven het volle bedrag als bron gebruiken, omdat er bij de gekozen route nooit een tijdelijk verlaagd abonnementsbedrag bestaat.
- De koppelingscheck (`lib/billing/gezondheid.ts`) vergelijkt geen abonnementsbedrag; dat is bij deze route ook niet nodig.
- Idempotentie: unieke sleutel per referral, stabiele idempotency-key per terugbetaling, saldo en regel in één transactie.
- Open randgevallen die bewust handwerk blijven: handmatig BETAALD-account, referrer die opzegt met onverrekend tegoed (blijft staan).

## Waar dit plan op steunt

- Mollie "Update subscription" (docs.mollie.com/reference/update-subscription, geraadpleegd 2026-11-16): `amount` geldt voor toekomstige betalingen; de pagina noemt geen restrictie op `startDate` en zegt niet vanaf welke betaling een nieuw bedrag geldt. Reden om die route niet te nemen.
- Mollie-terugbetalingskosten: niet vastgesteld (zie onverifieerd).

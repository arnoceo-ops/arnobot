# Prijswijziging Pro en Team

## Status

- **Laatst bijgewerkt:** 2026-11-27
- **Waar we staan:** LIVE sinds 2026-11-27 (commit edbad599, gepusht om 07:58 UTC op uitdrukkelijk akkoord van Arno). Vlak vóór de push gemeten: alleen het Basic-abonnement van €228, geen Pro tegen de oude prijs, geen gefactureerd team. Na de uitrol op arno.bot nagekeken: /prijzen (jaarstand €19, €33, €77, teamregel), /team, /team/aanvragen en /voorwaarden (versie 3.2); het klantabonnement staat nog op 22800.
- **Afrekenscherm gecontroleerd (Arno, 2026-11-27, via `/bot/doorgaan?preview=idle`):** pakketkaarten jaarlijks en maandelijks kloppen; totalen particulier per maand €49,00 en zakelijk €59,29 en €479,16 gezien. Particulier per jaar is alleen op de kaart gezien (€396), niet als totaal. Jaarkorting via referral (€363,00) toont dit voorbeeld niet.
- **Eerstvolgende stap:** de resterende controles na livegang (manager plus 3 is €244 en €2.112; Abacus), morgenochtend geen meldingen van bedragcontrole, referral-uitvoeren en team-facturatie, en bij de eerste echte Pro-betaling Mollie en Moneybird nakijken. Daarna "Bekende restpunten"; restpunt (a), de betalende klant, is besloten en staat gepland voor 27 september 2027. Terugdraaien is niet veilig zodra er na 27-11 een team is geactiveerd.

### Afvinklijst

- [ ] Fase 0: besluiten en voorbereiding (besluiten klaar; ElevenLabs open)
- [x] Fase 1: rekenlogica Team
- [x] Fase 2: prijsconstanten
- [x] Fase 3: zichtbare teksten en voorwaarden
- [x] Fase 4: interne tools
- [x] Fase 5: tests
- [x] Fase 6: documenten
- [ ] Fase 7: uitrol en controle

## Uitgangspunt

- Tarieven en teamregels staan in `docs/PRICING_DECISIONS.md`: Pro €49 per maand of €396 per jaar; manager €97 of €924, inclusief eigen Pro; teamlid €49 of €396; manager plus minimaal 3 teamleden; kleiner via team@arno.bot (adres ontvangt mail, bevestigd door Arno). Basic blijft €29 of €228.
- Volgens Arno hoeft er niets te gebeuren met bestaande klanten. Dat is in de database nagekeken (zie hieronder) en **klopt op 2026-11-26**.
- De regelnummers komen uit een zoekronde door twee agents zonder voorkennis. De zwaarste punten zijn daarna nagelezen, niet elke regel. Bij de bouw per bestand opnieuw controleren.

## Stand in de productiedatabase (2026-11-26, alleen gelezen)

| Onderdeel | Gevonden | Gevolg |
|---|---|---|
| Abonnementen (pending, actief, opgezegd) | 1: Basic, jaar, particulier, €228, zonder Mollie-incasso | Basic wijzigt niet, dus geen effect. Bij `approved_users` staat deze klant op `premium`; dat past bij de aparte afspraak |
| Teams | 1, beheerd door een testaccount, `min_seats` leeg | Geen enkel team wordt gefactureerd. **Geen datamigratie nodig** |
| Teamfacturen | 5, allemaal van dat testteam | Niets doen |
| Openstaande betalingen | 2, allebei testaccount | Niets doen |
| Handmatig op betaald of teambaas | Naast testaccounts en de betalende klant 2 accounts zonder abonnement, waarvan 1 teambaas | Worden niet door de abonnementsincasso geraakt. Trackrecord in Abacus kan ze meetellen tegen de nieuwe prijs |
| Teamaanvragen | 2 van 2026-07-24 (7 en 12 gebruikers, status nieuw) | Aantallen zijn inclusief manager en tegen de oude prijs. Niet overnemen als aantal teamleden |

Mollie, Moneybird en Vercel zijn niet bekeken.

**Vlak voor de uitrol opnieuw meten.** Sluit iemand vóór de uitrol Pro af voor €59 of €468, dan gelden de risico's onder "Oude bedragen" wel.

## Bijwerking 27-11 (gaat voor op de regelnummers hieronder)

**Database opnieuw gemeten (27-11, alleen gelezen):** 1 lopend abonnement (Basic, jaar, €228); geen betaling of upgrade op de oude Pro-prijs; geen gefactureerd team; open betalingen alleen van testaccounts; referralgrootboek en klanttypecorrecties leeg; 1 referral (aanmelding zonder betaling, aangebracht door de betalende klant). **Geen datamigratie en geen nieuwe SQL nodig.**

**Referrals staan live** (volgens `docs/REFERRAL_AUTOMATISERING.md`; Vercel niet nagekeken). Nieuw of verschoven:

| Plek | Wat | Fase |
|---|---|---|
| `lib/billing/referralGrootboek.ts:203, 350, 415` | Teamwaarde = huidige formule maal huidige telling. Met alleen nieuwe bedragen: tegoed tot €49 netto te hoog, automatisch teruggestort. Klein team: waarde 0 en dagelijks een fout. Lost op met `huidigSeats` zonder manager (in de functie zelf) en een formule vanaf 1 teamlid | 1 |
| `lib/billing/referralKorting.ts:21-22` | Fee herkennen door te vergelijken met het eigen abonnementsbedrag (zelfde plan en cyclus), niet met de prijslijst | 2 |
| `lib/billing/referralGrootboek.ts:232-253` | Zelfde voor de maandwaarde van een jaarbetaling met fee; terugval op de prijslijst na een upgrade is bij vandaag geen getroffen klant | 2 |
| `app/voorwaarden/page.tsx` artikel 4 | Twee teamalinea's: `f2` en de nieuwe `e2`. Prijswijzigingsalinea `g` is nog de oude | 3 |
| `lib/email-templates.ts:426-428` | "gebruiker" wordt "teamlid" (niet regel 384) | 3 |
| `lib/teamActivatie.ts` en `lib/billing/soloNaarTeam.ts` | "Seats" en "gebruikers" in Telegram en adminlog | 1 |
| `app/admin/teams` route (`:74`) | Minimum controleren (min. teamleden vanaf 1) | 1 |
| Nieuwe referraltests die `huidigSeats` nadoen | Meenemen | 5 |

**Verschoven regels:** `team-aanvraag/route.ts` :54-65, :125, :139; `teamActivatie.ts` :29, :63-100, :150-225; `soloNaarTeam.ts` :141-157, :241; `MAX_LEDEN` in `join/route.ts:12`; `kostenTarieven.ts` `prijsPremiumEur` :208, `SCENARIO_PRIJZEN` :621, team :638-641, standaard teamscenario :642, teamomzet :684-687; `QAClient.tsx:98`.

**"Oude bedragen" hieronder is deels achterhaald:** de zakelijk-correctie rekent nu met het eigen bedrag en past het Mollie-abonnement aan. "Meeloopstand" geldt niet meer.

**Bij een prijsverlaging het verschil terugbetalen (besluit 2): niet via een gedeeltelijke Mollie-terugbetaling en nooit via de refundknop in de admin.** De live referralcode ziet de eerste als "andere terugbetaling" (de betaling telt dan niet meer mee) en de knop beëindigt het abonnement. Werkwijze: per bank overmaken, creditnota in Moneybird, inboeken met de databasefunctie `referral_handmatig_betaling` (volgens de controle door de agent; niet beproefd).

## Fase 0: besluiten en voorbereiding

- [x] Besluiten (2026-11-26).
- [x] Zelf omzetten naar zakelijk (N5) is door een andere sessie gebouwd en de SQL is uitgevoerd (`docs/REFERRAL_CONTROLE_2026-11-26.md`). Open daar: de stand van `KLANTTYPE_OPEN`. Geen onderdeel van deze wijziging.
- [ ] ElevenLabs controleren (zie onderaan).

## Fase 1: rekenlogica Team (eerst, anders wordt verkeerd gefactureerd)

Alleen bedragen aanpassen is fout: de manager betaalt dan €97 plus €49, en een team onder het minimum wordt €0.

| Bestand | Wat |
|---|---|
| `lib/teamPricing.ts:38-49` | Prijsformule loskoppelen van het aanmeldminimum: elk aantal teamleden vanaf 1 geeft een echt bedrag |
| `lib/billing/teamFacturatie.ts:84-91` (`huidigSeats`) | Manager niet tellen. Filteren op `user_id` ongelijk aan `manager_id`, niet "aantal min 1" en niet op rol (het testteam heeft 2 managerrijen; alleen de eigenaar zit in de €97) |
| `lib/billing/teamFacturatie.ts:99-121` | `?? 0` vervangen door een harde fout. De database weigert een bedrag van 0, waardoor een factuur elke dag opnieuw mislukt |
| `app/api/cron/team-facturatie/route.ts:77-108` | `min_seats ?? 3` en de vergelijking met `seats_aantal` in de nieuwe betekenis |
| `lib/teamActivatie.ts:28, 76-91, 175-201` | Minimum 3 teamleden; ledental zonder manager; meldingen en log |
| `app/api/bot/team/activeren/route.ts:29` | Minimum voor zelf activeren |
| `app/api/team-aanvraag/route.ts:51-86` | Minimum, Elite-maximum, opgeslagen aantal |
| `app/api/admin/teams/route.ts:62`, `lib/billing/soloNaarTeam.ts:99-141` | Blijft vanaf 1 (uitzonderingsroute), betekenis wordt teamleden. Nu zou solo naar Team onder 3 de solo-incasso stoppen en €0 rekenen |
| `app/bot/admin/teams/page.tsx:49-104` | Eigen ledentelling zonder manager; uitlegtekst |
| `lib/mrr.ts:49-66`, `app/bot/admin/stats/page.tsx:170-190` | Ledentelling zonder manager, anders MRR te hoog |
| `lib/billing/referralGrootboek.ts:120-181` | Volgt de nieuwe telling; klein team mag niet €0 worden |
| `app/api/bot/team/join/route.ts` | `MAX_LEDEN = 25` telt de manager mee: besluiten of dat zo blijft |

`min_seats` en `seats_aantal` betekenen daarna "teamleden zonder manager". Gekozen: geen nieuwe kolom, omdat geen enkel team gefactureerd wordt. Verworpen: nieuwe kolom naast de oude (het advies van de agent vóór de databasemeting). Lege `min_seats` moet leeg blijven, anders verandert een gratis agentproef.

## Fase 2: prijsconstanten (drie losse bronnen)

| Bestand | Nu | Wordt |
|---|---|---|
| `lib/kostenTarieven.ts:203` `prijsPremiumEur` | 59 | 49 |
| `lib/kostenTarieven.ts:604` Pro | 59 / 468 | 49 / 396. Voedt checkout en Mollie |
| `lib/kostenTarieven.ts:621-624` Team | 97 / 924, 49 / 468 | 97 / 924, 49 / 396 |
| `lib/teamPricing.ts:25` teamlid jaar | 39 | 33. Voedt teamfacturen |
| `lib/teamPricing.ts:26` minimum | 3 inclusief manager | 3 teamleden, naam verduidelijken |
| `lib/teamPricing.ts:36` Elite-toeslag | 338 | Zie besluit |
| `lib/gebruikerKosten.ts:13` | basis 19, premium 39, team 49 | premium 33; bedrag voor team besluiten |
| `app/agents/SdVerdienClient.tsx:6-14` | 39 per seat, €468, €276 per jaar, 23 per maand | 33, €396, ongeveer €262 per jaar, ongeveer 22. Dit verlaagt het rekenvoorbeeld voor sales development |
| Commentaar met bedragen | `teamPricing.ts`, `kostenTarieven.ts`, `teamFacturatie.ts`, `mrr.ts`, `maandOmzet.ts` | Bijwerken |

## Fase 3: zichtbare teksten en voorwaarden

| Plek | Wat |
|---|---|
| `app/bot/doorgaan/DoorgaanClient.tsx:443-448` | Pro staat hard in de tekst (39, 59, €468). Uit de constanten halen |
| `app/bot/qa/QAClient.tsx:97` | Pro 33 en 49 |
| `app/prijzen/PrijzenClient.tsx:182-200` | "per teamlid", manager inclusief eigen Pro, manager plus 3 teamleden, contacttekst met aanklikbaar team@arno.bot. Bedragen rekenen automatisch mee |
| `app/team/aanvragen/page.tsx:211-277` | Veld wordt "teamleden, exclusief jijzelf"; "~20% korting" klopt niet meer; vaste bedragen op regel 269 en 277; contacttekst onder het minimum; Elite-veld |
| `app/team/page.tsx:293-295` | "direct aanvragen" geldt niet onder 3 teamleden |
| `app/bot/upgrade/page.tsx:75` | "per gebruiker, vanaf 3 gebruikers" herschrijven |
| `app/bot/account/TeamActiverenSectie.tsx:63-187` | Voorgevuld aantal telt nu de manager mee; labels, `min={3}`, melding, contacttekst |
| `app/bot/admin/teams/TeamBillingForm.tsx:151-228` | "Min. teamleden (zonder manager)" |
| `lib/teamActivatie.ts`, `app/api/team-aanvraag/route.ts:53, 123, 137` | Foutmeldingen, mail en Telegram |
| `lib/email-templates.ts:384` | "gebruiker" wordt "teamlid" |
| `lib/appHelp.ts:44` | Uitleg in de systeemprompt; daarna de testsnapshot bijwerken. Geen bedragen toevoegen |
| `app/voorwaarden/page.tsx` artikel 4 | Teamalinea: "teamleden", manager inbegrepen, minimum. Prijswijzigingsalinea: de tekst onder "Besluiten" |

Ongewijzigd: "vanaf €19" (`app/prijzen/page.tsx`), referralpagina, privacy, `systemPrompt.ts`, `llms.txt`, Android-map.

## Fase 4: interne tools (Abacus)

- `lib/kostenTarieven.ts:446-447, 625, 667-670`: teamomzet zonder manager, kosten met manager. `# teamleden` wordt teamleden zonder manager en de standaard gaat van 5 naar 4.
- `app/abacus/BusinessCaseClient.tsx:101-102, 252-319, 374, 401`: labels, totalen, minimum van het veld.
- `app/abacus/KostenCalculatorClient.tsx:127-139, 378` en `app/abacus/VerloopKaart.tsx:34-35`: telling en tekst.
- Controle na de bouw: 250 solo users, 5 teams met 4 teamleden, geeft omzet €8.751. Bij koers 1,0949 en ongewijzigde kostenaannames is de winst €6.609.
- Opgeslagen maanden in Trackrecord niet herschrijven. De lopende maand rekent wel direct met de nieuwe prijs.

## Fase 5: tests

Verwacht rood (afgeleid uit de code, niet gedraaid): `lib/billing/billing.test.ts`, `overstapStatus.test.ts`, `referralKorting.test.ts`, `referralRegels.test.ts`, `lib/mrr.test.ts`, `lib/__snapshots__/systemPrompt.test.ts.snap`. Nalopen: de overige billing- en teamtests met 59, 468, 4900 of `min_seats: 3`.

Nieuw: manager wordt niet geteld; klein team krijgt een correcte factuur; zelf aanmelden onder 3 teamleden wordt geweigerd; manager plus 3 is €244 per maand en €2.112 per jaar.

## Fase 6: documenten

`PRICING_DECISIONS.md` (voorstel wordt geldend, oude besluiten niet herschrijven), `ABONNEMENTEN.md`, `ARNOBOT_OVERZICHT.md` (ook de jaarbesparing van Pro: €240 wordt €192), `BUSINESS_HANDOVER.md`, `TEAM_PROCES.md`, `TECHNICAL_HANDOVER.md`, `MOLLIE_PLAN.md` en `OVERSTAP_PLAN.md` (alleen een noot), `SOLO_JAAR_NAAR_TEAM.md`, `REFERRAL_AUTOMATISERING.md`. Daarna `npm run docs:pdf`. Niet aanpassen: `CLAUDE_HISTORY.md`, `docs/archief/`, testlogs, `AUDIT_FINDINGS.md`, SQL-bestanden.

## Fase 7: uitrol en controle

1. Database opnieuw meten (abonnementen, teams, open betalingen).
2. Eén deploy met fase 1 tot en met 5. De deploy is het schakelmoment; er is geen feature flag. **Niet pushen tussen 04:55 en 05:45 UTC** (billing-, team- en referralcrons, 05:00 tot 05:40).
3. Controleren dat de productie-alias op de nieuwe deploy staat.
4. `/prijzen`, `/bot/upgrade`, `/team/aanvragen`, afrekenscherm en Abacus nakijken.

**Terugdraaien is NIET veilig zodra na de deploy een team is geactiveerd.** De oude code telt de manager weer mee: de maandfactuur wordt €49 te hoog en een jaarteam krijgt een onterechte tussenfactuur. Eerst `min_seats` en `volgende_factuurdatum` van dat team leegmaken, of de nieuwe teamlogica behouden.

Controles na de deploy:

- De productie-alias wijst naar de nieuwe deploy.
- Afrekenscherm: Pro €49,00 per maand en €396,00 per jaar; zakelijk (incl. btw) €59,29 en €479,16; jaarabonnement met referralkorting (particulier) €363,00; Basic ongewijzigd.
- Team, manager plus 3 teamleden: €244 per maand en €2.112 per jaar.
- Het abonnement van de betalende klant staat nog op `bedrag_cent` 22800.
- De volgende ochtend geen meldingen van de bedragcontrole, `referral-uitvoeren` en `team-facturatie`.
- Eerste echte Pro-betaling: het totaal van de Mollie-betaling, het Mollie-abonnement en de Moneybird-factuur kloppen alle drie op de cent.

## Bekende restpunten

- **(a) Betalende klant, vóór de verlengdatum regelen.** De betalende klant staat in `approved_users` op `plan` `premium`, terwijl het abonnement `basis` is. Elke geslaagde abonnementsbetaling of mislukte upgrade schrijft het plan van het abonnement terug (`lib/billing/verwerking.ts`, `zetToegang` en het terugzetten van een upgrade). Bij verlenging zou deze klant dus naar Basic zakken: de herinneringsmails noemen Basic en de knop verlengen incasseert het opgeslagen Basic-bedrag.
  - **Besluit Arno (2026-11-27):** de klant houdt Pro tot het einde van de lopende periode. Het cadeau geldt alleen voor die periode. Bij verlenging geldt het gewone Pro-tarief van dat moment.
  - **Gekozen:** het abonnement vlak vóór het verlengvenster eenmalig met de hand op Pro zetten (`plan` `premium`, `bedrag_cent` volgens de prijslijst van dat moment en het klanttype van dat moment). Verlengen en mails gebruiken die twee velden. Het venster opent rond 7 oktober 2027 (45 dagen vóór het einde op 21 november 2027); herinnering op 27 september 2027.
  - **Verworpen:** nu een pakketwissel bij verlenging inbouwen (nieuwe betaalcode en databasewijziging voor één klant); het abonnement nu al op Pro zetten (de administratie toont dan een jaar Pro terwijl Basic is betaald, en de referralwaarde verandert meteen).
  - **Bij uitvoering:** eerst de code van verlengen, herinneringsmails en referralwaarde opnieuw nalezen (die rekent na de wijziging met Pro, ook over de lopende periode); alleen wijzigen na akkoord van Arno. Arno vertelt de klant vooraf het nieuwe bedrag: het verlengscherm noemt bij de knop geen bedrag.
- **(b) 1 cent, geaccepteerd.** Referraltegoed kan 1 cent boven €49,00 uitkomen als het tegen een grotere betaling wordt verrekend (`brutoVanNetto(4050)` is 4901). Op een eigen betaling van €49 is het begrensd op €49,00.
- **(c) Vóór een volgende prijswijziging oplossen.** Op enkele plekken wordt nog met de actuele prijslijst vergeleken of gerekend: `kiesVoordeel` in `lib/billing/referralPlanner.ts`, de terugval in `betaaldMaandCent` in `lib/billing/referralGrootboek.ts`, het voorbeeld van solo naar Team in `lib/billing/soloNaarTeam.ts` en het terugzetten van een upgrade. Nu zijn er geen gegevens die dit raakt.
- **(d) Teams boven 25 teamleden** kunnen niet joinen zonder codewijziging (`TEAM_MAX_TEAMLEDEN` in `lib/teamPricing.ts`), ook als Arno een hoger minimum instelt.
- **(e) ElevenLabs:** de controle van het tegoed (creditverbruik) staat nog open, zie "ElevenLabs".
- **Teamfacturen volgen altijd de huidige prijslijst** (`lib/teamPricing.ts`), ook de tussenfactuur bij een jaarteam. Een lopend teamcontract houdt dus niet zijn oude bedrag. Een latere verhoging zou bij de eerstvolgende factuur vanzelf ingaan, in strijd met de drie maanden aankondiging in artikel 4. Nu wordt geen team gefactureerd; oplossen vóór een volgende teamprijswijziging.
- **Terugbetaling op een teamfactuur** kan niet worden ingeboekt met `referral_handmatig_betaling` (die zoekt alleen in `arnobot_payments`).
- De kostengrenzen per Pro-gebruiker (`docs/DOCUMENTEN_PLAN.md`) zijn onderbouwd met Pro €39.

## Buiten de repo (niet gecontroleerd)

Mollie (lopende incasso's, open betaallinks), Moneybird (periodieke en handmatige facturen, sjablonen), Vercel (`OVERSTAP_OPEN`, `HERROEPING_OPEN`), Google Play-vermelding, LinkedIn, andere websites, agentmateriaal, cloudroutines, andere takken en worktrees, blogposts en kennisfragmenten in de database, afbeeldingen en bestaande PDF's en folders.

## Oude bedragen (nu geen getroffen klant)

Deze code rekent met de huidige prijslijst waar een opgeslagen bedrag had moeten staan. Zonder abonnement op €59 of €468 heeft het nu geen gevolg. Bij een volgende prijswijziging wel, ook voor Basic.

- `lib/billing/referralKorting.ts`: herkent een referral fee als "betaald is minder dan de huidige jaarprijs". Na een prijsverlaging wordt de fee niet meer herkend (nagelezen).
- `lib/billing/klanttypeCorrectie.ts`: verschil is huidige prijs min het oude bedrag (nagelezen).
- `lib/billing/referralGrootboek.ts` en `referralRegels.ts`: oude betalingen tegen de huidige prijs (agent). Meeloopstand, dus nu beweegt er geen geld.
- `lib/billing/overstapStatus.ts`, `soloNaarTeam.ts:128-139`, `mrr.ts:64`: weergave tegen de huidige prijs (agent).

**Los bestaand lek:** de zakelijk-correctie past `bedrag_cent` aan, maar niet het lopende Mollie-abonnement; Mollie zou het oude bedrag blijven incasseren (agent; in het bestand staat geen aanpassing van het Mollie-abonnement). Oplossen vóór of samen met het draaien van de SQL uit fase 0.

## ElevenLabs (bepaalt de kostensprong in Abacus)

- Eigen gebruik: 30 spraakaanroepen sinds juli, allemaal van testaccounts. Gemiddeld ongeveer 540 tekens (aanname in Abacus: 500). Over het aandeel spraakgebruikers en het aantal antwoorden zegt dit niets.
- Prijspagina (https://elevenlabs.io/pricing en https://elevenlabs.io/pricing/api, gelezen 2026-11-26): pakketten $99 (600k), $299 (1,8M), $990 (6M credits). Flash via de API kost 0,5 credit per teken. Losse credits zijn bij te kopen; het tarief stond er niet. De API-pagina noemt ook $0,04 per 1.000 tekens en andere aantallen tekens per pakket; die twee pagina's sluiten niet op elkaar aan. Er liep een Black Friday-actie tot 1 december.
- Abacus rekent met 1,0 credit per teken. Bij 0,5 ligt de sprong naar $990 bij ongeveer 241 gebruikers met Pro-niveau in plaats van 120. De winst bij 250 solo users en 40% Pro is dan €7.680 in plaats van €7.049.
- De API-sleutel van de app mag het abonnement niet uitlezen. **Controle door Arno:** in het ElevenLabs-account het huidige pakket bekijken, en bij het verbruik hoeveel credits tegenover hoeveel tekens staan. Pas daarna `creditPerTeken` in Abacus aanpassen.

## Besluiten

1. **Artikel 4, prijswijzigingsalinea (Arno akkoord, 2026-11-26):**

   > ArnoBot kan haar prijzen wijzigen. Gaat de prijs van je lopende abonnement omhoog, dan kondigen we dat minimaal drie maanden vooraf per e-mail aan, en hooguit één keer per jaar. Ga je niet akkoord, dan kun je binnen 30 dagen na de aankondiging opzeggen met ingang van de datum waarop de nieuwe prijs ingaat. Een prijsverlaging kunnen we op elk moment doorvoeren. Die geldt voor je lopende abonnement vanaf je eerstvolgende betaling.

   Verworpen: de oude tekst, die ook bij een verlaging drie maanden aankondiging en opzeggen noemt.
2. **Beleid bij prijsverlaging:** maandabonnement: lagere prijs vanaf de volgende betaling, niets terug. Jaarabonnement dat maximaal 30 dagen geleden is betaald: het verschil terug (coulance, bewust niet in de voorwaarden). Langer geleden: lagere prijs bij verlenging. Verworpen: oude prijs houden; nooit iets terugbetalen. Niet gebouwd: een lopend abonnement houdt in de code het opgeslagen bedrag (ook de knop verlengen en Mollie), dus voorlopig handwerk. Bij deze wijziging is er geen lopend Pro-abonnement.
3. **Elite-toeslag binnen Team blijft €338.** Verworpen: €348.
4. **Een klein team betaalt de gewone formule** (uitzondering op het minimum, niet op de prijs). Verworpen: een aparte prijs.
5. **Niet 14 dagen wachten voor livegang (besluit Arno):** de aankondigingstermijn uit artikel 11 is volgens Arno niet van toepassing.
6. **Spraakkostengrenzen** (`lib/maandKosten.ts`, `lib/voiceLimiet.ts`) nu niet wijzigen, bekijken na de ElevenLabs-controle.
7. **Grens op teamgrootte (keuze van de bouwsessie 27-11, aan Arno voorgelegd):** 25 teamleden naast de manager, voor uitnodigen en voor zelf activeren. Reden: zelf activeren stond tot 500 terwijl er maar 25 rijen konden aansluiten, dus een klant kon betalen voor leden zonder toegang. Een teamaanvraag via het formulier en de beheerpagina hebben geen grens. Verworpen: zelf activeren op 500 laten staan.

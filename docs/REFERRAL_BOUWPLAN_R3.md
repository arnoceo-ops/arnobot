# Referralautomatisering ronde 3: ontwerpcontrole en bouwplan

Ontwerp van een onafhankelijke agent op 26-11-2026, nog niet door de eigenaar beoordeeld; de besluiten onder D zijn voorstellen en geen besluiten.

Bij het onderzoek is alleen gelezen: geen aanroepen naar Mollie, Moneybird of de database, geen live tests, geen andere agents. Een andere sessie wijzigde tegelijk de code en committe tijdens het onderzoek e7f2af45; de wijzigingen in het grootboek zijn als diff gelezen. Regelnummers kunnen dus schuiven. Externe citaten kwamen via een samenvattende leestool; alleen de specificatie van Moneybird is letterlijk gedownload.

**Kern:** niet bouwen als haken in de betaalverwerking. Bouw één actietabel (outbox), een cron die uit de databasestand werkt, reserveren in een databasefunctie, en eerst alleen terugstorten. Overslaan van de incasso komt als laatste.

Al gebouwd: de melding bij opzeggen (`app/bot/account/page.tsx:471`, `lib/email-templates.ts:206`). Niet in de opdracht, wel beloofd en niet gebouwd: de gratis teammaand voor een aangebracht team (spelregels artikel 2). Die is meegenomen bij onderdeel 4.

## A. Foute of onbewezen aannames, op ernst

### A1. Overslaan zonder de eigen periode mee te schuiven

Het ontwerp beschrijft alleen Mollie. Blijft `periode_einde` staan, dan komt er geen betaling die hem verlengt. Na 3 dagen blokkeert `approved_users.expires_at` de toegang. Stap 5 van de billing-cron zet het abonnement op `ended` en stopt Mollie. De klant is dan toegang en abonnement kwijt.

### A2. `referral_refund_cent` moet vóór de terugbetaling vaststaan

Nu vult niets de kolom. Schrijf je hem erna, dan kan de webhook of cronstap 1b eerder zijn. Een volledige maand (gratis maand, hele maand tegoed, teamlid) telt dan als volledige terugbetaling: abonnement gestopt, toegang weg, volledige creditnota en verkeerde mail.

### A3. "Stabiele idempotency key per terugbetaling" beschermt maar kort

https://docs.mollie.com/reference/api-idempotency: "Keys older than 1 hour will be removed from our cache." Een cron die de volgende dag opnieuw probeert, kan dubbel terugstorten. De duplicaatweigering geldt ook maar een uur (https://docs.mollie.com/docs/refunds: "duplicate (of the same amount in the last hour)"). Bij een deelbedrag past een tweede terugbetaling gewoon.

### A4. "Eerst nieuw, dan oud stoppen" mist stoppaden en een slot

* `stopMollieAbonnement` kent alleen het huidige, het geplande en het correctie-abonnement. Breekt het overslaan af na het aanmaken, dan ziet opzeggen het nieuwe niet. De klant wordt na opzegging geïncasseerd, of dubbel.
* Opzeggen, overstappen, intrekken, solo naar Team, teamlid worden, verlengen en `beeindigAndereAbonnementen` nemen geen gedeeld slot. Alleen de klanttypecorrectie heeft er een. Opzeggen tijdens het overslaan geeft een verweesd abonnement.
* Uit de eigen proef (controledocument): twee actieve abonnementen met gelijke omschrijving geven 422, en dezelfde sleutel geeft een gestopt abonnement terug als `active`.
* `bedragControle` vindt zo'n verweesd abonnement pas achteraf en controleert geen incassodatum.

### A5. Een overgeslagen maand breekt "aaneengesloten"

Zonder betaalrij ontstaat een gat van 28 tot 31 dagen. `telMaanden` staat 14 toe en zet de reeks terug op 1. Is die klant zelf ook aanbrenger en slaat hij maanden over met tegoed, dan haalt zijn eigen aanbrenger de drempel later of nooit. Een gratis periode moet de reeks overbruggen zonder als betaalde maand te tellen. Hetzelfde geldt voor een teammaand zonder factuur.

### A6. Het grootboek kan niet verrekenen of terugdraaien

* `verval` boekt `-openstaand(...)`, het hele toekenningsbedrag, ook als er al verrekend is. Het saldo wordt negatief en eet later tegoed op.
* Een toekenning bewaart geen betaalkenmerken (id's). "Het bijbehorende tegoed" (spelregels artikel 5) is dus niet te bepalen.
* De controleregel (check) op `soort` staat geen verrekening of terugdraaiing toe.
* `nieuweMijlpalen` telt teruggedraaide toekenningen mee (bij 100 hoort Lifetime).

### A7. Een chargeback op een individuele betaling hangt alleen aan de webhook

Cronstap 1 haalt alleen open of onverwerkte betalingen op. Stap 1b kijkt alleen naar terugbetalingen (laatste 250). Alleen teamfacturen hebben een nacontrole. Een gemiste melding betekent dat het tegoed blijft staan en verrekend wordt. Is `terugbetaling_verwerkt_at` al gezet, dan wordt een latere chargeback bovendien niet opnieuw verwerkt.

### A8. Haken in `rondBetalingAf` kunnen stil verdwijnen

`verwerkt_at` wordt geclaimd vóór de verwerking. Breekt die af, dan probeert niets het opnieuw. Daar hangen nu de signalen. Alles met geld moet "wat hoort er te zijn" uit de database afleiden.

### A9. De livegangregel van het grootboek is onvolledig

Bewaard worden regels met "handmatig besluit: " plus de handwerkregel. Een handmatig verval of "behouden" op een automatische toekenning blijft dan staan zonder die toekenning. De echte run kent opnieuw toe met mogelijk een ander bedrag, of wijst af. Het saldo klopt dan niet. Daarnaast moet de volgorde van SQL en deploy vastliggen (zie B5).

### A10. Teams

* De oude tekst bij fase 3 (geen factuur van 0 euro, tegoed pas bij een factuur met bedrag) botst met de regel van 25-11 ("korting of geen factuur"). Het plafond is de eigen teammaandprijs. Bij een maandteam is elke factuur dan mogelijk 0, en het tegoed wordt nooit gebruikt.
* "Geen rij maken" kan niet veilig. De unieke index, de tussentijdse seatvergelijking en het grootboek (dekking en reeks) leunen op de rij. De SQL eist `bedrag_cent > 0`.
* Mislukt `maakTeamFactuur` na het opslaan, dan is de factuurdatum al doorgeschoven. Een korting zit dan vast op een factuur die nooit aankomt.

### A11. Jaarkorting

* "Overstappen" is niet de enige weg. Opzeggen en opnieuw afrekenen per jaar valt ook onder de belofte, maar `heeftRechtOpJaarkorting` geeft false zodra er betaald is.
* Overstappen staat achter `OVERSTAP_OPEN`. De waarde in productie is onbevestigd.
* De korting op de geplande betaling zelf geven kan niet: `verwerking.ts` weigert een afwijkend bedrag.
* "Eenmalig" leunt op `referred_discount`. Het kolomtype is onbekend; is het integer, dan mislukt 4,92 (wel met een melding in Sentry, maar het voordeel telt dan als ongebruikt). Er is geen databaseslot op "een voordeel per klant".

### A12. Deelcreditnota in Moneybird is niet bewezen

Specificatie (https://raw.githubusercontent.com/moneybird/openapi/main/openapi.yml), `duplicate_creditinvoice`, `detail_ids`: "The invoice lines to credit. When left out, all lines of the invoice are credited." Je kiest regels, geen bedrag. Er staan wijzigingen van `details_attributes` in de specificatie, maar niet bewezen voor een creditconcept. In wat gelezen is stond geen idempotentiesleutel (afwezigheid niet bewezen). `maakCreditnota` is niet hervatbaar: opnieuw draaien kan een tweede creditnota maken.

### A13. "Particuliere jaarverlenging: lager bedrag" raakt de verwerking

Een herhaalrij krijgt `btw_cent` van het abonnement, dus de volle btw bij een lager bedrag. `bedragControle` meldt een afwijking. Mislukt het herstel, dan blijft het lage bedrag staan. Terugstorten na de volle betaling is veiliger en mag volgens artikel 4.

### A14. SEPA en ouderdom

https://docs.mollie.com/docs/sepa-direct-debit (geparafraseerd): terugboeken binnen 8 weken, "within 13 months of payment" bij een incasso zonder machtiging, terugbetalen tot 365 dagen. Terugstorten aan een teamlid over oude betalingen kan dus mislukken. Direct na `paid` terugstorten vergroot de kans op dubbel verlies. Wat Mollie doet bij een chargeback na een deelterugbetaling is onbevestigd. https://docs.mollie.com/docs/chargebacks gaf 404.

### A15. Een ketenproef kan nu niet

Het grootboek (`uitgesloten`) en de billing-cron slaan testaccounts over. Er is een expliciete proefingang nodig (lijst van referralkenmerken, alleen met testsleutel).

### A16. PATCH op `startDate` is niet onderzocht

Alleen PATCH op het bedrag is verworpen. https://docs.mollie.com/reference/update-subscription noemt `startDate` ("The start date of the subscription in `YYYY-MM-DD` format.") en zegt "Canceled subscriptions cannot be updated." Werkt dit op een lopend abonnement, dan is overslaan één handeling, met hetzelfde id, zonder tweede of verweesd abonnement. Dan vervalt A4 grotendeels. Of `nextPaymentDate` dan meeschuift is onbevestigd. Eerst proeven.

## B. Veiligste ontwerp

### B0. Gedeeld fundament (nodig voor 2 t/m 5)

```sql
create table if not exists arnobot_referral_acties (
  id uuid primary key default gen_random_uuid(),
  soort text not null check (soort in ('voordeel_jaar','voordeel_maand','voordeel_team',
    'tegoed_terugstorten','tegoed_overslaan','tegoed_teamkorting')),
  user_id text not null,              /* ontvanger */
  referral_id text,                   /* verplicht bij voordeel_* */
  doel_soort text not null check (doel_soort in ('betaling','periode','teamfactuur')),
  doel_id text not null,
  bruto_cent integer not null check (bruto_cent >= 0),
  netto_cent integer not null check (netto_cent >= 0),
  status text not null default 'gereserveerd' check (status in
    ('gereserveerd','bezig','verzonden','bevestigd','vrijgegeven','ongedaan','vastgelopen')),
  bezig_tot timestamptz, pogingen int not null default 0, fout text,
  mollie_refund_id text,
  gegevens jsonb not null default '{}',   /* oude en nieuwe datums, abonnementskenmerk */
  credit_status text not null default 'nvt' check (credit_status in ('nvt','nodig','bezig','klaar')),
  credit_id text,
  mail_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists referral_een_voordeel on arnobot_referral_acties (referral_id)
  where soort like 'voordeel%' and status not in ('vrijgegeven','ongedaan');
create unique index if not exists referral_een_actie_per_doel on arnobot_referral_acties (soort, doel_id, user_id)
  where status not in ('vrijgegeven','ongedaan');
alter table arnobot_referral_acties enable row level security;

alter table arnobot_referral_grootboek
  add column if not exists bron_ids text[],      /* betaal- of factuurkenmerken onder de toekenning */
  add column if not exists actie_id uuid,
  add column if not exists hoort_bij text,       /* referral_id van de aangesproken toekenning */
  add column if not exists mail_at timestamptz;
/* Vervang de check op soort door:
   toekenning, afwijzing, vaststelling, verval, handwerk, verrekening, vrijgave, terugdraaiing, herstel */

create table if not exists arnobot_referral_gratis_periodes (
  actie_id uuid primary key references arnobot_referral_acties(id),
  user_id text not null, subscription_id uuid, team_id uuid,
  periode_start timestamptz not null, periode_einde timestamptz not null
);
alter table arnobot_referral_gratis_periodes enable row level security;
```

Vier databasefuncties, alle `security invoker`, met `revoke execute ... from public, anon, authenticated` en `grant ... to service_role`. Elk begint met `perform pg_advisory_xact_lock(hashtextextended(p_user, 0));`.

1. `referral_reserveer(actie, p_user, doel, max_netto)`
   * Alleen regels met `meeloop = false`.
   * Rest per toekenning = toekenning + vaststelling + alle mutaties met die `hoort_bij`.
   * Een openstaande schuld (terugdraaiing na gebruik) gaat er eerst af. Totaal 0 of lager: niets doen.
   * Oudste toekenning eerst verdelen. Per deel een grootboekregel `verrekening` (negatief), sleutel `verrekening:<actie>:<referral>`.
   * Bij doel betaling: `select ... for update`. Eis `status = 'paid'`, `terugbetaling_verwerkt_at is null` en `teruggeboekt_cent = 0`. Bruto is hooguit `bedrag_cent` min `greatest(terugbetaald_cent, referral_refund_cent)`; staat er een andere terugbetaling, dan weigeren. Verhoog `referral_refund_cent` **in dezelfde transactie** (lost A2 op).
   * Afronding gelijk aan `verrekening()` in TypeScript. Een rest van 1 cent telt als verbruikt.
2. `referral_reserveer_voordeel`: hetzelfde zonder saldo.
3. `referral_vrijgeven(actie)`: alleen als zeker is dat er geen geld is verplaatst. Tegenregel `vrijgave`, `referral_refund_cent` omlaag, status `vrijgegeven`.
4. `referral_boek(regel)`: ook toekenning, vaststelling, verval en terugdraaiing lopen door hetzelfde slot. `verval` boekt alleen de **resterende** waarde van die toekenning, berekend binnen het slot, nooit onder 0.

#### Terugstortmachine (gebruikt door onderdeel 2, 3, 4 en het teamlid)

1. Reserveren.
2. Rij claimen (`bezig_tot`, 10 minuten).
3. `lijstBetalingTerugbetalingen`. Staat er al een met `metadata.referralActie = id`, neem die over. Nooit blind opnieuw.
4. Staat er een onbekende terugbetaling, of loopt er een betaling terug: vrijgeven en stoppen.
5. `betaalTerug` met metadata (parameter toevoegen). https://docs.mollie.com/reference/create-refund: metadata wordt bewaard en teruggegeven, "up to approximately 1kB"; 409 "A duplicate refund has been detected." Of de lijst de metadata teruggeeft moet in de proef blijken.
6. Status `verzonden` met het kenmerk van de terugbetaling. Pas bij Mollie-status `refunded`: `bevestigd`, `credit_status = nodig`, mail.

| Fout | Gevolg |
|---|---|
| Na 1, vóór 5 | Reservering staat, cron hervat via stap 3 |
| Timeout of onbekend antwoord bij 5 | Niet vrijgeven; de volgende run kijkt eerst in de lijst |
| Duidelijke 4xx (niet 409 of 429) en niet in de lijst | Vrijgeven, na een vast aantal pogingen `vastgelopen` plus melding |
| Na 5, vóór 6 | Teruggevonden via metadata |
| Later `failed` of `canceled` | Vrijgeven en opnieuw plannen |
| `queued` (saldo bij Mollie te laag, zie de refundpagina) | Wachten, na 7 dagen melden |

* **Wachttijd:** pas terugstorten 7 dagen na `paid_at`. Dat is een eigen marge, geen bewezen grens.
* **Terugbetaling door de beheerder** (`app/api/admin/refund`): hetzelfde slot per gebruiker. Een actie met status `gereserveerd` op die betaling eerst vrijgeven. Bij `bezig` of `verzonden` kort weigeren. Anders rekent `restantCent` met een bedrag dat later kan terugvallen. Herroepen mag nooit blijvend blokkeren; lukt vrijgeven niet, dan het restant uitbetalen en het verschil nabetalen als de actie mislukt.
* **Creditnota:** aparte stap. Wachten tot `moneybird_factuur_id` echt is (niet leeg of `bezig`; `testmodus` = overslaan). `credit_status` claimen, vóór het aanmaken zoeken op een referentie met het actiekenmerk (zoekfilter onbevestigd), `credit_id` direct opslaan, daarna regelbedrag, versturen en registreren als losse hervatbare stappen. Blijft `bezig` onbeslist, dan niet opnieuw aanmaken maar melden.
* **`creditnotaVoorBetaling`** moet bij `referral_refund_cent > 0` het restant automatisch crediteren in plaats van alleen te melden.

#### Schakelaars

Alle standaard uit (alleen exact `true` is aan): `REFERRAL_GROOTBOEK_ECHT`, `REFERRAL_TERUGSTORTEN`, `REFERRAL_CREDITNOTA`, `REFERRAL_TEAMKORTING`, `REFERRAL_OVERSLAAN`, `REFERRAL_MAILS`. Uit betekent: alleen "zou doen" tonen, niets reserveren. Een uitgezette schakelaar stopt nooit het afhandelen van wat al `bezig` of `verzonden` is.

#### Cron

Een nieuwe `referral-uitvoeren`, na grootboek en billing, met `registreerCronRun` en `notifyCronFailure`. Melding als terugstorten of creditnota uitstaat terwijl er iets openstaat.

### B2. Jaarkorting na overstap van maand naar jaar

* **Route:** altijd terugstorten na de volle jaarbetaling. Verworpen: lager bedrag op het abonnement.
* **Voorwaarden, uit de database afgeleid:**
  * De klant is aangebracht, en het is geen wederzijdse verwijzing (die is uitgesloten).
  * De eerste betaling was op tijd. Gebruik dezelfde functie als `klantFeiten`, niet het moment "nu".
  * Dit is zijn eerste staande jaarbetaling, via welke route ook (`herhaling` na overstap of `eerste` na opnieuw afrekenen).
  * Ervoor staan 1 t/m 3 betaalde maandperiodes (`telMaanden`).
  * Er is geen actief voordeel en geen `referred_discount > 0`.
* **Bedrag:** `jaarKortingCent(rij.bedrag_cent)`.
* **Uniciteit:** de index `referral_een_voordeel` sluit jaarkorting, gratis maand en teammaand onderling uit. Wie het eerst reserveert wint.
* **Bestaande gevallen:** bestaande `referred_discount > 0` inlezen als `bevestigd` voordeel. Het kolomtype eerst nakijken (SQL door de eigenaar, `numeric`).
* **Datamodel:** het fundament uit B0, soort `voordeel_jaar`, doel `betaling`.
* **Volgorde en idempotentie:** de terugstortmachine uit B0, inclusief de foutentabel.
* **Raakt:** `referralSignalen`, `overstap.infoVoorTelegram` (handwerktekst weg), `verwerking.ts` (de terugzetregel bij een terugbetaling kijkt naar de actietabel in plaats van naar `rij.bedrag_cent < sub.bedrag_cent`, wat na een prijswijziging of planwijziging fout gaat), de overstapmail (tekst eerst aan de eigenaar).
* **Tests:**
  * 3 maanden en dan jaar: ja. 4 maanden: nee.
  * Overstap en nieuwe checkout: allebei ja.
  * Te laat: nee.
  * Webhook vóór en na de reservering stopt het abonnement niet.
  * Twee cronruns en een herstart na een uur: één terugbetaling.
  * Herroeping en chargeback.
  * Gratis maand al gebruikt: nee.

### B3. Gratis vierde maand

#### B3a, eerst bouwen: terugstorten

De vierde betaling gaat gewoon af. 7 dagen later volledig terug via de machine, soort `voordeel_maand`. De rij telt als betaald en de periode blijft gewoon. Dit houdt artikel 2 ("krijg je de vierde gratis"), heeft geen herstartrisico en haalt de deadline. Let op: de akkoordtekst zegt overslaan. Een klant ziet eerst een afschrijving. appHelp en mails moeten dat kloppend zeggen.

#### B3b, later achter `REFERRAL_OVERSLAAN`

Alleen na de proef in C.

**Variant PATCH (voorkeur als bewezen):**

1. Actie aanmaken met `gegevens {subId, oudeDatum, nieuweDatum, oudEinde, nieuwEinde}`. Reken de nieuwe datum vanaf de oorspronkelijke dag van de maand, anders schuift de 31e blijvend naar de 28e.
2. Gedeeld mutatieslot per abonnement nemen (de bestaande `klanttype_bezig_tot`, nu ook in alle paden uit A4). Opzeggen mag nooit mislukken op een bezet slot: kort opnieuw proberen, en het overslaan leest na afloop de status opnieuw.
3. Eisen:
   * Status `active`, niets gepland, geen open correctie.
   * Geldige machtiging, geen open betaling.
   * Mollie-status `active`, bedrag gelijk, `nextPaymentDate` gelijk aan `periode_einde` (hooguit 3 dagen verschil) en minstens 4 dagen weg (eigen marge).
   * Derde betaling minstens 7 dagen oud.
4. PATCH `startDate`.
5. Teruglezen: hetzelfde id, `active`, `nextPaymentDate` exact nieuw, geen nieuwe betaling.
6. In één databasefunctie, met voorwaarde `periode_einde = oudEinde`: `periode_start` en `periode_einde` schuiven, gratis periode invoegen, status `bevestigd`.
7. `expires_at = toegangTot(nieuwEinde)`, zonder `plan` te overschrijven (cadeau op Pro). Daarna de mail met de volgende incassodatum.

**Herstel:** een stap vóór stap 5 in de billing-cron leest bij elke open actie Mollie.

* Nieuwe datum: stap 6 en 7 afmaken.
* Oude datum en nog ruim op tijd: opnieuw proberen.
* Oude datum en te krap: vrijgeven en B3a.
* Onleesbaar: niets wijzigen.

Zolang een actie open staat mag stap 5 dat abonnement niet afsluiten, en `expires_at` mag niet verlopen: zet die bij stap 1 vast op de nieuwe waarde. Dat is hooguit een maand gratis toegang bij een storing, nooit verlies van toegang. Komt er toch een vierde betaling: gratis periode niet boeken en op die betaling B3a toepassen.

**Variant vervangen (alleen als PATCH niet werkt):** zoals `klanttypeOmzetten`.

* Startmoment vóór het aanmaken vastleggen.
* `metadata.referralActie`, een willekeurige sleutel, de lijst bij Mollie leidend.
* Unieke omschrijving per actie.
* Resterende `times` overnemen.
* `stopCorrectieAbonnementen` verbreden tot alle tijdelijke abonnementen.
* Ná het stoppen van het oude opnieuw controleren of er niet is opgezegd.
* Lukt het stoppen niet, dan het nieuwe weghalen.

Advies: deze variant niet bouwen en dan bij B3a blijven.

#### Ook nodig

* `telMaanden` accepteert gratis periodes: einde verlengen, reeks niet verhogen en niet breken. Voeden vanuit `klantFeiten`, `maandReeks` en `gratisVierdeMaand`.
* `bedragControle` ook op de incassodatum, en op precies één lopend abonnement, dagelijks na een overslag.
* **Tests:** elke breukplek van stap 1 t/m 7; opzeggen, upgrade en overstap tegelijk; de 29e, 30e en 31e van de maand; de reeks na een overslag; stap 5 tijdens een open actie; een betaling van de oude datum die toch binnenkomt.

### B4. Terugdraaien en verrekenen

#### Terugdraaien

* Een toekenning bewaart `bron_ids` (de 3 maandbetalingen of de jaarbetaling; bij een team de factuurkenmerken).
* Aanleiding: een bronbetaling is volledig terugbetaald (`isVolledigTerugbetaald`), teruggeboekt, of de teamfactuur heeft `reversed_at`.
* Een terugbetaling pas boeken bij Mollie-status `refunded`. `terugbetaling_verwerkt_at` wordt al bij een lopende terugbetaling gezet.
* Boek `terugdraaiing`, met een sleutel per referral en volgnummer: min de volle toekenning, min wat al vervallen is. Was het al gebruikt, dan ontstaat een schuld die alleen tegen later tegoed wegvalt.
* Keert de betaling terug (mislukte terugbetaling, herstelde teamfactuur): `herstel`.
* Openstaande acties die nog niet verzonden zijn: vrijgeven.
* Teruggedraaid telt niet voor mijlpalen.
* **Nacontrole individueel (A7):** dagelijks `haalBetaling` en de lijst met terugbetalingen voor alle `bron_ids` en actiedoelen, 400 dagen lang, in porties. Ook na een al gezette `terugbetaling_verwerkt_at`.
* Draait de aanbrenger een betaling terug waarop tegoed is gebruikt (volledig of chargeback), boek dan `vrijgave`. Verval volgt daarna de gewone regels.
* Meld een chargeback na een eigen deelterugbetaling apart: mogelijk is er meer dan 100 procent terug.

#### Wanneer verrekenen

Alleen bij `tegoedStatus = actief`, geen open vervalvraag, geen lopende bijbetaling, en alleen op betalingen met `paid_at` ná de toekenning. Dat voorkomt terugstorten met terugwerkende kracht.

**Verlenging:** `herhaling` of `verlenging`, of een `eerste` waarvoor al eigen betaalde periodes bestonden die hooguit 14 dagen eerder eindigden. Nooit `upgrade` of de allereerste. Eerst het eigen voordeel, dan tegoed over de rest.

**Bedrag nog leeg:** binnen het slot `vaststelling` = `tegoedNettoCent(klant_maand_netto_cent, eigen netto maandprijs)`, vóór het reserveren.

**Individueel:** de terugstortmachine, ook voor de particuliere jaarverlenging (A13) en in de eerste fase ook voor een hele maand. De rest blijft staan.

#### Aanbrenger als teamlid

* Eigen betalingen, nieuwste eerst, via `verdeelOverEigenBetalingen`.
* `beschikbaarCent` komt uit `amountRemaining` en de lijst met terugbetalingen bij Mollie, niet alleen uit de database. https://docs.mollie.com/reference/get-payment: "The remaining amount that can be refunded."
* Eén actie per betaling.
* Het maximum per referral is zijn laatst zelf betaalde maandprijs.
* Pas "vervalt" boeken als alle delen bevestigd zijn en niets meer past.
* Houd rekening met de handmatige coulancerestitutie in de melding van `teamlidSolo`; die tekst aanpassen.

#### Team (korting en gratis teammaand)

```sql
alter table arnobot_team_facturen
  add column if not exists referral_korting_netto_cent integer not null default 0,
  add column if not exists referral_actie_id uuid;
/* check op bedrag_cent: > 0, of = 0 met status 'verrekend'
   statuscheck uitbreiden met 'verrekend'
   arnobot_team_facturen_periode_uniek opnieuw maken, status in ('open','paid','overdue','verrekend') */
```

* Alleen op reguliere facturen, in `maakTeamFactuur`: rij invoegen, dan **één** databasefunctie die reserveert en `bedrag_cent`, `btw_cent` en de korting wijzigt, alleen als er nog geen betaallink is. Daarna link, Moneybird en mail met uitsluitend die waarden.
* Mislukt de functie: niet met het volle bedrag doorgaan als er tegoed is; de rij blijft herstelbaar.
* Nieuwe hervatstap in `team-facturatie`: een open rij zonder link of `bezorgd_at` afmaken met de **opgeslagen** bedragen. De linksleutel van een uur is niet genoeg; sla de link op vóór je verdergaat en zoek bij twijfel in Mollie. Een eerder aangemaakte link die nergens is opgeslagen is nooit verstuurd.
* `maakConceptFactuur` in Moneybird moet een kortingsregel kunnen (negatieve regel onbevestigd). Terugval: één regel met het nettobedrag en de korting in de omschrijving. Het totaal moet op de cent gelijk zijn aan de betaallink.
* Volledig gedekt: status `verrekend`, 0 euro, geen link, geen factuur in Moneybird, wel een mail, wel de datum door, de blokkade niet automatisch opheffen.
* Pas alle statusfilters aan: `betaaldeTeamsVan`, dekking en periodes (gratis, geen betaalde maand), `herstelNaBestaandeFactuur`, herinnering en blokkade, `teamActivatie`, adminschermen, export en rapportage.
* Actie `bevestigd` bij betaling of `verrekend`. Bij een onbetaalde factuur blijft zij gereserveerd. Bij terugdraaien vrijgeven.
* Gratis teammaand: `min(maandfactuur, teamstartprijs)`. De startprijs vastleggen bij de eerste factuur. `meldAangebrachtTeam` en `team-aanvraag` aanpassen.

#### Tests voor B4

Twee runs tegelijk op één saldo; verval en verrekening tegelijk; verval na deelverbruik; terugdraaien vóór, tijdens en na verrekening; herstel; timeout na een terugbetaling en een nieuwe poging na meer dan een uur; terugbetaling door de beheerder tijdens een actie; teamfactuur op 0, deels, en bij elke breukplek; afronding in SQL gelijk aan TypeScript. Voor de databasefuncties een test met een echte Postgres, want een nagemaakte database bewijst het slot niet. Plus `check-testaccount-filter` en `check-missing-user-filter`.

### B5. Saldo, mails, grootboek echt, opzegmelding

#### Livegang (herziene regel)

1. Vóór 05:00 UTC, met alle geldschakelaars uit.
2. SQL in één transactie:

```sql
begin;
create table arnobot_referral_grootboek_meeloop_backup as select * from arnobot_referral_grootboek where meeloop;
alter table arnobot_referral_grootboek_meeloop_backup enable row level security;
/* ALLE regels van elke referral met minstens één handmatig besluit blijven, inclusief toekenning en vragen */
update arnobot_referral_grootboek set meeloop = false
 where meeloop and referral_id in (select referral_id from arnobot_referral_grootboek
   where meeloop and reden like 'handmatig besluit: %');
delete from arnobot_referral_grootboek where meeloop;
commit;
```

3. Daarna pas de deploy en `REFERRAL_GROOTBOEK_ECHT=true`.

* `MEELOOP` wordt `!echt`, en de acties lezen hard `meeloop = false`.
* Eerst deployen kan niet: de echte run zou handmatige gevallen opnieuw beoordelen en de update botst dan op de unieke index.
* Zet de schakelaar niet terug zonder plan.
* Bewaarde handmatige toekenningen krijgen `bron_ids` bij livegang via een eenmalige aanvulling; lukt dat niet, dan geen automatische terugdraaiing en wel een melding.
* Toon vóór de livegang een droogloop naast de meeloopstand en verklaar elk verschil. Een uitkomst is daarna definitief en hangt af van de stand op dat moment.
* De meldtekst "Zou ..." aanpassen.
* `referral_credit`: eerst nakijken of er een waarde boven 0 is. Zo ja, eenmalig als toekenning inboeken. Daarna niet meer lezen.

#### Saldo

`/api/bot/referral` telt het grootboek van de eigen gebruiker op (`meeloop = false`).

* Tonen in centen, exclusief btw.
* "Bedrag volgt" bij een lege toekenning.
* Negatief tonen als 0.
* Gereserveerd telt niet als beschikbaar.
* BETALEND is: niet teruggedraaide klanten die nu betalen, niet `status = converted`.

#### Mails

Toekenning, verrekening (bedrag, hoe, wanneer zichtbaar), gratis maand voor de klant, teamkorting, verval en terugdraaiing.

* Verstuurd vanuit de cron over `mail_at is null` (claim, versturen, bij een fout de claim terug), via `verstuurMail` met `telMail`.
* Bij livegang `mail_at` op de bewaarde oude regels vullen.
* Teksten eerst aan de eigenaar.

#### Opzegmelding

Gebouwd. Alleen controleren: bij een geblokkeerd of gestopt team en bij Lifetime.

#### Overig

Nieuwe tabellen in export en verwijderchecklists, privacytekst nalopen, `appHelp`, ABONNEMENTEN, overzicht, technische overdracht en PDF's.

## C. Alleen met een proef vast te stellen

| Proef | Tot die tijd uit |
|---|---|
| Testmodus: PATCH `startDate` op een actief abonnement met al een incasso: gelijk id, nieuwe `nextPaymentDate`, geen betaling op de oude datum, wel precies één op de nieuwe, daarna het normale interval (ook jaar en dag 31) | `REFERRAL_OVERSLAAN` |
| Wanneer maakt Mollie de incassobetaling aan, en wat doet PATCH of stoppen met een al aangemaakte betaling | `REFERRAL_OVERSLAAN` |
| Volledige en gedeeltelijke terugbetaling op een terugkerende betaling: komt de metadata terug in de lijst, statusverloop, `amountRemaining`, webhook, abonnement en toegang blijven (hele keten) | `REFERRAL_TERUGSTORTEN` |
| Zelfde sleutel na meer dan 60 minuten; tweede gelijke terugbetaling | niet op de sleutel leunen, ongeacht de uitkomst |
| Chargeback na een deelterugbetaling, en een teruggedraaide chargeback: velden en webhook | verrekenen op SEPA-betalingen pas na 7 dagen en met nacontrole; meer blijft onbevestigd |
| Webhook en archiveren bij betaallinks; betaallink met het kortingsbedrag | `REFERRAL_TEAMKORTING` |
| Moneybird: deelcreditnota op een betaalde factuur (regelbedrag aanpassen, registreren, mail, btw), kortingsregel en totaal op de cent, zoeken op referentie. `register_payment_creditinvoice` eist volgens de specificatie: "both invoices must be in a state that accepts a payment" | `REFERRAL_CREDITNOTA` en de kortingsregel |
| Echt geld: één klein deelbedrag op iDEAL en op SEPA (kosten, duur, wat de klant ziet, wachtrij bij laag saldo) | `REFERRAL_TERUGSTORTEN` voor klanten |

* **De documentatie zwijgt:** https://docs.mollie.com/reference/create-subscription zegt niet wanneer de betaling wordt aangemaakt. https://docs.mollie.com/reference/cancel-subscription zegt niets over bestaande betalingen (wel: "Canceling a subscription has no effect on the mandates of the customer."). De pagina over wijzigen (update-subscription) zegt niets over al aangemaakte betalingen.
* **Tijd versnellen:** `interval: '1 day'` in testmodus is een mogelijke manier. Of die vanzelf incasseert is niet bewezen; de documentatie zegt alleen "Test mode subscriptions will get canceled automatically after 10 payments."
* **Echte timing van SEPA** is in testmodus niet te bewijzen.
* **Moneybird:** `MONEYBIRD_OOK_IN_TESTMODUS` niet aanzetten. Een proef in een aparte testadministratie (beschikbaarheid onbevestigd), anders alleen met akkoord van de eigenaar.
* **Mollie-proeven** pas na akkoord van de eigenaar.
* Kosten van een terugbetaling blijven onbevestigd.
* Zonder creditnota niet voor echte klanten terugstorten, tenzij de eigenaar de achterstand bewust accepteert.

## D. Besluiten voor de eigenaar (voorstellen, geen besluiten)

### D1. Eerst terugstorten, overslaan pas na bewijs

Dit wijkt tijdelijk af van het akkoord van 25-11, voor de gratis maand, een hele maand tegoed en de lagere jaarverlenging. Voorstel: ja. Overslaan alleen via PATCH; werkt die niet, dan blijvend terugstorten.

### D2. Opgezegd na de derde betaling

Voorstel: de gratis maand geldt alleen als er een vierde betaling komt (dus ook de nog verschuldigde zakelijke betaling). Geen extra gratis toegang. Na een upgrade geldt het werkelijk betaalde bedrag van de vierde betaling. De tekst eerst nalopen tegen artikel 2.

### D3. Wat draait tegoed terug

Voorstel:

* Alleen een volledige terugbetaling of chargeback van een bronbetaling; een kleine terugbetaling uit coulance niet.
* Het al genoten voordeel van de klant niet terughalen.
* Een schuld nooit incasseren, en laten vervallen samen met het tegoed.
* Betaalt de klant opnieuw: geen nieuwe toekenning, behalve bij een herstel van Mollie zelf.
* Artikel 5 noemt "terugbetaling"; terugboeking erbij zetten (tekst eerst).

Let ook op: een gedeeltelijk terugbetaalde maand telt nu al niet mee voor de drempel.

### D4. Teammaand

Voorstel: bij een maandteam op de vierde reguliere factuur, bij een jaarteam als korting op de eerste jaarfactuur (bij activeren is de tijdigheid te bepalen uit de factuurdatum). Volledig gedekt is `verrekend` zonder factuur; dit vervangt de oude tekst bij fase 3. Is de eerste jaarfactuur al verstuurd voordat dit live is, dan terugstorten met een creditnota.

### D5. Handwerkgevallen (de eigenaar wil niets met de hand)

Voorstel per soort:

* Klant of aanbrenger staat nu op BETAALD zonder betaling in het systeem: wachten, geen beslissing. Voor de aanbrenger niet verrekenen.
* "Lijkt te laat" met een verlengde teamproef of eerder op BETAALD: toekennen (voordeel van de twijfel).
* "Lijkt vervallen" met een onvolledige voorgeschiedenis: behouden.
* Onzeker teambegin door een nooit betaalde factuur: die factuur niet meetellen is niet in het voordeel van de klant, dus toekennen.
* Aanmelddatum onbekend: toekennen als de eerste betaling binnen 45 dagen na de oudst bekende datum viel.
* Maandprijs van de aanbrenger onbekend: bedrag volgt.
* Account verwijderd: is de aanbrenger weg, dan vervalt het; is de klant weg, dan beslissen op de bewaarde betalingen, anders afwijzen.

Dit kost af en toe te veel tegoed, nooit te weinig. Een technisch vastgelopen geldactie blijft altijd een melding.

### D6. Terugstorten kan niet (te oud, rekening dicht)

Voorstel: het tegoed blijft staan voor een volgende verlenging; bij een teamlid vervalt het na 3 mislukte pogingen. Nooit uitbetalen. Open sinds 26-11: tegoed van wie daarna gratis wordt. Voorstel: stil laten staan, de gewone vervalregels blijven gelden.

## E. Aanbevolen bouwvolgorde (elk los te controleren, alles uit)

Eerste harde datum met geld voor de jaarkorting is rond 24-01-2027, voor de gratis maand begin februari. Een nieuw aangebracht team of een eerste jaarteam kan eerder komen.

1. Pure regels met tests: gratis periode in `telMaanden`, saldo en rest per toekenning, verval op de rest, mijlpalen zonder teruggedraaide toekenningen.
2. SQL-fundament en de vier functies, met een test op een echte Postgres (gelijktijdigheid). Kolomtype `referred_discount` nakijken. `bron_ids` vanaf nu al in meeloopregels vullen.
3. Terugstortmachine met een nagemaakte Mollie, plus `betaalTerug` met metadata, het slot in de terugbetaling door de beheerder, en alle breukplekken getest.
4. Mollie-proef met terugbetalingen (na akkoord), met een proefingang voor testaccounts. In dezelfde ronde de PATCH-proef, zodat besluit D1 vroeg valt.
5. Moneybird-proef en hervatbare deelcreditnota.
6. Jaarkorting (B2), droogloop.
7. Gratis maand via terugstorten (B3a), droogloop. Vanaf nu kunnen de handwerksignalen weg zodra de schakelaar aanstaat, niet eerder.
8. Nacontrole van individuele betalingen en terugdraaien, meelopend.
9. Verrekenen individueel en teamlid.
10. Teamkorting, teammaand en hervatstap (eerder uitvoeren als er een team aankomt).
11. Handwerkregels (D5), droogloop, onafhankelijke controle van stap 1 t/m 10.
12. Grootboek echt, daarna saldo en mails. Dan een voor een aanzetten: creditnota, terugstorten, teamkorting.
13. Overslaan, alleen als de PATCH-proef slaagde: eerst het gedeelde slot in alle paden (apart opleveren en controleren), dan het overslaan.

Tot stap 12 bestaat er geen echt tegoed en blijven de huidige meldingen nodig. Let op: `VEILIG_TERUGSTORTEN` (bankoverschrijving) wordt nergens vastgelegd. Wat zo met de hand is gegeven moet vóór stap 6 of 7 als `bevestigd` actie worden ingeboekt, anders krijgt de klant het dubbel.

## Belangrijkste bestanden

Onder `C:\Users\arno\arnobot\`:

* `lib\billing\verwerking.ts`
* `lib\billing\terugbetaling.ts`
* `lib\billing\referralGrootboek.ts`
* `lib\billing\referralRegels.ts`
* `lib\billing\teamFacturatie.ts`
* `lib\billing\moneybird.ts`
* `lib\billing\mollie.ts`
* `app\api\cron\billing\route.ts`
* `docs\REFERRAL_AUTOMATISERING.md`

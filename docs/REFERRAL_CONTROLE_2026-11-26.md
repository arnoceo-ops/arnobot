# Referralautomatisering: uitslag onafhankelijke controle 26-11-2026

Vijf agents zonder voorgeschiedenis (teambetalingen, grootboek, individuele betalingen, klantteksten, oplevering), alleen lezen. Niets is tegen Mollie of Moneybird beproefd. Kolom Bewijs: **zelf** = daarna door de bouwsessie in de code nagekeken, **agent** = alleen door de agent vastgesteld.

**In orde:** werkmap en master gelijk; typecontrole en 1407 tests groen; CI Security Audit groen; productiedeploy geslaagd; /referrals toont 1.7 met 50/100/250; nieuwe routes hebben autorisatie; nieuwe tabel heeft RLS; de meeloopstand wijzigt niets buiten zijn eigen tabel; bij een individueel jaarabonnement zijn betaalpagina, Mollie en database gelijk en betaalt de verlenging de volle prijs.

## Ronde 1: heeft nu al gevolgen of kan op elk moment

| Nr | Probleem | Bewijs |
|---|---|---|
| R1 | Niets vult arnobot_payments.referral_refund_cent. Met de hand een hele maandbetaling terugstorten (tegoed of gratis maand) stopt het abonnement en de toegang. Een deelbedrag laat de betaling niet meer meetellen in het grootboek. **Tot er een adminactie is: niet via het Mollie-dashboard terugstorten.** | zelf |
| R2 | Teamfacturatie: mislukt de inhaalcontrole bij Mollie, dan volgen herinnering en blokkade toch, ook bij een betaalde klant. Geen Telegram bij fouten > 0. | zelf |
| R3 | Teamfacturatie: botst een nieuwe factuur met de unieke index (functie afgebroken, of oud tabblad dat de oude factuurdatum opslaat), dan schuift de datum nooit door en komt er geen factuur meer. Activeren meldt toch gelukt. | zelf |
| R4 | BETAALD PER BANK vraagt niet eerst bij Mollie of er al via de link betaald is; daarna volgt een misleidende melding "dubbel betaald". | zelf |
| R5 | Teamfacturatie: een mislukte of geannuleerde terugbetaling laat de factuur op refunded staan, met de melding "gedeeltelijk terugbetaald €0,00, maak creditnota". Geen herstelknop. Een al teruggedraaide betaling op een open factuur telt eerst als betaald en heft de blokkade op. | zelf |
| R6 | Bestond al: elke betaalde teamfactuur heft elke blokkade op; een factuur zonder betaallink leidt toch tot herinnering en blokkade. | zelf (blokkade), agent (link) |
| R7 | Klanttypecorrectie: de blokkade bij een referral fee kijkt alleen naar de laatste betaling; na een upgrade te omzeilen, met verkeerde facturen. | zelf |
| R8 | Zelf een team activeren kijkt niet naar referrals: geen korting en geen signaal. | zelf |
| R9 | Gratis vierde maand en jaarkorting na overstap van maand naar jaar zijn niet gebouwd en geven geen bruikbaar signaal. De overstapzin staat in de spelregels; op zijn vroegst fout rond 24-01-2027, dus eerder dan de deadline van begin februari. | zelf (niet aangeroepen) |
| R10 | Melding bij teamaanvraag zegt nog "regel de gratis eerste maand". | zelf |
| R11 | Q&A "Hoe hoog is het tegoed?" noemt de oude regel. | zelf |
| R12 | /referrals scrollt horizontaal op mobiel (nowrap in de mijlpaaltabel, smalle kolom). Agent heeft nagebouwd en gemeten, niet de live pagina. | zelf (nowrap) |
| R13 | Accountpagina: BETALEND telt Basic per jaar en online betaalde teams niet; TEGOED leest het handmatige referral_credit en rondt op hele euro's, terwijl de spelregels zeggen dat het saldo daar staat. | zelf (velden) |
| R14 | Melding bij opzeggen dat tegoed vervalt (regel 25-11) ontbreekt overal. | agent |
| R15 | Spelregels: "Je vierde maand schrijven we niet af" is stelliger dan de regel; "Team: ten hoogste de maandprijs bij de start" zegt niet wat het team krijgt; artikel 3, 5 en 7 missen regels. appHelp, QA, aanmeldpagina en dag-25-mail zijn onvolledig. BUSINESS_HANDOVER, ABONNEMENTEN, ARNOBOT_OVERZICHT, OVERSTAP_PLAN en dit plan bevatten verouderde passages. | agent |
| R16 | teamlidSolo-melding raadt een deelrestitutie via het Mollie-dashboard aan (kan samenvallen met tegoed, zie R1). | zelf |

Klein (agent): tweede proefperiode (herstart) opent de kortingstermijn opnieuw; verlengen met een klik toont geen bedrag; dubbele checkout geeft twee betalingen; factuuromschrijving leidt de korting af uit de huidige prijs; chargebackmelding gaat verloren als Telegram faalt; tweede betaling op een via Mollie betaalde teamfactuur wordt niet gemeld; betaaldOp heeft geen ondergrens; referral-insert in proxy.ts niet op fouten gecontroleerd; kolomtype van arnobot_referrals.referred_discount staat niet in de repo (is het integer, dan mislukt het wegschrijven stil).

### Voortgang ronde 1 (akkoord Arno 26-11)

- **R2 t/m R6 hersteld op 26-11** (teamfacturen, met tests): geen herinnering of blokkade als Mollie niet te controleren is, bij een afwijkend bedrag of zonder betaallink; melding bij deelfouten; botsing met de unieke periode schuift de factuurdatum door (datum gaat nu direct na het aanmaken vooruit); het Teams-formulier stuurt de factuurdatum alleen mee als die is gewijzigd; BETAALD PER BANK controleert eerst Mollie; een niet doorgegane terugdraaiing zet de factuur weer op betaald; een al teruggedraaide betaling telt niet als betaald; opheffen van een blokkade niet bij een eigen blokkade (SQL docs/sql/2026-11-26-team-blokkade-handmatig.sql, nog door Arno uit te voeren) of zolang een andere factuur over de grens open staat. Nieuwe klanttekst, nog door Arno te beoordelen: de foutmelding bij zelf activeren als de factuur niet lukt. Niet opnieuw onafhankelijk gecontroleerd en niet in Mollie beproefd.
- **Later op 26-11 hersteld:** R7 (zelf omzetten naar zakelijk ook geblokkeerd na een upgrade; de referral fee wordt op de eerste betaling zelf getoetst), R10 en R16 (adminmeldingen), R12 (spelregels op smal scherm, niet in een browser nagekeken).
- **R8 en R9: alleen het signaal**, het voordeel zelf is nog niet gebouwd: Telegram-actie bij zelf activeren van een aangebracht team, bij de derde betaalde maand van een aangebrachte klant (lib/billing/referralSignalen.ts) en in de overstapmelding.
- **R1, voorlopige werkwijze:** tegoed of een gratis maand altijd per bankoverschrijving terugstorten met een creditnota in Moneybird, nooit via Mollie (de app ziet een bankoverschrijving niet). Een adminactie die veilig via Mollie terugstort is nog niet gebouwd; die hoort bij het verrekenen in ronde 3, tenzij Arno hem eerder wil.
- **R11, R14 en R15 live op 26-11** met door Arno goedgekeurde, korte en vriendelijke teksten (spelregels 1.8). Gekozen: kort met gewone zinnen. Verworpen: de uitgebreide versie (veel te lang) en de heel korte (te staccato). De melding bij opzeggen staat niet in de Android-app (geen koopverwijzingen).
- **R13:** gekozen BETALEND en TEGOED tijdelijk verbergen. Verworpen: nu repareren, want het saldo komt uit het grootboek en dat is nog niet betrouwbaar.
- Eerstvolgende stap: nieuwe agents controleren heel ronde 1; daarna ronde 2.

### Hercontrole van ronde 1 door twee nieuwe agents (26-11)

SQL docs/sql/2026-11-26-team-blokkade-handmatig.sql is door Arno uitgevoerd. Geen blokkerende bevindingen. Opgelost bevonden: R3, R4 (hoofdroute), R8 (signaal), R10, R11, R13, R16, R14 (op een randgeval na). Deels: R2, R5, R6, R7, R9, R12, R15. R12 is daarna hersteld (de mobiele opmaak stond vóór de basisregels en werkte niet) en gemeten op 320 tot 414 pixels.

Opgave Arno 26-11: er is nog niets met Teams gedaan en er staat geen teamfactuur open. H1 en H3 hebben dus nu geen gevolgen, wel herstellen vóór het eerste echte team.

**Open, volgende stap (nieuwe sessie: "ga verder met de referralautomatisering, herstel H1 tot en met H7"; teksten eerst aan Arno, daarna een gerichte hercontrole door een nieuwe agent, dan pas ronde 2):**

| Nr | Ernst | Bevinding |
|---|---|---|
| H1 | ernstig | verwerkTeamBetaling negeert databasefouten: een betaalde klant kan alsnog worden herinnerd en geblokkeerd, zonder melding. |
| H2 | ernstig | geblokkeerd_handmatig blijft staan na proef verlengen of activeren, en wordt niet op false gezet bij een automatische blokkade; zelf activeren heft een eigen blokkade op. |
| H3 | ernstig | Faalt Moneybird of de mail na het opslaan van de betaallink, dan volgen herinnering en blokkade voor een nooit bezorgde factuur. |
| H4 | ernstig | Zelf omzetten naar zakelijk kan tijdens een lopende upgradebetaling (alleen status paid wordt getoetst). |
| H5 | ernstig, kleine kans | Het signaal gratis vierde maand wordt afgewacht vóór zetToegang; blijft Telegram hangen, dan worden toegang, mail en factuur overgeslagen. |
| H6 | klein | Melding "dubbel betaald" na een chargeback; herstel naar betaald noemt de blokkade niet; signalen kijken niet of het voordeel al gebruikt is; opzegzin zichtbaar voor een teamlid met eigen abonnement; dagelijkse herhaalmeldingen; TEST_TEAM_ID niet uitgesloten in de cronlus. |
| H7 | klein, tekst (eerst Arno) | Artikel 3 mist "en verstreken"; appHelp en overzicht missen "zonder nieuw abonnement"; aanmeldpagina en dag-25-mail noemen niet de teamtermijn; Uitgangspunt in het plan is verouderd. |

### Herstel H1 t/m H6 (26-11)

Met tests; typecontrole en 1451 tests groen. Niet onafhankelijk gecontroleerd en niet in Mollie beproefd. SQL docs/sql/2026-11-26-team-factuur-bezorgd.sql is door Arno uitgevoerd (26-11).

- **H1:** elke lees- of schrijffout in verwerkTeamBetaling en bij een dubbele betaling gooit nu: de webhook geeft 500 (Mollie probeert opnieuw), de cron slaat die factuur over en meldt het. De cron zelf controleert ook de fouten bij teams ophalen, open facturen, herinneren en blokkeren; de blokkademail gaat alleen als het blokkeren echt is gelukt.
- **H2:** automatische blokkades (facturatie, teamproef, gestopt team) zetten geblokkeerd_handmatig op false; proef verlengen en activeren ook; de adminroute schrijft blokkade en kenmerk in een keer. Zelf activeren van een team dat Arno zelf blokkeerde wordt geweigerd (bestaande tekst) met een Telegram-melding.
- **H3:** nieuwe kolom bezorgd_at, gezet na verzending door Moneybird, of bij geen Moneybird na onze eigen mail met de betaallink. Zonder dat vinkje geen herinnering of blokkade, en zo'n factuur houdt een blokkade ook niet vast. Gekozen: een eigen kolom. Verworpen: de betaallink wissen bij een mislukte verzending, want de manager ziet die link op zijn accountpagina en kan er dan niet meer betalen. Geen vulling van oude rijen (er stond niets open; de SQL toont het als dat wel zo is). Een factuur die Arno met de hand alsnog stuurt krijgt geen automatische herinnering.
- **H4:** zelf omzetten naar zakelijk is ook geblokkeerd bij een open of lopende upgradebetaling; alleen mislukt, geannuleerd of verlopen telt niet. Omgekeerde volgorde meegenomen: wordt een al gestarte correctie betaald na een upgrade, dan maakt de app geen creditnota en factuur en meldt hij handwerk. Het abonnement wordt in dat geval wel op zakelijk gezet.
- **H5:** het signaal staat nu na toegang, mail en factuur, en meldingen via notifyTelegram (waaronder alle meldingen in de betaalverwerking) hebben een tijdslimiet van 8 seconden.
- **H6:** geen "dubbel betaald" meer na een chargeback; de herstelmelding noemt de blokkade; signalen zwijgen als de jaarkorting al is gebruikt (referred_discount) en na een eerdere reeks van drie; de opzegzin staat niet meer bij een gewoon teamlid (accountpagina, opzegmail en betaalmails); herhaalmeldingen over teamfacturen komen hooguit eens per week; de cronlus sluit alle testteams uit. Beperking: een met de hand gegeven voordeel (bankoverschrijving) wordt nergens vastgelegd.
- **H7:** het Uitgangspunt in het plan is bijgewerkt. De vier klantteksten zijn door Arno goedgekeurd en doorgevoerd (spelregels 1.9).

### Hercontrole van H1 t/m H7 door een nieuwe agent (26-11)

Geen blokkerende bevindingen. H1 t/m H5 en H7 opgelost, H6 deels (N1).

- **N1 (ernstig, ontstaan door H6), hersteld:** na het terugdraaien van een eerste betaling met referral fee bleef het voordeel als gebruikt staan. referred_discount gaat nu terug naar 0.
- **N2, hersteld in de tekst:** alleen notifyTelegram heeft de tijdslimiet. Directe Telegram-aanroepen elders (proxy.ts, team-aanvraag, chat, dashboard, drie crons, twee webhooks of rapportroutes, adminknop) niet; die zitten niet in de betaalverwerking en zijn niet gewijzigd.
- **N3, hersteld:** een mislukte query naar opgezegde teams stopt nu de facturatiecron, anders kon een opgezegd team nog een factuur krijgen.
- **N4, hersteld:** opheffen na betaling en zelf activeren schrijven alleen als er intussen geen eigen blokkade is gezet. Het or-filter bij activeren is niet tegen de echte database beproefd.
- **N5, open, bestond al:** zelf omzetten naar zakelijk blokkeert niet bij een geplande overstap zonder upgraderij; gepland_bedrag_cent en gepland_btw_cent blijven dan particulier (vastgesteld door de agent). Vermoeden van de agent, niet beproefd: het bedrag van het lopende Mollie-abonnement wordt bij een correctie nooit aangepast.
- **Testdekking:** toegevoegd voor de Moneybird-route van H3 en voor N4. Nog niet gedekt: de webhook met 500, de nieuwe cronfouten, het testteamfilter, de opzegzin in mails, de volgorde van het signaal, N1 en N3.

### N5: plan A (akkoord Arno op de richting 26-11, bouwplan wacht op akkoord)

**Nu geen schade:** de tabel arnobot_klanttype_correcties bestaat niet in productie (query van Arno 26-11 en docs/PRIJSWIJZIGING_PLAN.md). Het starten faalt bij het wegschrijven, voor er een betaallink is, dus niemand is zo omgezet. De link op de accountpagina is wel zichtbaar en geeft een foutmelding. Het SQL-script pas draaien na dit herstel.

**Uitgangspunt:** zelf nagelezen in de code: de verwerking zet klant_type en bedrag alleen in de database; het Mollie-abonnement, gepland_*-kolommen en contract_einde blijven staan; schrijffouten worden genegeerd en na de claim op paid doet een herhaalde webhook niets meer. Particulier jaar zonder abonnement krijgt via stap 2 van de billing-cron alsnog een zakelijk abonnement. Geen bestaande controle vergelijkt het bedrag bij Mollie met de database. Mollie (https://docs.mollie.com/reference/update-subscription, gelezen 26-11): bedrag wijzigen kan met PATCH, geldt voor "future payments", geannuleerde abonnementen niet; niets over een al aangemaakte betaling.

1. Starten weigeren bij een geplande wijziging, een lopende betaling of een incasso binnen 4 dagen. De betaallink moet verlopen voor die grens (of Mollie dat bij betaallinks ondersteunt is nog niet nagekeken).
2. Na betaling het lopende Mollie-abonnement vervangen zoals bij overstappen: eerst nieuw (zakelijk bedrag, start op de volgende incassodatum, doorlopend), bevestigen, dan het oude stoppen; lukt stoppen niet, dan het nieuwe weghalen en melden. contract_einde leegmaken. Gekozen: vervangen, een weg die ook een verlengd abonnement met vast aantal incasso's dekt. Verworpen: PATCH van het bedrag, want de docs zeggen niet dat het aantal incasso's te wissen is.
3. Elke schrijffout gooit, en een eigen vinkje "abonnement omgezet" zodat een herhaalde webhook of de cron afmaakt wat bleef liggen. Is omzetten niet meer veilig (incasso te dichtbij of al gedaan), dan melding en later opnieuw of handwerk.
4. Dagelijkse controle in de billing-cron: bedrag van elk lopend en gepland Mollie-abonnement gelijk aan de database, anders Telegram.
5. Tests, SQL (bestaande migratie plus de nieuwe kolom), proef in Mollie testmodus (eerst vragen), onafhankelijke controle.

**N5 gebouwd op 26-11 (akkoord Arno op plan en teksten).** lib/billing/klanttypeOmzetten.ts, lib/billing/klanttypeCorrectie.ts, lib/billing/bedragControle.ts, stap 1d en 6 in de billing-cron. 1486 tests groen. Nog niet onafhankelijk gecontroleerd en niet in Mollie beproefd. SQL: docs/sql/2026-11-26-klanttype-correctie-omzetten.sql, **nog niet uitvoeren** (pas na de controle; daarmee staat de functie aan). Aanvullingen op het plan: het zakelijke bedrag komt uit het eigen abonnement (niet uit de prijslijst, zodat een prijswijziging bestaande klanten niet raakt); er wordt pas gefactureerd als het abonnement is omgezet; een onbetaalde correctie blokkeert overstappen en upgraden nog 48 uur (voorheen voor altijd); een tweede betaalde correctie geeft een melding om terug te storten. Betaallink verloopt via expiresAt (https://docs.mollie.com/reference/create-payment-link, gelezen 26-11; de docs zeggen niets over een betaling die net voor het verlopen start).

**Proef in testmodus (nog te doen, eerst Arno vragen):** accepteert Mollie expiresAt in dit formaat; mag een nieuw abonnement starten op de nextPaymentDate van het oude en geeft Mollie daarna dezelfde nextPaymentDate terug (de code leunt daarop bij het hervatten); stoppen en bevestigen van het oude.

**Onafhankelijke controle van N5 (26-11, commit 1f1b2c4c): SQL toen niet veilig.** Blokkerend: B1 een nieuwe poging binnen het uur kreeg door de gelijke idempotentiesleutel het gestopte abonnement terug (https://docs.mollie.com/reference/api-idempotency); B2 na een half afgeronde omzetting stopte geen enkel stoppad het nieuwe abonnement; B3 een verloren antwoord leidde tot een tweede abonnement. Ernstig: E1 geen slot na paid, E2 geen controle of het abonnement nog hetzelfde was, E3 terugbetaling en correctie wisten niets van elkaar, E4 facturatie kon stil wegvallen.

**Hersteld op 26-11, 1506 tests groen, nog niet opnieuw gecontroleerd:** de lijst abonnementen van de klant bij Mollie is leidend (metadata klanttypeCorrectie), elke aanmaakpoging heeft een eigen sleutel, omzetting_gestart_at wordt voor het aanmaken vastgelegd en stopMollieAbonnement stopt dan ook het nieuwe abonnement; een slot per abonnement (klanttype_bezig_tot, vervalt na 10 minuten); bij een gewijzigd, beeindigd of terugbetaald abonnement of dubbele betaling niet omzetten maar handwerk melden; creditnotaVoorBetaling slaat een al bij de correctie gecrediteerde factuur over; gefactureerd_at met melding als die leeg blijft; particulier jaar gebruikt dezelfde weg als de rest; teruggedraaide correctiebetaling wordt gemeld; overstappen weigert bij een databasefout; de bedragcontrole vergelijkt per klant de hele lijst (ook weggevallen en onbekende abonnementen). Gekozen: Mollie als bron. Verworpen: een pogingnummer in de sleutel, want dat dekt het verloren antwoord niet.

Bekende rest: is het oude gestopt en blijft de database dagen onbereikbaar, dan weigert verwerking.ts de eerste betaling van het nieuwe abonnement (met melding).

**Extra voor de proef in testmodus:** geeft Mollie metadata terug in de lijst van abonnementen; geeft een nieuw abonnement dezelfde nextPaymentDate als de gevraagde startdatum (ook bij status pending); wat doet stoppen met een al aangemaakte incasso; weigert Mollie een gelijke omschrijving.

**Hercontrole (26-11, commit 4e0e6032):** B1, B2, B3 en E2 opgelost. Nieuw: N1 blokkerend (het slot gebruikte een or-filter op de gewijzigde kolom, dat geeft op oudere PostgREST-versies een fout: https://github.com/PostgREST/postgrest/issues/3707; **zelfde patroon stond live in zelf een team activeren, sinds c8b86b22**), N2 ernstig (facturatie kon nog stil wegvallen), N3 t/m N8 klein.

**Hersteld op 26-11, 1510 tests groen:** slot met twee losse updates (zoals de bestaande claim in verwerking.ts); activeren met een gewone eq; leesfouten en een ontbrekend e-mailadres gooien; een teruggestort verschil breekt de omzetting af; zelfde dagrekening bij starten en omzetten; smalle herkenning van een ontbrekende tabel (lib/billing/tabel.ts); bedragcontrole neemt afgesloten rijen met een mogelijk open abonnement mee en meldt een onbekende Mollie-klant als bevinding; **schakelaar KLANTTYPE_OPEN**: zonder die Vercel-variabele op true zien en gebruiken alleen de eigenaar en de testaccounts het zelf omzetten (de link op de accountpagina verdwijnt dus voor anderen; de pagina zelf verwijst naar admin@arno.bot). Gekozen: schakelaar zoals bij overstappen, omdat de hele keten pas na de SQL te proeven is. Niet gedaan: de melding bij een mislukte stop door een tijdelijke fout (N8, eerste punt) blijft.

**Volgorde nu:** Mollie-proef (alleen API, testsleutel), SQL, proef van de hele keten door de eigenaar, dan KLANTTYPE_OPEN=true. Het slot is niet tegen de echte database beproefd; bij de ketenproef nakijken.

**Controle van 56cf217b (26-11): de SQL kan veilig worden uitgevoerd zolang KLANTTYPE_OPEN niet is gezet.** Slot en teamactivatie in orde (PostgREST neemt alleen or/and mee bij het teruglezen), niemand komt buiten de schakelaar om. Daarna hersteld: N9 (na terugstorten tijdens een half afgeronde omzetting kon de klant zonder incasso blijven; nu blijft het lopende abonnement staan met een waarschuwing) en N10 (bedragcontrole ook voor een gepland abonnement op een afgesloten rij). Deze twee herstellingen zijn niet opnieuw door een agent gecontroleerd.

**Extra voor de proef in testmodus:** is amountRefunded op de betaling van de betaallink al gevuld zolang de terugstorting nog loopt? Zo niet, dan kan de cron na "stort terug om af te breken" toch omzetten.

**SQL uitgevoerd door Arno (26-11):** controle 11 kolommen, rowsecurity true. KLANTTYPE_OPEN niet gezet.

**Mollie-proef in testmodus (26-11, akkoord Arno, lib/billing/klanttype.mollie.live.test.ts, alleen Mollie):** bevestigd: een nieuw abonnement naast het oude is active met nextPaymentDate gelijk aan de startdatum (ook jaar, 300 dagen vooruit); de lijst geeft metadata terug; na stoppen canceled; dezelfde idempotentiesleutel geeft het gestopte abonnement terug als active (B1 was echt); een gelijke omschrijving bij twee actieve abonnementen wordt geweigerd (422, oud en nieuw verschillen door "(zakelijk)"); expiresAt wordt geaccepteerd en een verlopen link is niet betaalbaar. **Weerlegd:** amountRefunded blijft 0,00 zolang een terugbetaling loopt (ook na een minuut); /payments/{id}/refunds toont hem wel als pending. Hersteld: de correctie kijkt nu ook naar die lijst. Dit beantwoordt ook de open vraag hieronder voor teamfacturen: de nacontrole op amountRefunded ziet een terugbetaling pas als die is afgerond (later, niet verloren; niet gewijzigd). **Niet te beproeven met deze proef:** wat stoppen doet met een al aangemaakte incasso; of een betaling die vlak voor het verlopen start nog slaagt; amountChargedBack na een teruggedraaide chargeback.

**Proef van de hele keten (26-11, akkoord Arno, lib/billing/klanttype.keten.live.test.ts): geslaagd.** Testaccount, Mollie testsleutel, echte database. Starten, verwerken zonder betaling (blijft open), betalen via de testcheckout, bezet slot (niets gebeurt), vrij en verlopen slot tegen de echte PostgREST, twee gelijktijdige verwerkingen (precies een nieuw abonnement: 71,39 op dezelfde incassodatum, het oude canceled), database zakelijk 7139/1239, herhaling en dagelijks vangnet veranderen niets, stoppad na afloop. Alles verwijderd (17 abonnements- en 19 betaalrijen voor en na), klantgegevens hersteld. Een eerste ronde liep vast op de testpagina na de betaling (wachten in de test, niet de app) en is ook volledig opgeruimd. **Niet geproefd:** Moneybird (creditnota, nieuwe factuur) en de klantmail (stonden uit), de pagina en de route met inloggen, aflevering van de webhook door Mollie (de test riep de verwerking zelf aan), particulier jaar door de hele keten.

Niet vast te stellen uit de Mollie-documentatie (proef in testmodus): of amountRefunded lopende terugbetalingen meetelt en of amountChargedBack weer 0 wordt bij een teruggedraaide chargeback. R5 leunt daarop.

## Ronde 2: grootboek, **niet klaar om echt te tellen**

Uitkomsten "afwijzing" en "verval" zijn definitief.

| Nr | Probleem | Bewijs |
|---|---|---|
| B1 | Solo naar Team laat tegoed vervallen: het team telt pas na een betaalde factuur, terwijl de vervaltermijn al loopt vanaf het einde van solo. | zelf |
| B2 | Aanbrenger met verlengde teamproef of nog open eerste teamfactuur: termijn is altijd aanmelding plus 40 dagen, dus te vroeg vervallen. | zelf |
| B3 | Elke deelterugbetaling haalt de betaling uit de tijdigheidscontrole: klant onterecht "te laat". | zelf |
| B4 | Eerst online abonnement, daarna met de hand op BETAALD: niet als handwerk herkend, dus afwijzen of vervallen. | zelf |
| E1 | Teruggedraaide teamfactuur telt de manager toch als betalend. | zelf |
| E2 | Upgrade telt voordat de bijbetaling definitief is: bedrag te hoog en vastgelegd. | agent |
| E3 | Mijlpaalmelding telt alle aanbrengers samen in plaats van per persoon. | zelf |
| E4 | huidigSeats negeert een databasefout en geeft dan het minimum: tegoed te laag, en ook de teamfactuur kan te laag uitvallen. | zelf |
| E5 | Overlappende periodes tellen als losse maanden. | agent |
| E6 | "Drempel pas na het einde: geen tegoed" is niet gebouwd; alleen de stand van nu telt. | agent |
| E7 | Geanonimiseerd (niet verwijderd) account wordt niet als verwijderd herkend. | agent |
| E8 | Een handmatig besluit kan niet worden vastgelegd; handwerk kan later alsnog automatisch worden toegekend. | agent |

Klein (agent): laatste dag van de termijn ongelijk berekend voor klant en aanbrenger; bedrag vastgesteld bij eerste abonnement in plaats van eerste verrekening; prijzen uit de huidige prijslijst; Telegrambericht kan te lang worden en een verzendfout blijft onopgemerkt.

Ook nog niet gebouwd: terugdraaien, verrekenen, terugstorten aan een teamlid, saldo uit het grootboek, mails aan de aanbrenger. Grootboek en arnobot_referrals ontbreken in de verwijderchecklists (delete-account, data-cleanup); het grootboek ontbreekt in de export. De privacyverklaring beschrijft niet dat de aanbrenger de naam van de nieuwe gebruiker krijgt en dat de voornaam bij een code openbaar opvraagbaar is.

### Ronde 2 hersteld (26-11)

B1 t/m B4, E1 t/m E8, de vier kleine punten en de vier besluiten zijn verwerkt, met tests. Alle bevindingen bleken bij nakijken nog te kloppen. Grootboek en arnobot_referrals staan in de export en de verwijderchecklists. Het grootboek verrekent en stort niets terug.

- **amountRefunded:** het grootboek leunde erop. Vlak vóór elke toekenning vraagt het nu de lijst terugbetalingen bij Mollie op; loopt er een die de database niet kent, dan wacht de beoordeling. Niet tegen Mollie beproefd. Verrekenen (ronde 3) moet dezelfde lijst gebruiken.
- **Handwerk:** de cron beslist er nooit meer zelf over. Arno beslist op /bot/admin/referrals (route /api/admin/referrals/besluit).
- **Bedrag zonder abonnement:** wordt niet meer vastgesteld bij het eerste abonnement, maar pas bij de eerste verrekening (niet gebouwd).
- **Lifetime:** nieuwe kolom lifetime_sinds, door Arno met de hand te zetten. Regelt alleen het tegoed.

**Eerste onafhankelijke controle (commit b21effef): niet klaar.** 15 bevindingen, onder meer blokkerend een te laag bedrag na een directe upgrade (de rij houdt de Basic-prijs tot de eerste Pro-incasso), en onterecht laten vervallen of afwijzen bij een geblokkeerde eerste teamfactuur, handmatige toekenningen, eerder per bank betalen, een tweede proef en oud-teamleden. Hersteld in dezelfde ronde, met testrijen zoals de app ze wegschrijft. Waar de voorgeschiedenis niet zeker is (ooit BETAALD in het adminlog, of ooit teamlid) laat de cron niets vervallen en wijst hij niet af: dat wordt handwerk. Beperkingen: het adminlog bestaat pas sinds 14-11; wie vóór de SQL uit een team is gehaald is niet als oud-teamlid te herkennen; bij een handwerkmelding over verval is er nog geen knop om het verval vast te leggen (ronde 3).

**Tweede onafhankelijke controle (commit 567264e1):** SQL toen nog niet veilig. 5 bevindingen, hersteld: gratis toegang en herstart bewaren de proefstart alleen nog na de intake (anders kon de referral fee bij het afrekenen onterecht vervallen); een later teruggedraaide of onbetaalde teamfactuur verschuift het begin van het team niet meer; een aanbrenger die ooit gratis toegang had wordt nooit automatisch afgewezen en verliest niets automatisch, dat is handwerk (niets over besloten, open punt voor Arno); de verwijderchecklist laat het grootboek staan; een klant die ooit op BETAALD stond wordt alleen nog handwerk als hij anders als te laat zou worden afgewezen.

## Voorgesteld herstel

1. **Ronde 1:** R2 t/m R8 repareren met tests; een adminactie die tegoed veilig terugstort (R1); duidelijke Telegram-acties voor R8, R9; R10 t/m R13 en R16; teksten (R15) eerst als platte tekst aan Arno.
2. **Ronde 2:** B1 t/m B4 en E1 t/m E8 met tests, daarna opnieuw onafhankelijk controleren.
3. **Ronde 3:** de niet-gebouwde beloften, met als vroegste datums: teamkorting nu, jaarkorting na overstap rond 24-01-2027, gratis vierde maand begin februari 2027. Verrekenen is nodig bij de eerste verlenging van een aanbrenger met tegoed.
4. **Daarna:** proef in Mollie testmodus (eerst Arno vragen).

## Besluiten Arno 26-11 (voor ronde 2, deze gaan vóór oudere regels)

1. Teamklant betaalt binnen de factuurtermijn maar na proef plus 10 dagen: **tellen, als de factuur binnen de termijn is aangemaakt.** Verworpen: afwijzen volgens de oude letter.
2. Aanbrenger komt na meer dan 14 dagen terug en daarna haalt een oude referral de drempel: **geen tegoed.**
3. Tweede proefperiode: **de eerste termijn telt** (rekenen vanaf de aanmelding via de referral).
4. Lifetime-houder zonder betaald abonnement: **het tegoed vervalt niet.**

Nog na te gaan in ronde 2: of deze vier besluiten een aanpassing van de spelregels of andere klantteksten vragen (teksten eerst aan Arno).

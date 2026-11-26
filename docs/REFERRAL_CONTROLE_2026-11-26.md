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
- Open in ronde 1: R11, R13, R14, R15 (klantteksten en schermlabels, eerst als platte tekst aan Arno).

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

## Voorgesteld herstel

1. **Ronde 1:** R2 t/m R8 repareren met tests; een adminactie die tegoed veilig terugstort (R1); duidelijke Telegram-acties voor R8, R9; R10 t/m R13 en R16; teksten (R15) eerst als platte tekst aan Arno.
2. **Ronde 2:** B1 t/m B4 en E1 t/m E8 met tests, daarna opnieuw onafhankelijk controleren.
3. **Ronde 3:** de niet-gebouwde beloften, met als vroegste datums: teamkorting nu, jaarkorting na overstap rond 24-01-2027, gratis vierde maand begin februari 2027. Verrekenen is nodig bij de eerste verlenging van een aanbrenger met tegoed.
4. **Daarna:** proef in Mollie testmodus (eerst Arno vragen).

## Besluiten die Arno nog moet nemen (nodig voor ronde 2)

1. Teamklant betaalt binnen de factuurtermijn maar na proef plus 10 dagen: afwijzen (huidige letter) of tellen? Advies: tellen als de factuur binnen de termijn is aangemaakt.
2. Aanbrenger komt na meer dan 14 dagen terug en daarna haalt een oude referral de drempel: advies geen tegoed.
3. Tweede proefperiode: advies de eerste termijn telt (rekenen vanaf de aanmelding via de referral).
4. Later: vervalt tegoed bij een lifetime-houder zonder betaald abonnement?

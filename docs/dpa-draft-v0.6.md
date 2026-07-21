# Verwerkersovereenkomst — CONCEPT v0.6

> **NIET-OFFICIEEL CONCEPT.** Startpunt voor juridische beoordeling, geen ondertekenbaar document. Gebaseerd op de standaardstructuur van AVG artikel 28(3) en de feiten uit `docs/dpa-input.md`. Alle eerdere voorstellen zijn door Arno akkoord bevonden en als definitieve tekst verwerkt. Nieuw in v0.6: OpenAI toegevoegd als sub-verwerker (Artikel 5), naar aanleiding van een 2026-07-audit die vaststelde dat de Whisper/TTS-integratie nog nergens in de leverancierslijsten stond. Nog openstaand: het vestigingsadres en KVK-nummer van de BV (zie preambule). Niet versturen naar een klant of laten ondertekenen vóór volledige beoordeling door een bedrijfsjurist.

---

**Tussen:**

**Verwerkingsverantwoordelijke ("Klant")**: [PLACEHOLDER: naam en gegevens klant]

**Verwerker ("ArnoBot")**: Royal Dutch Sales B.V., handelsnaam ArnoBot, gevestigd te Amsterdam, Nederland (KVK: [PLACEHOLDER: KVK-nummer nog onbekend]). Contactpersoon: Arno Diepeveen. Privacycontact: privacy@arno.bot.

*Let op: vestigingsplaats voorlopig op Amsterdam gezet (2026-07-21), in lijn met de privacypagina en algemene voorwaarden. Exact straatadres en KVK-nummer nog aan te vullen.*

---

## Artikel 1 — Onderwerp en duur

Deze overeenkomst regelt de verwerking van persoonsgegevens door ArnoBot namens de Klant, ten behoeve van het leveren van de ArnoBot-coachingdienst aan medewerkers van de Klant.

Duur: voor de looptijd van de onderliggende dienstverleningsovereenkomst tussen Klant en ArnoBot, tenzij eerder beëindigd conform Artikel 10.

## Artikel 2 — Aard en doel van de verwerking

ArnoBot verwerkt persoonsgegevens uitsluitend voor:
- Het verlenen van toegang tot ArnoBot aan medewerkers van de Klant
- Het opslaan en tonen van coachingsgesprekken en profielgegevens
- Het genereren van persoonlijke AI-coaching
- Transactionele communicatie (accountmeldingen, systeemberichten)
- Beveiliging van de dienst en foutopsporing
- Bij teamlicenties: geaggregeerde, niet-letterlijke groeirapportage aan de manager binnen de Klant-organisatie

ArnoBot verwerkt gegevens uitsluitend op basis van gedocumenteerde instructies van de Klant, tenzij een wettelijke verplichting anders bepaalt.

## Artikel 3 — Categorieën betrokkenen en gegevens

**Betrokkenen**: medewerkers van de Klant met een ArnoBot-account.

**Gegevens**:

| Categorie | Toelichting |
|---|---|
| Accountgegevens | Naam en e-mailadres |
| Profielgegevens | Salesrol, markt, uitdagingen, doelstellingen |
| Gesprekslogs | AI-coachingsgesprekken |
| Technische gegevens | IP-adres, sessiedata |
| Geüploade documenten | Niet blijvend opgeslagen, alleen gebruikt om de vraag te beantwoorden |

Geen bijzondere categorieën persoonsgegevens (AVG artikel 9).

## Artikel 4 — Verplichtingen van ArnoBot als verwerker

ArnoBot:
1. verwerkt persoonsgegevens uitsluitend op gedocumenteerde instructies van de Klant;
2. waarborgt dat personen die gegevens mogen verwerken tot geheimhouding verplicht zijn;
3. treft passende technische en organisatorische maatregelen conform Artikel 6 van deze overeenkomst;
4. schakelt geen andere verwerker (sub-verwerker) in zonder algemene voorafgaande schriftelijke toestemming van de Klant, met inachtneming van het bezwaarrecht in Artikel 5;
5. assisteert de Klant, voor zover redelijkerwijs mogelijk, bij verzoeken van betrokkenen tot uitoefening van hun AVG-rechten;
6. assisteert de Klant bij het nakomen van diens verplichtingen inzake beveiliging, meldplicht datalekken en gegevensbeschermingseffectbeoordelingen;
7. verwijdert of retourneert alle persoonsgegevens na afloop van de dienstverlening, conform Artikel 9;
8. stelt de Klant alle informatie ter beschikking die redelijkerwijs nodig is om aan te tonen dat aan deze overeenkomst wordt voldaan, en staat audits toe conform Artikel 8.

## Artikel 5 — Sub-verwerkers

ArnoBot maakt gebruik van de volgende sub-verwerkers:

| Partij | Doel | Locatie / certificering |
|---|---|---|
| Supabase | Database, opslag gesprekken en profiel | EU, SOC 2 Type II |
| Clerk | Authenticatie en gebruikersbeheer | SOC 2 Type II |
| Vercel | Hosting en deployment | — |
| Anthropic | AI-verwerking voor coaching | — |
| OpenAI | Spraakherkenning (Whisper) en tekst-naar-spraak voor voice-invoer | — |
| Resend | Transactionele e-mails | — |
| Voyage AI | Embeddings en herrangschikking (kennisbank, sessiegeheugen) | SOC 2, HIPAA |
| Sentry | Foutmonitoring en performance-tracing | — |
| Upstash | Rate limiting | — |

ArnoBot informeert de Klant schriftelijk (e-mail volstaat) over voorgenomen wijzigingen in deze lijst. De Klant kan binnen 30 dagen na kennisgeving schriftelijk bezwaar maken op redelijke, gedocumenteerde gronden. Partijen overleggen te goeder trouw over een oplossing; bij het uitblijven daarvan kan de Klant de overeenkomst beëindigen conform Artikel 13.

## Artikel 6 — Beveiligingsmaatregelen

- Versleutelde verbindingen (HTTPS/TLS) voor al het datatransport
- Row Level Security in de database: gebruikers hebben uitsluitend toegang tot eigen data
- Authenticatie via Clerk (SOC 2 Type II), optioneel Enterprise SSO (SAML/OIDC) gekoppeld aan het bedrijfsdomein van de Klant
- Bij teamlicenties: toegang alleen via uitnodiging van de manager binnen de Klant-organisatie
- Toegangscontrole via JWT-tokens en server-side API routes
- Geautomatiseerde monitoring voor foutdetectie

Volledig overzicht: `arno.bot/arnobot-beveiliging.pdf`.

## Artikel 7 — Internationale doorgifte

Een deel van de verwerking vindt plaats bij partijen buiten de EER (VS). Waarborg: Standard Contractual Clauses (SCC's) en sub-verwerkers met SOC 2 Type II-certificering. De toepasselijke SCC's van de betreffende sub-verwerkers worden als bijlage bij deze overeenkomst gevoegd.

## Artikel 8 — Audit

ArnoBot verstrekt de Klant op verzoek, maximaal eenmaal per twaalf maanden, relevante documentatie (o.a. dit document, het beveiligingsdocument, en beschikbare certificeringen van sub-verwerkers) om aan te tonen dat aan deze overeenkomst wordt voldaan. Een audit op locatie is alleen mogelijk na onderling overleg, met een redelijke aankondigingstermijn, en voor rekening van de Klant tenzij de audit materiële non-conformiteit aantoont.

## Artikel 9 — Bewaartermijnen en verwijdering

| Categorie | Bewaartermijn |
|---|---|
| Persoonsgegevens en profiel | Zolang het account actief is, verwijderd 30 dagen na beëindiging |
| Gesprekslogs | Geanonimiseerd 30 dagen na beëindiging |
| Technische logs | Maximaal 90 dagen |
| Geüploade documenten | Niet opgeslagen |

Na afloop van de overeenkomst verwijdert of retourneert ArnoBot alle persoonsgegevens, tenzij wettelijk bewaren verplicht is.

## Artikel 10 — Meldplicht datalekken

ArnoBot informeert de Klant zonder onredelijke vertraging, uiterlijk binnen 72 uur na ontdekking van een datalek dat de gegevens van de Klant raakt.

## Artikel 11 — Aansprakelijkheid

De totale aansprakelijkheid van ArnoBot uit hoofde van deze overeenkomst, inclusief voor tekortkomingen in de verplichtingen als verwerker genoemd in Artikel 4 tot en met 10, is per kalenderjaar beperkt tot het totaalbedrag dat de Klant in de twaalf (12) maanden voorafgaand aan de schadeveroorzakende gebeurtenis aan ArnoBot heeft betaald onder de onderliggende dienstverleningsovereenkomst. Aansprakelijkheid voor indirecte schade, waaronder in ieder geval gevolgschade, gederfde winst en gemiste besparingen, is uitgesloten.

Deze beperking geldt niet in geval van opzet of bewuste roekeloosheid van ArnoBot of haar leidinggevenden (kan onder Nederlands recht sowieso niet worden uitgesloten, art. 6:248 lid 2 BW).

*ArnoBot heeft geen beroepsaansprakelijkheids- of cyberverzekering. Om die reden is bewust gekozen voor één uniform maximum in plaats van een apart, hoger maximum voor databeschermingsschendingen, in lijn met de daadwerkelijke financiële draagkracht van ArnoBot.*

## Artikel 12 — Toepasselijk recht en geschillen

Op deze overeenkomst en de uitvoering daarvan is uitsluitend Nederlands recht van toepassing.

Geschillen die voortvloeien uit of verband houden met deze overeenkomst worden voorgelegd aan de bevoegde rechter van de rechtbank in het arrondissement waar ArnoBot is gevestigd, onverminderd het recht van partijen om een voorlopige voorziening te vragen bij een andere bevoegde rechter. *(Het exacte arrondissement volgt zodra het vestigingsadres bekend is, zie preambule.)*

## Artikel 13 — Duur en beëindiging

Deze overeenkomst eindigt automatisch bij beëindiging van de onderliggende dienstverleningsovereenkomst. Na beëindiging verwijdert of retourneert ArnoBot alle persoonsgegevens binnen 30 dagen, conform Artikel 9.

---

*Concept opgesteld als input voor juridische beoordeling. Bevat geen bindende afspraken totdat beide partijen een door een jurist gecontroleerde definitieve versie ondertekenen.*

---

## Ondertekening

Partijen verklaren bovenstaande te zijn overeengekomen en ondertekenen dit document ten blijke daarvan.

**Namens Verwerkingsverantwoordelijke ("Klant")**

| | |
|---|---|
| Naam | ______________________ |
| Functie | ______________________ |
| Datum | ______________________ |
| Handtekening | ______________________ |

**Namens Verwerker ("ArnoBot")**

| | |
|---|---|
| Naam | Arno Diepeveen |
| Functie | Oprichter, Royal Dutch Sales B.V. |
| Datum | ______________________ |
| Handtekening | ______________________ |

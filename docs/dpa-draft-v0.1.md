# Verwerkersovereenkomst — CONCEPT v0.1

> **NIET-OFFICIEEL CONCEPT.** Dit is een startpunt voor juridische beoordeling, geen ondertekenbaar document. Gebaseerd op de standaardstructuur van AVG artikel 28(3) en de feiten uit `docs/dpa-input.md`. De meeste keuzes zijn ingevuld met een beargumenteerd voorstel (herkenbaar aan *cursieve toelichting*), gebaseerd op gangbare SaaS-praktijk of al bestaand beleid van ArnoBot. Artikel 11 (aansprakelijkheid) en Artikel 12 (toepasselijk recht) zijn bewust open gelaten: die raken reëel financieel risico en onderhandelingspositie, en zijn niet door AI te beslissen. Niet versturen naar een klant of laten ondertekenen vóór volledige beoordeling door een bedrijfsjurist.

---

**Tussen:**

**Verwerkingsverantwoordelijke ("Klant")**: [PLACEHOLDER: naam en gegevens klant]

**Verwerker ("ArnoBot")**: Royal Dutch Sales, handelsnaam ArnoBot, gevestigd te Lissabon, Portugal. Contactpersoon: Arno Diepeveen. Privacycontact: privacy@arno.bot.

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
4. schakelt geen andere verwerker (sub-verwerker) in zonder algemene voorafgaande schriftelijke toestemming van de Klant, met inachtneming van het bezwaarrecht in Artikel 5 *(voorstel: algemene toestemming, gangbaar bij SaaS-verwerkersovereenkomsten en proportioneel bij een sub-verwerkerslijst van deze omvang; specifieke toestemming per wijziging is zwaarder dan gebruikelijk voor een dienst op deze schaal)*;
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
| Resend | Transactionele e-mails | — |
| Voyage AI | Embeddings en herrangschikking (kennisbank, sessiegeheugen) | SOC 2, HIPAA |
| Sentry | Foutmonitoring en performance-tracing | — |
| Upstash | Rate limiting | — |

ArnoBot informeert de Klant schriftelijk (e-mail volstaat) over voorgenomen wijzigingen in deze lijst. De Klant kan binnen 30 dagen na kennisgeving schriftelijk bezwaar maken op redelijke, gedocumenteerde gronden. Partijen overleggen te goeder trouw over een oplossing; bij het uitblijven daarvan kan de Klant de overeenkomst beëindigen conform Artikel 13 *(voorstel: 30 dagen is gangbaar in SaaS-verwerkersovereenkomsten en geeft de Klant reële gelegenheid te reageren zonder de dienstverlening onwerkbaar te vertragen)*.

## Artikel 6 — Beveiligingsmaatregelen

- Versleutelde verbindingen (HTTPS/TLS) voor al het datatransport
- Row Level Security in de database: gebruikers hebben uitsluitend toegang tot eigen data
- Authenticatie via Clerk (SOC 2 Type II), optioneel Enterprise SSO (SAML/OIDC) gekoppeld aan het bedrijfsdomein van de Klant
- Bij teamlicenties: toegang alleen via uitnodiging van de manager binnen de Klant-organisatie
- Toegangscontrole via JWT-tokens en server-side API routes
- Geautomatiseerde monitoring voor foutdetectie

Volledig overzicht: `arno.bot/arnobot-beveiliging.pdf`.

## Artikel 7 — Internationale doorgifte

Een deel van de verwerking vindt plaats bij partijen buiten de EER (VS). Waarborg: Standard Contractual Clauses (SCC's) en sub-verwerkers met SOC 2 Type II-certificering. De toepasselijke SCC's van de betreffende sub-verwerkers worden als bijlage bij deze overeenkomst gevoegd *(voorstel: expliciet bijvoegen i.p.v. ernaar verwijzen, dat is voor een corporate klant navolgbaarder en sluit aan bij wat zij zelf vaak van hun eigen leveranciers eisen)*.

## Artikel 8 — Audit

ArnoBot verstrekt de Klant op verzoek, maximaal eenmaal per twaalf maanden, relevante documentatie (o.a. dit document, het beveiligingsdocument, en beschikbare certificeringen van sub-verwerkers) om aan te tonen dat aan deze overeenkomst wordt voldaan. Een audit op locatie is alleen mogelijk na onderling overleg, met een redelijke aankondigingstermijn, en voor rekening van de Klant tenzij de audit materiële non-conformiteit aantoont *(voorstel: dit is de gangbare, proportionele vorm bij een verwerker van deze schaal; onbeperkte on-site audit-rechten zijn ongebruikelijk en operationeel zwaar voor een klein team)*.

## Artikel 9 — Bewaartermijnen en verwijdering

| Categorie | Bewaartermijn |
|---|---|
| Persoonsgegevens en profiel | Zolang het account actief is, verwijderd 30 dagen na beëindiging |
| Gesprekslogs | Geanonimiseerd 30 dagen na beëindiging |
| Technische logs | Maximaal 90 dagen |
| Geüploade documenten | Niet opgeslagen |

Na afloop van de overeenkomst verwijdert of retourneert ArnoBot alle persoonsgegevens, tenzij wettelijk bewaren verplicht is.

## Artikel 10 — Meldplicht datalekken

ArnoBot informeert de Klant zonder onredelijke vertraging, uiterlijk binnen 72 uur na ontdekking van een datalek dat de gegevens van de Klant raakt *(dit is de bestaande, al gecommuniceerde praktijk richting eindgebruikers, hier bewust consistent gehouden)*.

## Artikel 11 — Aansprakelijkheid

**Nog niet ingevuld, bewust.** Dit raakt jouw daadwerkelijke financiële risico (aansprakelijkheidslimiet, uitsluitingen, vrijwaring) en hangt af van zaken die alleen jij en je jurist kunnen beoordelen: heb je een beroepsaansprakelijkheidsverzekering en wat dekt die, hoe groot is de klant/het contract, wat is je eigen risicotolerantie. Ter oriëntatie, geen aanbeveling: in SaaS-verwerkersovereenkomsten van vergelijkbare schaal komt een aansprakelijkheidslimiet gekoppeld aan de jaarlijkse contractwaarde vaak voor (bijvoorbeeld 1x tot 12x), met een aparte, vaak onbeperkte uitzondering voor schending van de vertrouwelijkheids- of AVG-verplichtingen zelf. Dit is generieke marktinformatie, geen voorstel voor jouw specifieke contract.

## Artikel 12 — Toepasselijk recht en geschillen

**Nog niet ingevuld, bewust.** De voor de hand liggende default is Portugees recht, gezien de vestigingsplaats van Royal Dutch Sales, maar een corporate klant zal vaak willen onderhandelen richting hun eigen jurisdictie, en toegeven op dit punt heeft praktische gevolgen (proceskosten, welk rechtssysteem, taal van een eventuele procedure). Dit is een bewuste onderhandelingskeuze, geen automatisme, en hoort bij jou en je jurist te liggen.

## Artikel 13 — Duur en beëindiging

Deze overeenkomst eindigt automatisch bij beëindiging van de onderliggende dienstverleningsovereenkomst. Na beëindiging verwijdert of retourneert ArnoBot alle persoonsgegevens binnen 30 dagen, conform Artikel 9 *(voorstel: 30 dagen sluit aan bij de al bestaande, gecommuniceerde bewaartermijn na accountbeëindiging, geen nieuwe afspraak)*.

---

*Concept opgesteld als input voor juridische beoordeling. Bevat geen bindende afspraken totdat beide partijen een door een jurist gecontroleerde definitieve versie ondertekenen.*

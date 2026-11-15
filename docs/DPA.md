# Verwerkersovereenkomst (concept)

> Concept: pas bindend na ondertekening door beide partijen. Onderaan staan de werkaantekeningen (status per leverancier en wat nog openstaat); die zijn geen onderdeel van de overeenkomst.

---

**Tussen:**

**Verwerkingsverantwoordelijke ("Klant")**: [PLACEHOLDER: naam en gegevens klant]

**Verwerker ("ArnoBot")**: Anton Dirk Diepeveen, handelend onder de naam ArnoBot (eenmanszaak), bezoekadres Verdunplein 17, 5627 SZ Eindhoven, Nederland (KVK: 42184446). Contactpersoon: Arno Diepeveen. Privacycontact: privacy@arno.bot.

---

## Artikel 1 — Onderwerp en duur

Deze overeenkomst regelt de verwerking van persoonsgegevens door ArnoBot namens de Klant, ten behoeve van het leveren van de ArnoBot-coachingdienst aan medewerkers van de Klant.

Duur: voor de looptijd van de onderliggende dienstverleningsovereenkomst tussen Klant en ArnoBot, tenzij eerder beëindigd conform Artikel 13.

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
| Accountgegevens | Naam en e-mailadres, afkomstig uit het LinkedIn-profiel (of het bedrijfs-e-mailadres bij Enterprise SSO) via Clerk |
| Profielgegevens | Salesrol, markt, uitdagingen, doelstellingen |
| Gesprekslogs | AI-coachingsgesprekken |
| Gedeelde gesprekken | Gesprekken die de gebruiker zelf deelt via een publieke link (optioneel, op initiatief van de gebruiker) |
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
| OpenAI | Spraakherkenning (live en achteraf) voor voice-invoer | — |
| Resend | Transactionele e-mails | — |
| Voyage AI | Embeddings en herrangschikking (kennisbank, sessiegeheugen) | SOC 2, HIPAA |
| Sentry | Foutmonitoring en performance-tracing | — |
| Upstash | Rate limiting | — |
| ElevenLabs | Tekst-naar-spraak voor ArnoBot Voice-abonnees | — |
| PostHog | Bezoekers- en productgebruiksanalyse (anoniem publiek, pseudoniem ingelogd; geen gespreks-/coachinginhoud) | EU (Frankfurt) |
| Calendly | Boeken van een kennismakingsgesprek met Arno | — |
| AssemblyAI | Transcriptie van audiobijlagen in de chat (direct verwijderd, geen training op klantdata) | — |
| Mollie | Online betalingen (iDEAL, Bancontact, creditcard) | EU |
| Moneybird | Facturen en boekhouding | Opslag binnen de EER |

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

Geschillen die voortvloeien uit of verband houden met deze overeenkomst worden voorgelegd aan de bevoegde rechter van de rechtbank Midden-Nederland, onverminderd het recht van partijen om een voorlopige voorziening te vragen bij een andere bevoegde rechter.

## Artikel 13 — Duur en beëindiging

Deze overeenkomst eindigt automatisch bij beëindiging van de onderliggende dienstverleningsovereenkomst. Na beëindiging verwijdert of retourneert ArnoBot alle persoonsgegevens binnen 30 dagen, conform Artikel 9.

---


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
| Naam | Anton Dirk Diepeveen |
| Functie | Eigenaar, ArnoBot (eenmanszaak) |
| Datum | ______________________ |
| Handtekening | ______________________ |

---

## Werkaantekeningen (geen onderdeel van de overeenkomst)

**Rechten van betrokkenen in de praktijk:** gebruikers kunnen deels zelf inzage, export en verwijdering regelen via hun account (data downloaden, account verwijderen, profiel aanpassen). Overige verzoeken lopen via privacy@arno.bot en worden binnen 10 werkdagen beantwoord. Op verzoek worden gegevens binnen 10 werkdagen verwijderd.

**DPA-status per sub-verwerker** (de tabel in Artikel 5 bevat alleen partij, doel en locatie):

| Partij | DPA |
|---|---|
| Supabase | Aanwezig |
| Clerk | clerk.com/legal/dpa |
| Vercel | vercel.com/legal/dpa |
| Anthropic | anthropic.com/legal/dpa |
| OpenAI | openai.com/policies/dpa |
| Resend | resend.com/legal/dpa |
| Voyage AI | Op aanvraag, geen publieke link |
| Sentry | sentry.io/legal/dpa |
| Upstash | Geen publieke DPA, op aanvraag |
| ElevenLabs | elevenlabs.io/dpa |
| PostHog | Op aanvraag |
| Calendly | calendly.com/legal/data-processing-addendum |
| AssemblyAI | assemblyai.com/legal/data-processing-addendum |
| Mollie | mollie.com/legal/data-processing-agreement |
| Moneybird | Verwerkersovereenkomst afgesloten door Arno op 2026-10-09 |

**Aanvullende feiten per sub-verwerker:** Anthropic, OpenAI, ElevenLabs en AssemblyAI trainen niet op klantdata. Upstash verwerkt IP-adressen. PostHog: anoniem op publieke pagina's, pseudoniem (account-ID) in de ingelogde omgeving, geen gespreks-, coaching- of analyse-inhoud; session replay staat aan, beperkt tot 6 shell-pagina's, alle tekst en invoer gemaskeerd, bewaartermijn 30 dagen.

**Openstaand vóór ondertekening met een klant:**
- Een DPA opvragen bij Voyage AI, Upstash en PostHog, of expliciet motiveren waarom dat niet nodig is. Voor PostHog is dit het meest urgent sinds de pseudonieme productanalyse van ingelogde gebruikers (2026-08-30); bevestig bij de aanvraag ook de sub-verwerkersketen (onder meer AWS eu-central-1).
- SOC 2 Type II of ISO 27001 van ArnoBot zelf is er niet; stelt een klant dat als harde eis, dan is dat een apart traject.

# ArnoBot — volledig productoverzicht

**Laatst bijgewerkt:** 2026-08-12
**Doel van dit document:** een volledig, actueel beeld van ArnoBot als product en bedrijf, voor gebruik buiten de dagelijkse ontwikkelwerkzaamheden (bijv. upload naar NotebookLM voor een presentatie, briefing van nieuwe teamleden, gesprekken met investeerders of partners). Vult `docs/SALES_BIJBEL.md` aan: dat document behandelt waaróm een klant koopt (USP's, unique buying reasons), dit document behandelt wát ArnoBot precies is, in volle breedte.

**Belangrijk voor gebruik in een presentatie:** dit document bevat alleen wat daadwerkelijk gebouwd en geverifieerd is tegen de code, op de datum hierboven. Waar iets gepland maar niet live is, staat dat er expliciet bij. Neem geen enkel cijfer of kenmerk over zonder dat onderscheid, dat voorkomt dat een presentatie iets belooft wat nog niet bestaat.

---

## 1. Wat is ArnoBot

ArnoBot is een AI-coach voor salesprofessionals, bereikbaar op **arno.bot**. Gebruikers voeren doorlopende gesprekken over hun werk (klantgesprekken, deals, pipeline, eigen gedrag), ArnoBot stelt vragen, reflecteert terug, en bouwt na verloop van tijd een profiel van de gebruiker op. Na meerdere gesprekken genereert de app een coachingrapport met scores op drie dimensies: mindset, systeem en actie.

Het is geen generieke AI-assistent met een sales-laagje. Het is gebouwd op de eigen methodiek, toon en persoonlijkheid van **Arno Diepeveen**, oprichter van Royal Dutch Sales, als schaalbaar verlengstuk van zijn eigen coachingswerk. De stem is direct, zonder omwegen, bewust niet corporate.

- **Live URL:** https://arno.bot
- **Bedrijf:** Royal Dutch Sales
- **Oprichter:** Arno Diepeveen
- **Vestiging:** Amsterdam, Nederland

---

## 2. Doelgroep

Nederlandstalige salesprofessionals en salesmanagers, voornamelijk in B2B. Het meest typische profiel: een zelfstandige verkoper of accountmanager bij een mkb-bedrijf, die wil verbeteren maar geen tijd of budget heeft voor een persoonlijke salescoach.

Voor managers bestaat een teammodule: zij zien de voortgang van hun verkopers en krijgen automatisch een voorbereide agenda voor 1:1-gesprekken, zonder ooit de losse gesprekken van een teamlid zelf te kunnen lezen.

---

## 3. Kernfunctionaliteit, volledig

### 3.1 Het hoofdgesprek
De basisinteractie: een doorlopend chatgesprek met ArnoBot over sales-onderwerpen. Reageert met vragen, spiegelt terug, verwijst waar relevant naar Arno's eigen kennisbank (blogartikelen, video's) via een zoekmechanisme op de achtergrond. Antwoordlengte instelbaar (kort/normaal/uitgebreid). Documentupload mogelijk voor gebruikers die een concreet document (bijv. een offerte) willen laten meekijken.

### 3.2 Geheugen over gesprekken heen (kern-differentiator)
Dit is het meest technisch uitgebreide onderdeel van het product en vandaag (12 augustus 2026) nog verder uitgebouwd. Drie, inmiddels vier lagen:

1. **Directe actie-opvolging:** elk gesprek eindigt met één concrete actie voor de gebruiker. Bij het volgende gesprek checkt ArnoBot actief of die actie is uitgevoerd, en benoemt het rechtstreeks als het antwoord niet klopt met wat er nu gezegd wordt. Geen slap "hoe ging het", een directe confrontatie met eerder gedrag, gedreven vanuit oprechte betrokkenheid, niet controle.
2. **Samenvattingen en feiten uit eerdere gesprekken:** concrete details (namen, bedrijven, cijfers, situaties) die een gebruiker eerder deelde, komen automatisch terug als achtergrondcontext, zonder dat de gebruiker ze opnieuw hoeft uit te leggen.
3. **Semantische retrieval buiten het recente venster (nieuw, 12 augustus 2026):** de twee lagen hierboven keken alleen naar de laatste 10 (Basic) of 25 (Pro/Team) gesprekken. Sinds vandaag zoekt ArnoBot ook actief in oudere, buiten dat venster vallende gesprekken naar content die relevant is voor de huidige vraag, op basis van betekenis, niet alleen recentheid. Een gebruiker die drie maanden geleden een vergelijkbaar probleem besprak, krijgt dat nu terug, ook als het gesprek allang buiten de standaardgeschiedenis valt.
4. **Patroongeheugen over namen, bedrijven en thema's (nieuw, 12 augustus 2026):** ArnoBot herkent nu wanneer een naam, bedrijf of onderwerp al eerder is genoemd, ook in gesprekken die niet meer in de directe geschiedenis staan, en meldt dat expliciet ("dit is niet de eerste keer dat dit ter sprake komt"). Dit is het begin van echte patroonherkenning over de volledige relatie met een gebruiker heen, niet alleen losse gesprekken.
5. **Actieve herinnering met oplopende tussenpozen (nieuw, 12/13 augustus 2026):** als een actie na een sessie nog niet is beantwoord (via de bestaande in-app check bij het openen van het gesprek) én de gebruiker ondertussen niet zelf is teruggekomen, volgt een e-mailherinnering op dag 1, 3 en 7, opgebouwd als terughaalvraag ("weet je nog wat je actie was?") in plaats van 'm gewoon te herhalen. Daarnaast: oude onopgeloste uitdagingen die terugkomen als sparring-oefening, en een maandelijkse samenvatting van terugkerende namen/thema's. Bewust geen los overzicht op de archiefpagina, die toont uitsluitend gesprekken.

Dit hele geheugensysteem is wetenschappelijk onderbouwd vanuit de **vergeetcurve van Ebbinghaus**: zonder actieve herhaling vergeet een mens 50 tot 70 procent van nieuwe informatie binnen 24 uur. Zie `docs/SALES_BIJBEL.md` voor de volledige uitwerking van dit punt als verkoopargument.

### 3.3 Coachingsdiagnose (MSA-score)
Een gestructureerd diagnosedocument op drie dimensies: **mindset, systeem, actie**. Elke dimensie krijgt een score, een diagnosetekst en concrete ontwikkelpunten. Wordt bijgewerkt naarmate er meer gesprekken plaatsvinden. Exclusief voor Pro en Team, niet beschikbaar bij Basic (harde blokkade, geen afgeslankte versie).

### 3.4 Sparring (rollenspel-oefenmodus)
Een live oefengesprek tegen een AI-tegenstander: een lastige prospect, een sceptische CFO, of een aangepaste rol. Geen adviezen lezen, maar daadwerkelijk oefenen onder druk. Na afloop volgt een debrief met analyse van het gesprek. Beschikbaar op alle betaalde tiers, ook Basic.

### 3.5 Archief en analyses ("BIEB")
Overzicht van alle eerdere gesprekken, doorzoekbaar, met AI-gegenereerde analyses over patronen in meerdere gesprekken. Sessies kunnen gedeeld worden via een link (bijv. met een coach), en individuele gesprekken of analyses kunnen verwijderd worden.

### 3.6 Gesproken antwoorden (ArnoBot Voice)
Voor Pro- en Team-gebruikers: gesproken antwoorden in Arno's eigen stem (via ElevenLabs, Flash v2.5-model, op termijn een volledige stemkloon van Arno zelf). Spraakherkenning voor voice-invoer (OpenAI Whisper) is beschikbaar voor alle gebruikers die de microfoonknop gebruiken, ongeacht plan. Niet beschikbaar bij Basic (harde blokkade).

### 3.7 Teammodule
Voor Team-abonnees. De manager krijgt:
- **Teamoverzicht:** individuele scores van elk teamlid
- **Teamvoortgang als trend over tijd**, inclusief vroegsignalering bij stagnatie
- **AI-voorbereide agenda voor elk 1:1-gesprek**, gebaseerd op de recente activiteit van dat teamlid
- **Team Spotlight:** een collectieve analyse van het hele team, patronen die alleen zichtbaar worden op teamniveau
- **Een eigen leiderschapsaccount**, nadrukkelijk geen coachingaccount zoals teamleden krijgen, maar een eigen ruimte om te sparren over sales, organisatie en teamexecutie

**Privacygarantie, fundamenteel voor dit onderdeel:** de manager ziet nooit de inhoud van individuele gesprekken van teamleden, alleen geaggregeerde signalen. Dit lost een reëel vertrouwensprobleem op: mensen zijn niet eerlijk tegen een AI-coach als hun leidinggevende alles kan teruglezen.

### 3.8 Referralprogramma
Elke gebruiker heeft een eigen referralcode. Tegoed ontstaat alleen als de nieuw geworven gebruiker zelf voor Pro of Team kiest (niet bij Basic), en is nooit hoger dan wat de referrer zelf per maand betaalt. Werkt als korting op de volgende verlengingsbetaling, geen cashback. Toekenning gebeurt volledig handmatig door Arno.

---

## 4. Abonnementsstructuur, volledig en actueel (2026-08-11)

| | **Basic** | **Pro** | **Team** | **Elite** (niet publiek) |
|---|---|---|---|---|
| Prijs | €19/mnd jaarlijks (€228/jr), €29/mnd maandelijks | €39/mnd jaarlijks (€468/jr), €59/mnd maandelijks | €97/mnd + €49/gebruiker/mnd, of €77 + €39/gebruiker/mnd-equivalent jaarlijks (~20% korting), vanaf 3 gebruikers | €397/maand, individueel, alleen maandelijks |
| Trial | 30 dagen gratis | 30 dagen gratis | Geen aparte trial, manager start zelf als Pro | Niet van toepassing, alleen handmatig toegekend |
| Coaching (MSA-score) | Nee | Ja | Ja (elk teamlid) | Ja |
| Gesproken antwoorden | Nee | Ja | Ja | Ja |
| Teammanagerdashboard | Nee | Nee | Ja | Nee |
| Chatberichten/dag | 25 | 100 | 100 (per lid) | 100 |
| Sessiegeheugen (vorige gesprekken) | Laatste 10 | Laatste 25 | Laatste 25 | Laatste 25 |
| Extra | — | Volledig archief, uitgebreider geheugen, Android-app | Teamoverzicht, teamtrends, vroegsignalering, AI-voorbereiding 1:1's, leiderschapsaccount voor de manager | 1x/maand gesprek met Arno zelf, directe Telegram-toegang |

**Basic vs. Pro, conceptueel:** Basic is gericht op het gesprek en oefenen zelf ("boven water"), Pro voegt persoonlijke groei en diepgang toe ("onder water"). Bij Basic zijn coaching en voice geen afgeslankte versie maar een principiële nul, dat onderscheid is bewust zo gepositioneerd.

**Elite:** blijft volledig functioneel maar is sinds 10 augustus 2026 nergens meer publiek kiesbaar, alleen handmatig toe te kennen via het adminpaneel, met een capaciteitscap van 50 actieve klanten (bewust schaars gehouden vanwege Arno's eigen beschikbare tijd). Wel beschikbaar als optie binnen een Team-offerte-aanvraag: een individueel teamlid kan Elite-niveau krijgen voor een vast surplus van €338/maand bovenop het gewone Team-tarief.

**Alle betalingen lopen momenteel volledig handmatig**, voor elke tier. Er is nog geen betaalprovider (bijv. Stripe) aangesloten, dat is een bewuste, latere stap in de bouwvolgorde.

**Team, aanvraagproces:** publieke aanvraagpagina op arno.bot/team (geen inlog vereist), met bedrijfsgegevens en een live berekende prijs. Na akkoord richt Arno de toegang handmatig in.

---

## 5. Technisch fundament, op zakelijk niveau

ArnoBot is gebouwd als een moderne, schaalbare webapplicatie (Next.js), gehost op Vercel, met Supabase als database. Gebruikersauthenticatie via Clerk.

**AI-leveranciers, elk voor een specifiek doel:**
- **Anthropic (Claude):** de hoofdgesprekken, coaching-synthese, sparring, teamanalyses. Het belangrijkste model.
- **Voyage AI:** het onderliggende zoek- en geheugensysteem (semantische retrieval, zowel voor de kennisbank als voor het sessiegeheugen).
- **OpenAI (Whisper):** spraakherkenning voor voice-invoer.
- **ElevenLabs:** gesproken antwoorden voor ArnoBot Voice (Pro/Team).

Geen van deze leveranciers traint op klantdata, dit is expliciet vastgelegd en gecommuniceerd op de privacypagina.

**Beveiliging en compliance:** Row Level Security op alle gebruikerstabellen (elke gebruiker kan technisch alleen zijn eigen data bereiken, ook als er ooit een bug in de applicatielaag zou zitten), verwerkersovereenkomsten met elke leverancier, een openbaar beveiligingsdocument, en een actief onderhouden privacy-pagina. Dit is doorlopend geaudit (maandelijkse en kwartaalcheck-routine) en sinds vandaag ook deels geautomatiseerd via terugkerende geautomatiseerde controles.

**Betrouwbaarheid:** automatische dagelijkse back-ups van de database, gedeployed via Vercel met directe terugdraaimogelijkheid naar elke vorige versie.

---

## 6. Wat ArnoBot op dit moment nog NIET is (bewust, geen tekortkoming om te verzwijgen)

Voor een eerlijke, geloofwaardige presentatie, geen enkele van deze als bestaand kenmerk noemen:

- **Nog geen geautomatiseerde betaalverwerking.** Alles loopt via handmatige facturatie/registratie door Arno zelf.
- **Nog geen iOS-app.** Een Android-app (Capacitor) is in aanbouw en al aangekondigd op de prijzenpagina, iPhone nog niet.
- **Nog geen herhaalbare maandelijkse boeking voor Elite-klanten** (momenteel technisch maar één boeking ooit mogelijk).
- **Elite Member Community** (later mogelijk via Circle): nog niet gebouwd, bewust achteraan gepland.
- **"Man & Machine"-positionering** (gecertificeerde menselijke coaches naast de AI): puur een toekomstplan, geen bestaand aanbod, geen publieke vermelding.

---

## 7. Status en schaal, eerlijk

ArnoBot bevindt zich in de vroege commerciële fase. De livegang was oorspronkelijk gepland rond 1 augustus 2026, is sindsdien met een à twee maanden uitgesteld. Er is een intern vastgelegde mijlpaal bij 50 actieve gebruikers waarop een reeks infrastructurele upgrades wordt doorgevoerd (Vercel Firewall, Supabase point-in-time recovery, strengere sessietimeouts), wat aangeeft dat het product zich nu bewust nog in de opbouwfase bevindt, niet al op grote schaal draait. Dat is geen zwakte om te verbergen in een presentatie, het is de eerlijke huidige status, en past bij een productverhaal van "zorgvuldig gebouwd voordat het opgeschaald wordt", niet "haastig live gezet".

---

## 8. Roadmap, kort

Niet uitputtend, de belangrijkste bekende vervolgstappen:
- Verdere uitbouw van het patroongeheugen en de vergeetcurve-herinnering (sectie 3.2) naarmate er meer gebruiksdata is om op te bouwen: de mechanismen zijn live, het effect wordt pas goed zichtbaar bij meer gebruiksgeschiedenis
- Android-app afronden, iOS op termijn
- Betaalprovider aansluiten voor geautomatiseerde facturatie op alle tiers
- Herhaalbare Elite-boekingen, Elite Member Community
- Mogelijk: gecertificeerde menselijke coaches naast de AI ("Man & Machine")

---

## 9. Bronnen binnen dit project

Voor wie dieper wil: `docs/SALES_BIJBEL.md` (verkoopargumenten), `docs/PRICING_DECISIONS.md` (volledige onderbouwing van elk prijsbesluit), `docs/ABONNEMENTEN.md` (actuele status van de abonnementsstructuur), `docs/TECHNICAL_HANDOVER.md` (volledige technische documentatie), `docs/BUSINESS_HANDOVER.md` (bedrijfsoverdracht-documentatie).

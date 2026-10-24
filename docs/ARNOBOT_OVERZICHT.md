# ArnoBot — volledig productoverzicht

**Laatst bijgewerkt:** 2026-09-16
**Doel van dit document:** een volledig, actueel beeld van ArnoBot als product en bedrijf, voor gebruik buiten de dagelijkse ontwikkelwerkzaamheden (bijv. upload naar NotebookLM voor een presentatie, briefing van nieuwe teamleden, gesprekken met investeerders of partners). Vult `docs/SALES_BIJBEL.md` aan: dat document behandelt waaróm een klant koopt (USP's, unique buying reasons), dit document behandelt wát ArnoBot precies is, in volle breedte.

**Belangrijk voor gebruik in een presentatie:** dit document bevat alleen wat daadwerkelijk gebouwd en geverifieerd is tegen de code, op de datum hierboven. Waar iets gepland maar niet live is, staat dat er expliciet bij. Neem geen enkel cijfer of kenmerk over zonder dat onderscheid, dat voorkomt dat een presentatie iets belooft wat nog niet bestaat.

---

## 1. Wat is ArnoBot

ArnoBot is een AI-coach voor salesprofessionals, bereikbaar op **arno.bot**. Gebruikers voeren doorlopende gesprekken over hun werk (klantgesprekken, deals, pipeline, eigen gedrag), ArnoBot stelt vragen, reflecteert terug, en bouwt na verloop van tijd een profiel van de gebruiker op. Na meerdere gesprekken genereert de app een coachingrapport met scores op drie dimensies: mindset, systeem en actie.

Het is geen generieke AI-assistent met een sales-laagje. Het is gebouwd op de eigen methodiek, toon en persoonlijkheid van **Arno Diepeveen**, oprichter van Royal Dutch Sales, als schaalbaar verlengstuk van zijn eigen coachingswerk. De stem is direct, zonder omwegen, bewust niet corporate.

- **Live URL:** https://arno.bot
- **Bedrijf:** ArnoBot, eenmanszaak (KvK 42184446)
- **Oprichter:** Arno Diepeveen
- **Bezoekadres:** Verdunplein 17, 5627 SZ Eindhoven, Nederland

---

## 2. Doelgroep

Nederlandstalige salesprofessionals en salesmanagers, voornamelijk in B2B. Het meest typische profiel: een zelfstandige verkoper of accountmanager bij een mkb-bedrijf, die wil verbeteren maar geen tijd of budget heeft voor een persoonlijke salescoach.

Voor managers bestaat een teammodule: zij zien de voortgang van hun verkopers en krijgen automatisch een voorbereide agenda voor 1:1-gesprekken, zonder ooit de losse gesprekken van een teamlid zelf te kunnen lezen.

---

## 3. Kernfunctionaliteit, volledig

### 3.1 Het hoofdgesprek
De basisinteractie: een doorlopend chatgesprek met ArnoBot over sales-onderwerpen. Reageert met vragen, spiegelt terug, verwijst waar relevant naar Arno's eigen kennisbank (blogartikelen, video's) via een zoekmechanisme op de achtergrond. Antwoordlengte instelbaar (kort/normaal/uitgebreid, sinds 2026-09-15 is "uitgebreid" Pro-only: Basic-gebruikers zien de knop met een PRO-badge en een upsell naar /bot/doorgaan). Documentupload mogelijk voor gebruikers die een concreet document (bijv. een offerte) willen laten meekijken.

**Eigen plannen: harde grens (nieuw, 22 oktober 2026).** ArnoBot schrijft geen volledig plan, presentatie of rapport voor de gebruiker uit of om. Een plan dat ArnoBot schrijft is niet van de gebruiker, en eigenaarschap bepaalt of het wordt uitgevoerd. ArnoBot is een coach, geen taalmodel dat output voorschotelt. In plaats daarvan weigert het kort, legt het waarom uit en stelt het vragen: hoeveel komt van jou zelf, is het plan bedoeld om te groeien of om goedgekeurd te worden, hoeveel van de plannen van de afgelopen drie jaar zijn gehaald, bleef het vorige plan levend. Daarna geeft het input op de zwakste punten en kan het per onderdeel een voorstel doen, alleen op verzoek en nooit het hele plan. De taal is rolbewust: Mindset, Systeem en Actie voor verkopers en solopreneurs, Strategy, People en Execution voor leidinggevenden en CEO/DGA. Een mening of feedback op een plan mag wel. Mails, brieven en scripts naar klanten vallen hier niet onder (ArnoBot onderzoekt eerst wat je ermee wilt bereiken). Wat de gebruiker over eigen plannen vertelt wordt als feit onthouden en gebruikt in analyses en coaching. Bij een gewone adviesvraag kiest ArnoBot één richting in plaats van een draaiboek voor elke situatie, en vraagt het door als het advies van jouw situatie afhangt. Wordt een lang antwoord door de lengtegrens afgekapt, dan gaat het automatisch verder waar het stopte.

### 3.2 Geheugen over gesprekken heen (kern-differentiator)
Dit is het meest technisch uitgebreide onderdeel van het product en vandaag (12 augustus 2026) nog verder uitgebouwd. Drie, inmiddels vier lagen:

1. **Directe actie-opvolging:** elk gesprek eindigt met één concrete actie voor de gebruiker. Bij het volgende gesprek checkt ArnoBot actief of die actie is uitgevoerd, en benoemt het rechtstreeks als het antwoord niet klopt met wat er nu gezegd wordt. Geen slap "hoe ging het", een directe confrontatie met eerder gedrag, gedreven vanuit oprechte betrokkenheid, niet controle. **Uitgebreid (13 augustus 2026):** ArnoBot herkent ook reflexief "ja, gedaan" klikken (klik-snelheid gecombineerd met het patroon over tijd) en vraagt dan een korte toelichting in plaats van de klik zomaar te accepteren, zodat zelfrapportage niet zomaar te gamen is.
2. **Samenvattingen en feiten uit eerdere gesprekken:** concrete details (namen, bedrijven, cijfers, situaties) die een gebruiker eerder deelde, komen automatisch terug als achtergrondcontext, zonder dat de gebruiker ze opnieuw hoeft uit te leggen.
3. **Semantische retrieval buiten het recente venster (nieuw, 12 augustus 2026):** de twee lagen hierboven keken alleen naar de laatste 10 (Basic) of 25 (Pro/Team) gesprekken. Sinds vandaag zoekt ArnoBot ook actief in oudere, buiten dat venster vallende gesprekken naar content die relevant is voor de huidige vraag, op basis van betekenis, niet alleen recentheid. Een gebruiker die drie maanden geleden een vergelijkbaar probleem besprak, krijgt dat nu terug, ook als het gesprek allang buiten de standaardgeschiedenis valt.
4. **Patroongeheugen over namen, bedrijven en thema's (nieuw, 12 augustus 2026):** ArnoBot herkent nu wanneer een naam, bedrijf of onderwerp al eerder is genoemd, ook in gesprekken die niet meer in de directe geschiedenis staan, en meldt dat expliciet ("dit is niet de eerste keer dat dit ter sprake komt"). Dit is het begin van echte patroonherkenning over de volledige relatie met een gebruiker heen, niet alleen losse gesprekken.
5. **Actieve herinnering met oplopende tussenpozen (nieuw, 12/13 augustus 2026):** als een actie na een sessie nog niet is beantwoord (via de bestaande in-app check bij het openen van het gesprek) én de gebruiker ondertussen niet zelf is teruggekomen, volgt een e-mailherinnering op dag 1, 3 en 7, opgebouwd als terughaalvraag ("weet je nog wat je actie was?") in plaats van 'm gewoon te herhalen. Daarnaast: oude onopgeloste uitdagingen die terugkomen als sparring-oefening, en een maandelijkse samenvatting van terugkerende namen/thema's. Bewust geen los overzicht op de archiefpagina, die toont uitsluitend gesprekken.

Dit hele geheugensysteem is wetenschappelijk onderbouwd vanuit de **vergeetcurve van Ebbinghaus**: zonder actieve herhaling vergeet een mens 50 tot 70 procent van nieuwe informatie binnen 24 uur. Zie `docs/SALES_BIJBEL.md` voor de volledige uitwerking van dit punt als verkoopargument.

### 3.3 Coachingsdiagnose (MSA-score)
Een gestructureerd diagnosedocument op drie dimensies: **mindset, systeem, actie**. Elke dimensie krijgt een score, een diagnosetekst en concrete ontwikkelpunten. Wordt bijgewerkt naarmate er meer gesprekken plaatsvinden. Exclusief voor Pro en Team, niet beschikbaar bij Basic (harde blokkade, geen afgeslankte versie).

Bovenaan de coachingpagina staat een **"thought of the day"**: één korte, inspirerende mindsetgedachte per dag, bedoeld om even bij stil te staan, niet als taak. In het weekend altijd algemeen (over het vak en het bestaan van een salesprofessional, geen techniek). Doordeweeks sluit de gedachte aan op de eigen gesprekspatronen, maar pas vanaf drie gevoerde gesprekken. Daaronder is de gedachte bewust algemeen, omdat er te weinig basis is om iets persoonlijks te zeggen dat ook klopt.

### 3.4 Sparring (rollenspel-oefenmodus)
Een live oefengesprek tegen een AI-tegenstander: een lastige prospect, een sceptische CFO, of een aangepaste rol. Geen adviezen lezen, maar daadwerkelijk oefenen onder druk. De tegenstander kan het gesprek ook zelf afronden (akkoord, hard nee, of het loopt dood), net als een echte koper. Na afloop volgt een debrief met analyse van het gesprek. Beschikbaar op alle betaalde tiers, ook Basic, en ook voor een teammanager (die kiest dan de "salesbaas"-personacategorie: een underperformer, de eigen CEO, een boze grote klant).

### 3.5 Analyses
Overzicht van alle eerdere gesprekken, doorzoekbaar, met AI-gegenereerde analyses over patronen in meerdere gesprekken. Sessies kunnen gedeeld worden via een link (bijv. met een coach), en individuele gesprekken of analyses kunnen verwijderd worden.

Sinds 22 oktober 2026: de analyse ziet alleen wat in de gesprekken staat en beweert niets over wat de gebruiker daarbuiten doet. Een gebruiker beïnvloedt de analyse via de opvolgvragen in ArnoBot (is de vorige actie gedaan), niet via een eigen invoerveld. De analyse gebruikt ( de eigen antwoorden op "is de vorige actie gedaan" en wat de gebruiker over eigen plannen vertelde. De mail "Je analyses zijn bijgewerkt" opent direct de nieuwste analyse, ook na inloggen.

### 3.6 Gesproken antwoorden (ArnoBot Voice)
Voor Pro- en Team-gebruikers: gesproken antwoorden in Arno's eigen stem (via ElevenLabs, Flash v2.5-model, op termijn een volledige stemkloon van Arno zelf). Spraakherkenning voor voice-invoer (OpenAI Whisper) is beschikbaar voor alle gebruikers die de microfoonknop gebruiken, ongeacht plan. Niet beschikbaar bij Basic (harde blokkade).

### 3.7 Teammodule
Voor Team-abonnees. De manager krijgt op zijn teampagina:
- **Teamoverzicht:** individuele scores van elk teamlid, doorklikbaar naar een volledig lidprofiel
- **Teamvoortgang als trend over tijd** (mindset/systeem/actie, teambreed gemiddeld)
- **AI-voorbereide agenda voor elk 1:1-gesprek**, gebaseerd op de recente activiteit van dat teamlid
- **Eigen 1:1-ritme, per teamlid uitgesplitst:** hoeveel 1:1's per teamlid in de laatste 30 dagen en omgerekend per week, zodat direct zichtbaar is wie achterblijft, niet alleen een teambreed totaal
- **1:1 Meetings-overzicht (22 augustus 2026):** teambreed totaal 1:1's in de laatste 30 dagen, dekking (hoeveel teamleden hadden in de afgelopen 7 dagen minstens één 1:1) en het aantal openstaande 1:1-acties (nog geen terugkoppeling), zodat in één oogopslag zichtbaar is wie gemist wordt en wat er nog moet gebeuren
- **Team Spotlight:** een collectieve AI-analyse van het hele team (kracht, groeikans, concreet advies), die sinds 21 augustus 2026 ook teambrede thema-patronen duidt: welk gespreksonderwerp domineert, of dat wijst op verdieping of op vastzitten, en of een verschuiving tussen thema's een natuurlijke voortgang is of een teken van afleiding. Bewust geen los cijferblokje ernaast, een patroon zonder duiding bleek geen bruikbare informatie voor een manager.
- **Proactieve 1:1-cadans-bewaking (24 augustus 2026):** blijft een teamlid langer dan twee weken zonder 1:1, dan krijgt de manager eerst een belletje op zijn teampagina, en bij aanhoudende inactiviteit twee opvolgende e-mails. Voorkomt dat het 1:1-ritme stilletjes wegzakt zonder dat de manager het merkt.

**Coaching voor de manager zelf (herzien, 22 augustus 2026):** een teambaas verkoopt zelf niet en wordt dus nooit op mindset/systeem/actie gescoord (zie 3.3). Op dezelfde coachingpagina die een verkoper ziet, krijgt een bevestigde teambaas in plaats daarvan zijn eigen volwaardige coachingservaring langs drie andere lijnen, afkomstig uit Verne Harnish' Scaling Up-methode: **Strategy** (vertaalt hij de bedrijfsstrategie naar een helder plan voor zijn team), **People** (heeft hij de juiste mensen op de juiste plek en ontwikkelt hij ze), **Execution** (brengt zijn team plannen daadwerkelijk tot resultaat). Score, drie pijlerdiagnoses, drie ontwikkelpunten (elk getagd op pijler, sinds 22 augustus 2026), een voortgangstekst, een progressiegrafiek, een doorbladerbaar archief van eerdere metingen en een PDF-download, gebaseerd op zijn eigen 1:1's met zijn team, teamresultaten én zijn eigen gesprekken met ArnoBot. Dezelfde pagina, andere inhoud, afhankelijk van wie er kijkt.

**Privacygarantie, fundamenteel voor dit onderdeel:** de manager ziet nooit de inhoud van individuele gesprekken van teamleden, alleen geaggregeerde signalen. Dit lost een reëel vertrouwensprobleem op: mensen zijn niet eerlijk tegen een AI-coach als hun leidinggevende alles kan teruglezen.

### 3.8 Referralprogramma
Elke gebruiker heeft een eigen referralcode. Tegoed ontstaat alleen als de nieuw geworven gebruiker zelf voor Pro of Team kiest (niet bij Basic), en is nooit hoger dan wat de referrer zelf per maand betaalt. Werkt als korting op de volgende verlengingsbetaling, geen cashback. Toekenning gebeurt volledig handmatig door Arno.

### 3.9 Gebruiksbalans (nieuw, 28 augustus 2026)
Een statuskader onder de hero op de hoofdpagina (alleen desktop/laptop, niet in de mobiele app), zichtbaar vanaf 5 gesprekken totaal. Toont de vier tellers (gesprekken, sparsessies, analyses, coachings) en wijst naar de bouwsteen die op dit moment het meest waardevol zou zijn om te proberen: sparren, analyseren of coachen. De aanbeveling is rolbewust: een leidinggevende rol krijgt structureel minder snel een sparadvies dan een verkoper die zelf klantgesprekken voert. Bepaald door een AI-classificatie die na elk afgesloten gesprek en na elke afgeronde sparsessie opnieuw meekijkt (profiel, wat er net gebeurd is, huidige tellers), niet door een simpele "laagste getal wint"-rekensom. Sinds 5 oktober 2026 staat in het kader geen vaste zin meer, maar een persoonlijk advies van maximaal twee zinnen, gebaseerd op de eigen historie: de thema's van recente gesprekken, de laatste sparsessie, de coaching-ontwikkelpunten en, bij een teamlid, het thema dat de collega's op dit moment bezighoudt. Bij sparren stelt het kader ook een scenario voor (welke tegenpartij, hoe zware weerstand), en de knop opent het sparscherm met dat scenario al ingesteld. Het advies is uitnodigend van toon, nooit kritisch, en wordt vernieuwd na elk afgesloten gesprek en elke afgeronde sparsessie. Lukt het genereren niet, dan valt het kader terug op de vaste tekst per situatie. Bij een al goede, rolpassende balans blijft het kader gewoon weg. Bij coaching als aanbeveling krijgen Basic-gebruikers een upgradeknop naar Pro in plaats van een directe link, coaching zelf is Basic niet beschikbaar (zie 3.3).

### 3.10 Publieke blog met abonnees (nieuw, 10 en 11 oktober 2026)
ArnoBot heeft een eigen publieke blog op arno.bot/blog, voor iedereen leesbaar zonder account, onder de titel ArnoBot Best Practices: nieuwe functionaliteiten en hoe je ArnoBot voor je laat werken. Artikelen worden geschreven en gepubliceerd in de adminomgeving (tab POSTS): een editor in Markdown met live voorbeeld, afbeeldingen plakken of slepen, een omslagafbeelding, hashtags, en direct publiceren of inplannen. Het archief op de blogpagina is doorzoekbaar op hashtag en trefwoord, en elke hashtag heeft een eigen pagina.

**Abonneren.** Bezoekers vullen hun e-mailadres en voornaam in en abonneren zich altijd op alle artikelen. Aanmelden verloopt via double opt-in: één klik op de link in de bevestigingsmail is genoeg en brengt de bezoeker terug op de blog. Wie zich opnieuw aanmeldt terwijl hij al op de lijst staat, krijgt een mailtje dat hij al is aangemeld. Afmelden kan altijd met één klik. Wie is aangemeld, ziet het abonneerformulier niet meer. Blogmails komen van een apart afzenderadres (mail.arno.bot), zodat ze de betalings- en trialmails niet kunnen verstoren, en bij publicatie gaat een mail naar alle bevestigde abonnees binnen een dagbudget. Harde bounces en spamklachten worden automatisch afgemeld.

**Delen en vindbaarheid.** Onder elk artikel staan knoppen om te delen via WhatsApp, LinkedIn of een gekopieerde link, en elk artikel heeft een eigen deelkaart (titel, merk en hashtags) die in LinkedIn, WhatsApp en Slack als voorbeeld verschijnt. Elk artikel eindigt met een route naar de gratis trial, en klikken daarop tellen mee in de bestaande funnel. Er is een RSS-feed. Voor zoekmachines is de blog nog niet opengezet, dat gebeurt met de eerste echte post.

**Meten.** In de statistieken (tab BLOG) staan de abonnees (bevestigd, pending, afgemeld, bevestigingspercentage), de groei per maand, de verzending, hoe vaak blogs zijn geopend en hoe vaak daarna op Start gratis is geklikt, een lijst met de meest en minst geopende blogs (30 dagen of totaal), en de aanmeldingen zelf met een CSV-download. Per abonnee wordt gemeten of een mail is geopend en waarop is geklikt; dat staat in de privacyverklaring, en de gegevens worden niet voor marketing gebruikt.

---

## 4. Abonnementsstructuur, volledig en actueel (2026-08-11)

| | **Basic** | **Pro** | **Team** |
|---|---|---|---|
| Prijs | €19/mnd jaarlijks (€228/jr), €29/mnd maandelijks | €39/mnd jaarlijks (€468/jr), €59/mnd maandelijks | €97/mnd + €49/gebruiker/mnd, of €77 + €39/gebruiker/mnd-equivalent jaarlijks (~20% korting), vanaf 3 gebruikers |
| Trial | 30 dagen gratis | 30 dagen gratis | Geen aparte trial, manager start zelf als Pro |
| Coaching (MSA-score) | Nee | Ja | Ja (elk teamlid) |
| Gesproken antwoorden | Nee | Ja | Ja |
| Uitgebreide antwoorden | Nee (upsell-badge) | Ja | Ja |
| Teammanagerdashboard | Nee | Nee | Ja |
| Chatberichten/dag | 25 | 100 | 100 (per lid) |
| Sessiegeheugen (vorige gesprekken) | Laatste 10 | Laatste 25 | Laatste 25 |
| Extra | — | Volledig archief, uitgebreider geheugen, Android-app | Teamoverzicht, teamtrends, vroegsignalering, AI-voorbereiding 1:1's, leiderschapsaccount voor de manager |

**Basic vs. Pro, conceptueel:** Basic is gericht op het gesprek en oefenen zelf ("boven water"), Pro voegt persoonlijke groei en diepgang toe ("onder water"). Bij Basic zijn coaching en voice geen afgeslankte versie maar een principiële nul, dat onderscheid is bewust zo gepositioneerd.

**Elite (individueel, €397/maand):** verwijderd uit het systeem op 25 augustus 2026, bevestigd 0 actieve klanten. Binnen een Team-offerte-aanvraag kan een individueel teamlid nog wel Elite-niveau krijgen voor een vast surplus van €338/maand bovenop het gewone Team-tarief, dat is een losstaande, nog levende optie, geen relatie meer met een bestaand individueel Elite-abonnement.

**Betalingen:** de online betaalflow is gebouwd op Mollie (iDEAL, creditcard, Bancontact) en Moneybird (facturen), en staat klaar achter een schakelaar: met een testsleutel kunnen alleen de eigenaar en interne testaccounts afrekenen, zolang er geen live-sleutel is lopen betalingen voor echte klanten handmatig. Bij de livegang geldt: particulieren (Basic en Pro) betalen maandelijks automatisch en lopen door tot ze opzeggen, net als zakelijke klanten; een jaarabonnement als particulier stopt na een jaar en krijgt dan een mail met de vraag om te verlengen. Zakelijke klanten hebben een opzegtermijn van één maand. Particulieren hebben 14 dagen bedenktijd en krijgen dan het volledige bedrag terug; zakelijk geen terugbetaling. Particulier betaalt het getoonde bedrag inclusief btw, zakelijk het getoonde bedrag plus 21%. Na elke betaling maakt ArnoBot automatisch een factuur in Moneybird. Team blijft voorlopig per factuur, met een Mollie-betaallink als volgende stap.

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

- **Online betalen staat nog niet open voor gebruikers.** Betalen via Mollie en facturen via Moneybird zijn gebouwd en in testmodus end-to-end getest, maar de livesleutel is nog niet gewisseld. Tot die tijd loopt het afrekenen voor gebruikers via handmatige facturatie en registratie door Arno zelf.
- **Nog geen iOS-app.** Een Android-app (Capacitor) is in aanbouw en al aangekondigd op de prijzenpagina, iPhone nog niet.
- **Nog geen herhaalbare maandelijkse boeking voor Team-Elite-teamleden** (momenteel technisch maar één boeking ooit mogelijk).
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
- Herhaalbare Team-Elite-boekingen, Elite Member Community
- Mogelijk: gecertificeerde menselijke coaches naast de AI ("Man & Machine")

---

## 9. Bronnen binnen dit project

Voor wie dieper wil: `docs/SALES_BIJBEL.md` (verkoopargumenten), `docs/PRICING_DECISIONS.md` (volledige onderbouwing van elk prijsbesluit), `docs/ABONNEMENTEN.md` (actuele status van de abonnementsstructuur), `docs/TECHNICAL_HANDOVER.md` (volledige technische documentatie), `docs/BUSINESS_HANDOVER.md` (bedrijfsoverdracht-documentatie), `docs/TEAM_PLAN.md` (volledige bouwgeschiedenis en openstaande besluiten van de teammodule, met de reden achter elke keuze).

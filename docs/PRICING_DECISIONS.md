# ArnoBot Pricing — Beslissingen

Dit document legt de definitieve pricing structuur vast. Doel: voorkomen dat deze keuzes opnieuw ter discussie komen. Wijzigingen hier alleen na expliciet nieuw besluit van Arno.

## Tiers en bedragen

### Basic
- €19/maand bij jaarbetaling (€228/jaar totaal)
- €29/maand bij maandelijkse betaling
- 30 dagen gratis proberen

**Features:**
- Dagelijks sparren met ArnoBot
- Eén gespreksanalyse per dag
- Geheugen over je recente gesprekken

### Pro
- €39/maand bij jaarbetaling (€468/jaar totaal)
- €59/maand bij maandelijkse betaling
- 30 dagen gratis proberen
- Copy-patroon: "Alles van Basic, plus:"

**Features (bovenop Basic), volgorde besloten 2026-08-02:**
- Onbeperkt chatten en oefenen
- Uitgebreider gespreksgeheugen
- Volledig archief van al je output
- Coaching op mindset, systeem en actie
- Gesproken antwoorden, Arno's stem
- De ArnoBot-app (Android)

### Team
- €97/maand vast bedrag (platformtarief voor de manager laag)
- **+ €49 per gebruiker/maand** (niet degressief, geen staffelkorting, vaste formule)
- Vanaf 3 gebruikers
- **Uitsluitend maandelijks opzegbaar. Geen jaaroptie.**
- **Geen aparte trial.** De manager start zelf als individuele Pro-gebruiker (30 dagen gratis) en upgradet later naar Team wanneer hij zijn team wil meenemen. Deze upgrade-flow moet functioneel bestaan in de app (zie open punt onderaan).
- **Facturatie voorlopig handmatig** (bevestigd 2026-08-02), net als Basic/Pro nu al werken (geen payment provider aangesloten). Geen aparte, uitgebreide aanvraagflow met factuurgegevens/KvK/btw meer zoals de oude Command-staffel had, dat vervalt samen met de staffel zelf. Zodra er een payment provider is aangesloten, wordt dit voor alle tiers tegelijk geautomatiseerd, niet Team als eerste of enige uitzondering.
- Copy-patroon: "Alles van Pro, plus:", geldt per teamlid (elk teamlid krijgt volledige Pro-functionaliteit)

**Features (bovenop Pro, per teamlid):**
- Teamoverzicht: individuele scores
- Teamvoortgang als trend over tijd
- Vroeg signaal bij stagnatie
- AI-voorbereiding voor elke 1:1
- Volledig 1:1 archief met eigen notities

**Exclusief voor de manager (niet voor teamleden):**
- Eigen leiderschapsaccount: eigen ruimte om te sparren over sales, organisatie en executie van het team. Dit is nadrukkelijk **geen coachingaccount** (de manager wordt niet gecoacht zoals een teamlid), het is een leiderschapsinstrument. **Op de prijzenkaart zelf (besloten 2026-08-02) staat deze bullet als eerste** van de zes, vóór "Teamoverzicht: individuele scores", ondanks dat de kaart zelf geen visueel onderscheid maakt tussen manager-exclusieve en per-teamlid features (blijft één platte lijst, zie hierboven).
- Privacy garantie: managers zien nooit de inhoud van individuele gesprekken van teamleden, alleen geaggregeerde signalen die ertoe doen. Deze toelichting hoort thuis op de losstaande `/team` pagina, niet in de prijzenkaart zelf.

## Waarom deze bedragen zo zijn gekozen

- **Team-seat (€49) vs. solo Pro maandelijks (€59):** lichte volumekorting bij gelijk commitment niveau (beide maandelijks opzegbaar, geen jaarverplichting). Bewust géén korting t.o.v. de jaarlijkse solo-prijs (€39), want dat zou minder commitment (Team, maandelijks) belonen met een lagere prijs dan meer commitment (solo, jaarlijks), omgekeerde SaaS-logica.
- **Waarom geen jaaroptie bij Team:** teamgrootte fluctueert (aannames, vertrek), maandelijkse flexibiliteit is functioneel relevanter voor deze doelgroep dan een jaarkorting.
- **Waarom €97 basistarief:** dit is niet een aparte "platformfee" los van gebruik, het is de eigen Pro-waarde van de manager (€59, want hij krijgt zelf ook alles van Pro) plus €38 opslag voor de manager-exclusieve laag: teamoverzicht, teamvoortgang-trends, vroegsignalering, AI-voorbereiding voor 1:1's en het leiderschapsaccount. Ter vergelijking: een teamlid betaalt €49 voor uitsluitend zijn eigen Pro-toegang, zonder die manager-laag. De opslag van €38 voor een volledig extra functionaliteitslaag is daarmee eerder behoudend dan overdreven geprijsd.
- **Waarom geen aparte Team-trial:** teamdata opbouwen kost weken, een aflopende trial zou net op het waardevolle moment data laten "verdwijnen". De impliciete trial (manager begint solo als Pro) lost dit al op zonder omzet weg te geven aan een segment dat toch al laagdrempelig maandelijks kan op- en afzeggen.

**Eén regel per bullet (besloten 2026-08-02):** elke feature-bullet moet in de kaartlay-out op één regel passen, niet uitwrappen naar een tweede regel. Reden: bij ongelijke regelaantallen per bullet ontstaat een rommelig, ongelijkmatig ritme tussen de drie kaarten. Bij het herzien van te lange bullets altijd eerst proberen te verkorten zonder de kern te verliezen, pas als dat niet lukt de inhoud zelf aanpassen (zoals bij "onbeperkt" hierboven).

**"Maandelijks opzegbaar." vervangt "Elke maand op te zeggen" (besloten 2026-08-02):** geldt voor de maandelijkse variant van de Basic/Pro-billingnote (getoond bij de maandelijks-stand van de jaar/maand-toggle).

## UI-gedrag

- **Eén gedeelde jaar/maand-toggle** boven Basic en Pro. Niet twee losse toggles per kaart, dat zou oneerlijke kruisvergelijkingen mogelijk maken (bijv. Basic maandelijks naast Pro jaarlijks).
- **Team reageert niet op de toggle**, blijft altijd hetzelfde bedrag tonen. **Herzien (2026-08-02):** de eerdere subtekst onder de toggle ("Geldt voor Basic en Pro. Team is altijd maandelijks.") is bewust verwijderd, Arno vond het overbodig naast de kaarten zelf.
- **Basic-bullets lijnen rij-voor-rij uit met Pro/Team** (besloten 2026-08-02, herzien): eerste poging (`flex: 1; justify-content: space-between`, bullets over de hele hoogte verspreiden) bleek fout, dat trekt Basic's 3 items juist scheef t.o.v. de rijen van Pro/Team in plaats van gelijk. Teruggedraaid naar gewone vaste regelafstand (`gap: 10px`, elke bullet `min-height: 21px`). Omdat alles boven de bullet-lijst (kop, prijsblok, "ALLES VAN X"-label) al gelijke hoogte heeft, liggen rij 1/2/3 daardoor vanzelf op dezelfde hoogte bij alle drie de kaarten, Basic heeft simpelweg geen rij 4-6.
- **Team-kaart toont geen prijsdetails/staffel**, alleen het basisbedrag + per-gebruiker bedrag. CTA linkt door naar `arno.bot/team` voor verdere toelichting (privacy, rekenvoorbeelden, leiderschapsaccount uitleg).
- Geen kwantificering van jaarbesparing in copy (geen "bespaar X maanden"), bedragen kunnen wijzigen, tekst zou dan achterhaald raken. Toggle communiceert het voordeel puur door het bedrag zelf te tonen.
- **Pagina-eyebrow (besloten 2026-08-02):** het amber label bovenaan de hero (`app/prijzen/page.tsx`) is "Tarieven", niet "Prijzen".

## Feature-taal: logica

Kwalificatieve, relatieve taal in plaats van kale getallen (Grok/ChatGPT-stijl), om twee redenen: (1) voorkomt dat copy moet meebewegen bij elke backend-capwijziging, (2) voorkomt dat kopers puur op kwantiteit gaan vergelijken in plaats van op coaching waarde. De bullets zelf staan hierboven onder "Tiers en bedragen", niet hier herhaald, om te voorkomen dat de twee plekken uit elkaar gaan lopen bij een toekomstige wijziging.

Onderliggende thema's per tier: Basic is gesprek/rollenspel gericht ("boven water" in de ijsberg metafoor), Pro is persoonlijke groei gericht ("onder water"). Het coachingdocument was aanvankelijk bewust de eerste bullet bij Pro als sterkste onderscheid met Basic; op 2026-08-02 heeft Arno de volgorde losgekoppeld van die redenering en expliciet een andere volgorde gekozen (zie de bullet-lijst hierboven), coaching staat nu op de vierde plek.

Onderliggende technische realiteit (niet op de pagina tonen, wel intern vastgelegd zodat copy waarachtig blijft):
- Chatberichten: Basic 25/dag, Premium/Elite/Team 100/dag (4x)
- Sessiegeheugen: Basic 10 vorige gesprekken, Premium 25 (2,5x)
- Voice: geen maandelijkse cap voor betalende gebruikers op dit moment (alleen 30 voice-berichten/uur rate-limit tegen misbruik). Trial-gebruikers: 50.000 tekens cap.
- Coaching synthese (`/coaching`, mindset/systeem/actie-scores): exclusief Premium+, Basic krijgt 403.
- Team: erft alle Pro-functionaliteit (bevestigd), inclusief coachingdocument.

(De plan-waarden `premium`/`elite` hierboven zijn de huidige interne/database-namen vóór de Basic/Pro-hernoeming is doorgevoerd in de code, zie het open punt hieronder.)

**Bewust gekozen woord "onbeperkt" bij Pro (besloten 2026-08-02):** de Pro-bullet "Onbeperkt chatten en oefenen" is strikt genomen niet letterlijk waar, er zit een dagelijkse cap van 100 berichten achter (zie hierboven). Bewust geaccepteerd door Arno omdat (1) het functioneel als onbeperkt aanvoelt voor normaal gebruik, en (2) een preciezere formulering niet op één regel paste, wat een harde eis was voor de kaartlay-out (zie "Eén regel per bullet" hieronder).

## ArnoBot app-vermelding (besloten 2026-08-02, herzien)

**Bewust vooruitlopend op de pricing pagina gezet**, omslag ten opzichte van de eerdere "niet vooruitlopend communiceren"-regel hieronder. Arno's expliciete afweging: de Android-app (Capacitor) is "al bijna geregeld", dat risico is klein genoeg om nu al te communiceren. Bullet bij Pro: "De ArnoBot-app (Android)", bewust zonder iPhone te noemen omdat die nog niet in zicht is. Team krijgt geen aparte appbullet, dat valt al onder "Alles van Pro, plus:" (Team erft alle Pro-functionaliteit, zie hierboven), een losse vermelding zou juist suggereren dat het iets aparts is in plaats van iets dat al inbegrepen is.

Oorspronkelijke, nu ingehaalde overweging (bewaard als context): de eerdere regel was juist om dit pas te communiceren zodra de app daadwerkelijk live is, om te voorkomen dat de pricing pagina iets belooft dat een nieuwe Pro-koper op dag één niet kan gebruiken. Die afweging staat, Arno heeft 'm bewust opzijgezet voor dit specifieke geval.

## Database-waarde `plan`: blijft `basis`/`premium` (besloten 2026-08-02)

`approved_users.plan` blijft intern `"basis"`/`"premium"` (geen migratie, geen CHECK-constraint-wijziging, geen code-aanpassing op de honderden plekken die op deze waarde checken). Alleen de naar buiten getoonde tekst wordt Basic/Pro, dat staat los in de pagina's zelf. Zelfde patroon als Team: de database zegt nog steeds `"team"`, ongeacht of de marketingnaam "Command" of "Team" was/is.

**Waarom:** optie B (database-waarden ook omzetten naar `basic`/`pro`) vereist een echte migratie van bestaande gebruikersrijen plus het bijwerken van elke plek in de code die op `plan` checkt, puur voor een woordwijziging zonder functionele meerwaarde. Meer werk, meer risico op een moment waarop database en code niet synchroon lopen. Optie A (huidige aanpak) is al bewezen bij Team/Command.

## Trial-standaard: bestaande aanpak blijft (bevestigd 2026-08-02)

Elke nieuwe gebruiker krijgt bij aanmelden nog steeds `plan='premium'` als trial, ongeacht welke kaart (Basic/Pro/Team) hij aanklikt op `/prijzen` (alle "Start nu"-knoppen linken nu al naar dezelfde generieke `/sign-up`, geen tier-specifieke registratie). Iedereen proeft dus de volledige Pro-ervaring tijdens de 30 dagen, en kiest pas definitief bij `/bot/doorgaan`. Geen wijziging nodig, dit is al hoe het werkt voor Premium/Elite en blijft zo voor Basic/Pro/Team.

## `/prijzen` live gezet (2026-08-02)

`app/prijzen/PrijzenClient.tsx` en `app/prijzen/page.tsx` (metadata) zijn bijgewerkt naar de Basic/Pro/Team-driekolom uit dit document, getest in de browser (toggle, Pro-uitlichting, Team blijft vast). Bewust **niet** meegenomen in deze stap, blijft open voor een vervolgronde:

- **`app/bot/doorgaan/DoorgaanClient.tsx`**: neemt volgens `ABONNEMENTEN.md` letterlijk dezelfde bullets/prijzen/toggle over van `/prijzen`, loopt nu dus uit de pas met de nieuwe pagina.
- **Koppeling aan `lib/kostenTarieven.ts`**: `/prijzen` hardcodet de bedragen nog zelf, verwijst niet naar `TARIEVEN.prijsBasisEur`/`prijsPremiumEur` (die al wel op 29/59 staan). Twee plekken die uit elkaar kunnen lopen bij een volgende prijswijziging.
- **`lib/email-templates.ts` + `QAClient.tsx`** (referral-FAQ): bevatten nog oude bedragen/namen.
- **`/command`**: bestaande publieke aanvraagpagina (staffelprijs, factuurgegevens, "vraag een demo aan"), nog niet besloten of die verdwijnt/redirect of blijft bestaan naast de nieuwe self-serve Team-instap.
- **Wekelijkse Team Spotlight-bullet**: staat nog op de oude live Command-kaart, ontbreekt in de bullet-set hierboven. Nog niet besloten of die terugkomt.
- **Voice-cap fase 2:** momenteel geen maandelijkse limiet voor betalende gebruikers. Zodra er ooit wel een cap wordt gebouwd (nog niet gepland), moet de "Gesproken antwoorden" bullet bij Pro opnieuw beoordeeld worden.
- **Verifiëren, niet aannemen:** bestaat de upgrade flow van individuele Pro-trial naar Team al in de app (facturatie overgang, teamleden uitnodigen vanuit bestaand Pro-account, meenemen van de manager's eigen gespreksdata)? Zo niet, dit toevoegen aan de Deel B werklijst.
- Referentie implementatie (visueel/structureel prototype): conceptartefact "ArnoBot: Prijzen (concept)".

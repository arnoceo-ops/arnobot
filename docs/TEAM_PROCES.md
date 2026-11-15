# Team: het volledige proces

**Laatst bijgewerkt:** 2026-11-15

**Waar we staan:** het hele proces is gebouwd: van binnenkomst, proef en coulance, zelf activeren en leden tot en met de opzegregel voor Team (einddatum volgens artikel 7, blokkade en stop van de facturatie op die dag, intrekken tot de dag ervoor). Zelf activeren is op prod getest met het testaccount (activeren, factuur, betaallink). De opzegregel is gebouwd en met tests gedekt maar nog niet op prod doorlopen. De SQL-kolom `arnobot_teams.stopt_op` is op 2026-11-15 door Arno uitgevoerd.

**Eerstvolgende stap:** de opzegregel Team een keer doorlopen met het testaccount (opzeggen, einddatum zien, intrekken).

Dit document beschrijft het hele leven van een team, van de eerste aanmelding tot het einde, en wat er in elk scenario gebeurt. Het begon als een checklist voor het onboarden van een klant (`TEAM_ONBOARDING.md`) en een overzicht van scenario's (`TEAM_LEVENSCYCLUS.md`); beide zijn hierin opgegaan. Waar het niet over gaat: wat een team kan en de coaching zelf staat in `docs/TEAM_PLAN.md` en `docs/ARNOBOT_OVERZICHT.md` (3.7 Teammodule), de tarieven en voorwaarden in `docs/ABONNEMENTEN.md`, de sales agents in `docs/SALES_DEVELOPMENT.md`, een jaarabonnement dat Team wordt in `docs/SOLO_JAAR_NAAR_TEAM.md`, de betaalprovider in `docs/MOLLIE_PLAN.md`.

## Het verloop in zes fasen

1. **Binnenkomst:** via een agent-link (gratis proef) of via het aanvraagformulier (handmatig).
2. **Gratis proef en coulance** (alleen via een agent-link): dag 0 tot 30 proef, dag 30 tot 40 coulance, dag 40 blokkade.
3. **Activeren:** de manager zet zijn team zelf om naar betaald, of jij richt het in.
4. **Betaald:** facturen, herinneringen, blokkeren en deblokkeren.
5. **Leden:** uitnodigen, joinen, verwijderen, en wat een lid ziet als zijn team geblokkeerd is.
6. **Einde:** opzeggen en het team stoppen.

## Fase 1. Binnenkomst

**Route A, via een agent-link** (`/aanmelden?sd=<token>`, `docs/SALES_DEVELOPMENT.md`). De manager krijgt bij het aanmaken van zijn account `command_manager = true` en `sd_agent` (de koppeling voor de commissie), en kan direct een team maken en leden uitnodigen. Alleen deze route heeft een proef. Er is nog nooit iemand via een agent-link binnengekomen.

**Route B, via het aanvraagformulier** (`/team/aanvragen`). Geen proef: het team eindigt alleen via betaling of door jou. Het inrichten is een bewust besluit: handmatig, blijvend (`docs/ABONNEMENTEN.md`, "Team-aanvraagflow"). De stappen:

| # | Wie | Wat | Waar |
|---|---|---|---|
| 1 | Klant | Vult het aanvraagformulier in: bedrijfsnaam, KvK, BTW-nummer, factuuradres, aanvrager, aantal gebruikers (minimaal 3), maandelijks of jaarlijks. | `/team/aanvragen` |
| 2 | Automatisch | De aanvraag wordt opgeslagen in `arnobot_command_requests` (met het `user_id` als de aanvrager was ingelogd). Mail naar `arno@arno.bot` met knop naar de adminpagina, plus een Telegram-melding "Nieuwe Team-aanvraag". | `app/api/team-aanvraag/route.ts` |
| 3 | Arno | Beoordeelt de aanvraag, gesprek of demo, akkoord op prijs. | buiten de app |
| 4 | Arno | Zoekt de aanvrager op (op e-mailadres), zet `command_manager = true` en het plan (zoals beschreven in `docs/ABONNEMENTEN.md`). Doe dit pas na akkoord, zie "Let op". De schakelaars staan in de kolommen TEAM en PLAN op `/bot/admin/gebruikers` (elke wijziging komt in het logboek LAATSTE ADMINACTIES op `/bot/admin/status`, onder de geplande crons), Supabase is niet nodig. | `/bot/admin/gebruikers` |
| 5 | Teambaas | Maakt het team aan met een teamnaam. Hij wordt automatisch manager en krijgt een uitnodigingscode. | app, route `/api/bot/team/create` |
| 6 | Teambaas | Nodigt de teamleden uit met de uitnodigingslink. | `/bot/team/join?code=<uitnodigingscode>` |
| 7 | Arno | Zodra het team bestaat verschijnt het op de adminpagina. Vul in: **min. seats**, **cyclus**, **volgende factuurdatum** (de startdatum) en de **bedrijfsgegevens** (naam, KvK, BTW-nummer, adres). Opslaan. | `/bot/admin/teams` |
| 8 | Automatisch | De dagelijkse cron (05:10 UTC) maakt op de factuurdatum de factuur in Moneybird (14 dagen betaaltermijn, per mail naar de teambaas met de factuur als bijlage en de betaallink) en een tweede mail van ArnoBot met een betaalknop. | `/api/cron/team-facturatie` |
| 9 | Teambaas | Betaalt via de link (iDEAL, kaart, Bancontact). | Mollie |
| 10 | Automatisch | De webhook zet de factuur op betaald, lettert de betaling af in Moneybird en heft een eventuele blokkade op. Telegram: "Team-factuur betaald". | `/api/webhooks/mollie-team` |

### Teambaas met een zakelijk solo-maandabonnement (sinds 2026-11-12)

Heeft de teambaas al een online zakelijk maandabonnement, dan loopt de solo-incasso anders naast de Team-factuur door. Doe stap 7 dan met de knop **SOLO NAAR TEAM** onder het formulier van het team (eerst min. seats en cyclus invullen, de factuurdatum volgt vanzelf):
1. Het voorbeeld toont de einddatum, het Team-bedrag excl. BTW en wat er gebeurt. De server controleert alles opnieuw bij BEVESTIG.
2. De Mollie-incasso stopt direct, het solo-abonnement loopt door tot het einde van de betaalde maand en het Team start op die datum. De teambaas krijgt een mail.
3. Ligt de volgende incasso binnen 4 dagen, dan weigert de actie: doe hem na die incasso, het Team start dan een periode later.
4. Daarna kan de teambaas zijn solo-abonnement niet meer opzeggen of intrekken (dat zou zijn toegang of het Team kapotmaken); opzeggen van het Team kan na de ingangsdatum.
5. Valt de actie halverwege uit (Telegram-melding), voer hem dan opnieuw uit: die hervat.

Alleen zakelijk maandelijks. Voor een jaarabonnement of particulier: `docs/SOLO_JAAR_NAAR_TEAM.md`.

## Fase 2. Gratis proef en coulance (alleen via een agent-link)

| Dag | Wat er gebeurt |
|---|---|
| 0 tot 25 | Gewone proef. Op de accountpagina van de manager staat bovenaan het kader TEAMPROEF met de resterende dagen en de knop TEAM ACTIVEREN. |
| 25 | Telegram aan jou: de proef loopt bijna af, tijd voor het gesprek. |
| 30 | De gratis proef is voorbij. De manager krijgt een mail "Activeer je team binnen 10 dagen" met een knop naar zijn accountpagina. Het kader toont "TEAMPROEF AFGELOPEN, NOG X DAGEN". Het team houdt toegang. Telegram aan jou. |
| 40 | Het team blokkeert (manager en leden). Het kader wordt rood: "PROEF AFGELOPEN". Telegram aan jou. |

Activeren kan op elk moment, ook na de blokkade.

**Waarom een eigen cron** (`/api/cron/team-proef`, dagelijks 07:50 UTC). Zonder die cron eindigt de proef nooit: de toegangspoort (`proxy.ts`) laat iemand met `command_manager = true` binnen zolang zijn team niet geblokkeerd is, en de proefmails slaan managers en teamleden over. De cron:
- waarschuwt jou via Telegram 5 dagen van tevoren;
- stuurt op dag 30 eenmalig de mail `team_proef_coulance` (dedupe via `nieuwMelden`, met de einddatum in de sleutel) en blokkeert op dag 40 het team. Had de manager nog geen team gemaakt, dan trekt hij `command_manager` in;
- raakt een team nooit aan zodra de facturatie is ingesteld (stap 7, min. seats gevuld) of de aanmelding niet via een agent-link kwam;
- blokkeert nooit automatisch als de manager zelf betaalt (dat kan een klant zijn), maar meldt je dan wel dat het team geen facturatie heeft en gratis meeloopt. Dit is de valkuil: wie op `/bot/doorgaan` alleen voor zichzelf betaalt, houdt zijn eigen toegang, maar betaalt daarmee niet voor zijn team.

**Verlengen kan altijd:** op `/bot/admin/teams` staat bij zo'n team de einddatum, met een datumveld en de knop VERLENG PROEF. Die zet de einddatum van de manager later en heft een blokkade door het einde van de proef op, ook na het einde. Een gezette einddatum gaat voor op de 30 dagen. Zodra de klant akkoord is: stap 7 invullen, dan is het geen proef meer.

## Fase 3. Activeren

### Zelf activeren door de manager (sinds 2026-11-15)

**Wat de manager ziet** (`/bot/account`, blok TEAM, `app/bot/account/TeamActiverenSectie.tsx`): de proefstatus en de knop **TEAM ACTIVEREN**. Het individuele abonnement (plan, overstappen, opzeggen) verdwijnt voor zo'n manager. Het formulier vraagt het aantal gebruikers (minimaal 3, standaard het ledenaantal), maandelijks of jaarlijks, en de bedrijfsgegevens met dezelfde regels als afrekenen (`lib/billing/zakelijk.ts`: KvK 8 cijfers, Nederlands btw-nummer, adres). Het toont de eerste factuur en vraagt akkoord op de voorwaarden. Een geblokkeerde manager komt via `/bot/doorgaan` vanzelf op deze pagina (die stuurt door), want `/bot/account` is een pagina die ook zonder toegang bereikbaar is. In de Android-app is het blok verborgen (betalingsbeleid Google Play).

**Wat BEVESTIG doet** (`lib/teamActivatie.ts`, `POST /api/bot/team/activeren`): bewaart de bedrijfsgegevens, zet min. seats, cyclus en volgende factuurdatum (vandaag), **heft de blokkade op**, maakt de eerste factuur met Mollie-betaallink en Moneybird-factuur (dezelfde als de cron, `maakTeamFactuur`) en meldt jou via Telegram "Team geactiveerd door de manager zelf", met een regel in het adminlogboek (TEAM GEACTIVEERD, met cyclus, aantal gebruikers en bedrijf). Het team wordt atomair geclaimd (min. seats moet nog leeg zijn): twee klikken tegelijk maken één factuur. Daarna is het geen proef meer (`isAgentProef` is onwaar) en loopt alles als bij elk team.

**Bewuste keuze, let op:** het team wordt gedeblokkeerd bij het activeren, niet pas bij betalen. Wie activeert maar nooit betaalt, heeft dus ongeveer 44 dagen toegang voordat de bestaande blokkade hem raakt. Dat is gelijk aan elke andere teamfactuur. Wil je dat anders, dan is de aanpassing: de blokkade laten staan tot de webhook een betaling meldt.

**Niet gedekt:** een manager met een agent-link die zelf al betaalt (`paid_at`) kan hier niet activeren (het blok verschijnt niet). Dat is de "Controle nodig"-melding, die loopt nog handmatig.

**Testen** (`/bot/admin/gebruikers`, onder PLAN): de knoppen TEAMPROEF zetten het testaccount als manager in een agent-proef in een eigen testteam "Proefteam (test)" (nooit Team Apex): LOPEND, BIJNA VOORBIJ, COULANCE, VOORBIJ EN GEBLOKKEERD, UIT, en twee standen voor een betaald team om de opzegregel te zien: BETAALD (EINDE PERIODE OVER 40 DAGEN, opzeggen is op tijd) en BETAALD (EINDE PERIODE OVER 10 DAGEN, te laat, een periode later). De cron stopt een testteam nooit: het echte stoppen op de einddatum is alleen met tests gedekt. Het plan gaat op Pro, zoals bij een echte proef. De oorspronkelijke waarden van het account (ook het plan) worden bewaard en komen terug met UIT of met een persona-knop. Het testteam telt niet mee in omzet, statistieken, teamlijst en crons en krijgt geen Moneybird-factuur. Betalen kan alleen veilig met een `test_`-Mollie-sleutel; met een live-sleutel loop je tot en met de betaallink, maar betaal je niet. Wordt het niet meer gebruikt, dan kunnen de knoppen weg (`lib/testTeamproef.ts`, `/api/admin/test-teamproef`).

## Fase 4. Betaald

- **Volgende cycli:** de cron maakt elke maand (of jaar) zelf een nieuwe factuur op `volgende_factuurdatum`.
- **Aantal seats op de factuur:** het werkelijke aantal leden in het team, nooit onder het minimum dat je hebt ingesteld. Nep- en interne testaccounts tellen niet mee.
- **Jaarlijks team dat een seat toevoegt:** de cron maakt eenmalig een tussenfactuur naar rato voor de nieuwe seats (alleen als er al een eerdere factuur bestaat). Seats eraf onder het minimum kan alleen jij in de admin.
- **Niet betaald:** factuur met 14 dagen betaaltermijn, 7 dagen na de vervaldatum een herinnering, 30 dagen na de vervaldatum wordt het team geblokkeerd (manager en leden verliezen toegang die alleen via het team loopt, hun eigen betaalde toegang blijft). Telegram-melding en een mail aan de teambaas. Leden krijgen geen mail.
- **Deblokkeren:** automatisch bij betaling, of met de knop DEBLOKKEER op `/bot/admin/teams`. Een gedeblokkeerd team is meteen weer binnen, want de poort controleert live.
- **Handmatig blokkeren (sinds 2026-11-14):** de knop BLOKKEER op `/bot/admin/teams` (met een tweede klik ter bevestiging) zet de toegang van het hele team uit. Elke wijziging komt in het adminlogboek.
- **Stand per team (sinds 2026-11-14):** boven elk team op `/bot/admin/teams` staat het aantal leden, de seats waarop gefactureerd wordt, het bedrag excl. btw en de dagen tot de volgende factuur (rood als die te laat is, oranje onder 7 dagen).

## Fase 5. Leden

**Joinen.** Een lid komt binnen via `/bot/team/join?code=...` en krijgt het plan van het team (Pro). Maximaal 25 leden per team: de join weigert daarna, en jij krijgt een Telegram bij 20 leden (eenmalig per team) en als iemand wordt geweigerd (hooguit één keer per week per team). Testteams melden niet. Het aanvraagformulier laat meer seats toe (bijvoorbeeld 140 medewerkers): bij een grotere klant is een aanpassing nodig vóór de uitnodigingen.

**Iemand met een eigen abonnement of proef accepteert de uitnodiging.** Op de uitnodigingspagina staat vooraf: "Je gesprekken en historie blijven van jou, ook als je lid wordt en als je het team later verlaat. Vanaf nu betaalt je team: een eigen abonnement loopt uit tot het einde van je betaalperiode (geen restitutie) en een lopende proef vervalt." Bij accepteren stopt de Mollie-incasso en vervalt de proef automatisch (`lib/billing/teamlidSolo.ts`), en jij krijgt een Telegram, ook als het stoppen mislukt. Hij blijft hetzelfde account, dus de gesprekshistorie blijft. Een handmatig betaald lid (BETAALD gezet, zonder online abonnement) heeft geen incasso om te stoppen: dat meldt de Telegram. Heeft hij een jaarabonnement met nog minstens twee maanden looptijd, dan noemt de Telegram ook de resterende looptijd en het bedrag naar rato incl. btw, zodat jij kunt beslissen over een deelrestitutie uit coulance (zie Besluiten).

**Lid wordt verwijderd door de manager** (VERWIJDER UIT TEAM). Het lidmaatschap verdwijnt direct en zonder bericht. Zijn plan wordt gelijk aan een eigen abonnement dat nog loopt (`lib/teamLid.ts`, ook een opgezegd abonnement met een betaalperiode in de toekomst, bijvoorbeeld dat dat bij het joinen is gestopt), en blijft anders zoals het is. Heeft hij geen eigen abonnement en geen proefdagen meer (die vervielen bij het joinen), dan moet hij zelf een abonnement nemen. Zijn gesprekken en historie blijven van hem. Een lid kan niet zelf uit het team stappen, behalve door zijn account te laten verwijderen.

**Lid van een geblokkeerd team.** Bij zijn volgende klik landt hij op `/bot/doorgaan`, met bovenaan "Het teamabonnement van [team] is niet actief. Vraag je teammanager het team te activeren, of kies hieronder zelf een abonnement" en daaronder de gewone Basic- en Pro-keuze. Op zijn accountpagina staat bovenaan het kader TEAM NIET ACTIEF met de knop KIES EEN ABONNEMENT. Hij mag zelf een abonnement nemen en dat ook zelf opzeggen (`isTeamDekkingActief` in `lib/teamAccess.ts`, `heeftEigenAbonnement` in `lib/teamLid.ts`). Wordt het team later weer actief, dan loopt zijn eigen abonnement gewoon door tot hij opzegt. Een lid krijgt geen mail bij blokkeren of heractiveren.

## Fase 6. Einde

**De manager zegt het team op** (accountpagina, TEAMABONNEMENT OPZEGGEN). Nu: alleen een opzegdatum op het account en een mail aan jou, met de waarschuwing dat je de toegang van de leden zelf moet beëindigen. De facturatiecron kijkt niet naar opzeggen, dus er blijven facturen komen, ook voor een geblokkeerd team.

**De opzegregel voor Team (gebouwd 2026-11-15, `lib/teamOpzegging.ts`).** Dezelfde regel als bij zakelijke Basic en Pro (artikel 7 van de voorwaarden: opzegtermijn één maand vóór het einde van de lopende betaalperiode, anders loopt het een periode door; de berekening is `opzeggingIngaat`):
- de manager klikt TEAMABONNEMENT OPZEGGEN; de server berekent de einddatum uit de volgende factuurdatum en zet die in `arnobot_teams.stopt_op` (SQL: `docs/sql/2026-11-15-team-stopt-op.sql`). De einddatum telt tot het einde van die dag: opzeggen precies een maand ervoor is nog op tijd. De manager ziet "Je team stopt op [datum]" op zijn accountpagina en krijgt een bevestigingsmail met dezelfde datum; jij krijgt een mail met de einddatum (zonder de waarschuwing om de leden zelf te beëindigen, want dat gaat automatisch) en een regel in het adminlogboek (TEAM OPGEZEGD). De link "Per ongeluk particulier besteld" onder de opzegknop staat er alleen voor wie een te corrigeren particulier abonnement heeft (`KlanttypeCorrectieLink`), dus nooit voor een manager;
- tot die datum houden manager en leden toegang;
- de manager kan de opzegging intrekken tot en met de dag vóór de einddatum (knop OPZEGGING INTREKKEN, `POST /api/bot/team/opzegging-intrekken`); de server controleert de datum;
- op de einddatum stopt de cron `team-facturatie` het team: blokkeren en de volgende factuurdatum leegmaken, dus geen nieuwe factuur meer. Tussenfacturen voor extra seats komen ook niet meer. Jij krijgt een Telegram en een regel (TEAM GESTOPT). `stopt_op` blijft bewaard als spoor;
- een late betaling van een oude factuur zet een gestopt team niet weer open (`ontblokkeerNaBetaling`); alleen DEBLOKKEER in de admin doet dat;
- een team zonder facturatie (handmatig beheerd) heeft geen automatische einddatum: dan blijft het bij de mail aan jou;
- dit is meteen het opheffen van een team: er komt geen losse verwijderfunctie. Team en leden blijven in de database staan; op `/bot/admin/teams` staat "Opgezegd door de manager: stopt op [datum]".

**Account van de manager wordt verwijderd:** alleen een mail aan jou. Het team blijft staan en blijft factureren. **Manager verlaat het bedrijf:** er is geen overdracht naar een nieuwe manager, alleen met SQL.

## Scenario's in één tabel

| Scenario | Wat er gebeurt | Status |
|---|---|---|
| Proef loopt af, manager activeert op tijd | Geen onderbreking. | Gebouwd |
| Proef loopt af, manager doet niets | Dag 30 mail, dag 40 blokkade. | Gebouwd |
| Team te laat betaald | Herinnering, na 30 dagen blokkade, deblokkeren bij betaling. | Gebouwd |
| Team geblokkeerd, manager betaalt of activeert | Direct gedeblokkeerd, leden zijn meteen weer binnen. | Gebouwd |
| Lid van geblokkeerd team | Melding op `/bot/doorgaan` en kader op zijn accountpagina, mag zelf een abonnement nemen. | Gebouwd |
| Lid van geblokkeerd team neemt zelf een abonnement | Behandeld als gewone gebruiker, kan zelf opzeggen. | Gebouwd |
| Lid wordt verwijderd | Lidmaatschap weg, plan gelijk aan eigen lopend abonnement, historie blijft van hem. | Gebouwd |
| Eigen abonnement of proef, uitnodiging geaccepteerd | Incasso stopt (geen restitutie), proef vervalt, historie blijft. | Gebouwd |
| Manager zegt het team op | Einddatum volgens artikel 7, toegang tot die dag, blokkade en stop facturatie op die dag. Intrekken kan tot de dag ervoor. | Gebouwd, nog niet op prod doorlopen |
| Team opheffen | Hetzelfde als de opzegregel. | Gebouwd |
| Meer dan 25 leden | Join weigert, jij krijgt een Telegram. | Gebouwd |
| Seats erbij | Maandelijks automatisch, jaarlijks een tussenfactuur. | Gebouwd |
| Account van de manager verwijderd | Alleen een mail aan jou. | Open, handmatig |
| Manager verlaat het bedrijf | Geen overdracht. | Open |

## Let op

1. **`command_manager = true` geeft al toegang**, ook zonder dat er een team of een betaling is (`proxy.ts`). Zet het dus pas na akkoord.
2. **Facturatie start pas bij stap 7** (of bij zelf activeren). Zonder min. seats, cyclus en factuurdatum slaat de cron het team over. Het team kan dan gewoon werken zonder dat er ooit een factuur komt. Vergeet stap 7 niet.
3. **Teamtoegang hangt niet af van `paid_at`.** Toegang loopt via het lidmaatschap en `command_manager`, en stopt alleen bij een blokkade. Of `paid_at` bij een Team nog gezet moet worden voor de administratie is niet uitgezocht; het staat nog zo in `docs/ABONNEMENTEN.md`.
4. **Teambaas moet een ArnoBot-account hebben** om `command_manager` te kunnen krijgen. De aanvraag koppelt het `user_id` alleen als de aanvrager ingelogd was. Anders zoek je hem op e-mailadres op.
5. **Het mailadres van de teambaas** is waar de factuur, de betaallink, de herinnering en de blokkademail naartoe gaan (het adres in `approved_users`).
6. **Enterprise-klanten met eigen inlog (SSO, domeinbinding):** aanvullende stappen staan in de lijst "Corporate accounts" (`arnobot_teams.domain`, Clerk Pro, SAML of OIDC).
7. **Een team-aanvraag is geen automatische betaalopdracht.** Het formulier geeft een prijs en een mail, geen account en geen factuur.

## Besluiten en verworpen alternatieven

- **Zelf activeren door de manager** (2026-11-15). Gekozen: knop TEAM ACTIVEREN op de accountpagina, alleen voor een agent-proef (teams via het aanvraagformulier blijven handmatig), seats volgen daarna automatisch het ledenaantal. Verworpen: een mail met een offerte (de tekst klopte niet en het proces ook niet), en `/bot/doorgaan` ombouwen voor teams. Deblokkeren gebeurt bij het activeren, niet pas bij betalen.
- **Coulance van 10 dagen** (2026-11-15). Gekozen: dag 30 mail en kader, dag 40 blokkade. Verworpen: blokkeren op dag 30, want de manager heeft dan een gat terwijl hij nog niets gehoord heeft.
- **Leden van een geblokkeerd team** (2026-11-15). Gekozen: een lid mag zelf een abonnement nemen en opzeggen. Verworpen: een lid laten wachten op de manager, of een lid zelf uit het team laten stappen (grote wijziging, raakt teamdata en rapporten).
- **Iemand met een eigen abonnement of proef die een team joint** (2026-11-15, besluit Arno). Gekozen: bij accepteren van de uitnodiging stopt de volgende betaling automatisch (geen restitutie, de lopende betaalperiode loopt uit) en vervalt een lopende proef met de resterende dagen. De toestemming is de knop om te joinen, met de uitleg erboven. Verworpen: alleen een Telegram aan jou plus een kader voor het lid (eerder gekozen), want dan betaalt hij dubbel tot iemand ingrijpt. Gevolg: wordt het team later geblokkeerd of verwijdert de manager hem, dan heeft hij geen eigen abonnement of proefdagen meer en moet hij zelf een abonnement nemen.
- **Plan bij het verwijderen van een lid** (2026-11-15). Gekozen: het plan wordt gelijk aan een eigen abonnement dat nog loopt, anders niets. Reden: bij het joinen kreeg hij het plan van het team, zonder deze stap houdt hij Pro-functies voor een lagere prijs.
- **Team opheffen** (2026-11-15). Gekozen: geen losse verwijderfunctie, het is de opzegregel (einddatum, blokkade, stop facturatie).
- **Opzegging intrekken** (2026-11-15, op advies). Gekozen: de manager kan tot en met de dag vóór de einddatum intrekken, zoals bij een solo-abonnement. Redenen: er is tot die dag niets gestopt en de facturatie loopt door, en een manager die zich vergist kan het herstellen. Na de einddatum niet meer.
- **Restitutie voor een solo-lid met een jaarabonnement** (2026-11-15, besluit Arno). Wie een jaarabonnement heeft en lid wordt van een team, verliest de resterende looptijd zonder restitutie (voorwaarden). Dat kan oneerlijk voelen als hij het team zelf heeft binnengehaald, bijvoorbeeld doordat hij zijn manager overtuigde. Gekozen: handmatig uit coulance, per geval door Arno, via het Mollie-dashboard, als het zich voordoet. De Telegram bij het joinen noemt daarvoor de resterende looptijd en het bedrag naar rato (`restantNaarRato` in `lib/billing/teamlidSolo.ts`). Verworpen: automatisch naar rato terugbetalen (nieuwe functie: deelrestitutie bij Mollie en een deel-creditnota in Moneybird, en het besluit zou dan voor altijd vastliggen). De bestaande terugbetaalknop in de admin (`/api/admin/refund`) is er niet voor: die betaalt de volledige laatste betaling terug en beëindigt de toegang.
- **Mail aan leden bij blokkeren of heractiveren:** bewust niet gebouwd. Besluit bij het eerste echte team.
- **Mail aan de manager bij het einde van de proef:** gebouwd als de coulance-mail op dag 30, na goedkeuring van de tekst.

## Bekende gaten

- `/api/chat` controleert de einddatum of blokkade niet zelf, alleen de pagina's doen dat. Wie een verzoek zelf samenstelt, kan doorchatten. Geldt voor elke verlopen gebruiker, niet alleen teamleden.
- Of een verlenging van een eigen abonnement het plan van een verwijderd lid later opnieuw zet, is niet nagelopen.
- Een lid wordt niet op de hoogte gebracht van een blokkade of verwijdering, behalve door het scherm bij zijn volgende klik.
- De manager ziet de proefstatus alleen op zijn accountpagina (en krijgt de mail op dag 30), niet in een balk in de app.
- Een koppeling tussen de aanvraag en het team op de adminpagina ontbreekt (nu "match zelf op e-mailadres").

## Test en bewijs

Getest en goedgekeurd op 2026-11-04 (testmodus, testteam Apex): reguliere factuur, tussentijdse jaarfactuur voor een extra seat, betaling via de link (iDEAL), afletteren in Moneybird, herinnering, blokkade en deblokkade, alle bijbehorende mails en Telegram-meldingen. Gevonden en gefixt: zie `docs/MOLLIE_PLAN.md`. Op 2026-11-15 is zelf activeren met het testaccount doorlopen op prod (stand lopend, bijna voorbij, voorbij; activeren met factuur, betaallink, mail, Telegram en logboek). Niet getest met echt geld: een Team-factuur in live-modus, inclusief de Moneybird-mail met factuur als bijlage (het testteam maakt die bewust niet). De eerste echte activering is dus de eerste live teamfactuur: controleer dan of die mail aankomt. Ook de knop SOLO NAAR TEAM (2026-11-12) is alleen met tests gedekt en nog niet op een echte zakelijke solo-klant gedraaid: lees bij het eerste geval eerst het voorbeeld, en controleer daarna de Telegram-melding en in de database dat het solo-abonnement op `cancelled` staat met als einddatum `periode_einde` en dat het team als volgende factuurdatum dezelfde dag heeft.

## Afvinklijst

- [x] Agent-proef eindigt automatisch, verlengen kan altijd
- [x] Coulance van 10 dagen met mail en kader
- [x] Manager activeert zelf op de accountpagina
- [x] Blok TEAM bovenaan de accountpagina, testknoppen TEAMPROEF
- [x] Telegram bij 20 leden en bij een geweigerde join
- [x] Eigen abonnement stopt en proef vervalt bij het accepteren van een teamuitnodiging
- [x] Leden van een geblokkeerd team mogen zelf een abonnement nemen en opzeggen
- [x] Plan gelijk aan het eigen abonnement bij het verwijderen van een lid
- [x] SQL `stopt_op` uitgevoerd (Arno, 2026-11-15)
- [x] Opzegregel Team: einddatum, blokkade en stop van de facturatie, intrekken tot de dag ervoor
- [ ] Opzegregel Team een keer doorlopen op prod met het testaccount
- [x] Restitutie solo-lid met jaarabonnement: handmatig uit coulance, de Telegram toont de looptijd en het bedrag naar rato
- [ ] Melding aan de manager buiten de accountpagina (balk in de app)

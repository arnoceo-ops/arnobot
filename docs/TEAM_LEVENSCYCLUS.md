# Levenscyclus van een team

**Laatst bijgewerkt:** 2026-11-15

**Waar we staan:** het traject van agent-proef tot betaald team is gebouwd en op prod getest met het testaccount (activeren, factuur, betaallink). De coulance van 10 dagen na de proef is gebouwd. Gebouwd: een lid met een eigen abonnement of proef verliest die bij het accepteren van de uitnodiging (uitleg vooraf, Telegram aan jou). Ook gebouwd: leden van een geblokkeerd team mogen zelf een abonnement nemen en opzeggen, en het plan van een verwijderd lid wordt gelijk aan zijn eigen abonnement. Besloten maar nog niet gebouwd: de opzegregel voor Team (einddatum, blokkade en stop van de facturatie).

**Eerstvolgende stap:** de opzegregel voor Team bouwen (vraagt een SQL-kolom `arnobot_teams.stopt_op`), daarna alles samenvoegen tot `docs/TEAM_PROCES.md` (met het hernoemen van `TEAM_ONBOARDING.md`).

Dit document beschrijft het hele leven van een team, van binnenkomst tot einde, en wat er in elk scenario gebeurt. De stappen van aanvraag tot eerste factuur staan in `docs/TEAM_ONBOARDING.md`, de producteisen en het coachingdeel in `docs/TEAM_PLAN.md`, de tarieven en voorwaarden in `docs/ABONNEMENTEN.md`. Dit document verwijst daarnaartoe en herhaalt het niet.

## Het verloop in vijf fasen

**1. Binnenkomst.** Twee routes. Via een agent-link (`/aanmelden?sd=<token>`): de manager krijgt `command_manager` en een gratis proef. Via het aanvraagformulier (`/team/aanvragen`): geen proef, jij richt het handmatig in.

**2. Gratis proef (alleen via een agent-link).**
| Dag | Wat er gebeurt |
|---|---|
| 0 tot 25 | Gewone proef. Op de accountpagina van de manager staat bovenaan het kader TEAMPROEF met de resterende dagen en de knop TEAM ACTIVEREN. |
| 25 | Telegram aan jou: de proef loopt bijna af, tijd voor het gesprek. |
| 30 | De gratis proef is voorbij. De manager krijgt een mail "Activeer je team binnen 10 dagen" met een knop naar zijn accountpagina. Het kader toont "TEAMPROEF AFGELOPEN, NOG 10 DAGEN". Het team houdt toegang. Telegram aan jou. |
| 40 | Het team blokkeert (manager en leden). Het kader wordt rood: "PROEF AFGELOPEN". Telegram aan jou. |
Activeren kan op elk moment, ook na de blokkade. Jij kunt altijd verlengen met VERLENG PROEF op `/bot/admin/teams`.

**3. Betaald.** De manager activeert zelf (TEAM ACTIVEREN) of jij richt het in. Daarna loopt het als bij elk team: factuur met 14 dagen betaaltermijn, herinnering 7 dagen na de vervaldatum, blokkade 30 dagen na de vervaldatum, deblokkeren zodra de betaling binnen is. Mails over facturen gaan alleen naar de manager.

**4. Leden.** Een lid komt binnen via `/bot/team/join?code=...` en krijgt het plan van het team (Pro). Maximaal 25 leden per team. Je krijgt een Telegram bij 20 leden en als iemand wordt geweigerd. De manager kan een lid verwijderen (VERWIJDER UIT TEAM), direct en zonder bericht.

**5. Einde.** De manager kan opzeggen op zijn accountpagina. Een team blokkeert door de proef, door te late betaling, of handmatig met BLOKKEER.

## Scenario's

| Scenario | Wat er gebeurt | Status |
|---|---|---|
| Proef loopt af, manager activeert op tijd | Geen onderbreking. | Gebouwd |
| Proef loopt af, manager doet niets | Dag 30 mail, dag 40 blokkade. | Gebouwd |
| Team te laat betaald | Herinnering, na 30 dagen blokkade, deblokkeren bij betaling. | Gebouwd |
| Team geblokkeerd, manager betaalt of activeert | Direct deblokkeerd. Leden zijn meteen weer binnen. | Gebouwd |
| Lid van geblokkeerd team | Landt bij zijn volgende klik op `/bot/doorgaan`, met bovenaan "Het teamabonnement van [team] is niet actief. Vraag je teammanager het team te activeren, of kies hieronder zelf een abonnement" en daaronder de gewone Basic- en Pro-keuze. Op zijn accountpagina staat bovenaan het kader TEAM NIET ACTIEF met de knop KIES EEN ABONNEMENT. | Gebouwd |
| Lid van geblokkeerd team neemt zelf een abonnement | Mag: de checkout en `/bot/upgrade` behandelen hem dan als gewone gebruiker (`isTeamDekkingActief`). Hij kan dat abonnement ook zelf opzeggen: op zijn accountpagina staan dan de abonnementssecties. Wordt het team later weer actief, dan loopt zijn eigen abonnement gewoon door tot hij opzegt. | Gebouwd |
| Lid wordt verwijderd door de manager | Lidmaatschap weg, direct en zonder bericht. Zijn plan wordt gelijk aan een eigen abonnement dat nog loopt (ook een opgezegd abonnement met een betaalperiode in de toekomst), en blijft anders zoals het is. Heeft hij geen eigen abonnement of proefdagen meer (die vervielen bij het joinen), dan moet hij zelf een abonnement nemen. Zijn gesprekken en historie blijven van hem. | Gebouwd |
| Iemand met een eigen abonnement of proef accepteert een teamuitnodiging | Op de uitnodigingspagina staat vooraf: gesprekken en historie gaan mee en blijven van hem, een eigen abonnement stopt (betaalperiode loopt uit, geen restitutie) en een proef vervalt, ook de resterende dagen. Bij accepteren stopt de Mollie-incasso en vervalt de proef automatisch (`lib/billing/teamlidSolo.ts`). Hij blijft hetzelfde account, dus de historie blijft. Jij krijgt een Telegram, ook als het stoppen mislukt. | Gebouwd |
| Manager zegt het team op | Nu: alleen een opzegdatum en een mail aan jou, de cron blijft factureren. Besloten: dezelfde regel als bij zakelijke Basic en Pro (opzegtermijn één maand voor het einde van de betaalperiode, artikel 7 van de voorwaarden), einddatum voor de manager, leden houden toegang tot die datum, op die dag blokkeert het team en stopt de facturatie. | Besloten, nog te bouwen |
| Team opheffen | Is hetzelfde als de opzegregel hierboven. Er komt geen losse verwijderfunctie. | Besloten |
| Team met meer dan 25 leden | Join weigert, jij krijgt een Telegram. | Gebouwd |
| Seats erbij | Maandelijks automatisch, jaarlijks een tussenfactuur. | Gebouwd |
| Seats eraf onder het minimum | Alleen door jou in de admin. | Gebouwd |
| Account van de manager wordt verwijderd | Alleen een mail aan jou. Het team blijft staan en blijft factureren. | Open, handmatig |
| Manager verlaat het bedrijf | Geen overdracht naar een nieuwe manager. Alleen met SQL. | Open |

## Besluiten en verworpen alternatieven

- **Zelf activeren door de manager** (2026-11-15). Gekozen: knop TEAM ACTIVEREN op de accountpagina, alleen voor een agent-proef, seats volgen automatisch het ledenaantal. Verworpen: een mail met een offerte, en `/bot/doorgaan` ombouwen voor teams. Deblokkeren gebeurt bij het activeren, niet pas bij betalen.
- **Coulance van 10 dagen** (2026-11-15). Gekozen: dag 30 mail en kader, dag 40 blokkade. Verworpen: blokkeren op dag 30, want de manager heeft dan geen gat nodig terwijl hij nog niets gehoord heeft.
- **Leden van een geblokkeerd team** (2026-11-15). Gekozen: een lid mag zelf een abonnement nemen en opzeggen. Verworpen: een lid laten wachten op de manager, of een lid zelf uit het team laten stappen (grote wijziging, raakt teamdata en rapporten).
- **Iemand met een eigen abonnement of proef die een team joint** (2026-11-15, besluit Arno). Gekozen: bij accepteren van de uitnodiging stopt de volgende betaling automatisch (geen restitutie, de lopende betaalperiode loopt uit) en vervalt een lopende proef met de resterende dagen. Gesprekshistorie gaat mee en blijft van hem. De toestemming is de knop om te joinen, met de uitleg erboven op de uitnodigingspagina. Verworpen: alleen een Telegram aan jou plus een kader voor het lid (eerder dit gesprek gekozen), want dan betaalt hij dubbel tot iemand ingrijpt. Gevolg: wordt het team later geblokkeerd of verwijdert de manager hem, dan heeft hij geen eigen abonnement of proefdagen meer en moet hij zelf een abonnement nemen, wat de leden-optie toestaat. Een handmatig betaald lid (BETAALD gezet, zonder online abonnement) heeft geen incasso om te stoppen: dat meldt de Telegram.
- **Mail aan leden bij blokkeren of heractiveren:** bewust niet gebouwd. Besluit bij het eerste echte team.

## Bekende gaten

- `/api/chat` controleert de einddatum of blokkade niet zelf, alleen de pagina's doen dat. Wie een verzoek zelf samenstelt, kan doorchatten. Geldt voor elke verlopen gebruiker, niet alleen teamleden.
- Of een verlenging van een eigen abonnement het plan van een verwijderd lid later opnieuw zet, is niet nagelopen.
- Een lid wordt niet op de hoogte gebracht van een blokkade of verwijdering, behalve door het scherm bij zijn volgende klik.

## Afvinklijst

- [x] Agent-proef eindigt automatisch, verlengen kan altijd
- [x] Manager activeert zelf op de accountpagina
- [x] Coulance van 10 dagen met mail en kader
- [x] Telegram bij 20 leden en bij een geweigerde join
- [x] Blok TEAM bovenaan de accountpagina, testknoppen TEAMPROEF
- [x] Leden van een geblokkeerd team mogen zelf een abonnement nemen en opzeggen
- [x] Eigen abonnement stopt en proef vervalt bij het accepteren van een teamuitnodiging, met uitleg vooraf en een Telegram aan jou
- [ ] Opzegregel Team: einddatum, blokkade en stop van de facturatie (SQL `stopt_op`)
- [x] Plan gelijk zetten aan het eigen abonnement bij het verwijderen van een lid
- [ ] Melding aan de manager buiten de accountpagina (balk in de app)

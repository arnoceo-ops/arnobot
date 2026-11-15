# Levenscyclus van een team

**Laatst bijgewerkt:** 2026-11-15

**Waar we staan:** het traject van agent-proef tot betaald team is gebouwd en op prod getest met het testaccount (activeren, factuur, betaallink). De coulance van 10 dagen na de proef is gebouwd. Besloten maar nog niet gebouwd: leden van een geblokkeerd team mogen zelf een abonnement nemen, de opzegregel voor Team (einddatum, blokkade en stop van de facturatie), en de melding aan jou bij een lid met een lopend solo-abonnement.

**Eerstvolgende stap:** de besloten onderdelen hieronder bouwen, in deze volgorde: leden-optie, solo-lid melding en kader, opzegregel Team (vraagt een SQL-kolom `arnobot_teams.stopt_op`).

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
| Lid van geblokkeerd team | Ziet op `/bot/doorgaan` dat het team geen toegang heeft. Kan nog niets zelf afnemen. | Gebouwd, uitbreiding hieronder |
| Lid van geblokkeerd team neemt zelf een abonnement | Mag, en kan dat abonnement ook zelf opzeggen. Op zijn accountpagina staat een kader met de keuze. | Besloten, nog te bouwen |
| Lid wordt verwijderd door de manager | Lidmaatschap weg, direct. Eigen proef (eerste 30 dagen na aanmelding) of verlopen status. Zijn plan blijft Pro. | Gebouwd, plan terugzetten is open |
| Bestaand solo-klant joint een team | Zijn account en gesprekshistorie blijven. Zijn solo-abonnement loopt door, hij betaalt dubbel. Je krijgt een Telegram en hij ziet een kader met de keuze zijn eigen abonnement op te zeggen. Geen automatische stop. | Besloten, nog te bouwen |
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
- **Solo-klant die een team joint** (2026-11-15). Gekozen: Telegram aan jou en een kader voor het lid, geen automatische stop. Verworpen: de solo-incasso automatisch stoppen. Redenen: een jaarabonnement is al betaald en niet terug te draaien, het botst met de leden-optie (bij een geblokkeerd team heeft hij zijn eigen abonnement nodig) en het raakt iemands geld zonder zijn toestemming.
- **Mail aan leden bij blokkeren of heractiveren:** bewust niet gebouwd. Besluit bij het eerste echte team.

## Bekende gaten

- `/api/chat` controleert de einddatum of blokkade niet zelf, alleen de pagina's doen dat. Wie een verzoek zelf samenstelt, kan doorchatten. Geldt voor elke verlopen gebruiker, niet alleen teamleden.
- Een verwijderd lid houdt plan Pro (dat gaf het team bij het joinen). Of een verlenging van een eigen abonnement dat later herstelt, is niet nagelopen.
- Een lid wordt niet op de hoogte gebracht van een blokkade of verwijdering, behalve door het scherm bij zijn volgende klik.

## Afvinklijst

- [x] Agent-proef eindigt automatisch, verlengen kan altijd
- [x] Manager activeert zelf op de accountpagina
- [x] Coulance van 10 dagen met mail en kader
- [x] Telegram bij 20 leden en bij een geweigerde join
- [x] Blok TEAM bovenaan de accountpagina, testknoppen TEAMPROEF
- [ ] Leden van een geblokkeerd team mogen zelf een abonnement nemen en opzeggen
- [ ] Solo-klant die een team joint: Telegram aan jou en kader voor het lid
- [ ] Opzegregel Team: einddatum, blokkade en stop van de facturatie (SQL `stopt_op`)
- [ ] Plan terugzetten bij het verwijderen van een lid (nog te beslissen)
- [ ] Melding aan de manager buiten de accountpagina (balk in de app)

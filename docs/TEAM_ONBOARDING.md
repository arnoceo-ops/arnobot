# Team-klant onboarden: checklist

**Laatst bijgewerkt:** 2026-11-15 (coulance van 10 dagen; het volledige verloop staat in `docs/TEAM_LEVENSCYCLUS.md`)
**Doel:** de stappen van een Team-aanvraag tot de eerste betaalde factuur, zodat bij de eerste echte klant niets vergeten wordt. Het inrichten na een aanvraag via het formulier is een bewust besluit: handmatig, blijvend (zie `docs/ABONNEMENTEN.md`, "Team-aanvraagflow"). Alleen een manager van een gratis agent-proef activeert zijn team zelf (sinds 2026-11-15, zie "Zelf activeren na een agent-proef"). Dit document legt vast wat daarbij gebeurt, wat automatisch loopt en waar je op moet letten.

## De stappen

| # | Wie | Wat | Waar |
|---|---|---|---|
| 1 | Klant | Vult het aanvraagformulier in: bedrijfsnaam, KvK, BTW-nummer, factuuradres, aanvrager, aantal gebruikers (minimaal 3), maandelijks of jaarlijks. | `/team/aanvragen` |
| 2 | Automatisch | De aanvraag wordt opgeslagen in `arnobot_command_requests` (met het `user_id` als de aanvrager was ingelogd). Mail naar `arno@arno.bot` met knop naar de adminpagina, plus een Telegram-melding "Nieuwe Team-aanvraag". | `app/api/team-aanvraag/route.ts` |
| 3 | Arno | Beoordeelt de aanvraag, gesprek of demo, akkoord op prijs. | buiten de app |
| 4 | Arno | Zoekt de aanvrager op (op e-mailadres), zet `command_manager = true` en het plan (zoals beschreven in `docs/ABONNEMENTEN.md`). Doe dit pas na akkoord, zie "Let op" hieronder. De schakelaars staan in de kolommen TEAM en PLAN op `/bot/admin/gebruikers` (elke wijziging komt in het logboek LAATSTE ADMINACTIES op `/bot/admin/status` (onder de geplande crons)), Supabase is niet nodig. | `/bot/admin/gebruikers` |
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

## Wat daarna automatisch loopt

- **Volgende cycli:** de cron maakt elke maand (of jaar) zelf een nieuwe factuur op `volgende_factuurdatum`.
- **Aantal seats op de factuur:** het werkelijke aantal leden in het team, nooit onder het minimum dat je hebt ingesteld. Nep- en interne testaccounts tellen niet mee.
- **Jaarlijks team dat een seat toevoegt:** de cron maakt eenmalig een tussenfactuur naar rato voor de nieuwe seats (alleen als er al een eerdere factuur bestaat).
- **Niet betaald:** 7 dagen na de vervaldatum een herinnering, 30 dagen na de vervaldatum wordt het team geblokkeerd (manager en leden verliezen toegang die alleen via het team loopt, hun eigen betaalde of trial-toegang blijft). Telegram-melding en een mail aan de teambaas.
- **Deblokkeren:** automatisch bij betaling, of met de knop DEBLOKKEER op `/bot/admin/teams`.
- **Handmatig blokkeren (sinds 2026-11-14):** de knop BLOKKEER op `/bot/admin/teams` (met een tweede klik ter bevestiging) zet de toegang van het hele team uit. Een gratis agent-proef eindigt vanzelf (zie hieronder). Elke wijziging komt in het adminlogboek.
- **Stand per team (sinds 2026-11-14):** boven elk team op `/bot/admin/teams` staat het aantal leden, de seats waarop gefactureerd wordt, het bedrag excl. btw en de dagen tot de volgende factuur (rood als die te laat is, oranje onder 7 dagen).

### Gratis proef via een agent-link (`docs/SALES_DEVELOPMENT.md`)

Een manager die zich aanmeldt via de link van een sales agent krijgt bij het aanmaken van zijn account `command_manager = true` en `sd_agent` (de koppeling voor de commissie). Hij kan direct een team maken en leden uitnodigen (stap 5 en 6). **Niet elk team is een proef:** alleen deze route heeft er een. Een team via het aanvraagformulier heeft geen proef en eindigt alleen via betaling.

**De proef eindigt na 30 dagen, het team blokkeert na 10 dagen coulance** (sinds 2026-11-14, coulance sinds 2026-11-15, `/api/cron/team-proef`, dagelijks). Dag 30: de manager krijgt een mail "Activeer je team binnen 10 dagen" en het team houdt toegang. Dag 40: blokkade. Het hele verloop staat in `docs/TEAM_LEVENSCYCLUS.md`. Zonder die cron zou hij nooit eindigen: de toegangspoort (`proxy.ts`) laat iemand met `command_manager = true` binnen zolang zijn team niet geblokkeerd is, en de proefmails slaan managers en teamleden over. De cron:
- waarschuwt jou via Telegram 5 dagen van tevoren, voor het gesprek over een betaald Team;
- blokkeert op dag 40 het team (manager en leden verliezen de toegang die alleen via het team loopt, wat ze zelf betaald hebben blijft). Had de manager nog geen team gemaakt, dan trekt hij `command_manager` in en gelden de gewone 30 dagen;
- raakt een team nooit aan zodra de facturatie is ingesteld (stap 7, min. seats gevuld) of de aanmelding niet via een agent-link kwam;
- blokkeert ook nooit automatisch als de manager zelf betaalt (dat kan een klant zijn), maar meldt je dan wel dat het team geen facturatie heeft en gratis meeloopt. Dit is de valkuil: wie op `/bot/doorgaan` alleen voor zichzelf betaalt, houdt zijn eigen toegang, maar betaalt daarmee niet voor zijn team.

**Verlengen kan altijd:** op `/bot/admin/teams` staat bij zo'n team de einddatum, met een datumveld en de knop VERLENG PROEF. Die zet de einddatum van de manager later en heft een blokkade door het einde van de proef op, ook na het einde. Een gezette einddatum gaat voor op de 30 dagen. Zodra de klant akkoord is: stap 7 invullen, dan is het geen proef meer.

### Zelf activeren na een agent-proef (sinds 2026-11-15)

**Besluit (Arno, 2026-11-15):** de manager van een agent-proef zet zijn team zelf om naar betaald; de tarieven zijn bekend, dus er is geen offerte of gesprek nodig. Gekozen: zelf activeren op de accountpagina. Verworpen: een mail aan de manager met een offerte (de tekst klopte niet en het proces ook niet) en `/bot/doorgaan` ombouwen voor teams (die pagina is voor losse Basic of Pro). Gekozen: alleen voor een agent-proef (B), seats volgen daarna automatisch het ledenaantal zoals bij elk team (C).

**Wat de manager ziet** (`/bot/account`, blok TEAM, `app/bot/account/TeamActiverenSectie.tsx`): de proefstatus (nog X dagen, of afgelopen) en de knop **TEAM ACTIVEREN**. Het individuele abonnement (plan, overstappen, opzeggen) verdwijnt voor zo'n manager. Het formulier vraagt het aantal gebruikers (minimaal 3, standaard het ledenaantal), maandelijks of jaarlijks, en de bedrijfsgegevens met dezelfde regels als afrekenen (`lib/billing/zakelijk.ts`: KvK 8 cijfers, Nederlands btw-nummer, adres). Het toont de eerste factuur en vraagt akkoord op de voorwaarden. Een geblokkeerde manager komt via `/bot/doorgaan` vanzelf op deze pagina (die stuurt door), want `/bot/account` is een pagina die ook zonder toegang bereikbaar is. In de Android-app is het blok verborgen (betalingsbeleid Google Play).

**Wat BEVESTIG doet** (`lib/teamActivatie.ts`, `POST /api/bot/team/activeren`): bewaart de bedrijfsgegevens, zet min. seats, cyclus en volgende factuurdatum (vandaag), **heft de blokkade op**, maakt de eerste factuur met Mollie-betaallink en Moneybird-factuur (dezelfde als de cron, `maakTeamFactuur`) en meldt jou via Telegram "Team geactiveerd door de manager zelf", met een regel in het adminlogboek (TEAM GEACTIVEERD). Het team wordt atomair geclaimd (min. seats moet nog leeg zijn): twee klikken tegelijk maken één factuur. Daarna is het geen proef meer (`isAgentProef` is onwaar) en loopt alles als bij elk team: 14 dagen betaaltermijn, herinnering na 7 dagen, blokkade 30 dagen na de vervaldatum.

**Bewuste keuze, let op:** het team wordt gedeblokkeerd bij het activeren, niet pas bij betalen. Wie activeert maar nooit betaalt, heeft dus ongeveer 44 dagen toegang voordat de bestaande blokkade hem raakt. Dat is gelijk aan elke andere teamfactuur. Wil je dat anders, dan is de aanpassing: de blokkade laten staan tot de webhook een betaling meldt.

**Teamleden** van een geblokkeerd team zien op `/bot/doorgaan` "Je team heeft geen toegang, vraag je teammanager" in plaats van afrekenopties die voor hen toch niet werken (de checkout weigert teamleden).

**Niet gedekt:** een manager met een agent-link die zelf al betaalt (`paid_at`) kan hier niet activeren (het blok verschijnt niet). Dat is de "Controle nodig"-melding hierboven, die loopt nog handmatig.

**Testen** (`/bot/admin/gebruikers`, onder PLAN): de knoppen TEAMPROEF zetten het testaccount als manager in een agent-proef in een eigen testteam "Proefteam (test)" (nooit Team Apex): LOPEND, BIJNA VOORBIJ, COULANCE, VOORBIJ EN GEBLOKKEERD, UIT. Het plan gaat op Pro, zoals bij een echte proef. De oorspronkelijke waarden van het account (ook het plan) worden bewaard en komen terug met UIT of met een persona-knop. Het testteam telt niet mee in omzet, statistieken, teamlijst en crons en krijgt geen Moneybird-factuur. Betalen kan alleen veilig met een `test_`-Mollie-sleutel; met een live-sleutel loop je tot en met de betaallink, maar betaal je niet.

## Let op

1. **`command_manager = true` geeft al toegang**, ook zonder dat er een team of een betaling is (`proxy.ts`). Zet het dus pas na akkoord.
2. **Facturatie start pas bij stap 7.** Zonder min. seats, cyclus en factuurdatum slaat de cron het team over. Het team kan dan gewoon werken zonder dat er ooit een factuur komt. Vergeet stap 7 niet.
3. **Maximaal 25 leden per team** (`/api/bot/team/join`). Het aanvraagformulier laat meer seats toe (bijvoorbeeld 140 medewerkers). Bij een grotere klant is een aanpassing nodig vóór de uitnodigingen. Je krijgt een Telegram-melding zodra een team 20 leden bereikt (eenmalig per team) en als iemand wordt geweigerd omdat het team vol is (hooguit één keer per week per team). Testteams melden niet.
4. **Teamtoegang hangt niet af van `paid_at`.** Toegang loopt via het lidmaatschap en `command_manager`, en stopt alleen bij een blokkade. Of `paid_at` bij een Team nog gezet moet worden voor de administratie is niet uitgezocht; het staat nog zo in `docs/ABONNEMENTEN.md`.
5. **Teambaas moet een ArnoBot-account hebben** om `command_manager` te kunnen krijgen. De aanvraag koppelt het `user_id` alleen als de aanvrager ingelogd was. Anders zoek je hem op e-mailadres op.
6. **Het mailadres van de teambaas** is waar de factuur, de betaallink, de herinnering en de blokkademail naartoe gaan (het adres in `approved_users`).
7. **Enterprise-klanten met eigen inlog (SSO, domeinbinding):** aanvullende stappen staan in de lijst "Corporate accounts" (`arnobot_teams.domain`, Clerk Pro, SAML of OIDC).
8. **Een team-aanvraag is geen automatische betaalopdracht.** Het formulier geeft een prijs en een mail, geen account en geen factuur.

## Test en bewijs (2026-11-04, testmodus, testteam Apex)

Getest en goedgekeurd: reguliere factuur, tussentijdse jaarfactuur voor een extra seat, betaling via de link (iDEAL), afletteren in Moneybird, herinnering, blokkade en deblokkade, alle bijbehorende mails en Telegram-meldingen. Gevonden en gefixt: zie `docs/MOLLIE_PLAN.md` (betaallinks kennen geen metadata, geen `url`-veld, betaalvoorwaarden en factuurmail). Niet getest met echt geld: een Team-factuur in live-modus. Ook de knop SOLO NAAR TEAM (2026-11-12) is alleen met tests gedekt en nog niet op een echte zakelijke solo-klant gedraaid: lees bij het eerste geval eerst het voorbeeld, en controleer daarna de Telegram-melding en in de database dat het solo-abonnement op `cancelled` staat met als einddatum `periode_einde` en dat het team als volgende factuurdatum dezelfde dag heeft.

## Open punten

- Een mail aan de manager bij het einde van de proef: bewust nog niet gebouwd (tekst eerst voorleggen aan Arno). De manager ziet de proefstatus alleen op zijn accountpagina en krijgt geen melding in de app of per mail. Overweeg een balk of mail zodra de eerste echte agent-proef loopt.
- Een koppeling tussen de aanvraag en het team op de adminpagina (nu "match zelf op e-mailadres").
- Grens van 25 leden (zie Let op 3).

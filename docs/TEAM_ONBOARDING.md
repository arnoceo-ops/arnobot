# Team-klant onboarden: checklist

**Laatst bijgewerkt:** 2026-11-12 (sectie "Teambaas met een zakelijk solo-maandabonnement")
**Doel:** de stappen van een Team-aanvraag tot de eerste betaalde factuur, zodat bij de eerste echte klant niets vergeten wordt. Het inrichten na akkoord is een bewust besluit: volledig handmatig, blijvend (zie `docs/ABONNEMENTEN.md`, "Team-aanvraagflow"). Dit document legt vast wat daarbij gebeurt, wat automatisch loopt en waar je op moet letten.

## De stappen

| # | Wie | Wat | Waar |
|---|---|---|---|
| 1 | Klant | Vult het aanvraagformulier in: bedrijfsnaam, KvK, BTW-nummer, factuuradres, aanvrager, aantal gebruikers (minimaal 3), maandelijks of jaarlijks. | `/team/aanvragen` |
| 2 | Automatisch | De aanvraag wordt opgeslagen in `arnobot_command_requests` (met het `user_id` als de aanvrager was ingelogd). Mail naar `arno@arno.bot` met knop naar de adminpagina, plus een Telegram-melding "Nieuwe Team-aanvraag". | `app/api/team-aanvraag/route.ts` |
| 3 | Arno | Beoordeelt de aanvraag, gesprek of demo, akkoord op prijs. | buiten de app |
| 4 | Arno | Zoekt de aanvrager op (op e-mailadres), zet `command_manager = true` en het plan (zoals beschreven in `docs/ABONNEMENTEN.md`). Doe dit pas na akkoord, zie "Let op" hieronder. De schakelaars staan in de kolommen TEAM en PLAN op `/bot/admin/gebruikers` (elke wijziging komt in het logboek onderaan die pagina), Supabase is niet nodig. | `/bot/admin/gebruikers` |
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

**De proef eindigt na 30 dagen vanzelf** (sinds 2026-11-14, `/api/cron/team-proef`, dagelijks). Zonder die cron zou hij nooit eindigen: de toegangspoort (`proxy.ts`) laat iemand met `command_manager = true` binnen zolang zijn team niet geblokkeerd is, en de proefmails slaan managers en teamleden over. De cron:
- waarschuwt jou via Telegram 5 dagen van tevoren, voor het gesprek over een betaald Team;
- blokkeert daarna het team (manager en leden verliezen de toegang die alleen via het team loopt, wat ze zelf betaald hebben blijft). Had de manager nog geen team gemaakt, dan trekt hij `command_manager` in en gelden de gewone 30 dagen;
- raakt een team nooit aan zodra de facturatie is ingesteld (stap 7, min. seats gevuld) of de aanmelding niet via een agent-link kwam;
- blokkeert ook nooit automatisch als de manager zelf betaalt (dat kan een klant zijn), maar meldt je dan wel dat het team geen facturatie heeft en gratis meeloopt. Dit is de valkuil: wie op `/bot/doorgaan` alleen voor zichzelf betaalt, houdt zijn eigen toegang, maar betaalt daarmee niet voor zijn team.

**Verlengen kan altijd:** op `/bot/admin/teams` staat bij zo'n team de einddatum, met een datumveld en de knop VERLENG PROEF. Die zet de einddatum van de manager later en heft een blokkade door het einde van de proef op, ook na het einde. Een gezette einddatum gaat voor op de 30 dagen. Zodra de klant akkoord is: stap 7 invullen, dan is het geen proef meer.

## Let op

1. **`command_manager = true` geeft al toegang**, ook zonder dat er een team of een betaling is (`proxy.ts`). Zet het dus pas na akkoord.
2. **Facturatie start pas bij stap 7.** Zonder min. seats, cyclus en factuurdatum slaat de cron het team over. Het team kan dan gewoon werken zonder dat er ooit een factuur komt. Vergeet stap 7 niet.
3. **Maximaal 25 leden per team** (`/api/bot/team/join`). Het aanvraagformulier laat meer seats toe (bijvoorbeeld 140 medewerkers). Bij een grotere klant is een aanpassing nodig vóór de uitnodigingen.
4. **Teamtoegang hangt niet af van `paid_at`.** Toegang loopt via het lidmaatschap en `command_manager`, en stopt alleen bij een blokkade. Of `paid_at` bij een Team nog gezet moet worden voor de administratie is niet uitgezocht; het staat nog zo in `docs/ABONNEMENTEN.md`.
5. **Teambaas moet een ArnoBot-account hebben** om `command_manager` te kunnen krijgen. De aanvraag koppelt het `user_id` alleen als de aanvrager ingelogd was. Anders zoek je hem op e-mailadres op.
6. **Het mailadres van de teambaas** is waar de factuur, de betaallink, de herinnering en de blokkademail naartoe gaan (het adres in `approved_users`).
7. **Enterprise-klanten met eigen inlog (SSO, domeinbinding):** aanvullende stappen staan in de lijst "Corporate accounts" (`arnobot_teams.domain`, Clerk Pro, SAML of OIDC).
8. **Een team-aanvraag is geen automatische betaalopdracht.** Het formulier geeft een prijs en een mail, geen account en geen factuur.

## Test en bewijs (2026-11-04, testmodus, testteam Apex)

Getest en goedgekeurd: reguliere factuur, tussentijdse jaarfactuur voor een extra seat, betaling via de link (iDEAL), afletteren in Moneybird, herinnering, blokkade en deblokkade, alle bijbehorende mails en Telegram-meldingen. Gevonden en gefixt: zie `docs/MOLLIE_PLAN.md` (betaallinks kennen geen metadata, geen `url`-veld, betaalvoorwaarden en factuurmail). Niet getest met echt geld: een Team-factuur in live-modus. Ook de knop SOLO NAAR TEAM (2026-11-12) is alleen met tests gedekt en nog niet op een echte zakelijke solo-klant gedraaid: lees bij het eerste geval eerst het voorbeeld, en controleer daarna de Telegram-melding en in de database dat het solo-abonnement op `cancelled` staat met als einddatum `periode_einde` en dat het team als volgende factuurdatum dezelfde dag heeft.

## Open punten

- Een mail aan de manager bij het einde van de proef (tekst nog niet vastgesteld): nu krijgt alleen Arno een Telegram-melding, en de manager belandt na de blokkade op `/bot/doorgaan`.
- Een koppeling tussen de aanvraag en het team op de adminpagina (nu "match zelf op e-mailadres").
- Grens van 25 leden (zie Let op 3).

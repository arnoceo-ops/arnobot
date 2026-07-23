# ArnoBot abonnementsstructuur — basis/premium/elite/team

Referentiedocument voor de huidige plan-structuur, zodat besluiten hierover niet telkens opnieuw uit git-geschiedenis of losse sessies opgezocht hoeven te worden. **Bij elke wijziging aan de abonnementsstructuur dit document in dezelfde commit bijwerken.**

---

## Status

**Laatst bijgewerkt:** 2026-07-23
**Waar we staan:** De abonnementsstructuur is volledig herzien: Premium ging van €77 naar €97/maand (€777/jaar), er is een nieuwe Elite-tier bijgekomen (€397/maand, individueel, hoog-contact), en het oude Team-product heet nu "Command" in alle marketinguitingen (interne databasewaarde blijft `plan='team'`, alleen de naam naar buiten toe veranderde). Basis is niet langer de gratis instap: het is nu een verborgen, betaalde retentietier (€47/maand) die alleen getoond wordt bij een opzegpoging, nooit als publieke keuze.

De nieuwe `/prijzen`-pagina staat live, gebouwd in de stijl van de homepage (Figtree/Oswald), met Premium en Elite naast elkaar (maandelijks/jaarlijks-toggle) en Command als aparte, bredere kaart eronder zonder zichtbare prijs. `/bot/doorgaan` (trial-einde) toont nu een echte Premium/Elite-keuze in plaats van één generieke "ja ik ga door"-knop. `/command` is een nieuw, publiek aanvraagformulier voor Command (factuurgegevens, aanvrager, seats, facturatiecyclus, live berekende staffelprijs).

**Eerstvolgende stap:** DocuSeal-integratie afbouwen (offerte-template + API-koppeling vanuit `/command`, zie "Command-aanvraagflow" hieronder, API-key staat al klaar als env var). Daarna: seat-wijzigingen na ondertekening (zie geheugen `project-team-pricing`), Telegram-toegang Elite (wacht op Arno's nieuwe telefoonnummer), Basis-retentieflow, Circle, betaalprovider (bewust in die volgorde, laatste twee bewust helemaal achteraan).

---

## De vier plannen

| | **Basis** | **Premium** | **Elite** | **Team (Command)** |
|---|---|---|---|---|
| Prijs | €47/maand, **niet publiek**, alleen bij opzegpoging | €97/maand of €777/jaar | €397/maand, alleen maandelijks | Op aanvraag, geen vaste prijs (intern anker: zie geheugen `project-team-pricing`) |
| Zichtbaar op `/prijzen` | Nee | Ja | Ja | Ja, zonder prijs |
| Chatberichten/dag | Laag (retentie, bewust streng) | 100 | 100 | 100 |
| Sessiegeheugen | Kort | 25 | 25 | 25 |
| Coaching | Nee | Ja | Ja | Ja |
| Gesproken antwoorden | Nee | Ja | Ja | Ja |
| Command-managerdashboard | Nee | Nee | Nee | Ja |
| Extra bij Elite | — | — | 1x/maand persoonlijk gesprek met Arno (nog geen herhaalbare boeking, zie onder), Telegram (nog niet gebouwd, wacht op nummer), Elite Member Community (nog niet gebouwd) | — |
| Wie | Alleen als save-offer bij opzegging | Standaard betaalde individuele tier, ook trial-default | Individueel, hoog-contact, max. 50 (capaciteitsteller in admin) | Meerdere seats onder één deal, elke gebruiker krijgt Premium-niveau + managerdashboard |

**Trial-default:** iedere nieuwe gebruiker krijgt bij aanmelden `plan='premium'` (`middleware.ts`), niet `basis`. Dit is ongewijzigd sinds de vorige migratie.

---

## Command (voorheen "Team"), marketingnaam versus databasewaarde

Besloten (2026-07-23): de site noemt dit plan overal "Command", maar de onderliggende Supabase-waarde blijft `plan='team'`. Bewuste keuze om geen datamigratie te hoeven doen voor een naamswijziging die puur marketing is. Bij toekomstig werk aan deze tier: zoek in de database op `team`, niet op `command`.

Op `/prijzen` staat de groepskop boven de kaart "Team" (generieke, herkenbare term, parallel aan "Individueel" boven Premium/Elite), en "Command" als het amber productlabel in de kaart zelf (parallel aan hoe "Premium"/"Elite" onder "Individueel" staan).

### Command-managerdashboard nu écht gekoppeld aan het plan

Was tot 2026-07-23 volledig hardcoded aan één bouwersaccount (`linkedin@royaldutchsales.com`), losstaand van elk betaalplan. Nu gekoppeld: `/bot/team` (pagina + de team-aanmaak-API) checkt `plan === 'team'`, naast de bouwer-uitzondering die blijft bestaan voor testdoeleinden. De TEAM-navigatielink in `BotNav.tsx` en `SparClient.tsx` gebruikt dezelfde check, via een nieuwe route `/api/bot/plan` (geeft het eigen plan van de ingelogde gebruiker terug, client-side bruikbaar).

**Belangrijk, ongewijzigd:** dit blijft losstaand van de collaboration-teamfunctie zelf (`arnobot_teams`/`arnobot_team_members`, tot 25 leden, gaat over gezamenlijke coaching-dashboards/1:1's). Er is nog steeds geen technische koppeling tussen "aantal seats waarvoor betaald is" en "aantal leden in het collaboration-team". Zie "Openstaand: seat-wijzigingen" hieronder, dat is precies dit gat.

### Command-prijsstaffel

Volledige staffel en rekenmechaniek (gestaffeld/marginaal, niet vlak per tier) staat in het geheugen `project-team-pricing`, niet hier gedupliceerd. Kort: geanchored op €97 (Premium-prijs) voor 2-5 seats, aflopend tot €77 bij 11-20 seats, daarboven volledig maatwerk. Geïmplementeerd in `lib/commandPricing.ts`, hergebruikt door zowel het interne prijsanker als de live berekening op `/command`.

### Command-aanvraagflow (`/command`)

Nieuwe, publieke pagina (geen `/bot`-prefix, dus geen inlog vereist, bezoekers vanaf `/prijzen` hebben vaak nog geen account). Formulier: bedrijfsnaam, KvK-nummer, btw-nummer, factuuradres, aanvrager (naam/functie/e-mail/telefoon), bestelnummer (optioneel), aantal seats, facturatiecyclus (maandelijks/jaarlijks), met live berekende staffelprijs excl. btw.

Opslag: nieuwe tabel `arnobot_command_requests` (Supabase), plus een e-mailmelding naar `arno@arno.bot` per aanvraag (`app/api/command-aanvraag/route.ts`).

**In opbouw (2026-07-23):** dit wordt uitgebreid met automatische offertegeneratie + digitale ondertekening via **DocuSeal**. Gekozen boven PandaDoc, DocuSign, Qwilr en anderen omdat DocuSeal als enige transparant en betaalbaar is over API-toegang: gratis onbeperkte sandbox, productie-API + webhooks vanaf het Pro-plan ($20/user/maand + $0,20/verstuurd document). Bij de andere aanbieders bleek API-toegang pas bij een dure/onduidelijke Enterprise-laag te zitten. Arno heeft al een Pro-abonnement. API-key staat als environment variable (`DOCUSEAL_API_KEY`, Production + Preview, versleuteld via Vercel).

**Nog te doen:** offerte-template bouwen in DocuSeal (met merge-velden voor de bovenstaande formuliergegevens), dan de API-koppeling bouwen vanuit `/api/command-aanvraag` (automatisch offerte genereren en versturen + webhook voor ondertekeningsmelding). Offerte-inhoud/voorwaarden worden vooraf aan Arno voorgelegd, dat is een juridisch document, geen route die zomaar zelf ingevuld wordt.

De `/command`-pagina belooft dit al tekstueel ("je ontvangt automatisch een offerte die je digitaal kunt ondertekenen") vooruitlopend op de bouw, bewust: geen live gebruikers op dit moment, dus geen risico dat iemand een belofte ziet die nog niet klopt.

**Doorverwijzing "Vraag een demo aan":** deze knop staat op `/prijzen` én `/bot/doorgaan`, en linkt naar de bestaande Calendly-boeking (`ARNO_BOOKING_URL`, hetzelfde event als de losse "gratis gesprek"-boeking tijdens de trial, zie `/bot/gesprek`). **Niet** naar `/command`, dat is geen demo-aanvraag maar het eigenlijke bestel-/aanvraagformulier, bedoeld voor ná het gesprek. Arno gebruikt voorlopig hetzelfde Calendly-event voor beide doeleinden; een apart Command-specifiek event volgt zodra hij een betaald Calendly-account heeft.

**Openstaand: seat-wijzigingen ná ondertekening.** Zie geheugen `project-team-pricing` voor de volledige uitwerking. Kort: volledig handmatig voorlopig (Arno herberekent met de staffel, stuurt aangepaste offerte), maar het onderliggende gat (geen koppeling tussen `/bot/team`-lidmaatschap en betaalde seats) moet eerder opgelost worden dan de facturatielogica zelf.

---

## Elite (nieuw, besloten 2026-07-23)

Individuele, hoog-contact tier boven Premium. €397/maand, bewust alleen maandelijks (geen jaaroptie, i.v.m. de capaciteitscap).

**Capaciteitscap:** hard maximum van 50 actieve Elite-klanten. Nog geen publieke wachtlijst-mechanisme (komt pas zodra de 50 in zicht is, of eerder als Arno het te veel voelt worden). Wel al een teller in `/bot/admin/gebruikers` ("Elite: X / 50", amber vanaf 45, rood + "cap bereikt" bij 50), zodat Arno het zelf ziet vóór hij handmatig iemand op Elite zet.

**Wat Elite belooft, wat daarvan al werkt:**
- Alles van Premium: werkt automatisch, de kernlogica (berichtlimiet, coaching, sessiegeheugen, patroonanalyses, voice) is overal geschreven als "alles behalve basis", niet als een expliciete allowlist, dus `elite` viel daar al automatisch onder zodra de databasewaarde bestond.
- 1 uur per maand persoonlijk gesprek met Arno: **nog niet gebouwd**. De bestaande boekingsinfrastructuur (`/bot/gesprek`, `arno_call_booked_at`) ondersteunt maar één boeking ooit, geen herhaling. Uitbreiding naar terugkerende boekingen is bewust uitgesteld tot Arno een betaald Calendly-account heeft.
- Rechtstreeks contact via Telegram: **nog niet gebouwd**, wacht op een nieuw, apart telefoonnummer voor een dedicated Telegram-account (niet hetzelfde handle als elders in de app gebruikt, om de exclusiviteit niet te verdunnen). Concept: 1:1, geen groep (Arno's expliciete keuze, de "Elite Member Community" hieronder is al de plek voor leden onderling).
- Elite Member Community: **nog niet gebouwd**, wordt later Circle (bewust als allerlaatste in de bouwvolgorde gepland).

### Technisch: `elite` als plan-waarde

Database-migratie uitgevoerd (2026-07-23): CHECK-constraint op `approved_users.plan` uitgebreid van `('basis','premium','team')` naar `('basis','premium','elite','team')`. `PlanToggle.tsx` en `POST /api/admin/plan` zijn bijgewerkt om `elite` daadwerkelijk te kunnen toekennen (stond eerder alleen in de database toe, niet in de admin-tooling).

---

## Trial-einde-flow (`/bot/doorgaan`)

Volledig herbouwd (2026-07-23). Was: één generieke "JA, IK GA DOOR"-knop, geen plankeuze, alles verder handmatig via Arno. Nu: een echte keuze tussen Premium en Elite (zelfde bullets, prijzen en maand/jaar-toggle als op `/prijzen`, letterlijk overgenomen, niet herschreven), die bij het kiezen meteen `plan` zet op de gekozen waarde (`POST /api/bot/confirm-renewal` accepteert nu een `plan`-parameter). Arno hoeft dus niet meer zelf te bepalen welk plan iemand kreeg, dat staat al goed zodra hij de factuur stuurt.

**Stijluitzondering, bewust vastgelegd in CLAUDE.md:** deze pagina (en toekomstige vergelijkbare conversiemomenten binnen `/bot`) gebruikt de marketingstijl (Figtree/Oswald, zoals `/prijzen` en de homepage), niet de standaard `/bot`-stijl (Space Mono/Bebas Neue). Reden: dit is inhoudelijk een conversiemoment, geen gewone in-app functionaliteit. `BotNav` zelf blijft ongewijzigd (gedeeld component, en gebruikt toch al Bebas Neue net als de homepage-nav).

Technisch gesplitst in een server `page.tsx` (leest `ARNO_BOOKING_URL` server-side) en een `DoorgaanClient.tsx` (de interactieve logica), omdat environment variables niet direct in een `'use client'`-bestand te lezen zijn. Zelfde opzet als `/prijzen` + `PrijzenClient.tsx`.

Preview-modus: `?preview=idle` in de URL toont de Premium/Elite-keuze ongeacht de echte renewal-status van de ingelogde gebruiker, zonder Supabase aan te raken. Nodig omdat Arno's eigen bouwersaccount al `paid_at` heeft staan. Zelfde patroon als `?previewMember=1` op de Q&A-pagina.

**Vaste regel, ontdekt bij het herbouwen:** in alle factuur-gerelateerde copy is **ArnoBot** de afzender, nooit de persoon Arno ("ArnoBot stuurt je een factuur", niet "Arno stuurt je een factuur"). Geldt niet voor support-verwijzingen ("mail naar arno@arno.bot bij vragen"), dat is een andere context.

---

## Oude prijzen elders in de app, bijgewerkt (2026-07-23)

Bij het doorzoeken van de hele codebase op resterende `€77`/`€697`-vermeldingen (de oude Premium-prijs) kwamen zes plekken naar boven, allemaal bijgewerkt naar de nieuwe prijzen:

- `app/bot/qa/QAClient.tsx`: hoofdprijs-FAQ herschreven (verwijst nu naar meerdere niveaus + de prijzenpagina, niet meer naar één vast bedrag) en de referral-FAQ (€77 → €97)
- Referral-tegoed, vijf plekken (`lib/email-templates.ts`, `app/api/bot/referral/route.ts`, `app/bot/profiel/ReferralSection.tsx`, `app/referrals/page.tsx`): €77 → €97, gekoppeld aan optie A (tegoed = één maand Premium op de huidige prijs)
- `app/evaluatie/page.tsx`: interne evaluatievraag, ook bijgewerkt (lager risico, alleen intern zichtbaar)
- Dag25-mail (`lib/email-templates.ts`): "factuur van Arno" → "factuur van ArnoBot" (zie vaste regel hierboven), en de knoptekst van "JA, IK GA DOOR" naar "KIES JE ABONNEMENT", passend bij de nieuwe Premium/Elite-keuze op de pagina waar hij naartoe linkt

---

## Technische implementatie

- Kolom `plan` (`text`, `NOT NULL`, `DEFAULT 'premium'`, `CHECK (plan IN ('basis','premium','elite','team'))`) op Supabase-tabel `approved_users`. Migratie 2026-07-23, zie "Elite" hierboven.
- Admin-beheer: `/bot/admin/gebruikers`, 4-way toggle-knop per gebruiker (`PlanToggle.tsx` → `POST /api/admin/plan`), plus de Elite-capaciteitsteller. Geen self-serve upgradeflow voor Command, wel voor Premium/Elite bij trial-einde (zie hierboven). Alle betalingen blijven handmatig geregistreerd, ook voor Premium/Elite (geen betaalprovider, zie "Openstaande vragen").
- Nieuwe route `/api/bot/plan` (GET): geeft het plan van de ingelogde gebruiker terug, gebruikt door client-side navigatie (`BotNav`, `SparClient`) om de TEAM-link te tonen, en herbruikt voor de nog te bouwen Telegram-toegangscontrole.
- Gating-logica ongewijzigd van patroon: `app/api/chat/route.ts`, `app/api/bot/coaching*`, `lib/voice.ts` (`hasVoiceAccess`) — allemaal "alles behalve basis", geen aparte code nodig per nieuw plan.

---

## Openstaande vragen / nog niet besloten

**Actief in opbouw:**
- DocuSeal-offertetemplate + API-koppeling voor `/command` (zie "Command-aanvraagflow" hierboven)

**Bewust uitgesteld, met reden:**
- Seat-wijzigingen ná ondertekening (zie geheugen `project-team-pricing`)
- Telegram-toegang Elite: wacht op Arno's nieuwe, dedicated telefoonnummer
- Herhaalbare maandelijkse boeking voor Elite (nu maar één boeking ooit mogelijk): wacht op een betaald Calendly-account
- Basis-retentieflow (het €47-save-offer daadwerkelijk tonen bij een opzegpoging): bouwen bij de eerste keer dat iemand echt probeert op te zeggen, niet eerder
- Elite Member Community (Circle): bewust als allerlaatste in de Deel B-bouwvolgorde
- Betaalprovider/Stripe: bewust helemaal achteraan, na alle andere Deel B-onderdelen (expliciete correctie van Arno op een eerdere volgorde die dit juist vooraan zette)

**Nog te beoordelen:**
- Of en wanneer bestaande betalende klanten geïnformeerd worden over prijswijzigingen die hen raken sinds de vorige migratie (nog geen besluit)

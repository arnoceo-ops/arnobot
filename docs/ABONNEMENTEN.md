# ArnoBot abonnementsstructuur — basis/premium/team

Referentiedocument voor de huidige plan-structuur, zodat besluiten hierover niet telkens opnieuw uit git-geschiedenis of losse sessies opgezocht hoeven te worden. **Bij elke wijziging aan de abonnementsstructuur dit document in dezelfde commit bijwerken.**

---

## Status

**Laatst bijgewerkt:** 2026-07-20
**Waar we staan:** De technische omzetting van `tier`(`basis`/`pro`)+`voice_enabled` naar één kolom `plan`(`basis`/`premium`/`team`) is volledig afgerond: gebouwd, getest, en de oude kolommen zijn gedropt (migratie 2 bevestigd). De upgrade- en gesprek-boekingsflows zijn gebouwd en getest (zie "Upgrade- en boekingspagina's" hieronder). Prijsstelling voor `team` staat nog niet vast. De publieke prijspagina (`/prijzen`) toont nog de oude, enkele prijs en is nog niet bijgewerkt naar de drie-lagen-structuur. **Bewaargrenzen volledig afgerond (2026-07-20)**, zie "Bewaargrenzen" hieronder voor de definitieve keuzes en een tussentijdse correctie (`deleted_at` werd nergens gefilterd buiten de lijst-weergave).
**Eerstvolgende stap:** Geen actief bouwwerk op bewaargrenzen. Overige besluiten hieronder bij "Nog niet besloten" oppakken zodra relevant (met name: `/prijzen` bijwerken, dat blijft sowieso geblokkeerd op de betaalprovider-keuze uit `docs/VOICE_PLAN.md` fase 3).

---

## Upgrade- en boekingspagina's

- **`/bot/gesprek`**: het ene gratis gesprek met Arno (zie ook `docs/VOICE_PLAN.md`). Pagina met een knop die Calendly in een nieuw tabblad opent (geen embed: kleuraanpassing aan het donkere thema vereist een betaald Calendly-plan, en de embed gaf een storende interne scroll). Link bevat naam/e-mail als prefill plus `utm_content=<Clerk-userId>`, die laatste komt terug in de webhook-payload (`payload.tracking.utm_content`) en is de primaire matchsleutel in `app/api/webhooks/calendly/route.ts`, onafhankelijk van wat iemand zelf in het Calendly-formulier invult. Alleen bij een boeking buiten de app om (kale publieke link, geen utm_content) valt de webhook terug op e-mailmatching. Toont een "al gepland"-status zodra `arno_call_booked_at` gevuld is. Bereikbaar vanuit de dag21-mail en vanuit de coaching-pagina (premium/team-weergave, verdwijnt zodra al gepland).
  - **Gevonden en gefixt (2026-07-20), twee aparte bugs achter elkaar:**
    1. De eerste testboekingen registreerden niets. Oorzaak: de Calendly-webhook-subscription was aangemaakt met callback-URL `https://arno.bot/...` (zonder www), dat domein stuurt altijd 308-door naar `https://www.arno.bot`, en Calendly volgt die redirect niet bij het afleveren van webhooks. Subscription verwijderd en opnieuw aangemaakt met `https://www.arno.bot/api/webhooks/calendly` als callback-URL.
    2. Na fix 1 bleef `retry_started_at` oplopen: Calendly probeerde wél af te leveren, maar kreeg telkens 401 terug. Handmatig geverifieerd met een correct ondertekend testverzoek (zelfde HMAC-berekening als de code) dat zelfs dát werd geweigerd: de `CALENDLY_WEBHOOK_SIGNING_KEY`-waarde in Vercel kwam niet meer overeen met de key waarmee de subscription was aangemaakt (vermoedelijk een kopieerfout onderweg). Opgelost door een geheel nieuwe signing key te genereren, de subscription opnieuw aan te maken mét die nieuwe key, en de Vercel-env-var opnieuw te zetten.
  - **Volledig end-to-end bevestigd (2026-07-20):** na beide fixes een echte boeking gedaan via `/bot/gesprek` (niet een handmatige simulatie), `arno_call_booked_at` werd correct gezet en de "PLAN GESPREK"-knop verdween. De boekingsflow werkt aantoonbaar volledig, van klik tot registratie.
- **`/bot/upgrade`**: handmatige upgrade-aanvraag, geen self-serve betaling (die bestaat nog niet, zie "Technische implementatie" hieronder). Toont een basis→premium-sectie (alleen voor `plan=basis`) en een premium→team-sectie (voor iedereen behalve `plan=team`), beide met een knop die een mailto naar arno@arno.bot opent én een klik-event logt (`upgrade_premium_click`/`upgrade_team_click`). Bereikbaar vanuit de coaching-blokkade voor basis-gebruikers.
- **`/arnolive`** (voorheen `/upgrade`): Arno's eigen consulting-aanbod (ArnoLive-retainer + ArnoPrime-heidagen), los van de ArnoBot-abonnementen zelf. Puur verplaatst om de naamsclash met `/bot/upgrade` op te lossen, inhoud ongewijzigd.

---

## De drie plannen

| | **Basis** | **Premium** | **Team** |
|---|---|---|---|
| Prijs | Betaald, goedkoper dan premium, exact bedrag nog niet vastgesteld | €97/maand (zie toelichting hieronder) | Op aanvraag, geen vaste prijs |
| Chatberichten/dag | 25 | 100 | 100 |
| Sessiegeheugen (vorige gesprekken meegenomen in chatcontext) | 10 | 25 | 25 |
| Gesprekken bewaard (archief/BIEB, hard limiet) | 25 | Onbeperkt | Onbeperkt |
| Patroonanalyses bewaard (archief/BIEB) | 20 | 20 | 20 |
| Eerdere coachingsrapportages (geschiedenis op coachingspagina) | Nee (heeft sowieso geen coaching) | Onbeperkt | Onbeperkt |
| Patroonanalyses genereren (nieuwe aanmaken, los van bewaargrens hierboven) | Max 1 per dag | Onbeperkt | Onbeperkt |
| Sparsessies bewaard (geschiedenis op /bot/sparren) | Nee, wordt niet opgeslagen | Onbeperkt | Onbeperkt |
| Coaching (rapport, coachingsdiagnose in chat) | Nee | Ja | Ja |
| Spraak-naar-tekst invoer (mic-knop) | Ja | Ja | Ja |
| Gesproken antwoorden (ElevenLabs voice-naar-voice) | Nee, behalve tijdelijk tijdens de trial (zie hieronder) | Ja | Ja |
| Uitgebreide/lange antwoorden, document-upload | Ja (webapp) | Ja (webapp) | Ja (webapp) |
| Wie | Gebruikers die na de trial bewust voor het goedkopere abonnement kiezen | Trial-gebruikers (zie hieronder) én betalende premium-abonnees | Meerdere gebruikers/seats onder één (bedrijfs)deal, elke gebruiker krijgt premium-niveau |

**Bewaargrenzen (besloten en gebouwd 2026-07-20):** niet te verwarren met "Sessiegeheugen" hierboven (dat bepaalt hoeveel eerdere gesprekken worden meegenomen als context in de chat, geen opslaglimiet).
- **Gesprekken bewaard**: 25 voor basis, onbeperkt voor premium/team. Bij overschrijding (alleen basis) wordt het oudste gesprek zacht verwijderd (`deleted_at`, zelfde mechanisme als de bestaande handmatige verwijderfunctie). Gebouwd in `app/api/bot/sessions/route.ts`, draait bij elke keer dat de sessielijst wordt opgehaald.
- **Patroonanalyses bewaard**: bewust géén plan-onderscheid, blijft de bestaande vlakke grens van 20 voor iedereen (`app/api/bot/coaching-analyse/route.ts:158-167`, ongewijzigd). De dagelijkse generatielimiet hieronder is hier al het plan-onderscheid, een tweede onderscheid op de bewaargrens voegde niets toe.
- **Correctie bij het bouwen (2026-07-20):** `deleted_at` (zachte verwijdering) werd nergens gefilterd behalve in de lijst-weergave zelf, dus zowel handmatig verwijderde als automatisch opgeruimde gesprekken bleven gewoon meetellen in de hoofdchat (`app/api/chat/route.ts`), coaching-generatie en patroonanalyse-generatie. Zonder deze fix was de nieuwe 25-cap voor basis alleen cosmetisch (verdwijnt uit het archief, blijft wel meewegen in AI-output). Nu overal `.is('deleted_at', null)` toegevoegd. Losstaand gebleven: nog 29 andere plekken in de code lezen `arnobot_blog_sessions` zonder deze filter (crons, admin-dashboards, teamfeatures, export), niet meegenomen in deze fix, dat is een bredere opschoning voor een aparte gelegenheid (bijv. de kwartaalcheck).
- **Input-limiet bij patroonanalyse genereren**: `app/api/bot/coaching-analyse/route.ts:40` verlaagd van 200 naar 100. Losstaand van de (voor premium/team onbeperkte) bewaargrens hierboven: een patroonanalyse gebruikt hoe dan ook alleen de meest recente 100 gesprekken als invoer, ongeacht hoeveel er in totaal bewaard blijven.

**Patroonanalyses genereren, dagelijkse limiet (bestaand, nu pas hier gedocumenteerd):** `app/api/bot/coaching-analyse/route.ts:31-33` blokkeert een nieuwe generatie voor `plan=basis` als er die dag al 1 is gemaakt (429 `dagelijks_limiet`). Premium/team hebben hier geen limiet. Dit is losstaand van de bewaargrens hierboven (dat is hoeveel er blijven staan, dit is hoe vaak je een nieuwe mag maken) en bewust gehandhaafd (2026-07-20): een direct voelbare, actieve limiet werkt als een echte upgradehefboom, in tegenstelling tot de bewaargrenzen die pas na maanden gevoeld worden.

**Sparsessies-geschiedenis (besloten en gebouwd 2026-07-20):** eigen sectie "ARCHIEF" onderaan `/bot/sparren`, ná het invoerveld (duidelijke scheiding met een amber lijn), zelfde stijl als het archief (datum, titel uit de debrieftekst, uitklap), standaard 5 tonen met een TOON ALLE-knop voor de rest. Tabel `arnobot_sparring_sessions` bestond al (gevuld door `app/api/sparring/debrief/route.ts` bij het afsluiten van een sparsessie), maar had voorheen geen plan-onderscheid: iedereen werd opgeslagen. Nu: basis wordt niet meer opgeslagen, premium/team onbeperkt, geen cap. Nieuw: een `favoriet`-kolom (boolean) waarmee een gebruiker een sparsessie kan markeren met een ster, via `PATCH /api/bot/sparring-history`.
- **Volledig gesprek terugzien**: `app/api/sparring/chat/route.ts` is stateless en logt zelf niks, de conversatie leefde tot nu alleen in de browser tijdens de sessie. Nieuwe kolom `transcript` (jsonb) op `arnobot_sparring_sessions`, gevuld bij het afsluiten (dezelfde `messages` die al binnenkwamen voor de debrief-generatie, nu ook bewaard). In ARCHIEF een tweede uitklapoptie naast de debrief: "TOON VOLLEDIG GESPREK".

**Coachingsgeschiedenis (besloten en gebouwd 2026-07-20, cap losgelaten 2026-07-20):** eigen sectie "ARCHIEF" op de coachingspagina, tussen PROGRESSIE en ARNO.BLOGS, analoog aan de bestaande `arnobot_team_analyses` (teampagina, zie hieronder) en `arnobot_1on1_log` (teamlid-pagina): een aparte, insert-only tabel `arnobot_coaching_history` naast `arnobot_coaching` zelf. Bewust géén wijziging aan `arnobot_coaching` (dat blijft 1 rij per gebruiker, upsert): een audit wees uit dat 9 andere plekken in de code (o.a. `app/api/chat/route.ts`, de hoofdchat) ervan uitgaan dat die tabel precies 1 rij per gebruiker heeft, en zouden breken bij een omzetting naar meerdere rijen.
- Bij elke generatie (`POST /api/bot/coaching`) wordt naast de bestaande upsert ook een snapshot weggeschreven naar `arnobot_coaching_history`.
- **Geen cap, bewust:** eerst gebouwd met een cap van 5 (zelfde patroon als de team-analyses-cap in `app/api/bot/team/spotlight/route.ts:171-181`), maar diezelfde dag weer losgelaten. Reden: coachingsrapporten komen traag binnen (voortgang-gate, 48u+3 nieuwe gesprekken), dus een cap zou op termijn de nulmeting van een trouwe gebruiker wegknippen, precies het soort langetermijnvergelijking dat een coachingsproduct waardevol maakt. Patroonanalyses en gesprekken worden wel vaak genoeg gegenereerd dat een cap daar geen probleem is; coaching niet. Opslagkosten zijn verwaarloosbaar op deze generatiefrequentie.
- Nieuwe route: `app/api/bot/coaching-history/route.ts` (GET, alle rijen). UI: `app/bot/coaching/CoachingClient.tsx`.

**Trial krijgt volledige functionaliteit (besloten en bevestigd 2026-07-20):** iedere nieuwe gebruiker krijgt bij aanmelden expliciet `plan='premium'` (`middleware.ts`, provisioning bij eerste LinkedIn-login), niet `basis`. Dat betekent tijdens de 30 dagen trial: volledige coaching, gesproken antwoorden, en de hoge berichtlimiet, precies zoals vóór de migratie ook al zo werkte (toen stond `tier` default op `pro`). Pas als iemand na de trial bewust voor het goedkopere `basis`-abonnement kiest, verliest die coaching, voice en de hoge limiet.

**Gevonden en gefixt (2026-07-20, zelfde dag als de migratie):** de nieuwe `plan`-kolom kreeg aanvankelijk kolom-default `'basis'`, en `middleware.ts` zette `plan` nooit expliciet bij provisioning. Nieuwe trial-aanmeldingen kregen daardoor stilzwijgend een beperkte trial-ervaring (geen coaching, geen voice, 25 berichten/dag) in plaats van de bedoelde volledige functionaliteit. Ontdekt vóórdat er nieuwe gebruikers door geraakt zijn. Gefixt door `plan: 'premium'` expliciet in `newRow` te zetten; de kolom-default in Supabase moet nog gelijkgetrokken worden (zie Technische implementatie).

**Losstaande, kleinere voice-uitzondering:** iedereen met een lopende trial krijgt sowieso ook los van `plan` gratis voice-toegang tot een plafond van circa 50.000 tekens (`TRIAL_VOICE_CHAR_CAP` in `lib/voice.ts`). Dit was vóór de fix hierboven de enige trial-functionaliteit die basis-gebruikers hadden; nu `plan='premium'` de trial-standaard is, is dit vooral relevant als vangnet voor iemand die handmatig op `basis` gezet wordt tijdens een lopende trial.

---

## Belangrijke toelichting: premium = de oude "Unlimited + Voice"-combinatie

Vóór 2026-07-20 waren dit twee losse assen op `approved_users`:
- `tier`: `basis` of `pro` (Unlimited-product, €77/maand, zie `/prijzen`)
- `voice_enabled`: losse boolean, los bij te kopen (ArnoBot Voice, €97/maand)

Dat maakte combinaties mogelijk zoals "pro zonder voice" (alleen Unlimited) of "basis met voice" (zou niet moeten kunnen, kwam praktisch niet voor). Op 2026-07-20 is besloten dit te vereenvoudigen: **`premium` vervangt die combinatie volledig, als één product op één prijs.** Wie eerder `pro` was (met of zonder losse voice-toegang) is bij de migratie automatisch op `premium` gezet, en heeft dus nu ook automatisch voice-toegang, ook als daar niet apart voor betaald werd.

**Nog niet besloten:** of er ooit weer een goedkopere, betaalde tussenlaag komt zonder voice (dus een "Unlimited zonder Premium"-optie). Op dit moment: nee, er is geen apart product tussen gratis/trial (`basis`) en het volledige `premium`-pakket (€97/mnd) in.

---

## Team

Besloten (2026-07-20): all-in, per seat/meerdere gebruikers, elke gebruiker in het team krijgt premium-niveau (incl. voice). Prijs op aanvraag, geen self-serve prijs of pricingpagina-vermelding.

**Belangrijk:** dit `team`-plan (billing/toegang) is **losstaand** van de bestaande teamfunctie in de app (`arnobot_teams`/`arnobot_team_members`, zelf aan te maken door elke gebruiker via `/bot/team`, tot 25 leden, gaat over gezamenlijke coaching-dashboards/1:1's, niet over betaling). Er is geen technische koppeling tussen "zit in een collaboration-team" en "heeft plan=team". Een gebruiker met `plan=basis` of `plan=premium` kan gewoon lid zijn van een collaboration-team; dat is een apart, ouder feature-systeem.

**Nog niet besloten:** exacte prijsstaffel voor `team`. Er bestaat wel al een bracket-model voor een oudere teamlicentie-gedachte (zie geheugen `project-team-pricing`: basis €77/slot/maand aflopend tot €54 bij 11-15 slots, jaarprijs ×8), maar dat is niet geformaliseerd als de prijs voor dít `team`-plan en moet expliciet bevestigd of herzien worden zodra dit relevant wordt.

---

## Technische implementatie

- Kolom `plan` (`text`, `NOT NULL`, `DEFAULT 'premium'`, `CHECK (plan IN ('basis','premium','team'))`) op Supabase-tabel `approved_users`. Default gecorrigeerd op 2026-07-20 (stond eerst foutief op `'basis'`, zie hierboven); `middleware.ts` zet `plan` bovendien ook expliciet bij provisioning, dus dit is een vangnet, niet de enige bescherming.
- Admin-beheer: `/bot/admin/gebruikers`, 3-way toggle-knop per gebruiker (`PlanToggle.tsx` → `POST /api/admin/plan`). Geen self-serve upgradeflow, alles wordt handmatig door Arno gezet, zoals ook alle betalingen nu handmatig geregistreerd worden.
- Gating-logica: `app/api/chat/route.ts` (berichtlimiet, sessiegeheugen, coaching-context), `app/api/bot/coaching*` (coaching-toegang), `lib/voice.ts` (`hasVoiceAccess`, voice-toegang).
- De oude kolommen `tier` en `voice_enabled` zijn gedropt (2026-07-20, na bevestigde regressietest, zie `docs/VOICE_PLAN.md`). Geen legacy-kolommen meer.

---

## Openstaande vragen / nog niet besloten

**Blokkerend op de betaalprovider-keuze** (zie `docs/VOICE_PLAN.md` fase 3, `project_dunning_flow` in memory):
- Of en wanneer `/prijzen` wordt bijgewerkt naar de drie-lagen-structuur. Expliciet blokkerend, niet zomaar los te trekken: fase 3 van VOICE_PLAN.md bundelt de pricingpagina met de upgradeflow, dus de pagina wacht op de providerkeuze (besloten 2026-07-20, bevestigd na een korte heroverweging in dezelfde sessie).
- Self-serve checkout/upgradeflow, en de dunning-flow (herinneringen bij mislukte betaling) die daarop voortbouwt.

**Niet-blokkerend, kan los opgepakt worden** (2026-07-20 als groep benoemd):
- Prijsstaffel voor `team` vaststellen.
- Exacte basis-prijs vaststellen (nu alleen "goedkoper dan premium" afgesproken, zie tabel hierboven).
- Migratie/communicatie richting bestaande betalende klanten die met deze wijziging stilzwijgend voice-toegang erbij hebben gekregen zonder daar apart voor te betalen (zie "Belangrijke toelichting" hierboven) — nog geen besluit of/hoe dit gecommuniceerd wordt.

**Overig:**
- Of er ooit een betaalde tussenlaag komt zonder voice (zie "Belangrijke toelichting" hierboven) — op dit moment bewust niet aan de orde.

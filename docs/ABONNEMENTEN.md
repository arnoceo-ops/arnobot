# ArnoBot abonnementsstructuur — basis/premium/team

Referentiedocument voor de huidige plan-structuur, zodat besluiten hierover niet telkens opnieuw uit git-geschiedenis of losse sessies opgezocht hoeven te worden. **Bij elke wijziging aan de abonnementsstructuur dit document in dezelfde commit bijwerken.**

---

## Status

**Laatst bijgewerkt:** 2026-07-20
**Waar we staan:** De technische omzetting van `tier`(`basis`/`pro`)+`voice_enabled` naar één kolom `plan`(`basis`/`premium`/`team`) is volledig afgerond: gebouwd, getest, en de oude kolommen zijn gedropt (migratie 2 bevestigd). De upgrade- en gesprek-boekingsflows zijn gebouwd en getest (zie "Upgrade- en boekingspagina's" hieronder). Prijsstelling voor `team` staat nog niet vast. De publieke prijspagina (`/prijzen`) toont nog de oude, enkele prijs en is nog niet bijgewerkt naar de drie-lagen-structuur. Besloten (2026-07-20, zie "Bewaargrenzen" hieronder): plan-afhankelijke bovengrenzen voor bewaarde gesprekken en patroonanalyses, nog niet gebouwd. **Nieuw gebouwd (2026-07-20):** coachingsgeschiedenis op de coachingspagina (`arnobot_coaching_history`, cap 5, nu nog vlak voor iedereen met coaching-toegang, geen plan-onderscheid), zie "Bewaargrenzen" hieronder.
**Eerstvolgende stap:** Bewaargrenzen implementeren (zie "Bewaargrenzen" hieronder): plan-afhankelijke cap op `arnobot_blog_sessions` (nieuw opruimmechanisme, bestaat nu nog niet) en de bestaande vlakke 20-cap op `arnobot_analyses` (`app/api/bot/coaching-analyse/route.ts:158-167`) plan-afhankelijk maken. Daarna de overige besluiten hieronder bij "Nog niet besloten" oppakken zodra relevant (met name: `/prijzen` bijwerken, dat blijft sowieso geblokkeerd op de betaalprovider-keuze uit `docs/VOICE_PLAN.md` fase 3).

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
| Gesprekken bewaard (archief/BIEB, hard limiet) | 25 | 100 | 100 |
| Patroonanalyses bewaard (archief/BIEB) | 5 | 15 | 15 |
| Eerdere coachingsrapportages (geschiedenis op coachingspagina) | Nee (heeft sowieso geen coaching) | 5 | 5 (voorlopig) |
| Coaching (rapport, coachingsdiagnose in chat) | Nee | Ja | Ja |
| Spraak-naar-tekst invoer (mic-knop) | Ja | Ja | Ja |
| Gesproken antwoorden (ElevenLabs voice-naar-voice) | Nee, behalve tijdelijk tijdens de trial (zie hieronder) | Ja | Ja |
| Uitgebreide/lange antwoorden, document-upload | Ja (webapp) | Ja (webapp) | Ja (webapp) |
| Wie | Gebruikers die na de trial bewust voor het goedkopere abonnement kiezen | Trial-gebruikers (zie hieronder) én betalende premium-abonnees | Meerdere gebruikers/seats onder één (bedrijfs)deal, elke gebruiker krijgt premium-niveau |

**Bewaargrenzen (besloten 2026-07-20, nog niet gebouwd):** twee nieuwe, plan-afhankelijke bovengrenzen op opgeslagen data, niet te verwarren met "Sessiegeheugen" hierboven (dat bepaalt hoeveel eerdere gesprekken worden meegenomen als context in de chat, geen opslaglimiet).
- **Gesprekken bewaard**: bij overschrijding van de grens wordt het oudste gesprek verwijderd. Aanleiding: geen technische noodzaak (de sessions-route haalt tot 100 op zonder probleem), maar het maakt zoeken in gesprekken behapbaarder voor de gebruiker. Er bestaat op dit moment geen enkel opruimmechanisme voor `arnobot_blog_sessions`, dit moet nieuw gebouwd worden.
- **Patroonanalyses bewaard**: de bestaande opruimlogica in `app/api/bot/coaching-analyse/route.ts:158-167` (nu een vlakke grens van 20 voor iedereen) moet plan-afhankelijk gemaakt worden (5/15/15). Let op: bij het verlagen van de grens voor een gebruiker die er al meer heeft opgeslagen, verwijdert de bestaande logica bij de eerstvolgende nieuwe analyse automatisch de oudste tot de nieuwe grens gehaald is. Onomkeerbaar, dus bewust afwegen bij het bouwen wanneer/hoe dit voor bestaande gebruikers ingaat.

**Coachingsgeschiedenis (besloten en gebouwd 2026-07-20):** eigen sectie "ARCHIEF" op de coachingspagina, tussen PROGRESSIE en ARNO.BLOGS, analoog aan de bestaande `arnobot_team_analyses` (teampagina, zie hieronder) en `arnobot_1on1_log` (teamlid-pagina): een aparte, insert-only tabel `arnobot_coaching_history` naast `arnobot_coaching` zelf. Bewust géén wijziging aan `arnobot_coaching` (dat blijft 1 rij per gebruiker, upsert): een audit wees uit dat 9 andere plekken in de code (o.a. `app/api/chat/route.ts`, de hoofdchat) ervan uitgaan dat die tabel precies 1 rij per gebruiker heeft, en zouden breken bij een omzetting naar meerdere rijen.
- Bij elke generatie (`POST /api/bot/coaching`) wordt naast de bestaande upsert ook een snapshot weggeschreven naar `arnobot_coaching_history`, met opruiming boven de 5 (zelfde patroon als de team-analyses-cap in `app/api/bot/team/spotlight/route.ts:171-181`).
- Nu bewust **vlak, geen plan-onderscheid in de code**: iedereen die al coaching kan genereren (premium/team, basis kan sowieso niet bij coaching) krijgt dezelfde cap van 5. Differentiëren naar plan (bijv. team een ander aantal) is voor later, en dan alleen een kwestie van het cap-getal aanpassen, geen nieuwe architectuur.
- Nieuwe route: `app/api/bot/coaching-history/route.ts` (GET, laatste 5). UI: `app/bot/coaching/CoachingClient.tsx`.

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
- Implementatie van de bewaargrenzen (zie "Bewaargrenzen" hierboven): plan-afhankelijke cap op gesprekken (nieuw te bouwen opruimmechanisme) en op patroonanalyses (bestaande vlakke 20-cap plan-afhankelijk maken). Besluit staat vast, bouwwerk nog niet gestart.
- Prijsstaffel voor `team` vaststellen.
- Exacte basis-prijs vaststellen (nu alleen "goedkoper dan premium" afgesproken, zie tabel hierboven).
- Migratie/communicatie richting bestaande betalende klanten die met deze wijziging stilzwijgend voice-toegang erbij hebben gekregen zonder daar apart voor te betalen (zie "Belangrijke toelichting" hierboven) — nog geen besluit of/hoe dit gecommuniceerd wordt.

**Overig:**
- Of er ooit een betaalde tussenlaag komt zonder voice (zie "Belangrijke toelichting" hierboven) — op dit moment bewust niet aan de orde.

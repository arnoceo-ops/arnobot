# ArnoBot abonnementsstructuur — basis/premium/team

Referentiedocument voor de huidige plan-structuur, zodat besluiten hierover niet telkens opnieuw uit git-geschiedenis of losse sessies opgezocht hoeven te worden. **Bij elke wijziging aan de abonnementsstructuur dit document in dezelfde commit bijwerken.**

---

## Status

**Laatst bijgewerkt:** 2026-07-20
**Waar we staan:** De technische omzetting van `tier`(`basis`/`pro`)+`voice_enabled` naar één kolom `plan`(`basis`/`premium`/`team`) is gebouwd, getest en live. De upgrade- en gesprek-boekingsflows zijn gebouwd (zie "Upgrade- en boekingspagina's" hieronder). Prijsstelling voor `team` staat nog niet vast. De publieke prijspagina (`/prijzen`) toont nog de oude, enkele prijs en is nog niet bijgewerkt naar de drie-lagen-structuur.
**Eerstvolgende stap:** Geen actief bouwwerk. Openstaande besluiten hieronder bij "Nog niet besloten" oppakken zodra relevant (met name: `/prijzen` bijwerken, dat blijft sowieso geblokkeerd op de betaalprovider-keuze uit `docs/VOICE_PLAN.md` fase 3).

---

## Upgrade- en boekingspagina's

- **`/bot/gesprek`**: het ene gratis gesprek met Arno (zie ook `docs/VOICE_PLAN.md`). Pagina met een knop die Calendly in een nieuw tabblad opent (geen embed: kleuraanpassing aan het donkere thema vereist een betaald Calendly-plan, en de embed gaf een storende interne scroll). Link bevat naam/e-mail als prefill plus `utm_content=<Clerk-userId>`, die laatste komt terug in de webhook-payload (`payload.tracking.utm_content`) en is de primaire matchsleutel in `app/api/webhooks/calendly/route.ts`, onafhankelijk van wat iemand zelf in het Calendly-formulier invult. Alleen bij een boeking buiten de app om (kale publieke link, geen utm_content) valt de webhook terug op e-mailmatching. Toont een "al gepland"-status zodra `arno_call_booked_at` gevuld is. Bereikbaar vanuit de dag21-mail en vanuit de coaching-pagina (premium/team-weergave, verdwijnt zodra al gepland).
- **`/bot/upgrade`**: handmatige upgrade-aanvraag, geen self-serve betaling (die bestaat nog niet, zie "Technische implementatie" hieronder). Toont een basis→premium-sectie (alleen voor `plan=basis`) en een premium→team-sectie (voor iedereen behalve `plan=team`), beide met een knop die een mailto naar arno@arno.bot opent én een klik-event logt (`upgrade_premium_click`/`upgrade_team_click`). Bereikbaar vanuit de coaching-blokkade voor basis-gebruikers.
- **`/arnolive`** (voorheen `/upgrade`): Arno's eigen consulting-aanbod (ArnoLive-retainer + ArnoPrime-heidagen), los van de ArnoBot-abonnementen zelf. Puur verplaatst om de naamsclash met `/bot/upgrade` op te lossen, inhoud ongewijzigd.

---

## De drie plannen

| | **Basis** | **Premium** | **Team** |
|---|---|---|---|
| Prijs | Betaald, goedkoper dan premium, exact bedrag nog niet vastgesteld | €97/maand (zie toelichting hieronder) | Op aanvraag, geen vaste prijs |
| Chatberichten/dag | 25 | 100 | 100 |
| Sessiegeheugen (vorige gesprekken meegenomen) | 10 | 25 | 25 |
| Coaching (rapport, coachingsdiagnose in chat) | Nee | Ja | Ja |
| Spraak-naar-tekst invoer (mic-knop) | Ja | Ja | Ja |
| Gesproken antwoorden (ElevenLabs voice-naar-voice) | Nee, behalve tijdelijk tijdens de trial (zie hieronder) | Ja | Ja |
| Uitgebreide/lange antwoorden, document-upload | Ja (webapp) | Ja (webapp) | Ja (webapp) |
| Wie | Gebruikers die na de trial bewust voor het goedkopere abonnement kiezen | Trial-gebruikers (zie hieronder) én betalende premium-abonnees | Meerdere gebruikers/seats onder één (bedrijfs)deal, elke gebruiker krijgt premium-niveau |

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
- De oude kolommen `tier` en `voice_enabled` staan (tijdelijk) nog in de database, maar worden nergens meer door de code gelezen. Ze worden gedropt zodra de regressietest van de migratie volledig is afgerond en bevestigd (zie `docs/VOICE_PLAN.md`).

---

## Openstaande vragen / nog niet besloten

- Prijsstaffel voor `team`.
- Of en wanneer `/prijzen` wordt bijgewerkt naar de drie-lagen-structuur (blokkeert op de betaalprovider-keuze, zie `docs/VOICE_PLAN.md` fase 3).
- Of er ooit een betaalde tussenlaag komt zonder voice (zie "Belangrijke toelichting" hierboven) — op dit moment bewust niet aan de orde.
- Migratie/communicatie richting bestaande betalende klanten die met deze wijziging stilzwijgend voice-toegang erbij hebben gekregen zonder daar apart voor te betalen (zie "Belangrijke toelichting" hierboven) — nog geen besluit of/hoe dit gecommuniceerd wordt.

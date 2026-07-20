# ArnoBot abonnementsstructuur — basis/premium/team

Referentiedocument voor de huidige plan-structuur, zodat besluiten hierover niet telkens opnieuw uit git-geschiedenis of losse sessies opgezocht hoeven te worden. **Bij elke wijziging aan de abonnementsstructuur dit document in dezelfde commit bijwerken.**

---

## Status

**Laatst bijgewerkt:** 2026-07-20
**Waar we staan:** De technische omzetting van `tier`(`basis`/`pro`)+`voice_enabled` naar één kolom `plan`(`basis`/`premium`/`team`) is gebouwd, getest en live. Prijsstelling voor `team` staat nog niet vast. De publieke prijspagina (`/prijzen`) toont nog de oude, enkele prijs en is nog niet bijgewerkt naar de drie-lagen-structuur.
**Eerstvolgende stap:** Geen actief bouwwerk. Openstaande besluiten hieronder bij "Nog niet besloten" oppakken zodra relevant (met name: `/prijzen` bijwerken, dat blijft sowieso geblokkeerd op de betaalprovider-keuze uit `docs/VOICE_PLAN.md` fase 3).

---

## De drie plannen

| | **Basis** | **Premium** | **Team** |
|---|---|---|---|
| Prijs | Gratis (trial) / geen apart betaald basis-product op dit moment | €97/maand (zie toelichting hieronder) | Op aanvraag, geen vaste prijs |
| Chatberichten/dag | 25 | 100 | 100 |
| Sessiegeheugen (vorige gesprekken meegenomen) | 10 | 25 | 25 |
| Coaching (rapport, coachingsdiagnose in chat) | Nee | Ja | Ja |
| Spraak-naar-tekst invoer (mic-knop) | Ja | Ja | Ja |
| Gesproken antwoorden (ElevenLabs voice-naar-voice) | Nee, behalve tijdelijk tijdens de trial (zie hieronder) | Ja | Ja |
| Uitgebreide/lange antwoorden, document-upload | Ja (webapp) | Ja (webapp) | Ja (webapp) |
| Wie | Trial-gebruikers na afloop van gratis voice-tegoed, en iedereen zonder betaald abonnement | Betalende individuele abonnees | Meerdere gebruikers/seats onder één (bedrijfs)deal, elke gebruiker krijgt premium-niveau |

**Trial-uitzondering (dekt `basis` gedeeltelijk):** iedereen krijgt tijdens de eerste 30 dagen (trial) ook gratis toegang tot gesproken antwoorden, tot een plafond van circa 50.000 tekens (`TRIAL_VOICE_CHAR_CAP` in `lib/voice.ts`). Dit staat los van de `plan`-kolom en geldt voor iedereen met een lopende trial, ook als hun `plan` op `basis` staat. Na de trial (of eerder bij het bereiken van het plafond) valt dit weg, tenzij iemand `premium` of `team` is.

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

- Kolom `plan` (`text`, `NOT NULL`, `DEFAULT 'basis'`, `CHECK (plan IN ('basis','premium','team'))`) op Supabase-tabel `approved_users`.
- Admin-beheer: `/bot/admin/gebruikers`, 3-way toggle-knop per gebruiker (`PlanToggle.tsx` → `POST /api/admin/plan`). Geen self-serve upgradeflow, alles wordt handmatig door Arno gezet, zoals ook alle betalingen nu handmatig geregistreerd worden.
- Gating-logica: `app/api/chat/route.ts` (berichtlimiet, sessiegeheugen, coaching-context), `app/api/bot/coaching*` (coaching-toegang), `lib/voice.ts` (`hasVoiceAccess`, voice-toegang).
- De oude kolommen `tier` en `voice_enabled` staan (tijdelijk) nog in de database, maar worden nergens meer door de code gelezen. Ze worden gedropt zodra de regressietest van de migratie volledig is afgerond en bevestigd (zie `docs/VOICE_PLAN.md`).

---

## Openstaande vragen / nog niet besloten

- Prijsstaffel voor `team`.
- Of en wanneer `/prijzen` wordt bijgewerkt naar de drie-lagen-structuur (blokkeert op de betaalprovider-keuze, zie `docs/VOICE_PLAN.md` fase 3).
- Of er ooit een betaalde tussenlaag komt zonder voice (zie "Belangrijke toelichting" hierboven) — op dit moment bewust niet aan de orde.
- Migratie/communicatie richting bestaande betalende klanten die met deze wijziging stilzwijgend voice-toegang erbij hebben gekregen zonder daar apart voor te betalen (zie "Belangrijke toelichting" hierboven) — nog geen besluit of/hoe dit gecommuniceerd wordt.

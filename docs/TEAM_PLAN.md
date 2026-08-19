# Team-module — projectplan

**Laatst bijgewerkt:** 2026-08-19
**Waar we staan:** Fase 1 (drill-down, activiteitssignalen, 1:1-voorbereiding, teamritme) staat al live, zie de bouwvolgorde-tabel hieronder. Nieuw traject gestart naar aanleiding van Thijs' feedback (manager-zelfcoaching-gat, zie `docs/SYSTEEMPROMPT_UPGRADE.md` Bron 3 voor de volledige, letterlijke feedback). Punt 7 (PDF-export teamniveau) is als eerste gebouwd en live (commit 2c0936af).
**Eerstvolgende stap:** punt 6 (apart datasegment voor coaching-op-de-coach) — het fundament waar punt 1 en 5 op bouwen, nog niet gestart.

## Bouwvolgorde manager-zelfcoaching-gat (besloten 2026-08-19)

| # | Wat | Status |
|---|---|---|
| 7 | PDF-export teamniveau | **Live** (commit 2c0936af) |
| 6 | Apart datasegment (coach-rol vs. verkoper-rol) | Volgt |
| 1 | Terugkoppeling op eigen 1:1's + acties | Volgt, bouwt op 6 |
| 5 | Coachende rol richting Thijs zelf als coach | Volgt, bouwt op 1 + 6 |
| 4 | Actieve sturing/handvatten (cultuur-pijler) | Volgt, contentlaag bovenop 5 |
| 2 | Instelbare vaste topics per teamlid | Volgt, zelfstandig |
| 3 | Instelling "wat MOET gedeeld worden" | **Besloten: niet bouwen**, zie hieronder |

**Waarom deze volgorde:** 7 is een losstaande, laag-risico quick win. 6 is geen zichtbare feature maar de architecturale voorwaarde voor 1/4/5: zonder scheiding zou Thijs' eigen coaching-als-verkoper vervuild raken met coaching-als-coach-data. 4 is inhoudelijk een contentlaag bovenop 5's synthese, geen aparte plek in de UI. 2 staat los en kan op elk moment.

## Punt 3 — besloten, niet bouwen (2026-08-19)

Arno's expliciete besluit: **optie A**, geen wijziging aan de bestaande belofte. Het join-scherm zegt nu al hard: "je manager ziet nooit wat je bespreekt, tenzij je het zelf deelt." Dat blijft ongewijzigd. Geen "moet delen"-instelling voor de manager, geen technische afdwinging. Als een teamlid niets deelt, is dat niets, punt.

**Verworpen alternatief:** een echte verplichte deel-categorie (optie B), met transparante communicatie vooraf op het join-scherm. Reden verwerping: dit tornt aan de kernbelofte die het vertrouwen in de hele Team-module draagt, en die belofte is de USP, niet een detail.

## Wat er al bestaat (onderzocht 2026-08-19, vóór dit traject startte)

**Frontend:** `app/bot/team/TeamClient.tsx` (managerdashboard), `app/bot/team/lid/[userId]/page.tsx` (teamlid-detail incl. 1:1-voorbereiding), `app/bot/team/join/page.tsx` (join-flow met het trust-scherm).

**Backend:** `app/api/bot/team/{create,join,status,dashboard,lid,1on1,1on1/save,1on1/note,ritme,scores,spotlight,share-analyse,notifications,dismiss-prompt}/route.ts`.

**1:1-voorbereiding (bouwsteen 1.3) nu:** `POST /api/bot/team/1on1` genereert een agenda (WAT GAAT GOED / AANDACHTSPUNT / ARNO ADVISEERT) op basis van coachingprofiel + laatste 2 analyses + laatste 3 `arnobot_1on1_log`-rijen + laatste 3 sessiesamenvattingen (nooit ruwe transcripten). Wordt pas opgeslagen na expliciete "BEWAAR DEZE 1:1"-klik. Geen gestructureerd actie/status-veld, alleen een vrij `notitie`-tekstveld. Geen feedback-naar-de-manager-over-zichzelf-als-coach bestaat nog niet.

**Privacy-/gate-mechanisme (bestaand, moet intact blijven bij elke volgende stap):** service-role key overal, autorisatie volledig in route-logica (geen RLS zichtbaar in de code). Manager-facing routes halen uitsluitend samenvattende velden op (`arnobot_coaching`, `arnobot_shared_analyses`, `arnobot_1on1_log`), nooit ruwe `arnobot_blog_sessions`-inhoud voor weergave. `arnobot_shared_analyses` is het enige bestaande "lid deelt zelf iets extra met manager"-mechanisme (opt-in, intrekbaar). `profiel.gebruik === 'individueel'` houdt iemand volledig buiten de team-UI, ook als hij lid is.

**Ontbreekt structureel (bevestigd, geen aanname):** geen kolom/mechanisme dat onderscheidt "dit gesprek was Thijs-als-verkoper" vs. "dit was Thijs-als-manager-die-over-coaching-praat". `arnobot_coaching`, `arnobot_coaching_scores`, `arnobot_coaching_history`, `arnobot_blog_sessions`, `arnobot_analyses` zijn allemaal puur op `user_id` gesleuteld, ongeacht context. Dit is precies wat punt 6 oplost.

**PDF-exportpatroon (nu tweemaal toegepast, teamlid- en teamniveau):** `@react-pdf/renderer`, dynamisch geïmporteerd in een losse download-knop-component (`DownloadOneOnOneButton.tsx` / `DownloadTeamPdfButton.tsx`), los PDF-documentcomponent met `@ts-nocheck` (react-pdf's typing-eigenaardigheden, bestaand, geaccepteerd patroon, ESLint staat op continue-on-error in dit repo), client-side blob-download. Bij een volgende PDF-export dit patroon hergebruiken, niet opnieuw uitvinden.

## Fase 1/2 (ouder, uit projectgeheugen, hier overgenomen voor volledigheid)

Privacymodel (fundament van alles): Verkoper ziet eigen gesprekken + eigen coaching-profiel + wat manager over hem ziet. Manager ziet coaching-profiel per lid (patronen, groeirichting), NOOIT gesprekken/quotes/klantnamen. ArnoBot admin (Arno) ziet alles. ArnoBot is de buffer: gesprek → synthese → coaching-profiel → manager.

| Stap | Wat | Status |
|---|---|---|
| 0 | Join-flow trust screen | Live |
| 1.1 | Per-lid drill-down | Live |
| 1.2 | Activiteitssignalen | Live |
| 1.3 | 1:1-voorbereiding | Live |
| 1.4 | Teamritme | Live |
| 2A | De Spiegel | Niet gestart |
| 2B | De Tijdlijn | Niet gestart |
| 2C | Manager als variabele | Niet gestart |

**Why:** Teamversie is een belangrijke uitbreiding van ArnoBot. Vertrouwen is de USP, zie punt 3 hierboven, breek dat en het hele product valt.
**How to apply:** nooit manager-toegang tot ruwe gesprekken geven, ook niet indirect. Altijd via de synthese-laag.

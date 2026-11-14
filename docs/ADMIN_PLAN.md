# Admin opruimen en versterken

**Laatst bijgewerkt:** 2026-11-14

**Waar we staan:** de audit van alle admin-tabs is gedaan (vier agents, de zwaarst wegende bevindingen zelf nagelopen). Ronde 1 is af: de stille afkapping op 1000 rijen en de UTC-dagfilters zijn opgelost, met een blokkerende CI-controle die herhaling voorkomt. De SQL voor ronde 2 staat klaar en moet door Arno in Supabase worden gedraaid.

**Eerstvolgende stap:** Arno draait `docs/sql/2026-11-14-admin-log-en-cron-runs.sql`. Daarna ronde 2: B (logboek en bevestigingen voor geld en toegang) en C (afhakerslijst, betaalgeschiedenis, betere ANALYSE-context, cron-gezondheid, feedback in Gesprekken).

## Voortgang

- [x] Audit alle tabs (USERS, TEAMS, GESPREKKEN, ANALYSE, META, STATUS, STATS, CRONS, TEMP, FEEDBACK, KENNISBANK, BLOGS, POSTS)
- [x] Tabs Analyses en Coaching op de Gesprekken-pagina, coachinghistorie volledig bewaard
- [x] Vier eerste fixes: exports zonder testaccounts, ontwikkelpunten niet meer `[object Object]`, cronoverzicht uit `vercel.json` met test, MRR uit `arnobot_subscriptions`
- [x] **Ronde 1 (A):** `lib/haalAlleRijen.ts` (blokken van 1000), `lib/nlTijd.ts` (dagen op Amsterdamse tijd), `scripts/check-row-limit.mjs` (blokkerend in CI)
- [ ] SQL ronde 2 gedraaid door Arno (`arnobot_admin_log`, `cron_runs`)
- [ ] **Ronde 2 (B):** auditlog op BETAALD, terugbetalen, plan, teamrol, SD-agent, gratis toegang, aan/uit, Teams-instellingen; bevestiging op BETAALD; waarschuwing bij terugbetalen na 14 dagen; Teams-formulier valideert vóór het opslaat
- [ ] **Ronde 2 (C):** afhakerslijst in USERS, betaalgeschiedenis per gebruiker, ANALYSE met coachinghistorie en "nieuwe gesprekken sinds deze analyse", cron-gezondheid (`cron_runs`), feedback (duimpje) zichtbaar in Gesprekken
- [ ] **Ronde 3 (D):** menu opruimen (FEEDBACK naar Gesprekken en STATS, BLOGS en POSTS samen, CRONS hernoemen, TEMP afhankelijk van de voice-test)

## Besluiten en verworpen alternatieven

- **Gekozen:** alle queries die alle rijen van een groeitabel nodig hebben lopen via `haalAlleRijen` (blokken van 1000, vaste volgorde op `id`). **Verworpen: `.limit()` verhogen**, want de database kapt toch af op 1000 (gemeten 2026-11-14: `blog_chunks` heeft 1540 rijen, een select met `.limit(5000)` gaf er 1000). **Verworpen: nu SQL-aggregaten**, want de tabellen zijn klein (rds_logs 585 rijen); heroverwegen rond de 10.000 rijen.
- **Gekozen:** `scripts/check-row-limit.mjs` blokkeert in CI, anders dwingt het niets af. Bewuste bovengrenzen (`.limit(N)` met N ten hoogste 1000) en per-gebruiker-queries zijn toegestaan, andere legitieme gevallen komen met een reden in `KNOWN_SAFE`.
- **Gekozen:** dagen op Nederlandse tijd (`Europe/Amsterdam`, met zomer- en wintertijd), einde van een periode is het begin van de volgende dag (`.lt`). **Verworpen: Lisboa**, want de mailtijden en alle bestaande communicatie staan al op Nederlandse tijd. De database leest een tijd zonder zone als UTC (gemeten).
- **Gekozen:** de drie tabs Gesprekken, Analyses en Coaching met gedeeld filter op `/bot/admin`. **Verworpen: een aparte gebruikerspagina**, besluit van Arno 2026-11-13, niet heropenen.
- **ARNO.BLOG** is door Arno zelf verwijderd (commit `5327e10e`), dus niet meer meenemen in het opruimen.
- **MRR:** alleen `active` solo-abonnementen, zonder aangevraagde opzegging, exclusief btw, jaarlijks gedeeld door 12 (`lib/mrr.ts`). Team telt niet mee, want daar is geen vaste maandwaarde uit af te lezen.

## Open vragen voor Arno

1. **Voice-test onder TEMP:** nog in gebruik? Bepaalt of die pagina en twee routes weg kunnen (ronde 3).
2. **Team in de MRR:** wel meetellen? Dan eerst de prijsregel van een team vastleggen.
3. **Actie-uitdaging (`api/bot/uitdaging/route.ts`):** gebruikt het coachingprofiel alleen als `focus` of `blinde_vlekken` gevuld is, en nieuwe rapportages hebben die velden niet. Wil je dat aanpassen?
4. **STUUR TEST op de CRONS-pagina** draait de echte cron (meta-analyse is een volledige AI-run). Laten staan of per cron een droge-run-optie?

## Bekend, niet door deze trajecten opgelost

- `scripts/check-missing-user-filter.mjs` meldt `lib/waarheidsRapport.ts:70`. Het is bedoeld gebruikersoverstijgend (steekproef), dus toevoegen aan `KNOWN_SAFE_QUERIES` of er een filter bij.
- Niet nagelopen agentbevindingen: STATUS-tegel "PERFORMANCE" toont uptime, BlogStats doet ongeveer 40 telqueries per paginalading, META heeft een eigen "gebruikers"-jurylid op duimpjes dat FEEDBACK overlapt.

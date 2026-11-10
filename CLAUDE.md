# Claude Code — project instructies

> **Dit bestand bevat alleen geldende regels.** Historische context, incidentverslagen, afgeronde acties ("Gedaan") en de onderbouwing van besluiten staan in `docs/CLAUDE_HISTORY.md`, dat niet elke sessie wordt ingeladen. Nieuwe geschiedenis hoort daar of in het betreffende plandocument, niet terug in dit bestand.

## Sessie-start en -overdracht — ALTIJD

Voortgang op meerdaagse trajecten leeft niet in het gesprek, maar in bestanden en git. Een sessie houdt geen geheugen over de vorige; alleen wat in bestanden en git staat, bestaat nog bij de volgende sessie.

Meerdaagse plandocumenten (bv. `docs/VOICE_PLAN.md`, `docs/MOBILE_PLAN.md`) hebben bovenaan een statusblok: **Laatst bijgewerkt**, **Waar we staan**, **Eerstvolgende stap**, plus een afvinklijst per fase.

**Bij de start van elke sessie waarin aan zo'n traject wordt gewerkt:** lees de statusblokken van de relevante documenten, vat in twee zinnen samen waar het traject staat en wat de eerstvolgende stap is, en wacht op akkoord voordat je verdergaat.

**Aan het einde van zo'n sessie:** werk de statusblokken bij (laatst bijgewerkt, waar we staan, eerstvolgende stap, afvinklijst), inclusief openstaande punten en genomen besluiten.

**Besluiten én verworpen alternatieven expliciet noteren**, niet alleen afgeronde taken. Bijvoorbeeld: "Gekozen: X. Verworpen: Y, want Z." Dit voorkomt dat een latere sessie hetzelfde vraagstuk opnieuw opent en anders beslist, dat sluipende heen-en-weer is de grootste voortgangskiller bij lange trajecten.

**Git als onafhankelijke controle:** kleine commits met duidelijke berichten per afgeronde stap, zodat git log altijd laat zien wat er echt gebeurd is, los van wat een statusblok beweert.

**Periodieke verse controle:** aan het eind van een fase een nieuwe sessie of subagent, zonder de aannames van de bouwsessie, laten verifiëren dat de statusblokken kloppen met de werkelijke code. Bewust lichtgewicht: geen extra hooks of automatisering.

**Hoofdmap op master:** de hoofdmap `C:Usersarnoarnobot` staat op `master`. Werk aan een andere tak (bv. `team-voorbeeld`) in een aparte worktree, niet door de hoofdmap om te zetten. Controleer bij de start van een sessie `git status` en `git rev-list --left-right --count origin/master...HEAD`, en meld het aan Arno als de hoofdmap niet op master staat of achterloopt. Android-wijzigingen (gradle, manifest, iconen, versiecode) worden dezelfde dag op master gecommit, niet als losse wijzigingen in de werkmap achtergelaten. (Achtergrond: 28 identieke niet-gecommitte Android-kopieën op een tak die 70 commits achterliep, 2026-11-10, zie `docs/CLAUDE_HISTORY.md`.)

## Documentatie actueel houden — ALTIJD

Drie documenten met elk een eigen doel en actualiteitsrisico, naast de plandocumenten hierboven:

- **`docs/ARNOBOT_OVERZICHT.md`**: product-uitleg voor buiten de bouwsessie om (presentatie, briefing, investeerdersgesprek). Volledig handmatig.
- **`docs/TECHNICAL_HANDOVER.md`**: developer-overdracht. De AI-modelinventaris en package-versietabel worden automatisch op de 1e van elke maand bijgewerkt door `app/api/cron/update-handover/route.ts` (leest de modeltabel uit `docs/MODELINVENTARIS.md`). De rest van het document is NIET automatisch.
- **`docs/BUSINESS_HANDOVER.md`**: business/ops-overdracht. Alleen de "laatst bijgewerkt"-datum wordt automatisch aangeraakt; de inhoud zelf (kosten, accounttoegang, `[ARNO]`-secties) is Arno's eigen verantwoordelijkheid.

**PDF-versies:** de meeste `docs/*.md` hebben een `.pdf`-buur (voor NotebookLM, presentaties, delen). Na een inhoudelijke wijziging aan zo'n doc: `npm run docs:pdf` (rendert alleen de docs waarvan de inhoud is gewijzigd, o.b.v. sha256 in `docs/.pdf-render-state.json`, dus veilig om altijd te draaien), of `npm run docs:pdf -- docs/HET_BESTAND.md` voor één specifiek bestand, of `-- --force` voor alles. De nieuwe/gewijzigde `.pdf` én `.pdf-render-state.json` mee-committen. Script: `scripts/render-docs-pdf.mjs` (marked + puppeteer, merkstijl). Geen VS-Code-extensie meer nodig.

**Schrijfregel:** wanneer een sessie iets shipt dat de kernfunctionaliteit wijzigt, wordt `docs/ARNOBOT_OVERZICHT.md` in dezelfde commit bijgewerkt. Geen apart ritueel, net als de UI-stijlregel en de e-mailtyperegel: bij elke relevante sessie opnieuw toegepast.

**Reikwijdte (aangescherpt 2026-08-29):** de schrijfregel geldt bij **echt nieuwe of verdwenen functionaliteit** (nieuwe module, nieuwe rol-flow, prijswijziging, nieuwe AI-capability, een feature die weggehaald wordt) en bij een naamswijziging van een pagina/feature/label. In die gevallen: in dezelfde commit `docs/ARNOBOT_OVERZICHT.md` bijwerken, plus `docs/TECHNICAL_HANDOVER.md` als de wijziging een route/feature raakt die daar beschreven staat. Voor **kleine aanpassingen aan bestaande features** (toon van een AI-tekst, een drempelwaarde, een zichtbaarheidsregel, gedrag van een knop): geen aparte docs-edit verplicht, wel een duidelijk commitbericht. Het wekelijkse maandagvangnet vangt op wat daarvan tóch in de docs had gemoeten. Bij twijfel of iets "echt nieuw" is: kort bij Arno checken.

**Vaste regel bij het hernoemen van een pagina, feature of knop-label:** doe in dezelfde sessie een sitebrede tekstzoekopdracht op de oude naam, over UI-copy, `lib/email-templates.ts`, `lib/systemPrompt.ts`, `app/bot/qa/QAClient.tsx` én alle docs, niet alleen de plek waar de rename bedacht is. Bij elke rename opnieuw toegepast. (Achtergrond: de BIEB → Archief → ANALYSES-vondst, zie `docs/CLAUDE_HISTORY.md`.)

**App-uitleg voor ArnoBot (sinds 2026-10-21):** `lib/appHelp.ts` is de uitleg over het gebruik van de app die in de systeemprompt van de hoofdchat staat, zodat ArnoBot vragen over de app (microfoon, STUUR, SLUIT, antwoordlengte, de route, Sparren, proefperiode, opzeggen, referral) uit de bron beantwoordt in plaats van te gokken. **Verandert een knop, functie of werkwijze, werk `appHelp.ts` dan in dezelfde commit bij**, net als bij de renameregel hierboven. Geen prijzen of bedragen erin. Vult ArnoBot een vraag niet goed in, dan komt die via de dagelijkse Telegram-cron `/api/cron/productvragen` bij Arno terecht en wordt het blok aangevuld. De Q&A-pagina (`QAClient.tsx`) is een aparte tekst voor schermgebruik en blijft los daarvan bestaan.

**Automatisch vangnet:** een wekelijkse cloud-routine (`trig_01CMpoZo9fPi6DBNpCnwADRw`, elke maandag 08:00) doorloopt alle `docs/*.md` (via Glob) plus `app/bot/qa/QAClient.tsx`, `lib/email-templates.ts` en `lib/systemPrompt.ts`, vergelijkt ze met de commits van de afgelopen 7 dagen, en opent bij drift één PR met concrete tekstvoorstellen ter beoordeling door Arno (nooit een blinde auto-commit). Checkt eerst met `gh pr list` of er al een open versheids-PR is en werkt die bij. Uitzonderingen die de routine nooit aanraakt: `docs/AUDIT_FINDINGS.md`, `docs/CLAUDE_HISTORY.md`, `docs/OPENSTAANDE_PUNTEN.md` (bewuste momentopname, wordt bij de kwartaalcheck gereconcilieerd), `CLAUDE.md` zelf, tekst binnen `[ARNO: ...]`, checklists die zeggen "alleen Arno kan dit invullen", en nieuwe prijsvoorstellen in `PRICING_DECISIONS.md` (alleen consistentiecheck). Documenten met een eigen statusblok alleen bij een harde tegenstrijdigheid. Bij twijfel: geen wijziging, wel een open vraag in de PR-body. Schone week: stil, geen PR. Dit vervangt de doorlopende schrijfregel niet, het is het vangnet. (Volledige geschiedenis incl. de teruggedraaide push-trigger: `docs/CLAUDE_HISTORY.md`.)

## Maandelijkse check — roep aan met "doe de maandcheck"

Voer onderstaande punten volledig uit. Rapporteer elk punt expliciet (OK / aandacht nodig / actie vereist).

**Automatisch (sinds 2026-10-12):** een cloud-routine (`trig_01TEwYKKnPgDsKKhXDrm3hoM`, elke 1e van de maand 07:00 UTC, beheer https://claude.ai/code/routines) voert secties 1 t/m 7 alleen-lezen uit en zet het rapport als GitHub-issue (via `gh api`); `.github/workflows/notify-issue.yml` stuurt daar een Telegram-melding bij (hoofdroute, GitHub-mail is het tweede kanaal). In januari, april, juli en oktober draait de routine ook de kwartaalcheck (secties 8 t/m 11, voorstellen in het rapport i.p.v. bijwerken). Het rapport bevat dashboardchecks die alleen Arno achter een login kan doen. Handmatig aanroepen met "doe de maandcheck" of "doe de kwartaalcheck" blijft mogelijk. Achtergrond en verworpen alternatieven: `docs/CLAUDE_HISTORY.md`.

**Werkwijze:** voer de secties uit als parallelle subagents, één per sectie, via de Agent-tool, niet sequentieel in je eigen context. Sneller, grondiger, voorkomt dat context vol raakt waardoor latere secties oppervlakkiger worden nagelopen.

### 1. Beveiliging
- `npm audit --production` — nieuwe high/critical kwetsbaarheden in runtime-code?
- Controleer of alle API-routes nog auth hebben (nieuwe routes kunnen dit missen)
- Check of error-responses nog geen interne details lekken
- Controleer `proxy.ts` op volledigheid van scanner-blokkering
- **RLS-status:** Supabase-dashboard → Database → Tables, scan de kolom RLS op "Disabled". Alle ~41 tabellen horen RLS aan te hebben (zonder policies, veilig zolang de app uitsluitend de service-role-key gebruikt). Achtergrond: het RLS-incident van 2026-08-20 in `docs/CLAUDE_HISTORY.md`. Een "Gedaan"-notitie is alleen betrouwbaar zolang iemand 'm opnieuw verifieert.
- **Wezen-routes:** bekijk de laatste CI-run van `scripts/check-orphan-routes.mjs` i.p.v. handmatig te grep'en. Bevestigde legitieme gevallen → `KNOWN_MANUAL_ROUTES`/`KNOWN_EXTERNAL_PREFIXES` in het script.
- **Ontbrekende-eigenaarschapsfilter:** bekijk de laatste CI-run van `scripts/check-missing-user-filter.mjs`. Bevestigde legitieme gevallen → `KNOWN_SAFE_QUERIES` in het script.
- **Testaccount-filter:** bekijk de laatste CI-run van `scripts/check-testaccount-filter.mjs` (admin-/cron-queries over gebruikersdata die de interne testaccounts niet uitsluiten). Bevestigde legitieme gevallen → `KNOWN_SAFE` in het script. Achtergrond: de testdata-in-analyses-vondst van 2026-08-30 in `docs/CLAUDE_HISTORY.md`.

### 2. Dependencies & tooling
- Major versie-updates beschikbaar voor Next.js, Clerk, Supabase client, Anthropic SDK, Voyage AI SDK?
- Analyseer breaking changes vóór je iets aanbeveelt — nooit blind updaten
- **Auto-merge:** `.github/workflows/dependabot-auto-merge.yml` merget zelf de Dependabot-PR's die (a) alleen `package.json`/`package-lock.json` raken, (b) geen major-bump zijn en (c) waar npm audit, TypeScript, Vitest én de Vercel-build groen zijn. Bij de maandcheck blijven dus alleen de major-bumps en de PR's met een rode betekenisvolle check over. Riskante minors staan al op de ignore-lijst in `.github/dependabot.yml`.
- Check de resterende open Dependabot-PRs via een agent (`gh api`) die per PR het breaking-change-risico samenvat
- **Bekend en geaccepteerd (herzien 2026-10-31):** `npm audit` toont nog 7 moderate meldingen, allemaal build-tooling (`minimatch` via `@capacitor/cli` en de Sentry-bundlerplugins) en runtime-onschadelijk; maak daar geen ACTIE-issue van. Een rode CI-workflow "Security Audit" is wél een signaal (stond ooit 22 runs rood zonder dat het opviel): bekijk de laatste run expliciet. Gerepareerd wordt gericht binnen de hoofdversie, nooit met een brede `npm audit fix`. Details: `docs/CLAUDE_HISTORY.md`.
- Een falende "Playwright E2E"-check op een Dependabot-PR is bekend en onschadelijk (GitHub geeft Dependabot-workflows geen secrets), de auto-merge negeert die bewust. TypeScript, Vitest, ESLint en npm audit zijn wél betekenisvol. Zie `docs/CLAUDE_HISTORY.md`.

### 3. AI-modelinventaris
- Zie de modelinventaris-tabel in `docs/MODELINVENTARIS.md` (niet in dit bestand: het is naslag, geen regel; `update-handover` en `model-check` lezen hem daar). Dekt de Anthropic chat-modellen, Voyage AI embedding/rerank (RAG), OpenAI spraak (transcriptie) en AssemblyAI (audiobijlage-transcriptie in de hoofdchat).
- Nieuwere of betere modellen beschikbaar bij Anthropic of Voyage AI? Beoordeel op kwaliteit eerst, dan pas kosten.
- **Vaste regel:** elke nieuwe externe AI/API-leverancier wordt in dezelfde commit toegevoegd aan deze check en aan de modelinventaris-tabel. Geen uitzondering. (Voyage AI, Sentry, Upstash en OpenAI zijn alle vier ooit toegevoegd zonder dat de check werd bijgewerkt.)
- **Verplichte verificatiestap:** verifieer dat de tabel nog klopt met de code. Zoek via de import-graph (elk bestand dat een AI-SDK importeert, en wat er precies wordt aangeroepen — niet alleen op `.messages.create(` grep'en, want dat mist `.messages.stream(`) en check `package.json` op AI-dependencies die nergens geïmporteerd worden.
- **Automatische kennisbankcontroles (sinds 2026-11-01):** (1) dagelijkse cron `/api/cron/kennisbank-controle` (06:55 UTC, `lib/kennisbankControle.ts`): drie vaste kernvragen moeten elk minimaal 60 kandidaten opleveren (normaal 100), geen fragment zonder embedding, minimaal 1400 fragmenten; meldt alleen bij een probleem via Telegram. (2) wekelijks in de maandagrun van CI `scripts/check-kennisbank-sync.mjs`: elk document in `docs/kennisbank/` moet in `blog_chunks` staan. Een nieuw kennisdocument eerst inladen met `node scripts/embed-single-doc.mjs docs/kennisbank/<bestand> "Kennisbank: <titel>"`, het bestand alleen in de map zetten is niet genoeg. Een kennisdocument aanpassen: bewerk het bestand en draai hetzelfde commando met hetzelfde label opnieuw, dat vervangt de oude versie (geen dubbele fragmenten). Bij de maandcheck alleen controleren dat deze twee draaien en groen zijn.
- **Recall-check kennisbank (sinds 2026-11-01):** `match_blog_chunks` met `match_count: 100` moet voor een gewone vraag rond de 100 fragmenten teruggeven. Gaf er 4 tot 34 door een ivfflat-index met probes=1 op `blog_chunks` (verwijderd, zie `docs/sql/2026-11-01-blog-chunks-index-verwijderen.sql`). Na elke wijziging aan indexen of de zoekfuncties dit opnieuw meten; bij groei boven ongeveer 30.000 fragmenten een HNSW-index, nooit ivfflat met standaard probes.
- **Embedding-consistentiecheck:** voor elke kolom die een embedding-vector opslaat (nu `arnobot_blog_sessions.embedding`), steekproefsgewijs verifiëren dat alle rijen uit hetzelfde model komen (embed losse queries opnieuw met het huidige model, vergelijk cosine-similarity met de opgeslagen vector op exact dezelfde brontekst: dicht bij 1,0 = zelfde model). Achtergrond: het model-mix-incident in `docs/CLAUDE_HISTORY.md`.

### 4. Infrastructuur

**Werkregel:** een deprecation-melding in een dashboard of changelog = direct opnemen als actiepunt, niet uitstellen naar de volgende check.

#### Mijlpalen (sinds 2026-11-04)
De dagelijkse capaciteitswacht en de uurlijkse database-wacht (Telegram bij 70% en 90%) staan beschreven in `docs/CAPACITEIT.md`. Nieuwe mailverzender = `telMail()` aanroepen (`lib/mail.ts`). Mijlpalen, eenmalig gemeld:
- **50 actieve gebruikers:** Clerk inactivity timeout (plus session limits aanscherpen) en WhatsApp-supportnummer naar het WhatsApp Business Platform (API) met helpdesktool en echte DPA met Meta. Vercel Firewall en Resend Pro zijn al geregeld.
- **75 actieve gebruikers:** belastingtest met ingelogde gebruikers en de echte AI-chat (geschatte kosten 15 tot 45 dollar). Eerst controleren: Anthropic-tegoed, Upstash-plan, Resend Pro, Supabase-servergrootte; Upstash daarna in de capaciteitswacht. Gekozen: wachten tot 75. Verworpen: nu al testen, want zonder echte gebruikers meet dat te weinig. Achtergrond en testresultaat publieke pagina's: `docs/CAPACITEIT.md`.
- **150 actieve gebruikers:** Supabase PITR ($100/maand extra), direct met restore-test (recente backup terugzetten in een tijdelijk project, tabellen/rijen/encoding checken, project verwijderen). Drempel automatisch in Abacus (`TARIEVEN.supabasePitrDrempel`).
- **Blog:** Resend Pro bij ~50 bevestigde abonnees, dan `BLOG_DAILY_MAIL_BUDGET` verhogen (dagbudget in `lib/blogMail.ts`).

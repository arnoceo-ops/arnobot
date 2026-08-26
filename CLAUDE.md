# Claude Code — project instructies

## Sessie-start en -overdracht — ALTIJD

Voortgang op meerdaagse trajecten leeft niet in het gesprek, maar in bestanden en git. Een sessie houdt geen geheugen over de vorige; alleen wat in bestanden en git staat, bestaat nog bij de volgende sessie.

Meerdaagse plandocumenten (bv. `docs/VOICE_PLAN.md`, `docs/MOBILE_PLAN.md`) hebben bovenaan een statusblok: **Laatst bijgewerkt**, **Waar we staan**, **Eerstvolgende stap**, plus een afvinklijst per fase.

**Bij de start van elke sessie waarin aan zo'n traject wordt gewerkt:** lees de statusblokken van de relevante documenten, vat in twee zinnen samen waar het traject staat en wat de eerstvolgende stap is, en wacht op akkoord voordat je verdergaat.

**Aan het einde van zo'n sessie:** werk de statusblokken bij (laatst bijgewerkt, waar we staan, eerstvolgende stap, afvinklijst), inclusief openstaande punten en genomen besluiten.

**Besluiten én verworpen alternatieven expliciet noteren**, niet alleen afgeronde taken. Bijvoorbeeld: "Gekozen: X. Verworpen: Y, want Z." Dit voorkomt dat een latere sessie hetzelfde vraagstuk opnieuw opent en anders beslist, dat sluipende heen-en-weer is de grootste voortgangskiller bij lange trajecten.

**Git als onafhankelijke controle:** kleine commits met duidelijke berichten per afgeronde stap, zodat git log altijd laat zien wat er echt gebeurd is, los van wat een statusblok beweert.

**Periodieke verse controle:** aan het eind van een fase een nieuwe sessie of subagent, zonder de aannames van de bouwsessie, laten verifiëren dat de statusblokken kloppen met de werkelijke code (bv. "het document zegt fase 1 af, maar staat de tekenteller nog als TODO in de code"). Geen extra hooks of automatisering hiervoor optuigen, dit is bewust lichtgewicht: statusblokken, deze werkafspraak, en discipline in kleine commits volstaan voor een traject van deze omvang.

## Documentatie actueel houden — ALTIJD

Drie documenten hebben elk een eigen doel en een eigen actualiteitsrisico, naast de meerdaagse plandocumenten hierboven:

- **`docs/ARNOBOT_OVERZICHT.md`**: product-uitleg voor buiten de bouwsessie om (presentatie, briefing, investeerdersgesprek). Volledig handmatig, geen enkele automatisering.
- **`docs/TECHNICAL_HANDOVER.md`**: developer-overdracht. De AI-modelinventaris en package-versietabel worden al automatisch bijgewerkt op de 1e van elke maand door `app/api/cron/update-handover/route.ts` (leest de modeltabel rechtstreeks uit dit CLAUDE.md-bestand, dus die twee kunnen niet uit de pas lopen). De rest van het document (routes, features, tabellen) is NIET automatisch.
- **`docs/BUSINESS_HANDOVER.md`**: business/ops-overdracht. Alleen de "laatst bijgewerkt"-datum wordt automatisch aangeraakt door dezelfde cron; de inhoud zelf (kosten, accounttoegang, `[ARNO]`-secties) is en blijft Arno's eigen verantwoordelijkheid, niet iets om automatisch te vullen.

**Regel, zelfde patroon als de UI-stijlnormen en de e-mailtypes hierboven:** wanneer een sessie iets shipt dat de kernfunctionaliteit van het product wijzigt (nieuwe module, nieuwe rol-flow, prijswijziging, nieuwe AI-capability), wordt `docs/ARNOBOT_OVERZICHT.md` in dezelfde commit bijgewerkt. Geen aparte herinnering hiervoor nodig, geen wekelijks ritueel: het is een schrijfregel die bij elke relevante sessie opnieuw wordt toegepast, net zoals de UI-stijlregel en de e-mailtyperegel dat al zijn.

**Vaste regel bij het hernoemen van een pagina, feature of knop-label (toegevoegd 2026-08-26):** doe in dezelfde sessie een sitebrede tekstzoekopdracht op de oude naam, over UI-copy, e-mailtemplates (`lib/email-templates.ts`), systeemprompts (`lib/systemPrompt.ts`), de Q&A (`app/bot/qa/QAClient.tsx`) én alle docs, niet alleen de plek waar de rename bedacht is. **Reden:** de gesprekken/patroonanalyse-pagina heette intern eerst BIEB, toen Archief, en staat nu overal in de navigatie als ANALYSES, maar vier Q&A-antwoorden, een live recurring e-mail (inclusief CTA-link naar een inmiddels alleen via een 308-redirect bereikbare URL), het evaluatieformulier (Archief én Analyses als twee losse, dubbele opties), de ElevenLabs-systeeminstructie en meerdere documentatiebestanden bleven op de oude naam hangen. Niemand deed die sweep op het moment van de rename zelf, en geen enkele latere audit haalt dat net zo goedkoop in als op dat moment. Zelfde soort schrijfregel als de twee hierboven: bij elke rename opnieuw toegepast, geen apart ritueel nodig.

**Automatisch vangnet, agent (aangemaakt 2026-08-22, verbreed naar alle docs dezelfde dag, verbreed naar de in-app FAQ op 2026-08-25, verbreed naar e-mailtemplates en systeemprompts op 2026-08-26 na de BIEB/Archief/Analyses-vondst hierboven):** een wekelijkse cloud-routine (`trig_01JzhR9LK17sT5g1MfQVSa9N`, elke maandag 08:00 UTC, zelfde RemoteTrigger-mechanisme als de maandelijkse architectuur-audit hierboven) doorloopt ALLE bestanden in `docs/*.md` (via Glob, geen vaste lijst, dus een nieuw docs-bestand wordt vanzelf meegenomen), plus drie vaste, hardcoded extra doelbestanden buiten `docs/` die de Glob nooit zou raken: `app/bot/qa/QAClient.tsx` (de `FAQ_GROUPS`-array die gebruikers in de app zien, sinds 2026-08-25), `lib/email-templates.ts` en `lib/systemPrompt.ts` (sinds 2026-08-26), en vergelijkt ze met de commits van de afgelopen 7 dagen. Reden voor die uitbreiding: de FAQ-tekst over "kan ik een gedeelde link intrekken" bleef "nog niet mogelijk" zeggen terwijl die functie al gebouwd was, dezelfde soort stale-tekst-fout als deze routine al voor `docs/*.md` ving, alleen dan in een bestand buiten `docs/` dat de Glob nooit zou raken. Voor QAClient.tsx geldt een eigen controlemethode (vergelijk elk antwoord rechtstreeks tegen de code, niet tegen een ander document) en een eigen terughoudendheid: geen compleet nieuwe FAQ-vragen toevoegen, alleen bestaande antwoorden corrigeren, tenzij het ontbreken zonder toevoeging ronduit misleidend zou zijn. Twee vaste uitzonderingen: `docs/AUDIT_FINDINGS.md` (outputbestand van de maandelijkse routine) en `CLAUDE.md` zelf (al doorlopend + maandelijks bewaakt). Per document geldt een mandaat: tekst binnen `[ARNO: ...]`-markeringen en checklists die zelf zeggen "alleen Arno kan dit invullen" (bijv. `BUSINESS_HANDOVER.md`'s invulpunten) worden nooit aangepast; `PRICING_DECISIONS.md` krijgt alleen een consistentiecheck (bedragen tegen `lib/kostenTarieven.ts`, statusregels tegen echte code), nooit een nieuw prijsvoorstel; het narratieve deel van `BUSINESS_HANDOVER.md` (verdienmodel, productbeschrijving) mag wel bijgewerkt worden; documenten met een eigen statusblok worden alleen bij een harde tegenstrijdigheid aangeraakt, niet herschreven. Bij twijfel of iets binnen het mandaat valt: geen wijziging, wel een open vraag in de PR-body (Arno's expliciete instructie: onduidelijkheid mag gewoon gevraagd worden, niet gegokt of overgeslagen). Bij een schone week: stil, geen PR. Bij een relevante mismatch schrijft de routine zelf een concreet voorstel voor de tekstwijziging en opent daar een pull request voor, ter beoordeling door Arno vóór merge, nooit een blinde auto-commit van proza. Bij een schone week: stil, geen PR. Dit vervangt de doorlopende regel hierboven niet, het is het vangnet voor wat daar toch doorheen glipt, zelfde soort backstop als bij RLS/orphan-routes/embedding-consistentie. Voor bredere, minder mechanische kwaliteitschecks (zoals of een nieuwe rol overal consistent is doorgevoerd): zie de "Professionaliteitscheck" verderop in dit bestand, die is bewust wél oproepbaar en niet stil geautomatiseerd, want dat vereist semantisch oordeel dat deze routine niet kan geven.

## Maandelijkse check — roep aan met "doe de maandcheck"

Voer onderstaande punten volledig uit. Rapporteer elk punt expliciet (OK / aandacht nodig / actie vereist).

**Werkwijze (besloten 2026-07, na een audit die aantoonde dat sequentieel doorlopen in één context dingen mist):** voer de secties hieronder uit als parallelle subagents, één per sectie, via de Agent-tool, in plaats van sequentieel in je eigen context af te werken. Sneller, grondiger, en voorkomt dat context vol raakt tijdens een lange doorloop waardoor latere secties oppervlakkiger worden nagelopen dan eerdere.

### 1. Beveiliging
- `npm audit --production` — zijn er nieuwe high/critical kwetsbaarheden in runtime-code?
- Controleer of alle API-routes nog auth hebben (nieuwe routes kunnen dit missen)
- Check of error-responses nog geen interne details lekken
- Controleer `proxy.ts` op volledigheid van scanner-blokkering
- **RLS-status controleren:** Supabase-dashboard → Database → Tables, scan de kolom RLS op "Disabled". Bekende valkuil hieronder, dit stond eerder ten onrechte als "Gedaan" genoteerd zonder dat iemand het nog had geverifieerd.
- **Incident gevonden en gefixt (2026-08-20):** de juli-2026-notitie hieronder ("RLS ingeschakeld") bleek feitelijk onjuist. Bij het bouwen van de teammodule (`docs/TEAM_PLAN.md`, punt 6) bleek RLS in werkelijkheid op vrijwel alle ~40 tabellen nog op **Disabled** te staan, inclusief `approved_users`, `arnobot_blog_sessions`, `arnobot_coaching`. Oorzaak: `lib/supabase.ts` bevat wel een kant-en-klare Clerk-JWT-Supabase-client (het mechanisme dat RLS-policies nodig hebben), maar die is nooit ergens in de app geïmporteerd of aangeroepen, elke route gebruikt nog steeds de service-role-key rechtstreeks. Het juli-werk is dus halverwege blijven steken: de voorbereiding stond er, de daadwerkelijke aanzet-actie in Supabase is er nooit gekomen, en niemand heeft dat sindsdien gecontroleerd. **Ernst:** structureel een reële blootstelling (elke tabel zonder databaselaag toegankelijk voor wie de publieke anon-key zou hebben), maar waarschijnlijk nooit praktisch actief te misbruiken: de publieke anon-key wordt alleen gerefereerd in het ongebruikte `lib/supabase.ts`, dus is vermoedelijk nooit daadwerkelijk in een naar bezoekers verstuurde JS-bundle terechtgekomen. Geen zekerheid, geen aanwijzing voor misbruik gevonden. **Fix:** RLS aangezet (`alter table ... enable row level security`) op alle ~41 tabellen, zonder policies, dat is voldoende en veilig zolang de app uitsluitend de service-role-key gebruikt (die RLS altijd omzeilt). **Bijvangst:** `arnobot_meta` tabel bleek helemaal niet te bestaan terwijl 3 plekken in de code (`rss-ingest`-cron, `scripts/embed-chunks.mjs`, kennisbank-adminpagina) er stil naar schreven/lazen zonder error-check, "laatste run"-timestamps werden dus nooit opgeslagen. Tabel alsnog aangemaakt. **Structurele les:** een "Gedaan"-notitie is alleen betrouwbaar zolang iemand 'm ooit opnieuw verifieert, niet aanneemt. Voeg de RLS-dashboardscan (bovenste bullet) daarom voortaan toe aan elke maandcheck, in plaats van te vertrouwen op deze historische notitie. **Aanvulling (2026-08-21):** RLS-zonder-policies is zelf ook maar een gedeeltelijke oplossing, de daadwerkelijke isolatie tussen gebruikers hangt nog steeds volledig af van een `.eq('user_id', userId)`-filter per route, zonder database-afgedwongen vangnet. Zie de "Ontbrekende-eigenaarschapsfilter-check" hierboven voor de geautomatiseerde achtervang die dit sindsdien bewaakt. Een echte multi-tenant RLS-implementatie (Clerk-JWT-policies per tabel, de al-aanwezige client in `lib/supabase.ts` daadwerkelijk inzetten) is een apart, groter traject, bewust nog niet opgepakt.
- **Wezen-routes-check:** sinds 2026-08-12 geautomatiseerd via `scripts/check-orphan-routes.mjs`, draait als informatieve (niet-blokkerende) CI-stap bij elke push/PR. Reden: `app/api/bot/sessions/embed/route.ts` bleek een sinds juni 2026 ongebruikte debug-route, twee maanden onopgemerkt, pas gevonden bij het opsporen van een ander bug. Bij de maandcheck: bekijk de laatste CI-run van deze stap i.p.v. het handmatig opnieuw te grep'en. Bevestigde legitieme gevallen (devtools-only routes, webhooks) toevoegen aan `KNOWN_MANUAL_ROUTES`/`KNOWN_EXTERNAL_PREFIXES` in het script zelf.
- **Ontbrekende-eigenaarschapsfilter-check:** sinds 2026-08-21 geautomatiseerd via `scripts/check-missing-user-filter.mjs`, draait als informatieve (niet-blokkerende) CI-stap bij elke push/PR. Reden: RLS staat aan op alle tabellen maar zonder policies (elke route gebruikt de service-role-key, die RLS altijd omzeilt, zie de RLS-notitie hieronder), dus isolatie tussen gebruikers hangt volledig af van een `.eq('user_id', userId)`-filter per route, zonder database-afgedwongen vangnet. Het script scant `app/api/**`, `app/bot/**` en `lib/**` (met uitzondering van admin/cron/login/test-routes, die bewust gebruikersoverstijgend queryen) op `.from()`-aanroepen op een vaste lijst gebruikersdata-tabellen en flagt elke query zonder `.eq()`/`.in()` op `user_id`/`manager_id`/`member_id` (of een variant daarvan) binnen dezelfde functie. Bevestigde legitieme gevallen (bv. een lookup van een andere gebruiker via een publieke referral-code, waarvan de data nooit teruggaat naar de aanroeper) toevoegen aan `KNOWN_SAFE_QUERIES` in het script zelf.
- **Gedaan (2026-08-12):** eerste vondst hiermee was `app/api/tts/route.ts`, inderdaad dood, zie de OpenAI-sectie verderop in dit bestand voor de volledige toedracht.

### 2. Dependencies & tooling
- Zijn er major versie-updates beschikbaar voor: Next.js, Clerk, Supabase client, Anthropic SDK, Voyage AI SDK?
- Analyseer breaking changes vóór je iets aanbeveelt — nooit blind updaten
- Check of Dependabot-PRs openstaan op GitHub en beoordeel ze. Gebruik hiervoor een agent die de open PR's ophaalt (`gh api`) en per PR het breaking-change-risico samenvat, in plaats van elke PR handmatig te doorlopen.
- **Bevinding (2026-08-08):** de "Playwright E2E (UI, gemockte AI)"-check faalt altijd op Dependabot-PR's, ongeacht wat de PR wijzigt (bevestigd op 5 PR's tegelijk, incl. volledig risicoloze types-only bumps). Oorzaak: GitHub Actions geeft workflows die door Dependabot getriggerd worden standaard geen toegang tot repository secrets (`Missing publishableKey` van Clerk), een beveiligingsmaatregel van GitHub zelf, geen probleem in de dependency-bump. TypeScript typecheck, Vitest, ESLint en npm audit zijn wél betekenisvol op Dependabot-PR's. Bij het beoordelen van een Dependabot-PR: een falende E2E-check zonder falende TypeScript/Vitest/audit is geen reden om niet te mergen.
- **Gedaan (2026-08-01):** `sanity`, `next-sanity` en `@portabletext/react` volledig verwijderd uit `package.json`. Bleken niet meer gebruikt: de enige aanroep (`app/bot/page.tsx`) haalde een `sparPage`-document op voor een `openers`-prop die `SparClient.tsx` al niet meer las (echte openers komen client-side uit Supabase via de `refresh-openers`-cron). De eerdere notitie hier ("bewust geaccepteerd") was dus feitelijk onjuist, dit was geen geaccepteerd risico maar dode code die nooit is opgeruimd na een eerdere migratie. Loste 8 Dependabot-kwetsbaarheden in één keer op. CSP (`proxy.ts`) en image-config (`next.config.ts`) ook ontdaan van de overbodig geworden `cdn.sanity.io`-toegang. Les: bij "bewust geaccepteerd"-notities voortaan ook periodiek checken of de dependency zelf nog wel gebruikt wordt, niet alleen of de kwetsbaarheid zelf nog relevant is.

### 3. AI-modelinventaris
- Zie de modelinventaris-tabel verderop in dit bestand, deze dekt de Anthropic chat-modellen, de Voyage AI embedding/rerank-modellen (RAG-pipeline), en de OpenAI spraakmodellen (transcriptie/TTS)
- Zijn er nieuwere of betere modellen beschikbaar bij Anthropic of Voyage AI?
- Beoordeel altijd op kwaliteit eerst, dan pas op kosten — noem de prijs, maar laat die het besluit niet sturen
- **Vaste regel:** elke nieuwe externe AI/API-leverancier die aan arnobot wordt toegevoegd (nieuwe SDK, nieuw model, nieuwe derde partij) wordt in dezelfde commit toegevoegd aan deze check en aan de modelinventaris-tabel. Geen uitzondering. Reden: Voyage AI, Sentry, Upstash en OpenAI zijn alle vier ooit toegevoegd zonder dat de check werd bijgewerkt, en zijn daardoor tijdlang buiten beeld gebleven.
- **Verplichte verificatiestap (besloten 2026-07, niet overslaan):** controleer niet alleen op nieuwere modellen, maar verifieer ook dat de tabel nog klopt met de daadwerkelijke code. Zoek via de import-graph (elk bestand dat `@anthropic-ai/sdk` of een andere AI-SDK importeert, en wat er precies op de client wordt aangeroepen — niet alleen op bekende methodenamen zoals `.messages.create(` grep'en, want dat mist varianten als `.messages.stream(`) en check `package.json` op AI-gerelateerde dependencies die nergens geïmporteerd worden. Reden: een eerdere grep-only audit miste zowel een `.messages.stream(`-aanroep in de hoofdchat als een volledig ongedocumenteerde OpenAI-integratie (spraak). Deze stap vervangt de behoefte aan een losse reminder daarvoor: de maandcheck-gewoonte zelf is het herhalingsmechanisme.
- **Embedding-consistentiecheck (toegevoegd 2026-08-12):** voor elke kolom die een embedding-vector opslaat (nu: `arnobot_blog_sessions.embedding`), steekproefsgewijs verifiëren dat alle rijen uit hetzelfde model komen. Pak een gebruiker met meerdere sessies, embed een paar losse queries opnieuw met het huidige model, en vergelijk de cosine-similarity met de opgeslagen vector op exact dezelfde brontekst: dicht bij 1,0 is hetzelfde model, dicht bij 0 is een ander model. Reden: `session-end/route.ts` schreef sinds 10 juni 2026 embeddings weg met `voyage-3-large`, terwijl de rest van de sessie-geheugen-infrastructuur sinds 11 juni `voyage-multilingual-2` verwachtte, een migratiecommit die zich letterlijk "resterende verwijzing vervangen" noemde miste één bestand. Twee maanden onopgemerkt, geen enkele check controleerde dit, pas gevonden bij het bouwen van semantische retrieval bovenop deze kolom. Structureel al verholpen (alle schrijvers gaan nu door de gedeelde `embedSessionText()` in `lib/rag.ts`), deze stap is het vangnet mocht een toekomstige component de kolom ooit weer los aanroepen.

### 4. Infrastructuur

**Werkregel:** een deprecation-melding in een dashboard of changelog = direct opnemen als actiepunt, niet uitstellen naar de volgende check. Commerciële tools veranderen zonder waarschuwing. Wacht niet tot iets toevallig ter sprake komt.

#### Milestone: Pro-upgrades bij 50 actieve gebruikers
Zodra ArnoBot 50 actieve gebruikers bereikt, de volgende betaalde upgrades doorvoeren (nu bewust uitgesteld, niet omdat het onbelangrijk is maar omdat het bij de huidige schaal nog niet in verhouding staat):
- **Vercel Firewall** aanzetten
- **Supabase PITR** (Point-In-Time Recovery) aanzetten, $100/maand extra bovenop het al actieve Supabase Pro-abonnement (bevestigd 2026-08-10 geüpgraded, zie hieronder). **Correctie (2026-08-11):** de eerdere aanname "gratis plan biedt geen backups" klopte niet meer zodra Pro actief is, Pro geeft al gratis dagelijkse backups met 7 dagen bewaartermijn zonder PITR. PITR voegt alleen precisie toe (herstel tot op de minuut i.p.v. de laatste nachtelijke snapshot), pas de moeite waard zodra een dag dataverlies echt pijn zou doen. Sinds 2026-08-11 automatisch verwerkt in Abacus (`lib/kostenTarieven.ts`, `TARIEVEN.supabasePitrDrempel`, geen handmatige toggle meer): telt automatisch mee in zowel het scenario-tabblad als Trackrecord zodra de drempel bereikt wordt. **Bewust een hogere drempel dan de andere twee upgrades hier (100 i.p.v. 50, Arno's eigen keuze 2026-08-11)**, losse afweging, geen gekoppelde mijlpaal. **Direct bij het daadwerkelijk aanzetten, in dezelfde actie:** een restore-test uitvoeren (recente backup terugzetten in een tijdelijk Supabase-project, controleren dat alle tabellen/rijen/encoding kloppen, tijdelijk project weer verwijderen). Een reminder hiervoor kwam op 2026-08-08 al eens te vroeg binnen (gratis plan bood toen geen downloadbare dump, dus niet uit te voeren), toen bewust overgeslagen, niet vergeten, hoort dus bij déze upgrade-stap.
- **Clerk**: inactivity timeout inschakelen (zie hieronder bij Clerk) en session limits aanscherpen

#### Vercel
- Zijn er deprecated features in gebruik? Controleer Vercel dashboard → Settings → General op waarschuwingen
- Controleer [vercel.com/changelog](https://vercel.com/changelog) op breaking changes die arno.bot raken
- Check build logs op deprecation warnings (`next build` output in Vercel)
- Zijn er nieuwe platform-limieten of wijzigingen in het huidige plan?
- **Gedaan (2026-08-01):** `middleware.ts` → `proxy.ts` gemigreerd (Next.js 16 deprecation-warning in build logs, geen afgedwongen verwijderdatum). Vóór uitvoering onderzocht: (1) Clerk's `clerkMiddleware()` werkt ongewijzigd onder de nieuwe conventie, geen codewijziging nodig aan de auth-logica zelf. (2) `proxy.ts` dwingt Node.js runtime af (Edge Runtime niet meer selecteerbaar), maar Vercel's Routing Middleware draait sinds Fluid Compute sowieso al wereldwijd gedistribueerd, ongeacht runtime-keuze, dus geen verwachte latency-regressie voor de EU-gebruikers van arno.bot. (3) Bekende Sentry/Turbopack-instrumentatiebug (proxy-isolate krijgt geen `Sentry.init()` in productie, github.com/getsentry/sentry-javascript#21713) raakt alleen Turbopack-builds; arno.bot draait bewust op `next build --webpack` (`package.json`), dus niet van toepassing. De officiële codemod (`@next/codemod middleware-to-proxy`) transformeerde niets, want die herkent alleen een letterlijk `middleware`-identifier, niet Clerk's `export default clerkMiddleware(...)`-patroon; migratie was daarom een handmatige bestandshernoeming (`git mv`), geen inhoudelijke wijziging. Lokaal geverifieerd: dev-server start zonder de deprecation-warning, onbeveiligde `/bot`-toegang, admin-cookie-gating, scanner-blokkering en de `/blog`-redirect werken nog. Niet lokaal te verifiëren: de nieuwe-gebruiker-aanmaak/referral-afhandeling, die vereist een echte eerste Clerk-login. Aandachtspunt voor een volgende keer dat dit bestand ingrijpend wijzigt: Next.js raadt zelf aan zware logica (DB-calls, externe fetches) uit Proxy te halen naar een Data Access Layer, `proxy.ts` doet nu nog veel meer dan dat (trial-aanmaak, referral-verwerking, Telegram-notificatie), geen actie nu, wel iets om in het achterhoofd te houden.

#### Supabase (project: wxrsmmzqbmoeackirsxc — arno.bot)
- Open het dashboard en scan op banners of waarschuwingen — Supabase toont deprecated features actief in de UI
- Controleer [supabase.com/changelog](https://supabase.com/changelog) op breaking changes
- Check Settings → API op deprecated key-formaten of migratiewaarschuwingen
- Zijn er schema-wijzigingen nodig voor nieuwe features?
- Database binnen limieten? (Pro: 8GB inbegrepen — check Settings → Billing → Usage)
- **Gedaan (juli 2026):** gemigreerd van legacy JWT-keys naar nieuwe publishable/secret keys (`sb_publishable_...` / `sb_secret_...`) in `.env.local` en Vercel. Legacy keys daarna uitgeschakeld in Supabase dashboard. Geen codewijzigingen nodig geweest.
- **Gedaan (2026-08-10):** geüpgraded naar Supabase Pro ($25/maand), voorkomt auto-verwijdering van inactieve projecten. Geeft ook meteen gratis dagelijkse backups (7 dagen bewaartermijn) zonder PITR nodig te hebben.
- **Openstaand actiepunt:** PITR (preciezer herstel dan de gratis dagelijkse backup) nog niet aangezet. Zie "Milestone: Pro-upgrades bij 50 actieve gebruikers" hierboven voor de volledige afweging en de nu geautomatiseerde Abacus-drempel.

#### Clerk (app: clerk.arno.bot)
- Controleer [clerk.com/changelog](https://clerk.com/changelog) op breaking changes in SDK of JWT-formaat
- Session duration correct ingesteld?
- Webhooks actief en zonder fouten? (Clerk dashboard → Webhooks → recent deliveries)
- Geen development-instance in productie?
- Zijn er nieuwe beveiligingsinstellingen beschikbaar (bijv. device fingerprinting, bot-detectie)?
- **Openstaand actiepunt:** inactivity timeout inschakelen (Clerk dashboard → Sessions). Vereist een betaald Clerk-plan voor productiegebruik, dus pas oppakken bij "Milestone: Pro-upgrades bij 50 actieve gebruikers" hierboven. Geen "log uit bij browser sluiten"-optie beschikbaar bij Clerk, inactivity timeout is het dichtstbijzijnde alternatief.
- **Openstaand actiepunt (deadline 18 januari 2027):** Clerk stopt op die datum met oude CBC-mode TLS-cipher suites op custom domains (Frontend API + Account Portal, dus ook `clerk.arno.bot`). Voor ArnoBot vermoedelijk geen actie nodig (moderne Vercel/Next.js-stack, reguliere browsers), maar bij de maandcheck vlak vóór de deadline nog een keer bevestigen dat er geen legacy clients (oude mobiele app, custom HTTP-integratie) op Clerk aansluiten.
- **Openstaand actiepunt (2026-08-08):** `@clerk/nextjs` bijgewerkt van 7.5.12 naar 7.6.3 (Dependabot PR #43). Sinds 7.5.14 is `createRouteMatcher()` gedeprecate ten gunste van `auth.protect()` per route/pagina, `proxy.ts` gebruikt `createRouteMatcher()` nog actief voor zowel `isProtectedBot` (`/bot`-bescherming) als `isAdminRoute` (`/bot/admin`-bescherming). Geen breaking change, functie blijft werken, geen aangekondigde verwijderdatum, maar wel migreren naar `auth.protect()` zodra dit is opgepakt, niet blijven hangen op de gedepreceerde route-matcher.

#### Resend
- DKIM nog geldig? (Resend dashboard → Domains)
- Geen bounces of spam-klachten die aandacht vragen?
- Controleer [resend.com/changelog](https://resend.com/changelog) op API-wijzigingen
- Binnen de gratis verzendlimiet? (Resend dashboard → Usage)
- **Gedaan (2026-07-24):** DMARC-record van `arno.bot` bijgewerkt naar de nieuwe DMARCbis-spec (RFC 9989/9990/9991, mei 2026). Record bevatte geen `pct`-tag, dus geen gedwongen migratie nodig. Wel `np=reject` toegevoegd om spoofing via niet-bestaande subdomeinen te blokkeren (was onbeschermd door `sp=none`). Huidig record: `v=DMARC1; p=quarantine; rua=mailto:re+bpy4n6idets@dmarc.postmarkapp.com; sp=none; np=reject; aspf=r;`. DKIM (`resend._domainkey.arno.bot`) geverifieerd als correct ingesteld, DMARC-alignment voor Resend-mails (`info@arno.bot`/`noreply@arno.bot`) loopt via DKIM, niet via SPF (SPF bevat alleen Proton).

#### VisualPing (monitoring van leverancierspagina's, bijv. DPA-wijzigingen)
- **Toegevoegd aan deze lijst (2026-08-08):** stond nergens in de leverancierslijst terwijl al actief gebruikt (o.a. monitoring van Supabase's DPA-pagina, meldt wijzigingen per e-mail). Geen eigen infra/code in arnobot, puur een extern monitoring-abonnement, dus geen eigen sub-verwerkerstabel-vermelding nodig (verwerkt geen gebruikersdata van arno.bot, alleen publieke leverancierspagina's).
- Gratis tier: 65 checks/maand. Huidig gebruik (2026-08): 5 URL's op 2-wekelijkse monitoring = 10 checks/maand, ruim binnen de limiet.
- Check bij groei van het aantal gemonitorde URL's of de 65/maand-limiet niet in zicht komt.

#### Calendly (boeking van het gesprek met Arno)
- **Toegevoegd (2026-07-20):** `app/api/webhooks/calendly/route.ts` ontvangt `invitee.created`-events, verifieert de `Calendly-Webhook-Signature`-header (HMAC-SHA256 met `CALENDLY_WEBHOOK_SIGNING_KEY`, 5 minuten replay-venster) en zet `arno_call_booked_at` op `approved_users` via een match op e-mailadres. `app/bot/gesprek/route.ts` is de stabiele interne link (in e-mails en op de account-pagina) die doorverwijst naar `ARNO_BOOKING_URL` — Arno kiest de definitieve scheduling-tool later, dus wisselen van tool is alleen een env var-wijziging, geen codewijziging.
- **Gedaan (2026-07-20):** webhook-subscription aangemaakt en env vars gezet. **Val niet terug in dezelfde fout als de eerste keer:** de callback-URL moet `https://www.arno.bot/api/webhooks/calendly` zijn (mét www) — `arno.bot` zonder www stuurt altijd 308-door naar www, en Calendly volgt die redirect niet bij het afleveren van webhooks, waardoor de eerste subscription nooit iets aflevert (bevestigd: `retry_started_at` liep op, niets kwam aan in de Vercel-logs).
- Controleer bij een leverancierswissel of het nieuwe tool ook e-mailadres in het webhook-payload meestuurt (nu de matchsleutel), anders moet de matchlogica in de webhook-route mee veranderen.

#### Anthropic
- Controleer of de DPA is gewijzigd: [anthropic.com/legal/dpa](https://www.anthropic.com/legal/data-processing-addendum) — let op de "effective date". Als die is veranderd, privacypagina bijwerken.
- Zijn er API-deprecaties aangekondigd? Controleer [docs.anthropic.com/changelog](https://docs.anthropic.com/en/release-notes/overview)
- Worden de huidige model-IDs in de inventaris nog ondersteund? (Anthropic depreceert modellen met aankondiging)
- **Harde deadline:** de huidige API-keys (arnobot + salescanvas-app) verlopen op 6 januari 2027, door Anthropic afgedwongen, geen eigen beleid. Ruim van tevoren nieuwe keys aanmaken en uitrollen, niet pas rond de deadline zelf.
- **Watch-item (toegevoegd 2026-08-12, via web_search-modelcheck-agent, geverifieerd tegen Anthropic's eigen model-deprecations-pagina):** Claude Haiku 4.5 heeft een voorlopige pensioendatum van niet eerder dan 15 oktober 2026. Nog geen harde aankondiging, alleen een tentatieve datum, dus geen actie nu. Wel relevant om te volgen: Haiku 4.5 wordt breed gebruikt in ArnoBot (o.a. `session-end`, RAG-queryherschrijving, `memoryEntities`), dus bij een officiële aankondiging tijdig een migratiepad uitzoeken.

#### Voyage AI (embedding + rerank voor de RAG/kennisbank-pipeline, `lib/rag.ts`)
- Controleer [docs.voyageai.com/docs/pricing](https://docs.voyageai.com/docs/pricing) op nieuwere modelgeneraties en gratis tokentoelagen (nieuwe modellen krijgen vaak 200 miljoen gratis tokens/maand, oudere modellen niet)
- Zijn de huidige model-IDs (embedding + rerank) nog de nieuwste generatie, of inmiddels "legacy"?
- **Gedaan (juli 2026):** rerank-model geüpgraded van `rerank-2` naar `rerank-2.5` (door Voyage zelf bevestigd als strikt beter op kwaliteit, contextlengte, latency en throughput, zelfde prijs). Reranking gebeurt live op tekst, geen migratie nodig.
- **Openstaand actiepunt:** embedding-model (`voyage-3-large`) NIET losstaand upgraden naar `voyage-4-large`. Live geverifieerd dat dit de kennisbank-zoekfunctie volledig breekt (0 treffers): de hele kennisbank (`blog_chunks`) is offline vooraf ge-embed met `voyage-3-large` via `scripts/embed-chunks.mjs` en ligt vast in die vectorruimte. Een nieuw embedding-model voor alleen de live zoekvraag is semantisch incompatibel met de opgeslagen document-embeddings, ook al matcht de dimensie toevallig. Vereist een volledige her-embedding van de kennisbank plus een zorgvuldige overstap (geen periode waarin nieuw-model-vragen op oud-model-documenten zoeken). Aparte, groter geplande actie, niet en passant doen.

#### Sentry (foutmonitoring + performance tracing)
- Controleer [sentry.io changelog](https://docs.sentry.io/product/relay/release-notes/) of het SDK-versie-changelog op breaking changes in `@sentry/nextjs`
- Komen er nog steeds spans/errors binnen in het Sentry-dashboard voor de laatste periode? (stille storing in instrumentatie is anders onzichtbaar)
- Quota/limiet binnen het huidige plan?

#### Upstash (rate limiting, `@upstash/ratelimit` + `@upstash/redis`)
- Controleer [upstash.com/blog](https://upstash.com/blog) of changelog op breaking changes
- Rate limit-drempels nog passend bij het huidige gebruikersaantal?
- Quota/limiet binnen het huidige plan?

#### OpenAI (spraak: transcriptie, `app/api/transcribe/route.ts`)
- **Gevonden bij 2026-07-audit (import-graph-verificatieronde):** deze leverancier was volledig afwezig uit deze maandcheck, uit de modelinventaris-tabel, uit de privacypagina (`app/privacy/page.tsx`) en uit het beveiligingsdocument (`scripts/generate-security-pdf.mjs`). Precies het patroon waar de "Vaste regel" in sectie 3 hierboven voor waarschuwt (Voyage AI, Sentry en Upstash zijn ooit hetzelfde overkomen), nu een vierde keer, en deze keer met stemdata van gebruikers.
- `app/api/transcribe/route.ts`: Whisper (`whisper-1`) voor spraak-naar-tekst, rauwe `fetch()` naar `api.openai.com`, geen SDK.
- **Gedaan (2026-07):** OpenAI toegevoegd aan de sub-verwerkerstabel in `app/privacy/page.tsx`, aan de leverancierslijst in `scripts/generate-security-pdf.mjs` (PDF opnieuw gegenereerd, versie 1.0 naar 1.1), en aan `docs/dpa-draft-v0.6.md`/`docs/dpa-input.md`. DPA-link en trainingsbeleid geverifieerd via websearch vóór publicatie. `docs/dpa-draft-v0.6.pdf` moet nog handmatig gerenderd worden via de Markdown PDF-extensie.
- **Gedaan (2026-08-12):** `app/api/tts/route.ts` (OpenAI TTS, `tts-1-hd`) verwijderd, bleek sinds 10 juni 2026 dood (zie sectie 4/Infrastructuur hierboven, "Wezen-routes-check"). Documentatie in dezelfde actie meegenomen: OpenAI's rol is nu uitsluitend spraakherkenning, niet meer tekst-naar-spraak.
- Controleer [platform.openai.com/docs/changelog](https://platform.openai.com/docs/changelog) op API-deprecaties voor `whisper-1`.

#### ElevenLabs (tekst-naar-spraak voor ArnoBot Voice)
- **Status (2026-07):** publieke, premium-gated feature. Bereikbaar op `/bot` via de voice-toggle in `SparClient.tsx`, uitsluitend voor gebruikers met `voice_enabled=true` op `approved_users` (Voice-abonnees, €97/mnd). De admin-only testroutes (`/bot/admin/voice-test`) blijven bestaan voor interne tests en gebruiken dezelfde gedeelde helpers uit `lib/voice.ts`. Toegevoegd aan de sub-verwerkerstabel in `app/privacy/page.tsx` en aan de leverancierslijst in `scripts/generate-security-pdf.mjs` (versie 1.1 naar 1.2) in dezelfde commit als de ship-beslissing, conform de "Vaste regel" in sectie 3 hierboven.
- **Gedaan (2026-07):** de "Improve the models for everyone"-instelling (Data use, Terms and privacy-menu) is door Arno uitgezet vóór livegang, dus "geen training op jouw data" klopt op de privacypagina. Deze stond standaard AAN, anders dan Anthropic/OpenAI die standaard niet trainen op API-data, dat verschil zit dus alleen in de instelling, niet in de codebase.
- `app/api/chat-voice/route.ts` + `app/api/tts-voice/route.ts` (echte gebruikers) en `app/api/admin/voice-test/chat/route.ts` + `app/api/admin/voice-test/tts/route.ts` (admin-only test): model Flash v2.5 (`eleven_flash_v2_5`), streaming audio, rauwe `fetch()` naar `api.elevenlabs.io`, geen SDK. Gedeelde logica in `lib/voice.ts`.
- Verbruik (tekens per aanroep) wordt gelogd in `arnobot_elevenlabs_usage`, met de echte Clerk `userId` voor de publieke routes en de vaste waarde `'admin-voice-test'` voor de admin-testroute.
- Controleer [elevenlabs.io/docs](https://elevenlabs.io/docs) op API-wijzigingen.

#### PostHog (anonieme bezoekersanalyse marketingpagina's)
- **Toegevoegd (2026-08-01):** vervangt niet de eigen `arnobot_pageviews`/`arnobot_cta_clicks`-tracking, draait ernaast. Eigen tracking blijft de bron voor de funnel-tegel op `/bot/admin/stats` (simpel, geen externe afhankelijkheid); PostHog is bedoeld voor diepere analyse (funnels met segmentatie, sessie-opnames) die je rechtstreeks op posthog.com bekijkt, niet in de admin-UI.
- **Bewust géén autocapture:** `app/components/PostHogTracker.tsx` zet `autocapture: false` en `disable_session_recording: true`. Reden: PostHog wordt in de root layout gemount (`app/layout.tsx`), dus autocapture zou globaal blijven luisteren naar kliks, óók nadat een bezoeker via client-side navigatie (geen page-reload) in `/bot` terechtkomt. Dat zou ongemerkt gedrag van ingelogde, betalende klanten gaan opnemen, een principieel andere afweging dan anonieme marketingbezoekers, die niet impliciet is meegenomen. In plaats daarvan alleen expliciete `posthog.capture()`-calls op componenten die uitsluitend op publieke pagina's bestaan (bijv. `SignupCTA.tsx`).
- **Scope:** alleen publieke marketingpagina's, zelfde `UITGESLOTEN_PREFIXES`-lijst als `PageviewTracker.tsx` (`/bot`, `/abacus`, `/api`, auth-routes). Sessie-opnames van de coaching-app zelf zijn hiermee niet aan de orde, dat zou een eigen, apart besloten stap moeten zijn.
- **Env vars:** alleen `NEXT_PUBLIC_POSTHOG_KEY` nodig (in `.env.local` én Vercel). `NEXT_PUBLIC_POSTHOG_HOST` bestaat niet meer als losse variabele: `api_host` is een relatief pad (`/site-relay`, zie reverse proxy hieronder), geen absolute host meer. Ontbreekt de key, dan initialiseert de tracker niet (geen crash, gewoon stil uit).
- **Reverse proxy (`/site-relay`, `next.config.ts` `rewrites()`):** PostHog-verkeer loopt via ons eigen domein i.p.v. rechtstreeks naar `eu.i.posthog.com`, zelfde soort truc als de Sentry-tunnel (`tunnelRoute: "/monitoring"` in dezelfde file). Reden: PostHog waarschuwt zelf dat ad-blockers 10-25% van de events op het eigen domein blokkeren. Bewust géén voor de hand liggende padnaam (`/analytics`, `/posthog`, etc., zie posthog.com/docs/advanced/proxy/nextjs) omdat blocklists daar juist op matchen. Omdat het verkeer hierdoor same-origin is, staan er geen `eu.i.posthog.com`/`eu-assets.i.posthog.com`-vermeldingen meer in de CSP (`proxy.ts`), `'self'` dekt het al.
- `person_profiles: 'always'` (niet `'identified_only'`): de ingebouwde PostHog-dashboardtegels (Active/Daily/Weekly users, Retention) tellen unieke Person-profielen, niet losse events. Zonder profiel per anonieme bezoeker bleven die tegels op 0 staan, ook al kwamen de losse Pageview-events wél al binnen (zichtbaar in Activity). Verandert niet wélke data verzameld wordt, alleen hoe PostHog 'm intern organiseert.
- **Les uit deze uitrol (2026-08-01):** de eerste CSP-aanpassing voor PostHog werkte lokaal, maar is niet meteen gecommit/gepusht vóórdat de rest van de sessie verderging (debugging op een verouderde productie-build kostte daardoor extra tijd, want events kwamen niet aan terwijl alles er lokaal goed uitzag). Bij een infra-wijziging die je lokaal test: direct daarna committen en pushen, niet uitstellen tot "als alles af is".
- Linkje naar het PostHog-project staat op de Groei & Funnel-tab van `/bot/admin/stats` (onder de funnel-tegel), voor wie meer detail wil dan de eigen funnel laat zien.
- Toegevoegd aan de sub-verwerkerstabel in `app/privacy/page.tsx` en aan de leverancierslijst in `scripts/generate-security-pdf.mjs` (versie 1.2 naar 1.3) in dezelfde commit, conform de "Vaste regel" in sectie 3 hierboven. DPA-status: op aanvraag (niet gevonden of deze standaard op het gratis plan wordt meegeleverd, niet als vaststaand feit gepubliceerd totdat dat bevestigd is).
- **Openstaand (Arno noemt dit "essentieel"):** PostHog uitbreiden naar ingelogde `/bot`-gebruikers (nu bewust uitgesloten, zie Scope hierboven), en een Data Warehouse-koppeling met Stripe/Supabase. Beide vereisen een eigen scope/privacy-beoordeling vóór het aanzetten, niet zomaar de uitsluitingslijst aanpassen.
- Controleer [posthog.com/changelog](https://posthog.com/changelog) op API-wijzigingen.

#### Kostencalculator (Abacus, `/abacus`, wachtwoord-gated businesscase-tool)
- `lib/kostenTarieven.ts` bevat harde standaardwaarden voor externe tarieven: Vercel Pro ($20/seat), Supabase Pro ($25), Clerk Pro ($100), ElevenLabs-plan-tiers (Starter/Creator/Pro/Scale/Business, credits + prijs), Anthropic/Fable 5-kosten per aanroep, en de domeinverlenging bij Porkbun ($52/jaar). Verdeeld over drie tabbladen (`app/abacus/KostenCalculatorClient.tsx`, `TrackrecordClient.tsx`, `BusinessCaseClient.tsx`), maar alle tarieven zelf staan gecentraliseerd in `lib/kostenTarieven.ts`.
- Bij elke kwartaalcheck gecontroleerd tegen de live pricing-pagina's van elke leverancier (Vercel, Supabase, Clerk, ElevenLabs, Porkbun), zie de kwartaalcheck-sectie verderop in dit bestand. Niet bij de maandcheck, prijswijzigingen bij deze leveranciers komen niet vaak genoeg voor om dat maandelijks te rechtvaardigen.
- Sentry en Upstash staan hier bewust niet als hardcoded bedrag in, die zijn zelf al instelbare velden in de calculator (Arno vult zijn eigen actuele factuurbedrag in), dus geen externe check nodig voor die twee.
- **Gedaan (2026-07-31):** vaste-infrastructuurkosten-aanname (Vercel + Supabase, samen $77/maand in de standaardinstelling) gecontroleerd tegen écht gemeten verbruik in de Vercel- en Supabase-dashboards, niet geschat. Bij 5.000 gebruikers (500-625x de huidige belasting) blijven Vercel edge requests/databandbreedte ruim onder de gratis inclusies, en Supabase-egress ruim onder de 250GB van het Pro-plan. Supabase's MAU-tarief (100.000 gratis, daarna $0,00325/MAU) is sowieso niet van toepassing: ArnoBot gebruikt Clerk voor authenticatie, niet Supabase Auth, dus die teller staat altijd op 0. Conclusie: geen schaalformule voor vaste kosten nodig tot en met minstens 5.000 gebruikers.
- **Gedaan (2026-07-31):** `supabasePro`-standaardwaarde in `DEFAULT_INPUTS` gecorrigeerd van `true` naar `false`: de Supabase-organisatie stond nog echt op het Free-plan, niet Pro. Upgrade blijft bewust uitgesteld tot de 50-actieve-gebruikersmijlpaal (zie "Milestone: Pro-upgrades bij 50 actieve gebruikers" hierboven).

### 5. Werking van de app
- Loop de happy path na: inloggen, chat, sessie-einde, synthese, coaching, sparring
- Controleer of alle cron-jobs de afgelopen periode succesvol hebben gedraaid (Vercel logs)
- Zijn er onverwachte 500-fouten of time-outs in de logs?
- UI-stijlconsistentie-sweep hoort bij de kwartaalcheck, zie verderop in dit bestand. Niet bij de maandcheck, stijldrift stapelt langzaam genoeg dat een maandelijkse sweep overkill is. Geldt los van de doorlopende regel om afwijkingen direct te signaleren zodra je ze tegenkomt bij ander werk.
- **Documentatie-versheid-backstop:** klopt `docs/ARNOBOT_OVERZICHT.md` nog met wat er de afgelopen maand daadwerkelijk is gebouwd/gewijzigd? Vergelijk met de commits/sessies van de afgelopen maand (git log, `docs/TEAM_PLAN.md` en vergelijkbare statusblokken). Dit is het vangnet voor de doorlopende "Documentatie actueel houden"-regel hierboven, niet een vervanging ervan.

### 6. AVG & beveiliging gebruikers
- Is het beveiligingsdocument voor gebruikers (`public/arnobot-beveiliging.pdf`, gegenereerd via `scripts/generate-security-pdf.mjs`, dat script opnieuw draaien na elke wijziging) nog actueel? Check niet alleen of het bestand recent is, maar of specifieke claims er nog kloppen: de leverancierslijst (incl. Voyage AI, Sentry, Upstash, OpenAI), genoemde cijfers (bijv. aantal npm audit-meldingen, rate-limit-drempels) en rechten/termijnen.
- Zijn er nieuwe verwerkingen bijgekomen die niet in de privacypagina staan?
- Zijn er openstaande verwijderverzoeken of datavragen van gebruikers?

### 7. Beveiligingsheaders
- Test `arno.bot` op [securityheaders.com](https://securityheaders.com) — target grade A
- Test op [observatory.mozilla.org](https://observatory.mozilla.org)

---

## Kwartaalcheck — roep aan met "doe de kwartaalcheck"

**Besloten (2026-08-01):** de kwartaalcheck is geen andere naam voor de maandcheck, maar een aparte, minder frequente laag erbovenop. Voer eerst de volledige maandcheck hierboven uit (secties 1-7), en voeg daarna deze vier punten toe. Reden voor de scheiding: sommige dingen veranderen te snel om maandelijks over te slaan (dependencies, vendor-changelogs, modelkeuzes, security headers), andere juist te langzaam om elke maand opnieuw grondig te doen (stijldrift, tarieven, documentatie-diepte). Zelfde werkwijze als de maandcheck: parallelle subagents per punt, niet sequentieel in eigen context.

### 8. Kostencalculator-tarieven vs. live pricing
Controleer de hardcoded tarieven in `lib/kostenTarieven.ts` (Vercel Pro, Supabase Pro, Clerk Pro, ElevenLabs-tiers, Porkbun-domeinverlenging) tegen de actuele pricing-pagina's van elke leverancier. Zie "Kostencalculator (Abacus...)" hierboven voor de volledige context. Prijswijzigingen bij deze leveranciers komen niet vaak voor, maar als het gebeurt: bijwerken in dezelfde commit als deze check.

### 9. UI-stijlconsistentie-sweep
Gebruik een agent om alle pagina's/componenten te grep'en op hardcoded kleuren, fonts of spacing die afwijken van de Vaste Normen-tabel (zie "UI-stijl — ALTIJD consistent toepassen" verderop in dit bestand) en van de admin-UI-stijlnorm. Dit is een periodieke vangnet-sweep, geen vervanging van de doorlopende regel om afwijkingen direct te signaleren zodra je ze tegenkomt bij ander werk.

### 10. Grondige AVG/DPA-documentatie-doorlichting
Dieper dan de maandelijkse check in sectie 6 (die vooral checkt of de leverancierslijst compleet is). Lees `app/privacy/page.tsx`, `public/arnobot-beveiliging.pdf`-brontekst (`scripts/generate-security-pdf.mjs`) en de DPA-concepten (`docs/dpa-draft-v0.6.md`, `docs/dpa-input.md`) volledig door, niet alleen de leverancierstabellen. Kloppen genoemde cijfers (rate-limit-drempels, bewaartermijnen, aantal npm audit-meldingen) nog met de code? Kloppen rechten/termijnen nog met de praktijk? Doorzoek ook de codebase op externe `fetch()`-calls/SDK-imports die weleens gemist worden omdat ze geen "grote" leverancier lijken (bijv. Telegram, DocuSeal, Calendly zijn hier ooit gemist, zie geheugen).

### 11. Terugblik op bewust uitgestelde besluiten
Doorzoek CLAUDE.md op "bewust uitgesteld", "openstaand actiepunt" en vergelijkbare markeringen. Voor elk: is de reden om uit te stellen nog steeds geldig, of is de situatie (gebruikersaantal, schaal, tijd verstreken) inmiddels veranderd zodat het opgepakt zou moeten worden? Rapporteer dit als lijst, laat Arno beslissen welke items alsnog oppakken.

---

## Professionaliteitscheck — roep aan met "doe de professionaliteitscheck"

**Ontstaan (2026-08-22):** naar aanleiding van een concreet gemist gat (uitgenodigde teamleden konden managementrollen kiezen, `app/bot/profiel/page.tsx`) vroeg Arno niet om een fix voor dát ene geval, maar om een manier om te verifiëren of er in het algemeen professioneel genoeg wordt ontwikkeld, op elk gewenst moment op te roepen, niet gebonden aan een vaste maand- of kwartaalcyclus. Dit is dus geen check op één bugklasse, maar een verificatie of de bestaande normen in dit bestand (**"Rol — ALTIJD"** en **"Schaal en kwaliteitsniveau — ALTIJD"** hierboven) in de praktijk ook echt worden nageleefd, niet alleen op papier staan. Zelfde les als bij de RLS-notitie in sectie 1: een norm die nergens periodiek geverifieerd wordt, is op den duur alleen een bewering.

**Werkwijze:** één sessie met volledige, live codebase-toegang (dus niet de sandboxed maandelijkse cloud-audit hierboven, die heeft bewust geen productie-secrets en kan dus geen live-datachecks doen, zie de sectie "Waarom niet live-data-verificatie" in het geheugen van die routine). Loop onderstaande punten na, rapporteer per punt concreet (bestand, regel, wat er mis is), niet alleen "OK/niet OK".

1. **Rollijsten- en permissiegaten-consistentie:** zoek alle plekken waar een rol, plan, of permissie-vlag (`ROL_OPTIONS`, `command_manager`, `isConfirmedTeambaas`, `plan`, en vergelijkbare constants/enums) een keuze of gate bepaalt. Voor elke lijst: zijn er consumers die een deelverzameling zouden moeten zien in plaats van de volledige lijst, en is dat al zo geïmplementeerd? Dit is letterlijk de bugklasse van vandaag, generiek toegepast.
2. **Halfafgemaakte implementaties:** zoek naar routes/features die op de ene plek wel en de andere plek niet zijn doorgevoerd (nieuwe kolom die niet overal gelezen wordt, nieuwe flow die een oud pad laat bestaan, TODO/FIXME-commentaar dat een bewuste half-bouw markeert).
3. **Duplicatie van dezelfde logica op 2+ plekken** zonder gedeelde functie: hetzelfde generieke risico als de "gedeelde-databronrisico"-check in de maandelijkse cloud-audit, hier breder toegepast dan alleen databaseschrijvers (bijv. dezelfde rolcontrole, dezelfde berekening, dezelfde validatie los geïmplementeerd op meerdere plekken).
4. **Schaal- en beveiligingssteekproef:** pak 2-3 recent gebouwde routes/features en toets ze expliciet tegen "Schaal en kwaliteitsniveau — ALTIJD" (werkt dit bij honderden gelijktijdige gebruikers, geen workaround-taal in commentaar) en tegen "Rol — ALTIJD" (auth, input-validatie, data-exposure).
5. **Nieuwe onboarding-/toegangsflows sinds de vorige professionaliteitscheck:** specifiek doorlopen of een nieuwe rol, plan, of teamstructuur die sinds de vorige keer is toegevoegd, ook echt overal consistent is doorgevoerd (niet alleen op de plek waar hij oorspronkelijk gebouwd is).

**Waarom geen automatisering hiervoor (bewuste keuze, zelfde soort afweging als bij de sessie-overdracht-regel):** punt 1 en 3 vereisen precies het soort semantisch oordeel ("hoort deze rol hier wel of niet") dat een grep-based CI-check niet betrouwbaar kan geven, punt 4 en 5 vereisen live codebase-context van het moment van aanroepen. Dit blijft dus een oproepbare check, geen stille achtergrondroutine, in tegenstelling tot de wekelijkse documentatie-versheidscheck hierboven (die wél goed automatiseerbaar was, want daar is de vraag "is dit bestand recent aangeraakt" mechanisch te beantwoorden).

---

## Supabase — gebruikersdata queries — ALTIJD

Elke query op een tabel met gebruikersdata (arnobot_blog_sessions, arnobot_rds_logs, arnobot_analyses, arnobot_coaching, arnobot_coaching_scores, arnobot_1on1_log, arnobot_blog_profiles, approved_users) vereist een expliciete user-filter:

```typescript
.eq('user_id', userId)  // userId altijd uit Clerk auth(), nooit uit request body
```

Bij code review: controleer elke nieuwe query op deze filter. Ontbrekende filter = potentiële IDOR.

---

## Supabase SQL — ALTIJD controleren

Elke keer dat je een SQL-query geeft die de gebruiker handmatig moet uitvoeren in Supabase:
1. Noteer expliciet dat er een actie vereist is van de gebruiker
2. Vraag daarna altijd om bevestiging dat de query is uitgevoerd
3. Vraag om een screenshot van het resultaat als verificatie nodig is (bijv. na REVOKE, ALTER TABLE, INSERT)

Ga nooit verder met bouwen of pushen als een vereiste SQL-migratie nog niet bevestigd is.

---

## Werktijden en aannames — ALTIJD

- **Nooit een tijdsinschatting geven** tenzij expliciet gevraagd. Zeker niet om een optie te ontmoedigen ("dat kost een uur"). Bouwen en dan zien hoe lang het duurt.
- **Nooit aannemen dat automatisering niet interessant is** omdat de gebruiker solo werkt. ArnoBot is gebouwd op automatisering. De gebruiker omarmt het.
- **Geen paternalistische afwegingen** namens de gebruiker maken over wat "teveel overhead" zou zijn. Geef het eerlijke advies, laat de afweging aan de gebruiker.

*Proactief adviseren en opties vergelijken staan niet meer los hier — dat wordt sinds juli 2026 elke beurt afgedwongen via de `UserPromptSubmit`-hook in `C:\Users\arno\.claude\settings.json` (GEDRAGSCHECK), niet via dit bestand. Reden: gedragsregels in CLAUDE.md zakken weg in lange sessies, een hook wordt elke beurt opnieuw ingespoten.*

---

## Schaal en kwaliteitsniveau — ALTIJD

ArnoBot is gebouwd voor enterprise-gebruik en hoge volumes. Denk bij elk ontwerp- en architectuurkeuze als volgt:

- **Volume**: ga altijd uit van honderden gelijktijdige gebruikers, niet van een handvol. Elke API-route, database-query, en frontend-component moet dat aankunnen zonder aanpassingen achteraf.
- **Enterprise-kwaliteit**: alles wat gebouwd wordt, moet direct inzetbaar zijn voor corporate klanten met hoge standaarden op gebied van betrouwbaarheid, beveiliging en professionele uitstraling. Geen workarounds, geen "dit werkt voor nu".
- **Schaalbaarheid by design**: bij elke nieuwe feature, vraag je af hoe dit werkt bij 10.000 gebruikers. Als het antwoord "niet goed" is, bouw je het meteen robuust.
- **Geen kleine oplossingen**: een eenvoudige oplossing is prima als die ook op schaal werkt. Maar een oplossing die later teruggebouwd moet worden is geen oplossing.

---

## Rol — ALTIJD

Gedraag je als een master developer, master security engineer én master software tester. Dit betekent:
- Schrijf productie-waardig code: veilig, efficiënt, geen onnodige abstracties
- Kies altijd de meest robuuste oplossing, niet de snelste
- Bij dependency-updates: analyseer breaking changes voordat je iets uitvoert — voer nooit `--force` of major upgrades uit zonder risicoanalyse
- Bij nieuwe routes of API-aanpassingen: controleer altijd auth, input-validatie en data-exposure
- Als tester: denk als een aanvaller én als een onhandige gebruiker — test happy path, edge cases, auth-bypass, IDOR, input-extremen en business logic flaws

## Werkwijze bij meerdelige verzoeken — ALTIJD

Bij elk verzoek met meer dan één onderdeel:

1. **Schrijf de checklist eerst**, zichtbaar in de response, vóór enige wijziging:
   - `[ ] onderdeel 1`
   - `[ ] onderdeel 2`
   - etc.

2. **Loop de lijst na vóór de commit.** Elk onderdeel expliciet afgevinkt, niet impliciet aangenomen.

3. **Bij twijfel of iets in scope valt: vragen, niet zelf beslissen.**

Dit geldt ook als de verzoeken als losse zinnen in één bericht staan.

## Git
- Na elke commit direct pushen naar origin master: `git push origin master`
- Nooit alleen committen zonder te pushen — Vercel deployt alleen via GitHub

## UI-stijl — ALTIJD consistent toepassen

**Actief stijltoezicht**: signaleer afwijkingen van de Style Guide zodra je ze tegenkomt, ook als ze buiten de scope van het huidige verzoek vallen. Benoem het kort en vraag of je het direct mee-fixt. Wacht niet tot de gebruiker het zelf opmerkt.

**Regel**: elke keer dat een UI-norm wordt vastgesteld of gewijzigd, update je CLAUDE.md in dezelfde commit. Geen uitzondering.

**Werkwijze**: bij elke nieuwe UI-component, controleer alle elementen direct tegen de vaste normen hieronder vóór commit. Niet achteraf. Bij twijfel over de juiste norm: vragen aan de gebruiker.

### Admin UI-stijl (`/bot/admin/**`) — afwijkend van de rest van de app

De admin-sectie gebruikt een eigen, bewust andere stijlnorm dan de "Vaste normen" hierboven. Referentiebestanden: `app/bot/admin/status/page.tsx` en `app/bot/admin/gebruikers/page.tsx`.

- **Font**: sans-serif (systeemfont), niet Space Mono/Courier. Bebas Neue is alleen toegestaan voor grote cijfers/gauges (statistieken, gauge-widgets), niet voor H1/H2 of lopende tekst.
- **Body-tekst / tabel-data / datums / omschrijvingen**: 14px
- **Labels, kolomkoppen, status-badges, kleine knoppen** (vaak uppercase met letterSpacing): 12px
- **Geen 10px, 11px of 13px** in de admin-sectie, alles is 12 of 14
- **Gedempte tekst**: kleur `#6b7280` (niet via `opacity`, niet `#4b5563`, niet `#aaa`)
- **Amber accent/labels**: `#f59e0b`
- **H1**: sans-serif, fontWeight 700, fontSize 48px, letterSpacing -1px, kleur `#f1f5f9` (dus NIET de Bebas Neue 64px H1-norm van de rest van de app)
- **Witte tekst/koppen**: `#f1f5f9`

**Admin dashboard-pagina's (data-overzichten zoals `/bot/admin/stats`, niet tabel-pagina's zoals `/bot/admin/gebruikers`):** besloten 2026-08-01, referentie `app/bot/admin/stats/page.tsx` + `app/bot/admin/stats/StatsTabs.tsx`. Reden: een eerdere versie groepeerde alleen inhoudelijk (secties met dividers) maar bleef vastzitten in de smalle 800px-kolombreedte van de "Vaste normen" (bedoeld voor lopende tekst, niet voor data), waardoor elk blokje de volle breedte kreeg en onder elkaar stapelde in plaats van een scanbaar overzicht te vormen.
- **Breed canvas**: `maxWidth` rond 1400px, geen 800px-kolom zoals de rest van `/bot`.
- **Eén universele tegel-component** voor alle content (statlijst, splitbar, ratiobalken, trend), niet losse ad-hoc boxen per widget-type: zelfde achtergrond/radius/padding/amber-label, zodat het als één samenhangend geheel oogt.
- **Responsive grid van tegels** (`repeat(auto-fit, minmax(280px,1fr))`), tegels die meer ruimte nodig hebben (trends, meerdere ratiobalken) nemen 2 kolommen in via een `span`-prop, in plaats van dat alles noodgedwongen onder elkaar staat.
- **Tabs per macro-onderwerp** (bijv. Gezondheid & Retentie / Groei & Funnel / Gebruik) als lichte client component die alleen zichtbaarheid toggelt (geen herfetch van data), met de top-KPI's altijd zichtbaar boven de tabs. Data blijft volledig server-side opgehaald in de paginacomponent zelf; de client-tabs krijgen kant-en-klare, server-gerenderde content doorgegeven, geen eigen databevraging.
- **Relevantie boven volledigheid**: een sectie die permanent of tijdelijk niks zinnigs kan tonen (bijv. een ratio die pas na 30 dagen tracking betrouwbaar wordt) hoort niet als kaart met een waarschuwing te blijven staan, maar wordt achterwege gelaten totdat er daadwerkelijk iets te tonen is.

### Conversiepagina's binnen /bot (bijv. /bot/doorgaan) — volgen de marketingstijl, niet de Vaste normen

Besloten 2026-07-23: pagina's die inhoudelijk bij de marketing-/conversieflow horen (een abonnement kiezen, upgraden), ook al zitten ze achter de login binnen `/bot`, gebruiken bewust dezelfde stijl als de publieke marketingpagina's (`/prijzen`, de homepage), niet de standaard `/bot`-stijl (Space Mono/Bebas Neue) uit de "Vaste normen" hierboven. Referentie: `app/bot/doorgaan/page.tsx`, naast `/prijzen` en `/` zelf.

- **Font**: Figtree (body), Oswald (koppen/labels/knoppen, uppercase via CSS `text-transform`, niet hardcoded in de tekst zelf), zelfde Google Fonts-import als `/prijzen`
- **Kleuren**: `#f8fafc` (wit), `#94a3b8` (gedempt), niet de `#f1f5f9`/`#9ca3af` van de Vaste normen
- **Primaire knop**: radius 6px, volle amber achtergrond, gloed-schaduw (`box-shadow: 0 12px 24px rgba(245,158,11,0.25)`), hover = `scale(1.03-1.05)`, niet de pil-vorm/donkerder-wordende-achtergrond van de Vaste normen
- **`BotNav` blijft ongewijzigd**: dat is een gedeeld component, sitebreed gebruikt op elke `/bot`-pagina. Bebas Neue in de navigatielinks botst niet met deze stijl, de homepage-nav gebruikt zelf ook Bebas Neue voor `nav-login`.
- **Bij twijfel of een nieuwe `/bot`-pagina onder deze uitzondering valt**: alleen als de pagina zelf een keuze/conversiemoment is (abonnement kiezen, betalen, upgraden), niet voor gewone functionaliteit binnen de app. Bij twijfel: vragen aan Arno, niet zelf beslissen.

### PDF-documenten — merklettertypen ook in react-pdf verplicht (2026-08-22)

Twee technieken voor PDF-export in de app, met een reëel risico dat ze uit de pas lopen: `window.print()` op een gewone pagina (coaching, leiderschap) leest gewoon de CSS/Google Fonts-import van de pagina zelf, dus Bebas Neue/Space Mono werken daar vanzelf. `@react-pdf/renderer` (team-rapport, 1:1-agenda) kan geen CSS @font-face lezen en valt zonder registratie stil terug op het ingebouwde Helvetica, wat een tijd lang onopgemerkt is gebeurd (gevonden bij een PDF-inventarisatie op Arno's verzoek). Echte TTF-bestanden staan in `public/fonts/` (gedownload van Google Fonts' eigen CDN, geen live afhankelijkheid tijdens genereren), geregistreerd via de gedeelde `lib/pdfFonts.ts` (`registerBrandFonts()`, idempotent). Grote titels/getallen → Bebas Neue, labels/body → Space Mono, zelfde rolverdeling als de Vaste Normen hierboven. **Bij elk nieuw react-pdf-document**: importeer en roep `registerBrandFonts()` aan, gebruik nooit Helvetica/Helvetica-Bold. Uitzondering: `app/bot/admin/ArnoBotPdfDocument.tsx` (admin-only logexport) volgt bewust de sans-serif admin-stijlnorm, geen merklettertype nodig.

## Streepjes — ABSOLUUT VERBOD — for ever and ever

De tekens —, – en een losstaand koppelteken als leesteken (bijv. "hij deed het - maar") worden NOOIT gebruikt in arno.bot. Nergens. Nooit.

**Dit geldt voor:**
- UI-copy, labels, placeholders, knoppen, titels
- Q&A-teksten
- Alle systeemprompts van ArnoBot
- Alle AI-gegenereerde output: coaching, analyse, debrief, synthese, 1:1 agenda, spotlight, bieb, sparren

**Enige uitzondering:** een koppelteken IN een samengesteld woord waar het taalkundig onvermijdelijk is (MT-lid, oud-klant, follow-up). Nooit als leesteken ter vervanging van een komma of punt.

**Handhaving in systeemprompts:** elke route die AI-output genereert MOET deze twee zinnen bevatten in de systeemprompt:
`Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.`
`Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`

**Uitzondering op de markdown-regel:** de hoofdpersona-respons in `app/api/chat/route.ts` (`buildRdsSystemPrompt`/`buildWidgetSystemPrompt`) mag bewust `**vet**` gebruiken voor nadruk op een kernpunt. `SparClient.tsx` rendert dit via `renderContent()` naar echte HTML-opmaak (`<strong>`), gebruikers zien dus nooit een letterlijk sterretje. Deze uitzondering geldt niet voor andere AI-output binnen dezelfde route (bijv. de moderatie-redirect-tekst bij OFFTOPIC/ONGEPAST) en niet voor andere routes: die blijven platte tekst zonder markdown-opmaak. Bij twijfel of een nieuwe AI-output-plek onder de uitzondering valt: alleen als er een renderer is die `**tekst**`/`*tekst*` daadwerkelijk omzet naar opmaak, anders geldt de standaardregel.

**Als je zelf tekst schrijft of herschrijft:** vervang het streepje door een punt of komma, of herschrijf de zin. Laat het streepje nooit staan.

**Als de gebruiker zegt "haal eruit" of "verwijder":** verwijder alleen het streepje. Voeg niets terug — geen komma, geen punt, tenzij de gebruiker dat expliciet vraagt.

## Aanspreken met "jij/jou" — ALTIJD — nooit "u"

In alle AI-gegenereerde output wordt de gebruiker ALTIJD aangesproken met "jij" en "jou". Nooit "u". Dit geldt ongeacht de rang, functie of leeftijd van de gebruiker of de gespeelde persona.

**Dit geldt voor:** gesprekken, sparring-persona's, coaching, analyses, syntheses, uitdagingen, debrief, 1:1 agenda, Q&A-teksten, welkomstberichten, e-mails.

**Handhaving in sparring:** elke sparring-persona, hoe formeel ook (CEO, CFO, DGA), spreekt de gebruiker aan met "jij/jou". Nooit "u".

**Handhaving in systeemprompts:** elke route die AI-output genereert MOET bevatten:
`Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u". Ongeacht hoe senior of formeel de persoon is die je speelt.`

---

## Tijdgebonden aanwijzingen — NOOIT — geldt voor alle AI-output

Schrijf NOOIT tijdgebonden aanwijzingen in AI-gegenereerde output: geen "doe dit vandaag", "bel morgen", "verzamel voor het weekend", "pak dit deze week op", of enige andere tijdsdruk.

**Dit geldt voor:** gesprekken, uitdagingen/acties, coaching, analyses, syntheses, spotlight, 1:1 agenda, thought of the day.

**Handhaving in systeemprompts:** elke route die een actie of aanbeveling genereert MOET bevatten:
`Schrijf de actie zonder tijdslimiet: geen "vandaag", "morgen", "deze week", "voor het weekend". Gewoon de actie zelf.`

**Reden:** gebruikers zijn volwassenen die zelf bepalen wanneer ze iets doen. Tijdsdruk vanuit de app voegt niets toe en past niet bij de toon van ArnoBot.

## AI-calls — altijd loading-state tonen

Elke fetch naar een AI-route moet een zichtbare loading-indicator hebben in het gesprek of in het relevante UI-blok — niet alleen een `...` op een knop. Gebruik de bestaande `.msg-loading` + `.loading-dots` + `.loading-text` structuur, of een equivalent in context. Dit geldt ook voor nieuwe routes die buiten het hoofdgesprek vallen (synthese, doorvraag, analyse).

## Client-side status-fetches — altijd een loaded-gate — ALTIJD

**Het patroon dat dit voorkomt:** een `useState` met een default/onbekende waarde (meestal `false` of `null`, bv. `isTeamMember`, `isCommandManager`, `heeftTeamPlan`) die pas ná een async `fetch()` binnen een `useEffect` de echte waarde krijgt, terwijl de JSX daar al vanaf de allereerste render conditioneel op rendert. Resultaat: de gebruiker ziet kort de verkeerde versie (bv. het individuele profiel in plaats van het teamprofiel, of een sectie die eigenlijk verborgen hoort te zijn) voordat de fetch klaar is en de juiste versie verschijnt. Gevonden op 2026-08-24 op zeven plekken tegelijk (`app/bot/profiel/page.tsx`, `app/bot/SparClient.tsx` (twee keer, eigen nav-implementatie), `app/bot/account/page.tsx`, `app/bot/qa/QAClient.tsx`, `app/bot/BotNav.tsx`, `app/bot/coaching/CoachingClient.tsx`, `app/bot/analyses/page.tsx`), stuk voor stuk apart ontdekt in plaats van als herkend patroon.

**De fix, altijd hetzelfde patroon:** voeg een aparte `*Loaded`/`*Ready`-boolean toe (default `false`), gezet op `true` in **zowel** het succes- als het faalpad van de fetch (`.finally(() => setXLoaded(true))`, of expliciet in zowel `.then()` als `.catch()`), en gebruik die vlag om de betreffende JSX pas te renderen zodra ze `true` is — niet de losse status-state zelf. Zonder de faalpad-afhandeling blijft de pagina bij een mislukte fetch voor altijd "laden" tonen, dus nooit alleen het succespad afvangen.

**Bij elke nieuwe client-component die accountstatus/rol/plan ophaalt via een fetch in `useEffect`:** deze gate direct meebouwen, niet achteraf toevoegen. **Automatisch vangnet:** `scripts/check-missing-loaded-gate.mjs`, draait als informatieve (niet-blokkerende) CI-stap bij elke push/PR. Bevestigde false positives (bv. state die niets conditioneel in de JSX beïnvloedt, of een component dat al op een andere correcte manier gate't zoals `NotificationBell.tsx` met `if (!isManager) return null`) toevoegen aan `KNOWN_SAFE_FETCHES` in het script zelf.

## Beste resultaat vóór makkelijkste pad — ALTIJD

Bij het ontwerpen van een nieuwe feature of synthese: leid de scope niet af van wat er toevallig al gebouwd is of welke data al bestaat. Dat is de makkelijkste weg, niet automatisch de beste.

**Werkwijze, verplicht vóór elk voorstel voor nieuwe functionaliteit:**
1. Vraag eerst: wat zou dit daadwerkelijk goed maken, los van wat er nu al ligt?
2. Doorzoek actief relevante projectdocumenten in hun geheel (niet alleen de sectie waaraan gewerkt wordt) en het geheugen op gerelateerde, nog niet gebouwde plannen die het resultaat aantoonbaar sterker zouden maken.
3. Noem die vondsten expliciet in het voorstel, ook als het besluit is om ze nu niet mee te bouwen: "X zou dit sterk verbeteren, hier is waarom, hier is de afweging om het nu wel of niet mee te nemen." Nooit stilzwijgend de kortste weg presenteren alsof het de enige optie is.

**Reden:** bij het ontwerpen van punt 5 (teamcoaching-synthese, `docs/TEAM_PLAN.md`) is het voorstel gebouwd op de data die toevallig al bestond (1:1-logboek, teamscores), terwijl Fase 2A (thema-extractie over teamgesprekken, zelfde document) het resultaat fundamenteel sterker zou maken en die informatie al bekend was vóórdat het voorstel werd gedaan. Dat verband had proactief gelegd moeten worden, niet pas nadat Arno er zelf mee kwam met eigen notities.

## Nieuwe content of functionaliteit — altijd eerst voorstellen

Bij nieuwe tekst (Q&A, copy, labels) of nieuwe functionaliteit: eerst een voorstel tonen aan de gebruiker, wachten op akkoord, dan pas bouwen. Geen uitzondering.

Bij elke nieuwe pagina of component: lees eerst een bestaande pagina door en leg de stijl naast elkaar. Nooit afwijken zonder expliciete opdracht.
- **/bot-pagina's** (achter login): referentie is `app/bot/account/page.tsx`
- **Publieke pagina's** (geen login vereist): referentie is `app/privacy/page.tsx` — nooit de voorwaardenpagina als referentie gebruiken

### Vaste normen
- **Body tekst**: Space Mono, fontWeight 400, fontSize 15px, lineHeight 1.9, kleur #9ca3af
- **Labels (amber)**: Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f59e0b — geldt voor ALLE amber labels zonder uitzondering: inline, sectiekoppen, synthesetitels (SYNTHESE, TERUGBLIK, 1:1 AGENDA), configurator-labels, "BEGIN HET GESPREK", etc.
- **Subkoppen binnen AI-content** (bijv. KRACHT VAN HET TEAM, GROEIKANS in analyse-cards): Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f1f5f9 — wit, niet amber. Amber is voor UI-labels die content introduceren, niet voor hiërarchie binnen AI-gegenereerde tekst.
- **H1**: Bebas Neue, fontSize 64, letterSpacing 3, kleur #f1f5f9
- **H2**: Bebas Neue, fontSize 32, letterSpacing 2, kleur #f1f5f9
- **Primaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 36px', borderRadius 999, background #f59e0b, **color #111827**, hover #d97706. Gebruik wanneer het de enige of belangrijkste actie in een sectie is.
- **Secundaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 32px', borderRadius 999, border '1px solid #374151', color #9ca3af. Alleen gebruiken als er al een primaire knop in dezelfde context staat (bijv. Annuleren naast Opslaan).
- **Destructieve knop**: zelfde vorm als secundair maar border + color #cc2200. Voor onomkeerbare acties (verwijderen, account wissen).
- **Input/textarea**: Space Mono 15px, fontWeight 400, padding 12px 16px, borderRadius 4, border 1.5px solid #374151, focus → border #f59e0b, placeholder kleur #4b5563
- **Gedempte tekst** (artikelnummers, voetnoten, meta): #6b7280 — nooit #4b5563 buiten placeholders gebruiken
- **Secundaire link** (VOORWAARDEN, PRIVACY, SPELREGELS etc.): Space Mono, fontSize 13px, letterSpacing 4, color #6b7280, textDecoration none. Niet amber — amber trekt te veel aandacht voor secundaire navigatie.
- **Container**: maxWidth 812, padding 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px'
- **Style-tag**: altijd bovenaan met font-import, `* { box-sizing: border-box; margin: 0; padding: 0; }`, body met font-weight 400
- **Achtergrond**: #111827 pagina, #1f2937 voor cards/inputs
- **Amber scheidingslijn** (horizontale hero-divider): altijd `2px solid #f59e0b` — nooit dikker, en altijd **precies zo breed als de zichtbare hero-inhoud erboven, nooit paginabreedte**. Bij een enkel gecentreerd blok (coaching: THOUGHT OF THE DAY-kaart): de lijn op dezelfde `maxWidth` als dat blok, niet een generieke sitebrede kolom. Bij een grid met meerdere blokken naast elkaar (sparren/gesprek-hero: foto + ARNOBOT-titel): de lijn als extra grid-item met `gridColumn: '1 / -1'`, zodat hij automatisch precies zo breed wordt als de blokken + tussenruimte samen, niet een vast getal. Referentie voor het principe (niet de exacte techniek): de header-divider op de teampagina (`app/bot/team/TeamClient.tsx`), die al standaard binnen de kolombrede container zit. Geldt voor `border-bottom` op hero-secties (sparren, team, teamlid, coaching) en `border-top` op sectie-scheidingen (Q&A FAQ-blok). Correctie 2026-07-21: de hero-dividers op `/bot`, `/bot/sparren` en de coachingspagina stonden paginabreed (border direct op de full-bleed containers), nu verplaatst naar binnen de zichtbare inhoud.
- **Scheiding tussen secties ónder de hero** (dus niet de hero-divider zelf): geen amber, gewoon `1px solid #374151`, kolombreedte. Amber is gereserveerd voor de ene hero-divider bovenaan een pagina, niet voor losse sectiegrenzen daaronder.

## Gespreksstijl (ArnoBot + Bieb) — REFERENTIE is SparClient.tsx, nooit zelf afwijken
- **JIJ-label**: Bebas Neue 18px, letterSpacing 3, kleur **#6b7280**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **ARNO-label**: Bebas Neue 18px, letterSpacing 3, kleur **#f59e0b**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **JIJ-tekst (vraag)**: Bebas Neue, fontSize clamp(18px,3vw,26px), lineHeight 1.5, kleur #f1f5f9, letterSpacing 0.5px
- **ARNO-tekst (antwoord)**: Space Mono, fontSize 15px, lineHeight 1.9, kleur #9ca3af, fontWeight 400
- **JIJ-rij achtergrond**: geen (transparant = paginakleur #111827)
- **ARNO-rij achtergrond**: #1f2937 (elevated card, AI-content)
- **Padding beide rijen**: gelijk — clamp(20px,3vw,32px) horizontaal en verticaal
- **Gap label↔tekst**: clamp(16px,3vw,40px)
- **Container breedte gesprek**: maxWidth 812px, margin 0 auto
- **Designregel**: AI-gegenereerde content = #1f2937 card. Gebruikersinput = transparant op #111827.

**Let op:** `SparClient.tsx` heeft een eigen, losse nav-implementatie, niet de gedeelde `AdminNav`/`BotNav`-component. Bij elke navigatiewijziging in de rest van de app expliciet ook `SparClient.tsx` nalopen en apart bijwerken, anders loopt die stil uit de pas.

## Model-inventaris — controleer elke maand

Elke route gebruikt een bewust gekozen model. Controleer elke maand (of na een nieuwe Anthropic release) of dit nog de juiste keuzes zijn.

**Beslissingsvolgorde:** kwaliteit staat altijd op de eerste plaats. Kosten worden genoemd en meegewogen, maar bepalen het besluit niet. Een goedkoper model wordt alleen gekozen als de kwaliteit aantoonbaar gelijkwaardig is voor die specifieke taak.

| Route | Model | Reden | Laatste check |
|---|---|---|---|
| `app/api/chat/route.ts` (hoofdchat, streaming) | `claude-sonnet-4-6` | Sonnet 5 teruggedraaid: bij lange/complexe vragen geen text block in response (thinking mode zonder output). Deze call gebruikt `.messages.stream(`, niet `.messages.create(` — werd bij de eerste 2026-07-fixronde over het hoofd gezien omdat die alleen op `.messages.create(` zocht, en had daardoor als enige hoog-volume route nog geen retry/fallback. Alsnog voorzien van retry-bij-leeg-antwoord ná het einde van de stream (`finalMessage()`) plus een zichtbare fallbackzin, zodat er nooit een leeg antwoord in `arnobot_rds_logs`/`arno_blog_widget_logs` terechtkomt. Hercheck of Sonnet 5 zelf ooit weer bruikbaar wordt. **Aanvulling (2026-08-18):** naar aanleiding van hetzelfde afkap-patroon dat bij de meta-analyse werd gevonden (zie de JOUW ANALYSE-rijen hieronder), bleek deze route geen check te hebben op `stop_reason === 'max_tokens'`, alleen op een volledig leeg antwoord. Omdat dit een streaming-route is, is een antwoord dat wordt afgekapt al (deels) naar de gebruiker gestreamd vóórdat dat bekend wordt, een retry zoals bij meta-analyse repareert dat dus niet met terugwerkende kracht. `max_tokens` per lengte-tier kreeg een kleine buffer (kort 600→750, normaal 1200→1450, uitgebreid 2200→2500, widget 1500→1800) om te voorkomen dat een antwoord dat net over de grens dreigt te gaan midden in een woord stopt, zonder de bewust beknopte coach-stijl los te laten. Afkapping die tóch nog optreedt wordt nu gelogd naar Sentry (`[chat] antwoord afgekapt op max_tokens`), zodat de frequentie in productie zichtbaar wordt in plaats van onopgemerkt te blijven. | 2026-07, aangevuld 2026-08-18 |
| `app/api/chat/route.ts` (RAG-queryherschrijving/checks) | `claude-haiku-4-5-20251001` | Korte classificatie/herschrijfstappen binnen de hoofdchat, met expliciete fallbacks. | 2026-07 |
| `app/api/bot/uitdaging/route.ts` | `claude-fable-5` | Grammaticale kwaliteit en voortgangsherkenning vereisen Fable. max_tokens 600 (thinking telt mee). Prompt uitgebreid met taalcontrole en progressie-instructie. Had wel een refusal-check maar geen check op een leeg-maar-niet-refusal antwoord; nu alsnog retry-bij-leeg-antwoord en een expliciete foutrespons (niet opgeslagen) bij aanhoudend leeg antwoord. **Getest tegen `claude-opus-5` (2026-07-26, `scripts/test-opus5-vs-fable5.mjs`, blinde vergelijking op echte data):** Fable 5 gehandhaafd. Fable 5's vraag was korter en directer (1 zin vs. 2), sloot beter aan bij Arno's stem. Verworpen: overstap naar Opus 5.
| `app/api/bot/session-end/route.ts` (synthese/feiten/uitdaging) | `claude-haiku-4-5-20251001` | Drie parallelle batch-calls per sessie. Had geen individuele leeg-check: een stil leeg antwoord (geen exception) werd altijd opgeslagen in `arnobot_blog_sessions`, zichtbaar in de Bieb. Nu per call retry-bij-leeg-antwoord; de samenvatting (het zichtbare terugblik-veld) krijgt bovendien een tekstuele fallback bij aanhoudend leeg antwoord, feiten/uitdaging blijven bewust optioneel leeg (niet kritiek voor de gebruiker). **Aanvulling (2026-08-21):** 4e parallelle call toegevoegd, classificeert de sessie naar maximaal twee labels uit een vaste taxonomie (`lib/themas.ts`) voor De Spiegel (Team-module punt 2A, `docs/TEAM_PLAN.md`). Bewust géén retry-bij-leeg-antwoord: dit is een supplementair signaal (`.catch(() => null)`), geen kritiek pad, een falende classificatie mag de sessie-opslag nooit blokkeren. | 2026-07, aangevuld 2026-08-21 |
| `app/api/bot/coaching/route.ts` (precheck) | `claude-sonnet-5` | Alleen ja/nee-vraag, Fable 5 overkill | 2026-07 |
| `app/api/bot/team/zelfcoaching/route.ts` (Strategy People Execution-synthese, punt 5 team-module) | `claude-fable-5` | Nieuw (2026-08-21): coachingssynthese voor de teambaas zelf, zelfde afweging als de individuele coaching-hoofdsynthese hieronder (belangrijkste synthese van het traject, kosten geen factor). Refusal-check + retry-bij-leeg-antwoord aanwezig vanaf de eerste versie (niet pas achteraf toegevoegd zoals bij eerdere routes). Live end-to-end getest met een echte Anthropic-call op geseede testdata vóór livegang, zie `docs/TEAM_PLAN.md`. **Aanvulling (2026-08-22):** krijgt nu ook de eigen recente `arnobot_blog_sessions` van de teambaas zelf als aparte context (naast teamdata en 1:1's), zodat zijn eigen coachingsgesprekken op de hoofdchat ook meetellen, net als bij een verkoper. Nu ook de "vaste" pagina achter `/bot/coaching` (rolbewust, zie hieronder), niet langer alleen een kaart in `/bot/team`. **Tweede aanvulling, zelfde dag:** JSON-schema uitgebreid met `ontwikkelpunten` (3 punten, getagd op pijler), zelfde patroon als de individuele coaching-hoofdsynthese hieronder maar zonder de blog-koppeling. Diagnose-instructie verzwaard van "2-3 zinnen" naar "precies 3-4 volwaardige zinnen met specifieke voorbeelden", de output bleef er eerder vaak bij 1-2 zinnen steken. Expliciete toon-instructie toegevoegd: altijd als professional/senior benaderen, ook bij weinig leidinggevende ervaring, nooit belerend of relativerend (Arno's expliciete instructie). | 2026-08-21, aangevuld 2026-08-22 |
| `app/api/bot/coaching/route.ts` (hoofdsynthese) | `claude-fable-5` | Hoogste kwaliteit voor de belangrijkste synthese. max_tokens 4000 (was 1600): thinking telt mee in het token budget, 1600 was te krap. Refusal check toegevoegd. getText() handelt thinking-blocks correct af. **Retry-bij-leeg-antwoord toegevoegd (2026-08-01, kwartaalcheck):** had als enige van de vergelijkbare synthese-routes nog geen retry, alleen een refusal-check en een JSON-parse-vangnet; bij aanhoudend leeg antwoord na retry nu een expliciete foutrespons i.p.v. een onverklaarde `parse_error`. **Getest tegen `claude-opus-5` (2026-07-26, `scripts/test-opus5-vs-fable5.mjs`, blinde vergelijking op echte data):** Fable 5 gehandhaafd. Inhoudelijk nagenoeg gelijkwaardig, maar Opus 5 liet in deze testrun de drie verplichte `mindset_richting`/`systeem_richting`/`actie_richting`-velden uit het JSON-antwoord weg (schema-afwijking, risico op kapotte richting-badge in de UI), Fable 5 leverde ze correct. Verworpen: overstap naar Opus 5. Eén testrun, geen herhaalde meting; bij een volgende poging eerst opnieuw draaien om te zien of dit een patroon is.
| `app/api/bot/coaching/route.ts` (blog-synthese) | `claude-haiku-4-5-20251001` | Korte label per blog, Haiku volstaat | 2026-07 |
| `app/api/bot/coaching-analyse/route.ts` (Analyses-pagina) | `claude-sonnet-4-6` | Gemigreerd van Sonnet 5 (2026-07-audit): kon bij langere prompts stil een leeg antwoord teruggeven dat direct als analyse werd opgeslagen. Nu retry-bij-leeg-antwoord, en bij aanhoudend leeg antwoord een zichtbare foutmelding i.p.v. een lege analyse. | 2026-07 |
| `app/api/bot/team/spotlight/route.ts` (team spotlight) | `claude-sonnet-4-6` | Zelfde migratie/reden als coaching-analyse hierboven. Cruciale boodschap voor manager, mag niet stil leeg blijven. **Aanvulling (2026-08-21):** krijgt nu ook maandelijkse thema-geschiedenis als context (punt 2B "De Tijdlijn", `computeThemaMaandTrend` in `lib/spiegel.ts`), met een expliciete promptinstructie om aanhoudende thema's te duiden (verdieping vs. vastzitten) i.p.v. alleen te tonen. Live geverifieerd met echte Anthropic-output op gesimuleerde meerdere-maanden-data, zie `docs/TEAM_PLAN.md`. **Tweede aanvulling, zelfde dag:** ook het actuele 21-dagen-signaal (`computeSpiegelSignaal`, punt 2A "De Spiegel") is nu context hier, nadat de losse UI-kaart daarvoor is verweerd op precies dezelfde klacht ("wat moet ik hiermee") en verwijderd. `app/api/bot/team/spiegel/route.ts` (de losse route die de kaart voedde) is als orphan route verwijderd. | 2026-07, aangevuld 2026-08-21 |
| `app/api/bot/team/1on1/route.ts` (1:1 agenda) | `claude-haiku-4-5-20251001` | Sonnet 5 teruggedraaid: thinking-mode kapt output af midden in een zin (zelfde probleem als hoofdchat). Haiku doet geen thinking, is 5-10x sneller en volstaat voor gestructureerde agenda op basis van aangeleverde data. | 2026-07 |
| `app/api/sparring/debrief/route.ts` | `claude-sonnet-4-6` | **Bevestigde bug (2026-07):** stond nog op Sonnet 5, gaf bij lange sparring-transcripten (24-28 berichten) een lege debrief terug die stil werd opgeslagen (live geconstateerd: een testgebruiker had 2 sparsessies met een lege debrief, waardoor ArnoBot niet wist dat er gesparred was). Ontbrak eerder in deze tabel. Nu retry-bij-leeg-antwoord plus een zichtbare fallbacktekst i.p.v. een lege debrief. | 2026-07 |
| `app/api/sparring/chat/route.ts` (live sparring-gesprek) | `claude-sonnet-4-6` | Zelfde sessie/oorzaak als sparring/debrief hierboven, ontbrak eveneens in deze tabel. **Bevestigde bug (2026-07, testfeedback Thijs):** bij een leeg antwoord (bv. lastige rolomschrijving bij de "anders"-persona) toonde de route een in-karakter noodzin i.p.v. een echte foutmelding, en de client checkte `res.ok` niet, dus de gebruiker zag stil een nietszeggend "Er ging iets mis." zonder duidelijke oorzaak of vervolgstap. Nu try/catch + Sentry.captureException om de aanroep zelf (dekt ook een gooiende aanroep, niet alleen leeg), route geeft een expliciete 502 i.p.v. een nepantwoord, client toont een eerlijke uit-karakter melding met concrete vervolgstap. | 2026-07 |
| `app/api/sparring/open/route.ts` (opening van een sparring-gesprek) | `claude-sonnet-4-6` | Ontbrak volledig in deze tabel. Zelfde bug en fix als sparring/chat hierboven (zelfde testfeedback-sessie), inclusief de fallback-opening ("Kom binnen. Ga zitten.") die verving door een expliciete 502-foutrespons. | 2026-07 |
| `app/api/cron/auto-analyse/route.ts` | `claude-sonnet-4-6` | Batchanalyse over max 20 gesprekken per gebruiker, zelfde risico als coaching-analyse. Ontbrak eerder in deze tabel. Bij aanhoudend leeg antwoord wordt die gebruiker overgeslagen i.p.v. een lege analyse op te slaan en een foutieve "bijgewerkt"-mail te versturen. | 2026-07 |
| `app/api/admin/analyse-evaluaties/route.ts` | `claude-sonnet-4-6` | Interne evaluatie-analyse, ontbrak eerder in deze tabel. Bevatte ook een tijdgebonden instructie in de prompt ("wat je morgen moet aanpakken"), losstaand gecorrigeerd naar tijdsneutrale taal. | 2026-07 |
| `lib/rag.ts` (queryherschrijving RAG) | `claude-haiku-4-5-20251001` | Genereert 3 zoekzinnen per vraag (multi-query expansion), eenvoudige herschrijftaak, Haiku volstaat | 2026-07 |
| `lib/rag.ts` (embedding, kennisbank RAG) | `voyage-3-large` | Legacy model, geen gratis toelage. Upgrade naar `voyage-4-large` bewust NIET losstaand gedaan: breekt de kennisbank-zoekfunctie volledig (0 treffers, live geverifieerd), want de hele kennisbank is met dit model vooraf ge-embed. Vereist eerst volledige her-embedding, zie openstaand actiepunt hierboven. | 2026-07 |
| `lib/rag.ts` (rerank, kennisbank RAG) | `rerank-2.5` | Geüpgraded van `rerank-2` (legacy): door Voyage zelf bevestigd als strikt beter op kwaliteit, contextlengte, latency en throughput, zelfde prijs | 2026-07 |
| `lib/rag.ts` (`embedSessionText`, sessie-geheugen) | `voyage-multilingual-2` | **Bug gevonden en gefixt (2026-08-12):** `session-end/route.ts` schreef sinds 10 juni 2026 embeddings weg met `voyage-3-large` i.p.v. `voyage-multilingual-2`, een gemiste migratie (zie sectie 3 hierboven, "Embedding-consistentiecheck"). Alle 88 bestaande sessies opnieuw geëmbed met het juiste model, en alle schrijvers (`session-end/route.ts`, `sessions/route.ts`, `sessions/embed/route.ts`) geconsolideerd naar deze ene gedeelde functie zodat dit niet stilletjes opnieuw kan gebeuren. **Openstaand actiepunt (2026-08-12, bevestigd via de nieuwe web_search-modelcheck-agent en onafhankelijk geverifieerd):** `voyage-multilingual-2` is door Voyage AI als deprecated gemarkeerd, opvolger is de voyage-4-serie (`voyage-4` of `voyage-4-large`, beide met 200M gratis tokens/maand, multilingual ondersteund). Upgrade bewust NIET losstaand gedaan: vereist volledige her-embedding van alle bestaande sessies (zelfde soort operatie als de `voyage-3-large`-kennisbank hieronder), niet en passant meenemen bij een andere wijziging. | 2026-08-12 |
| `app/api/bot/coaching-precheck/route.ts` | `claude-sonnet-4-6` | Losse ja/nee-check, expliciete fallback (`'nee'`), laag risico door korte prompt. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift, code was al gemigreerd, deze tabelrij niet). | 2026-07 |
| `app/api/bot/verfijn/route.ts` | `claude-sonnet-4-6` | Herschrijft een gebruikersvraag, expliciete fallback (de originele vraag), input gemaximeerd op 2000 tekens. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift). | 2026-07 |
| `app/api/bot/search-linkedin-profile/route.ts` | `claude-sonnet-4-6` (+ web_search tool) | Losse opzoektaak met expliciete "niet gevonden"-afhandeling. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift). | 2026-07 |
| `app/api/bot/sessions/route.ts` | `claude-haiku-4-5-20251001` | Ontbrak eerder in deze tabel, nog niet beoordeeld op leeg-antwoord-risico. | 2026-07 |
| `app/api/bot/sessions/search/route.ts` | `claude-haiku-4-5-20251001` | JSON-fallback (`[]`) bij parse-fout aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `lib/memoryEntities.ts` (`extractAndStoreEntities`) | `claude-haiku-4-5-20251001` | Nieuw (2026-08-12): extraheert namen/bedrijven/thema's per sessie voor `arnobot_memory_entities` (gat 2 van het geheugentraject). JSON-fallback (`[]`) bij parse-fout, hele extractie faalt stil (try/catch, geen retry, laag risico: optioneel patroongeheugen, geen kritiek pad). | 2026-08-12 |
| `app/api/cron/refresh-openers/route.ts` | `claude-sonnet-4-6` | Expliciete check op geldige JSON-structuur aanwezig. Stond hier eerder foutief als `claude-sonnet-5` vermeld (2026-07-audit-drift). | 2026-07 |
| `app/api/cron/rss-ingest/route.ts` | `claude-haiku-4-5-20251001` | Expliciete fallback-tekst aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/inactivity-nudge/route.ts` | `claude-haiku-4-5-20251001` | Valt terug op generieke e-mailtemplate bij een fout, nog niet expliciet bij een leeg (maar niet-foutend) antwoord. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/model-check/route.ts` (eigen adviesgeneratie, e-mail only) | `claude-sonnet-4-6` (+ web_search tool) | **Herontworpen (2026-08-12):** stond op `claude-haiku-4-5-20251001` met een hardcoded "beschikbare modellen"-zin in de prompt, dus het advies was giswerk op trainingskennis, niet op actuele info, en die hardcoded zin was zelf al verouderd (noemde Sonnet 4.6/Opus 4.8 als "meest recent" terwijl Opus 5/Sonnet 5 al bestonden). Nu: haalt de modelinventaris-tabel live op uit CLAUDE.md via de GitHub API (i.p.v. een losse `INVENTORY`-kopie die kon afwijken, zie de audit-drift-notities hieronder) en doet een echte `web_search` naar de actuele Anthropic- en Voyage AI-pricingpagina's vóór advies. Mail bevat nu ook een "voorgestelde wijziging"-sectie (platte tekst, geen auto-commit naar CLAUDE.md). Faalt hard (Telegram-notificatie via `notifyCronFailure`) als CLAUDE.md niet opgehaald kan worden, i.p.v. stil terug te vallen op een verouderde kopie. | 2026-08-12 |
| `app/api/admin/feedback-analyse/route.ts` | `claude-haiku-4-5-20251001` | Nog geen expliciete leeg-check. Ontbrak eerder in deze tabel. | 2026-07 |
| `scripts/embed-chunks.mjs` (contextgeneratie per chunk) | `claude-haiku-4-5-20251001` | Offline script dat de kennisbank (`blog_chunks`) vult. Heeft een try/catch-fallback (`Fragment uit: ...`) maar geen check op een leeg-maar-niet-foutend antwoord; resultaat wordt permanent in de kennisbank opgeslagen. Ontbrak volledig in deze tabel (2026-07-audit-verificatie). | 2026-07 |
| `scripts/translate-knowledge-base.mjs` | `claude-opus-5` | Offline vertaalscript, enige plek in de codebase die Opus gebruikt. Gebruikt `tool_choice` om een tool_use te forceren; ontbrekende tool_use wordt afgevangen (post overgeslagen). Geüpgraded van `claude-opus-4-8`: Opus 5 kost hetzelfde ($5/$25 per miljoen tokens, gelijk aan Opus 4.8) maar presteert flink beter, onafhankelijk bevestigd door Artificial Analysis (#1 op Intelligence Index en Agentic Index, vóór Fable 5). | 2026-07 |
| `app/api/admin/blogs-analyse/route.ts` | `claude-sonnet-4-6` | Redactionele briefing, direct opgeslagen in `arnobot_idee_analyses`. Had geen retry/leeg-check (2026-07-audit-verificatie); nu retry-bij-leeg-antwoord met expliciete foutrespons (niet opgeslagen) bij aanhoudend leeg antwoord. | 2026-07 |
| `app/api/admin/meta-analyse/route.ts` (zelfbeoordeling + expertpanel) | `claude-fable-5` | **Geüpgraded van `claude-sonnet-4-6` (2026-08-18):** Arno heeft dit expliciet als essentieel onderdeel van ArnoBot bestempeld, kosten zijn hier bewust geen factor, zelfde afweging als de coaching-hoofdsynthese. Refusal-check toegevoegd (was er nog niet, alleen leeg-antwoord-retry), `max_tokens` opgehoogd (zelf 4000→6000, panel 8000→10000) voor Fable 5's thinking-overhead. Aantal meegenomen gesprekken schaalt nu met de gekozen periode (`conversationCap()`: week 15, maand 25, kwartaal 40, i.p.v. altijd hard op 12) zodat "kwartaal" kiezen ook echt meer gesprekken analyseert. | 2026-08-18 |
| `app/api/admin/meta-analyse/route.ts` (jouw analyse) | `claude-fable-5` | Nieuw (2026-08-18), zelfde dag geüpgraded naar Fable 5. Derde, aparte sectie naast zelfbeoordeling/expertpanel. Verwerkt Arno's eigen geschreven input (het tekstvak "JOUW INPUT VOOR HET PANEL") puntsgewijs, los van het jury-format dat zijn input eerder samendrukte tot 3-4 zinnen en één kritisch punt. Elk afzonderlijk punt dat hij noemt krijgt een eigen blok met een eigen aanbeveling, geen vast aantal. Alleen aangeroepen als er input aanwezig is. **Bevestigde bug (2026-08-18):** Arno's eerste test met drie ingevoerde onderwerpen kwam niet terug, deze sectie faalde stil (leeg antwoord na retry) zonder enig signaal in de UI, hij zag alleen de bestaande tabs en dacht dat zijn input genegeerd werd. Nu: refusal-check toegevoegd naast de leeg-check, en bij aanhoudende mislukking na retry toont de UI expliciet een waarschuwing (`jouwAnalyseFailed` in de response) in plaats van stilzwijgend geen derde tab te tonen. `/apply-meta` neemt alle punten uit deze sectie apart mee, niet beperkt tot de top-3-selectie die voor de rest van de analyse geldt. | 2026-08-18 |
| `app/api/cron/meta-analyse/route.ts` (zelfbeoordeling + expertpanel) | `claude-fable-5` | **Geüpgraded van `claude-sonnet-4-6` (2026-08-18):** zelfde upgrade en reden als de admin-variant hierboven. `maxDuration` opgehoogd van 60s naar 300s: Fable 5 is aantoonbaar trager per aanroep dan Sonnet, en 60s was al krap voor twee parallelle calls. Aantal gesprekken van hard 12 naar 25 (gelijk aan de "maand"-cap van de admin-route, deze cron draait altijd op een vaste periode van 30 dagen). | 2026-08-18 |
| `app/api/cron/meta-analyse/route.ts` (jouw analyse) | `claude-fable-5` | Zelfde derde sectie als de admin-variant hierboven, nu ook in de maandelijkse e-mail. Zelfde dag geüpgraded naar Fable 5 en voorzien van refusal-check, om dezelfde stille-faalronde te voorkomen als bij de admin-route werd geconstateerd. Alleen aangeroepen en getoond als er input aanwezig is; faalt de call na retry, dan wordt alleen deze sectie overgeslagen, de rest van de mail/opslag gaat gewoon door. | 2026-08-18 |
| `app/api/admin/test-email/route.ts` | `claude-haiku-4-5-20251001` | Admin-testtool, geen gebruikersgerichte output. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/admin/analyse/route.ts` (briefing per gebruiker) | `claude-fable-5` | Nieuw (2026-08-25): ANALYSE-tab in admin (`/bot/admin/analyse`), tussen GESPREKKEN en STATUS. Zelfde afweging als de coaching-hoofdsynthese en meta-analyse: dit vervangt Arno's eigen handmatige uitzoekwerk vóór een gesprek met een gebruiker, kwaliteit weegt zwaarder dan kosten. Refusal-check + leeg-antwoord-retry + max_tokens-verdubbeling bij afkapping aanwezig vanaf de eerste versie. Databundel (gesprekken, coaching, profiel, teamdata bij een teambaas) via de gedeelde `gatherAdminAnalyseContext()` in `lib/adminAnalyse.ts`. Analyse blijft bewaard in `arnobot_admin_analyses` met een VERNIEUW-knop. | 2026-08-25 |
| `app/api/admin/analyse-chat/route.ts` (doorvragen op de briefing) | `claude-fable-5` | Zelfde dag, zelfde databundel als de briefing hierboven. Bewust niet opgeslagen: het doorvraaggesprek bestaat alleen voor het huidige bezoek, alleen de briefing zelf blijft bewaard. | 2026-08-25 |
| `app/api/transcribe/route.ts` | `whisper-1` (OpenAI, rauwe fetch, geen SDK) | Spraak-naar-tekst voor voice-input. Ontbrak volledig uit deze tabel én uit de privacypagina/beveiligingsdocument (2026-07-audit-verificatieronde, zie OpenAI-sectie hierboven). | 2026-07 |
| `app/api/chat-voice/route.ts` (ArnoBot Voice, echte gebruikers, `plan` premium/team) | `claude-sonnet-4-6` | Eigen, korte voice-systeeminstructie (`buildVoiceSystemPrompt` in `lib/systemPrompt.ts`, doellengte 400-600 tekens, gespreksachtig). Niet-streamend (`.messages.create()`), want bij zulke korte antwoorden weegt de streaming-boilerplate niet op tegen de winst. Claude-call-plus-retry-logica in `lib/voice.ts` (`getVoiceAnswer`), gedeeld met de admin-testroute. Eigen Upstash-rate-limiter (30/uur per gebruiker, `arnobot:voice-chat`), los van de hoofdchat-limiter. | 2026-07 |
| `app/api/tts-voice/route.ts` (ArnoBot Voice, echte gebruikers, `plan` premium/team) | `eleven_flash_v2_5` (ElevenLabs, rauwe fetch, geen SDK) | Streaming tekst-naar-spraak, ElevenLabs-fetch-logica in `lib/voice.ts` (`fetchElevenLabsSpeech`), gedeeld met de admin-testroute. Verbruik gelogd in `arnobot_elevenlabs_usage` met de echte Clerk `userId`. Eigen rate-limiter (60/uur, `arnobot:voice-tts`). | 2026-07 |
| `app/api/admin/voice-test/chat/route.ts` (ArnoBot Voice, admin-only testfase) | `claude-sonnet-4-6` | Interne testroute voor stem/latency/stijl, blijft bestaan naast de publieke route. Gebruikt dezelfde `getVoiceAnswer()` uit `lib/voice.ts`. Alleen bereikbaar via `/bot/admin/voice-test`, geen Clerk-auth. | 2026-07 |
| `app/api/admin/voice-test/tts/route.ts` (ArnoBot Voice, admin-only testfase) | `eleven_flash_v2_5` (ElevenLabs, rauwe fetch, geen SDK) | Interne testroute, gebruikt dezelfde `fetchElevenLabsSpeech()` uit `lib/voice.ts`. Verbruik gelogd met de vaste waarde `'admin-voice-test'`. | 2026-07 |

**Hoe te controleren**: vraag Claude Code "check de modelinventaris in CLAUDE.md — zijn er nieuwere of betere modellen beschikbaar bij Anthropic of Voyage AI?"

**Openstaand actiepunt:** hoofdchat staat op `claude-sonnet-4-6` omdat Sonnet 5 bij lange vragen in thinking mode gaat zonder text block te produceren. Hercheck of Anthropic dit gedrag heeft aangepast, of schakel extended thinking bewust in met `budget_tokens` zodat Sonnet 5 altijd ook een text block produceert. Test eerst op staging voordat je terugzet naar Sonnet 5. **Niet uitvoeren rond de commerciële livegang — wacht minimaal een week na go-live.** Correctie (2026-08-01): livegang was hier nog genoteerd als 1 augustus 2026, maar is met een of twee maanden uitgesteld (nu vermoedelijk september/oktober 2026). Check bij Arno de actuele geplande datum vóór je dit oppakt, ga niet af op een datum die eerder in dit document heeft gestaan.

**Nieuwe informatie (2026-08-12, via de web_search-modelcheck-agent, onafhankelijk geverifieerd met een losse websearch, geen aanname uit trainingskennis):** Sonnet 5's introductieprijs ($2/$10 per miljoen tokens) is per 11 augustus 2026 permanent gemaakt door Anthropic, de geplande verhoging naar $3/$15 per 1 september gaat niet door, dus Sonnet 5 is nu structureel goedkoper dan Sonnet 4.6. Anthropic's eigen documentatie noemt bij Sonnet 5 en Opus 4.7+ expliciet `display: omitted`-gedrag rond adaptive thinking, wat een mogelijke verklaring is voor de oude lege-tekst-bug, maar dit is een hypothese uit de agent-analyse, geen bevestigd oorzakelijk verband. Verandert niets aan de bovenstaande volgorde (eerst livegang-timing checken bij Arno, dan pas op staging testen), maakt de hercheck wel aantrekkelijker zodra dat moment daar is.

**Gedaan (2026-07-audit):** `app/api/cron/model-check/route.ts` bevatte een eigen, hardgecodeerde `INVENTORY`-kopie die los stond van deze tabel en er inmiddels van afweek (bijv. `bot/uitdaging` stond daar nog als `claude-sonnet-5` i.p.v. `claude-fable-5`). Gelijkgetrokken met deze tabel.

**Gedaan (2026-07-audit):** `arnobot/route.ts` (feedback-modus) en `canvas/alignment/route.ts` (summaryMsg) hadden geen expliciete leeg-antwoord-bescherming. Beide voorzien van retry-once + fallback, net als de eerdere fixronde. **Achterhaald (2026-07-23):** beide routes zijn inmiddels verwijderd, samen met de rest van RDS Canvas (nooit functioneel, zie project-geheugen). Deze notitie blijft staan als historisch record, niet als actuele status.

**Gedaan (2026-07-audit, onafhankelijke verificatieronde):** een tweede, onafhankelijke sweep-agent zocht niet alleen op `.messages.create(` maar ook op `.messages.stream(` en op offline scripts, en vond wat de eerste fixronde had gemist:
- **Kritiek:** `app/api/chat/route.ts` (hoofdchat) gebruikt `.messages.stream(`, niet `.messages.create(`, en werd daardoor door de eerste grep-gebaseerde audit volledig gemist. Dit is de route met het hoogste verkeer en had geen retry/fallback. Alsnog voorzien van dezelfde bescherming.
- **Documentatie-drift:** 9 tabelrijen (`coaching-precheck`, `verfijn`, `search-linkedin-profile`, `canvas/alignment` samenvatting + vraaganalyse, `canvas/alignment-chat`, `arnobot/route.ts` feedback-modus + score-modus, `cron/refresh-openers`) stonden hier nog als `claude-sonnet-5` vermeld terwijl de code al `claude-sonnet-4-6` draaide. Oorzaak: bij de eerste fixronde is de code gewijzigd maar de tabelrijen zelf niet bijgewerkt, alleen losse "Gedaan"-notities toegevoegd. Omdat `cron/model-check`'s `INVENTORY` vervolgens gelijkgetrokken werd met déze (nog foute) tabel, deelden beide bronnen dezelfde fout. Alle 9 rijen gecorrigeerd.
- **Persist-zonder-check:** `admin/blogs-analyse`, `admin/meta-analyse` (2 calls), `cron/meta-analyse` (2 calls) en `bot/session-end` (3 calls) sloegen AI-output rechtstreeks op zonder retry of leeg-check. Alle vier voorzien van retry-bij-leeg-antwoord; bij aanhoudend leeg antwoord wordt niet opgeslagen (admin-routes: foutrespons; cron/meta-analyse: overgeslagen zonder mail) behalve bij session-end, waar de zichtbare terugblik een tekstuele fallback kreeg om de sessie toch te kunnen opslaan.
- `bot/uitdaging/route.ts` had wel een refusal-check maar geen check op een leeg-maar-niet-refusal antwoord. Alsnog retry-bij-leeg-antwoord toegevoegd.
- Ontbrekende rijen toegevoegd: `scripts/embed-chunks.mjs`, `scripts/translate-knowledge-base.mjs` (`claude-opus-4-8`, enige Opus-gebruik in de codebase), en `cron/model-check`'s eigen adviesgeneratie-call.
- `cron/model-check`'s `INVENTORY` moet na deze ronde OPNIEUW gelijkgetrokken worden met deze tabel (zie actiepunt hieronder) — anders herhaalt de drift zich.
- Voyage AI-rijen (`voyage-3-large`, `voyage-multilingual-2`, `rerank-2.5`) klopten al volledig, geen wijziging nodig.

**Gedaan (2026-07-audit, verificatieronde):** `app/api/cron/model-check/route.ts`'s `INVENTORY`-constante bevatte nog de OUDE (foute) modelnamen voor de 9 hierboven gecorrigeerde routes, omdat die er in de vorige fixronde 1-op-1 uit deze tabel zijn gekopieerd terwijl de tabel toen zelf nog fout was. Nu opnieuw gelijkgetrokken, inclusief de twee ontbrekende scripts.

**Openstaand actiepunt (2026-07-audit):** de routes hierboven zonder expliciete leeg-antwoord-bescherming (`cron/refresh-openers`, `bot/sessions*`, `admin/feedback-analyse`, e.a.) zijn bewust NIET meegenomen in deze fixronde: lager risico door kortere prompts, Haiku (geen thinking-mode) of al aanwezige gedeeltelijke bescherming. Bij een volgende maandcheck opnieuw beoordelen of dit nog steeds volstaat, vooral als een van deze prompts qua lengte/complexiteit groeit.

## E-mail crons — ALTIJD via email-templates.ts

Elke cron die een e-mail naar gebruikers stuurt:
1. Voeg het type toe aan `EmailType` in `lib/email-templates.ts`
2. Voeg metadata toe in `EMAIL_META` (label, description, category) op de **chronologisch juiste positie** in de lifecycle
3. Voeg een `case` toe in `getEmailTemplate()` voor de inhoud
4. Gebruik `getEmailTemplate()` in de cron route — **nooit** inline `emailHtml()` direct aanroepen

Zo verschijnt elke mail automatisch in de admin CRONS-pagina (`/bot/admin/emails`) in de juiste volgorde en is direct testbaar zonder code aan te passen.

**Volgorde in `EMAIL_META` is lifecycle-chronologisch:** trial onboarding → betaalstroom → post-trial → recurring → events → admin.

---

## E-mail stijl — lib/email-templates.ts

E-mails hebben een eigen stijlnorm die afwijkt van de web-UI. Nooit Courier New gebruiken in e-mail. Nooit Bebas Neue voor de knop (laadt niet betrouwbaar in e-mailclients).

### Layout
- Achtergrond: `#111827`, max-width `560px`, padding `48px 40px 40px 40px`, `margin: 0 auto`
- Google Fonts @import voor Bebas Neue staat in `<style>` tag in `<head>`

### ARNOBOT header
- Font: `'Bebas Neue','Arial Black',Impact,sans-serif`, 26px, letter-spacing 6px
- "ARNO" in `#f1f5f9` (wit), "BOT" in `#f59e0b` (amber)

### [TEST EMAIL] label
- Font: Arial, 11px, letter-spacing 2px, kleur `#6b7280`

### Aanhef
- Tekst: `Hey, {voornaam}.` — altijd de voornaam van de ontvanger, nooit hardcoded
- Font: Arial/-apple-system/sans-serif, 16px, font-weight 700, kleur `#f1f5f9`

### Bodytekst
- Font: `Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`
- 15px, kleur `#9ca3af`, line-height 1.8
- Geen Courier New — dat is de fallback voor Space Mono op het web, maar ziet er slecht uit in e-mail

### Knop (CTA)
- Font: `Arial,-apple-system,sans-serif` — NIET Bebas Neue, NIET Arial Black
- 14px, font-weight 600, letter-spacing 0.5px
- Padding: `12px 24px`, border-radius `999px`
- Background `#f59e0b`, color `#111827`
- Knop valt op door kleur en vorm, niet door een display-font

### Opt-out footnote
- Font: Arial, 12px, kleur `#6b7280`, margin-top `48px` (ruime afstand na knop)
- Tekst: `Geen mail meer? <a href="...">Klik dan hier.</a>` — link kleur `#9ca3af`
- Alleen verplicht in marketingmails: `weekly_nudge`, `geen_gesprek_nudge`, `winback`

### © ARNOBOT
- Font: Arial, 11px, kleur `#374151`

### Marketing vs. transactioneel
- **Transactioneel** (geen opt-out vereist): dag1, dag4, first_conversation, dag14, first_coaching, dag25, betaalwaarschuwing, geblokkeerd, trial_afgelopen, opzegging_bevestiging, referral_aanmelding
- **Marketing** (opt-out verplicht): weekly_nudge, geen_gesprek_nudge, winback

### Opt-out mechanisme
- Opt-out link in e-mail → `https://arno.bot/optout/{userId}` — publieke pagina, één klik, geen login
- userId wordt meegegeven via `options.userId` in `getEmailTemplate()`
- Winback-gebruikers hebben geen actief account meer → opt-out via `mailto:arno@arno.bot`

---

## Foto (header in arnobot/page.tsx)
- NOOIT meer aanpassen tenzij de gebruiker er expliciet om vraagt
- Huidig formaat: `<img src="/cyborg.jpg" style={{display:'block', width:'380px', maxWidth:'100%', height:'auto'}} />` in een `subscribe-text-col` div
- Geen background-image, geen position:absolute, geen objectFit — gewoon de img tag

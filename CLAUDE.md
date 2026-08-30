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

## Documentatie actueel houden — ALTIJD

Drie documenten met elk een eigen doel en actualiteitsrisico, naast de plandocumenten hierboven:

- **`docs/ARNOBOT_OVERZICHT.md`**: product-uitleg voor buiten de bouwsessie om (presentatie, briefing, investeerdersgesprek). Volledig handmatig.
- **`docs/TECHNICAL_HANDOVER.md`**: developer-overdracht. De AI-modelinventaris en package-versietabel worden automatisch op de 1e van elke maand bijgewerkt door `app/api/cron/update-handover/route.ts` (leest de modeltabel rechtstreeks uit dit CLAUDE.md-bestand). De rest van het document is NIET automatisch.
- **`docs/BUSINESS_HANDOVER.md`**: business/ops-overdracht. Alleen de "laatst bijgewerkt"-datum wordt automatisch aangeraakt; de inhoud zelf (kosten, accounttoegang, `[ARNO]`-secties) is Arno's eigen verantwoordelijkheid.

**PDF-versies:** de meeste `docs/*.md` hebben een `.pdf`-buur (voor NotebookLM, presentaties, delen). Na een inhoudelijke wijziging aan zo'n doc: `npm run docs:pdf` (rendert alleen de docs waarvan de inhoud is gewijzigd, o.b.v. sha256 in `docs/.pdf-render-state.json`, dus veilig om altijd te draaien), of `npm run docs:pdf -- docs/HET_BESTAND.md` voor één specifiek bestand, of `-- --force` voor alles. De nieuwe/gewijzigde `.pdf` én `.pdf-render-state.json` mee-committen. Script: `scripts/render-docs-pdf.mjs` (marked + puppeteer, merkstijl). Geen VS-Code-extensie meer nodig.

**Schrijfregel:** wanneer een sessie iets shipt dat de kernfunctionaliteit wijzigt, wordt `docs/ARNOBOT_OVERZICHT.md` in dezelfde commit bijgewerkt. Geen apart ritueel, net als de UI-stijlregel en de e-mailtyperegel: bij elke relevante sessie opnieuw toegepast.

**Reikwijdte (aangescherpt 2026-08-29):** de schrijfregel geldt bij **echt nieuwe of verdwenen functionaliteit** (nieuwe module, nieuwe rol-flow, prijswijziging, nieuwe AI-capability, een feature die weggehaald wordt) en bij een naamswijziging van een pagina/feature/label. In die gevallen: in dezelfde commit `docs/ARNOBOT_OVERZICHT.md` bijwerken, plus `docs/TECHNICAL_HANDOVER.md` als de wijziging een route/feature raakt die daar beschreven staat. Voor **kleine aanpassingen aan bestaande features** (toon van een AI-tekst, een drempelwaarde, een zichtbaarheidsregel, gedrag van een knop): geen aparte docs-edit verplicht, wel een duidelijk commitbericht. Het wekelijkse maandagvangnet vangt op wat daarvan tóch in de docs had gemoeten. Bij twijfel of iets "echt nieuw" is: kort bij Arno checken.

**Vaste regel bij het hernoemen van een pagina, feature of knop-label:** doe in dezelfde sessie een sitebrede tekstzoekopdracht op de oude naam, over UI-copy, `lib/email-templates.ts`, `lib/systemPrompt.ts`, `app/bot/qa/QAClient.tsx` én alle docs, niet alleen de plek waar de rename bedacht is. Bij elke rename opnieuw toegepast. (Achtergrond: de BIEB → Archief → ANALYSES-vondst, zie `docs/CLAUDE_HISTORY.md`.)

**Automatisch vangnet:** een wekelijkse cloud-routine (`trig_01CMpoZo9fPi6DBNpCnwADRw`, elke maandag 08:00) doorloopt alle `docs/*.md` (via Glob) plus `app/bot/qa/QAClient.tsx`, `lib/email-templates.ts` en `lib/systemPrompt.ts`, vergelijkt ze met de commits van de afgelopen 7 dagen, en opent bij drift één PR met concrete tekstvoorstellen ter beoordeling door Arno (nooit een blinde auto-commit). Checkt eerst met `gh pr list` of er al een open versheids-PR is en werkt die bij. Uitzonderingen die de routine nooit aanraakt: `docs/AUDIT_FINDINGS.md`, `docs/CLAUDE_HISTORY.md`, `docs/OPENSTAANDE_PUNTEN.md` (bewuste momentopname, wordt bij de kwartaalcheck gereconcilieerd), `CLAUDE.md` zelf, tekst binnen `[ARNO: ...]`, checklists die zeggen "alleen Arno kan dit invullen", en nieuwe prijsvoorstellen in `PRICING_DECISIONS.md` (alleen consistentiecheck). Documenten met een eigen statusblok alleen bij een harde tegenstrijdigheid. Bij twijfel: geen wijziging, wel een open vraag in de PR-body. Schone week: stil, geen PR. Dit vervangt de doorlopende schrijfregel niet, het is het vangnet. (Volledige geschiedenis incl. de teruggedraaide push-trigger: `docs/CLAUDE_HISTORY.md`.)

## Maandelijkse check — roep aan met "doe de maandcheck"

Voer onderstaande punten volledig uit. Rapporteer elk punt expliciet (OK / aandacht nodig / actie vereist).

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
- Check open Dependabot-PRs via een agent (`gh api`) die per PR het breaking-change-risico samenvat
- Een falende "Playwright E2E"-check op een Dependabot-PR is bekend en onschadelijk (GitHub geeft Dependabot-workflows geen secrets). TypeScript, Vitest, ESLint en npm audit zijn wél betekenisvol. Zie `docs/CLAUDE_HISTORY.md`.

### 3. AI-modelinventaris
- Zie de modelinventaris-tabel verderop. Dekt de Anthropic chat-modellen, Voyage AI embedding/rerank (RAG), en OpenAI spraak (transcriptie).
- Nieuwere of betere modellen beschikbaar bij Anthropic of Voyage AI? Beoordeel op kwaliteit eerst, dan pas kosten.
- **Vaste regel:** elke nieuwe externe AI/API-leverancier wordt in dezelfde commit toegevoegd aan deze check en aan de modelinventaris-tabel. Geen uitzondering. (Voyage AI, Sentry, Upstash en OpenAI zijn alle vier ooit toegevoegd zonder dat de check werd bijgewerkt.)
- **Verplichte verificatiestap:** verifieer dat de tabel nog klopt met de code. Zoek via de import-graph (elk bestand dat een AI-SDK importeert, en wat er precies wordt aangeroepen — niet alleen op `.messages.create(` grep'en, want dat mist `.messages.stream(`) en check `package.json` op AI-dependencies die nergens geïmporteerd worden.
- **Embedding-consistentiecheck:** voor elke kolom die een embedding-vector opslaat (nu `arnobot_blog_sessions.embedding`), steekproefsgewijs verifiëren dat alle rijen uit hetzelfde model komen (embed losse queries opnieuw met het huidige model, vergelijk cosine-similarity met de opgeslagen vector op exact dezelfde brontekst: dicht bij 1,0 = zelfde model). Achtergrond: het model-mix-incident in `docs/CLAUDE_HISTORY.md`.

### 4. Infrastructuur

**Werkregel:** een deprecation-melding in een dashboard of changelog = direct opnemen als actiepunt, niet uitstellen naar de volgende check.

#### Milestone: Pro-upgrades bij 50 actieve gebruikers
Zodra ArnoBot 50 actieve gebruikers bereikt (nu bewust uitgesteld):
- **Vercel Firewall** aanzetten
- **Supabase PITR** aanzetten ($100/maand extra bovenop Supabase Pro). Drempel bewust op 100 gebruikers (Arno's keuze), automatisch verwerkt in Abacus (`TARIEVEN.supabasePitrDrempel`). **Direct bij het aanzetten, in dezelfde actie:** een restore-test uitvoeren (recente backup terugzetten in een tijdelijk Supabase-project, tabellen/rijen/encoding checken, tijdelijk project verwijderen).
- **Clerk:** inactivity timeout inschakelen (zie hieronder) en session limits aanscherpen

#### Vercel
- Deprecated features in gebruik? Vercel dashboard → Settings → General op waarschuwingen
- [vercel.com/changelog](https://vercel.com/changelog) op breaking changes die arno.bot raken
- Build logs op deprecation warnings
- Nieuwe platform-limieten of planwijzigingen?

#### Supabase (project: wxrsmmzqbmoeackirsxc — arno.bot)
- Dashboard op banners/waarschuwingen (Supabase toont deprecated features in de UI)
- [supabase.com/changelog](https://supabase.com/changelog) op breaking changes
- Settings → API op deprecated key-formaten
- Schema-wijzigingen nodig voor nieuwe features?
- Database binnen limieten? (Pro: 8GB — Settings → Billing → Usage)
- **Openstaand:** PITR nog niet aangezet, zie de milestone hierboven.

#### Clerk (app: clerk.arno.bot)
- [clerk.com/changelog](https://clerk.com/changelog) op breaking changes in SDK of JWT-formaat
- Session duration correct ingesteld?
- Webhooks actief en zonder fouten? (Clerk dashboard → Webhooks → recent deliveries)
- Geen development-instance in productie?
- Nieuwe beveiligingsinstellingen beschikbaar (device fingerprinting, bot-detectie)?
- **Openstaand:** inactivity timeout inschakelen (Clerk dashboard → Sessions). Vereist een betaald plan, dus pas bij de milestone hierboven. Geen "log uit bij browser sluiten" bij Clerk, inactivity timeout is het dichtstbijzijnde.
- **Openstaand (deadline 18 januari 2027):** Clerk stopt met oude CBC-mode TLS-cipher suites op custom domains. Vermoedelijk geen actie nodig (moderne stack), maar bij de maandcheck vlak vóór de deadline bevestigen dat er geen legacy clients op Clerk aansluiten.
- **Openstaand:** `proxy.ts` gebruikt nog `createRouteMatcher()` (sinds `@clerk/nextjs` 7.5.14 gedeprecate t.g.v. `auth.protect()`, geen verwijderdatum). Migreren zodra dit is opgepakt.

#### Resend
- DKIM nog geldig? (Resend dashboard → Domains)
- Geen bounces of spam-klachten die aandacht vragen?
- [resend.com/changelog](https://resend.com/changelog) op API-wijzigingen
- Binnen de gratis verzendlimiet? (Resend dashboard → Usage)

#### VisualPing (monitoring van leverancierspagina's)
- Gratis tier: 65 checks/maand. Check bij groei van het aantal gemonitorde URL's of de limiet in zicht komt.

#### Calendly (boeking van het gesprek met Arno)
- Bij een leverancierswissel: checkt het nieuwe tool ook e-mailadres in het webhook-payload mee (nu de matchsleutel)? Callback-URL moet mét `www` (zie `docs/CLAUDE_HISTORY.md`).

#### Anthropic
- DPA gewijzigd? [anthropic.com/legal/dpa](https://www.anthropic.com/legal/data-processing-addendum) — let op de "effective date". Zo ja, privacypagina bijwerken.
- API-deprecaties aangekondigd? [docs.anthropic.com/changelog](https://docs.anthropic.com/en/release-notes/overview)
- Worden de huidige model-IDs nog ondersteund?
- **Harde deadline:** de huidige API-keys (arnobot + salescanvas-app) verlopen op 6 januari 2027, door Anthropic afgedwongen. Ruim van tevoren nieuwe keys aanmaken en uitrollen.
- **Watch-item:** Claude Haiku 4.5 heeft een voorlopige pensioendatum van niet eerder dan 15 oktober 2026. Geen harde aankondiging. Haiku 4.5 wordt breed gebruikt (o.a. `session-end`, RAG-queryherschrijving, `memoryEntities`), dus bij een officiële aankondiging tijdig een migratiepad zoeken.

#### Voyage AI (embedding + rerank, `lib/rag.ts`)
- [docs.voyageai.com/docs/pricing](https://docs.voyageai.com/docs/pricing) op nieuwere modelgeneraties en gratis tokentoelagen
- Zijn de huidige model-IDs nog de nieuwste generatie of inmiddels "legacy"?
- **Openstaand:** embedding-model (`voyage-3-large`) NIET losstaand upgraden. Breekt de kennisbank-zoekfunctie volledig (0 treffers, live geverifieerd): de hele kennisbank is met dit model vooraf ge-embed. Vereist eerst volledige her-embedding. Zelfde geldt voor `voyage-multilingual-2` (sessie-geheugen, inmiddels deprecated). Zie `docs/CLAUDE_HISTORY.md`.

#### Sentry (foutmonitoring + performance tracing)
- [Sentry release notes](https://docs.sentry.io/product/relay/release-notes/) of het `@sentry/nextjs`-changelog op breaking changes
- Komen er nog spans/errors binnen in het dashboard? (stille instrumentatiestoring is anders onzichtbaar)
- Quota/limiet binnen het plan?

#### Upstash (rate limiting)
- [upstash.com/blog](https://upstash.com/blog) of changelog op breaking changes
- Rate limit-drempels nog passend bij het huidige gebruikersaantal?
- Quota/limiet binnen het plan?

#### OpenAI (spraak: transcriptie, `app/api/transcribe/route.ts`)
- `whisper-1` voor spraak-naar-tekst, rauwe `fetch()`, geen SDK. OpenAI's rol is uitsluitend spraakherkenning (TTS is verwijderd).
- [platform.openai.com/docs/changelog](https://platform.openai.com/docs/changelog) op API-deprecaties voor `whisper-1`.

#### ElevenLabs (tekst-naar-spraak voor ArnoBot Voice)
- Publieke premium-gated feature (`voice_enabled=true` op `approved_users`). Model Flash v2.5 (`eleven_flash_v2_5`), streaming, rauwe `fetch()`, geen SDK. Gedeelde logica in `lib/voice.ts`. Verbruik gelogd in `arnobot_elevenlabs_usage`.
- De "Improve the models for everyone"-instelling staat uit (moest handmatig, stond standaard AAN).
- [elevenlabs.io/docs](https://elevenlabs.io/docs) op API-wijzigingen.

#### PostHog (anonieme bezoekersanalyse marketingpagina's)
- Draait naast de eigen `arnobot_pageviews`/`arnobot_cta_clicks`-tracking. Bewust géén autocapture, alleen expliciete `posthog.capture()`-calls op publieke componenten. Scope: publieke marketingpagina's (zelfde `UITGESLOTEN_PREFIXES` als `PageviewTracker.tsx`). Env var: alleen `NEXT_PUBLIC_POSTHOG_KEY`. Reverse proxy via `/site-relay`. `person_profiles: 'always'`.
- **Openstaand (Arno noemt dit "essentieel"):** uitbreiden naar ingelogde `/bot`-gebruikers, en een Data Warehouse-koppeling met Stripe/Supabase. Beide vereisen een eigen scope/privacy-beoordeling.
- [posthog.com/changelog](https://posthog.com/changelog) op API-wijzigingen.

#### Kostencalculator (Abacus, `/abacus`)
- `lib/kostenTarieven.ts` bevat harde standaardwaarden voor externe tarieven (Vercel Pro, Supabase Pro, Clerk Pro, ElevenLabs-tiers, Anthropic/Fable 5 per aanroep, Porkbun-domeinverlenging). Verdeeld over drie tabbladen, alle tarieven gecentraliseerd in dat bestand.
- Wordt bij de **kwartaalcheck** gecontroleerd tegen de live pricing-pagina's, niet bij de maandcheck (prijswijzigingen komen niet vaak genoeg voor).
- Sentry en Upstash staan hier bewust niet als hardcoded bedrag in (al instelbare velden in de calculator).

### 5. Werking van de app
- Loop de happy path na: inloggen, chat, sessie-einde, synthese, coaching, sparring
- Controleer of alle cron-jobs de afgelopen periode succesvol hebben gedraaid (Vercel logs)
- Onverwachte 500-fouten of time-outs in de logs?
- **Documentatie-versheid-backstop:** klopt `docs/ARNOBOT_OVERZICHT.md` nog met wat er de afgelopen maand daadwerkelijk is gebouwd/gewijzigd? Vergelijk met git log en statusblokken. Vangnet voor de doorlopende schrijfregel, geen vervanging.

### 6. AVG & beveiliging gebruikers
- Is `public/arnobot-beveiliging.pdf` (via `scripts/generate-security-pdf.mjs`, opnieuw draaien na elke wijziging) nog actueel? Check specifieke claims: de leverancierslijst (incl. Voyage AI, Sentry, Upstash, OpenAI), genoemde cijfers (npm audit-meldingen, rate-limit-drempels), rechten/termijnen.
- Nieuwe verwerkingen bijgekomen die niet in de privacypagina staan?
- Openstaande verwijderverzoeken of datavragen van gebruikers?

### 7. Beveiligingsheaders
- Test `arno.bot` op [securityheaders.com](https://securityheaders.com) — target grade A
- Test op [observatory.mozilla.org](https://observatory.mozilla.org)

---

## Kwartaalcheck — roep aan met "doe de kwartaalcheck"

De kwartaalcheck is een aparte, minder frequente laag bovenop de maandcheck. Voer eerst de volledige maandcheck uit (secties 1-7), voeg dan deze vier punten toe. Zelfde werkwijze: parallelle subagents per punt.

### 8. Kostencalculator-tarieven vs. live pricing
Controleer de hardcoded tarieven in `lib/kostenTarieven.ts` (Vercel Pro, Supabase Pro, Clerk Pro, ElevenLabs-tiers, Porkbun) tegen de actuele pricing-pagina's. Bij een wijziging: bijwerken in dezelfde commit als deze check.

### 9. UI-stijlconsistentie-sweep
Gebruik een agent om alle pagina's/componenten te grep'en op hardcoded kleuren, fonts of spacing die afwijken van de Vaste Normen-tabel en de admin-UI-stijlnorm. Periodieke vangnet-sweep, geen vervanging van de doorlopende regel om afwijkingen direct te signaleren.

### 10. Grondige AVG/DPA-documentatie-doorlichting
Dieper dan sectie 6. Lees `app/privacy/page.tsx`, de brontekst van `scripts/generate-security-pdf.mjs` en de DPA-concepten (`docs/dpa-draft-v0.6.md`, `docs/dpa-input.md`) volledig door. Kloppen genoemde cijfers (rate-limit-drempels, bewaartermijnen, npm audit-meldingen) nog met de code? Kloppen rechten/termijnen nog met de praktijk? Doorzoek de codebase op externe `fetch()`-calls/SDK-imports die geen "grote" leverancier lijken (Telegram, DocuSeal, Calendly zijn hier ooit gemist).

### 11. Terugblik op bewust uitgestelde besluiten
Doorzoek CLAUDE.md, `docs/CLAUDE_HISTORY.md` en `docs/OPENSTAANDE_PUNTEN.md` op "bewust uitgesteld", "openstaand actiepunt" en vergelijkbare markeringen. Voor elk: is de reden om uit te stellen nog geldig, of is de situatie (gebruikersaantal, schaal, tijd) veranderd? Rapporteer als lijst, laat Arno beslissen. Reconcilieer daarbij `docs/OPENSTAANDE_PUNTEN.md` tegen de werkelijkheid (afgeronde punten eruit) en verwijder het bestand als het niks unieks meer toevoegt boven de plandocumenten.

---

## Professionaliteitscheck — roep aan met "doe de professionaliteitscheck"

Een op elk moment oproepbare verificatie of de normen in dit bestand ("Rol — ALTIJD", "Schaal en kwaliteitsniveau — ALTIJD") in de praktijk worden nageleefd, niet alleen op papier staan. Eén sessie met volledige, live codebase-toegang. Loop onderstaande punten na, rapporteer per punt concreet (bestand, regel, wat er mis is).

1. **Rollijsten- en permissiegaten-consistentie:** zoek alle plekken waar een rol, plan of permissie-vlag (`ROL_OPTIONS`, `command_manager`, `isConfirmedTeambaas`, `plan`, e.d.) een keuze of gate bepaalt. Voor elke lijst: zijn er consumers die een deelverzameling zouden moeten zien, en is dat al zo geïmplementeerd?
2. **Halfafgemaakte implementaties:** routes/features die op de ene plek wel en de andere niet zijn doorgevoerd (nieuwe kolom die niet overal gelezen wordt, nieuwe flow die een oud pad laat bestaan, TODO/FIXME die een bewuste half-bouw markeert).
3. **Duplicatie van dezelfde logica op 2+ plekken** zonder gedeelde functie (dezelfde rolcontrole, berekening of validatie los geïmplementeerd op meerdere plekken).
4. **Schaal- en beveiligingssteekproef:** pak 2-3 recent gebouwde routes/features en toets ze expliciet tegen "Schaal en kwaliteitsniveau" (honderden gelijktijdige gebruikers, geen workaround-taal) en "Rol" (auth, input-validatie, data-exposure).
5. **Nieuwe onboarding-/toegangsflows sinds de vorige professionaliteitscheck:** is een nieuwe rol, plan of teamstructuur ook echt overal consistent doorgevoerd, niet alleen op de plek waar hij oorspronkelijk gebouwd is?

Geen automatisering: punt 1 en 3 vereisen semantisch oordeel, punt 4 en 5 vereisen live codebase-context van het moment van aanroepen.

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
- **Nooit aannemen dat automatisering niet interessant is** omdat de gebruiker solo werkt. ArnoBot is gebouwd op automatisering.
- **Geen paternalistische afwegingen** namens de gebruiker maken over wat "teveel overhead" zou zijn. Geef het eerlijke advies, laat de afweging aan de gebruiker.

*Proactief adviseren en opties vergelijken worden sinds juli 2026 elke beurt afgedwongen via de `UserPromptSubmit`-hook in `C:\Users\arno\.claude\settings.json` (GEDRAGSCHECK), niet via dit bestand.*

---

## Schaal en kwaliteitsniveau — ALTIJD

ArnoBot is gebouwd voor enterprise-gebruik en hoge volumes.

- **Volume**: ga altijd uit van honderden gelijktijdige gebruikers, niet van een handvol. Elke API-route, query en component moet dat aankunnen zonder aanpassingen achteraf.
- **Enterprise-kwaliteit**: alles moet direct inzetbaar zijn voor corporate klanten met hoge standaarden op betrouwbaarheid, beveiliging en professionele uitstraling. Geen workarounds, geen "dit werkt voor nu".
- **Schaalbaarheid by design**: bij elke nieuwe feature, vraag je af hoe dit werkt bij 10.000 gebruikers. Als het antwoord "niet goed" is, bouw je het meteen robuust.
- **Geen kleine oplossingen**: een eenvoudige oplossing is prima als die ook op schaal werkt. Een oplossing die later teruggebouwd moet worden is geen oplossing.

---

## Rol — ALTIJD

Gedraag je als een master developer, master security engineer én master software tester:
- Schrijf productie-waardig code: veilig, efficiënt, geen onnodige abstracties
- Kies altijd de meest robuuste oplossing, niet de snelste
- Bij dependency-updates: analyseer breaking changes voordat je iets uitvoert — voer nooit `--force` of major upgrades uit zonder risicoanalyse
- Bij nieuwe routes of API-aanpassingen: controleer altijd auth, input-validatie en data-exposure
- Als tester: denk als een aanvaller én als een onhandige gebruiker — test happy path, edge cases, auth-bypass, IDOR, input-extremen en business logic flaws

## Werkwijze bij meerdelige verzoeken — ALTIJD

Bij elk verzoek met meer dan één onderdeel:

1. **Schrijf de checklist eerst**, zichtbaar in de response, vóór enige wijziging (`[ ] onderdeel 1`, `[ ] onderdeel 2`, etc.)
2. **Loop de lijst na vóór de commit.** Elk onderdeel expliciet afgevinkt, niet impliciet aangenomen.
3. **Bij twijfel of iets in scope valt: vragen, niet zelf beslissen.**

Dit geldt ook als de verzoeken als losse zinnen in één bericht staan.

## Git
- Na elke commit direct pushen naar origin master: `git push origin master`
- Nooit alleen committen zonder te pushen — Vercel deployt alleen via GitHub

## UI-stijl — ALTIJD consistent toepassen

**Actief stijltoezicht**: signaleer afwijkingen van de Style Guide zodra je ze tegenkomt, ook buiten de scope van het huidige verzoek. Benoem het kort en vraag of je het direct mee-fixt.

**Regel**: elke keer dat een UI-norm wordt vastgesteld of gewijzigd, update je CLAUDE.md in dezelfde commit.

**Werkwijze**: bij elke nieuwe UI-component, controleer alle elementen direct tegen de vaste normen hieronder vóór commit. Bij twijfel over de juiste norm: vragen aan de gebruiker.

### Admin UI-stijl (`/bot/admin/**`) — afwijkend van de rest van de app

Referentiebestanden: `app/bot/admin/status/page.tsx` en `app/bot/admin/gebruikers/page.tsx`.

- **Font**: sans-serif (systeemfont), niet Space Mono/Courier. Bebas Neue alleen voor grote cijfers/gauges, niet voor H1/H2 of lopende tekst.
- **Body-tekst / tabel-data / datums / omschrijvingen**: 14px
- **Labels, kolomkoppen, status-badges, kleine knoppen** (vaak uppercase met letterSpacing): 12px
- **Geen 10px, 11px of 13px** in de admin-sectie, alles is 12 of 14
- **Gedempte tekst**: kleur `#6b7280` (niet via `opacity`, niet `#4b5563`, niet `#aaa`)
- **Amber accent/labels**: `#f59e0b`
- **H1**: sans-serif, fontWeight 700, fontSize 48px, letterSpacing -1px, kleur `#f1f5f9`
- **Witte tekst/koppen**: `#f1f5f9`

**Admin dashboard-pagina's** (data-overzichten zoals `/bot/admin/stats`, niet tabel-pagina's): referentie `app/bot/admin/stats/page.tsx` + `StatsTabs.tsx`.
- **Breed canvas**: `maxWidth` rond 1400px, geen 800px-kolom.
- **Eén universele tegel-component** voor alle content (statlijst, splitbar, ratiobalken, trend), niet losse ad-hoc boxen per widget-type.
- **Responsive grid van tegels** (`repeat(auto-fit, minmax(280px,1fr))`), tegels die meer ruimte nodig hebben nemen 2 kolommen via een `span`-prop.
- **Tabs per macro-onderwerp** als lichte client component die alleen zichtbaarheid toggelt (geen herfetch), met top-KPI's altijd zichtbaar boven de tabs. Data server-side opgehaald in de paginacomponent, client-tabs krijgen kant-en-klare content.
- **Relevantie boven volledigheid**: een sectie die (tijdelijk) niks zinnigs kan tonen wordt weggelaten tot er iets te tonen is, niet als kaart met waarschuwing.

### Conversiepagina's binnen /bot (bijv. /bot/doorgaan) — volgen de marketingstijl

Pagina's die inhoudelijk bij de marketing-/conversieflow horen (abonnement kiezen, upgraden), ook achter de login, gebruiken bewust de marketingstijl. Referentie: `app/bot/doorgaan/page.tsx`, naast `/prijzen` en `/`.

- **Font**: Figtree (body), Oswald (koppen/labels/knoppen, uppercase via CSS `text-transform`), zelfde Google Fonts-import als `/prijzen`
- **Kleuren**: `#f8fafc` (wit), `#94a3b8` (gedempt)
- **Primaire knop**: radius 6px, volle amber achtergrond, gloed-schaduw (`box-shadow: 0 12px 24px rgba(245,158,11,0.25)`), hover `scale(1.03-1.05)`
- **`BotNav` blijft ongewijzigd** (gedeeld component, sitebreed)
- **Bij twijfel of een nieuwe `/bot`-pagina onder deze uitzondering valt**: alleen als de pagina zelf een keuze/conversiemoment is. Bij twijfel: vragen aan Arno.

### PDF-documenten — merklettertypen ook in react-pdf verplicht

`@react-pdf/renderer` kan geen CSS @font-face lezen en valt zonder registratie stil terug op Helvetica. **Bij elk nieuw react-pdf-document**: importeer en roep `registerBrandFonts()` uit `lib/pdfFonts.ts` aan, gebruik nooit Helvetica/Helvetica-Bold. Grote titels/getallen → Bebas Neue, labels/body → Space Mono. TTF's staan in `public/fonts/`. Uitzondering: `app/bot/admin/ArnoBotPdfDocument.tsx` volgt bewust de sans-serif admin-stijlnorm. (`window.print()` op een gewone pagina leest de CSS van de pagina zelf, geen actie nodig.)

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

**Uitzondering op de markdown-regel:** de hoofdpersona-respons in `app/api/chat/route.ts` (`buildRdsSystemPrompt`/`buildWidgetSystemPrompt`) mag bewust `**vet**` gebruiken voor nadruk op een kernpunt. `SparClient.tsx` rendert dit via `renderContent()` naar echte HTML (`<strong>`). Geldt niet voor andere AI-output binnen dezelfde route (bijv. de moderatie-redirect bij OFFTOPIC/ONGEPAST) en niet voor andere routes. Bij twijfel: alleen als er een renderer is die `**tekst**`/`*tekst*` daadwerkelijk omzet naar opmaak.

**Als je zelf tekst schrijft of herschrijft:** vervang het streepje door een punt of komma, of herschrijf de zin. Laat het streepje nooit staan.

**Als de gebruiker zegt "haal eruit" of "verwijder":** verwijder alleen het streepje. Voeg niets terug, geen komma, geen punt, tenzij de gebruiker dat expliciet vraagt.

## Aanspreken met "jij/jou" — ALTIJD — nooit "u"

In alle AI-gegenereerde output wordt de gebruiker ALTIJD aangesproken met "jij" en "jou". Nooit "u". Ongeacht rang, functie of leeftijd van de gebruiker of de gespeelde persona.

**Dit geldt voor:** gesprekken, sparring-persona's, coaching, analyses, syntheses, uitdagingen, debrief, 1:1 agenda, Q&A-teksten, welkomstberichten, e-mails.

**Handhaving in sparring:** elke sparring-persona, hoe formeel ook (CEO, CFO, DGA), spreekt de gebruiker aan met "jij/jou".

**Handhaving in systeemprompts:** elke route die AI-output genereert MOET bevatten:
`Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u". Ongeacht hoe senior of formeel de persoon is die je speelt.`

---

## Tijdgebonden aanwijzingen — NOOIT — geldt voor alle AI-output

Schrijf NOOIT tijdgebonden aanwijzingen in AI-gegenereerde output: geen "doe dit vandaag", "bel morgen", "verzamel voor het weekend", "pak dit deze week op", of enige andere tijdsdruk.

**Dit geldt voor:** gesprekken, uitdagingen/acties, coaching, analyses, syntheses, spotlight, 1:1 agenda, thought of the day.

**Handhaving in systeemprompts:** elke route die een actie of aanbeveling genereert MOET bevatten:
`Schrijf de actie zonder tijdslimiet: geen "vandaag", "morgen", "deze week", "voor het weekend". Gewoon de actie zelf.`

**Reden:** gebruikers zijn volwassenen die zelf bepalen wanneer ze iets doen. Tijdsdruk vanuit de app past niet bij de toon van ArnoBot.

## AI-calls — altijd loading-state tonen

Elke fetch naar een AI-route moet een zichtbare loading-indicator hebben in het gesprek of in het relevante UI-blok, niet alleen een `...` op een knop. Gebruik de bestaande `.msg-loading` + `.loading-dots` + `.loading-text` structuur, of een equivalent. Geldt ook voor nieuwe routes buiten het hoofdgesprek (synthese, doorvraag, analyse).

## Client-side status-fetches — altijd een loaded-gate — ALTIJD

**Het patroon dat dit voorkomt:** een `useState` met een default/onbekende waarde (`false`/`null`, bv. `isTeamMember`, `isCommandManager`, `heeftTeamPlan`) die pas ná een async `fetch()` in een `useEffect` de echte waarde krijgt, terwijl de JSX daar al vanaf de eerste render conditioneel op rendert. Resultaat: de gebruiker ziet kort de verkeerde versie voordat de fetch klaar is.

**De fix, altijd hetzelfde patroon:** voeg een aparte `*Loaded`/`*Ready`-boolean toe (default `false`), gezet op `true` in **zowel** het succes- als het faalpad van de fetch (`.finally(() => setXLoaded(true))`, of expliciet in `.then()` én `.catch()`), en gebruik die vlag om de betreffende JSX pas te renderen zodra ze `true` is. Zonder de faalpad-afhandeling blijft de pagina bij een mislukte fetch voor altijd "laden" tonen.

**Bij elke nieuwe client-component die accountstatus/rol/plan ophaalt via een fetch in `useEffect`:** deze gate direct meebouwen. **Vangnet:** `scripts/check-missing-loaded-gate.mjs` (informatieve CI-stap). Bevestigde false positives → `KNOWN_SAFE_FETCHES` in het script.

## Beste resultaat vóór makkelijkste pad — ALTIJD

Bij het ontwerpen van een nieuwe feature of synthese: leid de scope niet af van wat er toevallig al gebouwd is of welke data al bestaat. Dat is de makkelijkste weg, niet automatisch de beste.

**Verplicht vóór elk voorstel voor nieuwe functionaliteit:**
1. Vraag eerst: wat zou dit daadwerkelijk goed maken, los van wat er nu al ligt?
2. Doorzoek relevante projectdocumenten in hun geheel (niet alleen de sectie waaraan gewerkt wordt) en het geheugen op gerelateerde, nog niet gebouwde plannen die het resultaat aantoonbaar sterker zouden maken.
3. Noem die vondsten expliciet in het voorstel, ook als het besluit is om ze nu niet mee te bouwen: "X zou dit sterk verbeteren, hier is waarom, hier is de afweging." Nooit stilzwijgend de kortste weg presenteren alsof het de enige optie is.

### Verplichte capability-sweep — zichtbaar, vóór enige scoping of privacy-afweging

Bij elk verzoek om nieuwe functionaliteit of een nieuwe tool/integratie: schrijf eerst, zichtbaar in de response en vóór je begint met scopen of een privacy-/risico-afweging, een capability-sweep met deze drie punten:

1. **Wat kan deze tool/aanpak volledig?** Alle relevante features, niet alleen wat het verzoek noemt. Voor een externe tool: check de actuele docs, niet je geheugen.
2. **Wat is de meest ambitieuze waardevolle versie**, los van wat er al gebouwd is of welke data al bestaat?
3. **Welke verworpen of nog niet gebouwde plannen** in docs/geheugen maken dit sterker?

Pas daarna scopen. De aanbeveling mag alsnog "niet alles bouwen" zijn, maar de maximale versie moet expliciet op tafel hebben gelegen. Reden: de "eerst voorstellen, wachten op akkoord"-poort gaat er stilzwijgend van uit dat het voorstel dat voor Arno ligt het beste is. Als de ambitieuze versie nooit getoond is, keurt hij een middelmatig plan goed zonder het te weten. (Aanleiding: de PostHog-uitbreiding van 2026-08-30, waar feature flags, surveys, groups en session recording pas na doorvragen boven tafel kwamen.)

**Verantwoorde uitsluiting bij het scopen:** na de sweep is de ambitieuze versie de basis van het voorstel. Elk onderdeel zit in de aanbeveling, tenzij het op een expliciete uitsluitingslijst staat met een reden van precies één van deze drie soorten:

1. harde externe blokker (bestaat nog niet, wacht op een ander besluit of systeem)
2. echt losstaande bouw met een eigen beslissing, niet "meer van hetzelfde" bovenop wat je toch al bouwt
3. echt nieuw privacy- of kostenoppervlak dat een eigen goedkeuring vereist

"Later", "lage marginale waarde", "geen kosten dus later", "voor nu overslaan" en soortgelijke zijn verboden als uitsluitingsgrond. Bij een zwakke of ontbrekende reden gaat het onderdeel mee. (Aanleiding: op 2026-08-30 werd `experiments` alsnog uit de PostHog-scope geknipt met "geen infra-kost, dus later", terwijl het op dezelfde flag-integratie zit die toch al gebouwd werd.)

## Nieuwe content of functionaliteit — altijd eerst voorstellen

Bij nieuwe tekst (Q&A, copy, labels) of nieuwe functionaliteit: eerst een voorstel tonen aan de gebruiker, wachten op akkoord, dan pas bouwen. Geen uitzondering.

Bij elke nieuwe pagina of component: lees eerst een bestaande pagina door en leg de stijl naast elkaar. Nooit afwijken zonder expliciete opdracht.
- **/bot-pagina's** (achter login): referentie is `app/bot/account/page.tsx`
- **Publieke pagina's** (geen login vereist): referentie is `app/privacy/page.tsx` — nooit de voorwaardenpagina als referentie

### Ná het bouwen: controleer het resultaat tegen het goedgekeurde ontwerp — ALTIJD

"Eerst voorstellen, wachten op akkoord" regelt het moment vóór het bouwen. Het moment ná het bouwen heeft een eigen controle nodig, met name bij **hergebruik van een bestaande component**. Een hergebruikte component brengt al zijn bestaande gedrag en elementen mee, ook wat het goedgekeurde ontwerp nooit toonde. Dat moet er expliciet uitgehaald worden.

**Verplichte stap direct na het bouwen, vóór je het als "klaar" rapporteert:** leg het resultaat naast het laatst goedgekeurde ontwerp, element voor element:
1. Staat er iets in het resultaat dat niet in het ontwerp stond? (meegekomen invoerveld, knop, sectie van de hergebruikte component)
2. Ontbreekt er iets dat het ontwerp wél toonde?

Bij een verschil: dat is een fout die vóór opleveren gecorrigeerd wordt, niet erna. (Aanleiding: `/bot/cgq`, zie `docs/CLAUDE_HISTORY.md`.)

### Vaste normen
- **Body tekst**: Space Mono, fontWeight 400, fontSize 15px, lineHeight 1.9, kleur #9ca3af
- **Labels (amber)**: Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f59e0b — geldt voor ALLE amber labels zonder uitzondering: inline, sectiekoppen, synthesetitels (SYNTHESE, TERUGBLIK, 1:1 AGENDA), configurator-labels, "BEGIN HET GESPREK", etc.
- **Subkoppen binnen AI-content** (bijv. KRACHT VAN HET TEAM, GROEIKANS in analyse-cards): Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f1f5f9 — wit, niet amber. Amber is voor UI-labels die content introduceren, niet voor hiërarchie binnen AI-gegenereerde tekst.
- **H1**: Bebas Neue, fontSize 64, letterSpacing 3, kleur #f1f5f9
- **H2**: Bebas Neue, fontSize 32, letterSpacing 2, kleur #f1f5f9
- **Primaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 36px', borderRadius 999, background #f59e0b, **color #111827**, hover #d97706. Gebruik wanneer het de enige of belangrijkste actie in een sectie is.
- **Secundaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 32px', borderRadius 999, border '1px solid #374151', color #9ca3af. Alleen als er al een primaire knop in dezelfde context staat.
- **Destructieve knop**: zelfde vorm als secundair maar border + color #cc2200. Voor onomkeerbare acties.
- **Input/textarea**: Space Mono 15px, fontWeight 400, padding 12px 16px, borderRadius 4, border 1.5px solid #374151, focus → border #f59e0b, placeholder kleur #4b5563
- **Gedempte tekst** (artikelnummers, voetnoten, meta): #6b7280 — nooit #4b5563 buiten placeholders gebruiken
- **Secundaire link** (VOORWAARDEN, PRIVACY, SPELREGELS etc.): Space Mono, fontSize 13px, letterSpacing 4, color #6b7280, textDecoration none. Niet amber.
- **Container**: maxWidth 812, padding 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px'
- **Style-tag**: altijd bovenaan met font-import, `* { box-sizing: border-box; margin: 0; padding: 0; }`, body met font-weight 400
- **Achtergrond**: #111827 pagina, #1f2937 voor cards/inputs
- **Amber scheidingslijn** (horizontale hero-divider): altijd `2px solid #f59e0b`, nooit dikker, en altijd **precies zo breed als de zichtbare hero-inhoud erboven, nooit paginabreedte**. Bij een enkel gecentreerd blok: de lijn op dezelfde `maxWidth` als dat blok. Bij een grid met meerdere blokken naast elkaar: de lijn als extra grid-item met `gridColumn: '1 / -1'`. Referentie voor het principe: de header-divider op `app/bot/team/TeamClient.tsx`. Geldt voor `border-bottom` op hero-secties (sparren, team, teamlid, coaching) en `border-top` op sectie-scheidingen (Q&A FAQ-blok).
- **Scheiding tussen secties ónder de hero** (dus niet de hero-divider zelf): geen amber, gewoon `1px solid #374151`, kolombreedte. Amber is gereserveerd voor de ene hero-divider bovenaan een pagina.

## Gespreksstijl (ArnoBot + Bieb) — REFERENTIE is SparClient.tsx, nooit zelf afwijken
- **JIJ-label**: Bebas Neue 18px, letterSpacing 3, kleur **#6b7280**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **ARNO-label**: Bebas Neue 18px, letterSpacing 3, kleur **#f59e0b**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **JIJ-tekst (vraag)**: Bebas Neue, fontSize clamp(18px,3vw,26px), lineHeight 1.5, kleur #f1f5f9, letterSpacing 0.5px
- **ARNO-tekst (antwoord)**: Space Mono, fontSize 15px, lineHeight 1.9, kleur #9ca3af, fontWeight 400
- **JIJ-rij achtergrond**: geen (transparant = paginakleur #111827)
- **ARNO-rij achtergrond**: #1f2937 (elevated card, AI-content)
- **Padding beide rijen**: gelijk, clamp(20px,3vw,32px) horizontaal en verticaal
- **Gap label↔tekst**: clamp(16px,3vw,40px)
- **Container breedte gesprek**: maxWidth 812px, margin 0 auto
- **Designregel**: AI-gegenereerde content = #1f2937 card. Gebruikersinput = transparant op #111827.

**Let op:** `SparClient.tsx` heeft een eigen, losse nav-implementatie, niet de gedeelde `AdminNav`/`BotNav`. Bij elke navigatiewijziging in de rest van de app expliciet ook `SparClient.tsx` nalopen en apart bijwerken.

## Model-inventaris — controleer elke maand

Elke route gebruikt een bewust gekozen model. Controleer elke maand (of na een nieuwe Anthropic release) of dit nog de juiste keuzes zijn.

**Beslissingsvolgorde:** kwaliteit staat altijd op de eerste plaats. Kosten worden genoemd en meegewogen maar bepalen het besluit niet. Een goedkoper model wordt alleen gekozen als de kwaliteit aantoonbaar gelijkwaardig is voor die specifieke taak.

De onderbouwing en geschiedenis per rij staan in `docs/CLAUDE_HISTORY.md` onder "modelinventaris, volledige onderbouwing per route".

| Route | Model | Reden (kort) | Laatste check |
|---|---|---|---|
| `app/api/chat/route.ts` (hoofdchat, streaming) | `claude-sonnet-4-6` | Sonnet 5 gaf leeg antwoord bij lange vragen. Retry-bij-leeg + max_tokens-buffer + Sentry-log bij afkapping. | 2026-08-18 |
| `app/api/chat/route.ts` (RAG-queryherschrijving/checks) | `claude-haiku-4-5-20251001` | Korte classificatie/herschrijfstappen met expliciete fallbacks. | 2026-07 |
| `app/api/bot/uitdaging/route.ts` | `claude-fable-5` | "Thought of the day", grammaticale kwaliteit vereist Fable. Getest tegen Opus 5, Fable gehandhaafd. Toon/drempel herzien 2026-08-29. | 2026-08-29 |
| `app/api/bot/session-end/route.ts` (synthese/feiten/uitdaging/classificatie) | `claude-haiku-4-5-20251001` | 4 parallelle batch-calls. Retry-bij-leeg per call; classificatie bewust zonder retry. | 2026-08-21 |
| `app/api/bot/coaching/route.ts` (precheck) | `claude-sonnet-5` | Alleen ja/nee-vraag, Fable overkill. | 2026-07 |
| `app/api/bot/team/zelfcoaching/route.ts` (SPE-synthese teambaas) | `claude-fable-5` | Belangrijkste synthese voor de teambaas, kosten geen factor. Refusal-check + retry vanaf v1. | 2026-08-22 |
| `app/api/bot/coaching/route.ts` (hoofdsynthese) | `claude-fable-5` | Hoogste kwaliteit voor de belangrijkste synthese. max_tokens 4000. Getest tegen Opus 5, Fable gehandhaafd. | 2026-08-01 |
| `app/api/bot/coaching/route.ts` (blog-synthese) | `claude-haiku-4-5-20251001` | Korte label per blog. | 2026-07 |
| `app/api/bot/coaching-analyse/route.ts` (Analyses-pagina) | `claude-sonnet-4-6` | Gemigreerd van Sonnet 5 (stil leeg antwoord). Retry + zichtbare foutmelding. | 2026-07 |
| `app/api/bot/team/spotlight/route.ts` (team spotlight) | `claude-sonnet-4-6` | Cruciale boodschap voor manager. Krijgt thema-geschiedenis + 21-dagen-signaal als context. | 2026-08-21 |
| `app/api/bot/team/1on1/route.ts` (1:1 agenda) | `claude-haiku-4-5-20251001` | Sonnet 5 kapte output af. Haiku geen thinking, sneller, volstaat voor gestructureerde agenda. | 2026-07 |
| `app/api/sparring/debrief/route.ts` | `claude-sonnet-4-6` | Stond op Sonnet 5, lege debrief bij lange transcripten. Retry + fallbacktekst. | 2026-07 |
| `app/api/sparring/chat/route.ts` (live sparring) | `claude-sonnet-4-6` | try/catch + Sentry, expliciete 502 i.p.v. nepantwoord. | 2026-07 |
| `app/api/sparring/open/route.ts` (opening sparring) | `claude-sonnet-4-6` | Zelfde bug/fix als sparring/chat. | 2026-07 |
| `app/api/cron/auto-analyse/route.ts` | `claude-sonnet-4-6` | Batch over max 20 gesprekken/gebruiker. Bij aanhoudend leeg: gebruiker overslaan. | 2026-07 |
| `app/api/admin/analyse-evaluaties/route.ts` | `claude-sonnet-4-6` | Interne evaluatie-analyse. Tijdgebonden instructie gecorrigeerd. | 2026-07 |
| `lib/rag.ts` (queryherschrijving RAG) | `claude-haiku-4-5-20251001` | 3 zoekzinnen per vraag, eenvoudige herschrijftaak. | 2026-07 |
| `lib/rag.ts` (embedding, kennisbank RAG) | `voyage-3-large` | Legacy. NIET losstaand upgraden: breekt de kennisbank (vooraf ge-embed). Vereist volledige her-embedding. | 2026-07 |
| `lib/rag.ts` (rerank, kennisbank RAG) | `rerank-2.5` | Geüpgraded van `rerank-2` (legacy), strikt beter, zelfde prijs. | 2026-07 |
| `lib/rag.ts` (`embedSessionText`, sessie-geheugen) | `voyage-multilingual-2` | Model-mix-bug gefixt 2026-08-12, alle schrijvers geconsolideerd. Deprecated, NIET losstaand upgraden. | 2026-08-12 |
| `app/api/bot/coaching-precheck/route.ts` | `claude-sonnet-4-6` | Losse ja/nee-check, expliciete fallback (`'nee'`). | 2026-07 |
| `app/api/bot/verfijn/route.ts` | `claude-sonnet-4-6` | Herschrijft een gebruikersvraag, fallback = originele vraag, max 2000 tekens. | 2026-07 |
| `app/api/bot/search-linkedin-profile/route.ts` | `claude-sonnet-4-6` (+ web_search) | Opzoektaak met expliciete "niet gevonden"-afhandeling. | 2026-07 |
| `app/api/bot/sessions/route.ts` | `claude-haiku-4-5-20251001` | Nog niet beoordeeld op leeg-antwoord-risico. | 2026-07 |
| `app/api/bot/sessions/search/route.ts` | `claude-haiku-4-5-20251001` | JSON-fallback (`[]`) bij parse-fout. | 2026-07 |
| `lib/memoryEntities.ts` (`extractAndStoreEntities`) | `claude-haiku-4-5-20251001` | Extraheert namen/bedrijven/thema's per sessie. JSON-fallback, faalt stil (laag risico). | 2026-08-12 |
| `app/api/cron/refresh-openers/route.ts` | `claude-sonnet-4-6` | Expliciete check op geldige JSON-structuur. | 2026-07 |
| `app/api/cron/rss-ingest/route.ts` | `claude-haiku-4-5-20251001` | Expliciete fallback-tekst. | 2026-07 |
| `app/api/cron/inactivity-nudge/route.ts` | `claude-haiku-4-5-20251001` | Valt terug op generieke e-mailtemplate bij fout. | 2026-07 |
| `app/api/cron/model-check/route.ts` (adviesgeneratie, e-mail only) | `claude-sonnet-4-6` (+ web_search) | Haalt de modeltabel live uit CLAUDE.md via GitHub API, echte web_search naar pricingpagina's. Faalt hard bij ophaalfout. | 2026-08-12 |
| `app/api/admin/feedback-analyse/route.ts` | `claude-haiku-4-5-20251001` | Nog geen expliciete leeg-check. | 2026-07 |
| `scripts/embed-chunks.mjs` (contextgeneratie per chunk) | `claude-haiku-4-5-20251001` | Offline script dat de kennisbank vult. try/catch-fallback. | 2026-07 |
| `scripts/translate-knowledge-base.mjs` | `claude-opus-5` | Enige Opus-gebruik. `tool_choice` forceert tool_use. Opus 5 kost gelijk aan 4.8, presteert beter. | 2026-07 |
| `app/api/admin/blogs-analyse/route.ts` | `claude-sonnet-4-6` | Redactionele briefing. Retry-bij-leeg + expliciete foutrespons. | 2026-07 |
| `app/api/admin/meta-analyse/route.ts` (zelfbeoordeling + expertpanel) | `claude-fable-5` | Geüpgraded van Sonnet 4.6 (2026-08-18), essentieel onderdeel, kosten geen factor. Refusal-check, hogere max_tokens, gesprekken schalen met periode. | 2026-08-18 |
| `app/api/admin/meta-analyse/route.ts` (jouw analyse) | `claude-fable-5` | Verwerkt Arno's eigen input puntsgewijs. Refusal-check + `jouwAnalyseFailed` na stille-faal-bug. | 2026-08-18 |
| `app/api/cron/meta-analyse/route.ts` (zelfbeoordeling + expertpanel) | `claude-fable-5` | Zelfde upgrade/reden. maxDuration 300s, gesprekken 12→25. | 2026-08-18 |
| `app/api/cron/meta-analyse/route.ts` (jouw analyse) | `claude-fable-5` | Zelfde derde sectie, nu ook in de maandelijkse mail. Refusal-check. | 2026-08-18 |
| `app/api/admin/test-email/route.ts` | `claude-haiku-4-5-20251001` | Admin-testtool, geen gebruikersgerichte output. | 2026-07 |
| `app/api/admin/analyse/route.ts` (briefing per gebruiker) | `claude-fable-5` | ANALYSE-tab in admin, vervangt Arno's handmatige uitzoekwerk. Refusal-check + retry + max_tokens-verdubbeling vanaf v1. | 2026-08-25 |
| `app/api/admin/analyse-chat/route.ts` (doorvragen op de briefing) | `claude-fable-5` | Zelfde databundel. Bewust niet opgeslagen. | 2026-08-25 |
| `app/api/transcribe/route.ts` | `whisper-1` (OpenAI, rauwe fetch) | Spraak-naar-tekst voor voice-input. | 2026-07 |
| `app/api/chat-voice/route.ts` (ArnoBot Voice, echte gebruikers) | `claude-sonnet-4-6` | Korte voice-systeeminstructie (`buildVoiceSystemPrompt`), niet-streamend. Eigen rate-limiter (30/uur). | 2026-07 |
| `app/api/tts-voice/route.ts` (ArnoBot Voice, echte gebruikers) | `eleven_flash_v2_5` (ElevenLabs, rauwe fetch) | Streaming TTS via `lib/voice.ts`. Verbruik gelogd. Eigen rate-limiter (60/uur). | 2026-07 |
| `app/api/admin/voice-test/chat/route.ts` (admin-only testfase) | `claude-sonnet-4-6` | Interne testroute, deelt `getVoiceAnswer()`. | 2026-07 |
| `app/api/admin/voice-test/tts/route.ts` (admin-only testfase) | `eleven_flash_v2_5` (ElevenLabs, rauwe fetch) | Interne testroute, deelt `fetchElevenLabsSpeech()`. | 2026-07 |

**Hoe te controleren**: vraag Claude Code "check de modelinventaris in CLAUDE.md — zijn er nieuwere of betere modellen beschikbaar bij Anthropic of Voyage AI?"

**Openstaand actiepunt:** hoofdchat staat op `claude-sonnet-4-6` omdat Sonnet 5 bij lange vragen in thinking mode gaat zonder text block. Hercheck of Anthropic dit heeft aangepast, of schakel extended thinking bewust in met `budget_tokens`. Test eerst op staging. **Niet rond de commerciële livegang, wacht minimaal een week na go-live** (livegang uitgesteld, check de actuele datum bij Arno). Sonnet 5 is inmiddels structureel goedkoper dan Sonnet 4.6. Details in `docs/CLAUDE_HISTORY.md`.

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

E-mails hebben een eigen stijlnorm die afwijkt van de web-UI. Nooit Courier New in e-mail. Nooit Bebas Neue voor de knop (laadt niet betrouwbaar in e-mailclients).

### Layout
- Achtergrond: `#111827`, max-width `560px`, padding `48px 40px 40px 40px`, `margin: 0 auto`
- Google Fonts @import voor Bebas Neue in `<style>` tag in `<head>`

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
- Geen Courier New

### Knop (CTA)
- Font: `Arial,-apple-system,sans-serif` — NIET Bebas Neue, NIET Arial Black
- 14px, font-weight 600, letter-spacing 0.5px
- Padding: `12px 24px`, border-radius `999px`
- Background `#f59e0b`, color `#111827`
- Knop valt op door kleur en vorm, niet door een display-font

### Opt-out footnote
- Font: Arial, 12px, kleur `#6b7280`, margin-top `48px`
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

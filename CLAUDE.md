# Claude Code — project instructies

## Maandelijkse check — roep aan met "doe de kwartaalcheck"

Voer onderstaande punten volledig en in volgorde uit. Rapporteer elk punt expliciet (OK / aandacht nodig / actie vereist).

### 1. Beveiliging
- `npm audit --production` — zijn er nieuwe high/critical kwetsbaarheden in runtime-code?
- Controleer of alle API-routes nog auth hebben (nieuwe routes kunnen dit missen)
- Check of error-responses nog geen interne details lekken
- Controleer `middleware.ts` op volledigheid van scanner-blokkering
- **Gedaan (juli 2026):** RLS ingeschakeld op alle gebruikerstabellen met Clerk JWT-integratie als defense-in-depth.

### 2. Dependencies & tooling
- Zijn er major versie-updates beschikbaar voor: Next.js, Clerk, Supabase client, Anthropic SDK, Voyage AI SDK, Sanity?
- Analyseer breaking changes vóór je iets aanbeveelt — nooit blind updaten
- Check of Dependabot-PRs openstaan op GitHub en beoordeel ze
- **Bekend en bewust geaccepteerd:** Dependabot-kwetsbaarheidsmeldingen over Sanity. Niet opnieuw aankaarten of als nieuw probleem behandelen, dit is al beoordeeld en geaccepteerd.

### 3. AI-modelinventaris
- Zie de modelinventaris-tabel verderop in dit bestand, deze dekt zowel de Anthropic chat-modellen als de Voyage AI embedding/rerank-modellen (RAG-pipeline)
- Zijn er nieuwere of betere modellen beschikbaar bij Anthropic of Voyage AI?
- Beoordeel altijd op kwaliteit eerst, dan pas op kosten — noem de prijs, maar laat die het besluit niet sturen
- **Vaste regel:** elke nieuwe externe AI/API-leverancier die aan arnobot wordt toegevoegd (nieuwe SDK, nieuw model, nieuwe derde partij) wordt in dezelfde commit toegevoegd aan deze check en aan de modelinventaris-tabel. Geen uitzondering. Reden: Voyage AI, Sentry en Upstash zijn alle drie ooit toegevoegd zonder dat de check werd bijgewerkt, en zijn daardoor tijdlang buiten beeld gebleven (Voyage AI liep op verouderde modellen zonder dat iemand het merkte).

### 4. Infrastructuur

**Werkregel:** een deprecation-melding in een dashboard of changelog = direct opnemen als actiepunt, niet uitstellen naar de volgende check. Commerciële tools veranderen zonder waarschuwing. Wacht niet tot iets toevallig ter sprake komt.

#### Milestone: Pro-upgrades bij 50 actieve gebruikers
Zodra ArnoBot 50 actieve gebruikers bereikt, de volgende betaalde upgrades doorvoeren (nu bewust uitgesteld, niet omdat het onbelangrijk is maar omdat het bij de huidige schaal nog niet in verhouding staat):
- **Vercel Firewall** aanzetten
- **Supabase PITR** (Point-In-Time Recovery, echte databasebackups) aanzetten, huidige gratis plan biedt dit niet
- **Clerk**: inactivity timeout inschakelen (zie hieronder bij Clerk) en session limits aanscherpen

#### Vercel
- Zijn er deprecated features in gebruik? Controleer Vercel dashboard → Settings → General op waarschuwingen
- Controleer [vercel.com/changelog](https://vercel.com/changelog) op breaking changes die arno.bot raken
- Check build logs op deprecation warnings (`next build` output in Vercel)
- Zijn er nieuwe platform-limieten of wijzigingen in het huidige plan?

#### Supabase (project: wxrsmmzqbmoeackirsxc — arno.bot)
- Open het dashboard en scan op banners of waarschuwingen — Supabase toont deprecated features actief in de UI
- Controleer [supabase.com/changelog](https://supabase.com/changelog) op breaking changes
- Check Settings → API op deprecated key-formaten of migratiewaarschuwingen
- Zijn er schema-wijzigingen nodig voor nieuwe features?
- Database binnen limieten? (free: 500MB — check Settings → Billing → Usage)
- **Gedaan (juli 2026):** gemigreerd van legacy JWT-keys naar nieuwe publishable/secret keys (`sb_publishable_...` / `sb_secret_...`) in `.env.local` en Vercel. Legacy keys daarna uitgeschakeld in Supabase dashboard. Geen codewijzigingen nodig geweest.
- **Openstaand actiepunt:** geen echte databasebackups (PITR) op het huidige gratis plan. Zie "Milestone: Pro-upgrades bij 50 actieve gebruikers" hierboven.

#### Clerk (app: clerk.arno.bot)
- Controleer [clerk.com/changelog](https://clerk.com/changelog) op breaking changes in SDK of JWT-formaat
- Session duration correct ingesteld?
- Webhooks actief en zonder fouten? (Clerk dashboard → Webhooks → recent deliveries)
- Geen development-instance in productie?
- Zijn er nieuwe beveiligingsinstellingen beschikbaar (bijv. device fingerprinting, bot-detectie)?
- **Openstaand actiepunt:** inactivity timeout inschakelen (Clerk dashboard → Sessions). Vereist een betaald Clerk-plan voor productiegebruik, dus pas oppakken bij "Milestone: Pro-upgrades bij 50 actieve gebruikers" hierboven. Geen "log uit bij browser sluiten"-optie beschikbaar bij Clerk, inactivity timeout is het dichtstbijzijnde alternatief.
- **Openstaand actiepunt (deadline 18 januari 2027):** Clerk stopt op die datum met oude CBC-mode TLS-cipher suites op custom domains (Frontend API + Account Portal, dus ook `clerk.arno.bot`). Voor ArnoBot vermoedelijk geen actie nodig (moderne Vercel/Next.js-stack, reguliere browsers), maar bij de kwartaalcheck vlak vóór de deadline nog een keer bevestigen dat er geen legacy clients (oude mobiele app, custom HTTP-integratie) op Clerk aansluiten.

#### Resend
- DKIM nog geldig? (Resend dashboard → Domains)
- Geen bounces of spam-klachten die aandacht vragen?
- Controleer [resend.com/changelog](https://resend.com/changelog) op API-wijzigingen

#### Anthropic
- Controleer of de DPA is gewijzigd: [anthropic.com/legal/dpa](https://www.anthropic.com/legal/data-processing-addendum) — let op de "effective date". Als die is veranderd, privacypagina bijwerken.
- Zijn er API-deprecaties aangekondigd? Controleer [docs.anthropic.com/changelog](https://docs.anthropic.com/en/release-notes/overview)
- Worden de huidige model-IDs in de inventaris nog ondersteund? (Anthropic depreceert modellen met aankondiging)
- **Harde deadline:** de huidige API-keys (arnobot + salescanvas-app) verlopen op 6 januari 2027, door Anthropic afgedwongen, geen eigen beleid. Ruim van tevoren nieuwe keys aanmaken en uitrollen, niet pas rond de deadline zelf.

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

### 5. Werking van de app
- Loop de happy path na: inloggen, chat, sessie-einde, synthese, coaching, sparring
- Controleer of alle cron-jobs de afgelopen periode succesvol hebben gedraaid (Vercel logs)
- Zijn er onverwachte 500-fouten of time-outs in de logs?

### 6. AVG & beveiliging gebruikers
- Is het beveiligingsdocument voor gebruikers (`public/arnobot-beveiliging.pdf`, gegenereerd via `scripts/generate-security-pdf.mjs`, dat script opnieuw draaien na elke wijziging) nog actueel? Check niet alleen of het bestand recent is, maar of specifieke claims er nog kloppen: de leverancierslijst (incl. Voyage AI, Sentry, Upstash), genoemde cijfers (bijv. aantal npm audit-meldingen, rate-limit-drempels) en rechten/termijnen.
- Zijn er nieuwe verwerkingen bijgekomen die niet in de privacypagina staan?
- Zijn er openstaande verwijderverzoeken of datavragen van gebruikers?

### 7. Beveiligingsheaders
- Test `arno.bot` op [securityheaders.com](https://securityheaders.com) — target grade A
- Test op [observatory.mozilla.org](https://observatory.mozilla.org)

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
- **Amber scheidingslijn** (horizontale hero-divider): altijd `2px solid #f59e0b` — nooit dikker. Geldt voor `border-bottom` op hero-secties (sparren, team, teamlid) en `border-top` op sectie-scheidingen (Q&A FAQ-blok).

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

## Model-inventaris — controleer elk kwartaal

Elke route gebruikt een bewust gekozen model. Controleer elke maand (of na een nieuwe Anthropic release) of dit nog de juiste keuzes zijn.

**Beslissingsvolgorde:** kwaliteit staat altijd op de eerste plaats. Kosten worden genoemd en meegewogen, maar bepalen het besluit niet. Een goedkoper model wordt alleen gekozen als de kwaliteit aantoonbaar gelijkwaardig is voor die specifieke taak.

| Route | Model | Reden | Laatste check |
|---|---|---|---|
| `app/api/chat/route.ts` (hoofdchat) | `claude-sonnet-4-6` | Sonnet 5 teruggedraaid: bij lange/complexe vragen geen text block in response (thinking mode zonder output). Hercheck zodra stabiel gedrag bevestigd. | 2026-07 |
| `app/api/chat/route.ts` (RAG-queryherschrijving/checks) | `claude-haiku-4-5-20251001` | Korte classificatie/herschrijfstappen binnen de hoofdchat, met expliciete fallbacks. | 2026-07 |
| `app/api/bot/uitdaging/route.ts` | `claude-fable-5` | Grammaticale kwaliteit en voortgangsherkenning vereisen Fable. max_tokens 600 (thinking telt mee). Prompt uitgebreid met taalcontrole en progressie-instructie. | 2026-07 |
| `app/api/bot/session-end/route.ts` (synthese) | `claude-haiku-4-5-20251001` | Drie snelle batch-calls per sessie, kwaliteit voldoende | 2026-07 |
| `app/api/bot/coaching/route.ts` (precheck) | `claude-sonnet-5` | Alleen ja/nee-vraag, Fable 5 overkill | 2026-07 |
| `app/api/bot/coaching/route.ts` (hoofdsynthese) | `claude-fable-5` | Hoogste kwaliteit voor de belangrijkste synthese. max_tokens 4000 (was 1600): thinking telt mee in het token budget, 1600 was te krap. Refusal check toegevoegd. getText() handelt thinking-blocks correct af. | 2026-07 |
| `app/api/bot/coaching/route.ts` (blog-synthese) | `claude-haiku-4-5-20251001` | Korte label per blog, Haiku volstaat | 2026-07 |
| `app/api/bot/coaching-analyse/route.ts` (BIEB-analyse) | `claude-sonnet-4-6` | Gemigreerd van Sonnet 5 (2026-07-audit): kon bij langere prompts stil een leeg antwoord teruggeven dat direct als analyse werd opgeslagen. Nu retry-bij-leeg-antwoord, en bij aanhoudend leeg antwoord een zichtbare foutmelding i.p.v. een lege analyse. | 2026-07 |
| `app/api/bot/team/spotlight/route.ts` (team spotlight) | `claude-sonnet-4-6` | Zelfde migratie/reden als coaching-analyse hierboven. Cruciale boodschap voor manager, mag niet stil leeg blijven. | 2026-07 |
| `app/api/bot/team/1on1/route.ts` (1:1 agenda) | `claude-haiku-4-5-20251001` | Sonnet 5 teruggedraaid: thinking-mode kapt output af midden in een zin (zelfde probleem als hoofdchat). Haiku doet geen thinking, is 5-10x sneller en volstaat voor gestructureerde agenda op basis van aangeleverde data. | 2026-07 |
| `app/api/sparring/debrief/route.ts` | `claude-sonnet-4-6` | **Bevestigde bug (2026-07):** stond nog op Sonnet 5, gaf bij lange sparring-transcripten (24-28 berichten) een lege debrief terug die stil werd opgeslagen (live geconstateerd: een testgebruiker had 2 sparsessies met een lege debrief, waardoor ArnoBot niet wist dat er gesparred was). Ontbrak eerder in deze tabel. Nu retry-bij-leeg-antwoord plus een zichtbare fallbacktekst i.p.v. een lege debrief. | 2026-07 |
| `app/api/sparring/chat/route.ts` (live sparring-gesprek) | `claude-sonnet-4-6` | Zelfde sessie/oorzaak als sparring/debrief hierboven, ontbrak eveneens in deze tabel. Antwoord gaat live naar de gebruiker, nu met retry en een neutrale fallbackzin i.p.v. een leeg antwoord. | 2026-07 |
| `app/api/cron/auto-analyse/route.ts` | `claude-sonnet-4-6` | Batchanalyse over max 20 gesprekken per gebruiker, zelfde risico als coaching-analyse. Ontbrak eerder in deze tabel. Bij aanhoudend leeg antwoord wordt die gebruiker overgeslagen i.p.v. een lege analyse op te slaan en een foutieve "bijgewerkt"-mail te versturen. | 2026-07 |
| `app/api/admin/analyse-evaluaties/route.ts` | `claude-sonnet-4-6` | Interne evaluatie-analyse, ontbrak eerder in deze tabel. Bevatte ook een tijdgebonden instructie in de prompt ("wat je morgen moet aanpakken"), losstaand gecorrigeerd naar tijdsneutrale taal. | 2026-07 |
| `lib/rag.ts` (queryherschrijving RAG) | `claude-haiku-4-5-20251001` | Genereert 3 zoekzinnen per vraag (multi-query expansion), eenvoudige herschrijftaak, Haiku volstaat | 2026-07 |
| `lib/rag.ts` (embedding, kennisbank RAG) | `voyage-3-large` | Legacy model, geen gratis toelage. Upgrade naar `voyage-4-large` bewust NIET losstaand gedaan: breekt de kennisbank-zoekfunctie volledig (0 treffers, live geverifieerd), want de hele kennisbank is met dit model vooraf ge-embed. Vereist eerst volledige her-embedding, zie openstaand actiepunt hierboven. | 2026-07 |
| `lib/rag.ts` (rerank, kennisbank RAG) | `rerank-2.5` | Geüpgraded van `rerank-2` (legacy): door Voyage zelf bevestigd als strikt beter op kwaliteit, contextlengte, latency en throughput, zelfde prijs | 2026-07 |
| `lib/rag.ts` (`getMultilingualEmbedding`, sessie-geheugen) | `voyage-multilingual-2` | Nog niet gecheckt op een nieuwere generatie, apart van de kennisbank-RAG hierboven. Los actiepunt. | nog niet gecheckt |
| `app/api/bot/coaching-precheck/route.ts` | `claude-sonnet-5` | Losse ja/nee-check, expliciete fallback (`'nee'`), laag risico door korte prompt. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/bot/verfijn/route.ts` | `claude-sonnet-5` | Herschrijft een gebruikersvraag, expliciete fallback (de originele vraag), input gemaximeerd op 2000 tekens. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/bot/search-linkedin-profile/route.ts` | `claude-sonnet-5` (+ web_search tool) | Losse opzoektaak met expliciete "niet gevonden"-afhandeling. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/bot/sessions/route.ts` | `claude-haiku-4-5-20251001` | Ontbrak eerder in deze tabel, nog niet beoordeeld op leeg-antwoord-risico. | 2026-07 |
| `app/api/bot/sessions/search/route.ts` | `claude-haiku-4-5-20251001` | JSON-fallback (`[]`) bij parse-fout aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/canvas/alignment/route.ts` (samenvatting) | `claude-sonnet-5` | Los Canvas-onderdeel, kort prompt, nog geen expliciete leeg-check. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/canvas/alignment/route.ts` (vraaganalyse) | `claude-sonnet-5` | JSON-fallback bij parse-fout aanwezig, laag risico. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/canvas/alignment-chat/route.ts` | `claude-sonnet-5` | Fallback-tekst (`'Geen antwoord.'`) aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/arnobot/route.ts` (feedback-modus) | `claude-sonnet-5` | Kort prompt, nog geen expliciete leeg-check. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/arnobot/route.ts` (score-modus) | `claude-sonnet-5` | JSON.parse in try/catch vangt een leeg antwoord impliciet op. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/refresh-openers/route.ts` | `claude-sonnet-5` | Expliciete check op geldige JSON-structuur aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/rss-ingest/route.ts` | `claude-haiku-4-5-20251001` | Expliciete fallback-tekst aanwezig. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/inactivity-nudge/route.ts` | `claude-haiku-4-5-20251001` | Valt terug op generieke e-mailtemplate bij een fout, nog niet expliciet bij een leeg (maar niet-foutend) antwoord. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/model-check/route.ts` | `claude-haiku-4-5-20251001` | De modelcheck-cron zelf. Bevatte een eigen, verouderde kopie van deze inventaris die afweek van zowel de code als CLAUDE.md (zie openstaand actiepunt). | 2026-07 |
| `app/api/admin/feedback-analyse/route.ts` | `claude-haiku-4-5-20251001` | Nog geen expliciete leeg-check. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/admin/blogs-analyse/route.ts` | `claude-sonnet-4-6` | Al op een stabiel model. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/admin/meta-analyse/route.ts` | `claude-sonnet-4-6` | Al op een stabiel model. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/cron/meta-analyse/route.ts` | `claude-sonnet-4-6` | Al op een stabiel model. Ontbrak eerder in deze tabel. | 2026-07 |
| `app/api/admin/test-email/route.ts` | `claude-haiku-4-5-20251001` | Admin-testtool, geen gebruikersgerichte output. Ontbrak eerder in deze tabel. | 2026-07 |

**Hoe te controleren**: vraag Claude Code "check de modelinventaris in CLAUDE.md — zijn er nieuwere of betere modellen beschikbaar bij Anthropic of Voyage AI?"

**Openstaand actiepunt:** hoofdchat staat op `claude-sonnet-4-6` omdat Sonnet 5 bij lange vragen in thinking mode gaat zonder text block te produceren. Hercheck of Anthropic dit gedrag heeft aangepast, of schakel extended thinking bewust in met `budget_tokens` zodat Sonnet 5 altijd ook een text block produceert. Test eerst op staging voordat je terugzet naar Sonnet 5. **Niet uitvoeren op of rond 1 augustus (livegang) — wacht minimaal een week na go-live.**

**Openstaand actiepunt (2026-07-audit):** `app/api/cron/model-check/route.ts` bevat een eigen, hardgecodeerde `INVENTORY`-kopie die los staat van deze tabel en er inmiddels van afwijkt (bijv. `bot/uitdaging` stond daar nog als `claude-sonnet-5` i.p.v. `claude-fable-5`). Die kopie moet gelijkgetrokken worden met deze tabel, of vervangen worden door een verwijzing naar één bron, om toekomstige drift tussen beide te voorkomen.

**Openstaand actiepunt (2026-07-audit):** de routes hierboven zonder expliciete leeg-antwoord-bescherming (`canvas/alignment*`, `arnobot/route.ts`, `cron/refresh-openers`, `bot/sessions*`, `admin/feedback-analyse`, e.a.) zijn bewust NIET meegenomen in deze fixronde: lager risico door kortere prompts of al aanwezige gedeeltelijke bescherming (JSON-fallbacks, try/catch). Bij een volgende kwartaalcheck opnieuw beoordelen of dit nog steeds volstaat, vooral als een van deze prompts qua lengte/complexiteit groeit.

**Openstaand actiepunt (2026-07-audit):** `app/api/canvas/alignment-chat/alignment-chat-route.ts` is dode code (bevat een eigen Anthropic-aanroep maar volgt niet de Next.js route-conventie, wordt nergens aangeroepen). Opschonen of verwijderen bij gelegenheid, geen risico maar verwarrend bij toekomstige audits.

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

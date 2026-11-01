# Audit Findings

Dit bestand bevat automatisch gegenereerde bevindingen van een periodieke architectuur-consistentie-audit (statische codeanalyse, geen live database-toegang). Elke sectie moet door een mens beoordeeld worden: de bevindingen zijn feitelijke constateringen, geen bevestigde zekerheden, en geen van de genoemde punten is automatisch gefixt.

## 2026-11-01

Uitgevoerde checks: wees-routes, gedeelde-databron-risico, modelinventaris-drift (CLAUDE.md vs. code), RPC-aannames. Wees-routes (`scripts/check-orphan-routes.mjs`) en modelinventaris leverden geen nieuwe bevindingen op: geen nieuwe kandidaat-wees-routes, en geen afwijking tussen de "Model-inventaris"-tabel in CLAUDE.md en de daadwerkelijk aangeroepen modellen in de code.

### 1. Gedeelde-databron-risico: `arnobot_blog_sessions.summary`/`.feiten` hebben twee onafhankelijke, niet-gedeelde schrijfpaden

- **Schrijver A:** `app/api/bot/session-end/route.ts` (reguliere sessie-afsluiting). Feiten-prompt: "Maximaal 8 korte bullets, elk op een nieuwe regel als losse zin", inclusief een `"Plan: "`-prefixconventie voor jaarplan/salesplan-feiten, en `RULE_NO_DASH`, `RULE_ENGLISH_TERMS`, `RULE_NO_CRUDE_LANGUAGE`, `RULE_NEVER_BREAK_CHARACTER`, `BRONDATA_REGEL` in de system-prompt.
- **Schrijver B:** `app/api/bot/sessions/route.ts` (GET-handler, regel 59-95: repareert "wees-sessies" die in `arnobot_rds_logs` staan maar nog niet in `arnobot_blog_sessions`). Eigen, losse prompt (regel 69-74): `"Extraheer alleen concrete, feitelijke informatie. Maximaal 8 korte bullets. Begin elk punt met een asterisk *."` Geen `"Plan: "`-conventie, en geen `RULE_NO_DASH`/`RULE_ENGLISH_TERMS`/`RULE_NO_CRUDE_LANGUAGE`/`BRONDATA_REGEL` in deze specifieke feiten-call (de summary-call in hetzelfde bestand heeft wel `RULE_JIJ_JOU` + `RULE_NO_DASH`, de feiten-call niet). Geverifieerd door zelf de bestanden te lezen, niet alleen op het woord van de subagent die dit vond.

Geen gedeelde helper-functie (zoals `embedSessionText`, `labelGesprek` of `herkenMailVerzoek` dat wel zijn voor andere velden) legt deze twee prompts samen.

Concreet risico:
- `lib/analyseContext.ts` (`planHistorieBlok`) parset de `feiten`-kolom sitebreed op regels die beginnen met `"Plan:"` voor de PLANHISTORIE-context in analyses/coaching. Sessies die via het wees-sessiepad zijn aangemaakt, kunnen dat label nooit bevatten: planfeiten uit die sessies worden stilzwijgend nooit meegenomen in analyses/coaching.
- De feiten-call in `sessions/route.ts` mist de harde CLAUDE.md-regel "nooit een streepje als leesteken" (`RULE_NO_DASH`) in zijn system-prompt, in tegenstelling tot vrijwel elke andere AI-output-route in de codebase.

Niet gecontroleerd: hoe vaak dit wees-sessiepad in de praktijk daadwerkelijk wordt geraakt (dat is live gedrag, niet statisch af te leiden).

### 2. Gedeelde-databron-risico (lagere ernst): embedding-model-aanroep opnieuw los geïmplementeerd in twee scripts

`scripts/reembed-sessions.mjs` en `scripts/seed-demo-okt.mjs` roepen `voyage-multilingual-2` rechtstreeks aan via een eigen embed-functie, in plaats van de gedeelde `embedSessionText()` uit `lib/rag.ts` te gebruiken (die vanuit een los `.mjs`-script niet 1-op-1 herbruikbaar is). Beide bevatten commentaar dat bewust verwijst naar "zelfde model als lib/rag.ts", dus de kennis is aanwezig, maar het blijft een handmatige duplicatie zonder afdwinging: een toekomstige modelwijziging in `embedSessionText` wordt hier niet automatisch meegenomen. `reembed-sessions.mjs` schrijft direct naar productiedata. De productie-schrijfpaden zelf (`session-end/route.ts`, de wees-sessiereparatie in `sessions/route.ts`, `backfill-embeddings/route.ts`) gaan terecht allemaal via `embedSessionText`, dat is in orde.

Overige onderzochte tabellen met 2+ schrijvers (`arnobot_coaching`/`_scores`/`_history`, `approved_users`, `arnobot_analyses`, `arnobot_memory_entities`, `groeibalans_*`) hebben in productiecode telkens precies één AI/berekeningsschrijver; de overige writes zijn ofwel losstaande kolommen, ofwel seed/testscripts met triviale of geïsoleerde logica.

### 3. RPC-aanname: tegenstrijdige documentatie over `match_sessions` en `deleted_at`

- `lib/geheugenContext.ts` regel 82-84 (commentaar bij de `match_sessions`-aanroep): *"match_sessions filtert niet op deleted_at (bevestigd 2026-08-12, zie geheugen), dus hier alsnog uitsluiten"* — de code filtert daarom zelf nogmaals op `deleted_at`.
- `docs/VOYAGE_REEMBED_PLAN.md` regel 62-63 documenteert echter, op basis van een live Supabase-check van 2026-09-02, dat de functie-definitie wél filtert: `user_id = match_user_id AND embedding is not null AND deleted_at is null`, en noemt dit zelf als "zijvondst": *"match_sessions filtert dus wél op deleted_at, terwijl de comment in app/api/chat/route.ts (rond regel 225) beweert van niet en er daarom nog een keer overheen filtert. De app-filter is nu redundant maar onschadelijk. Buiten scope van deze migratie; los noteren voor Arno."*

Dit is dus al eerder binnen de repo zelf gevonden en als "los noteren voor Arno" gemarkeerd, maar dat noteren is voor zover te zien nooit ergens anders terechtgekomen dan in dat ene plandocument. Geen SQL-migratiebestand van `match_sessions` staat in `docs/sql/`, dus de daadwerkelijke functiedefinitie is vanuit deze sessie niet opnieuw te verifiëren; de twee documentatiebronnen in de repo spreken elkaar op dit punt tegen. Praktisch risico is volgens de eigen notitie laag (de dubbele filter is redundant, niet schadelijk), maar de tegenstrijdigheid zelf is niet opgelost.

### 4. RPC-aanname: niet te verifiëren zonder live data

`match_blog_chunks_fulltext` (`lib/rag.ts` regel 164): er staat geen SQL-definitie of gedocumenteerde functiesignatuur in de repo. Een code-comment bij de aanroep stelt dat fulltext-zoeken vereist dat alle woorden voorkomen en vanaf ongeveer 13 woorden in de zoekvraag geen resultaten meer geeft. Deze aanname is vanuit deze sessie niet te verifiëren (geen database-toegang, geen migratiebestand gevonden). Status: te verifiëren met live data.

Ter vergelijking, wel bevestigd uit code in de repo: `match_blog_chunks` (gedocumenteerde signatuur in `docs/VOYAGE_REEMBED_PLAN.md`), `arnobot_blog_post_stats` (SQL in `docs/sql/2026-10-11-blog-populariteit.sql`), `sessies_zonder_actuele_synthese` (SQL in `docs/sql/2026-10-31-sessies-afsluiten.sql`).

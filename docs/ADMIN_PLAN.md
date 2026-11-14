# Admin opruimen en versterken

**Laatst bijgewerkt:** 2026-11-14

**Waar we staan:** alle drie de rondes zijn af. Het menu is van 14 naar 10 items teruggebracht (USERS, TEAMS, GESPREKKEN, ANALYSE, STATUS, META, MAILS, KENNISBANK, BLOG, STATS). De admin kapt geen cijfers meer af op 1000 rijen, dagen lopen op Amsterdamse tijd, geld- en toegangsknoppen schrijven in een logboek en vragen bevestiging, USERS heeft een belijst en betaalgeschiedenis, ANALYSE kent de coachinghistorie, Gesprekken toont het duimpje, en STATUS toont per cron of hij gezond is. Er staat geen geplande stap meer open, alleen losse punten (zie onderaan).

**Eerstvolgende stap:** geen. Na de eerste dagen draaien: kijken of STATUS de crons als gelukt toont, en beslissen of een Telegram-melding bij een te late cron nodig is.

## Voortgang

- [x] Audit alle tabs (USERS, TEAMS, GESPREKKEN, ANALYSE, META, STATUS, STATS, CRONS, TEMP, FEEDBACK, KENNISBANK, BLOGS, POSTS)
- [x] Tabs Analyses en Coaching op de Gesprekken-pagina, coachinghistorie volledig bewaard
- [x] Vier eerste fixes: exports zonder testaccounts, ontwikkelpunten niet meer `[object Object]`, cronoverzicht uit `vercel.json` met test, MRR uit `arnobot_subscriptions`
- [x] **Ronde 1 (A):** `lib/haalAlleRijen.ts`, `lib/nlTijd.ts`, `scripts/check-row-limit.mjs` (blokkerend in CI)
- [x] SQL ronde 2 gedraaid door Arno (`arnobot_admin_log`, `cron_runs`), RLS gemeten aan
- [x] **Ronde 2 (B):** logboek op BETAALD, terugbetalen, plan, teamrol, SD-agent, gratis toegang, aan/uit, Teams-instellingen; tweede klik bij BETAALD en bij GRATIS op een betalende gebruiker; waarschuwing bij terugbetalen na 14 dagen; Teams-formulier valideert vóór het opslaat en toont de reden
- [x] **Ronde 2 (C):** belijst in USERS, betaalgeschiedenis en abonnement in het BETALING-paneel, ANALYSE met coachinghistorie en "nieuwe gesprekken sinds deze analyse", duimpje en duimpje-filter in Gesprekken (en CSV), cron-gezondheid op STATUS en in het totaaloverzicht
- [x] Team telt mee in de MRR, STUUR TEST vraagt bevestiging bij crons die echt iets doen, tijden in Gesprekken, CSV en kopieertekst op Nederlandse tijd
- [x] **Ronde 3 (D):** TEMP weg (voice-test verwijderd, persona-knoppen naar USERS), FEEDBACK opgegaan in Gesprekken en STATS, BLOGS en POSTS samen als BLOG met twee tabs, CRONS heet MAILS, mobiele nav kreeg TEAMS erbij. De oude adressen /bot/admin/voice-test en /bot/admin/evaluaties sturen door.

## Besluiten en verworpen alternatieven

- **Gekozen:** alle queries die alle rijen van een groeitabel nodig hebben lopen via `haalAlleRijen` (blokken van 1000, vaste volgorde op `id`). **Verworpen: `.limit()` verhogen**, want de database kapt toch af op 1000 (gemeten 2026-11-14: `blog_chunks` heeft 1540 rijen, een select met `.limit(5000)` gaf er 1000). **Verworpen: nu SQL-aggregaten**, want de tabellen zijn klein (rds_logs 585 rijen); heroverwegen rond de 10.000 rijen.
- **Gekozen:** `scripts/check-row-limit.mjs` blokkeert in CI, anders dwingt het niets af. Bewuste bovengrenzen (`.limit(N)` met N ten hoogste 1000) en per-gebruiker-queries zijn toegestaan, andere legitieme gevallen komen met een reden in `KNOWN_SAFE`.
- **Gekozen:** dagen op Nederlandse tijd (`Europe/Amsterdam`, met zomer- en wintertijd), einde van een periode is het begin van de volgende dag (`.lt`). Ook de tijden die op de server worden opgemaakt (pagina, CSV, kopieertekst) lopen via `nlTijdTekst` en `nlDatumTekst`: `toLocaleTimeString` zonder tijdzone toonde UTC. **Verworpen: Lisboa**, want de mailtijden en alle bestaande communicatie staan al op Nederlandse tijd.
- **Gekozen:** de drie tabs Gesprekken, Analyses en Coaching met gedeeld filter op `/bot/admin`. **Verworpen: een aparte gebruikerspagina**, besluit van Arno 2026-11-13, niet heropenen.
- **ARNO.BLOG** is door Arno zelf verwijderd (commit `5327e10e`), dus niet meer meenemen in het opruimen.
- **MRR:** solo = alleen `active` abonnementen, zonder aangevraagde opzegging, exclusief btw, jaarlijks gedeeld door 12 (`lib/mrr.ts`). **Team telt mee** (besluit 2026-11-14): teams met een betaalde reguliere factuur die nu loopt, niet geblokkeerd, met dezelfde formule als de facturen (`lib/teamPricing.ts`: platformtarief plus seats maal prijs per seat, jaarlijks als maand-equivalent), seats is het actuele ledenaantal maar nooit onder het minimum, het demo-team nooit. De Elite-surplus en de naar-rato tussenfacturen tellen niet mee, dat is geen vaste maandwaarde. **Verworpen: Team weglaten tot er een echt team is**, want dan blijft de MRR bij het eerste echte team stil te laag.
- **Logboek:** een mislukte log blokkeert de actie nooit (een betaling of intrekking moet doorgaan), maar komt in Sentry. **Verworpen: de actie laten falen als de log faalt.**
- **Terugbetalen na 14 dagen:** een waarschuwing met een tweede bevestiging (`TOCH TERUGBETALEN`), geen blokkade, want terugbetalen na de bedenktijd kan bewust. **Verworpen: hard blokkeren.**
- **STUUR TEST:** een tweede klik bij de crons die echt iets doen (meta-analyse, model-check, update-handover). **Verworpen: een droge-run-optie per cron**, want die moet per route gebouwd worden terwijl het risico een per ongeluk gedraaide echte run is, en dat vangt een tweede klik af.
- **Cron-gezondheid:** elke cron registreert zich via `registreerCronRun` (`lib/cronRun.ts`), afgedwongen door `lib/cronOverzicht.test.ts`. "Te laat" is ruim twee tot drie keer het interval uit `vercel.json`, eenmalige crons hebben geen grens. **Nog niet gebouwd:** een Telegram-melding bij een te late cron (nu alleen zichtbaar op STATUS); alleen een mislukte run meldt al via `notifyCronFailure`.
- **Voice-test onder TEMP (besluit 2026-11-14):** weghalen in ronde 3. Gemeten: 4 testaanroepen ooit, de laatste op 12 augustus, terwijl de echte voice wel draait (laatste gebruik 8 november). De persona-knoppen horen bij USERS. Het gebruikers-ID `admin-voice-test` blijft in `kosten-tracking` uitgesloten zodat oude rijen niet meetellen.
- **`api/bot/uitdaging` niet aanpassen (besluit 2026-11-14):** dit is de gedachte van de dag, niet de actie-uitdaging na een gesprek. Het coachingprofiel (ontwikkelpunten) erin zetten riskeert de afgesproken toon (inspireren, nooit verhoor of kritiek, zie geheugen "passieve dagelijkse AI-prompt"), en de gedachte wordt al persoonlijk uit gesprekken en patroonanalyse. **Verworpen: ontwikkelpunten toevoegen.**

- **Menu (besluit 2026-11-14):** FEEDBACK weg, want het was een getal en een lijst: het getal staat nu op STATS, de negatieve antwoorden staan op Gesprekken (filter DUIMPJE, zonder datum zodat alle tijd zichtbaar is). **Verworpen: FEEDBACK als eigen tab houden**, want twee plekken voor dezelfde duimpjes. BLOGS en POSTS blijven twee pagina's maar zijn één menu-item met tabs (`BlogTabs`). **Verworpen: de blogideeën als knop in POSTS bouwen**, want dat is nieuwe functionaliteit terwijl er nog nooit een analyse is opgeslagen.

## Eindcontrole 2026-11-14 (na de vraag "is dit echt alles")

Alle bevindingen uit de audit en alle beloftes van deze sessie zijn naast de code gelegd. Wat daarbij nog open bleek is gebouwd:

- **Zoeken in gespreksinhoud** (ZOEK IN GESPREKKEN op Gesprekken, ook in CSV en PDF): was geadviseerd maar nooit gebouwd. De zoekterm wordt opgeschoond (`schoneZoekterm`), getest op de echte database en met een aanvalsterm.
- **TEAMS:** ledenaantal, seats waarop gefactureerd wordt, bedrag en dagen tot de volgende factuur per team (rood bij te laat, oranje onder 7 dagen), de facturenlijst per team in plaats van één globale grens van 50, en een BLOKKEER-knop met bevestiging (er was alleen DEBLOKKEER).
- **Cron-alarm** (`/api/cron/cron-wacht`, dagelijks): Telegram bij een cron die te laat is of is afgebroken, ook een cron die sinds de registratie nog nooit draaide. Een mislukte run meldt zichzelf al.
- **STATUS, PERFORMANCE:** de cirkel toonde de uptime van de week in een vaste groene kleur, naast gemiddelde en p95 in milliseconden (gemeten 668 ms en 1657 ms, de kleur zei dus niets over snelheid). Nu hangt de kleur aan een niveau uit `lib/performance.ts`: groen, geel/oranje bij **onder druk** (gemiddeld boven 1200 ms of p95 boven 2500 ms), rood bij **laag** (gemiddeld boven 2500 ms of p95 boven 4000 ms), grijs zonder meting. De grenzen liggen ruim boven de gemeten basis zodat een normale week groen blijft, en staan op één plek. Het getal in de cirkel vult alleen, de kleur hangt aan het niveau. Een mislukte statusfetch bij de externe diensten is grijs in plaats van rood.
- **Storingsmelding** (`/api/cron/storing-wacht`, elk kwartier, Telegram): arno.bot niet bereikbaar of verminderd (Instatus), te traag (gemiddelde van het laatste uur, minimaal 3 metingen, dezelfde grenzen als de kleur), en een **grote of kritieke** storing bij Anthropic, Vercel, Supabase, Clerk of Resend. Een kritieke melding komt hooguit één keer per dag terug, een waarschuwing één keer per week (`nieuwMelden`). **Verworpen: ook kleine incidenten (`minor`) melden**, want op het moment van bouwen stond Anthropic op `minor` (Partially Degraded Service) voor een onderdeel waar arno.bot waarschijnlijk niet van afhangt: dat zou ruis geven. Die staan wel op STATUS.
- **META:** een mislukte opslag in het archief wordt gelogd (Sentry), `days` wordt gevalideerd (1 tot 365).
- **Alle vier de AI-routes** (analyse, analyse-chat, blogs-analyse, feedback-analyse) vangen een API-fout nu af met een nette foutmelding.
- **KENNISBANK:** kennisdocumenten tellen niet meer mee als blog (nieuwe teller DOCUMENTEN).
- **USERS:** naam en foto uit Clerk in blokken van 100 in plaats van één aanroep per gebruiker; een fout wordt gelogd. Gemeten: 12 van 12 gelijk aan de oude manier.

**Bewust niet gewijzigd, met reden:**

- **Basis-URL uit de Host-header** (`test-email`, `trigger-rss-ingest`): het lijkt een risico voor het CRON_SECRET, maar je hebt een geldig admin-cookie nodig en dat gaat alleen naar jouw domein. De testroute doet dit bewust: een redirect tussen apex en www laat de Authorization-header vallen. Een vaste URL zou dat terugbrengen.
- **Kop REF € in USERS** toont het aantal geconverteerde referrals, geen euro's. Niet aangepast: geen ongevraagde copy-wijzigingen (geheugenregel). Voorstel: hernoem naar REF BETAALD.
- **ANALYSE genereert automatisch bij het openen** van een gebruiker zonder opgeslagen briefing. Laten staan: het is de bedoelde werking, kosten zijn een losse waarschuwing en geen reden om te schrappen.
- **Drie definities van actieve gebruiker** (STATS-hero telt gesprekken in 7 dagen, mijlpalen en capaciteitswacht tellen `is_active`): niet samengevoegd, want de mijlpalen zijn zo afgesproken.
- **BlogStats doet ongeveer 40 telqueries** per paginalading en MISLUKT telt alle bezorgingen ooit. Niet aangepast: het zijn goedkope head-queries op een pagina die je zelden opent, en een permanente waarschuwing bij een eerdere mislukte bezorging is niet onjuist.
- **META heeft een eigen duimpje-jurylid** dat overlapt met de duimpjes op Gesprekken en STATS: ontwerpkeuze van de meta-analyse, niet aangeraakt.

## Open vragen voor Arno

Geen. De eerdere vier vragen zijn beslist (zie hierboven).

## Bekend, niet door deze trajecten opgelost

- `scripts/check-missing-user-filter.mjs` meldt `lib/waarheidsRapport.ts:70`. Het is bedoeld gebruikersoverstijgend (steekproef), dus toevoegen aan `KNOWN_SAFE_QUERIES` of er een filter bij.
- Niet nagelopen agentbevindingen: STATUS-tegel "PERFORMANCE" toont uptime, BlogStats doet ongeveer 40 telqueries per paginalading, META heeft een eigen "gebruikers"-jurylid op duimpjes dat FEEDBACK overlapt.
- De PDF van Gesprekken (`ArnoBotPdfDocument`) rendert in de browser en toont dus de tijdzone van de bezoeker, niet vast Amsterdam.

# ArnoBot Voice — plan

Dit document legt de besluiten vast voor de nieuwe abonnementslaag "ArnoBot Voice" en de bijbehorende technische aanpak. Besluiten hieronder staan vast. Zie Status voor waar het traject nu staat, en Beantwoorde ontwerpvragen onderaan voor de ontwerpbeslissingen genomen na de eerste audit.

---

## Concept — nog NIET besloten, ter bespreking (2026-07-19, einde dag)

Arno's ruwe schets van een uitgebreider abonnementsmodel, hier vastgelegd zodat het niet verloren gaat, expliciet nog niet vastgesteld:

- 30 dagen gratis trial (bestaand).
- Tijdens trial: beperkte voice-toegang (~100 gesproken antwoorden, tekst onbeperkt). Bij plafond: upgrademelding naar een betaald abonnement. **Dit deel is al gebouwd** (zie hieronder, `hasVoiceAccess()`/`TRIAL_VOICE_CHAR_CAP`), sluit goed aan.
- Eén in te plannen gesprek met Arno zelf, **voor iedereen** (verduidelijkt): trial-gebruikers moeten het binnen hun 30 dagen inplannen, betaalde gebruikers kunnen het gebruiken wanneer ze willen, geen tijdslimiet. Nog niet uitgewerkt: planningsmechanisme (koppeling met Arno's agenda), en hoe bijgehouden wordt of iemand 'm al gebruikt heeft. Substantiële nieuwe feature, apart te plannen.
- Na de trial: alleen betalende gebruikers kunnen de app nog gebruiken. Drie voorgestelde abonnementen:
  - **Basis** (naam volgt nog): **verduidelijkt** — de huidige regels blijven gelden (mic-knop voor spraak-naar-tekst-invoer, tekst als output), geen voice-naar-voice-gesprek. Het volledige gesproken heen-en-weer-gesprek (ElevenLabs) is exclusief voor premium.
  - **Premium**: voice-naar-voice, ~200 berichten/maand, daarna **bijkoopbundels** (verduidelijkt, bv. 100 gesprekken voor €10, exacte prijs/aantal nog uit te zoeken) — geen upgrade naar een hogere laag, gewoon losse bundels bijkopen, zoals al genoemd in Besluit 4 hieronder.
  - **Team**: nog geen details.
- In de app: antwoorden altijd kort/normaal. Document-upload en uitgebreide antwoorden blijven exclusief voor de webapp.
- Prijsnamen/structuur (basis/premium/team) vervangen mogelijk de huidige indeling (basis/pro + losse Voice-laag) uit Besluit 1 hieronder — nog niet afgestemd hoe dit zich verhoudt tot de bestaande `tier`-kolom.
- **Besluit, meteen uitgevoerd (2026-07-19):** de bestaande per-bericht OpenAI-TTS-knop (▶, `tts-1-hd`/`onyx`) wordt uit `SparClient.tsx` verwijderd. Reden van Arno: kwaliteit is "schandalig slecht", en nu het volledige gesproken gesprek toch exclusief voor premium wordt, heeft een matige gratis versie ernaast geen functie meer. De onderliggende `/api/tts`-route blijft ongebruikt maar aanwezig, niet apart opgeruimd. De ElevenLabs-voice-mode-toggle en de herafspeelknop op voice-antwoorden blijven volledig intact, dit raakt alleen het oude OpenAI-pad.

**Volgende stap:** de resterende twee grote onderdelen (agenda-boekingsfunctie, 3-abonnementen-herstructurering incl. hoe dit zich verhoudt tot de bestaande `tier`-kolom en `voice_enabled`) zijn te groot om er nu nog doorheen te jagen. Apart plannen in een volgende sessie, zie de sessie-start-synthese hieronder.

---

## Sessie-start-synthese: agenda-boeking + abonnementsherstructurering

Dit is bedoeld om als openingsbericht te plakken in een nieuwe sessie. Kopieer alles hieronder tot aan de volgende `---`.

> We gaan twee samenhangende, nog niet geïmplementeerde onderdelen van ArnoBot Voice uitwerken. Lees eerst `docs/VOICE_PLAN.md` (het hele "Concept"-blok bovenaan, en de Status hieronder) en `docs/MOBILE_PLAN.md`, vat in twee zinnen samen waar we staan, en wacht op akkoord voordat je verdergaat, zoals gebruikelijk bij dit project.
>
> **Onderdeel 1 — één in te plannen gesprek met Arno, per gebruiker**
> Besloten: geldt voor iedereen. Trial-gebruikers moeten het binnen hun 30-dagen-trial inplannen, betaalde gebruikers kunnen het gebruiken wanneer ze willen, geen tijdslimiet.
> Nog open, eerst uitzoeken/beslissen:
> - Bouw je dit met een bestaande scheduling-tool (bv. Calendly/SavvyCal/Cal.com, embed of link) of met een eigen Google Calendar-integratie? Een bestaande tool is vermoedelijk veel sneller en betrouwbaarder dan zelf een boekingsflow plus agenda-koppeling bouwen, dat zou ik als eerste vraag voorleggen aan Arno, met een duidelijke aanbeveling.
> - Let op: deze Claude Code-sessie heeft mogelijk Google Calendar-MCP-tools beschikbaar (`mcp__claude_ai_Google_Calendar__*`), maar dat is iets anders dan een integratie die de ArnoBot-productie-app zelf kan gebruiken. Niet verwarren: die MCP-tools zijn voor Claude Code zelf tijdens een sessie, niet voor eindgebruikers van de app.
> - Hoe wordt bijgehouden of een gebruiker zijn ene gesprek al gebruikt heeft (nieuwe kolom op `approved_users`, of een aparte tabel)?
> - Waar in de UI komt dit te staan (webapp en/of app)?
>
> **Onderdeel 2 — drie abonnementen: basis, premium, team**
> Besloten (zie het Concept-blok in VOICE_PLAN.md voor de volledige context):
> - **Basis**: geen voice-naar-voice-gesprek, wel de bestaande mic-knop (spraak-naar-tekst-invoer), tekst als output.
> - **Premium**: volledig gesproken heen-en-weer-gesprek (ElevenLabs), ~200 berichten/maand, daarna bijkoopbundels (richting: 100 gesprekken voor €10, exacte prijs/aantal nog te bepalen).
> - **Team**: nog geen details, moet nog uitgedacht worden.
> Nog open:
> - Hoe verhoudt basis/premium/team zich tot de bestaande `tier`-kolom (`'basis' | 'pro'`) en de losse `voice_enabled`-boolean op `approved_users`? Vervangt dit die kolommen, of komt het ernaast?
> - Migratie van bestaande gebruikers naar de nieuwe indeling.
> - Prijzen voor premium en team.
> - Hoe dit samenhangt met fase 3 (pricingpagina) uit VOICE_PLAN.md, die al blokkeert op de nog te kiezen betaalprovider.
>
> Begin met vragen stellen over de onduidelijke punten hierboven, dan pas een plan.

---

## Status

**Laatst bijgewerkt:** 2026-07-19
**Waar we staan:** Scope van de eerste bouwstap bijgesteld tijdens deze sessie (zie hieronder): niet meteen een publieke voice-toggle in `SparClient.tsx`, maar eerst alleen de serverkant plus een volledig geïsoleerde admin-only testpagina op `/bot/admin/voice-test` (`app/api/admin/voice-test/chat/route.ts`, `app/api/admin/voice-test/tts/route.ts`), gebouwd en gepusht. Supabase-tabel `arnobot_elevenlabs_usage` aangemaakt en bevestigd. ElevenLabs-account aangemaakt (Starter-plan, API-key beperkt tot alleen Text to Speech). Nul wijzigingen aan `SparClient.tsx`/`/api/chat`/`/api/tts`/`/api/transcribe`.

**Gekozen (2026-07-19):** voor deze testfase Instant Voice Cloning gebruiken (een korte, snelle opname van Arno zelf, inbegrepen in het Starter-plan) in plaats van een generieke Nederlandse bibliotheekstem. Reden: het doel van deze test is niet alleen "klinkt ElevenLabs goed", maar vooral "klinkt ArnoBot als Arno", en dat kun je met een bibliotheekstem niet beoordelen. **Verworpen alternatief:** een Nederlandse bibliotheekstem (het oorspronkelijke voorstel in Besluit 2 hieronder) — sneller te kiezen maar test niet de eigenlijke productvraag. **Kanttekening:** Instant Voice Cloning is een snellere, lagere-kwaliteit variant dan de Professional Voice Clone die het einddoel blijft (zie Besluit 2). Een houterige instant clone is geen voorspelling van hoe de uiteindelijke Professional clone zal klinken, dat oordeel wordt uitgesteld tot dat traject. Deze testfase beoordeelt vooral latency, stijl en of het concept "een versie van mijn stem" sowieso werkt.

**Getest en goedgekeurd door Arno (2026-07-19):** live test op `/bot/admin/voice-test` met de instant-clone-stem geslaagd. Latency, antwoordstijl en stemkwaliteit akkoord.

**Besluit publieke uitrol (herbevestigd 2026-07-19):** ook op de webapp, niet mobiel-only, maar uitsluitend voor Voice-abonnees (premium, €97/mnd) via de losse `voice_enabled`-kolom, zoals al vastgelegd in ontwerpvraag 2. Zie ook het overleg eerder deze sessie waarin dit expliciet is herbevestigd na een korte omweg via "misschien mobiel-only".

**Gebouwd en live getest door Arno (2026-07-19):** de echte, premium-gated integratie staat in `SparClient.tsx` (`voice_enabled`-kolom op `approved_users`, nieuwe routes `app/api/chat-voice/route.ts` + `app/api/tts-voice/route.ts`, gedeelde logica in `lib/voice.ts`, hergebruikt door de admin-testroutes). **Architecturale correctie t.o.v. het eerdere `VoiceMode.tsx`-idee:** géén apart component gebruikt, de logica haakt direct in `ask()`/`speak()` in minimale, geïsoleerde branches, dat bleek een kleiner en veiliger diff-oppervlak dan een apart component optillen. Volledige voice-round-trip (toggle aan, vraag stellen, gesproken antwoord terug) live getest door Arno op productie: werkt. ElevenLabs toegevoegd aan privacypagina en beveiligingsdocument (versie 1.2), "Improve the models for everyone" uitgezet in het ElevenLabs-dashboard.

**Regressiecheck bevestigd door Arno (2026-07-19):** normale chat, de bestaande ▶-knop met OpenAI-stem en snelheidsmenu, sparren-modus, bestand bijvoegen, en de bestaande mic/STT-knop, allemaal gecheckt zonder voice-mode aan, geen van alle geraakt. Deze bouwstap geldt hiermee als afgerond.

**Besluit trial-voice-toegang (2026-07-19, vult fase 2 gedeeltelijk in):** elke gebruiker krijgt tijdens de bestaande 30-dagen-gratis-trial (`trial_start`, dezelfde formule als `middleware.ts`) automatisch ook gratis voice-toegang, tot een plafond (`TRIAL_VOICE_CHAR_CAP` in `lib/voice.ts`, ruw geschat op de helft van een nog niet formeel vastgestelde betaalde maandcap). Na de trial, of eerder als het plafond bereikt wordt, alleen nog toegang voor betalende Voice-abonnees (`voice_enabled=true`); wie na de trial een gewoon basis-abonnement neemt, verliest voice-toegang. Bij vroegtijdig plafond-bereik of trial-einde toont de app een upgrademelding met link naar `/prijzen`, geen blokkade zonder uitleg. Gebouwd in `lib/voice.ts` (`hasVoiceAccess()`), toegepast in `chat-voice`/`tts-voice`. **Bewust nog niet gebouwd:** plafond-enforcement voor bestaande betaalde Voice-abonnees zelf (die blijven ongewijzigd oncapped), dat blijft het bredere fase-2-werk.

**App-wachtwoord toegevoegd (2026-07-19):** nieuwe zelfservice-sectie op `app/bot/account/page.tsx` waarmee een gebruiker (aangemeld via verplichte LinkedIn OAuth) een wachtwoord aan hun account toevoegt, via Clerk's backend-API (`clerkClient.users.updateUser(userId, { password })`, vereist geen bestaand wachtwoord). Reden: de toekomstige mobiele app kan geen LinkedIn-OAuth gebruiken (zie `docs/MOBILE_PLAN.md`), dus wachtwoord-login is het alternatief. Bevestigd: Clerk-dashboard-instelling "Add password to account" stond al aan, geen configuratiewijziging nodig geweest.

**Mobiele app losgekoppeld van livegang (2026-07-19, besluit van Arno):** ArnoBot kan live gaan op web zonder de mobiele app, die is geen vereiste voor launch. De mobiele-inlog-stukken (`app/sign-in/AppSignIn.tsx`, conditionele branch in de sign-in-pagina, `@capacitor/browser`) zijn wel gebouwd en gecommit, maar bewust niet verder getest/gepolijst nu, de mobiele app zelf staat voorlopig geparkeerd (zie `docs/MOBILE_PLAN.md`).

**Eerstvolgende stap:** nog geen admin-UI om `voice_enabled` bij andere gebruikers te zetten (alleen handmatige SQL, zoals nu bij Arno zelf); nodig zodra er echte testgebruikers bij komen. Verder: livegang-voorbereiding op web (betaalprovider-keuze blijft blokkerend voor fase 3/pricingpagina, zie fasering hieronder).

---

## Besluiten

### 1. Abonnementslaag
Nieuwe laag "ArnoBot Voice" voor €97/maand, naast de bestaande Unlimited-laag (€77/maand, zie `app/prijzen/page.tsx`). Voice in en voice uit, eerst op de webapp, later in de (nog te bouwen) mobiele app.

### 2. TTS-leverancier
ElevenLabs API rechtstreeks (geen reseller), model Flash v2.5, streaming audio. Dit vervangt de huidige OpenAI `tts-1-hd`/`onyx`-implementatie (`app/api/tts/route.ts`) niet, maar komt er in de voice-flow naast: ArnoBot Voice-gebruikers krijgen ElevenLabs, de bestaande TTS-knop per bericht (niet-voice-gebruikers) blijft op OpenAI staan tenzij hier later anders over besloten wordt.

Stem: Professional Voice Clone van Arno. Tot die klaar is, een Nederlandse stem uit de ElevenLabs-bibliotheek, stem-ID als env-variabele (bijvoorbeeld `ELEVENLABS_VOICE_ID`) zodat wisselen naar de clone geen codewijziging vereist.

### 3. Eigen systeeminstructie voor voice-antwoorden
Voice-antwoorden krijgen een aparte systeeminstructie: gespreksachtige toon, doellengte 400 tot 600 tekens. De bestaande lange tekstantwoorden in de hoofdchat blijven ongewijzigd. Stijlvoorbeeld: de BIEB-samenvattingen.

Dit wordt geïmplementeerd in een nieuwe, losse route (zie ontwerpvraag 1 hieronder), niet als flag binnen de bestaande `app/api/chat/route.ts`. De bestaande streepjes-regel en jij/jou-regel uit CLAUDE.md gelden onverkort voor deze nieuwe systeeminstructie.

### 4. Verbruiksplafond
Intern meten in tekens/kosten per gebruiker per maand. In de UI tonen als "gesproken antwoorden" (ruim 200/maand, exacte drempel later te bepalen). Bij bereiken van het plafond: vriendelijke melding, daarna naadloos verder in tekst. Nooit blokkeren.

Bijkoopbundels (200 antwoorden voor €10) lopen via de website, niet in-app.

Er bestaat nog geen tabel of kolom voor dit soort meting. Het dichtstbijzijnde patroon is de daglimiet-telling in `arnobot_rds_logs` (rijen tellen via `created_at`-filter, zie `app/api/chat/route.ts:283-291`) maar dat telt berichten, geen tekens/kosten, en niet per maand. Nieuwe tabel of kolommen nodig (zie vraag 3 hieronder).

### 5. Identificatie per Clerk user-id
Limieten en plafond worden per Clerk user-id geregistreerd, nooit per IP. De bestaande Upstash per-IP rate limiting (`app/api/chat/route.ts:130-147`, sliding window 5/minuut) blijft ongewijzigd als misbruikvangnet, los van het voice-plafond.

### 6. Geen aankoopflow in de app
App is inloggen en gebruiken. Betalen (nieuwe laag, bijkoopbundels) gebeurt op de website, niet in-app, vanwege Apple/Google-regels voor de toekomstige mobiele app.

### 7. Afspeellogica voor voice-antwoorden (mobiel-bewezen ontwerpeis, toegevoegd 2026-07-19)
**Gekozen:** het afspelen van de ElevenLabs-audio start binnen dezelfde tikactie waarmee de gebruiker de vraag verstuurt of het opnemen start. Dat telt als een user gesture, waarna streaming-audio ook op mobiele browsers/webviews mag beginnen. Daarnaast komt er een zichtbare afspeelknop als vangnet voor het geval de gesture-koppeling niet aanslaat.

**Verworpen alternatief:** automatisch afspelen zodra de tekst binnenkomt, los van een directe gebruikersactie. Werkt niet betrouwbaar op mobiele Safari en Capacitor-webviews door autoplay-restricties (ontdekt tijdens de audit voor `docs/MOBILE_PLAN.md`, zie daar voor de volledige onderbouwing).

**Reden dat dit hier staat en niet pas bij fase 4:** deze ontwerpeis raakt fase 1 (voice op de webapp), niet alleen de latere mobiele app. Mobiele browsers hebben dezelfde autoplay-restrictie als Capacitor-webviews. Fase 1 moet dus vanaf het begin mobiel-bewezen zijn, niet pas bij fase 4 hersteld worden.

---

## Fasering

**Fase 1 — voice-mode in de bestaande webapp achter een feature flag**
- [ ] Supabase-migratie: kolom `voice_enabled` (boolean) op `approved_users` — ter bevestiging voorleggen zoals bij elke schema-wijziging
- [ ] Supabase-migratie: nieuwe tabel voor tekenteller per gebruiker per maand — ter bevestiging voorleggen
- [ ] Env-variabelen `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- [ ] Opname (STT): hergebruik van het bestaande patroon in `SparClient.tsx` (`MediaRecorder`, `getUserMedia`, upload naar `/api/transcribe`) — ongewijzigd, blijft OpenAI Whisper (ontwerpvraag 3)
- [ ] Nieuwe route `app/api/chat-voice/route.ts` met de voice-systeeminstructie (besluit 3, ontwerpvraag 1)
- [ ] Nieuwe route voor ElevenLabs streaming TTS (besluit 2), naast het bestaande `app/api/tts/route.ts`
- [ ] Afspeellogica die binnen de user-gesture start, met zichtbare afspeelknop als vangnet (besluit 7)
- [ ] Voice-mode toggle in `SparClient.tsx`, achter de `voice_enabled`-flag (ontwerpvraag 2). **Bouwrichtlijn (2026-07-19):** nieuwe voice-logica/state in een apart component (bv. `VoiceMode.tsx`) dat `SparClient.tsx` conditioneel mount, niet doorweven in de bestaande 1600+ regels. Kleinste diff-oppervlak in het gedeelde bestand dat alle bot-gebruikers al gebruiken, kleinste kans op regressie voor niet-Voice-gebruikers.
- [ ] Na fase 1: expliciet de bestaande tekst-chat-, TTS- en STT-flow opnieuw testen (regressiecheck) vóórdat fase 1 als afgerond geldt
- [ ] Automatische ElevenLabs-playback voor Voice-abonnees i.p.v. de handmatige OpenAI-knop (ontwerpvraag 4)
- [ ] `package.json`: ElevenLabs toevoegen
- [ ] CLAUDE.md bijwerken: ElevenLabs toevoegen aan de kwartaalcheck-sectie en de modelinventaris-tabel, in dezelfde commit
- [ ] Testen op telefoon in de mobiele browser (gratis generale repetitie voor de latere Capacitor-app, zie `docs/MOBILE_PLAN.md`)

Er bestaat nog geen generiek feature-flag-mechanisme in de codebase (geverifieerd: geen `FEATURE_*`-patroon). Fase 1 introduceert de eerste flag, als losse boolean-kolom op `approved_users`, naast de bestaande `tier`-kolom (`'basis' | 'pro'`).

**Fase 2 — plafond-logica, meldingen, tekst-fallback**
- [ ] Nog niet in detail uitgewerkt

**Fase 3 — pricingpagina met de nieuwe tier, upgradeflow**
- [ ] **Blokkerend:** betaalprovider gekozen. Er is geen betaalprovider-integratie in de code (bevestigd in `docs/BUSINESS_HANDOVER.md`); betalingen worden nu handmatig geregistreerd via `/bot/admin/gebruikers` of `POST /api/admin/payment`. De upgradeflow in fase 3 hangt aan deze keuze, dus die moet vóór fase 3 beslist zijn (zie `project_dunning_flow` in memory)
- [ ] Pricingpagina met de €77/€97-opbouw

**Fase 4 — Capacitor-app**, pas na bewezen fase 1 t/m 3. Volledig uitgewerkt in `docs/MOBILE_PLAN.md`.

---

## Relevante bestaande code (referentie voor bouw)

- **Clerk auth-patroon**: `const { userId } = await auth()` + 401-check, zie `app/api/transcribe/route.ts:2-6`. Voor ingelogde gebruikers wordt `userId` nooit uit de request body vertrouwd (`app/api/chat/route.ts:237-242`).
- **STT**: `app/api/transcribe/route.ts` (Whisper, ruwe fetch, geen SDK). Frontend-opname in `app/bot/SparClient.tsx` (state rond regel 179-180, 251-252; `startRecording`/`stopRecording` rond 270-306; mic-knop UI rond 1652-1666).
- **TTS**: `app/api/tts/route.ts` (OpenAI `tts-1-hd`/`onyx`, geen streaming, volledige buffer). Afspelen via `speak()` in `SparClient.tsx:572-604` (`Audio()`-API, geen `<audio>`-element).
- **CORS**: alleen in `app/api/chat/route.ts:33-52` (`ALLOWED_ORIGINS`: arno.bot, www.arno.bot, arno.blog, www.arno.blog). `transcribe` en `tts` hebben geen CORS-headers, alleen same-origin gebruik vanuit `arno.bot`.
- **Abonnement**: alles zit plat in de Supabase-tabel `approved_users` (geen aparte subscriptions-tabel, geen Clerk publicMetadata voor abonnementsstatus). Relevante kolommen: `tier` ('basis'/'pro'), `is_active`, `paid_at`, `expires_at`, `trial_start`.
- **Rate limiting**: Upstash-instanties direct in `app/api/chat/route.ts:130-147`, geen gedeelde `lib/ratelimit.ts`. `transcribe` en `tts` hebben momenteel geen eigen rate limiting.
- **Package.json**: geen ElevenLabs-SDK of andere voice-SDK aanwezig. Moet worden toegevoegd in fase 1.

---

## Beantwoorde ontwerpvragen (2026-07-19)

1. **Route-opzet voor de voice-chatflow**: nieuwe losse route (bv. `app/api/chat-voice/route.ts`), niet als flag binnen de bestaande `app/api/chat/route.ts`. Eigen CORS/rate-limit-instellingen, raakt de bestaande hoofdchat niet aan.
2. **Feature flag voor toegang tot ArnoBot Voice**: losse boolean-kolom op `approved_users` (bv. `voice_enabled`), onafhankelijk van de bestaande `tier`-kolom (basis/pro). Voice is een addon, geen vervanging van basis/pro.
3. **STT-leverancier**: blijft OpenAI Whisper via het bestaande `app/api/transcribe/route.ts`. Geen nieuwe leverancier voor spraakherkenning, alleen TTS gaat naar ElevenLabs.
4. **Bestaande per-bericht TTS-knop (OpenAI tts-1-hd/onyx) in `SparClient.tsx`**: voor Voice-abonnees vervangen door automatische ElevenLabs-playback (Flash v2.5, straks Arno's clone) na elk antwoord. Niet-Voice-gebruikers behouden de bestaande handmatige OpenAI-knop ongewijzigd.

Deze vier antwoorden zijn verwerkt in de fasering hierboven en zijn leidend voor de bouw van fase 1.

# ArnoBot Voice — mobiele app (fase 4 uit VOICE_PLAN.md)

Dit document bereidt fase 4 van `docs/VOICE_PLAN.md` voor: een mobiele app via Capacitor voor App Store en Google Play. Dit is een audit- en voorbereidingsdocument. Er is nog geen Capacitor-code geschreven en er zijn nog geen productiewijzigingen gedaan, dat wacht op fase 1 t/m 3 van VOICE_PLAN.md.

---

## Status

**Laatst bijgewerkt:** 2026-07-19
**Waar we staan:** Audit van de codebase afgerond (audit-only, geen codewijzigingen). Architectuurvraag (remote laden vs. statisch bundelen) beantwoord met een duidelijke aanbeveling, zie hieronder. Accountvoorbereiding (Apple als Individual, Google Play, Mac, stemopnames) loopt parallel buiten Claude Code om, door Arno zelf.
**Eerstvolgende stap:** Wachten tot `docs/VOICE_PLAN.md` fase 1 t/m 3 bewezen werken. Zodra dat zo is: Capacitor toevoegen aan `package.json` en de eerste "remote laden"-shell opzetten (zie Architectuurbesluit hieronder).

---

## Volgorde — compleet stappenplan (vastgesteld 2026-07-19)

1. **Nu, parallel aan alles, buiten Claude Code om:** Apple Developer-account starten als **Individual** (er is nog geen bedrijfsentiteit; een Individual-account heeft geen D-U-N-S-nummer nodig, alleen naam + belastinggegevens), later omzetten naar een Organization-account met D-U-N-S zodra de entiteit bestaat. Google Play-account aanmaken en daar zelf verifiëren hoe de verplichte testperiode voor het gekozen accounttype werkt (zie Openstaande vragen), Mac met Xcode regelen, ElevenLabs-luistertest doen, en Arno's opnamemateriaal voor de Professional Voice Clone verzamelen/opnemen — dit laatste staat nog nergens anders gepland en heeft de langste doorlooptijd van alle ingrediënten die buiten de code om lopen.
2. **Dit document:** audit, geen codewijzigingen. Afgerond.
3. **VOICE_PLAN.md fase 1:** voice op de webapp, inclusief het mobiel-bewezen afspeelontwerp (besluit 7 in VOICE_PLAN.md). Testen op telefoon in de browser, dat is gratis generale repetitie voor de app.
4. **VOICE_PLAN.md fase 2-3:** plafondlogica met tekst-fallback, daarna de pricingpagina. Betaalprovider-keuze is blokkerend vóór fase 3.
5. **Testronde op de webapp** met bestaande testgebruikers, mobiel in de browser. Hier komt ook de eerste echte verbruiksdata binnen voor het latere cap-besluit.
6. **Pas dan Capacitor:** de echte integratie — OAuth via systeembrowser, Sign in with Apple, CORS-uitbreiding, microfoonpermissies, accountverwijdering. Vanaf hier is een reviewer-agent actief die elke wijziging langs een vaste checklist legt (breekt dit de bestaande webapp, raakt dit CORS/auth, staat er per ongeluk een prijsverwijzing in de app).
7. **TestFlight (iOS) en de interne Android-track** met dezelfde testgroep. Dan pas een store-compliance-agent definiëren (met op dat moment actuele Apple/Google-richtlijnen als context, niet nu alvast), demo-account en privacylabels klaarzetten, submissie.
8. **Na launch:** meten wie het voice-plafond raakt, dan pas beslissen over de bijkoopbundels.

De rode draad: elke stap bewijst iets voordat de volgende stap geld of tijd kost. Voice bewijst zich op web voordat de app er is; de app bewijst zich bij testers voordat de stores erbij komen.

**Bewust niet nu optuigen:** drie subagents (reviewer, store-compliance, test) vooraf definiëren is voorbarig voor werk dat nog niet begint, en Apple/Google-richtlijnen verschuiven tussen nu en submissie. Alleen de reviewer-agent wordt ingezet zodra er daadwerkelijk Capacitor-code komt (stap 6); de store-compliance-agent pas vlak vóór de eerste submissie (stap 7), met dan verse richtlijnen.

---

## Technische vereisten (vastgesteld 2026-07-19)

1. Capacitor als wrapper om de bestaande Next.js-app. Bestaande code maximaal hergebruiken, geen parallelle mobiele codebase.
2. OAuth (Clerk, o.a. LinkedIn) mag nooit in een embedded webview lopen; Google en LinkedIn blokkeren dat actief. Systeembrowser (Capacitor Browser plugin) met deep link terug naar de app (custom URL scheme plus Universal Links/App Links). Wat Clerk hiervoor precies aanbeveelt voor Capacitor specifiek (in tegenstelling tot hun React Native/Expo-SDK) is nog niet onderzocht, zie Openstaande vragen.
3. CORS-allowlist in `app/api/chat/route.ts` uitbreiden met de Capacitor-origins (`capacitor://localhost` en `https://localhost`), en controleren of er elders origin-checks zitten die de app zouden breken.
4. Microfoontoegang netjes regelen: `NSMicrophoneUsageDescription` (iOS) en `RECORD_AUDIO` (Android) met een Nederlandse uitleg, toestemming pas vragen op het moment dat de gebruiker voice start, niet bij het opstarten van de app.
5. Geen enkele aankoop-, upgrade- of prijsverwijzing in de app. De app is: inloggen en gebruiken. Alles rond betalen leeft op de website. Controleren dat er geen links naar de pricingpagina in de app-schermen terechtkomen.
6. Sign in with Apple toevoegen via Clerk. Apple vereist dit zodra andere sociale logins (LinkedIn) worden aangeboden — Apple-richtlijn 4.8.
7. Accountverwijdering vanuit de app mogelijk maken of er duidelijk naartoe linken — Apple-richtlijn 5.1.1(v).
8. Rate limiting per Clerk user-id (zoals in VOICE_PLAN.md besluit 5), niet per IP — per-IP zou app-gebruikers achter provider-NAT onterecht raken.

---

## Architectuurbesluit: remote laden vs. statisch bundelen

**Aanbeveling: remote laden.** De Capacitor-shell laadt `https://arno.bot` zoals een browser dat doet, in plaats van een statische export van de app te bundelen.

**Onderbouwing uit de audit (2026-07-19):**

- `middleware.ts` (269 regels) doet op élke `/bot/*`-request een live Clerk-sessiecheck plus een Supabase-lookup in `approved_users`, voert zo nodig auto-trial-provisioning uit, en beslist server-side of er geredirect wordt naar `/bot-aanmelden`, `/bot/uitnodiging-vereist`, `/bot/welkom` of `/bot/profiel`. Dit is de hoofdroute van de app, geen randgeval, en draait alleen op een Next.js-server.
- Meerdere route-entrypoints zijn `async` server components die vóór render zowel auth/cookie-checks als Supabase-data-fetches doen, met `redirect()` als onderdeel van de businesslogica: `app/bot/page.tsx`, `app/bot/qa/page.tsx`, `app/bot/coaching/page.tsx`, `app/bot/team/page.tsx`, en alle `app/bot/admin/*/page.tsx` (eigen `arnobot_admin`-cookie-check tegen `ARNOBOT_ADMIN_KEY`).
- `next.config.ts` gebruikt `async redirects()`, wat een server vereist en incompatibel is met `output: 'export'`. Er is geen `output: 'export'` geconfigureerd; de build is expliciet server-based (`next build --webpack` + `next start` op Vercel).
- Een aantal plekken bouwt URL's op basis van `window.location.origin` voor OAuth-redirects en invite-links: `app/sign-in/[[...sign-in]]/page.tsx:26,169`, `app/sign-in/enterprise/page.tsx:27`, `app/sign-up/[[...sign-up]]/page.tsx:21`, `app/bot/team/TeamClient.tsx:259`. Bij remote laden blijft de origin gewoon `https://arno.bot`, zoals in een normale browser, en dit probleem vervalt vanzelf. Bij statisch bundelen zou elke plek herschreven moeten worden naar een hardcoded/env-based canonieke origin, en zou Clerk's OAuth-callback anders een niet-geregistreerde origin krijgen.
- Geen Server Actions (`'use server'`) gevonden in de codebase — geen extra complicatie in die categorie.
- De kern-clientcomponenten (`SparClient.tsx`, `BotNav.tsx`) zijn zelf browser-API-technisch schoon; het probleem zit niet daar, maar in de server-gatekeeping die ervoor draait.

**Wat statisch bundelen zou vereisen (en waarom dat wordt afgeraden):** een substantiële herbouw van minimaal de hele auth/trial/onboarding-gate uit `middleware.ts`, alle `redirect()`-logica in de genoemde server components, de admin-cookie-auth-pagina's, én het herschrijven van de `window.location.origin`-afhankelijke OAuth- en invite-link-code. Dat is een parallelle mobiele architectuur, precies wat technische vereiste 1 hierboven uitsluit.

**Verworpen alternatief:** statisch bundelen. Reden: zie hierboven, vereist een herbouw van kernfunctionaliteit die bij remote laden gratis blijft werken.

---

## Twee risico's die niet in de oorspronkelijke briefing stonden

1. **Microfoontoegang binnen een Capacitor-webview.** De bestaande opname loopt via de browser-API `getUserMedia()` in `SparClient.tsx` (hergebruikt in fase 1 van VOICE_PLAN.md). Of dat binnen een Capacitor-webview zonder extra native permissie-plugin/config automatisch de iOS/Android-permissiedialoog triggert, is niet vanzelfsprekend. **Dit wordt een expliciete test op echte toestellen**, geen aanname vooraf.
2. **Audio-autoplay-restricties.** Mobiele webviews (en mobiele Safari) blokkeren `audio.play()` vaak zonder directe user-gesture. Dit raakt niet alleen de mobiele app maar al fase 1 van VOICE_PLAN.md, omdat daar is besloten dat Voice-abonnees automatisch ElevenLabs-audio horen na elk antwoord. Dit is verwerkt als besluit 7 in `docs/VOICE_PLAN.md` (afspelen binnen de user-gesture, met een zichtbare afspeelknop als vangnet) en hoeft hier niet apart opgelost te worden, alleen bevestigd te blijven werken zodra de Capacitor-shell erbij komt.

---

## Openstaande vragen

- **Apple: Individual-account later omzetten naar Organization.** Voor zover bekend biedt Apple geen soepele "upgrade" van een Individual- naar een Organization-account binnen hetzelfde Developer-account; vermoedelijk is een nieuwe enrollment als Organization nodig zodra de entiteit bestaat, met een app-transfer van het Individual-account naar het nieuwe Organization-account (Apple ondersteunt dat, met wel wat voorwaarden: de app moet al live staan, beide accounts in goede staat zijn, en niet alles gaat 1-op-1 mee, bv. bepaalde historische gegevens). Dit is niet 100% zeker, rechtstreeks bij Apple Developer-documentatie verifiëren vóórdat de eerste (Individual) enrollment start, zodat er geen verrassing is als de app straks weg moet van het huidige account.
- **Google Play: testperiode-eis voor nieuwe accounts.** Bewering (nog niet geverifieerd): een organisatie-account zou zijn vrijgesteld van de verplichte closed-testing-periode (20 testers, 14 dagen) die geldt voor nieuwe persoonlijke accounts. Dit rechtstreeks bij Google Play Console controleren op het moment van accountaanmaak, niet aannemen.
- **Clerk + Capacitor OAuth-ondersteuning.** Clerk heeft officiële ondersteuning voor React Native/Expo; wat het aanbevolen patroon is voor Capacitor specifiek (systeembrowser + deep link terugkoppelen aan een Clerk-sessie) is nog niet onderzocht in Clerk's documentatie.
- **Remote laden en app-store-review.** Beide stores staan apps toe die primair een webapp tonen, zolang de app een native shell-functionaliteit toevoegt (hier: voice, microfoon, native permissies, Sign in with Apple) en niet puur een browser-wrapper zonder toegevoegde waarde is. Bij de eerste submissie expliciet in de reviewer-notes toelichten wat de native meerwaarde is.

---

## Relevante bestaande code (referentie voor bouw, stap 6)

- **Auth-gate:** `middleware.ts:91-260` (Clerk `clerkMiddleware`, auto-trial-provisioning, redirects).
- **CORS:** `app/api/chat/route.ts:33-52` (`ALLOWED_ORIGINS`), hier komen de Capacitor-origins bij.
- **OAuth-origin-afhankelijke code:** `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-in/enterprise/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`, `app/ClerkAppProvider.tsx` (forceert bewust `window.location.href` i.p.v. Next.js-routing bij Clerk-redirects, om een router-cache-bug te omzeilen — testen bij de LinkedIn OAuth-flow op mobiel).
- **Microfoon/opname:** `app/bot/SparClient.tsx` (state rond regel 179-180, 251-252; `startRecording`/`stopRecording` rond 270-306).
- **Package.json:** geen `@capacitor/*` dependency aanwezig, moet vanaf nul toegevoegd worden in stap 6.

# ArnoBot Voice — mobiele app (fase 4 uit VOICE_PLAN.md)

Dit document bereidt fase 4 van `docs/VOICE_PLAN.md` voor: een mobiele app via Capacitor voor App Store en Google Play. Dit is een audit- en voorbereidingsdocument. Er is nog geen Capacitor-code geschreven en er zijn nog geen productiewijzigingen gedaan, dat wacht op fase 1 t/m 3 van VOICE_PLAN.md.

---

## Status

**Laatst bijgewerkt:** 2026-07-19
**Waar we staan:** Audit van de codebase afgerond (audit-only, geen codewijzigingen). Architectuurvraag (remote laden vs. statisch bundelen) beantwoord met een duidelijke aanbeveling, zie hieronder. `docs/VOICE_PLAN.md` fase 1 (premium-gated voice op de webapp) is gebouwd en live getest. ArnoBot is nog niet commercieel gelaunched, er zijn nog geen betalende klanten.

**Gekozen volgorde (herbevestigd 2026-07-19, bewust NIET parallel):** eerst de mobiele app ontwikkelen, dan pas de Professional Voice Clone inspreken, dan pas het abonnement/de pricingpagina bijwerken. Reden van Arno: zolang er niet gelaunched is, hoort geen betalende klant de (lagere-kwaliteit) Instant Clone die nu voor de live test gebruikt wordt, dus er is geen urgentie om de stemopnames vóór de mobiele-appbouw te doen. **Dit vervangt punt 1 hieronder**, dat stemopnames nog als "nu, parallel aan alles" beschreef, dat gold vóórdat duidelijk was dat er nog geen launch is.
**Gekozen (2026-07-19): Android eerst, dan pas iOS.** Reden: geen Mac nodig voor Android-ontwikkeling (draait op Windows, Arno's huidige omgeving, en verwijdert daarmee de Mac-blokkade voor de eerste fase), en een Google Play-account is goedkoper om te starten ($25 eenmalig vs. $99/jaar bij Apple). Sign in with Apple en de overige Apple-specifieke eisen blijven gewoon wachten tot de iOS-kant aan de beurt is; de rest van de Capacitor-integratie (remote laden, OAuth via systeembrowser, CORS-origins, microfoonpermissies) is platform-gedeeld en hoeft niet dubbel ontworpen te worden.

**Openstaand, buiten Claude Code om:** Google Play-accountverificatie loopt vast op een Google-fraudecontrole bij het net aangemaakte account (identiteitsdocument is geüpload en in behandeling, enkele dagen; apparaat-/telefoonverificatie geeft "Google kan niet verifiëren dat dit account van jou is" bij inloggen op de telefoon). Advies: even laten rusten, over een paar dagen opnieuw proberen, niet blijven forceren. Bij aanhoudend vastlopen: overwegen met een ander Google-account opnieuw te beginnen.

**Belangrijke ontkoppeling (2026-07-19):** een geverifieerd Play Console-account is alleen nodig om te *publiceren/testen via de store* (de "App maken"-knop blijft grijs tot verificatie rond is). Het is **niet** nodig om te *bouwen*: Capacitor toevoegen, het Android-project lokaal opzetten, en lokaal testen (emulator of `adb install`) werkt volledig los van de Play Console-accountstatus. De accountverificatie hoeft dus niet meer af te wachten voordat de Capacitor-bouwstap start.

**Gebouwd (2026-07-19):** Capacitor-shell voor Android toegevoegd. `capacitor.config.ts` (appId `arno.bot`, appName ArnoBot, remote laden via `server.url: https://arno.bot`), `android/`-projectskelet gescaffold via `npx cap add android` (lukte zonder Java/SDK nodig te hebben, dat is puur een Node-scaffoldstap), microfoonpermissie gedeclareerd in het manifest (RECORD_AUDIO), `.gitignore` uitgebreid met build-artefacten. Bevestigd tijdens dit onderzoek: bij remote laden is **geen enkele CORS- of CSP-wijziging nodig** in `middleware.ts`/`next.config.ts`, de WebView draait het echte `arno.bot`-origin, precies zoals een normale browser. Dit weerlegt de eerdere aanname (technische vereiste 3) dat de CORS-allowlist Capacitor-origins nodig zou hebben, dat gold alleen bij lokaal bundelen.

**Belangrijke beperking:** deze Windows-machine heeft geen Java/JDK, Android SDK of Gradle geïnstalleerd. Scaffolden lukte (puur Node), maar bouwen/draaien/testen van de app kan hier niet. **Actie vereist van Arno:** Android Studio installeren (bundelt JDK + SDK + Gradle + emulator in één installer), dan `android/` openen, Gradle laten syncen, en op een emulator of eigen toestel draaien (`npx cap run android` of via Android Studio's Run-knop).

**Getest op emulator (2026-07-19, Android Studio + Pixel 9 Pro XL-emulator, API 37.1):**
- **Bug gevonden en gefixt:** `server.url` stond op `https://arno.bot`, maar dat domein stuurt zelf altijd door naar `https://www.arno.bot` (308-redirect). Capacitor's WebView staat alleen navigatie toe binnen het exact geconfigureerde domein, dus die eerste redirect-hop werd als "extern" behandeld en de content opende in de systeembrowser (Chrome) in plaats van in de app zelf, met adresbalk en al. **Fix:** `server.url` wijst nu direct naar `https://www.arno.bot`, plus `server.allowNavigation: ['arno.bot', 'www.arno.bot', 'clerk.arno.bot']` als vangnet voor toekomstige in-app-redirects. Na de fix laadt de content correct binnen de app, zonder browser-chrome.
- **E-mail/wachtwoord-login: bevestigd werkend** binnen de app-WebView. Sessie persisteert normaal tussen app-starts (cookies blijven staan tenzij de emulator cold boot of de app opnieuw geïnstalleerd wordt).
- **LinkedIn-OAuth-login: bevestigd NIET werkend** in deze opzet, zoals verwacht. Springt terecht naar de systeembrowser (Google/LinkedIn-beleid staat OAuth niet toe in een embedded webview), maar landt op een kale `clerk.arno.bot/v1/oauth_callback`-pagina zonder terug te keren naar de app, want er is nog geen deep-link-infrastructuur.
- **Bevindingen na onderzoek (websearch, Ionic-forum + een werkende Clerk+Capacitor-tutorial):** OAuth-via-systeembrowser-plus-terugkoppeling voor Clerk in een Capacitor-WebView is genuinely onbewezen terrein, ook breder in de community, niet alleen bij ons. Zelfs mensen die het actief proberen weten niet zeker of Clerk's sessie/cookie-status correct overspringt van de systeembrowser terug naar de app-WebView (twee aparte cookie-opslagplekken). Een concrete, werkende Clerk-plus-Capacitor-tutorial dekt bewust **geen** OAuth/social login, alleen e-mail/wachtwoord (met een code, geen klikbare link, Clerk waarschuwt zelf dat verificatielinks op mobiel problematisch zijn door dezelfde externe-browser-afhankelijkheid).
- **Besluit (2026-07-19):** LinkedIn-login blijft voorlopig web-only. Op mobiel alleen e-mail/wachtwoord aanbieden, dat is de bevestigd werkende weg. OAuth-via-systeembrowser wordt niet nu gebouwd, risico op een half-werkende authenticatieflow weegt niet op tegen de winst op dit moment. Herzien zodra Clerk duidelijkere Capacitor-specifieke documentatie publiceert, of als er een concrete zakelijke reden is om LinkedIn-login op mobiel alsnog te forceren.
- **Mic-knop: nog niet getest** op de emulator (mic-input via de pc-microfoon is minder representatief), wordt getest op een fysiek toestel zodra er een goede USB-kabel is (huidige kabel bleek waarschijnlijk defect/alleen-opladen).
- **App-icoon:** de bestaande `public/arnobot-logo.png` is een brede tekst-wordmark (ARNO+BOT naast elkaar), niet geschikt als vierkant app-icoon. De bestaande `app/favicon.ico` is een simpel zwart driehoekje zonder duidelijke merkherkenning, ook niet geschikt. Placeholder-bronbestand aangemaakt (`public/arnobot-app-icon-source.png`, amber "AB"-monogram op donker, consistent met de merkstijl), nog niet toegepast op de daadwerkelijke app-icoonbestanden (dat is een handmatige stap via Android Studio's Image Asset-tool).

**Mobiele app losgekoppeld van livegang (2026-07-19, besluit van Arno):** ArnoBot kan live gaan op web zonder de mobiele app, die is geen vereiste voor launch. De basis-shell werkt (na de navigatiefix) en e-mail/wachtwoord-login is bevestigd, maar verdere mobiele-app-stappen (icoon toepassen, mic-test op fysiek toestel, verdere Play Console-verificatie) staan bewust geparkeerd. `docs/VOICE_PLAN.md` is intussen wel uitgebreid met een wachtwoord-instelflow (`app/bot/account/page.tsx`) en trial-voice-toegang die primair voor de webapp gebouwd zijn, maar ook al klaarstaan voor zodra de mobiele app weer wordt opgepakt.

**Eerstvolgende stap:** geen actieve vervolgstap op dit document nu. Wordt hervat zodra Arno de mobiele app weer prioriteert (na de Google Play-verificatie, met een werkende USB-kabel voor de mic-test, en het icoon toegepast).

---

## Volgorde — compleet stappenplan (vastgesteld 2026-07-19)

1. **Nu, buiten Claude Code om:** Google Play-account aanmaken (zie Gekozen-notitie hierboven: Android eerst, geen Mac nodig). Apple Developer-account (**Individual**, geen D-U-N-S-nummer nodig, alleen naam + belastinggegevens) en Mac met Xcode regelen mogen wachten tot de iOS-kant aan de beurt is. **Bewust NIET meer parallel:** Arno's opnamemateriaal voor de Professional Voice Clone, dat komt pas ná de mobiele-appbouw (stap 6), samen met de pricingpagina-update, zie het statusblok hierboven voor de reden.
2. **Dit document:** audit, geen codewijzigingen. Afgerond.
3. **VOICE_PLAN.md fase 1:** voice op de webapp, inclusief het mobiel-bewezen afspeelontwerp (besluit 7 in VOICE_PLAN.md). Testen op telefoon in de browser, dat is gratis generale repetitie voor de app.
4. **VOICE_PLAN.md fase 2-3:** plafondlogica met tekst-fallback, daarna de pricingpagina. Betaalprovider-keuze is blokkerend vóór fase 3.
5. **Testronde op de webapp** met bestaande testgebruikers, mobiel in de browser. Hier komt ook de eerste echte verbruiksdata binnen voor het latere cap-besluit.
6. **Pas dan Capacitor, Android eerst:** de echte integratie — OAuth via systeembrowser, CORS-uitbreiding, microfoonpermissies, accountverwijdering, eerst en alleen voor Android. Sign in with Apple, Apple-specifieke CORS-origin en de rest van de iOS-kant volgen pas zodra Apple Developer + Mac geregeld zijn (zie stap 1). Vanaf hier is een reviewer-agent actief die elke wijziging langs een vaste checklist legt (breekt dit de bestaande webapp, raakt dit CORS/auth, staat er per ongeluk een prijsverwijzing in de app).
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

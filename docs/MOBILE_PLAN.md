# ArnoBot Android-app (Capacitor)

De Android-app is een Capacitor-schil die de live website laadt. Dit document bevat de besluiten, de werkwijze en de dingen die tijdens de bouw zijn geleerd. De volledige bouwgeschiedenis (accountverificatie, testersgedoe, alle tussenversies) staat in git: `git log --follow -- docs/MOBILE_PLAN.md`. De iOS-app staat in `docs/IOS_INDIENEN.md`, pushmeldingen in `docs/PUSH_PLAN.md`.

## Statusblok

- **Laatst bijgewerkt:** 2026-11-15 (document ingekort van 51 KB tot de actuele stand)
- **Waar we staan:** de Android-app staat in de Play Store (Production). Laatste versie in de code: 1.0.4, `versionCode 5` (`android/app/build.gradle`), ingediend op 2026-11-07. Controleer de actuele Store-versie in Play Console. Het Google Play-account is een **Organisatie**-account (eenmanszaak ArnoBot) met handelaarsstatus (Trader) afgerond op account- en app-niveau.
- **Eerstvolgende stap:** geen voor Android. Controleren of de splash en de brede verspringing in 1.0.4 goed zijn; zo niet, dan de telefoonindeling server-side bepalen (`useIsTouch` in `SparClient.tsx` start op desktop). Optioneel: `app/testlogin/page.tsx` omzetten naar `signIn.password()` (gebruikt nog `signIn.create()`). Daarna iOS en push, zie hierboven.
- **Alleen de native schil vraagt een release** (zie Werkwijze). Het uploaden van een nieuwe versie vraagt de keystore, zie `docs/LAPTOP_OVERDRACHT.md`.

## Besluiten

- **Android eerst, dan iOS.** Gekozen: geen Mac nodig voor Android, en $25 eenmalig tegenover $99 per jaar bij Apple. Sign in with Apple en de overige Apple-eisen wachten op de iOS-kant.
- **Remote laden, niet statisch bundelen.** De schil laadt `https://www.arno.bot/bot` (`capacitor.config.ts`, `server.url`). Gekozen omdat de middleware (`proxy.ts`) op elke `/bot/*`-aanvraag een live Clerk-sessiecheck en een Supabase-lookup doet (inclusief auto-trial en redirects), meerdere route-entrypoints async server components zijn die vóór het renderen auth en data ophalen, en `next.config.ts` `async redirects()` gebruikt (niet te combineren met `output: 'export'`). **Verworpen:** statisch bundelen, want dat vraagt een herbouw van de hele auth-, trial- en onboardingpoort. Gevolg: de CORS-lijst hoefde niet uitgebreid (de WebView draait het echte `arno.bot`-origin) en elke webwijziging is direct live in de app.
- **Inloggen met e-mail en wachtwoord, niet met LinkedIn.** LinkedIn-OAuth gaat via de systeembrowser en keert niet terug naar de app-sessie; de deep-link-terugkoppeling is bewust niet gebouwd. `app/sign-in/AppSignIn.tsx` gebruikt `signIn.password()` (met `signIn.create()` werd het wachtwoord genegeerd). De gebruiker stelt het wachtwoord in op `arno.bot/bot/account` (alleen Pro en Team kregen dat oorspronkelijk; nu voor elk plan). Aanmelden in de app bestaat niet, alleen inloggen. De app opent direct op het inlogscherm (de homepage wordt overgeslagen via `NativeAppRedirect`).
- **App voor Basic, Pro en Team (besloten 2026-11-06).** Basic alleen met spraakinvoer, Pro en Team ook spraakuitvoer. **Verworpen:** alleen Pro en Team. Uitwerking in `docs/ABONNEMENTEN.md`.
- **Geen koop-, upgrade- of prijsverwijzingen in de app** (Google Play-betalingsbeleid): `hooks/useIsNativeApp.ts` en `app/components/HideInNativeApp.tsx` verbergen Analyses, Coaching, de proefperiodebalk, referral, de upgrade- en doorgaanpagina en de bijbehorende Q&A-groepen. Bewust niet verborgen: ABONNEMENT OPZEGGEN op de accountpagina (opzeggen moet kunnen). De app is inloggen en gebruiken; alles rond betalen leeft op de website.
- **Geen uitlogknop in de app** (bewust). Account wisselen kan via Android Instellingen, Apps, ArnoBot, Opslag, Gegevens wissen.
- **De versiebalk "Er is een nieuwe versie" is verborgen in de app** (`VersionBanner.tsx`): de app laadt altijd live en de balk overlapte de systeemknoppen.
- **Google Play-account omgezet van Privé naar Organisatie** (2026-11-05). Gekozen omdat het publieke adres dan het zakelijke adres (Verdunplein 17, 5627 SZ Eindhoven) is in plaats van het privéadres, en omdat organisatieaccounts buiten de testersvoorwaarde voor productie vallen. **Verworpen:** privéaccount houden met een aangepast adres. Google eiste de handelaarsverklaring uiterlijk 1 februari 2027, dat is gedaan. Het 12-testers-traject is daarmee vervallen; de Alpha-track is gestopt.
- **Beheerd publiceren staat uit:** na goedkeuring staat de app meteen in de Store.
- **Splash op Android 12 en hoger:** het systeem toont tijdens het opstarten alleen het icoon op de achtergrondkleur; `splash.png` en de plugin-opties gelden daar niet (alleen Android 11 en lager). Gekozen: het systeem-icoon verbeteren (`windowSplashScreenAnimatedIcon` is `drawable-xxxhdpi/splash_icon.png`, AB in een lichte cirkel `#1f2937` op `#111827`). **Verworpen:** een eigen native overlay met woordmerk (meer code, nog een build). Het app-icoon is een zwaar, breed AB (Arial Black), A wit en B amber. **Verworpen:** Bebas Neue (minder robuust), witte cirkel, amber rand. Het Store-icoon (`public/arnobot-app-icon-512.png`) moet apart in Play Console worden geüpload.

## Werkwijze

- **Webcode** (menu, layout, teksten, chat): push naar master, direct live in de app, geen Play-update nodig.
- **Native schil** (permissies, icoon, plugins, `versionCode`, `capacitor.config.ts`): nieuwe AAB bouwen (`npm run cap:sync`, dan in Android Studio Build, Generate Signed App Bundle), uploaden in Play Console en wachten op de beoordeling. Android-wijzigingen worden dezelfde dag op master gecommit.
- De app heeft **twee kopimplementaties** (`BotNav.tsx` en de kop in `SparClient.tsx`). Wijzig altijd beide, zie het punt over de statusbalk hieronder.

## Geleerd tijdens de bouw

- **Microfoon:** Capacitor's `BridgeWebChromeClient` vraagt voor `getUserMedia({audio})` zowel `RECORD_AUDIO` als `MODIFY_AUDIO_SETTINGS`. Ontbrak de tweede, dan hing de opname stil zonder permissievraag. Beide staan nu in `AndroidManifest.xml`.
- **Statusbalk:** targetSdk 36 is edge-to-edge. `env(safe-area-inset-top)` en `--safe-area-inset-top` zijn in de app 32px; zowel `BotNav.tsx` als de kop in `SparClient.tsx` hebben safe-area-padding nodig.
- **App-wachtwoord:** de accountpagina (TOON en VERBERG) zet het wachtwoord via Clerk's backend (`updateUser`). Clerk-instellingen: minimaal 8 tekens, "Reject compromised passwords" aan, geen sterkteregels. Een geweigerd wachtwoord zonder hoofdletter was dus een lek-afwijzing, geen hoofdletter-eis. Een ingesteld wachtwoord kan nooit worden teruggezien, alleen opnieuw ingesteld.
- **Autoplay:** mobiele webviews blokkeren `audio.play()` zonder directe gebruikersactie. Het afspelen van voice-antwoorden start daarom binnen de tik die het antwoord vraagt, met een afspeelknop als vangnet (zie `docs/CLAUDE_HISTORY.md`, voice-plan).
- **Accountverwijdering:** Google Play heeft sinds 2023 een eigen eis dat een gebruiker zijn account vanuit de app of via een webpagina kan laten verwijderen (net als Apple 5.1.1(v)). De route `/api/bot/delete-account` bestaat; niet geverifieerd of de Play Console-verklaring en de gelinkte pagina hieraan voldoen.
- **Store-vermelding:** vereist privacybeleid-link, screenshots, beschrijving en het Data Safety-formulier. Alles staat in Play Console.

## Risico: microfoontoegang binnen een Capacitor-webview

De opname loopt via `getUserMedia()` in `SparClient.tsx` en werkt in de WebView alleen met de permissies hierboven. Geverifieerd op een fysiek Android-toestel met versie 1.0.1 en later. Een iPhone-WebView kan zich anders gedragen, zie `docs/IOS_INDIENEN.md`.

## Relevante code

- **Configuratie:** `capacitor.config.ts` (appId `arno.bot`, appName ArnoBot, `server.url`, `server.allowNavigation`), `android/` (native projectskelet).
- **Inloggen:** `app/sign-in/AppSignIn.tsx`, de branch in `app/sign-in/[[...sign-in]]/page.tsx` (`Capacitor.isNativePlatform()`), wachtwoord instellen op `app/bot/account/page.tsx`.
- **Verbergen in de app:** `hooks/useIsNativeApp.ts`, `app/components/HideInNativeApp.tsx`, `VersionBanner.tsx`, `NativeSplashHide.tsx`.
- **Microfoon:** `app/bot/SparClient.tsx` (`startRecording` en `stopRecording`), permissies in `android/app/src/main/AndroidManifest.xml`.
- **App-toegang voor testers:** het interne testaccount staat in `lib/internalTestAccounts.ts`.

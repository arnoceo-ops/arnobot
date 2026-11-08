# Pushmeldingen (Android eerst, iOS later)

**Laatst bijgewerkt:** 2026-11-08 (herzien na een onafhankelijke controle van het plan tegen de code)

**Waar we staan:** plan geschreven en gecontroleerd, nog niets gebouwd. De Android-app (1.0.4, versionCode 5) heeft geen pushmeldingen: geen `@capacitor/push-notifications`, geen Firebase-configuratie, geen `google-services.json`. Wel staat de standaardhaak voor Firebase al in `android/app/build.gradle` (regels 48 tot 53) en `android/build.gradle`: zodra `google-services.json` er ligt, wordt de plugin toegepast. Op de website bestaat geen web-push; alleen de meldingenbel voor managers (`arnobot_team_notifications`).

**Eerstvolgende stap (Arno):** Fase 0, een Firebase-project, `google-services.json` en een servicesleutel (zie het eind van dit document). De serverkant kan ik zonder dat al bouwen, testen kan pas daarna.

**Besluiten en verworpen alternatieven (2026-11-08):**
- Gekozen: **Android eerst**; het ontwerp (tokentabel met platformkolom, verzendlaag per platform) is zo dat iOS het later hergebruikt.
- Gekozen: **FCM met de Admin SDK** (`firebase-admin`, Node-runtime, niet Edge) op Vercel, met de servicesleutel als geheime omgevingsvariabele. Verworpen: REST-aanroepen met zelf geminte tokens, want die kennen geen batchverzending (`sendEach`, tot 500) en vragen meer eigen code. De oude FCM-API is niet onderzocht en wordt niet gebruikt.
- Gekozen: **notificatieberichten** (door het systeem getoond, ook bij een gesloten app). Verworpen: alleen data-berichten, want de plugin roept `pushNotificationReceived` niet aan bij een gesloten app.
- Gekozen: **alle triggers lopen via één wachtrij en één verzend-cron** (zie Ontwerp). Verworpen: elke bestaande cron zelf laten pushen, want die draaien allemaal tussen 03:00 en 04:05 UTC (midden in de nacht) en kennen geen tijdzone, frequentielimiet of dubbele-verzendbewaking.
- Gekozen: **alleen dienstmeldingen** in de eerste versie. Verworpen: de wegblijf-nudge als push, want dat is een marketingbericht naar iemand die al weg is [Apple 4.5.4 en het Google-beleid zijn niet gelezen, controleren vóór de eerste release met meer dan dienstmeldingen].
- Gekozen: **toestemming op een moment van waarde** plus schakelaars per type, alleen zichtbaar in de app.
- Gekozen: **vaste stille uren in Europe/Amsterdam** (21:00 tot 08:00), geen tijdzone per gebruiker. Niemand heeft nu een tijdzonekolom en de gebruikers zitten vooral in Nederland.
- Verworpen: webpush/service worker (de app is een WebView, de native route is die van Capacitor).

**Afvinklijst:**
- [ ] Fase 0, Arno: Firebase-project, `google-services.json`, servicesleutel in Vercel
- [ ] Fase 1, server: SQL in `docs/sql/` met datumprefix (tokens, voorkeuren, wachtrij met unieke dedupe-sleutel, allemaal RLS aan), `lib/push.ts`, API-routes met eigen toegangscontrole, verzend-cron, tests met een nagebootste FCM (foutcodes `UNREGISTERED` en `INVALID_ARGUMENT`), CI-scripts uitbreiden
- [ ] Fase 2, client: plugin, `isPluginAvailable`-guard, registratie bij elke start, gedeelde uitloghelper, kanaal en icoon, schakelaars in account, teksten door Arno goedgekeurd
- [ ] Fase 3: eerste trigger end-to-end op een echt toestel (gesloten app, achtergrond, voorgrond, tik opent de juiste pagina)
- [ ] Fase 4: overige triggers; accountverwijdering en `data-cleanup` dekken tokens; privacyverklaring en Play "Data safety" (eerst als voorstel aan Arno); `lib/appHelp.ts`, Q&A, ARNOBOT_OVERZICHT, TECHNICAL_HANDOVER; maandcheck en capaciteitswacht
- [ ] Fase 5: Android 1.0.5 (versionCode 6) bouwen, intern testen, Play Console-release, controle
- [ ] Fase 6: iOS hergebruik (zie `docs/IOS_INDIENEN.md`)

## Wat er stuurt (correctie van de eerste versie van dit plan)

De drie bestaande crons zijn **geen** geschikte pushmomenten, zoals de controle in de code liet zien:
- `auto-analyse` draait om 04:05 UTC over alle gebruikers met sessies, zonder filter op `is_active`, verloop of `nudge_opt_out`.
- `uitdaging-herinnering` is een wegblijf-mail op +1, +3 en +7 dagen na een sessie (alleen als de gebruiker niet terugkwam), geen "gedachte van de dag".
- `team-1on1-ritme` maakt de meldingenbel en een mail na 48 uur, zonder opt-outcontrole en zonder testaccountfilter.

Daarom per melding een eigen trigger die een rij in de wachtrij zet; de verzend-cron bepaalt het moment:
1. **Analyse klaar**: de trigger is het moment dat een analyse is opgeslagen (ook de nachtelijke batch), niet de batch zelf. Tekst algemeen: "Je nieuwe analyse staat klaar." Tik opent Analyses.
2. **Teamritme voor managers**: wanneer de bestaande `arnobot_team_notifications`-rij voor een manager wordt aangemaakt, ook een wachtrijrij. Let op: managers in meerdere teams en `command_manager`.
3. **Gedachte van de dag**: zit in `app/api/bot/uitdaging` (nog niet gelezen) en krijgt een eigen trigger of cron; pas bouwen nadat ik die route heb gelezen en de toonafspraak (inspireren, nooit verhoor) in de tekst is gewaarborgd.

Geen gesprekinhoud in de meldingstekst (zichtbaar op het vergrendelscherm).

## Ontwerp

**Wachtrij en verzenden:**
- Tabel `arnobot_push_wachtrij` met `user_id`, `type`, `data`, `verzenden_na`, `dedupe_sleutel` (UNIQUE, naar het patroon van `arnobot_uitdaging_reminders_log`), `verzonden_op`. Een verzend-cron elke 15 minuten buiten de minuten :00/:15/:30/:45 (Firebase raadt af precies op die tijden te sturen [bron niet vastgelegd]) respecteert de stille uren, maximaal één melding per gebruiker per dag met voorrang per type, en filtert op `is_active`, verloopdatum, het voorkeurstype en interne testaccounts (`lib/internalTestAccounts.ts`, `isInternalTestUser`).
- Interne testaccounts blijven uitgesloten, **behalve** het Play-reviewer-account dat de toestemming moet kunnen doorlopen: te beslissen bij Fase 3 of dat account ook echt meldingen mag krijgen.
- Voorkeur: de bestaande `approved_users.nudge_opt_out` blijft voor mails en wegblijf-nudges; pushvoorkeuren krijgen een eigen kolom per type, zodat een mail-opt-out push niet stilzwijgend meeneemt. Te bevestigen met Arno.
- Verzenden via `lib/push.ts` (Admin SDK `sendEach`). Bij `UNREGISTERED` (404) of `INVALID_ARGUMENT` (400, alleen bij een geldige payload) het token verwijderen. Hoge prioriteit, kanaal-id in de payload. Retry: 429 wacht `retry-after` (standaard 60 seconden), 500 met exponentiële backoff, 400/401/403/404 niet herhalen. Tellers en fouten via de capaciteitswacht (`lib/capaciteit.ts`) en `notifyCronFailure`.

**Tokens:**
- Tabel `arnobot_push_tokens`: `user_id`, `token` (uniek), `platform`, `app_versie`, `aangemaakt_op`, `laatst_gezien_op`, `uitgeschakeld_op`. Upsert op token. Alle queries met `user_id`-filter; de scripts `check-missing-user-filter.mjs`, `check-testaccount-filter.mjs`, `check-orphan-routes.mjs`, `check-cron-mail-dedupe.mjs` en `check-mail-send.mjs` moeten het nieuwe verzendpad dekken of bewust uitsluiten.
- **De API-routes `/api/bot/push/*` vallen buiten de toegangspoort van `proxy.ts`** (die beschermt alleen `/bot`). Elke route controleert zelf `auth()` én actief en niet verlopen (`lib/toegang.ts`); de verzendlaag controleert hetzelfde per ontvanger.
- Accountverwijdering: `app/api/bot/delete-account/route.ts` stuurt nu een mail met een handmatige lijst tabellen, en `data-cleanup` ruimt op; beide moeten `arnobot_push_tokens` en de wachtrij noemen. Anders blijft er een apparaat-ID van een verwijderde gebruiker achter.

**Client** (alleen binnen de app):
- Pakket `@capacitor/push-notifications`; de Capacitor-8-documentatie geeft geen versietabel, kies bij `npm install` de versie die bij `@capacitor/core` 8.4.2 past [niet geverifieerd]. De remote pagina importeert het pakket, dus het moet in de web-bundel zitten én in `android/` zijn gesynct. **Gebruikers op 1.0.4 laden de nieuwe webcode maar hebben de plugin niet:** altijd `Capacitor.isPluginAvailable('PushNotifications')` controleren.
- Volgorde (Capacitor-documentatie): `checkPermissions()`, bij `prompt` een `requestPermissions()`, alleen bij `granted` een `register()`. Daarna bij **elke app-start** opnieuw `register()` (FCM-tokens kunnen roteren) en het token opnieuw aan de ingelogde gebruiker koppelen. Bij een geweigerde toestemming: een rustige uitleg met een knop naar de systeeminstellingen; na twee weigeringen toont Android geen prompt meer.
- Listener `registration` geeft op Android het FCM-token, door naar `POST /api/bot/push/registreer`. Listener `pushNotificationActionPerformed`: alleen paden binnen onze eigen site (allowlist), geen vrije URL.
- Kanaal in code aanmaken (`createChannel`, bijvoorbeeld `arnobot_algemeen`) met hetzelfde id in de payload en als standaard in de manifest. Pushicoon wit op transparant via `com.google.firebase.messaging.default_notification_icon`. Na `cap sync` controleren dat `POST_NOTIFICATIONS` in de samengevoegde manifest staat (nu staan er alleen INTERNET, RECORD_AUDIO en MODIFY_AUDIO_SETTINGS).
- **Uitloggen:** er is geen centraal punt, `signOut` staat in `BotNav.tsx`, `SparClient.tsx` (drie plekken, waaronder een automatische na 7 seconden) en `account/page.tsx`. Eén gedeelde helper die eerst het token server-side verwijdert (`unregister()` plus API-aanroep) en dan pas `signOut` doet, op al die plekken. Bij sessieverloop zonder client-aanroep helpt dat niet: vangnetten zijn de upsert bij de volgende registratie, tokenverwijdering bij FCM-fouten, en alleen sturen naar actieve gebruikers. Er blijft een **venster** waarin een volgende gebruiker op hetzelfde toestel een melding voor de vorige kan zien; dat is een privacyrisico op het vergrendelscherm en de reden dat de teksten algemeen blijven.
- `android/.gitignore` heeft `google-services.json` uitgecommentarieerd, dus het bestand komt in git zodra het in `android/app/` staat. Het bevat geen geheimen, maar wees bewust: besluit bij Fase 0.

## Risico's en wat nog niet geverifieerd is

1. **Plugin vanuit een remote pagina.** Capacitor documenteert dit niet. Plugins gaan via de native bridge; het patroon bestaat al (`SplashScreen` en `@capacitor/core` worden vanuit de remote pagina gebruikt in `NativeSplashHide.tsx` en de inlogpagina). CSP raakt de bridge vermoedelijk niet. Een toestel moet het bewijzen (Fase 3).
2. **Tik op een melding bij een gesloten app** opent de juiste pagina: niet gevonden in de documentatie, expliciet testen.
3. **Firebase is Google.** In het geheugen staat het project "Google elimineren". Android-push loopt via FCM; een Play-store-app heeft daarvoor geen alternatief dat ik gevonden heb (niet onderzocht). Uit de Firebase-pagina's gelezen op 2026-11-08: Google is verwerker onder de Firebase-verwerkersvoorwaarden (pagina laatst gewijzigd 21 augustus 2024), verwerking kan in elk land met Google-vestigingen, geen regionale FCM-optie gevonden, overdracht onder het EU-VS Data Privacy Framework, installatie-ID's blijven bewaard tot een verwijdering wordt gevraagd en verwijdering kan tot 180 dagen duren. Bronnen: firebase.google.com/terms/data-processing-terms en firebase.google.com/support/privacy. **Arno beslist dat dit past.** De privacyverklaring moet Google/Firebase als verwerker gaan noemen, eerst als voorstel.
4. **Deprioritering:** Firebase kan hoge-prioriteitsberichten die geen zichtbare melding opleveren later minder prioriteit geven (gedrag over 7 dagen, bron: Firebase-pagina over berichtprioriteit). Elk bericht moet dus een echte, zichtbare melding zijn.
5. **Tokenverloop en quota:** de getallen (270 dagen inactiviteit voor Android, "stale" na een maand, 600K per minuut per project, gratis) komen uit de Firebase-pagina's maar zijn niet los gecontroleerd. Geen zorg voor ons volume, maar niet als harde ontwerpwaarde gebruiken.
6. **iOS-route** nog niet beslist: de plugin geeft op iOS het APNs-token, geen FCM-token. Via FCM (Firebase iOS SDK nodig, niet in de Capacitor-documentatie genoemd) of direct via APNs: beslissen bij Fase 6.
7. **Appstore-beleid voor push** en het **Play "Data safety"-formulier** (apparaat-ID's en pushtokens moeten daar worden opgegeven): nog niet gelezen, in Fase 4 en 5.
8. **Meerdere toestellen per gebruiker:** alle tokens krijgen de melding, met een `tag` zodat ze niet stapelen; de dedupe-sleutel voorkomt dubbele cronruns.

## Wat ik van Arno nodig heb (Fase 0)

1. Een Firebase-project op <https://console.firebase.google.com> (eigen Google-account, bij voorkeur een zakelijk).
2. Daarin een Android-app registreren met pakketnaam `arno.bot` (staat in `capacitor.config.ts` en `build.gradle`).
3. `google-services.json` downloaden en in `android/app/` zetten, of aan mij geven.
4. Onder Projectinstellingen, Serviceaccounts, een nieuwe privésleutel genereren en de JSON-inhoud als `FIREBASE_SERVICE_ACCOUNT` in Vercel zetten (niet in git, niet in de chat plakken).
5. Cloud Messaging API aanzetten in de Firebase-console.
6. Goedkeuring van de meldingstypes en de teksten (Fase 2).

Ik loop Arno door deze stappen heen zodra hij begint.

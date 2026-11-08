# Pushmeldingen (alleen iOS)

**Laatst bijgewerkt:** 2026-11-08

**Waar we staan:** plan herschreven, nog niets gebouwd. Er is geen iOS-project en geen Apple-account. De Android-app (1.0.4) blijft ongewijzigd en krijgt geen push. Deze versie van het plan vervangt het eerdere Android-plan met Firebase.

**Eerstvolgende stap (Arno):** inschrijven bij het Apple Developer Program als Individual (zie `docs/IOS_INDIENEN.md`): de APNs-sleutel voor push komt uit dat account, en de goedkeuring kan weken duren. De serverkant kan ik intussen al bouwen en met tests controleren.

**Besluiten en verworpen alternatieven (2026-11-08):**
- Gekozen: **alleen iOS**, rechtstreeks via **APNs** met een authenticatiesleutel (.p8). De Capacitor-plugin geeft op iOS het APNs-token ("On iOS it contains the APNS token", Capacitor 8-documentatie), dus Firebase is niet nodig. Verworpen: Firebase Cloud Messaging en push op Android. Redenen: de gebruikerswaarde van push is dun (zie hieronder), Android is al goedgekeurd zonder push, en FCM is Google, wat past slecht bij het project "Google elimineren". Het Firebase-onderzoek van 2026-11-08 (FCM HTTP v1, tokenverloop, verwerkersvoorwaarden) staat in de git-geschiedenis van dit bestand (commit 1047fbde) en is hergebruikbaar als Android ooit push krijgt.
- Gekozen: **de reden voor push is Apples webwrapper-regel 4.2**, niet een gebruikersbehoefte. Dat bepaalt de omvang: weinig meldingen, nooit opdringerig, en waar iemand de app met meldingen aan heeft **één kanaal per gebeurtenis** (push in plaats van mail, nooit beide) [dit laatste nog door Arno te bevestigen].
- Gekozen: **alleen dienstmeldingen**, twee typen in de eerste versie: "analyse klaar" en het teamritme voor managers. Verworpen: de wegblijf-nudge als push (marketing naar iemand die al weg is) en de gedachte van de dag (route `app/api/bot/uitdaging` nog niet gelezen, toon-afspraak eerst veiligstellen). Apple 4.5.4 en de APNs-documentatie zijn nog niet gelezen: lezen vóór Fase 1.
- Gekozen: **alle triggers via één wachtrij en één verzend-cron** met vaste stille uren in Europe/Amsterdam (21:00 tot 08:00), maximaal één melding per gebruiker per dag. Verworpen: de bestaande crons zelf laten pushen, want die draaien tussen 03:00 en 04:05 UTC en kennen geen opt-out of tijdzone.
- Gekozen: **toestemming op een moment van waarde**, met een rustige uitleg bij weigering; schakelaars per type in het account.

**Afvinklijst:**
- [ ] Apple Developer Program ingeschreven, APNs-sleutel (.p8) aangemaakt, als geheime omgevingsvariabele in Vercel
- [ ] APNs-documentatie en Apple 4.5.4 gelezen; keuze verzendbibliotheek (bijvoorbeeld een bestaand APNs-pakket of Node `http2` met een JWT) vastgelegd
- [ ] Fase 1, server: SQL in `docs/sql/` met datumprefix (tokens, voorkeuren, wachtrij met unieke dedupe-sleutel, RLS aan), `lib/push.ts`, API-routes met eigen toegangscontrole, verzend-cron, tests met een nagebootste APNs, CI-scripts uitbreiden
- [ ] Fase 2, client (zodra het iOS-project bestaat): plugin, registratie bij elke start, gedeelde uitloghelper, schakelaars in account, teksten door Arno goedgekeurd, `AppDelegate.swift` en Push Notifications-capability
- [ ] Fase 3: eerste trigger end-to-end op een echte iPhone (gesloten app, achtergrond, voorgrond, tik opent de juiste pagina)
- [ ] Fase 4: accountverwijdering en `data-cleanup` dekken tokens; privacyverklaring (eerst als voorstel aan Arno); `lib/appHelp.ts`, Q&A, ARNOBOT_OVERZICHT, TECHNICAL_HANDOVER; maandcheck en capaciteitswacht
- [ ] Meegenomen in de iOS-indiening (Notes for Review noemen pushmeldingen als native functie)

## Wat de meldingen betekenen voor een gebruiker

Gebruikers krijgen al meerdere mails (proefperiode, wegblijfherinneringen, analyse-mail, patroon-samenvatting). Een push erbovenop is ruis. Daarom vervangt push de mail voor dezelfde gebeurtenis waar iemand de app met meldingen aan heeft, en blijft de mail het kanaal voor iedereen die dat niet heeft. Meldingen zijn kort, algemeen (geen gesprekinhoud op het vergrendelscherm) en standaard alleen aan na toestemming.

## Triggers

Per melding een eigen trigger die een wachtrijrij maakt; de verzend-cron bepaalt het moment.
1. **Analyse klaar:** het moment dat een analyse is opgeslagen (ook de nachtelijke batch `auto-analyse`, die om 04:05 UTC draait zonder filter op `is_active`, verloop of `nudge_opt_out`), niet de batch zelf. Tik opent Analyses.
2. **Teamritme voor managers:** wanneer de `arnobot_team_notifications`-rij voor een manager wordt aangemaakt (`team-1on1-ritme`). Let op managers in meerdere teams en `command_manager`.

## Ontwerp

**Wachtrij en verzenden:**
- Tabel `arnobot_push_wachtrij`: `user_id`, `type`, `data`, `verzenden_na`, `dedupe_sleutel` (UNIQUE, naar het patroon van `arnobot_uitdaging_reminders_log`), `verzonden_op`. De verzend-cron respecteert stille uren en één melding per dag, en filtert op `is_active`, verloopdatum, voorkeurstype en interne testaccounts (`lib/internalTestAccounts.ts`). Het reviewer-account voor Apple moet de toestemming kunnen doorlopen: beslissen bij Fase 3 of dat account echt meldingen mag krijgen.
- Voorkeur: `approved_users.nudge_opt_out` blijft voor mails; pushvoorkeuren krijgen een eigen kolom per type, zodat een mail-opt-out push niet stilzwijgend meeneemt.
- Verzenden via `lib/push.ts` rechtstreeks naar APNs. Ongeldige of afgemelde tokens (de APNs-foutreden daarvoor staat in de documentatie die nog gelezen moet worden) uit de tabel verwijderen. Tellers en fouten via de capaciteitswacht (`lib/capaciteit.ts`) en `notifyCronFailure`.

**Tokens:**
- Tabel `arnobot_push_tokens`: `user_id`, `token` (uniek), `platform`, `app_versie`, `aangemaakt_op`, `laatst_gezien_op`, `uitgeschakeld_op`. Upsert op token. Alle queries met `user_id`-filter; de scripts `check-missing-user-filter.mjs`, `check-testaccount-filter.mjs`, `check-orphan-routes.mjs`, `check-cron-mail-dedupe.mjs` en `check-mail-send.mjs` moeten het nieuwe verzendpad dekken of bewust uitsluiten.
- **De routes `/api/bot/push/*` vallen buiten de toegangspoort van `proxy.ts`** (die beschermt alleen `/bot`). Elke route controleert zelf `auth()` én actief en niet verlopen (`lib/toegang.ts`); de verzendlaag controleert hetzelfde per ontvanger.
- Accountverwijdering: `app/api/bot/delete-account/route.ts` stuurt een mail met een handmatige lijst tabellen en `data-cleanup` ruimt op; beide moeten de tokens en de wachtrij noemen.

**Client:**
- Pakket `@capacitor/push-notifications` op de versie die bij `@capacitor/core` 8.4.2 past [niet geverifieerd]. Op iOS moet de Push Notifications-capability aan staan en moet `AppDelegate.swift` de registratieresultaten doorgeven (Capacitor-documentatie); de Capacitor-plugin ondersteunt geen stille push op iOS.
- Volgorde: `checkPermissions()`, bij `prompt` een `requestPermissions()`, alleen bij `granted` een `register()`; daarna bij **elke app-start** opnieuw registreren en het token aan de ingelogde gebruiker koppelen. Bij weigering een rustige uitleg met een knop naar de instellingen.
- Listener `registration` geeft het APNs-token door aan `POST /api/bot/push/registreer`. Listener `pushNotificationActionPerformed`: alleen paden binnen onze eigen site (allowlist).
- **Uitloggen:** `signOut` staat in `BotNav.tsx`, `SparClient.tsx` (drie plekken, waaronder een automatische na 7 seconden) en `account/page.tsx`. Eén gedeelde helper die eerst het token server-side verwijdert en dan `signOut` doet. Bij sessieverloop zonder client-aanroep zijn de vangnetten: de upsert bij de volgende registratie, tokenverwijdering bij APNs-fouten, en alleen sturen naar actieve gebruikers. Er blijft een venster waarin een volgende gebruiker op hetzelfde toestel een melding voor de vorige kan zien; daarom blijven de teksten algemeen.

## Risico's en wat nog niet geverifieerd is

1. **Plugin vanuit een remote pagina** (de app laadt `https://www.arno.bot/bot`): Capacitor documenteert dit niet. Het patroon bestaat al voor andere plugins in de remote pagina (`NativeSplashHide.tsx`, de inlogpagina), maar op iOS moet een echte iPhone het bewijzen (Fase 3).
2. **Tik op een melding bij een gesloten app** opent de juiste pagina: niet gedocumenteerd gevonden, testen.
3. **Aanmeldingskosten voor Apple:** geen push zonder Apple Developer-account, een echte iPhone en een eerste TestFlight-build. Het eerste echte testmoment valt dus laat; de serverkant is wel zonder die dingen met tests af te dekken.
4. **Apple 4.5.4 en de APNs-documentatie** zijn nog niet gelezen; de verzendbibliotheek en de foutafhandeling hangen daarvan af.
5. **Privacy:** Apple (APNs) wordt een verwerker van apparaattokens. De privacyverklaring en het App Store Connect-voedingslabel moeten dat noemen, eerst als voorstel aan Arno.
6. **Push redt de webwrapper-regel niet automatisch:** Apple noemt geen lijst van wat telt. Het is meerwaarde voor de review, geen garantie.

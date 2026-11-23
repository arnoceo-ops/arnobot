# Admin op de telefoon (`/bot/admin/mobiel`)

**Laatst bijgewerkt:** 2026-11-23 (avond)

**Waar we staan:** klaar voor gebruik op Arno's Android. Inlog, manifest (id `/admin-mobiel-2`), icoon (herkleurd ArnoBot-logo, `-v2-`) en de vijf kaarten staan op master (laatste commit `e4191eca`). Op de telefoon is de app geïnstalleerd met het nieuwe icoon (bevestigd door Arno met een screenshot van het appoverzicht, 2026-11-23, na het wissen van de Chrome-cache voor afbeeldingen). Wat nog niet is nagelopen: of de cijfers op de kaarten kloppen met de pc-pagina, en of inloggen met LinkedIn binnen de geïnstalleerde app goed gaat na afloop van de Clerk-sessie.

**Eerstvolgende stap (Arno):** de kaarten een paar dagen gebruiken en melden wat ontbreekt of niet klopt. De oude admin-app (met het smalle icoon en ADMIN-label) verwijderen als die er nog naast staat. In het Clerk-dashboard (Sessions) kijken hoe lang een sessie duurt, want dat bepaalt hoe vaak opnieuw inloggen nodig is.

**Besluiten en verworpen alternatieven (2026-11-23):**
- Gekozen: **PWA op `/bot/admin/mobiel`**, alleen Android, alleen Arno. Verworpen: de admin in de bestaande store-app (reviewrisico, elke gebruiker draagt de code mee) en een aparte Capacitor-app (tweede app-ID, ondertekening, iOS-review, pas zinvol voor push en Telegram doet dat al).
- Gekozen: **eigen inlog via Clerk**, los van het oude admin-wachtwoord, alleen het account `FOUNDER_USER_ID` (`linkedin@royaldutchsales.com`) met een geverifieerde LinkedIn-koppeling. De 2FA zit bij LinkedIn (Arno bevestigde dat die aan staat) en is door Clerk niet te controleren. Verworpen: Clerk-2FA of passkey afdwingen, want de app heeft geen Clerk-profielscherm om dat aan te zetten en dat bouwen hoort niet bij deze klus. Verworpen: de cookie van het oude slot korter maken (laat het structurele probleem staan).
- Gekozen: **het wachtwoord van het LinkedIn-account is verwijderd in Clerk** (gedaan door Arno, `password_enabled: false` bevestigd via de API). Daardoor is het wachtwoordvak op `/sign-in` voor dit account dicht. Niet uit te sluiten vanaf hier: of de Clerk-instelling zelf nog een mailcode toestaat. Clerk geeft niet door met welke methode een sessie is gestart.
- Gekozen: **het manifest als eigen route** (`mobiel/manifest.webmanifest/route.ts`) en expliciet gekoppeld in `mobiel/layout.tsx`. Verworpen: de `manifest.ts`-conventie van Next in een submap, want die werkt alleen in de hoofdmap van `app/` (gemeten 2026-11-23: 404, Chrome maakte daardoor alleen een gewone snelkoppeling met het standaardicoon). Les: na elke wijziging aan manifest of icoon de URL met curl ophalen en de `<link rel="manifest">` in de pagina controleren.
- Gekozen: **manifest met `scope: '/'`**, zodat de inlog (`/sign-in`, LinkedIn) in hetzelfde appvenster blijft. Verworpen: scope alleen `/bot/admin/mobiel`, want dan opent Chrome de inlogstappen buiten de app.
- Gekozen: **het icoon is het gewone ArnoBot-logo, herkleurd** (amber achtergrond, witte A, donkere B), exact dezelfde lettervormen via `scripts/maak-admin-icoon.mjs` uit `public/arnobot-app-icon-source.png`. Voorstel van Arno, 2026-11-23. Verworpen: eigen ontwerp met Bebas Neue en een klein ADMIN-label (Arno: "schrikbarend slecht", de letters weken af van het merk), een variant met donkere achtergrond (lijkt te veel op de gewone app) en een zonder tekst.
- Les (2026-11-23): na een wijziging aan het icoon een **nieuwe bestandsnaam** gebruiken (nu `-v2-`) en het manifest op `no-cache` zetten. Arno zag na opnieuw installeren nog het vorige icoon terwijl het live bestand al gelijk was aan het nieuwe (md5 vergeleken); een telefoon bewaart een icoon onder dezelfde naam hardnekkig. Een geïnstalleerde app (WebAPK) verwijder je via het appoverzicht (lang indrukken, App-info, Verwijderen), niet alleen van het startscherm.
- Oorzaak en oplossing van het oude icoon (2026-11-23): de site was goed, alle oude icoon-URL's gaven 404 en het nieuwe bestand en manifest waren live, maar het installatievenster op de telefoon bleef het oude icoon tonen. Chrome op de telefoon had het in zijn cache. Opgelost door in Chrome alleen "Gecachte afbeeldingen en bestanden" te wissen (hele periode, geen cookies of wachtwoorden) en daarna opnieuw te installeren. Bij een icoonwijziging dus: nieuwe bestandsnaam, manifest op `no-cache`, en zo nodig die cache op de telefoon wissen. Het nieuwe manifest-`id` hieronder bleek niet de doorslag, maar blijft staan.
- Gekozen (2026-11-23): **nieuw manifest-`id` (`/admin-mobiel-2`)** nadat een nieuwe bestandsnaam voor het icoon niet genoeg was. De site was aantoonbaar goed (ingelogd gecontroleerd: manifest 200, v2-iconen), maar de telefoon bleef de oude installatie tonen, `chrome://webapks` bleek niet bereikbaar. Een nieuw `id` is voor Chrome een andere app. Verworpen: blijven gokken waar de oude installatie vastzit.
- Gekozen: **geen service worker en geen offline-opslag.** Bedrijfs- en gebruikersdata hoort niet in een cache. De installeerbaarheid op Android is gebaseerd op web.dev (install criteria, geen datum zichtbaar op de pagina), die geen service worker meer noemt. Een Chrome-blogsnippet noemde er eerder wel een; dat is niet getoetst op een echte telefoon.
- Gekozen: **geen aparte push.** Telegram doet dat al. Verworpen: Web Push (kan op Android en iOS, maar voegt een tweede meldkanaal toe).
- Gekozen: **waarheidscontrole op de telefoon toont alleen de laatste mail en de patroontelling** (`lib/gedragspatronen.ts`, geen AI). Verworpen: de steekproef live berekenen, want dat kost bij elke paginalading AI-aanroepen. Er wordt geen resultaat opgeslagen.
- Gekozen: **een eigen route voor "beoordeeld"** (`/api/admin/mobiel/beoordeeld`) met de Clerk-controle. Verworpen: de pc-route `/api/admin/offtopic-flags` hergebruiken, want die werkt met het oude wachtwoord en is voor de telefoon niet bereikbaar.
- Gekozen: **de pc-admin blijft ongewijzigd** en blijft de volledige dashboards. De telefoonpagina is een uitsnede ernaast. De berekening van proefdagen staat daarom een tweede keer in `lib/adminMobielLogica.ts` (spiegel van `dagenTotEinde` en `proefDagenOver` in `app/bot/admin/gebruikers/page.tsx`). Wijzig je de regel op de ene plek, wijzig hem op de andere ook.

**Afvinklijst:**
- [x] Inlog: alleen `FOUNDER_USER_ID` met LinkedIn (`lib/adminMobiel.ts`, 4 tests)
- [x] Wachtwoord van het LinkedIn-account in Clerk verwijderd
- [x] Manifest en eigen icoon (`mobiel/manifest.webmanifest/route.ts`, `public/admin-icoon-v2-192.png` en `-512.png` (gemaakt met `scripts/maak-admin-icoon.mjs`))
- [x] Kaarten: te beoordelen, status, gebruikers, kosten, waarheidscontrole
- [x] Actie "beoordeeld" via eigen route
- [x] Automatisch verversen bij terugkeren in de app, verversknop
- [x] `TECHNICAL_HANDOVER.md` bijgewerkt
- [ ] Arno: kaarten nalopen op de telefoon, ontbrekende of onjuiste cijfers melden
- [ ] Arno: op Android toevoegen aan startscherm, icoon en inloggen in de geïnstalleerde app testen
- [ ] Kaart GEBRUIKERS en KOSTEN vergelijken met de pc-pagina `/bot/admin/gebruikers` (cijfers moeten overeenkomen)
- [x] Besluit: de kosten per gebruiker staan achter alleen het Clerk-slot (Abacus heeft een eigen wachtwoord). Arno zei ja op 2026-11-23.
- [ ] Verse controle aan het eind van de fase: een nieuwe sessie toetst dit document aan de code

**Open punten:**
- Of inloggen met LinkedIn werkt binnen de geïnstalleerde app (de OAuth-stappen moeten in het appvenster blijven). Niet gemeten.
- Waar de inlog je na afloop naartoe brengt. De bestaande inlogpagina bewaart een doel onder `/bot` (cookie `arnobot_na_inloggen`) en zou dus terug moeten komen op `/bot/admin/mobiel`. Niet gemeten.
- De ElevenLabs-stand toont alleen wat de eigen meting telt (kosten deze maand), niet het tegoed of de limiet van het account. Daarvoor is er geen aanroep in de code en het is niet uitgezocht of de API-sleutel daar rechten voor heeft.
- Een telling van fouten (Sentry) staat niet op de statuskaart. Fouten in crons staan er wel op.
- Het oude admin-slot (de cookie `arnobot_admin` bevat de sleutel zelf, 45 bestanden controleren hem zelf, een deel met een gewone `===`) is niet gerepareerd. Dat is een apart plan.
- `scripts/check-missing-user-filter.mjs` meldt `lib/gebruikerKosten.ts:82` (bestond al voor deze klus, niet door deze wijziging).

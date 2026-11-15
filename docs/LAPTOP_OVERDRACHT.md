# ArnoBot: werken vanaf een tweede werkplek (laptop, buitenland)

## Statusblok

- **Laatst bijgewerkt:** 2026-11-15
- **Waar we staan:** volledig herschreven op 2026-11-15, na de eerdere versie van juli. Verwijderd: de macOS-stappen (Arno gebruikt geen Apple), de Markdown PDF-extensie (PDF's maakt nu `npm run docs:pdf`) en de lijst met "openstaande bestanden" (de werkmap is schoon en op master). Toegevoegd: het Claude Code-geheugen en de gebruikersinstellingen (staan niet in git), de Android-keystore, tweestapsverificatie in het buitenland en een proefrun vóór vertrek.
- **Eerstvolgende stap:** de proefrun uit het onderdeel "Vóór vertrek" doen op de laptop, nog in Nederland, en de vinkjes daar afvinken.
- **Vertrekdatum:** nog niet bekend (Arno verwacht binnen enkele maanden te vertrekken).
- **Gekozen:** geheugen en keystore vlak vóór vertrek kopiëren; de overige configuratie uit Vercel en GitHub halen. **Verworpen:** een losse kopie van alle sleutels via mail of cloud-schijf, want dat is een extra plek waar alles tegelijk staat.

Voor de volledige lijst van externe diensten, env vars en waar sleutels vandaan komen: `docs/TECHNICAL_HANDOVER.md`, sectie "Externe diensten". Dit document dupliceert die lijst niet.

---

## Wat staat wel en wat staat niet in git

| Zit in git (komt mee met `git clone`) | Zit NIET in git (zelf meenemen of opnieuw ophalen) |
|---|---|
| Alle code, docs, `CLAUDE.md`, `.claude/commands/` | `.env.local` (secrets): ophalen via `vercel env pull` |
| De Android-projectmap `android/` | De Android-keystore `arnobot-release.jks`: kopiëren, zie hieronder |
| | Claude Code-geheugen (153 bestanden, ruim 700 KB): kopiëren |
| | Claude Code-gebruikersinstellingen: `~/.claude/settings.json` (met de GEDRAGSCHECK-hook) en `~/.claude/hooks/stop-lengte.js` |
| | `.claude/settings.json` en `.claude/settings.local.json` in de projectmap (toestemmingen, staan in `.gitignore`) |
| | `.vercel/` (de koppeling met het Vercel-project): opnieuw `vercel link` |

---

## Eenmalig op de laptop inrichten

### 1. Basistools

- [Node.js](https://nodejs.org) met dezelfde major-versie als op het bureau-apparaat (nu 24, check met `node -v`)
- [Git](https://git-scm.com)
- [GitHub CLI](https://cli.github.com): `winget install GitHub.cli`
- Vercel CLI hoeft niet geïnstalleerd te worden: `npx vercel` volstaat
- VS Code
- [Claude Code](https://claude.com/claude-code) (de VS Code-extensie of de CLI)
- Alleen als je tijdens het reizen een Android-release wilt bouwen: Android Studio (zie "Android-app")

### 2. Code ophalen

```
git clone https://github.com/arnoceo-ops/arnobot.git
cd arnobot
npm install
```

Houd de hoofdmap op `master`. Werk aan een andere tak in een aparte worktree (regel uit `CLAUDE.md`).

### 3. Eigen GitHub-login

Geen tokens of SSH-keys kopiëren vanaf het bureau-apparaat. Op de laptop apart inloggen:

```
gh auth login
```

Zo krijgt de laptop een eigen token. Bij verlies van de laptop trek je alleen dat ene token in.

### 4. Secrets ophalen

Rechtstreeks van Vercel, zodat Vercel de enige bron blijft:

```
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

Bij `vercel link`: kies het bestaande project `arnobot` (het Vercel-team waar de deploys onder staan), geen nieuw project. `.env.local` staat in `.gitignore` en wordt nooit meegecommit.

Waarom niet handmatig kopiëren: een kopie via mail, cloud-schijf of een los wachtwoordmanager-item is een extra plek waar alle sleutels tegelijk staan. Met `vercel env pull` hoef je op de laptop alleen het gh- en vercel-token in te trekken.

### 5. Beveiliging van de laptop zelf

Er staat straks een kopie van alle productiesleutels op de laptop. Dit is de belangrijkste stap tegen "laptop kwijt of gestolen onderweg":

- BitLocker aan (Instellingen, Privacy en beveiliging, Apparaatversleuteling)
- Schermvergrendeling met wachtwoord of pincode, niet alleen biometrisch
- Geen sleutels in een notitie, mail of chat; alleen `.env.local`

### 6. Claude Code overzetten (geheugen en instellingen)

Zonder deze stap start Claude Code op de laptop met een lege lei en zonder de gedragsregels die je nu gewend bent. Doe dit vlak vóór vertrek, anders loopt de kopie meteen weer achter. Het bevat geen secrets.

1. **Geheugen.** Open het project één keer in Claude Code op de laptop. Er ontstaat dan een map onder `C:\Users\<laptopnaam>\.claude\projects\`, met een naam die van het pad van de checkout is afgeleid (op het bureau-apparaat: `c--Users-arno-arnobot`). Kopieer de inhoud van `memory\` van het bureau-apparaat naar de `memory\`-map van die nieuwe projectmap. Kies bij voorkeur op de laptop dezelfde padstructuur (`C:\Users\<naam>\arnobot`), dan is de mapnaam voorspelbaar.
2. **Gebruikersinstellingen.** Kopieer `~/.claude/settings.json` (bevat de GEDRAGSCHECK-hook en de toestemmingen) en `~/.claude/hooks/stop-lengte.js` naar dezelfde plek op de laptop. Controleer daarna in `settings.json` of de paden in de hook-opdrachten op de laptop kloppen.
3. **Projectinstellingen.** Optioneel: `.claude/settings.json` en `.claude/settings.local.json` uit de projectmap (browserdomeinen en toegestane commando's). Zonder deze vraagt Claude Code gewoon opnieuw om toestemming.

### 7. Android-app (alleen nodig voor een nieuwe release)

De app laadt `arno.bot` van afstand. Bijna elke wijziging gaat dus live via een gewone push naar Vercel, zonder nieuwe app-release. Alleen voor een wijziging in `android/` (versiecode, manifest, iconen) of een Capacitor-update is een nieuwe build nodig.

- **De keystore `arnobot-release.jks`** staat buiten de repo en is nodig om een release te ondertekenen (alias `arnobot`, 25 jaar geldig, zie `docs/MOBILE_PLAN.md`). Zonder dit bestand kun je geen update van de bestaande app in de Play Store uitbrengen. Maak vóór vertrek een kopie op een tweede, versleutelde plek (wachtwoordmanager of versleutelde schijf), samen met het keystore-wachtwoord. Zet het bestand niet in git.
- Bouwen: `npm run cap:sync`, dan in Android Studio via Build, Generate Signed App Bundle. Android-wijzigingen worden dezelfde dag op master gecommit.
- Beslis vóór vertrek of je dit onderweg wilt kunnen. Zo niet, dan is de keystore-kopie nog steeds de verzekering.

### 8. Tweestapsverificatie en inloggen in het buitenland

Dit is de meest voorkomende oorzaak van "ik kom er niet meer in" tijdens reizen:

- Dashboards (GitHub, Vercel, Supabase, Clerk, Mollie, Anthropic, Resend, Upstash) vragen bij een nieuw land of apparaat om extra verificatie. **Log daarom vóór vertrek, in Nederland, op de laptop in bij elk dashboard dat je onderweg nodig kunt hebben**, zodat er al een vertrouwd apparaat en een sessie bestaat.
- Zorg dat je tweede factor onderweg bereikbaar is zonder je Nederlandse simkaart (authenticator-app in plaats van sms; bewaar herstelcodes versleuteld).
- Mollie-, Supabase- en bankdashboards kunnen een login uit het buitenland blokkeren of extra bevestigen. Test dit zo nodig vooraf.
- Meldingen (maandcheck, capaciteitswacht, Dependabot) komen via Telegram; zorg dat Telegram op je telefoon werkt met de buitenlandse verbinding.

---

## Hoe je op de laptop werkt

De werkwijze is dezelfde als thuis (regels in `CLAUDE.md` en het geheugen):

- **Geen lokale dev-server of build.** Controleer met `npx tsc --noEmit` en `npm test` (Vitest), push, en controleer daarna op Vercel. Op Windows: gebruik een hoofdletter in de schijfletter (`C:\...`), met `c:/` geeft Vitest een valse fout.
- **De Playwright E2E-tests** draaien in CI, niet lokaal; ze hebben testaccounts nodig.
- **Scripts in `scripts/`** (embedden, controles) gebruiken `.env.local` en praten met de productiedatabase. Draai ze alleen bewust.
- **PDF's van docs:** `npm run docs:pdf` werkt ook op de laptop (puppeteer wordt door `npm install` meegehaald).
- **SQL voor de database** staat in `docs/sql/` en wordt in het Supabase-dashboard gedraaid.

### Bij elke sessie (op elk apparaat)

Dit voorkomt dat de twee apparaten uit elkaar lopen:

1. Aan het begin: `git pull origin master`, en controleer `git status`.
2. Na elke afgeronde wijziging: committen én meteen pushen (`git push origin master`).
3. Faalt `git pull` door lokale wijzigingen: eerst `git status` bekijken, nooit blind `git reset --hard` of `git checkout .`.
4. **Het geheugen is per apparaat.** Nieuwe geheugenbestanden die op de laptop ontstaan, komen niet vanzelf terug op het bureau-apparaat. Belangrijke besluiten horen daarom ook in een plandocument of `docs/CLAUDE_HISTORY.md` (dat staat wel in git).

---

## Vóór vertrek: proefrun op de laptop (afvinklijst)

Doe dit minstens een week vóór vertrek, in Nederland, zodat je problemen thuis oplost.

- [ ] Laptop is versleuteld (BitLocker) en heeft een wachtwoordvergrendeling
- [ ] `git clone`, `npm install` en `node -v` kloppen met het bureau-apparaat
- [ ] `gh auth login` en `npx vercel login`, `vercel link`, `vercel env pull .env.local` gelukt
- [ ] `npx tsc --noEmit` en `npm test` slagen
- [ ] Claude Code start, het geheugen is zichtbaar (vraag het iets uit het geheugen) en de GEDRAGSCHECK-hook werkt
- [ ] Een kleine testwijziging (bijvoorbeeld een spatie in een doc) gecommit en gepusht, en de Vercel-deploy is gelukt
- [ ] Bij elk dashboard dat je onderweg nodig kunt hebben ingelogd op de laptop, tweede factor werkt zonder Nederlandse simkaart
- [ ] Keystore `arnobot-release.jks` en wachtwoord op een tweede versleutelde plek bewaard
- [ ] Vlak vóór vertrek: geheugen en `~/.claude`-instellingen opnieuw gekopieerd, `git status` op het bureau-apparaat schoon en alles gepusht

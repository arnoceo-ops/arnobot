# ArnoBot — overdracht naar een tweede werkplek (laptop)

Dit document is het stappenplan om vanaf een laptop hetzelfde werk aan ArnoBot te kunnen doen als vanaf het vaste bureau-apparaat: code wijzigen, testen, committen en pushen. Bedoeld voor gebruik tijdens reizen. Volg de stappen in volgorde bij het eerste keer inrichten van de laptop; daarna is alleen het gedeelte "Bij elke sessie" nog relevant.

Voor de volledige lijst van externe diensten, env vars en waar sleutels vandaan komen: zie `docs/TECHNICAL_HANDOVER.md`, sectie "Externe diensten". Dit document dupliceert die lijst niet, maar verwijst ernaar.

---

## Eenmalig op de laptop inrichten

### 1. Vóór je vertrekt: dit bureau-apparaat opschonen

Controleer op het bureau-apparaat of alle werk vastligt, zodat er niets tussen wal en schip valt:

```
git status
```

- Alles wat gewijzigd of nieuw is en behouden moet blijven: committen en pushen (`git push origin master`), of expliciet beslissen dat het lokaal blijft staan.
- Op het moment van schrijven staan er bewust nog een paar dingen open op het bureau-apparaat (zie sectie "Bekende openstaande punten" onderaan). Neem die mee in de afweging.

### 2. Basistools installeren op de laptop

- [Node.js](https://nodejs.org) (LTS-versie, zelfde major-versie als op het bureau-apparaat)
- [Git](https://git-scm.com)
- [GitHub CLI](https://cli.github.com) (`winget install GitHub.cli` op Windows, `brew install gh` op macOS)
- [Vercel CLI](https://vercel.com/docs/cli) hoeft niet apart geïnstalleerd te worden, `npx vercel` volstaat
- Een code-editor (VS Code, met dezelfde extensies als op het bureau-apparaat: Markdown PDF is er in elk geval één, zie `feedback_docs_markdown`)
- [Claude Code](https://claude.com/claude-code)

### 3. Code ophalen

```
git clone https://github.com/arnoceo-ops/arnobot.git
cd arnobot
npm install
```

### 4. Eigen GitHub-login op de laptop

Geen tokens of SSH-keys kopiëren vanaf het bureau-apparaat. Gewoon opnieuw, apart, met je eigen account inloggen:

```
gh auth login
```

Volg de browser-gebaseerde flow (device login). Dit apparaat krijgt zijn eigen toegangstoken, los van het bureau-apparaat, dat is de bedoeling: bij verlies van de laptop kan dit ene token ingetrokken worden zonder dat het bureau-apparaat geraakt wordt.

### 5. Environment variables (secrets) ophalen

**Aanbevolen aanpak:** haal ze rechtstreeks van Vercel op, zodat er geen losse kopie van alle API-sleutels ontstaat die apart beheerd moet worden.

```
npx vercel login
npx vercel link
```
Bij `vercel link`: kies het bestaande project `arnobot` onder het account `arnoceo-ops`, niet een nieuw project aanmaken.

```
npx vercel env pull .env.local
```

Dit zet alle environment variables (Supabase, Clerk, Anthropic, Voyage AI, Resend, Calendly, Sentry, Upstash, OpenAI, ElevenLabs, zie `docs/TECHNICAL_HANDOVER.md`) rechtstreeks in `.env.local`. Dit bestand staat al in `.gitignore` en wordt dus nooit meegecommit.

**Waarom niet handmatig kopiëren:** een handmatige kopie (via mail, een cloud-schijf of zelfs een password manager-item) is een extra, permanente plek waar alle sleutels tegelijk staan. Bij `vercel env pull` blijft Vercel de enige bron; er hoeft nooit apart iets ingetrokken te worden op de laptop zelf, alleen het gh- en vercel-inlogtoken van dát apparaat.

### 6. Beveiliging van de laptop zelf

Nu er straks een volledige kopie van alle productie-API-sleutels lokaal op de laptop staat (`.env.local`), is dit de belangrijkste stap tegen "laptop kwijt/gestolen tijdens het reizen = alle sleutels op straat":

- **Windows:** zet BitLocker aan (Instellingen → Privacy en beveiliging → Apparaatversleuteling)
- **macOS:** zet FileVault aan (Systeeminstellingen → Privacy en beveiliging → FileVault)
- Zorg voor een schermvergrendeling met wachtwoord/pincode, niet alleen biometrisch, voor het geval de laptop uitstaat bij verlies

### 7. Claude Code geheugen (optioneel, geen secrets)

De opgebouwde projectcontext (audits, modelkeuzes, stijlregels, eerdere beslissingen) staat lokaal op het bureau-apparaat onder `C:\Users\arno\.claude\projects\<projectslug>\memory\`. Dit bevat geen secrets, alleen context. Zonder actie start Claude Code op de laptop met een lege lei; veel van de kern staat al gedupliceerd in `CLAUDE.md` zelf, dus er gaat niet veel verloren, maar wel wat.

Als je dit wilt meenemen: kopieer die map naar de laptop, naar het equivalente pad voor de laptop-checkout van deze repo. Dit is een losse actie die pas zin heeft vlak vóór vertrek (anders loopt de kopie meteen weer achter).

---

## Bij elke sessie (op elk apparaat)

Dit voorkomt dat de twee apparaten uit elkaar gaan lopen:

1. **Aan het begin:** `git pull origin master`
2. **Na elke afgeronde wijziging:** committen én meteen pushen (`git push origin master`), zoals al de standaardregel is in `CLAUDE.md`. Geen werk lang lokaal laten staan op één apparaat terwijl er op het andere apparaat verdergewerkt wordt.
3. Als er op enig moment tóch een `git pull` faalt door lokale wijzigingen: eerst `git status` bekijken, nooit blind `git reset --hard` of `git checkout .`.

---

## Bekende openstaande punten (op het moment van schrijven)

Deze bestanden staan op het bureau-apparaat nog niet gecommit en komen dus niet automatisch mee met `git clone` op de laptop:

- Gewijzigd: `docs/MOBILE_PLAN.md`, `public/cyborg.jpg`, `public/cyborg.png`
- Nieuw: `data/rss_articles/`, `docs/ABONNEMENTEN.pdf`, `docs/MOBILE_PLAN.pdf`, `public/arno-home2.jpg`

Beslis vóór vertrek of deze gecommit moeten worden, of dat ze bewust alleen op het bureau-apparaat blijven staan.

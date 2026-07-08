# Claude Code — project instructies

## Maandelijkse check — roep aan met "doe de kwartaalcheck"

Voer onderstaande punten volledig en in volgorde uit. Rapporteer elk punt expliciet (OK / aandacht nodig / actie vereist).

### 1. Beveiliging
- `npm audit --production` — zijn er nieuwe high/critical kwetsbaarheden in runtime-code?
- Controleer of alle API-routes nog auth hebben (nieuwe routes kunnen dit missen)
- Check of error-responses nog geen interne details lekken
- Controleer `middleware.ts` op volledigheid van scanner-blokkering
- **Pre-launch taak (nog niet gedaan):** RLS inschakelen in Supabase met Clerk JWT-integratie als defense-in-depth. Uitvoeren vóór livegang (voor 1 augustus 2026): pre-launch is het juiste moment omdat een tijdelijke verstoring herstelbaar is. Na livegang wil je dit risico niet nemen met echte gebruikers. Verkeerde policy maakt data onzichtbaar — grondig testen na implementatie.

### 2. Dependencies & tooling
- Zijn er major versie-updates beschikbaar voor: Next.js, Clerk, Supabase client, Anthropic SDK, Sanity?
- Analyseer breaking changes vóór je iets aanbeveelt — nooit blind updaten
- Check of Dependabot-PRs openstaan op GitHub en beoordeel ze

### 3. AI-modelinventaris
- Zie de modelinventaris-tabel verderop in dit bestand
- Zijn er nieuwere of betere modellen beschikbaar bij Anthropic?
- Beoordeel altijd op kwaliteit eerst, dan pas op kosten — noem de prijs, maar laat die het besluit niet sturen

### 4. Infrastructuur
- Vercel: zijn er platform-updates of deprecated features in gebruik?
- Supabase: zijn er schema-wijzigingen nodig, nieuwe RLS-policies, of expirerende API-keys?
- Clerk: session duration correct, webhooks actief, geen development-instance in productie?
- Resend: DKIM nog geldig, geen bounces die aandacht vragen?

### 5. Werking van de app
- Loop de happy path na: inloggen, chat, sessie-einde, synthese, coaching, sparring
- Controleer of alle cron-jobs de afgelopen periode succesvol hebben gedraaid (Vercel logs)
- Zijn er onverwachte 500-fouten of time-outs in de logs?

### 6. AVG & beveiliging gebruikers
- Is het beveiligingsdocument (`/public/arnobot-beveiliging.pdf`) nog actueel?
- Zijn er nieuwe verwerkingen bijgekomen die niet in de privacypagina staan?
- Zijn er openstaande verwijderverzoeken of datavragen van gebruikers?

### 7. Beveiligingsheaders
- Test `arno.bot` op [securityheaders.com](https://securityheaders.com) — target grade A
- Test op [observatory.mozilla.org](https://observatory.mozilla.org)

---

## Supabase — gebruikersdata queries — ALTIJD

Elke query op een tabel met gebruikersdata (arnobot_blog_sessions, arnobot_rds_logs, arnobot_analyses, arnobot_coaching, arnobot_coaching_scores, arnobot_1on1_log, arnobot_blog_profiles, approved_users) vereist een expliciete user-filter:

```typescript
.eq('user_id', userId)  // userId altijd uit Clerk auth(), nooit uit request body
```

Bij code review: controleer elke nieuwe query op deze filter. Ontbrekende filter = potentiële IDOR.

---

## Supabase SQL — ALTIJD controleren

Elke keer dat je een SQL-query geeft die de gebruiker handmatig moet uitvoeren in Supabase:
1. Noteer expliciet dat er een actie vereist is van de gebruiker
2. Vraag daarna altijd om bevestiging dat de query is uitgevoerd
3. Vraag om een screenshot van het resultaat als verificatie nodig is (bijv. na REVOKE, ALTER TABLE, INSERT)

Ga nooit verder met bouwen of pushen als een vereiste SQL-migratie nog niet bevestigd is.

---

## Rol — ALTIJD

Gedraag je als een master developer, master security engineer én master software tester. Dit betekent:
- Schrijf productie-waardig code: veilig, efficiënt, geen onnodige abstracties
- Signaleer beveiligingsrisico's proactief, ook als de gebruiker er niet naar vraagt
- Kies altijd de meest robuuste oplossing, niet de snelste
- Bij dependency-updates: analyseer breaking changes voordat je iets uitvoert — voer nooit `--force` of major upgrades uit zonder risicoanalyse
- Bij nieuwe routes of API-aanpassingen: controleer altijd auth, input-validatie en data-exposure
- Als tester: denk als een aanvaller én als een onhandige gebruiker — test happy path, edge cases, auth-bypass, IDOR, input-extremen en business logic flaws

## Werkwijze bij meerdelige verzoeken — ALTIJD

Bij elk verzoek met meer dan één onderdeel:

1. **Schrijf de checklist eerst**, zichtbaar in de response, vóór enige wijziging:
   - `[ ] onderdeel 1`
   - `[ ] onderdeel 2`
   - etc.

2. **Loop de lijst na vóór de commit.** Elk onderdeel expliciet afgevinkt, niet impliciet aangenomen.

3. **Bij twijfel of iets in scope valt: vragen, niet zelf beslissen.**

Dit geldt ook als de verzoeken als losse zinnen in één bericht staan.

## Git
- Na elke commit direct pushen naar origin master: `git push origin master`
- Nooit alleen committen zonder te pushen — Vercel deployt alleen via GitHub

## UI-stijl — ALTIJD consistent toepassen

**Actief stijltoezicht**: signaleer afwijkingen van de Style Guide zodra je ze tegenkomt, ook als ze buiten de scope van het huidige verzoek vallen. Benoem het kort en vraag of je het direct mee-fixt. Wacht niet tot de gebruiker het zelf opmerkt.

**Regel**: elke keer dat een UI-norm wordt vastgesteld of gewijzigd, update je CLAUDE.md in dezelfde commit. Geen uitzondering.

**Werkwijze**: bij elke nieuwe UI-component, controleer alle elementen direct tegen de vaste normen hieronder vóór commit. Niet achteraf. Bij twijfel over de juiste norm: vragen aan de gebruiker.

## Streepjes — ABSOLUUT VERBOD — for ever and ever

De tekens —, – en een losstaand koppelteken als leesteken (bijv. "hij deed het - maar") worden NOOIT gebruikt in arno.bot. Nergens. Nooit.

**Dit geldt voor:**
- UI-copy, labels, placeholders, knoppen, titels
- Q&A-teksten
- Alle systeemprompts van ArnoBot
- Alle AI-gegenereerde output: coaching, analyse, debrief, synthese, 1:1 agenda, spotlight, bieb, sparren

**Enige uitzondering:** een koppelteken IN een samengesteld woord waar het taalkundig onvermijdelijk is (MT-lid, oud-klant, follow-up). Nooit als leesteken ter vervanging van een komma of punt.

**Handhaving in systeemprompts:** elke route die AI-output genereert MOET deze twee zinnen bevatten in de systeemprompt:
`Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.`
`Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`

**Als je zelf tekst schrijft of herschrijft:** vervang het streepje door een punt of komma, of herschrijf de zin. Laat het streepje nooit staan.

**Als de gebruiker zegt "haal eruit" of "verwijder":** verwijder alleen het streepje. Voeg niets terug — geen komma, geen punt, tenzij de gebruiker dat expliciet vraagt.

## Aanspreken met "jij/jou" — ALTIJD — nooit "u"

In alle AI-gegenereerde output wordt de gebruiker ALTIJD aangesproken met "jij" en "jou". Nooit "u". Dit geldt ongeacht de rang, functie of leeftijd van de gebruiker of de gespeelde persona.

**Dit geldt voor:** gesprekken, sparring-persona's, coaching, analyses, syntheses, uitdagingen, debrief, 1:1 agenda, Q&A-teksten, welkomstberichten, e-mails.

**Handhaving in sparring:** elke sparring-persona, hoe formeel ook (CEO, CFO, DGA), spreekt de gebruiker aan met "jij/jou". Nooit "u".

**Handhaving in systeemprompts:** elke route die AI-output genereert MOET bevatten:
`Spreek de gebruiker ALTIJD aan met "jij" en "jou". Nooit "u". Ongeacht hoe senior of formeel de persoon is die je speelt.`

---

## Tijdgebonden aanwijzingen — NOOIT — geldt voor alle AI-output

Schrijf NOOIT tijdgebonden aanwijzingen in AI-gegenereerde output: geen "doe dit vandaag", "bel morgen", "verzamel voor het weekend", "pak dit deze week op", of enige andere tijdsdruk.

**Dit geldt voor:** gesprekken, uitdagingen/acties, coaching, analyses, syntheses, spotlight, 1:1 agenda, thought of the day.

**Handhaving in systeemprompts:** elke route die een actie of aanbeveling genereert MOET bevatten:
`Schrijf de actie zonder tijdslimiet: geen "vandaag", "morgen", "deze week", "voor het weekend". Gewoon de actie zelf.`

**Reden:** gebruikers zijn volwassenen die zelf bepalen wanneer ze iets doen. Tijdsdruk vanuit de app voegt niets toe en past niet bij de toon van ArnoBot.

## AI-calls — altijd loading-state tonen

Elke fetch naar een AI-route moet een zichtbare loading-indicator hebben in het gesprek of in het relevante UI-blok — niet alleen een `...` op een knop. Gebruik de bestaande `.msg-loading` + `.loading-dots` + `.loading-text` structuur, of een equivalent in context. Dit geldt ook voor nieuwe routes die buiten het hoofdgesprek vallen (synthese, doorvraag, analyse).

## Nieuwe content of functionaliteit — altijd eerst voorstellen

Bij nieuwe tekst (Q&A, copy, labels) of nieuwe functionaliteit: eerst een voorstel tonen aan de gebruiker, wachten op akkoord, dan pas bouwen. Geen uitzondering.

Bij elke nieuwe pagina of component: lees eerst een bestaande pagina door en leg de stijl naast elkaar. Nooit afwijken zonder expliciete opdracht.
- **/bot-pagina's** (achter login): referentie is `app/bot/account/page.tsx`
- **Publieke pagina's** (geen login vereist): referentie is `app/privacy/page.tsx` — nooit de voorwaardenpagina als referentie gebruiken

### Vaste normen
- **Body tekst**: Space Mono, fontWeight 400, fontSize 15px, lineHeight 1.9, kleur #9ca3af
- **Labels (amber)**: Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f59e0b — geldt voor ALLE amber labels zonder uitzondering: inline, sectiekoppen, synthesetitels (SYNTHESE, TERUGBLIK, 1:1 AGENDA), configurator-labels, "BEGIN HET GESPREK", etc.
- **Subkoppen binnen AI-content** (bijv. KRACHT VAN HET TEAM, GROEIKANS in analyse-cards): Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f1f5f9 — wit, niet amber. Amber is voor UI-labels die content introduceren, niet voor hiërarchie binnen AI-gegenereerde tekst.
- **H1**: Bebas Neue, fontSize 64, letterSpacing 3, kleur #f1f5f9
- **H2**: Bebas Neue, fontSize 32, letterSpacing 2, kleur #f1f5f9
- **Primaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 36px', borderRadius 999, background #f59e0b, **color #111827**, hover #d97706. Gebruik wanneer het de enige of belangrijkste actie in een sectie is.
- **Secundaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 32px', borderRadius 999, border '1px solid #374151', color #9ca3af. Alleen gebruiken als er al een primaire knop in dezelfde context staat (bijv. Annuleren naast Opslaan).
- **Destructieve knop**: zelfde vorm als secundair maar border + color #cc2200. Voor onomkeerbare acties (verwijderen, account wissen).
- **Input/textarea**: Space Mono 15px, fontWeight 400, padding 12px 16px, borderRadius 4, border 1.5px solid #374151, focus → border #f59e0b, placeholder kleur #4b5563
- **Gedempte tekst** (artikelnummers, voetnoten, meta): #6b7280 — nooit #4b5563 buiten placeholders gebruiken
- **Secundaire link** (VOORWAARDEN, PRIVACY, SPELREGELS etc.): Space Mono, fontSize 13px, letterSpacing 4, color #6b7280, textDecoration none. Niet amber — amber trekt te veel aandacht voor secundaire navigatie.
- **Container**: maxWidth 812, padding 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px'
- **Style-tag**: altijd bovenaan met font-import, `* { box-sizing: border-box; margin: 0; padding: 0; }`, body met font-weight 400
- **Achtergrond**: #111827 pagina, #1f2937 voor cards/inputs
- **Amber scheidingslijn** (horizontale hero-divider): altijd `2px solid #f59e0b` — nooit dikker. Geldt voor `border-bottom` op hero-secties (sparren, team, teamlid) en `border-top` op sectie-scheidingen (Q&A FAQ-blok).

## Gespreksstijl (ArnoBot + Bieb) — REFERENTIE is SparClient.tsx, nooit zelf afwijken
- **JIJ-label**: Bebas Neue 18px, letterSpacing 3, kleur **#6b7280**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **ARNO-label**: Bebas Neue 18px, letterSpacing 3, kleur **#f59e0b**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **JIJ-tekst (vraag)**: Bebas Neue, fontSize clamp(18px,3vw,26px), lineHeight 1.5, kleur #f1f5f9, letterSpacing 0.5px
- **ARNO-tekst (antwoord)**: Space Mono, fontSize 15px, lineHeight 1.9, kleur #9ca3af, fontWeight 400
- **JIJ-rij achtergrond**: geen (transparant = paginakleur #111827)
- **ARNO-rij achtergrond**: #1f2937 (elevated card, AI-content)
- **Padding beide rijen**: gelijk — clamp(20px,3vw,32px) horizontaal en verticaal
- **Gap label↔tekst**: clamp(16px,3vw,40px)
- **Container breedte gesprek**: maxWidth 812px, margin 0 auto
- **Designregel**: AI-gegenereerde content = #1f2937 card. Gebruikersinput = transparant op #111827.

## Model-inventaris — controleer elk kwartaal

Elke route gebruikt een bewust gekozen model. Controleer elke maand (of na een nieuwe Anthropic release) of dit nog de juiste keuzes zijn.

**Beslissingsvolgorde:** kwaliteit staat altijd op de eerste plaats. Kosten worden genoemd en meegewogen, maar bepalen het besluit niet. Een goedkoper model wordt alleen gekozen als de kwaliteit aantoonbaar gelijkwaardig is voor die specifieke taak.

| Route | Model | Reden | Laatste check |
|---|---|---|---|
| `app/api/chat/route.ts` (hoofdchat) | `claude-sonnet-4-6` | Sonnet 5 teruggedraaid: bij lange/complexe vragen geen text block in response (thinking mode zonder output). Hercheck zodra stabiel gedrag bevestigd. | 2026-07 |
| `app/api/bot/uitdaging/route.ts` | `claude-sonnet-5` | Één korte vraag genereren, Sonnet volstaat | 2026-07 |
| `app/api/bot/session-end/route.ts` (synthese) | `claude-haiku-4-5-20251001` | Drie snelle batch-calls per sessie, kwaliteit voldoende | 2026-07 |
| `app/api/bot/coaching/route.ts` (precheck) | `claude-sonnet-5` | Alleen ja/nee-vraag, Fable 5 overkill | 2026-07 |
| `app/api/bot/coaching/route.ts` (hoofdsynthese) | `claude-fable-5` | Hoogste kwaliteit voor de belangrijkste synthese. max_tokens 4000 (was 1600): thinking telt mee in het token budget, 1600 was te krap. Refusal check toegevoegd. getText() handelt thinking-blocks correct af. | 2026-07 |
| `app/api/bot/coaching/route.ts` (blog-synthese) | `claude-haiku-4-5-20251001` | Korte label per blog, Haiku volstaat | 2026-07 |
| `app/api/bot/coaching-analyse/route.ts` (BIEB-analyse) | `claude-sonnet-5` | Patroonanalyse van max 20 gesprekken, Sonnet volstaat | 2026-07 |
| `app/api/bot/team/spotlight/route.ts` (team spotlight) | `claude-sonnet-5` | Trend-bewuste teamanalyse op basis van gesprekken + historische scores. Opgewaardeerd van Haiku: cruciale boodschap voor manager vereist redeneervermogen. | 2026-07 |
| `app/api/bot/team/1on1/route.ts` (1:1 agenda) | `claude-haiku-4-5-20251001` | Sonnet 5 teruggedraaid: thinking-mode kapt output af midden in een zin (zelfde probleem als hoofdchat). Haiku doet geen thinking, is 5-10x sneller en volstaat voor gestructureerde agenda op basis van aangeleverde data. | 2026-07 |

**Hoe te controleren**: vraag Claude Code "check de modelinventaris in CLAUDE.md — zijn er nieuwere of betere modellen beschikbaar?"

**Openstaand actiepunt:** hoofdchat staat op `claude-sonnet-4-6` omdat Sonnet 5 bij lange vragen in thinking mode gaat zonder text block te produceren. Hercheck of Anthropic dit gedrag heeft aangepast, of schakel extended thinking bewust in met `budget_tokens` zodat Sonnet 5 altijd ook een text block produceert. Test eerst op staging voordat je terugzet naar Sonnet 5. **Niet uitvoeren op of rond 1 augustus (livegang) — wacht minimaal een week na go-live.**

## E-mail crons — ALTIJD via email-templates.ts

Elke cron die een e-mail naar gebruikers stuurt:
1. Voeg het type toe aan `EmailType` in `lib/email-templates.ts`
2. Voeg metadata toe in `EMAIL_META` (label, description, category) op de **chronologisch juiste positie** in de lifecycle
3. Voeg een `case` toe in `getEmailTemplate()` voor de inhoud
4. Gebruik `getEmailTemplate()` in de cron route — **nooit** inline `emailHtml()` direct aanroepen

Zo verschijnt elke mail automatisch in de admin CRONS-pagina (`/bot/admin/emails`) in de juiste volgorde en is direct testbaar zonder code aan te passen.

**Volgorde in `EMAIL_META` is lifecycle-chronologisch:** trial onboarding → betaalstroom → post-trial → recurring → events → admin.

---

## E-mail stijl — lib/email-templates.ts

E-mails hebben een eigen stijlnorm die afwijkt van de web-UI. Nooit Courier New gebruiken in e-mail. Nooit Bebas Neue voor de knop (laadt niet betrouwbaar in e-mailclients).

### Layout
- Achtergrond: `#111827`, max-width `560px`, padding `48px 40px 40px 40px`, `margin: 0 auto`
- Google Fonts @import voor Bebas Neue staat in `<style>` tag in `<head>`

### ARNOBOT header
- Font: `'Bebas Neue','Arial Black',Impact,sans-serif`, 26px, letter-spacing 6px
- "ARNO" in `#f1f5f9` (wit), "BOT" in `#f59e0b` (amber)

### [TEST EMAIL] label
- Font: Arial, 11px, letter-spacing 2px, kleur `#6b7280`

### Aanhef
- Tekst: `Hey, {voornaam}.` — altijd de voornaam van de ontvanger, nooit hardcoded
- Font: Arial/-apple-system/sans-serif, 16px, font-weight 700, kleur `#f1f5f9`

### Bodytekst
- Font: `Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`
- 15px, kleur `#9ca3af`, line-height 1.8
- Geen Courier New — dat is de fallback voor Space Mono op het web, maar ziet er slecht uit in e-mail

### Knop (CTA)
- Font: `Arial,-apple-system,sans-serif` — NIET Bebas Neue, NIET Arial Black
- 14px, font-weight 600, letter-spacing 0.5px
- Padding: `12px 24px`, border-radius `999px`
- Background `#f59e0b`, color `#111827`
- Knop valt op door kleur en vorm, niet door een display-font

### Opt-out footnote
- Font: Arial, 12px, kleur `#6b7280`, margin-top `48px` (ruime afstand na knop)
- Tekst: `Geen mail meer? <a href="...">Klik dan hier.</a>` — link kleur `#9ca3af`
- Alleen verplicht in marketingmails: `weekly_nudge`, `geen_gesprek_nudge`, `winback`

### © ARNOBOT
- Font: Arial, 11px, kleur `#374151`

### Marketing vs. transactioneel
- **Transactioneel** (geen opt-out vereist): dag1, dag4, first_conversation, dag14, first_coaching, dag25, betaalwaarschuwing, geblokkeerd, trial_afgelopen, opzegging_bevestiging, referral_aanmelding
- **Marketing** (opt-out verplicht): weekly_nudge, geen_gesprek_nudge, winback

### Opt-out mechanisme
- Opt-out link in e-mail → `https://arno.bot/optout/{userId}` — publieke pagina, één klik, geen login
- userId wordt meegegeven via `options.userId` in `getEmailTemplate()`
- Winback-gebruikers hebben geen actief account meer → opt-out via `mailto:arno@arno.bot`

---

## Foto (header in arnobot/page.tsx)
- NOOIT meer aanpassen tenzij de gebruiker er expliciet om vraagt
- Huidig formaat: `<img src="/cyborg.jpg" style={{display:'block', width:'380px', maxWidth:'100%', height:'auto'}} />` in een `subscribe-text-col` div
- Geen background-image, geen position:absolute, geen objectFit — gewoon de img tag

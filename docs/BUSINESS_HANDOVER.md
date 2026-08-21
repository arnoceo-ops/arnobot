# ArnoBot — Bedrijfsoverdracht

Dit document is bedoeld voor iemand die ArnoBot moet overnemen of draaiende moet houden zonder technische achtergrond. Het dekt het idee achter de app, hoe het geld verdient, wat het kost, wie toegang heeft, en wat je doet als er iets misgaat.

Secties gemarkeerd met `[ARNO: ...]` zijn door Arno nog in te vullen.

<!-- AUTO:UPDATED -->
Laatste automatische update: 2026-08-21
<!-- /AUTO:UPDATED -->

---

## Wat is ArnoBot

ArnoBot is een AI-coach voor salesprofessionals. Gebruikers voeren gesprekken over hun werk: klantgesprekken, deals, pipeline, eigen gedrag. ArnoBot stelt vragen, reflecteert terug, en bouwt na verloop van tijd een profiel op van de gebruiker. Na meerdere gesprekken geeft de app een coachingrapport met scores op drie dimensies: mindset, systeem en actie.

De app is gebouwd door Arno Diepeveen, oprichter van Royal Dutch Sales, als verlengstuk van zijn coachingswerk met salesprofessionals. ArnoBot is geen generieke AI-assistent — het is een gespecialiseerde coach die uitsluitend op sales is gefocust, met een eigen toon en aanpak.

**Live URL:** https://arno.bot  
**Bedrijf:** Royal Dutch Sales  
**Oprichter:** Arno Diepeveen  
**Vestiging:** Amsterdam, Nederland

---

## Doelgroep

Nederlandstalige salesprofessionals en salesmanagers, voornamelijk in B2B. Typisch profiel: zelfstandige verkoper of accountmanager bij een mkb-bedrijf, die wil verbeteren maar geen tijd of budget heeft voor een persoonlijk salescoach.

Managers kunnen een teammodule gebruiken: ze zien de voortgang van hun verkopers en krijgen automatisch een agenda voor 1:1-gesprekken.

---

## Verdienmodel

Drie publieke abonnementen op https://arno.bot/prijzen, plus één niet-publieke tier. Volledige onderbouwing en beslissingsgeschiedenis: `docs/PRICING_DECISIONS.md`.

**Basic:**
- Maandelijks: €29/maand
- Jaarlijks: €228/jaar (= €19/maand, korting ~34%)
- Trial: 30 dagen gratis, geen creditcard vereist

**Pro:**
- Maandelijks: €59/maand
- Jaarlijks: €468/jaar (= €39/maand, korting ~34%)
- Trial: 30 dagen gratis, geen creditcard vereist

**Team:**
- €97/maand platformtarief (managerlaag) + €49/gebruiker/maand, vanaf 3 gebruikers
- Jaarlijks: €924/jaar platform + €468/gebruiker/jaar (= €77 + €39/maand-equivalent, korting ~20%)
- Geen aparte trial: de manager start zelf als individuele Pro-gebruiker en upgradet later. Aanvraag via https://arno.bot/team (formulier, geen automatische betaling)

**Elite (niet publiek, alleen handmatig toe te kennen):**
- €397/maand, individueel, hoog-contact, maximaal 50 actieve klanten
- Staat niet meer op de prijzenpagina, alleen toekenbaar via het admin-paneel

**Referral:**
- Elke gebruiker heeft een referralcode
- Tegoed ontstaat alleen als de nieuw geworven gebruiker voor Pro of Team kiest (niet bij Basic)
- Tegoed is nooit hoger dan wat de referrer zelf per maand betaalt op zijn eigen abonnement
- Credit werkt als korting op de volgende verlengingsbetaling, niet als cashback

**Betalingsverwerking:**
- **Bevestigd via codebase-onderzoek:** geen enkele betaalprovider is geïntegreerd (geen Stripe/Mollie-SDK, geen betaal-webhook). Betaling verloopt dus volledig extern aan de app. [ARNO: vul aan welk kanaal je zelf gebruikt om te innen, bijv. handmatige overschrijving, een los factuurprogramma]
- Betaling registreren in het systeem: ga naar `/bot/admin/gebruikers` en gebruik de "Betaling registreren" functie, of roep `/api/admin/payment` aan
- **Bewust pending:** geautomatiseerde betalingsverwerking bouwen binnen 30 dagen na de commerciële livegang (Arno's eigen toezegging 2026-08-21). Zie `docs/TECHNICAL_HANDOVER.md`, "Bekende beperkingen" punt 11.

---

## Maandelijkse kosten (extern)

Dit zijn de kosten voor het draaiende houden van de app, ongeacht het aantal gebruikers.

| Dienst | Doel | Kosten | Factuur |
|---|---|---|---|
| Vercel | Hosting | [ARNO: vul in] | vercel.com |
| Supabase | Database | [ARNO: vul in] | supabase.com |
| Clerk | Inloggen | [ARNO: vul in] | clerk.com |
| Anthropic | AI (Claude) | Variabel, per gebruik | console.anthropic.com |
| OpenAI | Spraak (Whisper transcriptie + TTS) | Variabel, per gebruik | platform.openai.com |
| ElevenLabs | ArnoBot Voice (tekst-naar-spraak) | Variabel, per gebruik (Voice-abonnees) | elevenlabs.io |
| VoyageAI | Embeddings (zoeken) | Variabel, per gebruik | voyageai.com |
| Resend | E-mail | [ARNO: vul in] | resend.com |
| Upstash | Rate limiting | [ARNO: vul in] | upstash.com |
| Sentry | Foutmonitoring | [ARNO: vul in] | sentry.io |
| PostHog | Bezoekersanalyse (marketingpagina's) | [ARNO: vul in] | posthog.com |
| Calendly | Boeking gesprek met Arno | [ARNO: vul in] | calendly.com |
| Instatus | Publieke statuspagina (uptime/incidenten) | [ARNO: vul in, waarschijnlijk gratis tier] | instatus.com |
| VisualPing | Monitoring leverancierspagina's (bijv. DPA-wijzigingen) | [ARNO: vul in] | visualping.io |
| Porkbun | Domeinregistratie arno.bot | ~$52/jaar (bron: Abacus-kostencalculator, `lib/kostenTarieven.ts`) | porkbun.com |
| GitHub | Code-opslag | [ARNO: vul in of gratis] | github.com |
| Telegram | Admin-notificaties | Gratis | — |

**Anthropic, OpenAI, ElevenLabs en VoyageAI zijn variabele kosten** — ze groeien mee met het gebruik. Bij weinig gebruikers zijn ze laag; bij veel gebruikers kunnen ze significant oplopen. Houd de usage-dashboards bij.

**Totaal vaste kosten per maand:** [ARNO: vul in als je de bovenstaande items hebt ingevuld]

---

## Accounttoegang en wachtwoorden

[ARNO: vul in waar de inloggegevens voor elk van de onderstaande diensten staan opgeslagen]

| Dienst | Toegang opgeslagen in | Url |
|---|---|---|
| Vercel | [ARNO: bijv. 1Password > ArnoBot] | vercel.com |
| Supabase | [ARNO: vul in] | supabase.com |
| Clerk | [ARNO: vul in] | clerk.com |
| Anthropic | [ARNO: vul in] | console.anthropic.com |
| OpenAI | [ARNO: vul in] | platform.openai.com |
| ElevenLabs | [ARNO: vul in] | elevenlabs.io |
| VoyageAI | [ARNO: vul in] | voyageai.com |
| Resend | [ARNO: vul in] | resend.com |
| Upstash | [ARNO: vul in] | upstash.com |
| Sentry | [ARNO: vul in] | sentry.io |
| PostHog | [ARNO: vul in] | posthog.com |
| Calendly | [ARNO: vul in] | calendly.com |
| Instatus | [ARNO: vul in] | instatus.com |
| VisualPing | [ARNO: vul in] | visualping.io |
| GitHub | [ARNO: vul in] | github.com |
| Porkbun (domeinregistrar) | [ARNO: vul in] | porkbun.com |
| Telegram | [ARNO: vul in] | t.me |
| Admin paneel ArnoBot | [ARNO: vul in — het wachtwoord staat als ARNOBOT_ADMIN_KEY in Vercel] | arno.bot/bot/admin |

**Aanbeveling:** Sla al deze gegevens op in een wachtwoordmanager (bijv. 1Password of Bitwarden). Geef een vertrouwde persoon noodtoegang tot die kluis.

---

## GitHub-toegang

De broncode staat op https://github.com/arnoceo-ops/arnobot. Om iemand anders code te laten pushen:

1. Ga naar GitHub > het repository > Settings > Collaborators
2. Voeg de nieuwe developer toe met de rol "Write" of "Admin"
3. De nieuwe developer pusht naar `master` — Vercel deployt automatisch

---

## Gebruikers en abonnees

Actieve gebruikers zijn zichtbaar in het admin paneel: https://arno.bot/bot/admin

Inloggen met het admin-wachtwoord (zie ARNOBOT_ADMIN_KEY in Vercel environment variables).

Het admin paneel toont:
- Actieve gebruikers
- Trial-gebruikers
- Recent ingeschreven gebruikers
- Optie om betalingen te registreren en gebruikers te beheren

**Alle gebruikersdata staat in Supabase** (tabel `approved_users`). Bij een overname kan een nieuwe beheerder direct via Supabase bij alle gegevens.

---

## Juridisch

### Privacyverklaring
Gepubliceerd op https://arno.bot/privacy. Beschrijft welke gegevens worden verwerkt, waarvoor, en hoe lang ze worden bewaard.

### Gebruiksvoorwaarden
Gepubliceerd op https://arno.bot/voorwaarden.

### Beveiligingsdocument
Downloadbaar op https://arno.bot/api/beveiliging-pdf. Beschrijft de technische beveiligingsmaatregelen.

### AVG / GDPR
- Gebruikers kunnen hun data opvragen en laten verwijderen via het account-instellingenscherm (`/bot/account`)
- Verwijderverzoeken worden verwerkt via de "Account verwijderen" functie — dit wist alle gesprekken, analyses en het gebruikersrecord
- [ARNO: is er een verwerkersovereenkomst (DPA) met alle sub-verwerkers? Volledige huidige lijst (zie ook `app/privacy/page.tsx` en `public/arnobot-beveiliging.pdf`): Anthropic, Supabase, Clerk, Voyage AI, OpenAI (spraak), ElevenLabs (Voice), Resend, Upstash, Sentry, PostHog, Vercel. Vul in per leverancier of dit geregeld is]

### Vestiging en belastingen
- [ARNO: vul in: welk rechtsgebied, welk btw-nummer, hoe worden abonnementen gefactureerd]

---

## Technische contactpersonen

[ARNO: vul in wie je kunt bellen/mailen als er een technisch probleem is dat je zelf niet kunt oplossen]

| Rol | Naam | Contact |
|---|---|---|
| Developer (oorspronkelijk) | Arno Diepeveen | arno@arno.bot |
| Vercel support | — | vercel.com/support |
| Supabase support | — | supabase.com/support |
| Anthropic support | — | console.anthropic.com/support |
| [ARNO: vul aan met externe developer/freelancer als van toepassing] | | |

---

## Wat te doen als het systeem uitvalt

### Stap 1: Bepaal wat er uitvalt

- **Hele site onbereikbaar:** Controleer Vercel status (https://www.vercel-status.com) en DNS bij Porkbun (domeinregistrar, geen Cloudflare in gebruik voor arno.bot)
- **Inloggen werkt niet:** Controleer Clerk status (https://clerk.statuspage.io)
- **Database-errors:** Controleer Supabase status (https://status.supabase.com)
- **AI-antwoorden komen niet:** Controleer Anthropic status (https://status.anthropic.com)
- **E-mails worden niet ontvangen:** Controleer Resend status (https://resend-status.com)

### Stap 2: Communiceer met gebruikers

Als de storing langer duurt dan 30 minuten:
- Stuur een e-mail via Resend (rechtstreeks in het dashboard) aan actieve gebruikers
- [ARNO: is er een statuspage of communicatiekanaal voor gebruikers? Vul in]

### Stap 3: Herstel

- **Vercel:** Terugdraaien naar vorige deployment via het Vercel-dashboard (Deployments > vorige versie > Promote to Production)
- **Supabase:** Database is automatisch dagelijks gebackupt. Herstel via Supabase dashboard (Settings > Backups)
- **Code-probleem:** Zet de vorige werkende commit terug via GitHub (revert) of Vercel (promote)

---

## Wat te doen als Arno onbeschikbaar is

### Korte termijn (tot 2 weken)

De app draait volledig automatisch. Er is geen handmatige actie nodig voor normale werking. Cron jobs draaien automatisch. Gebruikers kunnen zichzelf aanmelden, betalen en de app gebruiken.

Wat wél handmatig is:
- Betalingen registreren als ze buiten het systeem om lopen
- Ondersteuningsvragen van gebruikers beantwoorden
- Kritieke bugs fixen

### Langere termijn

1. **Toegang regelen:** Gebruik de accounttoegangslijst in dit document om toegang te krijgen tot alle diensten
2. **Developer zoeken:** De codebase is gedocumenteerd in `docs/TECHNICAL_HANDOVER.md`. Een ervaren Next.js-developer kan het project overnemen
3. **Abonnementen:** Bestaande abonnees kunnen gewoon blijven gebruiken. Nieuwe aanmeldingen kunnen worden gestopt door de aanmeldpagina te verwijderen of de trial-toegang uit te zetten
4. **Data:** Alle gebruikersdata staat in Supabase. Bij een definitieve sluiting: gebruikers informeren, data exporteren aanbieden, en records verwijderen conform de privacyverklaring

### Aanbevolen noodvoorbereiding

[ARNO: vul in]
- Is er een vertrouwde persoon die weet waar de wachtwoordkluis staat?
- Is er een notarieel document of brief die aangeeft wat er met het bedrijf moet gebeuren?
- Is er een developer die je kunt benaderen als noodcontact?

---

## Changelog (handmatig bijhouden)

Noteer hier grote wijzigingen die niet uit de code blijken: prijsverhogingen, nieuwe diensten, beëindigde contracten, rechtszaken, etc.

| Datum | Wat |
|---|---|
| 2026-07 | Teammodule (fase 1) live: 1:1-agenda, spotlight, scores |
| 2026-07 | WhatsApp-support toegevoegd aan alle fout-states |
| 2026-07 | 1:1-agenda overgeschakeld van Sonnet 5 naar Haiku wegens timeout-probleem |
| 2026-07 | Prijzen hernoemd naar Basic/Pro/Team (was Premium/Command), live op `/prijzen` |
| 2026-07 | ArnoBot Voice gelanceerd (ElevenLabs tekst-naar-spraak, premium-feature voor Pro/Team) |
| 2026-08 | Sales Development-programma gestart: twee agents benaderen sales teams outbound via persoonlijke links, gratis 30-dagen teamtrial |
| 2026-08 | De Spiegel + zelfcoaching-module toegevoegd aan Team (teambrede thema-herkenning + zelfcoaching voor de teambaas) |
| 2026-08-20 | **Beveiligingsincident gevonden en gefixt:** Row Level Security stond op vrijwel alle databasetabellen nog uit ondanks een eerdere notitie dat dit al geregeld was. Geen aanwijzing gevonden dat dit ooit misbruikt is. Direct gefixt. Zie `docs/TECHNICAL_HANDOVER.md` voor de volledige technische toedracht |
| [ARNO: voeg toe] | Livegang arno.bot (oorspronkelijk gepland ~1 augustus 2026, uitgesteld met 1-2 maanden, check bij Arno de actuele datum vóór je hierop bouwt) |

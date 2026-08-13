# ArnoBot Sales Development

**Laatst bijgewerkt:** 2026-08-13
**Waar we staan:** Volledig geautomatiseerd. Een persoonlijke link per SDR (Stefanie/Anniek) zet bij aanmelding automatisch `command_manager=true`, geen handmatige stap meer van Arno nodig, geen wachttijd voor de prospect. Inclusief automatische attributie via de bestaande Telegram-melding. Beschrijft de sales-development-functie: sales teams bij andere bedrijven binnenhalen als ArnoBot-klant via outbound en een gratis 30-dagen team-trial.
**Eerstvolgende stap:** Arno's eigen team aanmaken op `/bot/team` (nu mogelijk, `command_manager=true` staat sinds 2026-08-13 op zijn echte LinkedIn-account) en Stefanie en Anniek daarin uitnodigen als lid, zodat zij zelf ervaren hoe teamlidmaatschap werkt vóórdat ze het verkopen. Daarna: de sd-links delen met prospects. Env vars staan al in Vercel (bevestigd door Arno, 2026-08-13), dit werkt dus al in productie. `.env.local` is alleen nog nodig als lokaal getest moet worden, niet voor productiegebruik.

Dit document vervangt een eerdere, verkeerd geframede versie die uitging van het aannemen van verkopers om zelf voor Arno te werken. Het gaat om iets anders: een verkoopfunctie die actief sales teams bij bedrijven benadert om ze op ArnoBot aan te sluiten.

---

## Wat dit is

Sales development: actief, outbound sales teams bij andere bedrijven (typisch geleid door een salesbaas of commercieel directeur) benaderen, met als doel ze op ArnoBot Team te krijgen. Het middel: een gratis team-trial, geen koud verkoopgesprek over prijs.

**Rolbezetting:** Stefanie en Anniek.

**Wat ze ook zelf doen:** naast het verkopen ervan gebruiken ze ArnoBot ook zelf, dat versterkt hun eigen verkoopgesprek, ze pitchen vanuit ervaring, niet vanuit een script. Zie "Waarom dit ook voor Stefanie en Anniek zelf werkt" verderop.

---

## Het aanbod: gratis 30-dagen team-trial

- **Duur: 30 dagen** (besloten 2026-08-13, consistent met de bestaande individuele Basic/Pro-trial, makkelijker te communiceren dan een afwijkende termijn).
- **Doel:** conversie naar een betaald Team-abonnement na de trial, niet trial-om-de-trial.
- Prijslogica voor het gesprek ná de trial: zie `docs/SALES_BIJBEL.md`, sectie "De kernbelofte" en de Team-tarieven in `docs/PRICING_DECISIONS.md`.

---

## Praktisch: hoe een trial wordt geactiveerd

**Volledig geautomatiseerd (gebouwd 2026-08-13).** Eerdere versies van dit document beschreven eerst een handmatige Supabase-bewerking, daarna een handmatige klik door Arno. Beide klopten niet meer: Arno wilde geen enkele leemte tussen aanmelden en teamleden uitnodigen, dus is er een persoonlijke link per SDR gebouwd die dit automatisch regelt.

**De links (niet delen buiten Stefanie/Anniek, functioneren als een wachtwoord):**
- Stefanie: `https://arno.bot/aanmelden?sd=e53a3dfd5ab974b85baea67d6c6b1f1e`
- Anniek: `https://arno.bot/aanmelden?sd=36aabe733fc2e17baab60325dcbca996`

**Hoe het werkt:**
1. Stefanie of Anniek stuurt haar eigen link naar een prospect (in een outbound-mail, LinkedIn-bericht, etc.).
2. De prospect klikt de link (zet een cookie, stuurt door naar de gewone inlogpagina) en meldt zich aan zoals elke andere gebruiker.
3. Bij het aanmaken van het account herkent het systeem de cookie en zet `command_manager=true` meteen mee, in dezelfde stap, geen aparte handeling van wie dan ook nodig.
4. Arno krijgt de gebruikelijke Telegram-melding van een nieuwe gebruiker, nu met erbij vermeld via wie (Stefanie of Anniek) deze binnenkwam, dat geeft meteen ook attributie/tracking zonder dat daar apart iets voor gebouwd hoefde te worden.
5. De manager kan direct door naar `/bot/team`, team aanmaken, teamleden uitnodigen (`/bot/team/join`, elk lid krijgt automatisch Pro-niveau). Geen wachttijd, geen tussenstap.
6. Na 30 dagen: gesprek over conversie naar een echte betaalde Team-deal. Dát traject blijft wél volledig handmatig (`plan='team'`, facturatie, zie `docs/ABONNEMENTEN.md`, sectie "Team-aanvraagflow"), maar dat gebeurt pas bij een daadwerkelijke aankoop, niet tijdens de trial zelf.

**Beveiliging:** de tokens in de links zijn lange, willekeurige strings (niet een simpele naam of code), zodat ze niet te raden zijn. Alleen wie de link letterlijk heeft, kan 'm gebruiken. Serverside opgeslagen als de environment-variabelen `SD_TOKEN_STEFANIE`/`SD_TOKEN_ANNIEK`, moeten in zowel `.env.local` als Vercel gezet worden vóórdat dit in productie werkt.

**Status:** env vars staan al in Vercel (bevestigd door Arno, 2026-08-13), dit werkt dus al in productie.

---

## Het verkoopverhaal zelf

Niet hier dupliceren. Voor het daadwerkelijke gesprek met een prospect: `docs/SALES_BIJBEL.md`, met name de sectie "De kernbelofte" (wat een manager, hoe goed ook, structureel nooit alleen kan) als opening, en de USP-lijst daaronder als onderbouwing.

---

## Waarom dit ook voor Stefanie en Anniek zelf werkt

Ze zijn niet alleen verkoper van dit product, ze zijn ook zelf gebruiker ervan. Dat is een authenticiteit die geen andere sales-rol biedt:

- **Ze pitchen vanuit eigen ervaring**, niet vanuit een script. Een prospect voelt het verschil tussen "ik heb dit bestudeerd" en "ik gebruik dit zelf".
- **Het maakt hen zelf beter**, los van deze functie: 24/7 sparring, accountability-tracking, een eigen coachingsdiagnose.
- **Het is makkelijker te verkopen dan een gemiddeld product.** De kernbelofte in de Sales Bijbel is een sterk verhaal met weinig prijsweerstand, dat betekent voor hen concreet minder tijd kwijt aan bezwaren pareren.
- **Ze maken zelf een echt teamlidmaatschap mee, niet alleen een demo.** Sinds 2026-08-13 heeft Arno's eigen account (`command_manager=true`, hetzelfde mechanisme als bij elke andere manager) een eigen team, waar Stefanie en Anniek als lid (niet als manager) in zitten. Ze ervaren zo zelf hoe het is om als teamlid gecoacht en gevolgd te worden, vóórdat ze dat bij een prospect verkopen.

---

## Wat je niet moet beloven

- De start van de trial (`command_manager` aanzetten) blijft een handmatige stap door Arno, dat naar een prospect suggereren als iets dat ze zelf kunnen instellen is onjuist. Het uitnodigen van teamleden daarna is wel echt zelfbediening voor de manager zelf.
- Geen kenmerken noemen die nog GEPLAND zijn in `docs/SALES_BIJBEL.md`, alleen LIVE.
- Geen concreet verdienpotentieel/commissiestructuur communiceren totdat die met Arno is vastgesteld en hier is vastgelegd.

---

## Nog toe te voegen

- Concrete commissiestructuur voor Stefanie en Anniek op geconverteerde trials, zodra vastgesteld
- Een lijst van doelbedrijven/wie ze actief gaan benaderen
- Beslissing of Stefanie/Anniek eigen adminpagina-toegang krijgen (zie "Openstaande vraag" hierboven)

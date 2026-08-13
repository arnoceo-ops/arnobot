# ArnoBot Sales Development

**Laatst bijgewerkt:** 2026-08-13
**Waar we staan:** Eerste versie, activatieproces gecorrigeerd nadat Arno terecht aangaf dat de collaboration-teamfunctie hier al voor bestaat. Slechts één handmatige stap (command_manager aanzetten, één klik), daarna is teamleden uitnodigen al volledig zelfbediening voor de manager. Beschrijft de sales-development-functie: sales teams bij andere bedrijven binnenhalen als ArnoBot-klant via outbound en een gratis team-trial. Rolbezetting: Stefanie en Anniek.
**Eerstvolgende stap:** Beslissen of Stefanie en Anniek zelf adminpagina-toegang krijgen om stap 2 (command_manager aanzetten) zelf te kunnen doen, of dat dit voorlopig bij Arno blijft.

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

**Gecorrigeerd (2026-08-13):** de eerdere versie van dit document beweerde dat er geen enkele manier bestaat om dit te activeren zonder een handmatige Supabase-bewerking. Dat klopte niet: er bestaat al een volledig zelfbedieningsmechanisme voor precies dit scenario, de collaboration-teamfunctie (`arnobot_teams`/`arnobot_team_members`, los van billing/`plan`, zie `docs/ABONNEMENTEN.md`).

**Hoe het werkt:**
1. De manager van de prospect meldt zich gewoon aan via de normale weg. Krijgt automatisch de standaard 30-dagen Pro-trial, geen actie nodig van wie dan ook.
2. **Enige echte handmatige stap:** Arno zet `command_manager=true` voor die manager. Dit is één klik op de bestaande knop in `/bot/admin/gebruikers` (`CommandManagerToggle.tsx`), geen Supabase-bewerking, kost seconden.
3. De manager maakt vanaf dat moment zelf het team aan (`/bot/team/create`) en nodigt zelf de teamleden uit via een uitnodigingscode (`/bot/team/join`). Elk lid dat joint krijgt automatisch `plan='premium'` (Pro-niveau), volledig zelfbediening, geen verdere actie van Arno nodig. Maximaal 25 leden per team.
4. Na 30 dagen: gesprek over conversie naar een echte betaalde Team-deal. Dát traject is wél volledig handmatig (`plan='team'`, facturatie, zie `docs/ABONNEMENTEN.md`, sectie "Team-aanvraagflow"), maar dat gebeurt pas bij een daadwerkelijke aankoop, niet tijdens de trial zelf.

**Openstaande vraag, nog niet besloten:** moeten Stefanie en Anniek zelf toegang krijgen tot de adminpagina om stap 2 zelf te kunnen doen, zonder Arno erbij nodig te hebben voor elke trial? Dat is een losse toegangsbeslissing (wachtwoord/rechten), geen technisch bouwwerk.

---

## Het verkoopverhaal zelf

Niet hier dupliceren. Voor het daadwerkelijke gesprek met een prospect: `docs/SALES_BIJBEL.md`, met name de sectie "De kernbelofte" (wat een manager, hoe goed ook, structureel nooit alleen kan) als opening, en de USP-lijst daaronder als onderbouwing.

---

## Waarom dit ook voor Stefanie en Anniek zelf werkt

Ze zijn niet alleen verkoper van dit product, ze zijn ook zelf gebruiker ervan. Dat is een authenticiteit die geen andere sales-rol biedt:

- **Ze pitchen vanuit eigen ervaring**, niet vanuit een script. Een prospect voelt het verschil tussen "ik heb dit bestudeerd" en "ik gebruik dit zelf".
- **Het maakt hen zelf beter**, los van deze functie: 24/7 sparring, accountability-tracking, een eigen coachingsdiagnose.
- **Het is makkelijker te verkopen dan een gemiddeld product.** De kernbelofte in de Sales Bijbel is een sterk verhaal met weinig prijsweerstand, dat betekent voor hen concreet minder tijd kwijt aan bezwaren pareren.

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

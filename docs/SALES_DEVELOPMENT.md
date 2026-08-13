# ArnoBot Sales Development

**Laatst bijgewerkt:** 2026-08-13
**Waar we staan:** Eerste versie. Beschrijft de sales-development-functie: sales teams bij andere bedrijven binnenhalen als ArnoBot-klant via outbound en een gratis team-trial. Rolbezetting: Stefanie en Anniek.
**Eerstvolgende stap:** Het praktische activatieproces (nu volledig handmatig via Arno) een paar keer in de praktijk draaien, dan beoordelen of een eigen adminfunctie de moeite waard wordt.

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

**Belangrijk, vooraf gecheckt (2026-08-13):** er bestaat op dit moment geen zelfbedieningsfunctie om iemand op Team-niveau te zetten, ook niet via de adminpagina. De bestaande plan-toggle in `/bot/admin/gebruikers` cyclet alleen door Basic/Pro/Elite, `team` is daar bewust uit gehaald. Team-toegang wordt uitsluitend geregeld door een rechtstreekse aanpassing in Supabase.

**Proces, voorlopig volledig handmatig (besloten 2026-08-13, startpunt, geen bouwwerk vooraf):**
1. Stefanie of Anniek krijgt akkoord van een prospect om te starten met de gratis team-trial.
2. Ze geven de benodigde gegevens door aan Arno (bedrijfsnaam, e-mailadressen van de deelnemers, gewenste startdatum).
3. Arno zet de team-rij(en) handmatig klaar in Supabase, zelfde soort handeling als nu al gebeurt bij een betaalde Team-aanvraag via `/team` (zie `docs/ABONNEMENTEN.md`, sectie "Team-aanvraagflow").
4. Na afloop van de 30 dagen: handmatig gesprek over conversie naar betaald, of het aflopen van de toegang als er niet geconverteerd wordt.

**Wanneer dit heroverwegen:** als het aantal trials per maand groot genoeg wordt dat dit handmatige proces een bottleneck wordt, is de volgende stap een eigen, eenvoudige adminfunctie waarmee Stefanie/Anniek zelf een tijdelijke team-trial kunnen activeren zonder Arno erbij nodig te hebben. Bewust niet nu al gebouwd, eerst het proces een paar keer echt draaien.

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

- Geen zelfbedieningsactivatie van de trial suggereren richting een prospect, dat bestaat niet, alles loopt via Arno.
- Geen kenmerken noemen die nog GEPLAND zijn in `docs/SALES_BIJBEL.md`, alleen LIVE.
- Geen concreet verdienpotentieel/commissiestructuur communiceren totdat die met Arno is vastgesteld en hier is vastgelegd.

---

## Nog toe te voegen

- Concrete commissiestructuur voor Stefanie en Anniek op geconverteerde trials, zodra vastgesteld
- Een lijst van doelbedrijven/wie ze actief gaan benaderen
- Beslissing of/wanneer een eigen adminfunctie voor trial-activatie de moeite waard wordt

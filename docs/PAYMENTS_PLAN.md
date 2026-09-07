# Betaalprovider, facturatie en abonnementsvoorwaarden

## Statusblok

- **Laatst bijgewerkt:** 2026-09-02
- **Waar we staan:** besluit genomen (Stripe voor de EU, Paddle later voor de rest), verder **geparkeerd, wordt later opgepakt**. Nog niks gebouwd. Alle betalingen lopen nu handmatig via `/bot/admin/gebruikers` → `POST /api/admin/payment`.
- **Blokkerend, en van Arno (nog niet gestart, 2026-09-02):**
  1. **Rechtspersoon-keuze + Stripe-accountverificatie.** Eerst vastleggen welke entiteit met Stripe contracteert (Royal Dutch Sales of een aparte ArnoBot-entiteit, zie `BUSINESS_HANDOVER.md`). Dan het Stripe-account aanmaken en de KYC-verificatie doorlopen (KvK, btw-nummer, bestuurder/UBO-ID, zakelijke IBAN). Lange lijn: review kan dagen duren, uitbetalingen zijn geblokkeerd tot 't rond is.
  2. **Juridische review van de abonnementsvoorwaarden** (NL SaaS + consumentenrecht). Zie de sectie "Opzegging, verlenging en consumentenrecht" hieronder.
- **Eerstvolgende stap:** niks aan de codekant tot 1 en 2 lopen. De bouw (fasering hieronder) start pas wanneer de NL-livegang dichtbij is.

## Besluit (2026-09-02)

**Stripe voor de hele EU-operatie, Paddle voor de rest van de wereld, sequentieel.**

| Segment | Type | Provider |
|---|---|---|
| Basic / Pro | B2C **en** B2B door elkaar: particuliere verkoper zonder btw-nummer én ZZP/bedrijf mét | **Stripe** |
| Team (maandelijks en jaarlijks) | B2B, bedrijven met KvK/btw | **Stripe** (jaarcontract via `send_invoice` = bankoverschrijving) |
| Engelse/internationale site, later | rest van de wereld | **Paddle** (merchant of record) |

**Waarom Stripe genoeg is voor de EU, ook met B2C:** de extra belasting-admin is twee kwartaalaangiftes bovenop de normale NL-btw-aangifte, routineus werk voor een boekhouder:
- **B2C in andere EU-landen:** boven €10.000 grensoverschrijdende B2C-omzet per jaar → registratie voor de **EU OSS-regeling** (One Stop Shop): elke klant het btw-tarief van zijn eigen land, één kwartaalaangifte. Onder €10k gewoon NL-btw. Stripe Tax berekent, de OSS-aangifte is voor Arno/boekhouder.
- **B2B EU met geldig btw-nummer:** 0% reverse-charge + kwartaal-**ICP-opgaaf** (EC Sales List). Stripe levert de data.

**Waarom Paddle pas buiten de EU:** VS sales tax (40+ staten apart registreren), UK VAT, Australië GST enzovoort. Dáár wordt "zelf overal registreren" onhoudbaar en verdient een merchant of record zijn ~5%. Binnen de EU niet.

### Verworpen alternatieven

- **Eén MoR voor alles (Paddle, ook NL/EU).** Simpelst om te draaien, maar ~3,5 procentpunt extra op elke EU-transactie, structureel. Weegt niet op tegen twee kwartaalaangiftes.
- **Alleen Stripe, wereldwijd.** Goedkoopste fees, maar dan zelf btw/sales-tax registreren en afdragen in elk niet-EU-rechtsgebied (of via een betaalde filing-partner). Als solo-operatie te veel.
- **B2B-only, ook voor Basic/Pro** (KvK/btw-nummer verplicht bij elke aanmelding). Zou consumentenrecht wegnemen, maar sluit de particuliere verkoper in loondienst uit die ArnoBot privé koopt. Voor een product van €19-77 een te groot marktsegment om te weigeren. Verworpen 2026-09-02.
- **Mollie.** Nederlands, maar een PSP, geen merchant of record. Lost het belastingprobleem niet op. Bovendien door Arno uitgesloten.
- **Lemon Squeezy als MoR i.p.v. Paddle.** Sinds juli 2024 overgenomen door Stripe, wordt "Stripe Managed Payments". Integratie bouwen op een product in transitie = herbouwrisico. Paddle is zelfstandig en stabiel sinds 2012, sterker op EU B2B-facturatie.

### Aanname achter de fasering

"Wanneer ik internationaal ga ben ik geen solopreneur meer" (Arno, 2026-09-02). De tweede provider (Paddle) valt samen met het moment dat er meer handen zijn. Klopt dat niet meer → fasering heroverwegen, niet blind Paddle erbij bouwen in je eentje.

## Architectuur

**Eén dunne adapter `lib/payments.ts`.** De rest van de app (approved_users bijwerken, referral-conversie, stats, e-mails, proxy-toegang) weet niet welke provider erachter zit.

- **Checkout:** knoppen op `/prijzen` en `/bot/doorgaan` → `/api/checkout` → Stripe Checkout Session → redirect. Later: land-/domein-routing die niet-EU naar Paddle stuurt.
- **Webhook** `/api/webhooks/stripe` (later ook `/paddle`): signature verifiëren → event parsen → mappen naar één intern `subscription_changed` → schrijft `approved_users` (`paid_at`, `plan`, `expires_at`, `bedrag`, `interval`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`) en zet `arnobot_referrals.status` op `converted` bij premium/team (zelfde logica als nu in `app/api/admin/payment/route.ts`, die als handmatige fallback blijft).
- **Toegang:** de webhook houdt `expires_at` op het eind van de lopende periode. `proxy.ts` dwingt dat al af (fix 2026-09-02: expires_at bindend, ook voor betalers). `invoice.payment_failed` → grace period, daarna toegang eraf.
- **Unified admin-view:** MRR, churn, mislukte betalingen uit de eigen tabellen, niet uit provider-dashboards. `/bot/admin/stats` is de plek (wacht hier al op: MRR wordt niet geschat tot `bedrag`/`interval` gevuld zijn). Provider-dashboard alleen voor disputes/uitbetalingen.
- **Optioneel:** nachtelijke reconciliatie-routine, API's ophalen, tegen DB leggen, Telegram-piep bij verschil.

## Opzegging, verlenging en consumentenrecht

**Het huidige `app/voorwaarden/page.tsx` artikel 7 klopt niet voor de B2C-situatie en moet aangepast:**

- Artikel 7(b) legt op maandabonnementen een opzegtermijn van één kalendermaand op mét doorbetaling van de tussenliggende maand. Dat botst met "Maandelijks opzegbaar" op `/prijzen` (art. `app/prijzen/page.tsx` regel ~92 en `PrijzenClient.tsx`). Intern tegenstrijdig; maak claim en clausule gelijk.
- Artikel 7(b2): jaarabonnement, 2 maanden opzegtermijn, anders automatische verlenging met een jaar. **Voor consumenten waarschijnlijk nietig** (Wet Van Dam / art. 6:236 BW): een stilzwijgend verlengd consumentenabonnement moet ná de eerste termijn op elk moment opzegbaar zijn met max. één maand opzegtermijn, en mag niet automatisch met een vast jaar verlengen.

**Richting (onder voorbehoud van de juridische review):**
- **Basic/Pro maandelijks:** echt maandelijks opzegbaar. Opzeggen wanneer je wilt, toegang tot eind lopende betaalde maand, geen verlenging, geen tussenliggende-maand-heffing.
- **Basic/Pro jaarlijks (consument):** geen gedwongen nieuw jaar. Toegang tot eind betaalde jaar, daarna stopt het tenzij de klant zelf opnieuw afsluit. Of: verlengt automatisch maar op elk moment opzegbaar tegen de eerstvolgende verlenging.
- **Team (B2B):** 2 maanden opzegtermijn + jaarverlenging mag blijven, in de Team-specifieke voorwaarden.
- **14-dagen herroepingsrecht** geldt voor consumenten, met de uitzondering voor digitale content als de klant vóór afloop begint met gebruiken en daar in de checkout expliciet afstand van doet.
- **Auto-verleng-disclosure** duidelijk in de checkout: dat het verlengt, de prijs, hoe je opzegt.

**Stripe doet de mechanica** (auto-renew, `cancel_at_period_end`, `cancel_at` op een specifieke datum). De *regel* (opzegtermijn) staat in de voorwaarden; "te laat, dus nog een periode" is logica die de app bovenop Stripe zet door `cancel_at` op het eind van de volgende periode te zetten. Voor consumenten vervalt dat grotendeels omdat de gedwongen verlenging niet mag.

### Btw-weergave (besloten 2026-09-03)

- **`/prijzen` toont kale bedragen, zonder btw-vermelding.** Een blote prijs geldt voor een consument automatisch als het eindbedrag inclusief btw. Dit is compliant en het is wat B2B-leunende SaaS breed doet. Bewust géén "incl. btw"-regel eronder (eerst overwogen, verworpen: niet nodig, en niemand in dit marktsegment doet het).
- **Consument:** het bedrag op `/prijzen` is wat hij all-in betaalt. Netto voor ArnoBot is dat bedrag / 1,21 (bij Pro-jaar: €39 → €32,23 netto). Harde eis: het checkout-totaal voor een consument moet exact gelijk zijn aan de getoonde prijs, geen btw-regel eroverheen.
- **Zakelijk:** voert bij de checkout een geldig btw-nummer in en rekent af exclusief btw (het getoonde bedrag + 21%, bij Pro-jaar €47,19; bedrijf vordert terug, echte kosten €39). Netto voor ArnoBot is het volle bedrag. Vereist de juiste Stripe-instelling (prijs btw-inclusief voor consumenten, btw-exclusief zodra een btw-nummer is ingevoerd) plus btw-nummer-validatie in de checkout. Bevestigen met de boekhouder.
- **Team** is B2B-only en toont al "excl. btw" op `/team`, dat blijft.
- **Abacus (`/abacus`) modelleert de B2C-btw-haircut bewust niet.** Het volume B2C is naar verwachting een uiterst klein percentage van de omzet, dus de calculator rekent met het volle bedrag als netto. Als de B2C-mix in de praktijk substantieel blijkt, alsnog een correctiefactor toevoegen.

### Checkpoint: juridische review vóór de commerciële livegang

Harde poort. Laat een jurist (NL SaaS + consumentenrecht) nakijken:
- de aangepaste opzeg-/verlengclausules (B2C vs B2B gescheiden)
- de auto-verleng-disclosure in de checkout
- de herroepingsrecht-opt-in voor digitale content
- de `/prijzen`-claims vs de voorwaarden

En laat de boekhouder de btw-opzet bevestigen: prijs btw-inclusief voor consumenten, btw-exclusief bij een geldig btw-nummer, OSS-drempel voor EU-consumenten, factuurvereisten.

## Fasering en tijdsindicatie (Stripe, EU)

Bouwtijd met Claude Code, bij gestage inzet:

| Fase | Inhoud | Grofweg |
|---|---|---|
| Account (Arno, parallel) | Stripe-verificatie, bankrekening, Stripe Tax, OSS-registratie voorbereiden, producten + prijzen, factuurbranding | 2-4 dagen eigen tijd, deels wachten op verificatie |
| 0 | DB-migratie (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`), `lib/payments.ts`-adapterskelet | ~1 dag |
| 1 | Basic/Pro: Checkout-flow, webhook, trial → betaald (`trial_period_days`), Customer Portal vanaf `/bot/account`, toegangslogica | ~1 week |
| 1b | Team maandelijks: per-seat abonnement (€97 + €49 × seats). Start met vaste quantity die Arno in het dashboard aanpast; auto seat-sync (`/bot/team` → Stripe) later | ~1-2 dagen |
| 1c | Team jaarlijks: `send_invoice`-abonnement, bankoverschrijving, proration voor mid-jaar seats | ~1-2 dagen |
| 2 | Stripe Tax + Invoicing config, factuur-PDF, "geen geldig btw-nummer"-afhandeling, herroepings-opt-in, auto-verleng-disclosure | ~2 dagen |
| Test | Test-mode, mislukte betaling, opzeggen mid-periode, upgrade/downgrade, btw-nummer-invoer, webhook replay, staging-soak | ~3-5 dagen |

**Realistische kalendertijd voor de volledige Stripe-integratie: ~4 tot 6 weken** bij gestage inzet, plus de juridische review parallel.

**Over de 30-dagen-druk:** die is zachter dan hij lijkt. De handmatige flow (`/api/admin/payment`) blijft werken als vangnet. Ga commercieel op je eigen moment, factureer de eerste trials desnoods een maand handmatig, en cut naar Stripe zodra het een week probleemloos op staging draait. Race geen betaalintegratie tegen een afteller met het geld van echte klanten erin.

## Ontsluit bij livegang

Zodra Stripe live is en `bedrag`/`interval` per gebruiker gevuld worden:

- **Dunning-flow** (`project_dunning_flow` in geheugen) — wachtte hierop.
- **Referral-tegoed 3-maanden-regel** ([[project_referral_credit_automation]]) — vereist recurring-betaalhistorie, die is er dan.
- **PostHog Data Warehouse Stripe-connector** — geblokkeerd tot er een provider is.
- **MRR op `/bot/admin/stats`** — geen schatting meer nodig.
- **Voice fase 3 / pricingpagina** (`VOICE_PLAN.md`) — blokkeerde op de betaalprovider-keuze.

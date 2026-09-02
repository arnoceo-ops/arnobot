# Betaalprovider en facturatie

## Statusblok

- **Laatst bijgewerkt:** 2026-09-02
- **Waar we staan:** besluit genomen, nog niks gebouwd. Betaalverwerking staat bewust achteraan in de bouwvolgorde (`ABONNEMENTEN.md`). Alle betalingen lopen nu handmatig via `/bot/admin/gebruikers` → `POST /api/admin/payment`.
- **Eerstvolgende stap:** niets, tot de NL-livegang dichtbij is. Dan fase 1 (Stripe) bouwen volgens de scope hieronder.

## Besluit (2026-09-02)

**Twee providers, gesplitst op geografie:**

| Markt | Provider | Waarom |
|---|---|---|
| Nederland (nu) | **Stripe** (via Stripe Payments Europe Ltd, Dublin) + Stripe Tax | Goedkoop op de thuismarkt (~1,5% + €0,25 vs 5% + $0,50 bij een MoR), EU-entiteit, ecosysteemstandaard. Stripe is geen merchant of record: btw-afdracht en de kwartaal-ICP-opgaaf doet Arno zelf. |
| Rest van de wereld (bij internationale livegang) | **Paddle** (merchant of record, VK) | Paddle wordt juridisch de verkoper en regelt btw/sales-tax registratie en afdracht wereldwijd (EU, VK, VS 40+ staten, meer), plus compliant facturen incl. EU B2B reverse-charge. Arno krijgt een netto uitbetaling en raakt de mondiale belasting nooit aan. |

**Sequentieel bouwen:** eerst Stripe (NL-launch), Paddle erbij wanneer de Engelse site live gaat. De adapter (zie architectuur) maakt "Paddle erbij" een vertaalklus van ~1-2 dagen, geen herbouw.

### Verworpen alternatieven

- **Eén MoR voor alles (Paddle, ook NL).** Simpelst om te draaien, maar ~3,5 procentpunt extra op elke NL-transactie, structureel. Bij reële NL-omzet weegt dat niet op tegen een integratie van 1-2 dagen plus lichte reconciliatie-wrijving.
- **Alleen Stripe, wereldwijd.** Goedkoopste fees, maar dan registreert en draagt Arno zelf btw/sales-tax af in elk rechtsgebied (of via een betaalde filing-partner). Als solo-operatie te veel. Precies waarvoor een MoR bestaat.
- **Mollie.** Nederlands, maar een PSP, geen merchant of record: je blijft zelf de verkoper voor de btw. Lost het belastingprobleem niet op. Bovendien door Arno uitgesloten.
- **Lemon Squeezy als MoR i.p.v. Paddle.** Sinds juli 2024 overgenomen door Stripe, wordt "Stripe Managed Payments". Een integratie bouwen op een product in transitie = risico op herbouw richting de Stripe-migratie. Paddle is zelfstandig en stabiel sinds 2012, en sterker op EU B2B-facturatie.

### Aanname achter de fasering

"Wanneer ik internationaal ga ben ik geen solopreneur meer" (Arno, 2026-09-02). De complexere opzet (tweede provider, land-routing, twee reconciliatie-stromen) valt dus samen met het moment dat er meer handen zijn. Als dat niet uitkomt: de fasering heroverwegen, niet blind Paddle erbij bouwen in je eentje.

## Architectuur

**Eén dunne adapter `lib/payments.ts`.** De rest van de app (approved_users bijwerken, referral-conversie, stats, e-mails) weet niet welke provider erachter zit.

- **Checkout-routing op land:** NL → Stripe-checkout, rest → Paddle-checkout. Gebeurt op `/prijzen` en `/bot/doorgaan`. Als de Engelse site dezelfde Next.js-app is op een tweede domein, is dit gedeelde code en is de routing feitelijk "welk domein / welk land".
- **Twee webhook-routes** (`/api/webhooks/stripe`, `/api/webhooks/paddle`), allebei: signature verifiëren → provider-event parsen → mappen naar één intern `subscription_changed`-event → dat schrijft naar `approved_users` (`paid_at`, `plan`, `expires_at`, `bedrag`, `interval`) en zet `arnobot_referrals.status` op `converted` bij een premium/team-betaling (zelfde logica als nu in `app/api/admin/payment/route.ts`, die als handmatige fallback kan blijven).
- **Unified admin-view:** MRR, churn en mislukte betalingen komen uit de eigen tabellen, niet uit de provider-dashboards. `/bot/admin/stats` is de plek (wacht hier al op: MRR wordt bewust niet geschat tot `bedrag`/`interval` gevuld zijn). Provider-dashboards alleen voor provider-specifiek gedoe (disputes, uitbetalingen).
- **Optioneel:** nachtelijke reconciliatie-routine die beide API's ophaalt, tegen de DB legt en via Telegram piept bij een verschil.

## NL-specifieke aandachtspunten (Stripe, geen MoR)

- **Kwartaal-ICP-opgaaf (EC Sales List)** voor de EU-B2B-verkopen met reverse-charge: Stripe levert de data, Arno dient in bij de Belastingdienst.
- **"Geen geldig btw-nummer"-afhandeling in de checkout:** bij een niet-NL EU-klant zonder gevalideerd btw-nummer óf NL 21% rekenen, óf blokkeren. Boven de €10k grensoverschrijdende B2C-omzet zou OSS-registratie nodig zijn, dus dit pad moet dichtgetimmerd.
- **Stripe Tax** aanzetten voor de btw-berekening en de reverse-charge-notering op de factuur.
- **Stripe Invoicing / factuur-PDF** met ArnoBot's bedrijfs- en btw-gegevens.

## Ontsluit bij livegang

Zodra Stripe live is en `bedrag`/`interval` per gebruiker gevuld worden:

- **Dunning-flow** (`project_dunning_flow` in geheugen) — wachtte hierop.
- **Referral-tegoed 3-maanden-regel** — vereist recurring-betaalhistorie, die is er dan.
- **PostHog Data Warehouse Stripe-connector** — geblokkeerd tot er een provider is.
- **MRR op `/bot/admin/stats`** — geen schatting meer nodig.

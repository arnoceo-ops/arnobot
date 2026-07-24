import { berekenCommandPrijs, type Cyclus, type CommandNiveau } from '@/lib/commandPricing'

const DOCUSEAL_TEMPLATE_ID = 5160507
const DOCUSEAL_API_URL = 'https://api.docuseal.com/submissions'

// Geen "(excl. btw)"-achtervoegsel hier, de offertetekst zelf zegt dat al
// in de zin eromheen ("De investering: ..., exclusief btw, voor...").
function prijsTekstVoorOfferte(seats: number, cyclus: Cyclus, niveau: CommandNiveau): string {
  const prijs = berekenCommandPrijs(seats, cyclus, niveau)
  if (prijs === null) return 'Op maat, we stellen een voorstel voor je op'
  return `€${prijs} ${cyclus === 'jaarlijks' ? 'per jaar' : 'per maand'}`
}

function voordelenTekst(niveau: CommandNiveau): string {
  if (niveau === 'elite') {
    return 'Elk teamlid krijgt hetzelfde als bij Premium: onbeperkt sparren tegen een realistische tegenspeler, direct concreet coachingsadvies na elk gesprek, een geheugen dat elk gesprek laat voortbouwen op het vorige, gesproken antwoorden, en een compleet archief. Daarbovenop krijgt iedereen iets wat verder gaat dan software: maandelijks een persoonlijk gesprek met mij, rechtstreeks contact via Telegram als er iets speelt, en toegang tot de Elite Member Community.'
  }
  return 'Elk teamlid krijgt een eigen ArnoBot-account: onbeperkt sparren tegen een realistische tegenspeler, net zo lastig als een echte prospect, zodat niemand voor het eerst improviseert als het er echt toe doet. Na elk gesprek direct concreet, actiegericht coachingsadvies, geen vage tips maar iets waar ze morgen mee verder kunnen. ArnoBot onthoudt elk gesprek, dus elk volgend gesprek bouwt voort op het vorige. En omdat niet iedereen evenveel zin heeft om te lezen: gesproken antwoorden, gewoon beluisteren. Alles staat terug te vinden in een compleet archief van hun groei.'
}

function looptijdTekst(cyclus: Cyclus): string {
  if (cyclus === 'jaarlijks') {
    return 'Dit is een jaarabonnement met een looptijd van twaalf maanden vanaf de ingangsdatum. Zeg je niet uiterlijk twee maanden vóór het einde van die twaalf maanden op, dan wordt de overeenkomst automatisch met een jaar verlengd.'
  }
  return 'Dit loopt maandelijks door, je zit hier niet aan vast. Opzegtermijn is één kalendermaand.'
}

function formatDatumNL(date: Date): string {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export async function maakCommandOfferte(params: {
  requestId: number
  bedrijfsnaam: string
  kvkNummer: string | null
  btwNummer: string | null
  factuuradres: string | null
  postcode: string | null
  plaats: string | null
  aanvragerNaam: string
  functie: string | null
  email: string
  telefoon: string | null
  bestelnummer: string | null
  aantalSeats: number
  niveau: CommandNiveau
  cyclus: Cyclus
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.DOCUSEAL_API_KEY
  if (!apiKey) return { ok: false, error: 'DOCUSEAL_API_KEY ontbreekt' }

  const vandaag = new Date()
  const geldigTot = new Date(vandaag.getTime() + 30 * 24 * 60 * 60 * 1000)

  const values = {
    aanvrager_naam: params.aanvragerNaam,
    bedrijfsnaam: params.bedrijfsnaam,
    kvk_nummer: params.kvkNummer || '',
    btw_nummer: params.btwNummer || '',
    factuuradres: params.factuuradres || '',
    postcode: params.postcode || '',
    plaats: params.plaats || '',
    functie: params.functie || '',
    email: params.email,
    telefoon: params.telefoon || '',
    bestelnummer: params.bestelnummer || '',
    niveau: params.niveau === 'elite' ? 'Elite' : 'Premium',
    aantal_seats: String(params.aantalSeats),
    cyclus: params.cyclus,
    prijs_per_maand: prijsTekstVoorOfferte(params.aantalSeats, params.cyclus, params.niveau),
    voordelen_tekst: voordelenTekst(params.niveau),
    looptijd_tekst: looptijdTekst(params.cyclus),
    offertenummer: `CMD-${params.requestId}`,
    offerte_datum: formatDatumNL(vandaag),
    geldig_tot: formatDatumNL(geldigTot),
  }

  try {
    const res = await fetch(DOCUSEAL_API_URL, {
      method: 'POST',
      headers: { 'X-Auth-Token': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: DOCUSEAL_TEMPLATE_ID,
        send_email: true,
        submitters: [
          { role: 'Klant', email: params.email, name: params.aanvragerNaam, values },
        ],
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `DocuSeal ${res.status}: ${detail}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Onbekende fout' }
  }
}

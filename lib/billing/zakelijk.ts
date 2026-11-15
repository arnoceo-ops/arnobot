import { controleerBtwBijVies, isKvkFormaat, isNlBtwFormaat, normaliseerBtwNummer, normaliseerPostcode } from '@/lib/billing/btwNummer'

// Eén plek voor de regels van zakelijke gegevens bij afrekenen: gebruikt door /api/bot/checkout
// (Basic en Pro) en door het zelf activeren van een Team (lib/teamActivatie.ts). Zo blijven de
// regels en de meldingen gelijk en loopt het ene pad niet achter op het andere.

export type ZakelijkeGegevens = {
  bedrijfsnaam: string
  kvk: string
  btw: string
  btwGevalideerd: boolean
  straat: string
  postcode: string
  plaats: string
}

export type ZakelijkInvoer = {
  bedrijfsnaam?: unknown
  kvk?: unknown
  btwNummer?: unknown
  straat?: unknown
  postcode?: unknown
  plaats?: unknown
}

export type ZakelijkUitkomst = { ok: true; gegevens: ZakelijkeGegevens } | { ok: false; fout: string }

export async function valideerZakelijk(i: ZakelijkInvoer): Promise<ZakelijkUitkomst> {
  const naam = typeof i.bedrijfsnaam === 'string' ? i.bedrijfsnaam.trim() : ''
  const kvkNr = typeof i.kvk === 'string' ? i.kvk.replace(/\s/g, '') : ''
  const btwRaw = typeof i.btwNummer === 'string' ? i.btwNummer : ''
  if (naam.length < 2 || naam.length > 120) return { ok: false, fout: 'Vul de bedrijfsnaam in' }
  if (!isKvkFormaat(kvkNr)) return { ok: false, fout: 'Een KvK-nummer heeft 8 cijfers' }
  if (/^BE/i.test(normaliseerBtwNummer(btwRaw))) {
    return { ok: false, fout: 'Je hebt een Belgisch BTW-nummer. Voor Belgische bedrijven regelen we het afrekenen persoonlijk, omdat de BTW dan wordt verlegd. Mail naar admin@arno.bot, dan helpen we je snel verder.' }
  }
  if (!isNlBtwFormaat(btwRaw)) {
    return { ok: false, fout: 'Vul een Nederlands BTW-nummer in (NL123456789B01). Heb je een buitenlands nummer, mail dan admin@arno.bot' }
  }
  // In testmodus (test_-sleutel, alleen eigenaar en testaccounts) slaan we de VIES-controle over,
  // zodat zakelijk afrekenen te testen is zonder een echt btw-nummer.
  const check = process.env.MOLLIE_API_KEY?.startsWith('test_') ? 'onbekend' : await controleerBtwBijVies(btwRaw)
  if (check === 'ongeldig') return { ok: false, fout: 'Dit BTW-nummer is niet geldig' }
  // Een factuur aan een bedrijf moet het adres van het bedrijf bevatten.
  const straatNaam = typeof i.straat === 'string' ? i.straat.trim() : ''
  const plaatsNaam = typeof i.plaats === 'string' ? i.plaats.trim() : ''
  const postcodeNorm = typeof i.postcode === 'string' ? normaliseerPostcode(i.postcode) : null
  if (straatNaam.length < 3 || straatNaam.length > 100) return { ok: false, fout: 'Vul de straat en het huisnummer in' }
  if (!postcodeNorm) return { ok: false, fout: 'Vul een geldige postcode in (bijvoorbeeld 1234 AB)' }
  if (plaatsNaam.length < 2 || plaatsNaam.length > 80) return { ok: false, fout: 'Vul de plaats in' }
  return {
    ok: true,
    gegevens: { bedrijfsnaam: naam, kvk: kvkNr, btw: normaliseerBtwNummer(btwRaw), btwGevalideerd: check === 'geldig', straat: straatNaam, postcode: postcodeNorm, plaats: plaatsNaam },
  }
}

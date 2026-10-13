import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { vindTeCorrigerenAbonnement, startKlanttypeCorrectie } from '@/lib/billing/klanttypeCorrectie'
import { berekenBedrag, planNaam } from '@/lib/billing/prijzen'
import { controleerBtwBijVies, isKvkFormaat, isNlBtwFormaat, normaliseerBtwNummer, normaliseerPostcode } from '@/lib/billing/btwNummer'

const fout = (status: number, error: string) => NextResponse.json({ error }, { status })

/** Huidig te corrigeren abonnement, voor de pagina zelf. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')

  const gevonden = await vindTeCorrigerenAbonnement(userId)
  if (!gevonden) return NextResponse.json({ abonnement: null })

  const { sub } = gevonden
  const zakelijkBedrag = berekenBedrag(sub.plan, sub.cyclus, 'zakelijk')
  const verschilCent = zakelijkBedrag.brutoCent - sub.bedrag_cent
  return NextResponse.json({
    abonnement: {
      planNaam: planNaam(sub.plan),
      cyclus: sub.cyclus,
      betaaldCent: sub.bedrag_cent,
      verschilCent: Math.max(0, verschilCent),
    },
  })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fout(400, 'Ongeldig verzoek')
  const { bedrijfsnaam, kvk, btwNummer, straat, postcode, plaats } = body as Record<string, unknown>

  const naam = typeof bedrijfsnaam === 'string' ? bedrijfsnaam.trim() : ''
  const kvkNr = typeof kvk === 'string' ? kvk.replace(/\s/g, '') : ''
  const btwRaw = typeof btwNummer === 'string' ? btwNummer : ''
  const straatNaam = typeof straat === 'string' ? straat.trim() : ''
  const plaatsNaam = typeof plaats === 'string' ? plaats.trim() : ''
  const postcodeNorm = typeof postcode === 'string' ? normaliseerPostcode(postcode) : null

  if (naam.length < 2 || naam.length > 120) return fout(400, 'Vul de bedrijfsnaam in')
  if (!isKvkFormaat(kvkNr)) return fout(400, 'Een KvK-nummer heeft 8 cijfers')
  if (/^BE/i.test(normaliseerBtwNummer(btwRaw))) {
    return fout(400, 'Je hebt een Belgisch btw-nummer. Mail naar admin@arno.bot, dan helpen we je verder.')
  }
  if (!isNlBtwFormaat(btwRaw)) return fout(400, 'Vul een Nederlands btw-nummer in (NL123456789B01)')
  const check = process.env.MOLLIE_API_KEY?.startsWith('test_') ? 'onbekend' : await controleerBtwBijVies(btwRaw)
  if (check === 'ongeldig') return fout(400, 'Dit btw-nummer is niet geldig')
  if (straatNaam.length < 3 || straatNaam.length > 100) return fout(400, 'Vul de straat en het huisnummer in')
  if (!postcodeNorm) return fout(400, 'Vul een geldige postcode in (bijvoorbeeld 1234 AB)')
  if (plaatsNaam.length < 2 || plaatsNaam.length > 80) return fout(400, 'Vul de plaats in')

  const gevonden = await vindTeCorrigerenAbonnement(userId)
  if (!gevonden) return fout(404, 'Geen particulier abonnement gevonden om te corrigeren')

  const resultaat = await startKlanttypeCorrectie({
    userId,
    sub: gevonden.sub,
    payment: gevonden.payment,
    bedrijfsnaam: naam,
    kvkNummer: kvkNr,
    btwNummer: normaliseerBtwNummer(btwRaw),
    straat: straatNaam,
    postcode: postcodeNorm,
    plaats: plaatsNaam,
  })
  if ('fout' in resultaat) return fout(400, resultaat.fout)
  return NextResponse.json(resultaat)
}

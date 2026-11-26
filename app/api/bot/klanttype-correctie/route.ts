import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { klanttypeCorrectieBeschikbaarVoor, vindTeCorrigerenAbonnement, startKlanttypeCorrectie } from '@/lib/billing/klanttypeCorrectie'
import { planNaam } from '@/lib/billing/prijzen'
import { zakelijkBedragVan } from '@/lib/billing/klanttypeOmzetten'
import { redenGeenZelfCorrectie } from '@/lib/billing/referralKorting'
import { controleerBtwBijVies, isKvkFormaat, isNlBtwFormaat, normaliseerBtwNummer, normaliseerPostcode } from '@/lib/billing/btwNummer'

const fout = (status: number, error: string) => NextResponse.json({ error }, { status })

/** Huidig te corrigeren abonnement, voor de pagina zelf. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return fout(401, 'Niet ingelogd')

  const gevonden = klanttypeCorrectieBeschikbaarVoor(userId) ? await vindTeCorrigerenAbonnement(userId) : null
  if (!gevonden) return NextResponse.json({ abonnement: null })

  const { sub } = gevonden
  const zakelijkBedrag = zakelijkBedragVan(sub.bedrag_cent)
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
    return fout(400, 'Je hebt een Belgisch BTW-nummer. Mail naar admin@arno.bot, dan helpen we je verder.')
  }
  if (!isNlBtwFormaat(btwRaw)) return fout(400, 'Vul een Nederlands BTW-nummer in (NL123456789B01)')
  const check = process.env.MOLLIE_API_KEY?.startsWith('test_') ? 'onbekend' : await controleerBtwBijVies(btwRaw)
  if (check === 'ongeldig') return fout(400, 'Dit BTW-nummer is niet geldig')
  if (straatNaam.length < 3 || straatNaam.length > 100) return fout(400, 'Vul de straat en het huisnummer in')
  if (!postcodeNorm) return fout(400, 'Vul een geldige postcode in (bijvoorbeeld 1234 AB)')
  if (plaatsNaam.length < 2 || plaatsNaam.length > 80) return fout(400, 'Vul de plaats in')

  const gevonden = klanttypeCorrectieBeschikbaarVoor(userId) ? await vindTeCorrigerenAbonnement(userId) : null
  if (!gevonden) return fout(404, 'Geen particulier abonnement gevonden om te corrigeren')

  // De correctie rekent met de volle abonnementsprijs en crediteert alleen de laatste betaling.
  let reden: Awaited<ReturnType<typeof redenGeenZelfCorrectie>>
  try {
    reden = await redenGeenZelfCorrectie(gevonden.sub.id)
  } catch (e) {
    console.error('[klanttype-correctie] controle mislukt', e instanceof Error ? e.message : e)
    return fout(500, 'Dat lukt nu even niet. Probeer het later opnieuw.')
  }
  if (reden === 'referral_fee') return fout(400, 'Op je eerste betaling zit een referral fee. Mail naar admin@arno.bot, dan passen we het voor je aan.')
  if (reden === 'upgrade') return fout(400, 'Je hebt tussentijds geüpgraded. Mail even naar admin@arno.bot, dan regelen we het voor je.')

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

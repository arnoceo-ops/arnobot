import { NextRequest, NextResponse } from 'next/server'
import { controleerMobielToegang } from '@/lib/adminMobiel'
import { isAbonnement, stuurPush, verwijderAbonnementen, voegAbonnementToe, zetBevestigd } from '@/lib/adminPush'

// Pushmeldingen aan- en uitzetten vanuit de admin-app (/bot/admin/mobiel). Zelfde Clerk-toegangscontrole
// als die pagina: alleen Arno's account kan een telefoon aanmelden.
export async function POST(req: NextRequest) {
  const toegang = await controleerMobielToegang()
  if (!toegang.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  try {
    if (body?.actie === 'aanmelden' && isAbonnement(body.abonnement)) {
      await voegAbonnementToe(body.abonnement)
    } else if (body?.actie === 'afmelden' && typeof body.endpoint === 'string') {
      await verwijderAbonnementen([body.endpoint])
      await zetBevestigd(false)
    } else if (body?.actie === 'proef') {
      const verstuurd = await stuurPush({ titel: 'Proefmelding', tekst: 'Zie je dit? Tik dan in de app op IK ZIE DE MELDING.', tag: 'proef' })
      if (verstuurd === 0) return NextResponse.json({ error: 'Versturen mislukt' }, { status: 502 })
    } else if (body?.actie === 'bevestig') {
      await zetBevestigd(true)
    } else {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin/mobiel/push]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminKeyMatches } from '@/lib/adminAuth'
import { logAdminActie } from '@/lib/adminLog'
import { zetBetaaldPerBank, zetTeruggedraaid } from '@/lib/billing/teamBetalingen'
import { nlVandaag } from '@/lib/nlTijd'

// Handmatige acties op een teamfactuur. Beide leggen alleen vast wat er buiten Mollie om is gebeurd.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!adminKeyMatches(cookieStore.get('arnobot_admin')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const factuurId = typeof body?.factuurId === 'string' ? body.factuurId : ''
  const actie = body?.actie
  if (!factuurId || (actie !== 'betaald_bank' && actie !== 'teruggedraaid')) {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 })
  }

  const datum = typeof body.betaaldOp === 'string' ? body.betaaldOp : ''
  if (actie === 'betaald_bank' && (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(datum)) || datum > nlVandaag())) {
    return NextResponse.json({ error: 'Kies de datum waarop het geld binnenkwam' }, { status: 400 })
  }

  const uitkomst = actie === 'betaald_bank'
    ? await zetBetaaldPerBank(factuurId, new Date(`${datum}T12:00:00Z`))
    : await zetTeruggedraaid(factuurId)
  if (!uitkomst.ok) return NextResponse.json({ error: uitkomst.fout }, { status: uitkomst.status })

  await logAdminActie({
    actie: actie === 'betaald_bank' ? 'team_factuur_betaald_bank' : 'team_factuur_teruggedraaid',
    doelTeamId: uitkomst.teamId,
    details: { extra: { factuurId, bedrag_cent: uitkomst.bedragCent, ...(actie === 'betaald_bank' ? { betaald_op: datum } : {}) } },
  })
  return NextResponse.json({ ok: true, waarschuwing: uitkomst.waarschuwing })
}

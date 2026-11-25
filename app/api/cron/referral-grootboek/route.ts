import { NextRequest, NextResponse } from 'next/server'
import { registreerCronRun } from '@/lib/cronRun'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { wieIs } from '@/lib/billing/wie'
import { draaiGrootboek, nieuweMijlpalen, regelTekst } from '@/lib/billing/referralGrootboek'

// Dagelijks grootboek van het referraltegoed, MEELOPEND (docs/REFERRAL_AUTOMATISERING.md). Draait na de billing- en
// teamfacturatiecron, zodat de betalingen van vandaag verwerkt zijn. Verandert niets behalve het grootboek zelf en
// stuurt alleen Arno een melding, en alleen als er iets nieuws is.
const MAX_REGELS_PER_MELDING = 20

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const run = await draaiGrootboek(new Date(), { schrijf: true })
    if (run.migratieOntbreekt) return NextResponse.json({ ok: true, overgeslagen: 'tabel ontbreekt' })

    if (run.nieuw.length || run.fouten.length) {
      const regels = await Promise.all(run.nieuw.slice(0, MAX_REGELS_PER_MELDING)
        .map(async r => regelTekst(r, await wieIs(r.aanbrenger_user_id), await wieIs(r.klant_user_id))))
      if (run.nieuw.length > MAX_REGELS_PER_MELDING) regels.push(`En nog ${run.nieuw.length - MAX_REGELS_PER_MELDING} regels, zie het overzicht.`)
      for (const m of nieuweMijlpalen(run.regels, run.nieuw)) regels.push(`Mijlpaal: ${m} toekenningen.`)
      if (run.fouten.length) regels.push(`Niet te beoordelen (morgen opnieuw):\n${run.fouten.slice(0, 5).join('\n')}`)
      await notifyTelegram(`Referraltegoed op arno.bot, meeloopstand: er verandert niets aan tegoed of geld\n\n${regels.join('\n\n')}\n\nhttps://www.arno.bot/bot/admin/referrals`)
    }
    return NextResponse.json({ ok: true, referrals: run.referrals.length, nieuw: run.nieuw.length, fouten: run.fouten.length })
  } catch (e) {
    await notifyCronFailure('referral-grootboek', e)
    return NextResponse.json({ error: 'Referralgrootboek mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/referral-grootboek', cronHandler)

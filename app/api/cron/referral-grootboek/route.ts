import { NextRequest, NextResponse } from 'next/server'
import { registreerCronRun } from '@/lib/cronRun'
import { notifyCronFailure, notifyTelegram } from '@/lib/cron-notify'
import { wieRef } from '@/lib/billing/wie'
import { MEELOOP, draaiGrootboek, nieuweMijlpalen, regelTekst } from '@/lib/billing/referralGrootboek'
import { splitsBericht } from '@/lib/billing/berichtDelen'
import { herstelGratisKenmerken } from '@/lib/billing/gratisHerstel'
import * as Sentry from '@sentry/nextjs'

// Dagelijks grootboek van het referraltegoed, meelopend tot REFERRAL_GROOTBOEK_ECHT (docs/REFERRAL_AUTOMATISERING.md). Draait na de billing- en
// teamfacturatiecron, zodat de betalingen van vandaag verwerkt zijn. Verandert niets behalve het grootboek zelf en
// stuurt alleen Arno een melding, en alleen als er iets nieuws is.

async function cronHandler(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Eerst het vangnet voor het gratis kenmerk: het grootboek leest dat kenmerk.
    const gratis = await herstelGratisKenmerken()
    const run = await draaiGrootboek(new Date(), { schrijf: true })
    run.fouten.push(...gratis.fouten)
    if (run.migratieOntbreekt) return NextResponse.json({ ok: true, overgeslagen: 'tabel ontbreekt' })

    if (run.nieuw.length || run.fouten.length) {
      const regels = await Promise.all(run.nieuw.map(async r => regelTekst(r, wieRef(r.aanbrenger_user_id), wieRef(r.klant_user_id))))
      for (const m of nieuweMijlpalen(run.regels, run.nieuw)) regels.push(`Mijlpaal: ${wieRef(m.aanbrengerId)} heeft ${m.aantal} toekenningen.`)
      if (run.fouten.length) regels.push(`Niet te beoordelen (morgen opnieuw):\n${run.fouten.slice(0, 5).join('\n')}`)
      const delen = splitsBericht(MEELOOP ? 'Referraltegoed op arno.bot, meeloopstand: er verandert niets aan tegoed of geld' : 'Referraltegoed op arno.bot', regels, 'https://www.arno.bot/bot/admin/referrals')
      let mislukt = 0
      for (const deel of delen) if ((await notifyTelegram(deel)) === false) mislukt++
      if (mislukt) {
        // De regels staan al in het grootboek en komen niet opnieuw: de run telt als mislukt, zodat het opvalt.
        Sentry.captureMessage('Referralgrootboek: Telegrammelding niet aangekomen', { level: 'error', extra: { mislukt, delen: delen.length } })
        return NextResponse.json({ error: 'Melding niet verstuurd' }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true, referrals: run.referrals.length, nieuw: run.nieuw.length, fouten: run.fouten.length })
  } catch (e) {
    await notifyCronFailure('referral-grootboek', e)
    return NextResponse.json({ error: 'Referralgrootboek mislukt' }, { status: 500 })
  }
}

export const GET = registreerCronRun('/api/cron/referral-grootboek', cronHandler)

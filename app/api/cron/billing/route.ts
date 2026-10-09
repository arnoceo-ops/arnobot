import { NextRequest, NextResponse } from 'next/server'
import { billingDb, type PayRow, type SubRow } from '@/lib/billing/db'
import { lijstRecenteTerugbetalingen, mollieIngeschakeld } from '@/lib/billing/mollie'
import { herinneringenDue, moetMollieAbonnementNuStoppen, toegangTot } from '@/lib/billing/perioden'
import { maakMollieAbonnementVoor, markeerTerugbetaald, stopMollieAbonnement, verwerkMolliebetaling } from '@/lib/billing/verwerking'
import { verstuurBillingMail } from '@/lib/billing/mails'
import { planNaam } from '@/lib/billing/prijzen'
import { mollieNaarCenten } from '@/lib/billing/geld'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { notifyCronFailure } from '@/lib/cron-notify'

const iso = (d: Date) => d.toISOString()
const MIN_MS = 60 * 1000

// Dagelijkse onderhoudsronde voor het online abonnementenstelsel:
//  1. gemiste webhooks inhalen (openstaande of half verwerkte betalingen opnieuw ophalen)
//  2. ontbrekende Mollie-abonnementen alsnog aanmaken
//  3. opgezegde abonnementen stopzetten zodra er niets meer verschuldigd is
//  4. verlengherinneringen (particulier, 30 en 7 dagen vóór het einde)
//  5. verlopen abonnementen afsluiten en de afscheidsmail sturen
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!mollieIngeschakeld()) return NextResponse.json({ ok: true, overgeslagen: 'mollie niet ingeschakeld' })

  const samenvatting = { betalingenOpnieuw: 0, terugbetalingen: 0, abonnementenHersteld: 0, abonnementenGestopt: 0, herinneringen: 0, afgesloten: 0, fouten: 0 }
  try {
    const nu = new Date()

    // 1. Gemiste webhooks: alles wat open staat of betaald is maar niet verwerkt, en niet
    // meer heel vers is (anders loopt de cron de eigen webhook voor).
    const { data: openstaand } = await billingDb
      .from('arnobot_payments')
      .select('mollie_payment_id, user_id')
      .or('status.in.(open,pending,authorized),and(status.eq.paid,verwerkt_at.is.null)')
      .gt('created_at', iso(new Date(nu.getTime() - 3 * 24 * 60 * MIN_MS)))
      .lt('created_at', iso(new Date(nu.getTime() - 15 * MIN_MS)))
      .returns<Pick<PayRow, 'mollie_payment_id' | 'user_id'>[]>()
    for (const p of (openstaand ?? []).filter(p => !isInternalTestUser(p.user_id))) {
      try { await verwerkMolliebetaling(p.mollie_payment_id); samenvatting.betalingenOpnieuw++ } catch { samenvatting.fouten++ }
    }

    // 1b. Terugbetalingen die buiten de admin-knop om zijn gedaan (Mollie-dashboard): een
    // volledige terugbetaling die niet is mislukt of geannuleerd beëindigt de toegang.
    const refunds = (await lijstRecenteTerugbetalingen()).filter(r => r.status !== 'failed' && r.status !== 'canceled')
    const perBetaling = new Map<string, number>()
    for (const r of refunds) perBetaling.set(r.paymentId, (perBetaling.get(r.paymentId) ?? 0) + mollieNaarCenten(r.amount.value))
    if (perBetaling.size) {
      const { data: rijen } = await billingDb
        .from('arnobot_payments')
        .select('id, user_id, mollie_payment_id, bedrag_cent')
        .in('mollie_payment_id', [...perBetaling.keys()])
        .is('terugbetaling_verwerkt_at', null)
        .returns<Pick<PayRow, 'id' | 'user_id' | 'mollie_payment_id' | 'bedrag_cent'>[]>()
      for (const r of (rijen ?? []).filter(r => !isInternalTestUser(r.user_id))) {
        if ((perBetaling.get(r.mollie_payment_id) ?? 0) >= r.bedrag_cent && (await markeerTerugbetaald(r.id))) samenvatting.terugbetalingen++
      }
    }

    const { data: subsRaw } = await billingDb
      .from('arnobot_subscriptions')
      .select('*')
      .in('status', ['active', 'cancelled'])
      .returns<SubRow[]>()
    const subs = (subsRaw ?? []).filter(s => !isInternalTestUser(s.user_id))

    for (const s of subs) {
      try {
        // 2. Ontbrekend Mollie-abonnement bij een actief, niet opgezegd abonnement.
        if (s.status === 'active' && !s.mollie_subscription_id && s.periode_start) {
          const voor = s.mollie_subscription_id
          await maakMollieAbonnementVoor(s, new Date(s.periode_start))
          const { data: nu2 } = await billingDb.from('arnobot_subscriptions').select('mollie_subscription_id').eq('id', s.id).maybeSingle<{ mollie_subscription_id: string | null }>()
          if (!voor && nu2?.mollie_subscription_id) samenvatting.abonnementenHersteld++
        }

        // 3. Opgezegd en alles wat verschuldigd was is betaald: Mollie-abonnement stoppen.
        if (
          s.status === 'cancelled' && s.mollie_subscription_id && !s.mollie_sub_geannuleerd_at &&
          s.periode_einde && s.opzegging_ingaat_at &&
          moetMollieAbonnementNuStoppen(new Date(s.periode_einde), new Date(s.opzegging_ingaat_at))
        ) {
          await stopMollieAbonnement(s)
          samenvatting.abonnementenGestopt++
        }

        // 4. Herinneringen voor particulieren die niet hebben opgezegd.
        if (s.status === 'active' && s.klant_type === 'particulier' && s.contract_einde) {
          const due = herinneringenDue(nu, new Date(s.contract_einde), {
            dertig: !!s.herinnering_30_at,
            zeven: !!s.herinnering_7_at,
          })
          for (const [soort, kolom, mail] of [
            [due.dertig, 'herinnering_30_at', 'verlenging_30d'],
            [due.zeven, 'herinnering_7_at', 'verlenging_7d'],
          ] as const) {
            if (!soort) continue
            // Eerst claimen, dan mailen: een dubbele cron-run stuurt zo nooit twee mails.
            const { data: geclaimd } = await billingDb
              .from('arnobot_subscriptions')
              .update({ [kolom]: iso(nu) })
              .eq('id', s.id)
              .is(kolom, null)
              .select('id')
            if ((geclaimd?.length ?? 0) === 1) {
              await verstuurBillingMail(s.user_id, mail, { planNaam: planNaam(s.plan), datum: s.contract_einde })
              samenvatting.herinneringen++
            }
          }
        }

        // 5. Toegang verlopen: afsluiten.
        if (s.periode_einde && toegangTot(new Date(s.periode_einde)).getTime() < nu.getTime()) {
          await stopMollieAbonnement(s)
          await billingDb.from('arnobot_subscriptions').update({ status: 'ended', updated_at: iso(nu) }).eq('id', s.id)
          samenvatting.afgesloten++

          // Geen afscheidsmail als er al een nieuw lopend abonnement is (verlenging).
          const { data: vervolg } = await billingDb
            .from('arnobot_subscriptions')
            .select('id')
            .eq('user_id', s.user_id)
            .neq('id', s.id)
            .in('status', ['active', 'cancelled'])
            .gt('periode_einde', iso(nu))
            .limit(1)
          if (!vervolg?.length) {
            const { data: geclaimd } = await billingDb
              .from('arnobot_subscriptions')
              .update({ einde_mail_at: iso(nu) })
              .eq('id', s.id)
              .is('einde_mail_at', null)
              .select('id')
            if ((geclaimd?.length ?? 0) === 1) await verstuurBillingMail(s.user_id, 'abonnement_afgelopen', {})
          }
        }
      } catch (e) {
        samenvatting.fouten++
        console.error('[cron/billing] abonnement', s.id, e instanceof Error ? e.message : e)
      }
    }

    return NextResponse.json({ ok: true, ...samenvatting })
  } catch (e) {
    await notifyCronFailure('billing', e)
    return NextResponse.json({ error: 'Billing-cron mislukt' }, { status: 500 })
  }
}

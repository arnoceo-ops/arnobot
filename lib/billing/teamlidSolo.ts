import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { stopMollieAbonnement } from './verwerking'
import { planNaam } from './prijzen'
import { notifyTelegram } from '@/lib/cron-notify'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { trialEinde } from '@/lib/toegang'

// Iemand met een eigen abonnement of proef accepteert de uitnodiging van een teammanager (docs/TEAM_LEVENSCYCLUS.md).
// Besluit Arno (2026-11-15): vanaf dat moment betaalt het team. De volgende betaling van het eigen abonnement stopt
// (de lopende betaalperiode loopt uit, geen restitutie) en een lopende proef vervalt, ook de resterende dagen. De
// gesprekshistorie blijft: het is hetzelfde account, er wordt alleen een lidmaatschap toegevoegd.
// Verworpen: alleen een melding aan Arno (de solo-klant betaalt dan dubbel tot iemand ingrijpt).
// De toestemming staat op de uitnodigingspagina vóór het joinen (app/bot/team/join/page.tsx).

export type SoloBijJoin = {
  /** gestopt: de incasso is gestopt. mislukt: Arno heeft een Telegram en stopt hem zelf. geen: er liep niets. */
  abonnement: 'geen' | 'gestopt' | 'mislukt'
  /** Alleen bij gestopt of mislukt: wat hij had, bijvoorbeeld "Basic maandelijks". */
  omschrijving?: string
  /** Tot wanneer het eigen abonnement is betaald (ISO). */
  loptTot?: string
  proefBeeindigd: boolean
  /** Betaald zonder online abonnement (handmatig BETAALD gezet): geen incasso om te stoppen, wel iets om te weten. */
  handmatigBetaald: boolean
}

/** Stopt het eigen abonnement en de eigen proef van een nieuw teamlid. Gooit nooit een fout door: joinen mag hier niet op mislukken. */
export async function stopSoloBijJoin(userId: string, teamNaam: string, nu: Date = new Date()): Promise<SoloBijJoin> {
  const leeg: SoloBijJoin = { abonnement: 'geen', proefBeeindigd: false, handmatigBetaald: false }
  if (isInternalTestUser(userId)) return leeg
  try {
    const { data: u } = await billingDb
      .from('approved_users')
      .select('voornaam, email, paid_at, expires_at, trial_start')
      .eq('user_id', userId)
      .maybeSingle<{ voornaam: string | null; email: string | null; paid_at: string | null; expires_at: string | null; trial_start: string | null }>()
    if (!u) return leeg

    const resultaat: SoloBijJoin = { ...leeg }

    // 1. Het eigen abonnement: de incasso stopt, de betaalperiode loopt uit.
    const { data: sub } = await billingDb
      .from('arnobot_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubRow>()
    if (sub) {
      resultaat.omschrijving = `${planNaam(sub.plan)} ${sub.cyclus}`
      resultaat.loptTot = sub.periode_einde ?? undefined
      const gestopt = await stopMollieAbonnement(sub)
      if (gestopt) {
        const { error } = await billingDb
          .from('arnobot_subscriptions')
          .update({ status: 'cancelled', opzegging_aangevraagd_at: nu.toISOString(), opzegging_ingaat_at: sub.periode_einde ?? nu.toISOString(), updated_at: nu.toISOString() })
          .eq('id', sub.id)
          .eq('status', 'active')
        resultaat.abonnement = error ? 'mislukt' : 'gestopt'
        if (error) Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'team-join-solo' } })
      } else {
        resultaat.abonnement = 'mislukt'
      }
    } else if (u.paid_at && !u.expires_at) {
      resultaat.handmatigBetaald = true
    }

    // 2. De eigen proef vervalt, ook de resterende dagen. Een gezette einddatum (bijvoorbeeld een betaalperiode) blijft staan.
    if (trialEinde(u, nu)) {
      const { error } = await billingDb.from('approved_users').update({ expires_at: nu.toISOString() }).eq('user_id', userId)
      if (error) Sentry.captureException(new Error(error.message), { tags: { onderdeel: 'team-join-solo' } })
      else resultaat.proefBeeindigd = true
    }

    if (resultaat.abonnement !== 'geen' || resultaat.proefBeeindigd || resultaat.handmatigBetaald) {
      const wie = `${u.voornaam ?? 'onbekend'} (${u.email ?? 'geen e-mail'})`
      const delen = [
        resultaat.abonnement === 'gestopt' ? `Eigen abonnement ${resultaat.omschrijving} gestopt, loopt t/m ${resultaat.loptTot ? new Date(resultaat.loptTot).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : 'onbekend'}, geen restitutie.`
          : resultaat.abonnement === 'mislukt' ? `Eigen abonnement ${resultaat.omschrijving} STOPPEN MISLUKT: stop het zelf in het Mollie-dashboard.`
          : null,
        resultaat.handmatigBetaald ? 'Heeft handmatig betaald (BETAALD gezet) zonder online abonnement: er is niets gestopt, zijn eigen toegang loopt door.' : null,
        resultaat.proefBeeindigd ? 'Eigen proef beëindigd, resterende dagen vervallen.' : null,
      ].filter(Boolean)
      await notifyTelegram(`Nieuw teamlid met een eigen abonnement of proef op arno.bot\n\n${wie} is lid geworden van "${teamNaam}".\n${delen.join('\n')}`)
    }
    return resultaat
  } catch (e) {
    Sentry.captureException(e, { tags: { onderdeel: 'team-join-solo' } })
    return { abonnement: 'mislukt', proefBeeindigd: false, handmatigBetaald: false }
  }
}

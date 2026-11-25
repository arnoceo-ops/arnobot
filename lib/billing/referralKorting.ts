import { billingDb, type PayRow } from './db'
import { eersteBetalingOpTijd } from './referralRegels'
import { TRIAL_DAGEN } from '@/lib/toegang'

/**
 * Heeft deze aangebrachte gebruiker nu recht op de referral fee op een jaarabonnement? Ja als: hij via een
 * referral is aangemeld, nog nooit een betaling heeft die is blijven staan (na herroeping mag het opnieuw) en nog
 * binnen de proef plus de termijn zit. Een databasefout wordt doorgegeven: nooit stil de volle prijs rekenen.
 */
export async function heeftRechtOpJaarkorting(userId: string, nu: Date = new Date()): Promise<boolean> {
  const { data: referral, error: refFout } = await billingDb
    .from('arnobot_referrals')
    .select('id')
    .eq('referred_user_id', userId)
    .maybeSingle<{ id: string }>()
  if (refFout) throw new Error(`referral opzoeken mislukt: ${refFout.message}`)
  if (!referral) return false

  const { data: betaald, error: betaalFout } = await billingDb
    .from('arnobot_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .returns<PayRow[]>()
  if (betaalFout) throw new Error(`betalingen opzoeken mislukt: ${betaalFout.message}`)
  if ((betaald ?? []).some(b => !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0))) return false

  const { data: gebruiker, error: userFout } = await billingDb
    .from('approved_users')
    .select('trial_start')
    .eq('user_id', userId)
    .maybeSingle<{ trial_start: string | null }>()
  if (userFout) throw new Error(`gebruiker opzoeken mislukt: ${userFout.message}`)
  if (!gebruiker?.trial_start) return false

  const proefEinde = new Date(Date.parse(gebruiker.trial_start) + TRIAL_DAGEN * 24 * 60 * 60 * 1000)
  return eersteBetalingOpTijd(nu.toISOString(), proefEinde.toISOString())
}

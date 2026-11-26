import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { haalAbonnement } from './mollie'
import { formatEuro, mollieNaarCenten } from './geld'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { nieuwMelden } from '@/lib/capaciteit'
import { notifyTelegram } from '@/lib/cron-notify'

// Mollie incasseert wat in het Mollie-abonnement staat, niet wat in onze database staat. Dagelijks vergelijken, voor
// het lopende en het geplande abonnement. Alleen lezen en melden (eens per week per abonnement).

/** Geeft het aantal abonnementen met een afwijkend bedrag. */
export async function controleerAbonnementsBedragen(): Promise<number> {
  const { data, error } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .in('status', ['active', 'cancelled'])
    .limit(1000)
    .returns<SubRow[]>()
  if (error) throw new Error(`abonnementen ophalen mislukt: ${error.message}`)

  let afwijkingen = 0
  let nietTeLezen = 0
  for (const s of (data ?? []).filter(s => !isInternalTestUser(s.user_id))) {
    const paren = [
      { id: s.mollie_sub_geannuleerd_at ? null : s.mollie_subscription_id, verwacht: s.bedrag_cent },
      { id: s.gepland_mollie_sub_geannuleerd_at ? null : s.gepland_mollie_subscription_id, verwacht: s.gepland_bedrag_cent },
    ]
    for (const { id, verwacht } of paren) {
      if (!id || verwacht === null || verwacht === undefined) continue
      try {
        const ms = await haalAbonnement(s.mollie_customer_id, id)
        if ((ms.status !== 'active' && ms.status !== 'pending') || !ms.amount) continue
        const werkelijk = mollieNaarCenten(ms.amount.value)
        if (werkelijk === verwacht) continue
        afwijkingen++
        if (await nieuwMelden(`billing:bedrag:${id}`, 'waarschuwing')) {
          await notifyTelegram(`Abonnementsbedrag klopt niet op arno.bot\n\nUser: ${s.user_id}\nMollie-abonnement: ${id}\nBij Mollie: ${formatEuro(werkelijk)}\nIn de database: ${formatEuro(verwacht)}\nControleer dit voor de volgende incasso.`)
        }
      } catch (e) {
        nietTeLezen++
        Sentry.captureException(e, { tags: { onderdeel: 'billing-bedragcontrole' }, extra: { abonnement: id } })
      }
    }
  }
  if (nietTeLezen > 0) throw new Error(`${nietTeLezen} abonnement(en) niet bij Mollie te lezen, zie Sentry`)
  return afwijkingen
}

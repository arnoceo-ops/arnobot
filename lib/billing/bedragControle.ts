import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { lijstKlantAbonnementen, type MollieSubscription } from './mollie'
import { formatEuro, mollieNaarCenten } from './geld'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { nieuwMelden } from '@/lib/capaciteit'
import { notifyTelegram } from '@/lib/cron-notify'

// Mollie incasseert wat in het Mollie-abonnement staat, niet wat in onze database staat. Dagelijks per klant de lijst bij
// Mollie vergelijken: klopt het bedrag, loopt wat moet lopen, en loopt er niets wat wij niet kennen? Alleen lezen en
// melden (eens per week per bevinding).

const loopt = (ms: MollieSubscription) => ms.status === 'active' || ms.status === 'pending'

/** Geeft het aantal bevindingen. */
export async function controleerAbonnementsBedragen(): Promise<number> {
  const { data, error } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .in('status', ['active', 'cancelled'])
    .limit(1000)
    .returns<SubRow[]>()
  if (error) throw new Error(`abonnementen ophalen mislukt: ${error.message}`)

  const perKlant = new Map<string, SubRow[]>()
  for (const s of (data ?? []).filter(s => !isInternalTestUser(s.user_id) && s.mollie_customer_id)) {
    perKlant.set(s.mollie_customer_id, [...(perKlant.get(s.mollie_customer_id) ?? []), s])
  }

  let bevindingen = 0
  let nietTeLezen = 0
  const meld = async (sleutel: string, tekst: string) => {
    bevindingen++
    if (await nieuwMelden(`billing:${sleutel}`, 'waarschuwing')) await notifyTelegram(tekst)
  }

  for (const [klantId, subs] of perKlant) {
    let lijst: MollieSubscription[]
    try {
      lijst = await lijstKlantAbonnementen(klantId)
    } catch (e) {
      nietTeLezen++
      Sentry.captureException(e, { tags: { onderdeel: 'billing-bedragcontrole' }, extra: { klant: klantId } })
      continue
    }
    const wie = subs[0].user_id
    const bekend = new Set<string>()
    for (const s of subs) {
      const paren = [
        { id: s.mollie_sub_geannuleerd_at ? null : s.mollie_subscription_id, verwacht: s.bedrag_cent },
        { id: s.gepland_mollie_sub_geannuleerd_at ? null : s.gepland_mollie_subscription_id, verwacht: s.gepland_bedrag_cent },
      ]
      for (const { id, verwacht } of paren) {
        if (!id) continue
        bekend.add(id)
        const ms = lijst.find(m => m.id === id)
        if (!ms || !loopt(ms)) {
          // Een verlengd particulier abonnement (met contracteinde) is na zijn laatste incasso gewoon klaar.
          if (s.status === 'active' && !s.contract_einde) {
            await meld(`weg:${id}`, `Lopend abonnement ontbreekt bij Mollie op arno.bot\n\nUser: ${s.user_id}\nMollie-abonnement: ${id}\nStand bij Mollie: ${ms?.status ?? 'niet gevonden'}\nDeze klant wordt mogelijk niet meer geïncasseerd.`)
          }
          continue
        }
        if (verwacht === null || verwacht === undefined || !ms.amount) continue
        const werkelijk = mollieNaarCenten(ms.amount.value)
        if (werkelijk !== verwacht) {
          await meld(`bedrag:${id}`, `Abonnementsbedrag klopt niet op arno.bot\n\nUser: ${s.user_id}\nMollie-abonnement: ${id}\nBij Mollie: ${formatEuro(werkelijk)}\nIn de database: ${formatEuro(verwacht)}\nControleer dit voor de volgende incasso.`)
        }
      }
    }
    for (const ms of lijst.filter(m => loopt(m) && !bekend.has(m.id))) {
      await meld(`onbekend:${ms.id}`, `Onbekend lopend abonnement bij Mollie op arno.bot\n\nUser: ${wie}\nMollie-abonnement: ${ms.id}\nDit staat niet in onze database. Kijk of de klant dubbel wordt geïncasseerd.`)
    }
  }
  if (nietTeLezen > 0) throw new Error(`${nietTeLezen} klant(en) niet bij Mollie te lezen, zie Sentry`)
  return bevindingen
}

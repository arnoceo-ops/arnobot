import * as Sentry from '@sentry/nextjs'
import { billingDb, type SubRow } from './db'
import { lijstKlantAbonnementen, MollieError, type MollieSubscription } from './mollie'
import { formatEuro, mollieNaarCenten } from './geld'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { nieuwMelden } from '@/lib/capaciteit'
import { notifyTelegram } from '@/lib/cron-notify'
import { wieIs } from './wie'

// Mollie incasseert wat in het Mollie-abonnement staat, niet wat in onze database staat. Dagelijks per klant de lijst bij
// Mollie vergelijken: klopt het bedrag, loopt wat moet lopen, en loopt er niets wat wij niet kennen? Alleen lezen en
// melden (eens per week per bevinding).

const loopt = (ms: MollieSubscription) => ms.status === 'active' || ms.status === 'pending'

/** Geeft het aantal bevindingen. */
export async function controleerAbonnementsBedragen(): Promise<number> {
  const { data, error } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    // Ook afgesloten en terugbetaalde rijen: daar kan het stoppen mislukt zijn.
    .in('status', ['active', 'cancelled', 'ended', 'refunded'])
    .limit(1000)
    .returns<SubRow[]>()
  if (error) throw new Error(`abonnementen ophalen mislukt: ${error.message}`)

  const hoortTeLopen = (s: SubRow) => s.status === 'active' || s.status === 'cancelled'
  const mogelijkNogOpen = (s: SubRow) => (!!s.mollie_subscription_id && !s.mollie_sub_geannuleerd_at)
    || (!!s.gepland_mollie_subscription_id && !s.gepland_mollie_sub_geannuleerd_at)
  const perKlant = new Map<string, SubRow[]>()
  for (const s of (data ?? []).filter(s => !isInternalTestUser(s.user_id) && s.mollie_customer_id && (hoortTeLopen(s) || mogelijkNogOpen(s)))) {
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
      // Een klant die Mollie niet kent (bijvoorbeeld uit testmodus) is een bevinding, geen mislukte controle.
      if (e instanceof MollieError && (e.status === 404 || e.status === 410)) {
        await meld(`klant:${klantId}`, `Klant niet gevonden bij Mollie op arno.bot\n\nWie: ${await wieIs(subs[0].user_id)}\nMollie-klant: ${klantId}\nControleer of dit een oude testrij is of een klant die niet meer wordt geïncasseerd.`)
        continue
      }
      nietTeLezen++
      Sentry.captureException(e, { tags: { onderdeel: 'billing-bedragcontrole' }, extra: { klant: klantId } })
      continue
    }
    const wie = subs[0].user_id
    const bekend = new Set<string>()
    for (const s of subs.filter(hoortTeLopen)) {
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
            await meld(`weg:${id}`, `Lopend abonnement ontbreekt bij Mollie op arno.bot\n\nWie: ${await wieIs(s.user_id)}\nMollie-abonnement: ${id}\nStand bij Mollie: ${ms?.status ?? 'niet gevonden'}\nDeze klant wordt mogelijk niet meer geïncasseerd.`)
          }
          continue
        }
        if (verwacht === null || verwacht === undefined || !ms.amount) continue
        const werkelijk = mollieNaarCenten(ms.amount.value)
        if (werkelijk !== verwacht) {
          await meld(`bedrag:${id}`, `Abonnementsbedrag klopt niet op arno.bot\n\nWie: ${await wieIs(s.user_id)}\nMollie-abonnement: ${id}\nBij Mollie: ${formatEuro(werkelijk)}\nIn de database: ${formatEuro(verwacht)}\nControleer dit voor de volgende incasso.`)
        }
      }
    }
    for (const ms of lijst.filter(m => loopt(m) && !bekend.has(m.id))) {
      await meld(`onbekend:${ms.id}`, `Onbekend lopend abonnement bij Mollie op arno.bot\n\nWie: ${await wieIs(wie)}\nMollie-abonnement: ${ms.id}\nDit staat niet in onze database. Kijk of de klant dubbel wordt geïncasseerd.`)
    }
  }
  if (nietTeLezen > 0) throw new Error(`${nietTeLezen} klant(en) niet bij Mollie te lezen, zie Sentry`)
  return bevindingen
}

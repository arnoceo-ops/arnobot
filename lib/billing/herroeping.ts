import { billingDb, type PayRow, type SubRow } from './db'
import { betaalTerug, mollieIngeschakeld } from './mollie'
import { markeerTerugbetaald, verwerkMolliebetaling } from './verwerking'
import { verstuurBillingMail } from './mails'
import { wieIs } from './wie'
import { isBinnenBedenktijd, laatsteDagBedenktijd } from './perioden'
export { BEDENKTIJD_DAGEN, amsterdamDatum, isBinnenBedenktijd, laatsteDagBedenktijd } from './perioden'
import { heeftAndereTerugbetaling, restantCent } from './terugbetaling'
import { openReferralBedragen, slotVoorTerugbetaling, zonderReferralBedrag } from './referralSlot'
import { logAdminActie } from '@/lib/adminLog'
import { notifyTelegram } from '@/lib/cron-notify'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

// Herroepen door de klant zelf (voorwaarden artikel 8): een particulier maakt binnen 14 dagen na de
// eerste betaling of een upgrade de koop ongedaan en krijgt het volledige bedrag terug. Geldt alleen
// voor 'eerste' en 'upgrade' (een herhaalbetaling is geen nieuwe koop) en niet voor zakelijke klanten.
// De terugbetaling zelf loopt via dezelfde route als de adminknop (betaalTerug, markeerTerugbetaald,
// verwerkMolliebetaling), dus abonnement stoppen, toegang beëindigen, creditnota en mail volgen daaruit.
//
// Dark launch: tot HERROEPING_OPEN=true zien alleen de interne testaccounts de knop, en voor die
// accounts is het altijd proefmodus: de hele flow loopt (mail, adminlog, Telegram) maar er gaat niets
// naar Mollie of Moneybird.


export type HerroepSoort = 'eerste' | 'upgrade'

export type Herroepbaar = {
  soort: HerroepSoort
  bedragCent: number
  /** Laatste dag van de bedenktijd, YYYY-MM-DD (Amsterdamse tijd). */
  uiterlijkTot: string
  /** Proefmodus: er wordt niets echt teruggedraaid. */
  gesimuleerd: boolean
}

const euro = (cent: number) => `€${(cent / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`


/**
 * Welke betaling kan de klant nu ongedaan maken? De nieuwste eerst: een upgrade gaat vóór de eerste
 * betaling terug, want de eerste betaling terugdraaien stopt het hele abonnement.
 */
export function kiesHerroepbareBetaling(betalingen: PayRow[], nu: Date = new Date()): PayRow | null {
  const kandidaten = betalingen
    .filter(b =>
      b.status === 'paid' &&
      !heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0) &&
      restantCent(b) > 0 &&
      // Mollie rondt een terugbetaling pas na uren tot dagen af (terugbetaald_cent blijft zo lang 0), maar
      // terugbetaling_verwerkt_at wordt direct gezet. Zonder deze regel stond de knop na een klik nog even terug.
      !b.terugbetaling_verwerkt_at &&
      (b.soort === 'eerste' || b.soort === 'upgrade') &&
      !!b.betaald_at &&
      isBinnenBedenktijd(b.betaald_at, nu))
    .sort((a, b) => Date.parse(b.betaald_at!) - Date.parse(a.betaald_at!))
  return kandidaten[0] ?? null
}

const isOpen = () => process.env.HERROEPING_OPEN === 'true'

/** Wie de knop ziet: iedereen na HERROEPING_OPEN=true, daarvoor de interne testaccounts en de eigenaar (in proefmodus). */
export function herroepingBeschikbaarVoor(userId: string): boolean {
  return isOpen() || isProefmodus(userId)
}

/**
 * Proefmodus: interne testaccounts altijd, de eigenaar alleen zolang de knop nog niet openstaat (daarna is
 * de eigenaar gewoon een klant, met een echte betaling en een echte terugbetaling).
 */
export function isProefmodus(userId: string): boolean {
  if (isInternalTestUser(userId)) return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return !isOpen() && !!eigenaar && eigenaar === userId
}

export async function zoekHerroepbaar(userId: string, nu: Date = new Date()): Promise<{ herroepbaar: Herroepbaar | null; betaling: PayRow | null }> {
  const proef = isProefmodus(userId)
  const { data: sub } = await billingDb
    .from('arnobot_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>()

  if (sub && sub.klant_type === 'particulier') {
    const { data: betalingen } = await billingDb
      .from('arnobot_payments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .is('terugbetaling_verwerkt_at', null)
      .in('soort', ['eerste', 'upgrade'])
      .order('betaald_at', { ascending: false })
      .limit(10)
    const rijen = (betalingen ?? []) as PayRow[]
    // Een referralreservering die nog niet verstuurd is, valt bij herroepen vrij en telt dus niet mee. Niet te
    // controleren: dan het lagere bedrag. Herroepen blijft altijd mogelijk.
    const { bedragen } = await openReferralBedragen(rijen)
    const gekozen = kiesHerroepbareBetaling(rijen.map(b => zonderReferralBedrag(b, bedragen.get(b.id)?.gereserveerdCent ?? 0)), nu)
    if (gekozen) {
      return {
        // De rij zoals zij in de database staat.
        betaling: rijen.find(b => b.id === gekozen.id)!,
        herroepbaar: { soort: gekozen.soort as HerroepSoort, bedragCent: restantCent(gekozen), uiterlijkTot: laatsteDagBedenktijd(gekozen.betaald_at!), gesimuleerd: proef },
      }
    }
  }

  // Een testaccount heeft meestal geen echte betaling: dan een gesimuleerde, zodat de flow te zien is.
  if (proef) {
    return {
      betaling: null,
      herroepbaar: { soort: 'eerste', bedragCent: sub?.bedrag_cent ?? 7700, uiterlijkTot: laatsteDagBedenktijd(nu), gesimuleerd: true },
    }
  }
  return { herroepbaar: null, betaling: null }
}

export type HerroepUitkomst =
  | { ok: true; soort: HerroepSoort; bedragCent: number; proef: boolean }
  | { ok: false; status: number; fout: string }

export async function voerHerroepingUit(userId: string, nu: Date = new Date()): Promise<HerroepUitkomst> {
  const { herroepbaar, betaling } = await zoekHerroepbaar(userId, nu)
  if (!herroepbaar) return { ok: false, status: 404, fout: 'Er is geen betaling meer waarvoor je bedenktijd hebt.' }
  const upgrade = herroepbaar.soort === 'upgrade'

  if (herroepbaar.gesimuleerd) {
    await verstuurBillingMail(userId, 'terugbetaling_bevestiging', { bedragCent: herroepbaar.bedragCent, upgrade })
    await logAdminActie({ actie: 'herroeping', doelUserId: userId, details: { extra: { proef: true, soort: herroepbaar.soort, bedrag_cent: herroepbaar.bedragCent } } })
    await notifyTelegram(`PROEF herroeping op arno.bot (er is niets terugbetaald)\n\nWie: ${await wieIs(userId)}\nWat: klant maakt ${upgrade ? 'een upgrade' : 'de eerste betaling'} ongedaan\nBedrag: ${euro(herroepbaar.bedragCent)}`)
    return { ok: true, soort: herroepbaar.soort, bedragCent: herroepbaar.bedragCent, proef: true }
  }

  if (!betaling) return { ok: false, status: 404, fout: 'Er is geen betaling meer waarvoor je bedenktijd hebt.' }
  if (!mollieIngeschakeld()) return { ok: false, status: 503, fout: 'Terugbetalen is nu niet mogelijk. Mail admin@arno.bot.' }

  // Hetzelfde slot als de referralterugstortingen. Herroepen wordt hier nooit geweigerd: wat al onderweg is krijgt de
  // klant langs die weg, en lukt het vrijgeven niet, dan gaat het restant terug en hoort Arno dat hij moet nakijken.
  const slot = await slotVoorTerugbetaling(userId, betaling.id)
  const bedragCent = restantCent(slot.stand === 'ok' ? { ...betaling, referral_refund_cent: slot.referralRefundCent } : betaling)
  if (bedragCent <= 0) return { ok: false, status: 503, fout: 'Terugbetalen is nu niet mogelijk. Mail admin@arno.bot.' }

  const refund = await betaalTerug({
    betalingId: betaling.mollie_payment_id,
    brutoCent: bedragCent,
    omschrijving: 'Herroeping binnen bedenktijd ArnoBot',
    idempotencyKey: `herroeping-${betaling.id}`,
  })
  // Zoals de adminknop: toegang meteen beëindigen, de webhook later is dan een idempotente no-op.
  await markeerTerugbetaald(betaling.id)
  await verwerkMolliebetaling(betaling.mollie_payment_id)
  const openCent = slot.stand === 'ok' ? slot.onderwegCent + slot.vastCent : 0
  if (slot.stand === 'fout' || openCent > 0) {
    await notifyTelegram(`Controleer of nabetalen nodig is na een herroeping (referral, arno.bot)\n\nBetaling: ${betaling.mollie_payment_id}\nTerugbetaald: ${euro(bedragCent)}\n${slot.stand === 'fout'
      ? `De referralacties waren niet te controleren (${slot.fout}). Kijk in Mollie of de klant in totaal het hele bedrag terugkrijgt.`
      : `Daarnaast staat ${euro(openCent)} als referralterugstorting open die niet is meebetaald. Komt die niet aan, betaal dat bedrag dan na.`}`)
  }
  await logAdminActie({
    actie: 'herroeping',
    doelUserId: userId,
    details: { extra: { soort: herroepbaar.soort, bedrag_cent: bedragCent, mollie_payment_id: betaling.mollie_payment_id, refund_id: refund.id } },
  })
  return { ok: true, soort: herroepbaar.soort, bedragCent, proef: false }
}

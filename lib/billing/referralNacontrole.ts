import { billingDb, type PayRow } from './db'
import { MEELOOP, type GrootboekRegel } from './referralGrootboek'
import { isTeruggedraaid, restVanToekenning, toegekendCent } from './referralSaldo'
import { isVolledigTerugbetaald } from './terugbetaling'
import { haalBetaling, lijstBetalingTerugbetalingen } from './mollie'
import { formatEuro, mollieNaarCenten } from './geld'
import { actieTabelBestaat } from './referralAutomatisch'
import type { ActieRij } from './referralTerugstorten'
import type { TeamFactuurRow } from './teamFacturatie'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

// Dagelijkse nacontrole van de betalingen onder een toekenning en onder een uitkering (docs/REFERRAL_BOUWPLAN_R3.md, B4
// en A7): een chargeback op een individuele betaling hing alleen aan de webhook. Leest bij Mollie en wijzigt nooit een
// betaling, abonnement of toegang. Wat hij boekt: terugdraaien en herstellen van een toekenning, in dezelfde stand als
// het grootboek (nu meeloop = zonder gevolgen).

/** Zo veel onderdelen per run; zijn het er meer, dan komt elk onderdeel om de zoveel dagen aan de beurt. */
export const PORTIE = 150
export const NACONTROLE_DAGEN = 400
const DAG_MS = 24 * 60 * 60 * 1000

/**
 * 'terug': volledig terugbetaald of teruggeboekt. 'staat': niets van dat alles, ook niet lopend.
 * 'onduidelijk': er loopt iets, of het is niet te lezen. Dan verandert er niets.
 */
type BronStand = 'terug' | 'staat' | 'onduidelijk'

export interface Melding {
  /** Voor het ontdubbelen. */
  sleutel: string
  tekst: string
}

export interface NacontroleRonde {
  sqlOntbreekt: boolean
  gecontroleerd: number
  meeloop: boolean
  /** Nieuwe grootboekregels: terugdraaiing en herstel (met eventueel het verval dat daarbij hoort). */
  geboekt: GrootboekRegel[]
  vrijgegeven: string[]
  ongedaan: string[]
  meldingen: Melding[]
  fouten: string[]
}

interface PaymentStand {
  stand: BronStand
  chargeback: boolean
  /** Meer terug dan wij zelf als referralbedrag boekten, maar niet alles. */
  deelsTerug: boolean
}

async function standVanBetaling(rij: PayRow): Promise<PaymentStand> {
  const mp = await haalBetaling(rij.mollie_payment_id)
  const refunds = await lijstBetalingTerugbetalingen(rij.mollie_payment_id)
  const som = (statussen: (s: string) => boolean) => refunds.filter(r => statussen(r.status)).reduce((t, r) => t + mollieNaarCenten(r.amount.value), 0)
  const chargeback = (mp.amountChargedBack ? mollieNaarCenten(mp.amountChargedBack.value) : 0) > 0
  // Een terugbetaling pas boeken als zij bij Mollie echt is uitgevoerd.
  const uitgevoerd = som(s => s === 'refunded')
  const metLopend = som(s => s !== 'failed' && s !== 'canceled')
  if (chargeback || isVolledigTerugbetaald(rij, uitgevoerd)) return { stand: 'terug', chargeback, deelsTerug: false }
  const deelsTerug = uitgevoerd > (rij.referral_refund_cent ?? 0)
  const loopt = isVolledigTerugbetaald(rij, metLopend) || !!rij.terugbetaling_verwerkt_at || rij.teruggeboekt_cent > 0
  return { stand: loopt ? 'onduidelijk' : 'staat', chargeback, deelsTerug }
}

/** Welk deel van de lijst vandaag aan de beurt is. */
export function portieVanVandaag<T>(lijst: T[], nu: Date, grootte = PORTIE): T[] {
  if (lijst.length <= grootte) return lijst
  const delen = Math.ceil(lijst.length / grootte)
  const deel = Math.floor(nu.getTime() / DAG_MS) % delen
  return lijst.filter((_, i) => i % delen === deel)
}

/** `meeloop` volgt de stand van het grootboek; alleen de tests geven hem zelf mee. */
export async function draaiNacontrole(nu: Date = new Date(), opties: { portie?: number; meeloop?: boolean } = {}): Promise<NacontroleRonde> {
  const { portie = PORTIE, meeloop = MEELOOP } = opties
  const ronde: NacontroleRonde = { sqlOntbreekt: false, gecontroleerd: 0, meeloop, geboekt: [], vrijgegeven: [], ongedaan: [], meldingen: [], fouten: [] }
  // Zonder de SQL bestaan de soorten en kolommen niet die hiervoor nodig zijn.
  if (!(await actieTabelBestaat())) return { ...ronde, sqlOntbreekt: true }

  const regels = await haalAlleRijen<GrootboekRegel>((van, tot) =>
    billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', meeloop).order('created_at', { ascending: true }).order('id').range(van, tot))
  const acties = await haalAlleRijen<ActieRij>((van, tot) =>
    billingDb.from('arnobot_referral_acties').select('*').order('created_at', { ascending: true }).order('id').range(van, tot))

  type Onderdeel = { sleutel: string } & ({ toekenning: GrootboekRegel } | { actie: ActieRij })
  const binnenTermijn = (iso?: string | null) => !iso || nu.getTime() - Date.parse(iso) <= NACONTROLE_DAGEN * DAG_MS
  const onderdelen: Onderdeel[] = []
  for (const t of regels.filter(r => r.soort === 'toekenning' && !isInternalTestUser(r.klant_user_id) && !isInternalTestUser(r.aanbrenger_user_id))) {
    if (!binnenTermijn(t.created_at)) continue
    if (!t.bron_ids?.length) {
      ronde.meldingen.push({ sleutel: `geen-bron:${t.referral_id}`, tekst: `Toekenning zonder betalingskenmerken (referral ${t.referral_id}): gaat de betaling eronder terug, dan wordt dat niet vanzelf teruggedraaid.` })
      continue
    }
    onderdelen.push({ sleutel: `t:${t.referral_id}`, toekenning: t })
  }
  for (const a of acties.filter(a => a.doel_soort === 'betaling' && !a.doel_id.startsWith('handmatig:') && ['verzonden', 'bevestigd', 'vastgelopen'].includes(a.status))) {
    if (binnenTermijn(a.created_at) && !isInternalTestUser(a.user_id)) onderdelen.push({ sleutel: `a:${a.id}`, actie: a })
  }
  onderdelen.sort((a, b) => (a.sleutel < b.sleutel ? -1 : 1))

  const standen = new Map<string, Promise<PaymentStand>>()
  const betaling = (rij: PayRow) => {
    let s = standen.get(rij.id)
    if (!s) standen.set(rij.id, (s = standVanBetaling(rij)))
    return s
  }

  /** Een bronkenmerk is een Mollie-betaling (tr_) of een teamfactuur. */
  async function standVanBron(bronId: string, klantId: string): Promise<PaymentStand> {
    if (bronId.startsWith('tr_')) {
      const { data, error } = await billingDb.from('arnobot_payments').select('*').eq('mollie_payment_id', bronId).eq('user_id', klantId).maybeSingle<PayRow>()
      if (error) throw new Error(`betaling ophalen mislukt: ${error.message}`)
      if (!data) throw new Error(`betaling ${bronId} niet gevonden`)
      return betaling(data)
    }
    const { data, error } = await billingDb.from('arnobot_team_facturen').select('*').eq('id', bronId).maybeSingle<TeamFactuurRow>()
    if (error) throw new Error(`teamfactuur ophalen mislukt: ${error.message}`)
    if (!data) throw new Error(`teamfactuur ${bronId} niet gevonden`)
    return { stand: data.reversed_at ? 'terug' : data.status === 'paid' ? 'staat' : 'onduidelijk', chargeback: false, deelsTerug: !data.reversed_at && (data.terugbetaald_cent ?? 0) > 0 }
  }

  async function boek(t: GrootboekRegel, soort: 'terugdraaiing' | 'herstel', reden: string): Promise<void> {
    if (!meeloop) {
      // Echte regels lopen door hetzelfde slot als het reserveren; de database rekent het bedrag uit.
      const { data, error } = await billingDb.rpc('referral_boek', { p_regel: { soort, referral_id: t.referral_id, reden } })
      const uit = data as { ok?: boolean; reden?: string; netto_cent?: number; event_key?: string } | null
      if (error || !uit?.ok) throw new Error(`${soort} niet geboekt: ${error?.message ?? uit?.reden}`)
      ronde.geboekt.push({ ...t, soort, event_key: uit.event_key!, netto_cent: uit.netto_cent ?? 0, reden, meeloop: false })
      return
    }
    // Meeloopstand: dezelfde rekensom als de databasefunctie referral_boek, zonder gevolgen.
    const ref = t.referral_id
    const eigen = regels.filter(r => (r.hoort_bij ?? r.referral_id) === ref)
    const aantal = (s: string) => eigen.filter(r => r.soort === s).length
    const vervallen = -eigen.filter(r => r.soort === 'verval').reduce((s, r) => s + (r.netto_cent ?? 0), 0)
    const nummer = soort === 'terugdraaiing' ? aantal('terugdraaiing') + 1 : aantal('herstel') + 1
    const netto = soort === 'terugdraaiing'
      ? -Math.max(0, toegekendCent(regels, ref) - vervallen) || 0
      : -(eigen.find(r => r.event_key === `terugdraaiing:${ref}:${aantal('terugdraaiing')}`)?.netto_cent ?? 0) || 0
    const voegToe = async (regel: GrootboekRegel) => {
      const { error } = await billingDb.from('arnobot_referral_grootboek').insert(regel)
      if (error) {
        if ((error as { code?: string }).code === '23505') return
        throw new Error(`${regel.soort} niet opgeslagen: ${error.message}`)
      }
      regels.push(regel)
      ronde.geboekt.push(regel)
    }
    const basis = {
      meeloop: true, referral_id: ref, hoort_bij: ref, aanbrenger_user_id: t.aanbrenger_user_id, klant_user_id: t.klant_user_id,
      klant_maand_netto_cent: t.klant_maand_netto_cent,
    }
    await voegToe({ ...basis, event_key: `${soort}:${ref}:${nummer}`, soort, netto_cent: netto, reden })
    // Was dit tegoed vervallen terwijl het teruggedraaid was, dan brengt een herstel het niet terug.
    const over = restVanToekenning(regels, ref)
    if (soort === 'herstel' && over > 0 && regels.some(r => r.event_key === `verval:${ref}`)) {
      await voegToe({ ...basis, event_key: `verval:${ref}:herstel:${nummer}`, soort: 'verval', netto_cent: -Math.min(over, netto), reden: 'dit tegoed was al vervallen' })
    }
  }

  /** Verrekeningen die nog niet verstuurd zijn en op een teruggedraaide toekenning rusten, gaan niet door. */
  async function geefOpenVrij(referralId: string): Promise<void> {
    const ids = new Set(regels.filter(r => !r.meeloop && r.soort === 'verrekening' && r.hoort_bij === referralId).map(r => r.actie_id))
    for (const a of acties.filter(a => ids.has(a.id) && a.status === 'gereserveerd')) {
      const { data, error } = await billingDb.rpc('referral_vrijgeven', { p_actie: a.id, p_van: 'gereserveerd', p_eind: 'vrijgegeven', p_reden: 'de betaling onder dit tegoed is teruggedraaid' })
      if (error) throw new Error(`vrijgeven mislukt: ${error.message}`)
      if ((data as { ok?: boolean } | null)?.ok) { a.status = 'vrijgegeven'; ronde.vrijgegeven.push(a.id) }
    }
  }

  async function controleerToekenning(t: GrootboekRegel): Promise<void> {
    const bronnen: PaymentStand[] = []
    for (const bron of t.bron_ids!) bronnen.push(await standVanBron(bron, t.klant_user_id))
    const teruggedraaid = isTeruggedraaid(regels, t.referral_id)
    if (bronnen.some(b => b.stand === 'terug')) {
      if (!teruggedraaid) {
        const hoe = bronnen.some(b => b.chargeback) ? 'teruggeboekt' : 'volledig terugbetaald'
        await boek(t, 'terugdraaiing', `een betaling onder deze toekenning is ${hoe}`)
        // Verrekenen en terugdraaien gaan alleen over echte regels.
        if (!meeloop) await geefOpenVrij(t.referral_id)
      }
      return
    }
    if (bronnen.some(b => b.deelsTerug)) {
      // Een gedeeltelijke terugbetaling draait niets terug; daarover is niet besloten.
      ronde.meldingen.push({ sleutel: `deels:${t.referral_id}`, tekst: `Gedeeltelijke terugbetaling onder een toekenning (referral ${t.referral_id}): het tegoed blijft staan.` })
    }
    if (teruggedraaid && bronnen.every(b => b.stand === 'staat')) await boek(t, 'herstel', 'de betalingen onder deze toekenning staan weer')
  }

  async function controleerActie(a: ActieRij): Promise<void> {
    const { data, error } = await billingDb.from('arnobot_payments').select('*').eq('id', a.doel_id).eq('user_id', a.user_id).maybeSingle<PayRow>()
    if (error) throw new Error(`betaling ophalen mislukt: ${error.message}`)
    if (!data) return
    const s = await betaling(data)
    if (s.stand !== 'terug') return
    if (s.chargeback) {
      ronde.meldingen.push({ sleutel: `chargeback:${a.id}`, tekst: `Chargeback op een betaling waarop referralgeld is teruggestort (${data.mollie_payment_id}, ${formatEuro(a.bruto_cent)}, actie ${a.id}). Mogelijk is er meer dan 100 procent terug. Er is niets teruggeboekt; kijk in Mollie.` })
      return
    }
    // Volledig terugbetaald door ons (beheerder of herroeping): het tegoed dat erop verrekend was komt terug.
    if (a.status === 'bevestigd' && a.soort.startsWith('tegoed')) {
      const { data: uit, error: fout } = await billingDb.rpc('referral_ongedaan', { p_actie: a.id, p_reden: 'de betaling is volledig terugbetaald' })
      if (fout) throw new Error(`ongedaan maken mislukt: ${fout.message}`)
      if ((uit as { ok?: boolean; bestaand?: boolean } | null)?.ok) {
        ronde.ongedaan.push(a.id)
        ronde.meldingen.push({ sleutel: `ongedaan:${a.id}`, tekst: `Betaling ${data.mollie_payment_id} is volledig terugbetaald: het erop verrekende tegoed (${formatEuro(a.netto_cent)} excl. btw) staat weer op het saldo.` })
      }
    }
  }

  for (const o of portieVanVandaag(onderdelen, nu, portie)) {
    ronde.gecontroleerd++
    try {
      if ('toekenning' in o) await controleerToekenning(o.toekenning)
      else await controleerActie(o.actie)
    } catch (e) {
      ronde.fouten.push(`${o.sleutel}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return ronde
}

import { randomUUID } from 'node:crypto'
import { billingDb } from './db'
import {
  aanbrengerFeiten, eigenBetalingStaat, eigenBetalingTelt, klantFeiten, laadDossier, openVervalVraag,
  vervalOordeel, type Betaling, type Dossier, type GrootboekRegel, type ReferralRij,
} from './referralGrootboek'
import {
  eersteBetalingOpTijd, gratisMaandBrutoCent, gratisVierdeMaand, jaarKortingCent, metJaarKorting, tegoedNettoCent, tegoedStatus, telMaanden, verrekening,
  BENODIGDE_MAANDEN, MAX_ONDERBREKING_DAGEN,
} from './referralRegels'
import { isTeruggedraaid, restVanToekenning, saldoVan, verdeelVerrekening, type SaldoOpties } from './referralSaldo'
import type { KlantFeiten } from './referralBeoordeling'
import { voordeelGebruikt } from './referralSignalen'
import { heeftAndereTerugbetaling } from './terugbetaling'
import { haalBetaling, lijstBetalingTerugbetalingen, mollieIngeschakeld } from './mollie'
import { mollieNaarCenten } from './geld'
import { berekenBedrag } from './prijzen'
import { schakelaarAan } from './referralSchakelaars'
import { actieTabelBestaat } from './referralAutomatisch'
import { factuurAlsBetaling } from './referralDoel'
import { TERUGSTORT_OMSCHRIJVING } from './referralTeksten'
import { reserveerTerugstorting, WACHT_NA_BETALING_DAGEN, type ActieRij, type ReserveerInvoer } from './referralTerugstorten'
import { bewijsToekenningen, maakBewijzer } from './referralBronnen'
import { isInternalTestUser } from '@/lib/internalTestAccounts'
import { haalAlleRijen } from '@/lib/haalAlleRijen'

// De planner (docs/REFERRAL_BOUWPLAN_R3.md, B2, B3a en B4). Leest alleen de databasestand en bepaalt wat er hoort te
// gebeuren; niets hangt aan een haak in de betaalverwerking. Reserveren doet hij alleen met `uitvoeren`, de schakelaar
// REFERRAL_TERUGSTORTEN aan, de SQL uitgevoerd en een vastgestelde klanttekst. Anders is het een droogloop.
//
// Waar iets niet zeker is of niet besloten, gebeurt er niets en staat het als 'niet-automatisch' in de uitkomst.

/** Eigen grens op opnieuw plannen: de pogingenteller van een actie begint bij een nieuwe actie weer op nul. */
export const MAX_VRIJGAVEN_PER_DOEL = 2
export const MAX_VRIJGAVEN_VOORDEEL = 3
export const MAX_VRIJGAVEN_TEGOED_PER_GEBRUIKER = 6

const DAG_MS = 24 * 60 * 60 * 1000

export type VoornemenStand =
  /** Zou nu gereserveerd worden. */
  | 'klaar'
  | 'wacht' | 'niet-automatisch' | 'gereserveerd'
  /** Tegoed van een teamlid dat nergens meer in past. */
  | 'vervalt'

export interface Voornemen {
  soort: ReserveerInvoer['soort'] | 'verval_teamlid'
  userId: string
  referralId: string | null
  betalingId: string | null
  betaalkenmerk: string | null
  brutoCent: number | null
  nettoCent: number | null
  stand: VoornemenStand
  reden: string
  /** Berekend op regels van het meelopende grootboek: er kan niets mee gebeuren. */
  opMeeloop: boolean
  /** Wacht omdat niet vaststaat dat een betaling eronder nog staat. Blijft dat, dan hoort de eigenaar het elke week. */
  bronNietBewezen?: boolean
}

export interface PlanRonde {
  uitvoeren: boolean
  sqlOntbreekt: boolean
  /** Het tegoed is op meeloopregels gerekend omdat er nog geen echte regels zijn. */
  opMeeloop: boolean
  voornemens: Voornemen[]
  fouten: string[]
}

export interface PlanOpties {
  uitvoeren: boolean
  omschrijvingen?: Partial<Record<ReserveerInvoer['soort'], string>>
}

type Referral = ReferralRij & { referred_discount?: number | string | null }
type Rij = Betaling & { referral_geblokkeerd_tot?: string | null }

const ruimteCent = (b: Betaling) =>
  Math.max(0, b.bedrag_cent - Math.max(b.terugbetaald_cent ?? 0, b.referral_refund_cent ?? 0) - (b.referral_bank_cent ?? 0))
const oudGenoeg = (b: Betaling, nu: Date) => !!b.betaald_at && nu.getTime() - Date.parse(b.betaald_at) >= WACHT_NA_BETALING_DAGEN * DAG_MS
const geblokkeerd = (b: Rij, nu: Date) => !!b.referral_geblokkeerd_tot && Date.parse(b.referral_geblokkeerd_tot) > nu.getTime()
const actief = (a: ActieRij) => a.status !== 'vrijgegeven' && a.status !== 'ongedaan'

// ── B2 en B3a: het voordeel van de nieuwe gebruiker ──

export type VoordeelKeuze =
  /** bronnen: de eerdere betaalde maanden waarop het voordeel rust (Mollie-kenmerken). */
  | { soort: 'voordeel_jaar' | 'voordeel_maand'; betaling: Betaling; brutoCent: number; bronnen: string[]; uitleg: string; nietAutomatisch?: string }
  | null

/**
 * Welk voordeel hoort er, op grond van de betalingen alleen? Per maand: de vierde op rij. Per jaar: een twaalfde van de
 * eerste jaarbetaling, als daar een tot en met drie betaalde maanden aan voorafgingen. Wat het eerst gebeurde telt.
 * De jaarkorting bij het afrekenen (geen maanden ervoor) is al in de prijs verwerkt.
 */
export function kiesVoordeel(d: Pick<Dossier, 'betalingen'>, feiten: Pick<KlantFeiten, 'periodes'>): VoordeelKeuze {
  const maanden = feiten.periodes.filter(p => p.geldig && p.cyclus === 'maandelijks' && p.plan !== 'team')
  const jaar = d.betalingen
    .filter(b => eigenBetalingStaat(b) && b.cyclus === 'jaarlijks' && !!b.periode_start)
    .sort((a, b) => Date.parse(a.periode_start!) - Date.parse(b.periode_start!))[0]
  const vierde = gratisVierdeMaand(maanden)
  if (vierde && (!jaar || Date.parse(vierde.periodeStart) < Date.parse(jaar.periode_start!))) {
    const betaling = d.betalingen.find(b => b.mollie_payment_id === vierde.bronId)
    const stand = telMaanden(maanden).filter(m => m.nieuw)
    const bronnen = stand.slice(0, stand.findIndex(m => m.periode === vierde)).slice(-BENODIGDE_MAANDEN).map(m => m.periode.bronId ?? '')
    return betaling ? { soort: 'voordeel_maand', betaling, brutoCent: betaling.bedrag_cent, bronnen, uitleg: 'vierde betaalde maand op rij gratis' } : null
  }
  if (!jaar || !eigenBetalingTelt(jaar)) return null
  // Al met korting afgerekend.
  if ((jaar.plan === 'basis' || jaar.plan === 'premium') && jaar.klant_type
    && jaar.bedrag_cent === metJaarKorting(berekenBedrag(jaar.plan, 'jaarlijks', jaar.klant_type)).bedrag.brutoCent) return null
  const eerdere = telMaanden(maanden.filter(p => Date.parse(p.periodeStart) < Date.parse(jaar.periode_start!))).filter(m => m.nieuw)
  const ervoor = eerdere.length
  if (ervoor === 0) return null
  const keuze = {
    soort: 'voordeel_jaar' as const, betaling: jaar, brutoCent: jaarKortingCent(jaar.bedrag_cent),
    bronnen: eerdere.map(m => m.periode.bronId ?? ''), uitleg: `jaarkorting na ${ervoor} betaalde maand(en)`,
  }
  return ervoor <= BENODIGDE_MAANDEN
    ? keuze
    : { ...keuze, nietAutomatisch: `er gingen ${ervoor} betaalde maanden vooraf, niet vier op rij: daarover is niets besloten` }
}

/**
 * De gratis teammaand (bouwplan D4): per maand de vierde reguliere teamfactuur op rij, per jaar de eerste jaarfactuur. Nooit
 * meer dan de maandprijs waarmee het team begon: later toegevoegde gebruikers tellen niet.
 */
export function kiesTeamVoordeel(userId: string, d: Pick<Dossier, 'facturen'>, feiten: Pick<KlantFeiten, 'periodes'>): VoordeelKeuze {
  const alle = d.facturen.filter(f => f.soort === 'regulier').map(f => factuurAlsBetaling(f, userId))
    .sort((a, b) => Date.parse(a.periode_start!) - Date.parse(b.periode_start!))
  const regulier = alle.filter(eigenBetalingStaat)
  if (!regulier.length) return null
  // De prijs waarmee het team begon, ook als die eerste factuur later is teruggedraaid of nooit betaald.
  const start = alle[0]
  const startMaandCent = start.cyclus === 'jaarlijks' ? Math.round(start.bedrag_cent / 12) : start.bedrag_cent
  const maanden = feiten.periodes.filter(p => p.geldig && p.cyclus === 'maandelijks' && p.plan === 'team')
  const jaar = regulier.find(b => b.cyclus === 'jaarlijks')
  const vierde = gratisVierdeMaand(maanden)
  if (vierde && (!jaar || Date.parse(vierde.periodeStart) < Date.parse(jaar.periode_start!))) {
    const betaling = regulier.find(b => b.id === vierde.bronId)
    const stand = telMaanden(maanden).filter(m => m.nieuw)
    const bronnen = stand.slice(0, stand.findIndex(m => m.periode === vierde)).slice(-BENODIGDE_MAANDEN).map(m => m.periode.bronId ?? '')
    return betaling
      ? { soort: 'voordeel_maand', betaling, brutoCent: gratisMaandBrutoCent(betaling.bedrag_cent, startMaandCent), bronnen, uitleg: 'gratis teammaand op de vierde factuur' }
      : null
  }
  if (!jaar || !eigenBetalingTelt(jaar)) return null
  const eerdere = telMaanden(maanden.filter(p => Date.parse(p.periodeStart) < Date.parse(jaar.periode_start!))).filter(m => m.nieuw)
  const keuze = {
    soort: 'voordeel_jaar' as const, betaling: jaar, brutoCent: gratisMaandBrutoCent(jaarKortingCent(jaar.bedrag_cent), startMaandCent),
    // Zonder eerdere maanden rust het voordeel op de jaarfactuur zelf: zonder kenmerk is er niets te bewijzen.
    bronnen: eerdere.length ? eerdere.map(m => m.periode.bronId ?? '') : [jaar.id], uitleg: 'gratis teammaand op de eerste jaarfactuur',
  }
  return eerdere.length <= BENODIGDE_MAANDEN
    ? keuze
    : { ...keuze, nietAutomatisch: `er gingen ${eerdere.length} betaalde teammaanden vooraf, niet vier op rij: daarover is niets besloten` }
}

// ── B4: welke betalingen zijn een verlenging? ──

/** Nooit een upgrade of de allereerste. Een nieuwe 'eerste' telt als er al betaalde periodes waren die hooguit 14 dagen eerder eindigden. */
export function isVerlenging(b: Betaling, alle: Betaling[]): boolean {
  if (!eigenBetalingStaat(b) || !b.betaald_at || heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0)) return false
  if (b.soort === 'herhaling' || b.soort === 'verlenging') return true
  if (b.soort !== 'eerste' || !b.periode_start) return false
  const start = Date.parse(b.periode_start)
  return alle.some(q => q.id !== b.id && eigenBetalingStaat(q) && !!q.periode_start && !!q.periode_einde
    && Date.parse(q.periode_start) < start && start - Date.parse(q.periode_einde) <= MAX_ONDERBREKING_DAGEN * DAG_MS)
}

const PER_BANK = 'per bank betaald: daarop is niet terug te storten'
/** Waaraan de eigenaar de betaling herkent. */
const kenmerkVan = (b: Betaling) => b.mollie_payment_id || b.id

/** Wat er volgens Mollie zelf nog van deze betaling terug te storten is. */
async function mollieRuimteCent(b: Betaling): Promise<number> {
  const mp = await haalBetaling(b.mollie_payment_id)
  if (mp.status !== 'paid' || (mp.amountChargedBack && mollieNaarCenten(mp.amountChargedBack.value) > 0)) return 0
  const terug = (await lijstBetalingTerugbetalingen(b.mollie_payment_id))
    .filter(r => r.status !== 'failed' && r.status !== 'canceled')
    .reduce((som, r) => som + mollieNaarCenten(r.amount.value), 0)
  const over = b.bedrag_cent - terug
  return Math.max(0, Math.min(over, mp.amountRemaining ? mollieNaarCenten(mp.amountRemaining.value) : over))
}

const grootboekOntbreekt = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /arnobot_referral_grootboek.*(does not exist|schema cache)/i.test(e.message)

export async function planReferral(nu: Date, opties: PlanOpties): Promise<PlanRonde> {
  const omschrijvingen = opties.omschrijvingen ?? TERUGSTORT_OMSCHRIJVING
  const sqlOntbreekt = !(await actieTabelBestaat())
  const uitvoeren = opties.uitvoeren && schakelaarAan('REFERRAL_TERUGSTORTEN') && !sqlOntbreekt
  const ronde: PlanRonde = { uitvoeren, sqlOntbreekt, opMeeloop: false, voornemens: [], fouten: [] }
  /** Tegoed van aanbrengers heeft een eigen schakelaar erbovenop. */
  const tegoedUitvoeren = uitvoeren && schakelaarAan('REFERRAL_TEGOED_VERREKENEN')

  const referrals = await haalAlleRijen<Referral>((van, tot) =>
    billingDb.from('arnobot_referrals').select('*').order('id', { ascending: true }).range(van, tot))
  const acties: ActieRij[] = sqlOntbreekt ? [] : await haalAlleRijen<ActieRij>((van, tot) =>
    billingDb.from('arnobot_referral_acties').select('*').order('created_at', { ascending: true }).order('id').range(van, tot))

  const proef = await billingDb.from('arnobot_referral_grootboek').select('event_key').limit(1)
  if (proef.error && !grootboekOntbreekt(proef.error)) throw new Error(`grootboek ophalen mislukt: ${proef.error.message}`)
  const alleRegels = proef.error ? [] : await haalAlleRijen<GrootboekRegel>((van, tot) =>
    billingDb.from('arnobot_referral_grootboek').select('*').order('created_at', { ascending: true }).order('id').range(van, tot))
  const echteRegels = alleRegels.filter(r => !r.meeloop)
  // Verrekenen gaat alleen over echte regels. Een droogloop mag op de meeloopstand rekenen, en zegt dat dan.
  ronde.opMeeloop = !uitvoeren && !echteRegels.length && alleRegels.length > 0
  const boek = ronde.opMeeloop ? alleRegels : echteRegels

  const dossiers = new Map<string, Promise<Dossier | null>>()
  const dossier = (userId: string) => {
    let d = dossiers.get(userId)
    if (!d) dossiers.set(userId, (d = laadDossier(userId)))
    return d
  }

  const nieuw = (v: Partial<Voornemen> & Pick<Voornemen, 'soort' | 'userId' | 'stand' | 'reden'>): Voornemen => {
    const volledig: Voornemen = { referralId: null, betalingId: null, betaalkenmerk: null, brutoCent: null, nettoCent: null, opMeeloop: false, ...v }
    ronde.voornemens.push(volledig)
    return volledig
  }

  /** Waarom er op dit doel niet (opnieuw) gepland mag worden. */
  const grens = (soort: string, userId: string, betalingId: string, referralId?: string): string | null => {
    if (acties.some(a => a.doel_id === betalingId && a.status === 'vastgelopen')) return 'op deze betaling staat een vastgelopen actie'
    const vrijgegeven = acties.filter(a => a.status === 'vrijgegeven')
    if (vrijgegeven.filter(a => a.soort === soort && a.doel_id === betalingId && a.user_id === userId).length >= MAX_VRIJGAVEN_PER_DOEL) {
      return `op deze betaling al ${MAX_VRIJGAVEN_PER_DOEL} keer vrijgegeven`
    }
    if (referralId) {
      return vrijgegeven.filter(a => a.soort.startsWith('voordeel') && a.referral_id === referralId).length >= MAX_VRIJGAVEN_VOORDEEL
        ? `dit voordeel is al ${MAX_VRIJGAVEN_VOORDEEL} keer vrijgegeven` : null
    }
    if (acties.some(a => a.soort.startsWith('tegoed') && a.user_id === userId && a.status === 'vastgelopen')) return 'er staat een vastgelopen verrekening van deze aanbrenger'
    return vrijgegeven.filter(a => a.soort.startsWith('tegoed') && a.user_id === userId).length >= MAX_VRIJGAVEN_TEGOED_PER_GEBRUIKER
      ? `bij deze aanbrenger al ${MAX_VRIJGAVEN_TEGOED_PER_GEBRUIKER} keer vrijgegeven` : null
  }

  /** Zet een voornemen op niet-automatisch of wacht als het nu niet kan. */
  const toets = (v: Voornemen, b: Rij, referralId?: string) => {
    const bezwaar = grens(v.soort, v.userId, b.id, referralId)
    if (bezwaar) Object.assign(v, { stand: 'niet-automatisch', reden: bezwaar })
    else if (!oudGenoeg(b, nu)) Object.assign(v, { stand: 'wacht', reden: `${v.reden}; pas ${WACHT_NA_BETALING_DAGEN} dagen na de betaling` })
    else if (geblokkeerd(b, nu)) Object.assign(v, { stand: 'wacht', reden: 'de betaling wordt op dit moment terugbetaald' })
  }

  async function reserveer(v: Voornemen, invoer: (omschrijving: string) => ReserveerInvoer): Promise<boolean> {
    if (!uitvoeren || v.stand !== 'klaar' || (v.soort === 'tegoed_terugstorten' && !tegoedUitvoeren)) return false
    const omschrijving = omschrijvingen[v.soort as ReserveerInvoer['soort']]
    if (!omschrijving) {
      Object.assign(v, { stand: 'niet-automatisch', reden: 'de omschrijving die de klant te zien krijgt is niet vastgesteld' })
      return false
    }
    const vraag = invoer(omschrijving)
    const uit = await reserveerTerugstorting(vraag)
    if (uit.stand !== 'gereserveerd') {
      Object.assign(v, { stand: 'niet-automatisch', reden: `niet gereserveerd: ${uit.stand === 'uit' ? 'schakelaar uit' : uit.reden}` })
      return false
    }
    Object.assign(v, { stand: 'gereserveerd', brutoCent: uit.brutoCent, nettoCent: uit.nettoCent })
    acties.push({
      id: vraag.actieId, soort: vraag.soort, user_id: vraag.userId, referral_id: v.referralId, doel_soort: 'betaling', doel_id: vraag.betalingId,
      bruto_cent: uit.brutoCent, netto_cent: uit.nettoCent, status: 'gereserveerd', bezig_tot: null, pogingen: 0, fout: null,
      mollie_refund_id: null, gegevens: {}, credit_status: 'nvt',
    })
    return true
  }

  const bewijzer = maakBewijzer()
  const onbewezen = (v: Voornemen, reden: string) => Object.assign(v, { stand: 'wacht', bronNietBewezen: true, reden: `bron niet bewezen: ${reden}` })

  // ── Eerst het eigen voordeel ──
  /** Betalingen waarop een voordeel hoort dat nog niet gereserveerd is: daar komt geen tegoed overheen. */
  const eerstVoordeel = new Set<string>()

  for (const referral of referrals) {
    const { referrer_user_id: aanbrengerId, referred_user_id: klantId } = referral
    const id = String(referral.id)
    if (isInternalTestUser(aanbrengerId) || isInternalTestUser(klantId)) continue
    if (aanbrengerId === klantId || referrals.some(r => r.referrer_user_id === klantId && r.referred_user_id === aanbrengerId)) continue
    try {
      const bestaand = acties.find(a => a.referral_id === id && a.soort.startsWith('voordeel') && actief(a))
      if (bestaand) {
        if (bestaand.status === 'vastgelopen') {
          nieuw({ soort: bestaand.soort as ReserveerInvoer['soort'], userId: klantId, referralId: id, betalingId: bestaand.doel_id, brutoCent: bestaand.bruto_cent, stand: 'niet-automatisch', reden: 'het voordeel staat vastgelopen' })
        }
        continue
      }
      if (voordeelGebruikt(referral)) continue
      const d = await dossier(klantId)
      if (!d) continue
      const feiten = await klantFeiten(d, referral.created_at, nu)
      // Een manager die ook zelf betaalde (solo naar Team): wat dan het voordeel is, beslist de eigenaar.
      const gemengd = d.teams.length > 0 && d.betalingen.some(eigenBetalingStaat)
      const keuze = d.teams.length ? kiesTeamVoordeel(klantId, d, feiten) ?? (gemengd ? kiesVoordeel(d, feiten) : null) : kiesVoordeel(d, feiten)
      if (!keuze) continue
      const eerste = [...feiten.betaalMomenten].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
      let onzeker: string | null = null
      if (gemengd) onzeker = 'de klant betaalde zelf en als team'
      else if (!feiten.aangemeldAt || !feiten.proefEindeAt) onzeker = 'de aanmelddatum is onbekend'
      else if (feiten.handmatigBetaald || feiten.ooitMetDeHandBetaald) onzeker = 'de klant stond met de hand op betaald, de betaalde maanden zijn niet zeker te tellen'
      else if (d.betalingen.some(b => eigenBetalingStaat(b) && b.soort !== 'upgrade' && (!b.periode_start || !b.cyclus))) onzeker = 'niet elke betaling heeft een vastgelegde periode'
      else if (!eerste || !eersteBetalingOpTijd(eerste.at, feiten.proefEindeAt, eerste.team)) {
        // Te laat is geen voordeel, tenzij de proef verlengd kan zijn.
        if (!feiten.proefMogelijkVerlengd) continue
        onzeker = 'de eerste betaling lijkt te laat, maar de proef kan verlengd zijn'
      }
      const b = keuze.betaling as Rij
      const v = nieuw({
        soort: keuze.soort, userId: klantId, referralId: id, betalingId: b.id, betaalkenmerk: kenmerkVan(b),
        brutoCent: keuze.brutoCent, stand: 'klaar', reden: keuze.uitleg,
      })
      eerstVoordeel.add(b.id)
      const nietAuto = onzeker ?? keuze.nietAutomatisch
      if (nietAuto) Object.assign(v, { stand: 'niet-automatisch', reden: `${keuze.uitleg}: ${nietAuto}` })
      else if (!b.mollie_payment_id) Object.assign(v, { stand: 'niet-automatisch', reden: `${keuze.uitleg}: ${PER_BANK}` })
      else if (feiten.bijbetalingLoopt) Object.assign(v, { stand: 'wacht', reden: 'de bijbetaling van een upgrade loopt nog' })
      else if (ruimteCent(b) < keuze.brutoCent) Object.assign(v, { stand: 'niet-automatisch', reden: `${keuze.uitleg}: past niet, er staat al iets op deze betaling` })
      else toets(v, b, id)
      if (v.stand === 'klaar') {
        // Een teamfactuur is als bron haar eigen id, een eigen betaling haar Mollie-kenmerk.
        const zelf = d.facturen.some(f => f.id === b.id) ? b.id : b.mollie_payment_id
        const bewijs = await bewijzer([...new Set([...keuze.bronnen, zelf])], klantId)
        if (!bewijs.staat) onbewezen(v, bewijs.reden)
      }
      if (await reserveer(v, omschrijving => ({
        actieId: randomUUID(), userId: klantId, betalingId: b.id, omschrijving, soort: keuze.soort, referralId: id, brutoCent: keuze.brutoCent,
        bronnen: keuze.bronnen,
      }))) {
        // Over de rest van deze betaling mag daarna tegoed.
        eerstVoordeel.delete(b.id)
        b.referral_refund_cent = (b.referral_refund_cent ?? 0) + keuze.brutoCent
      }
    } catch (e) {
      ronde.fouten.push(`voordeel referral ${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Daarna het tegoed van de aanbrengers ──
  const aanbrengers = [...new Set(boek.filter(r => r.soort === 'toekenning').map(r => r.aanbrenger_user_id))]
  for (const userId of aanbrengers) {
    if (isInternalTestUser(userId)) continue
    try {
      await planTegoed(userId)
    } catch (e) {
      ronde.fouten.push(`tegoed ${userId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function planTegoed(userId: string): Promise<void> {
    const eigen = boek.filter(r => r.aanbrenger_user_id === userId)
    const toekenningen = eigen.filter(r => r.soort === 'toekenning')
    const verlopen = (ref: string) => eigen.some(r => r.event_key === `verval:${ref}`)
    const zonderBedrag = toekenningen.filter(t => t.netto_cent === null && !verlopen(t.referral_id) && !isTeruggedraaid(eigen, t.referral_id)
      && !eigen.some(r => r.event_key === `vaststelling:${t.referral_id}`))
    if (saldoVan(eigen).beschikbaarCent <= 0 && !zonderBedrag.length) return

    const d = await dossier(userId)
    if (!d) return
    const feiten = await aanbrengerFeiten(d, nu)
    const stil = (stand: 'wacht' | 'niet-automatisch', reden: string) => {
      nieuw({ soort: 'tegoed_terugstorten', userId, stand, reden, opMeeloop: ronde.opMeeloop })
    }
    if (feiten.gratis) return stil('wacht', 'de aanbrenger heeft een gratis account')
    if (feiten.handmatigBetaald) return stil('niet-automatisch', 'de aanbrenger staat met de hand op betaald')
    if (toekenningen.some(t => openVervalVraag(eigen, t.referral_id))) return stil('wacht', 'er staat een vraag open of tegoed vervalt')
    for (const t of toekenningen) {
      if (verlopen(t.referral_id) || (restVanToekenning(eigen, t.referral_id) <= 0 && !zonderBedrag.includes(t))) continue
      const aangemeld = referrals.find(r => String(r.id) === t.referral_id)?.created_at
      if (vervalOordeel(feiten, eigen, t, aangemeld, nu).stand !== 'nee') return stil('wacht', 'tegoed lijkt te vervallen: eerst de grootboekcontrole')
    }
    if (feiten.bijbetalingLoopt) return stil('wacht', 'de bijbetaling van een upgrade van de aanbrenger loopt nog')
    const status = tegoedStatus(feiten.stand, nu)
    if (status !== 'actief' && status !== 'terugstorten') return stil('wacht', `het tegoed staat op '${status}'`)

    // Een toekenning zonder bedrag krijgt het pas hier: het laagste van beide maandprijzen.
    const vaststellingen = zonderBedrag.flatMap(t => (t.klant_maand_netto_cent !== null && feiten.maandNettoCent !== null
      ? [{ ...t, soort: 'vaststelling' as const, event_key: `vaststelling:${t.referral_id}`, netto_cent: tegoedNettoCent(t.klant_maand_netto_cent, feiten.maandNettoCent) }]
      : []))
    /** De regels waarmee we verder rekenen, inclusief wat deze ronde zou boeken. */
    let werk: GrootboekRegel[] = [...eigen, ...vaststellingen]
    let vastgesteld = false
    const stelVast = async () => {
      if (vastgesteld) return
      for (const v of vaststellingen) {
        const { data, error } = await billingDb.rpc('referral_boek', {
          p_regel: { soort: 'vaststelling', referral_id: v.referral_id, netto_cent: v.netto_cent, reden: 'bedrag vastgesteld bij de eerste verrekening' },
        })
        if (error || !(data as { ok?: boolean } | null)?.ok) throw new Error(`vaststelling niet geboekt: ${error?.message ?? (data as { reden?: string } | null)?.reden}`)
      }
      vastgesteld = true
    }

    const bezet = (b: Betaling) => acties.some(a => a.soort === 'tegoed_terugstorten' && a.doel_id === b.id && a.user_id === userId && actief(a))

    /** Staat er een bron niet vast, dan stopt het voor deze aanbrenger: de database verbruikt altijd het oudste eerst. */
    let bronWacht = false

    /** Een betaling waarop (een deel van) het saldo past. */
    async function opBetaling(b: Rij, saldo: SaldoOpties, ruimte: number, extra: { terugwerkend?: boolean; plafondCent?: number; maxBrutoCent?: number }) {
      const beschikbaar = saldoVan(werk, saldo).beschikbaarCent
      const bedrag = verrekening(beschikbaar, ruimte)
      if (bedrag.brutoCent <= 0) return
      const v = nieuw({
        soort: 'tegoed_terugstorten', userId, betalingId: b.id, betaalkenmerk: kenmerkVan(b), brutoCent: bedrag.brutoCent,
        nettoCent: bedrag.verbruiktNettoCent, stand: 'klaar', reden: extra.terugwerkend ? 'teamlid: terug over een eigen betaling' : 'verrekenen bij de verlenging',
        opMeeloop: ronde.opMeeloop,
      })
      if (eerstVoordeel.has(b.id)) Object.assign(v, { stand: 'wacht', reden: 'eerst het eigen voordeel op deze betaling' })
      else toets(v, b)
      if (v.stand === 'klaar') {
        const refs = verdeelVerrekening(werk, bedrag.verbruiktNettoCent, saldo).map(deel => deel.referralId)
        const bewijs = await bewijsToekenningen(werk, refs, bewijzer)
        if (!bewijs.staat) {
          onbewezen(v, bewijs.reden)
          bronWacht = true
          return
        }
      }
      if (v.stand === 'klaar' && tegoedUitvoeren && omschrijvingen.tegoed_terugstorten) await stelVast()
      await reserveer(v, omschrijving => ({ actieId: randomUUID(), userId, betalingId: b.id, omschrijving, soort: 'tegoed_terugstorten', ...extra }))
      // Wat hier (straks) op gaat, is niet nog eens beschikbaar voor een volgende betaling.
      if (v.stand !== 'niet-automatisch') {
        werk = [...werk, ...verdeelVerrekening(werk, v.nettoCent!, saldo).map(deel => ({
          event_key: `droogloop:${b.id}:${deel.referralId}`, meeloop: ronde.opMeeloop, soort: 'verrekening' as const, referral_id: deel.referralId,
          hoort_bij: deel.referralId, aanbrenger_user_id: userId, klant_user_id: '', netto_cent: -deel.nettoCent, reden: '', klant_maand_netto_cent: null,
        }))]
      }
    }

    if (status === 'actief') {
      // Eigen betalingen en teamfacturen samen: ook de eerste teamfactuur na een eigen abonnement verlengt.
      const alle = [...d.betalingen, ...d.facturen.map(f => factuurAlsBetaling(f, userId))]
      const verlengingen = alle.filter(b => isVerlenging(b, alle)).sort((a, b) => Date.parse(a.betaald_at!) - Date.parse(b.betaald_at!))
      for (const b of verlengingen) {
        if (bronWacht) break
        if (!b.mollie_payment_id || bezet(b) || ruimteCent(b) <= 0) continue
        await opBetaling(b, { toegekendVoor: b.betaald_at! }, ruimteCent(b), {})
      }
      // Pas melden wat nergens anders heen kan: anders staat hetzelfde tegoed hier "met de hand" en daar gereserveerd.
      const perBank = bronWacht ? undefined : verlengingen.find(b => !b.mollie_payment_id && !bezet(b) && ruimteCent(b) > 0
        && verrekening(saldoVan(werk, { toegekendVoor: b.betaald_at! }).beschikbaarCent, ruimteCent(b)).brutoCent > 0)
      if (perBank) {
        const bedrag = verrekening(saldoVan(werk, { toegekendVoor: perBank.betaald_at! }).beschikbaarCent, ruimteCent(perBank))
        nieuw({
          soort: 'tegoed_terugstorten', userId, betalingId: perBank.id, betaalkenmerk: kenmerkVan(perBank), brutoCent: bedrag.brutoCent,
          nettoCent: bedrag.verbruiktNettoCent, stand: 'niet-automatisch', reden: PER_BANK, opMeeloop: ronde.opMeeloop,
        })
      }
      return
    }

    // ── De aanbrenger is gewoon teamlid geworden: terug over zijn eigen betalingen, nieuwste eerst ──
    const plafondCent = feiten.maandNettoCent
    if (plafondCent === null) return stil('niet-automatisch', 'de laatst zelf betaalde maandprijs is niet te bepalen')
    const betaald = d.betalingen
      .filter(b => b.status === 'paid' && !!b.betaald_at && !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0))
      .sort((a, b) => Date.parse(b.betaald_at!) - Date.parse(a.betaald_at!))
    let nergensRuimte = true
    for (const b of betaald) {
      if (ruimteCent(b) <= 0) continue
      let volgensMollie: number
      try {
        if (!mollieIngeschakeld()) throw new Error('Mollie is niet ingeschakeld')
        volgensMollie = await mollieRuimteCent(b)
      } catch (e) {
        nergensRuimte = false
        nieuw({ soort: 'tegoed_terugstorten', userId, betalingId: b.id, betaalkenmerk: b.mollie_payment_id, stand: 'niet-automatisch', reden: `niet te lezen bij Mollie: ${e instanceof Error ? e.message : e}`, opMeeloop: ronde.opMeeloop })
        continue
      }
      const ruimte = Math.min(ruimteCent(b), volgensMollie)
      if (ruimte <= 0) continue
      // Er is nog geld van hem: dan vervalt er niets, ook als er nu niet op teruggestort kan worden.
      nergensRuimte = false
      if (bezet(b)) continue
      if (heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0)) {
        nieuw({ soort: 'tegoed_terugstorten', userId, betalingId: b.id, betaalkenmerk: b.mollie_payment_id, stand: 'niet-automatisch', reden: 'van deze betaling is al op een andere manier iets terug', opMeeloop: ronde.opMeeloop })
        continue
      }
      if (!bronWacht) await opBetaling(b, { plafondCent }, ruimte, { terugwerkend: true, plafondCent, maxBrutoCent: ruimte })
    }

    // Wat nergens meer in past vervalt, maar pas als alles wat onderweg was bevestigd is. Dat is definitief, dus bij elke
    // onduidelijkheid niet vanzelf.
    const overCent = saldoVan(werk).beschikbaarCent
    if (!nergensRuimte || overCent <= 0 || zonderBedrag.length > vaststellingen.length) return
    // Er is in deze ronde al iets over deze gebruiker gezegd (een voornemen, ook zijn eigen voordeel): eerst dat.
    if (ronde.voornemens.some(v => v.userId === userId)) return
    const zijnBetalingen = new Set(d.betalingen.map(b => b.id))
    const staatOpen = acties.some(a => (a.user_id === userId || zijnBetalingen.has(a.doel_id)) && a.status !== 'bevestigd' && a.status !== 'ongedaan')
      || d.betalingen.some(b => eerstVoordeel.has(b.id))
    if (staatOpen) {
      nieuw({ soort: 'verval_teamlid', userId, nettoCent: overCent, stand: 'wacht', reden: 'er staat nog een uitkering open, vastgelopen of vrijgegeven bij deze gebruiker of zijn betalingen', opMeeloop: ronde.opMeeloop })
      return
    }
    // Is zijn voorgeschiedenis niet volledig (met de hand betaald of gratis geweest, of hij betaalde als manager
    // teamfacturen), dan weten we niet of er echt niets meer van hem is: dan beslist de eigenaar, nooit het systeem.
    const onvolledig = feiten.historieOnvolledig || !!feiten.betaaldeTeamfactuur
    // Heeft de eigenaar van een toekenning besloten haar te behouden, dan wordt er niet opnieuw over gevraagd en
    // vervalt zij niet, ook niet als de voorgeschiedenis verder volledig is.
    const teVervallen = toekenningen.filter(t => restVanToekenning(werk, t.referral_id) > 0
      && !eigen.some(r => r.event_key.startsWith(`verval-behoud:${t.referral_id}:`)))
    if (!teVervallen.length) return
    // Wat er echt van zou vervallen: zonder wat behouden is.
    const vervalCent = teVervallen.reduce((som, t) => som + restVanToekenning(werk, t.referral_id), 0)
    if (onvolledig) {
      const waarom = 'tegoed lijkt te vervallen, maar de voorgeschiedenis van dit teamlid is niet volledig (met de hand betaald, gratis geweest of als manager teamfacturen betaald)'
      nieuw({ soort: 'verval_teamlid', userId, nettoCent: vervalCent, stand: 'niet-automatisch', reden: `${waarom}: de eigenaar beslist op /bot/admin/referrals`, opMeeloop: ronde.opMeeloop })
      if (!tegoedUitvoeren || !omschrijvingen.tegoed_terugstorten) return
      for (const t of teVervallen) {
        const { data, error } = await billingDb.rpc('referral_boek', {
          p_regel: { soort: 'handwerk', event_key: `verval-handwerk:${t.referral_id}`, referral_id: t.referral_id, aanbrenger_user_id: userId, klant_user_id: t.klant_user_id, reden: waarom },
        })
        if (error || !(data as { ok?: boolean } | null)?.ok) throw new Error(`vraag over verval niet geboekt: ${error?.message ?? (data as { reden?: string } | null)?.reden}`)
      }
      return
    }
    // In een echte ronde zonder tegoedschakelaar wordt er niets geboekt: dan mag er ook niet 'vervallen' gemeld worden.
    const geboektWordtNiet = uitvoeren && !tegoedUitvoeren
    const v = nieuw({
      soort: 'verval_teamlid', userId, nettoCent: vervalCent, stand: geboektWordtNiet ? 'wacht' : 'vervalt',
      reden: geboektWordtNiet ? 'zou vervallen, maar REFERRAL_TEGOED_VERREKENEN staat uit: er is niets geboekt' : 'past niet meer in zijn eigen betalingen',
      opMeeloop: ronde.opMeeloop,
    })
    // Definitief: alleen als terugstorten ook echt ingericht is (schakelaar, SQL en vastgestelde klanttekst).
    if (!tegoedUitvoeren || !omschrijvingen.tegoed_terugstorten) return
    await stelVast()
    for (const t of teVervallen) {
      const { data, error } = await billingDb.rpc('referral_boek', { p_regel: { soort: 'verval', referral_id: t.referral_id, reden: 'teamlid: past niet meer in eigen betalingen' } })
      if (error || !(data as { ok?: boolean } | null)?.ok) throw new Error(`verval niet geboekt: ${error?.message ?? (data as { reden?: string } | null)?.reden}`)
    }
    v.reden += ', geboekt'
  }

  return ronde
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Alleen voor tests: een nagebootste database voor de planner, de nacontrole en de uitvoerronde. De databasefuncties zijn
// hier vereenvoudigd nagedaan. Dezelfde tests zijn ook gedraaid op een echte Postgres met de echte functies uit
// docs/sql/2026-11-26-referral-verrekening.sql.

import { verrekening } from './referralRegels'
import { isTeruggedraaid, restVanToekenning, saldoVan, toegekendCent, verdeelVerrekening } from './referralSaldo'

type Rij = Record<string, any>

export function maakKetenDb() {
  let tabellen: Record<string, Rij[]> = {}
  let teller = 0
  const kopie = <T>(x: T): T => structuredClone(x)
  const tabel = (naam: string) => (tabellen[naam] ??= [])
  const nieuweId = () => `00000000-0000-4000-9000-${String(++teller).padStart(12, '0')}`

  const from = (naam: string) => {
    const filters: ((r: Rij) => boolean)[] = []
    let wijziging: Rij | null = null
    let nieuw: Rij | null = null
    let bereik: [number, number] | null = null
    const uit = (): { data: any; error: any } => {
      if (nieuw) {
        if (naam === 'arnobot_referral_grootboek' && tabel(naam).some(r => r.event_key === nieuw!.event_key && r.meeloop === nieuw!.meeloop)) {
          return { data: null, error: { code: '23505', message: 'dubbel' } }
        }
        tabel(naam).push({ id: nieuweId(), created_at: new Date().toISOString(), ...kopie(nieuw) })
        return { data: null, error: null }
      }
      const treffers = tabel(naam).filter(r => filters.every(f => f(r)))
      if (wijziging) treffers.forEach(r => Object.assign(r, kopie(wijziging)))
      return { data: kopie(bereik ? treffers.slice(bereik[0], bereik[1] + 1) : treffers), error: null }
    }
    const q: any = {
      select: () => q, order: () => q, limit: () => q, returns: () => q,
      range: (van: number, tot: number) => { bereik = [van, tot]; return q },
      eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
      in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
      not: (k: string) => { filters.push(r => r[k] !== null && r[k] !== undefined); return q },
      update: (patch: Rij) => { wijziging = patch; return q },
      insert: (r: Rij) => { nieuw = r; return q },
      maybeSingle: async () => { const r = uit(); return { data: r.data?.[0] ?? null, error: r.error } },
      then: (ok: any, nee: any) => Promise.resolve(uit()).then(ok, nee),
    }
    return q
  }

  const actie = (id: string) => tabel('arnobot_referral_acties').find(a => a.id === id)
  const echte = (aanbrenger?: string) => tabel('arnobot_referral_grootboek').filter(r => !r.meeloop && (!aanbrenger || r.aanbrenger_user_id === aanbrenger)) as any[]
  const regel = (r: Rij) => tabel('arnobot_referral_grootboek').push({ id: nieuweId(), created_at: new Date().toISOString(), meeloop: false, klant_maand_netto_cent: null, ...r })
  const nee = (reden: string) => ({ data: { ok: false, reden }, error: null })
  const ja = (extra: Rij = {}) => ({ data: { ok: true, ...extra }, error: null })
  const bezet = (soort: (a: Rij) => boolean) => tabel('arnobot_referral_acties').some(a => !['vrijgegeven', 'ongedaan'].includes(a.status) && soort(a))
  const nieuweActie = (r: Rij) => tabel('arnobot_referral_acties').push({
    referral_id: null, doel_soort: 'betaling', status: 'gereserveerd', bezig_tot: null, pogingen: 0, fout: null, mollie_refund_id: null, credit_status: 'nvt',
    melding: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r,
  })
  const terugboeken = (id: string) => {
    for (const v of echte().filter(r => r.actie_id === id && r.soort === 'verrekening')) {
      regel({ ...v, id: nieuweId(), soort: 'vrijgave', event_key: `vrijgave:${id}:${v.hoort_bij}`, netto_cent: -v.netto_cent })
    }
  }

  const rpc = async (naam: string, p: Rij): Promise<{ data: any; error: any }> => {
    if (naam === 'referral_reserveer' || naam === 'referral_reserveer_voordeel') {
      const b = tabel('arnobot_payments').find(r => r.id === p.p_doel && r.user_id === p.p_user)
      if (!b) return nee('betaling_onbekend')
      if (b.status !== 'paid' || b.terugbetaling_verwerkt_at || b.teruggeboekt_cent > 0) return nee('niet_betaald')
      const soort = naam === 'referral_reserveer' ? 'tegoed_terugstorten' : p.p_soort
      if (bezet(a => a.soort === soort && a.doel_id === b.id && a.user_id === p.p_user)) return nee('al_actie')
      const ruimte = Math.min(b.bedrag_cent - Math.max(b.terugbetaald_cent ?? 0, b.referral_refund_cent ?? 0), p.p_max_bruto ?? Infinity)
      if (ruimte <= 0) return nee('geen_ruimte')
      if (naam === 'referral_reserveer_voordeel') {
        if (bezet(a => a.referral_id === p.p_referral && a.soort.startsWith('voordeel'))) return nee('voordeel_al_gebruikt')
        if (p.p_bruto > ruimte) return nee('bedrag_past_niet')
        const netto = Math.round(p.p_bruto / 1.21)
        nieuweActie({ id: p.p_actie, soort, user_id: p.p_user, referral_id: p.p_referral, doel_id: b.id, bruto_cent: p.p_bruto, netto_cent: netto, gegevens: p.p_gegevens })
        b.referral_refund_cent = (b.referral_refund_cent ?? 0) + p.p_bruto
        return ja({ bruto_cent: p.p_bruto, netto_cent: netto })
      }
      const opties = { plafondCent: p.p_plafond ?? undefined, toegekendVoor: p.p_terugwerkend ? undefined : b.betaald_at }
      const eigen = echte(p.p_user)
      const beschikbaar = saldoVan(eigen, opties).beschikbaarCent
      const v = verrekening(Math.min(beschikbaar, p.p_max_netto ?? beschikbaar), ruimte)
      if (v.brutoCent <= 0) return nee('geen_saldo')
      const delen = verdeelVerrekening(eigen, v.verbruiktNettoCent, opties)
      nieuweActie({ id: p.p_actie, soort, user_id: p.p_user, doel_id: b.id, bruto_cent: v.brutoCent, netto_cent: v.verbruiktNettoCent, gegevens: p.p_gegevens })
      for (const d of delen) {
        regel({ event_key: `verrekening:${p.p_actie}:${d.referralId}`, soort: 'verrekening', referral_id: d.referralId, hoort_bij: d.referralId, actie_id: p.p_actie, aanbrenger_user_id: p.p_user, klant_user_id: 'k', netto_cent: -d.nettoCent, reden: 'r' })
      }
      b.referral_refund_cent = (b.referral_refund_cent ?? 0) + v.brutoCent
      return ja({ bruto_cent: v.brutoCent, netto_cent: v.verbruiktNettoCent })
    }
    if (naam === 'referral_boek') {
      const r = p.p_regel
      const t = echte().find(x => x.soort === 'toekenning' && x.referral_id === r.referral_id)
      if (!t) return nee('geen_toekenning')
      const eigen = echte().filter(x => (x.hoort_bij ?? x.referral_id) === r.referral_id)
      const aantal = (s: string) => eigen.filter(x => x.soort === s).length
      const sleutel = r.soort === 'terugdraaiing' ? `terugdraaiing:${r.referral_id}:${aantal('terugdraaiing') + 1}`
        : r.soort === 'herstel' ? `herstel:${r.referral_id}:${aantal('herstel') + 1}` : `${r.soort}:${r.referral_id}`
      if (echte().some(x => x.event_key === sleutel)) return ja({ bestaand: true, event_key: sleutel })
      if (r.soort === 'terugdraaiing' && isTeruggedraaid(echte(), r.referral_id)) return nee('al_teruggedraaid')
      const netto = r.soort === 'verval' ? -Math.max(0, restVanToekenning(echte(), r.referral_id))
        : r.soort === 'vaststelling' ? r.netto_cent
          : r.soort === 'terugdraaiing' ? -Math.max(0, toegekendCent(echte(), r.referral_id) + eigen.filter(x => x.soort === 'verval').reduce((s, x) => s + x.netto_cent, 0))
            : -eigen.find(x => x.event_key === `terugdraaiing:${r.referral_id}:${aantal('terugdraaiing')}`)!.netto_cent
      regel({ event_key: sleutel, soort: r.soort, referral_id: r.referral_id, hoort_bij: r.referral_id, aanbrenger_user_id: t.aanbrenger_user_id, klant_user_id: t.klant_user_id, netto_cent: netto || 0, reden: r.reden })
      return ja({ netto_cent: netto || 0, event_key: sleutel })
    }
    const a = actie(p.p_actie)
    if (naam === 'referral_claim') {
      if (!a || a.status !== p.p_van || (a.bezig_tot && Date.parse(a.bezig_tot) > Date.now())) return { data: null, error: null }
      if (a.status === 'gereserveerd') a.status = 'bezig'
      a.bezig_tot = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      return { data: kopie(a), error: null }
    }
    if (naam === 'referral_vrijgeven') {
      if (!a || (p.p_van && a.status !== p.p_van)) return nee('status_gewijzigd')
      terugboeken(a.id)
      const b = tabel('arnobot_payments').find(r => r.id === a.doel_id)
      if (b && !a.gegevens?.boeking_teruggezet) b.referral_refund_cent = Math.max(0, b.referral_refund_cent - a.bruto_cent)
      Object.assign(a, { status: p.p_eind ?? 'vrijgegeven', bezig_tot: null, fout: p.p_reden, gegevens: { ...a.gegevens, boeking_teruggezet: true } })
      return ja()
    }
    if (naam === 'referral_ongedaan') {
      if (!a || a.status !== 'bevestigd' || !a.soort.startsWith('tegoed')) return nee('niet_bevestigd')
      terugboeken(a.id)
      a.status = 'ongedaan'
      return ja({ bestaand: false })
    }
    return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${naam} in the schema cache` } }
  }

  return {
    from, rpc,
    async zaai(data: Record<string, Rij[]>) { tabellen = kopie(data) },
    async alle(naam: string): Promise<Rij[]> { return kopie(tabel(naam)) },
    async wijzig(naam: string, id: string, patch: Rij) { Object.assign(tabel(naam).find(r => r.id === id)!, kopie(patch)) },
    async voegToe(naam: string, r: Rij) { tabel(naam).push({ id: nieuweId(), created_at: new Date().toISOString(), ...kopie(r) }) },
  }
}

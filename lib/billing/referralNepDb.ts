/* eslint-disable @typescript-eslint/no-explicit-any */
// Alleen voor tests: een kleine nagebootste database voor de terugstortmachine. De databasefuncties zijn hier maar zo ver
// nagedaan als de machine nodig heeft. Wat ze echt doen staat in docs/sql/2026-11-26-referral-verrekening.sql en is in
// een echte Postgres beproefd.

export type Rij = Record<string, any>

export function maakNepDb() {
  let tabellen: Record<string, Rij[]> = {}
  const kopie = <T>(x: T): T => structuredClone(x)
  const zoek = (tabel: string, id: string) => (tabellen[tabel] ??= []).find(r => r.id === id)

  const from = (tabel: string) => {
    const filters: ((r: Rij) => boolean)[] = []
    let wijziging: Rij | null = null
    const uit = () => {
      const treffers = (tabellen[tabel] ??= []).filter(r => filters.every(f => f(r)))
      if (wijziging) treffers.forEach(r => Object.assign(r, kopie(wijziging)))
      return { data: kopie(treffers), error: null }
    }
    const q: any = {
      select: () => q, order: () => q, limit: () => q, returns: () => q,
      eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
      in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
      update: (patch: Rij) => { wijziging = patch; return q },
      maybeSingle: async () => { const r = uit(); return { data: r.data[0] ?? null, error: null } },
      then: (ok: any, nee: any) => Promise.resolve(uit()).then(ok, nee),
    }
    return q
  }

  const vrijgeven = (a: Rij, eind: string, reden: string) => {
    if (!a.gegevens.boeking_teruggezet) {
      const b = zoek('arnobot_payments', a.doel_id)
      if (b) b.referral_refund_cent = Math.max(0, b.referral_refund_cent - a.bruto_cent)
    }
    Object.assign(a, { status: eind, bezig_tot: null, fout: reden, gegevens: { ...a.gegevens, boeking_teruggezet: true } })
  }

  const rpc = async (naam: string, p: Rij) => {
    const a = p.p_actie ? zoek('arnobot_referral_acties', p.p_actie) : undefined
    if (naam === 'referral_claim') {
      if (!a || a.status !== p.p_van || (a.bezig_tot && Date.parse(a.bezig_tot) > Date.now())) return { data: null, error: null }
      if (a.status === 'gereserveerd') a.status = 'bezig'
      a.bezig_tot = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      return { data: kopie(a), error: null }
    }
    if (naam === 'referral_vrijgeven') {
      if (!a || a.status !== p.p_van) return { data: { ok: false, reden: 'status_gewijzigd' }, error: null }
      vrijgeven(a, p.p_eind, p.p_reden)
      return { data: { ok: true }, error: null }
    }
    if (naam === 'referral_reserveer') {
      const b = zoek('arnobot_payments', p.p_doel)!
      ;(tabellen.arnobot_referral_acties ??= []).push(nieuweActie({ id: p.p_actie, user_id: p.p_user, doel_id: p.p_doel, gegevens: p.p_gegevens }))
      b.referral_refund_cent += 1210
      return { data: { ok: true, bruto_cent: 1210, netto_cent: 1000, bestaand: false }, error: null }
    }
    return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${naam} in the schema cache` } }
  }

  const nieuweActie = (extra: Rij): Rij => ({
    soort: 'tegoed_terugstorten', referral_id: null, doel_soort: 'betaling', bruto_cent: 1210, netto_cent: 1000, status: 'gereserveerd',
    bezig_tot: null, pogingen: 0, fout: null, mollie_refund_id: null, gegevens: {}, credit_status: 'nvt', ...extra,
  })

  return {
    from, rpc,
    /** Leeg beginnen, met tegoed bij de gebruiker en een betaalde betaling. */
    async zaai(betaling: Rij, _tegoedNettoCent: number) {
      tabellen = { arnobot_payments: [kopie(betaling)], arnobot_referral_acties: [] }
    },
    /** Een gereserveerde actie, zoals na stap 1. */
    async zetReservering(id: string, gegevens: Rij, extra: Rij = {}) {
      const betaling = tabellen.arnobot_payments[0]
      tabellen.arnobot_referral_acties.push(nieuweActie({ id, user_id: betaling.user_id, doel_id: betaling.id, gegevens, ...extra }))
      betaling.referral_refund_cent += 1210
    },
    async actie(id: string) { return kopie(zoek('arnobot_referral_acties', id))! },
    async betaling(id: string) { return kopie(zoek('arnobot_payments', id))! },
    async wijzigBetaling(id: string, patch: Rij) { Object.assign(zoek('arnobot_payments', id)!, patch) },
    async wijzigActie(id: string, patch: Rij) { Object.assign(zoek('arnobot_referral_acties', id)!, patch) },
    /** De tien minuten van de claim zijn voorbij. */
    async verloopClaims() { (tabellen.arnobot_referral_acties ?? []).forEach(a => { a.bezig_tot = null }) },
    async tegoedOver(): Promise<number | null> { return null },
  }
}

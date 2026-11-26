/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ tabellen: {} as Record<string, any[]>, mails: [] as any[], lukt: true, meeloop: false }))
vi.mock('./referralStand', () => ({ get MEELOOP() { return h.meeloop } }))
vi.mock('./mails', () => ({ verstuurBillingMail: async (u: string, type: string, b: any) => { if (h.lukt) h.mails.push([u, type, b.bedragCent ?? null]); return h.lukt } }))
vi.mock('./db', () => ({
  billingDb: {
    from(t: string) {
      const filters: ((r: any) => boolean)[] = []
      let patch: any = null
      const uit = () => {
        const rijen = (h.tabellen[t] ?? []).filter(r => filters.every(f => f(r)))
        if (patch) rijen.forEach(r => Object.assign(r, patch))
        return { data: rijen.map(r => ({ ...r })), error: null }
      }
      const q: any = {
        select: () => q, order: () => q, limit: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string) => { filters.push(r => r[k] === null || r[k] === undefined); return q },
        in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q },
        update: (p: any) => { patch = p; return q },
        then: (ok: any, nee: any) => Promise.resolve(uit()).then(ok, nee),
      }
      return q
    },
  },
}))

import { verstuurReferralMails } from './referralMails'
import { getEmailTemplate } from '@/lib/email-templates'

const NU = new Date('2027-02-01T06:00:00.000Z')
const vers = '2027-01-30T06:00:00.000Z'
const oud = '2027-01-01T06:00:00.000Z'

beforeEach(() => {
  vi.stubEnv('REFERRAL_MAILS', 'true')
  vi.stubEnv('REFERRAL_MAILS_VANAF', '2027-01-01')
  h.mails = []
  h.lukt = true
  h.meeloop = false
  h.tabellen = {
    arnobot_referral_acties: [
      { id: 'a1', user_id: 'klant', status: 'bevestigd', soort: 'voordeel_maand', doel_id: 'p1', bruto_cent: 2900, mail_at: null, created_at: vers },
      { id: 'a2', user_id: 'oud', status: 'bevestigd', soort: 'tegoed_terugstorten', doel_id: 'p2', bruto_cent: 2299, mail_at: null, created_at: oud },
      { id: 'a3', user_id: 'hand', status: 'bevestigd', soort: 'tegoed_terugstorten', doel_id: 'handmatig:x', bruto_cent: 100, mail_at: null, created_at: vers },
      { id: 'a4', user_id: 'onderweg', status: 'verzonden', soort: 'voordeel_jaar', doel_id: 'p4', bruto_cent: 100, mail_at: null, created_at: vers },
    ],
    arnobot_referral_grootboek: [
      { id: 'g1', referral_id: 'r1', meeloop: false, soort: 'toekenning', aanbrenger_user_id: 'aanbrenger', netto_cent: 1900, event_key: 'uitkomst:r1', mail_at: null, created_at: vers },
      { id: 'g2', meeloop: false, soort: 'verval', aanbrenger_user_id: 'aanbrenger', netto_cent: 0, event_key: 'verval:r2', mail_at: null, created_at: vers },
      { id: 'g3', meeloop: true, soort: 'toekenning', aanbrenger_user_id: 'meeloper', netto_cent: 1900, event_key: 'uitkomst:r3', mail_at: null, created_at: vers },
      { id: 'g4', referral_id: 'r4', meeloop: false, soort: 'terugdraaiing', aanbrenger_user_id: 'aanbrenger', netto_cent: -1900, event_key: 'terugdraaiing:r1:1', mail_at: null, created_at: vers },
    ],
  }
})
afterEach(() => vi.unstubAllEnvs())

describe('referralmails', () => {
  it('schakelaar uit: niets', async () => {
    vi.stubEnv('REFERRAL_MAILS', '')
    await verstuurReferralMails(NU)
    expect(h.mails).toEqual([])
  })
  it('alleen wat vers, echt en afgerond is, en een keer', async () => {
    await verstuurReferralMails(NU)
    await verstuurReferralMails(NU)
    expect(h.mails).toEqual([
      ['klant', 'referral_voordeel', 2900],
      ['aanbrenger', 'referral_tegoed_toegekend', 1900],
      ['aanbrenger', 'referral_tegoed_teruggedraaid', 1900],
    ])
  })
  it('zonder startdatum gaat er niets uit, en niets van voor de startdatum', async () => {
    vi.stubEnv('REFERRAL_MAILS_VANAF', '')
    await verstuurReferralMails(NU)
    vi.stubEnv('REFERRAL_MAILS_VANAF', '2027-01-31')
    await verstuurReferralMails(NU)
    expect(h.mails).toEqual([])
  })
  it('een toekenning die al teruggedraaid is en een terugdraaiing die al hersteld is worden niet gemaild', async () => {
    h.tabellen.arnobot_referral_grootboek.push(
      { id: 'g5', referral_id: 'r1', meeloop: false, soort: 'terugdraaiing', aanbrenger_user_id: 'aanbrenger', netto_cent: -1900, event_key: 'terugdraaiing:r1:1', mail_at: 'al', created_at: vers },
      { id: 'g6', referral_id: 'r4', meeloop: false, soort: 'herstel', aanbrenger_user_id: 'aanbrenger', netto_cent: 1900, event_key: 'herstel:r4:1', mail_at: null, created_at: vers },
    )
    await verstuurReferralMails(NU)
    expect(h.mails.map(x => x[1])).toEqual(['referral_voordeel'])
  })
  it('in de meeloopstand geen mail over grootboekregels', async () => {
    h.meeloop = true
    await verstuurReferralMails(NU)
    expect(h.mails.map(x => x[1])).toEqual(['referral_voordeel'])
  })
  it('mislukt het versturen, dan komt hij de volgende ronde terug', async () => {
    h.lukt = false
    expect((await verstuurReferralMails(NU)).mislukt).toBe(3)
    h.lukt = true
    expect((await verstuurReferralMails(NU)).verstuurd).toBe(3)
  })
  it.each(['referral_voordeel', 'referral_tegoed_toegekend', 'referral_tegoed_verrekend', 'referral_tegoed_vervallen', 'referral_tegoed_teruggedraaid'] as const)(
    '%s heeft een tekst zonder gedachtestreep of lege waarde', type => {
      const m = getEmailTemplate(type, 'Test', false, { userId: 'u', billing: { bedragCent: 2299, reden: 'je gratis vierde maand' } })
      const tekst = m.subject + m.html.replace(/<style[\s\S]*?<\/style>/g, '')
      expect(m.subject.length).toBeGreaterThan(5)
      expect(tekst).not.toMatch(/undefined|null|\u2014|\u2013/)
    })
})

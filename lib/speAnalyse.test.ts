import { describe, expect, it } from 'vitest'
import { speAnalyseStatus } from './speAnalyse'

const NU = new Date('2026-11-19T12:00:00Z').getTime()
const dagenTerug = (d: number) => new Date(NU - d * 86400000).toISOString()
const ids = (n: number, prefix = 'a') => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

describe('speAnalyseStatus', () => {
  it('niet zonder teamleden', () => {
    expect(speAnalyseStatus({ heeftTeamleden: false, logIds: ids(10), vorige: null, nu: NU })).toEqual({ mogelijk: false, reden: 'geen_teamleden' })
  })

  it('te weinig onder 3 1:1\'s in totaal, ook met een eerdere analyse', () => {
    expect(speAnalyseStatus({ heeftTeamleden: true, logIds: ids(2), vorige: null, nu: NU })).toMatchObject({ mogelijk: false, reden: 'te_weinig', totaal: 2 })
    expect(speAnalyseStatus({ heeftTeamleden: true, logIds: ids(2), vorige: { updatedAt: dagenTerug(60), usedIds: [] }, nu: NU })).toMatchObject({ reden: 'te_weinig' })
  })

  it('eerste analyse mogelijk vanaf 3 1:1\'s', () => {
    expect(speAnalyseStatus({ heeftTeamleden: true, logIds: ids(3), vorige: null, nu: NU })).toEqual({ mogelijk: true, totaal: 3, nieuw: 3, eerdereAnalyse: false })
  })

  it('te vroeg binnen 14 dagen, ook met genoeg nieuwe 1:1\'s', () => {
    const r = speAnalyseStatus({ heeftTeamleden: true, logIds: ids(10), vorige: { updatedAt: dagenTerug(5), usedIds: [] }, nu: NU })
    expect(r).toMatchObject({ mogelijk: false, reden: 'te_vroeg', nieuw: 10, dagenResterend: 9 })
  })

  it('te vroeg bij minder dan 3 nieuwe 1:1\'s, ook na 14 dagen', () => {
    const r = speAnalyseStatus({ heeftTeamleden: true, logIds: ids(12), vorige: { updatedAt: dagenTerug(30), usedIds: ids(10) }, nu: NU })
    expect(r).toMatchObject({ mogelijk: false, reden: 'te_vroeg', nieuw: 2, dagenResterend: 0 })
  })

  it('mogelijk na 14 dagen met 3 of meer nieuwe 1:1\'s', () => {
    const r = speAnalyseStatus({ heeftTeamleden: true, logIds: ids(13), vorige: { updatedAt: dagenTerug(14), usedIds: ids(10) }, nu: NU })
    expect(r).toEqual({ mogelijk: true, totaal: 13, nieuw: 3, eerdereAnalyse: true })
  })
})

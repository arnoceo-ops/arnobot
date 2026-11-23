import { describe, it, expect } from 'vitest'
import { beslisMobielToegang, ADMIN_MOBIEL_USER_ID } from './adminMobiel'

describe('beslisMobielToegang', () => {
  it('weigert zonder sessie', () => {
    expect(beslisMobielToegang(null, true)).toEqual({ ok: false, reden: 'niet-ingelogd' })
  })
  it('weigert een ander account, ook met LinkedIn', () => {
    expect(beslisMobielToegang('user_ander', true)).toEqual({ ok: false, reden: 'ander-account' })
  })
  it('weigert het juiste account zonder geverifieerde LinkedIn-koppeling', () => {
    expect(beslisMobielToegang(ADMIN_MOBIEL_USER_ID, false)).toEqual({ ok: false, reden: 'geen-linkedin' })
  })
  it('laat het juiste account met LinkedIn toe', () => {
    expect(beslisMobielToegang(ADMIN_MOBIEL_USER_ID, true)).toEqual({ ok: true })
  })
})

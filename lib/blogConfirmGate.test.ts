import { describe, it, expect } from 'vitest'
import { isUserInitiatedNavigation } from './blogConfirmGate'

const h = (o: Record<string, string>) => new Headers(o)

describe('isUserInitiatedNavigation', () => {
  it('herkent een echte klik in een browser', () => {
    expect(isUserInitiatedNavigation(h({ 'sec-fetch-user': '?1', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' }))).toBe(true)
  })
  it('weigert een scanner zonder Sec-Fetch-headers', () => {
    expect(isUserInitiatedNavigation(h({ 'user-agent': 'Mozilla/5.0' }))).toBe(false)
  })
  it('weigert een automatische (niet door de gebruiker gestarte) navigatie', () => {
    expect(isUserInitiatedNavigation(h({ 'sec-fetch-mode': 'navigate' }))).toBe(false)
    expect(isUserInitiatedNavigation(h({ 'sec-fetch-user': '?0', 'sec-fetch-mode': 'navigate' }))).toBe(false)
  })
  it('weigert een fetch of prefetch', () => {
    expect(isUserInitiatedNavigation(h({ 'sec-fetch-user': '?1', 'sec-fetch-mode': 'cors' }))).toBe(false)
  })
})

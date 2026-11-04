import { describe, it, expect } from 'vitest'
import { isSaldoOp } from './capaciteit'

describe('isSaldoOp', () => {
  it('herkent een leeg Anthropic-tegoed', () => {
    expect(isSaldoOp({ status: 400, message: 'Your credit balance is too low to access the Anthropic API.' })).toBe(true)
  })
  it('negeert andere fouten', () => {
    expect(isSaldoOp({ status: 400, message: 'invalid_request: messages' })).toBe(false)
    expect(isSaldoOp({ status: 429, message: 'credit balance' })).toBe(false)
    expect(isSaldoOp(null)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { schoonBron } from './bron'

describe('schoonBron', () => {
  it('accepteert een gewone bron en maakt kleine letters', () => {
    expect(schoonBron('folder-solo')).toBe('folder-solo')
    expect(schoonBron(' Folder-Team ')).toBe('folder-team')
  })

  it('weigert ontbrekende of niet-tekstwaarden', () => {
    expect(schoonBron(undefined)).toBeNull()
    expect(schoonBron(null)).toBeNull()
    expect(schoonBron(42)).toBeNull()
    expect(schoonBron('')).toBeNull()
  })

  it('weigert tekens buiten a-z, 0-9 en streepje', () => {
    expect(schoonBron('folder solo')).toBeNull()
    expect(schoonBron("x'; drop table")).toBeNull()
    expect(schoonBron('<script>')).toBeNull()
    expect(schoonBron('folder_solo')).toBeNull()
  })

  it('weigert te lange waarden', () => {
    expect(schoonBron('a'.repeat(40))).toBe('a'.repeat(40))
    expect(schoonBron('a'.repeat(41))).toBeNull()
  })
})

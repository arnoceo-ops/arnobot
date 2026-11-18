import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Bewaking van de aansluiting van GRENSGEVAL op de chatroute (lib/moderatie.ts). De route heeft geen volledige routetest; deze test leest de bron en
// dwingt af dat een grensgeval NIET wordt geblokkeerd (geen OFFTOPIC of ONGEPAST) en dat de extra instructie in de systeemprompt komt.

const bron = readFileSync(join(__dirname, 'route.ts'), 'utf8')

describe('GRENSGEVAL in de chatroute', () => {
  it('herkent het oordeel aan de eerste regel van de moderatie', () => {
    expect(bron).toContain("const grensGeval = check.includes('GRENSGEVAL')")
  })
  it('blokkeert alleen op ONGEPAST en OFFTOPIC, nooit op GRENSGEVAL', () => {
    const m = bron.match(/if \(check\.includes\('ONGEPAST'\)[^)]*\)/)
    expect(m).not.toBeNull()
    expect(m![0]).not.toContain('GRENSGEVAL')
  })
  it('zet de extra instructie alleen bij een grensgeval in de systeemprompt', () => {
    expect(bron).toMatch(/buildRdsSystemPrompt\([^,]*\(grensGeval \? GRENSGEVAL_INSTRUCTIE : ''\)/)
  })
})

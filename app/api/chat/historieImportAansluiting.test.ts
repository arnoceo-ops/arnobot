import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Bewaking van de aansluiting van het profiel uit een andere AI op de chatroute (docs/HISTORIE_IMPORT_PLAN.md). De route heeft geen volledige
// routetest; deze test leest de bron en dwingt de drie afspraken af die niet mogen verdwijnen:
//  1. het profiel wordt alleen geladen voor wie de schakelaar heeft,
//  2. het staat in de systeemprompt,
//  3. het staat NIET in bronContext (de log die 30 dagen blijft staan, naar de waarheidsmail gaat en in de export zit).

const bron = readFileSync(join(__dirname, 'route.ts'), 'utf8')

describe('profiel uit een andere AI in de chatroute', () => {
  it('laadt het profiel alleen als de schakelaar aan staat, en een fout kost nooit het antwoord', () => {
    const m = bron.match(/const importProfielPromise[\s\S]{0,400}?Promise\.resolve\(''\)/)
    expect(m).not.toBeNull()
    expect(m![0]).toContain('historieImportBeschikbaarVoor(userId)')
    expect(m![0]).toContain(".catch(() => '')")
  })
  it('zet het profiel in de systeemprompt', () => {
    const m = bron.match(/buildRdsSystemPrompt\(([^,]+),/)
    expect(m).not.toBeNull()
    expect(m![1]).toContain('importProfiel')
  })
  it('zet het profiel niet in bronContext', () => {
    const m = bron.match(/const bronContext = \[[\s\S]*?\]\s*\.filter/)
    expect(m).not.toBeNull()
    expect(m![0]).not.toContain('importProfiel')
  })
})

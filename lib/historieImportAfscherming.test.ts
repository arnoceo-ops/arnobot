import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

// Het profiel uit een andere AI mag nooit in analyses, managerroutes, de blijvende feiten of arnobot_memory_entities terechtkomen
// (docs/HISTORIE_IMPORT_PLAN.md). De enige manier om dat af te dwingen is dat de naam van de tabel op precies één plek voorkomt:
// lib/historieImport.ts. Alles anders leest via de functies daaruit (bijvoorbeeld de gegevensexport via leesProfielen).

const ROOT = join(__dirname, '..')
const TOEGESTAAN = new Set(['lib/historieImport.ts'])

function bestanden(dir: string, uit: string[] = []): string[] {
  for (const naam of readdirSync(dir)) {
    if (naam === 'node_modules' || naam === '.next' || naam === '.git') continue
    const pad = join(dir, naam)
    if (statSync(pad).isDirectory()) bestanden(pad, uit)
    else if (/\.(ts|tsx)$/.test(naam) && !/\.test\.(ts|tsx)$/.test(naam)) uit.push(pad)
  }
  return uit
}

describe('de tabel met profielen uit een andere AI', () => {
  it('komt in app/ en lib/ alleen voor in lib/historieImport.ts', () => {
    const verkeerd = [...bestanden(join(ROOT, 'app')), ...bestanden(join(ROOT, 'lib'))]
      .map(f => relative(ROOT, f).replace(/\\/g, '/'))
      .filter(rel => !TOEGESTAAN.has(rel))
      .filter(rel => readFileSync(join(ROOT, rel), 'utf8').includes('arnobot_import_profielen'))
    expect(verkeerd).toEqual([])
  })
  it('staat nog wel in lib/historieImport.ts (anders test deze controle niets)', () => {
    expect(readFileSync(join(ROOT, 'lib/historieImport.ts'), 'utf8')).toContain('arnobot_import_profielen')
  })
})

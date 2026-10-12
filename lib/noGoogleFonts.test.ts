import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// Afdwinging van de regel "Lettertypen zelf hosten" (CLAUDE.md): een verwijzing naar Google Fonts
// stuurt het IP-adres van elke bezoeker naar Google. Nieuwe lettertypen gaan via
// scripts/fetch-fonts.mjs, nooit via een @import of <link> naar fonts.googleapis.com.
// scripts/ wordt ook gecontroleerd; alleen fetch-fonts.mjs mag naar Google, want die haalt de
// bestanden eenmalig op (zie TOEGESTAAN).

const ROOT = path.resolve(__dirname, '..')
const SCAN = ['app', 'lib', 'public', 'scripts', 'proxy.ts', 'next.config.ts']
const EXT = /\.(ts|tsx|js|jsx|mjs|css|html|svg)$/
const VERBODEN = /fonts\.googleapis\.com|fonts\.gstatic\.com/
// Dit testbestand zelf, en pdfFonts.ts waar het in een uitleg-commentaar voorkomt.
const TOEGESTAAN = new Set(['lib/noGoogleFonts.test.ts', 'lib/pdfFonts.ts', 'scripts/fetch-fonts.mjs'])

function walk(p: string, out: string[]) {
  const st = statSync(p)
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) walk(path.join(p, f), out)
  } else if (EXT.test(p)) {
    out.push(p)
  }
}

describe('lettertypen zelf hosten', () => {
  it('geen enkele verwijzing naar Google Fonts in app, lib, public, scripts, proxy of next.config', () => {
    const files: string[] = []
    for (const s of SCAN) walk(path.join(ROOT, s), files)
    const schenders = files
      .map(f => path.relative(ROOT, f).replace(/\\/g, '/'))
      .filter(rel => !TOEGESTAAN.has(rel))
      .filter(rel => VERBODEN.test(readFileSync(path.join(ROOT, rel), 'utf8')))
    expect(schenders).toEqual([])
  })

  it('app/fonts.css wijst alleen naar lokale bestanden die bestaan', () => {
    const css = readFileSync(path.join(ROOT, 'app/fonts.css'), 'utf8')
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map(m => m[1])
    expect(urls.length).toBeGreaterThan(0)
    for (const u of urls) {
      expect(u.startsWith('/fonts/')).toBe(true)
      expect(() => statSync(path.join(ROOT, 'public', u))).not.toThrow()
    }
  })
})

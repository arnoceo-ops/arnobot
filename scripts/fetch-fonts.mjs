// Haalt de merklettertypen EENMALIG op bij Google Fonts en zet ze als woff2 in public/fonts/,
// plus app/fonts.css met de bijbehorende @font-face-regels. Reden: bezoekers van arno.bot
// mogen geen verzoek naar Google sturen (IP-adres naar Google, AVG). De browser laadt nu
// alleen /fonts/*.woff2 van ons eigen domein.
//
// Gebruik: node scripts/fetch-fonts.mjs   (opnieuw draaien alleen als er een font of gewicht bijkomt)
// Lettertypen zijn onder de SIL Open Font License, zelf hosten is toegestaan.
// Alleen de subsets latin en latin-ext (NL/EN/FR/DE/ES/PT), via unicode-range laadt de browser
// alleen wat de pagina echt nodig heeft.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FAMILIES = [
  'Bebas+Neue',
  'Space+Mono:wght@400;700',
  'Oswald:wght@500;600',
  'Figtree:wght@400;500;600',
  'Barlow:wght@400;700',
  'Barlow+Condensed:wght@300;600;900',
  'Open+Sans:wght@400;700',
  'Playfair+Display:ital@0;1',
]
const KEEP_SUBSETS = new Set(['latin', 'latin-ext'])
// Moderne UA, anders levert Google ttf i.p.v. woff2.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

const outDir = path.resolve('public/fonts')
await mkdir(outDir, { recursive: true })

const css = await (await fetch(
  `https://fonts.googleapis.com/css2?${FAMILIES.map(f => 'family=' + f).join('&')}&display=swap`,
  { headers: { 'User-Agent': UA } },
)).text()

const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
const filesByUrl = new Map()
const rules = []

for (const [, subset, rule] of blocks) {
  if (!KEEP_SUBSETS.has(subset)) continue
  const family = rule.match(/font-family:\s*'([^']+)'/)[1]
  const style = rule.match(/font-style:\s*(\w+)/)[1]
  const weight = rule.match(/font-weight:\s*([\d ]+)/)[1].trim()
  const url = rule.match(/url\((https:[^)]+)\)/)[1]
  const range = rule.match(/unicode-range:\s*([^;]+);/)?.[1]

  let file = filesByUrl.get(url)
  if (!file) {
    file = `${family.replace(/\s+/g, '')}-${style}-${weight.replace(/\s+/g, '_')}-${subset}.woff2`
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    await writeFile(path.join(outDir, file), buf)
    filesByUrl.set(url, file)
  }
  rules.push(
`@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${file}') format('woff2');${range ? `\n  unicode-range: ${range};` : ''}
}`)
}

const header = `/* GEGENEREERD door scripts/fetch-fonts.mjs, niet met de hand wijzigen.
   Zelf gehoste lettertypen (geen verzoeken naar Google). */\n\n`
const body = header + rules.join('\n\n') + '\n'
// app/fonts.css: wordt via app/globals.css meegebundeld voor alle pagina's onder de root layout.
await writeFile(path.resolve('app/fonts.css'), body)
// public/fonts/fonts.css: identieke statische kopie voor wat buiten de root layout valt
// (app/global-error.tsx, public/kleuradvies.html) en voor de embed-widget op andere sites.
await writeFile(path.join(outDir, 'fonts.css'), body)
console.log(`${rules.length} @font-face-regels, ${filesByUrl.size} bestanden in public/fonts/`)

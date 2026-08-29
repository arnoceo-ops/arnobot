// Rendert docs/*.md naar een PDF met dezelfde naam ernaast (docs/X.md -> docs/X.pdf).
// Vervangt de handmatige "Markdown PDF"-VS-Code-extensie-stap.
//
// Gebruik:
//   node scripts/render-docs-pdf.mjs                  alleen docs waarvan de inhoud is gewijzigd
//   node scripts/render-docs-pdf.mjs --force          alles opnieuw
//   node scripts/render-docs-pdf.mjs docs/SALES_BIJBEL.md [meer paden...]   alleen die, altijd
//
// Of via npm:  npm run docs:pdf  [-- docs/X.md]  of  npm run docs:pdf -- --force
//
// "Gewijzigd" wordt bepaald op de INHOUD van het .md-bestand (sha256), niet op de
// bestandsdatum: git bewaart mtimes niet, dus na elke pull/checkout zou dat alles als
// "gewijzigd" zien. De hashes staan in docs/.pdf-render-state.json (mee te committen).
// RENDER_VERSION ophogen bij een stijl-/templatewijziging hieronder forceert alles opnieuw.
//
// Stijl volgt de merknormen uit CLAUDE.md: Bebas Neue voor titels, Space Mono voor body en
// labels, amber (#f59e0b) accent, op een witte achtergrond. Fonts uit public/fonts/.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname, basename, resolve, relative } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createHash } from 'crypto'
import { marked } from 'marked'
import puppeteer from 'puppeteer'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR = join(ROOT, 'docs')
const FONTS_DIR = join(ROOT, 'public', 'fonts')
const STATE_FILE = join(DOCS_DIR, '.pdf-render-state.json')
const RENDER_VERSION = '1'

const bebasUrl = pathToFileURL(join(FONTS_DIR, 'BebasNeue-Regular.ttf')).href
const monoUrl = pathToFileURL(join(FONTS_DIR, 'SpaceMono-Regular.ttf')).href

function sourceHash(mdPath) {
  return createHash('sha256').update(RENDER_VERSION + '\0').update(readFileSync(mdPath)).digest('hex')
}

function parseArgs() {
  const raw = process.argv.slice(2)
  const force = raw.includes('--force')
  const paths = raw.filter(a => !a.startsWith('--'))

  if (paths.length > 0) {
    const explicit = paths.map(a => resolve(ROOT, a)).filter(p => {
      if (!p.endsWith('.md') || !existsSync(p)) {
        console.warn(`overgeslagen (geen bestaand .md-bestand): ${p}`)
        return false
      }
      return true
    })
    return { targets: explicit, force: true } // expliciet pad = altijd renderen
  }

  // Geen paden: elke docs/*.md die al een .pdf-buur heeft (dus geen nieuwe PDF's aanmaken
  // voor puur-interne docs zoals CLAUDE_HISTORY.md of AUDIT_FINDINGS.md).
  const all = readdirSync(DOCS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => join(DOCS_DIR, f))
    .filter(p => existsSync(p.replace(/\.md$/, '.pdf')))
  return { targets: all, force }
}

const CSS = `
  @font-face { font-family: 'Bebas Neue'; src: url('${bebasUrl}') format('truetype'); }
  @font-face { font-family: 'Space Mono'; src: url('${monoUrl}') format('truetype'); }

  * { box-sizing: border-box; }
  html, body { background: #ffffff; }
  body {
    font-family: 'Space Mono', ui-monospace, monospace;
    font-size: 10pt;
    line-height: 1.8;
    color: #1f2937;
    margin: 0;
  }
  .eyebrow {
    font-family: 'Space Mono', monospace;
    font-size: 8pt;
    letter-spacing: 4px;
    color: #f59e0b;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  h1, h2, h3, h4 { font-family: 'Bebas Neue', sans-serif; color: #111827; font-weight: 400; letter-spacing: 1px; line-height: 1.15; }
  h1 { font-size: 30pt; margin: 0 0 18px; padding-bottom: 10px; border-bottom: 2px solid #f59e0b; }
  h2 { font-size: 19pt; margin: 30px 0 10px; }
  h3 { font-size: 14pt; margin: 22px 0 8px; letter-spacing: 2px; }
  h4 { font-size: 11pt; margin: 18px 0 6px; letter-spacing: 2px; color: #374151; }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 10px; padding-left: 22px; }
  li { margin-bottom: 4px; }
  strong { color: #111827; }
  em { font-style: italic; }
  a { color: #b45309; text-decoration: none; }
  code {
    font-family: 'Space Mono', monospace;
    font-size: 8.8pt;
    background: #f3f4f6;
    padding: 1px 4px;
    border-radius: 3px;
  }
  pre {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-left: 3px solid #f59e0b;
    padding: 12px 14px;
    font-size: 8.5pt;
    line-height: 1.55;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0 0 12px;
  }
  pre code { background: none; padding: 0; font-size: inherit; }
  blockquote {
    margin: 0 0 12px;
    padding: 2px 0 2px 14px;
    border-left: 3px solid #f59e0b;
    color: #4b5563;
  }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 22px 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 14px; font-size: 8.8pt; }
  th { text-align: left; border-bottom: 2px solid #111827; padding: 6px 8px; color: #111827; }
  td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; line-height: 1.5; }
  h1, h2, h3 { break-after: avoid; }
  pre, table, blockquote { break-inside: avoid; }
`

export function htmlFor(mdPath) {
  const md = readFileSync(mdPath, 'utf8')
  const bodyHtml = marked.parse(md, { gfm: true, breaks: false })
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><div class="eyebrow">ArnoBot</div>${bodyHtml}</body></html>`
}

async function main() {
  const { targets, force } = parseArgs()
  if (targets.length === 0) {
    console.log('Geen doelen.')
    return
  }

  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {}
  const todo = []
  for (const mdPath of targets) {
    const key = relative(DOCS_DIR, mdPath).replace(/\\/g, '/')
    const hash = sourceHash(mdPath)
    const pdfPath = mdPath.replace(/\.md$/, '.pdf')
    if (!force && state[key] === hash && existsSync(pdfPath)) continue
    todo.push({ mdPath, pdfPath, key, hash })
  }

  if (todo.length === 0) {
    console.log('Alle PDF\'s zijn actueel.')
    return
  }

  const browser = await puppeteer.launch()
  try {
    for (const { mdPath, pdfPath, key, hash } of todo) {
      const name = basename(mdPath)
      const page = await browser.newPage()
      await page.setContent(htmlFor(mdPath), { waitUntil: 'load', timeout: 60000 })
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `<div style="font-family:monospace;font-size:7px;color:#9ca3af;width:100%;padding:0 18mm;display:flex;justify-content:space-between;">
          <span>${name}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      })
      await page.close()
      state[key] = hash
      console.log(`ok  ${basename(pdfPath)}`)
    }
  } finally {
    await browser.close()
  }

  writeFileSync(STATE_FILE, JSON.stringify(state, Object.keys(state).sort(), 2) + '\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1) })
}

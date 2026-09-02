// Rendert een artifact-HTML-bestand (donker thema) naar een PDF in de lichte ArnoBot-
// printopmaak: wit vlak, Bebas Neue-koppen, Space Mono-body, amber accent, donkere
// hero-band met woordmerk op pagina 1, en een merk-footer met paginanummers.
//
// Gebruik:
//   node scripts/render-artifact-pdf.mjs <in.html> <uit.pdf> [<in2.html> <uit2.pdf> ...]
//
// Companion van scripts/render-docs-pdf.mjs (die doet docs/*.md). Deze doet de
// artifact-HTML die de artifact-editor oplevert, met behoud van de kaart-componenten
// (pijplijn, gates, tegels, rollenraster) die in een kale markdown-render verloren gaan.

import { readFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import puppeteer from 'puppeteer'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS_DIR = join(ROOT, 'public', 'fonts')
const bebasUrl = pathToFileURL(join(FONTS_DIR, 'BebasNeue-Regular.ttf')).href
const monoUrl = pathToFileURL(join(FONTS_DIR, 'SpaceMono-Regular.ttf')).href

const OVERRIDE_CSS = `
  @font-face { font-family: 'Bebas Neue'; src: url('${bebasUrl}') format('truetype'); font-display: block; }
  @font-face { font-family: 'Space Mono'; src: url('${monoUrl}') format('truetype'); font-display: block; }

  :root, :root:not([data-theme]), :root[data-theme="dark"] {
    --bg:#ffffff; --surface:#ffffff; --surface-2:#f5f3ee; --card:#ffffff;
    --border:#e4e0d5; --border-soft:#efece2;
    --text:#161512; --body:#46433c; --text-muted:#57534a; --text-faint:#8a857a; --dim:#8a857a;
    --amber:#f59e0b; --amber-hover:#d97706; --good:#1a7f4b; --bad:#b3261e; --green:#1a7f4b;
  }

  html, body { background:#ffffff !important; color:#46433c !important; }
  body { font-family:'Space Mono', ui-monospace, monospace !important; font-size:10pt !important; line-height:1.75 !important; }

  /* app-chrome eruit, inhoud vult de printbreedte */
  nav.toc, .toc { display:none !important; }
  .shell { display:block !important; max-width:none !important; margin:0 !important; padding:0 !important; gap:0 !important; grid-template-columns:none !important; }
  main, .wrap { max-width:none !important; margin:0 !important; padding:0 !important; }

  /* woordmerk */
  .pdf-mast { font-family:'Bebas Neue',sans-serif !important; font-size:20pt; letter-spacing:6px; line-height:1; margin:0 0 14px; }
  .pdf-mast .a { color:#111827; } .pdf-mast .b { color:#f59e0b; }

  /* donkere hero-band */
  header.hero, .pdf-hero {
    background:#111827 !important; border:none !important; border-radius:10px;
    padding:26px 30px !important; margin:0 0 34px !important; color:#9ca3af !important;
  }
  header.hero .kicker, .pdf-hero .kicker, .pdf-hero .eyebrow { color:#f59e0b !important; }
  header.hero h1, .pdf-hero h1 { color:#f1f5f9 !important; border:none !important; padding:0 !important; }
  header.hero p.dek, .pdf-hero p.dek, .pdf-hero p.intro { color:#cbd0d8 !important; margin-bottom:10px !important; }
  header.hero .meta, .pdf-hero .meta { color:#8a8f98 !important; border:none !important; padding:0 !important; margin-top:14px !important; max-width:none !important; }

  h1,h2,h3,h4 { font-family:'Bebas Neue',sans-serif !important; color:#111827 !important; }
  .part h2, section h2 { color:#111827 !important; }
  section .tag, .part .partnum, .pipeline .stage .step, .gate .glabel, .wchip .wname, .tile .tlabel, .chip.on { color:#b45309 !important; }
  a { color:#b45309 !important; }
  code { background:#f3f4f6 !important; border-color:#e5e7eb !important; color:#111827 !important; }

  /* kaarten op wit */
  .pillar, .pipeline .stage, .tilegrid, .rolecard, .wchip, .chip { background:#ffffff !important; border-color:#e4e0d5 !important; }
  .gate { background:#faf8f3 !important; border-left-color:#f59e0b !important; }
  .pillar p, .pipeline .stage p, .gate p, .wchip p, .tile p.desc, .chip { color:#46433c !important; }
  .pillar .name, .pipeline .stage h4 { color:#111827 !important; }
  .rolecard li { border-color:#ece8dd !important; color:#46433c !important; }
  .rolecard li strong { color:#b45309 !important; }
  .weight-row .seg.dim { background:#e6b877 !important; }
  .tile .tval.good { color:#1a7f4b !important; } .tile .tval.bad { color:#b3261e !important; } .tile .tval.neutral { color:#111827 !important; }

  table { border-color:#e5e7eb !important; }
  th { color:#111827 !important; border-bottom:2px solid #111827 !important; }
  td { color:#46433c !important; border-bottom:1px solid #e5e7eb !important; }
  td strong { color:#111827 !important; }

  hr, .part hr, section, .divider { border-color:#e5e7eb !important; }
  section { border-top-color:#e5e7eb !important; }

  /* Thijs-doc: lijst-items, why-tekst, handvatten, tags */
  .meta { border-bottom:none !important; }
  ul.items li { border-color:#efece2 !important; }
  .dot { background:#f59e0b !important; } .dot.fix { background:#1a7f4b !important; }
  .item-body p { color:#161512 !important; }
  .item-body .why { color:#6b6455 !important; }
  .section-note { color:#8a857a !important; }
  .handvatten { border-color:#e4e0d5 !important; }
  .handvatten p { color:#57534a !important; }
  .handvatten strong { color:#161512 !important; }
  .tag { border-color:#b45309 !important; color:#b45309 !important; }
  .tag.fix { color:#1a7f4b !important; border-color:#1a7f4b !important; }

  /* paginabreuk-gedrag */
  h1,h2,h3 { break-after:avoid; }
  .pipeline, .pillars, .tilegrid, .rolegrid, table, .tablewrap, .gate, .weerstandrow, ul.items li, .handvatten { break-inside:avoid; }
`

const PAGE_SCRIPT = `
  (function () {
    document.querySelectorAll('nav.toc, .toc').forEach(function (n) { n.remove(); });
    var root = document.querySelector('.shell main') || document.querySelector('main')
      || document.querySelector('.wrap') || document.body;

    var mast = document.createElement('div');
    mast.className = 'pdf-mast';
    mast.innerHTML = '<span class="a">ARNO</span><span class="b">BOT</span>';
    root.insertBefore(mast, root.firstChild);

    var hero = root.querySelector('header.hero');
    if (hero) {
      hero.classList.add('pdf-hero');
      root.insertBefore(hero, mast.nextSibling);
    } else {
      hero = document.createElement('div');
      hero.className = 'pdf-hero';
      ['.eyebrow', 'h1', '.intro', '.dek', '.meta'].forEach(function (sel) {
        var el = Array.prototype.find.call(root.children, function (c) { return c.matches(sel); });
        if (el) hero.appendChild(el);
      });
      if (hero.childNodes.length) root.insertBefore(hero, mast.nextSibling);
    }
  })();
`

function buildHtml(srcPath) {
  let html = readFileSync(resolve(srcPath), 'utf8')
  if (!/^\s*<!doctype/i.test(html) && !/^\s*<html/i.test(html)) {
    html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
  }
  const inject = `<style>${OVERRIDE_CSS}</style><script>${PAGE_SCRIPT}<\/script>`
  return html.includes('</body>') ? html.replace('</body>', `${inject}</body>`) : html + inject
}

function footerText(html, srcPath) {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  const title = (m ? m[1] : srcPath.split(/[\\/]/).pop().replace(/\.html?$/i, '')).trim()
  return title.toUpperCase()
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 2 || args.length % 2 !== 0) {
    console.error('gebruik: node scripts/render-artifact-pdf.mjs <in.html> <uit.pdf> [<in2> <uit2> ...]')
    process.exit(1)
  }

  const browser = await puppeteer.launch({ args: ['--font-render-hinting=none'] })
  try {
    for (let i = 0; i < args.length; i += 2) {
      const src = args[i]
      const out = resolve(args[i + 1])
      const html = buildHtml(src)
      const foot = footerText(html, src)

      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 })
      try { await page.evaluate(() => document.fonts.ready) } catch {}
      await new Promise(r => setTimeout(r, 500))

      await page.pdf({
        path: out,
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '20mm', left: '17mm', right: '17mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          `<div style="font-family:'Space Mono',ui-monospace,monospace;font-size:7pt;color:#9ca3af;width:100%;` +
          `padding:0 17mm;display:flex;justify-content:space-between;letter-spacing:1px;">` +
          `<span>ARNOBOT &nbsp;&middot;&nbsp; ${foot}</span>` +
          `<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      })
      await page.close()
      console.log('ok  ' + out)
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })

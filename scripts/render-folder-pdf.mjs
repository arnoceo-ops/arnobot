// Rendert de A5-folder (voor en achter) naar docs/folder/ArnoBot-A5-solo.pdf, zie docs/FOLDER_PLAN.md.
//
// Gebruik:  node scripts/render-folder-pdf.mjs [--preview]
//   --preview schrijft er ook PNG's naast (docs/folder/preview-voor.png en preview-achter.png).
//
// Formaat: A5 (148 x 210 mm) plus 3 mm afloop rondom = 154 x 216 mm per pagina. Alle tekst staat
// minimaal 15 mm van de uiteindelijke rand. De QR-code is een vector (SVG), dus scherp in druk.
// Stijl: docs/app-styleguide.md (Bebas Neue en Space Mono, vaste kleurtokens). Het PDF is RGB;
// vraag de drukker of een CMYK- of PDF/X-versie nodig is.
//
// De QR wijst naar BRON_URL. Een gedrukte QR is niet meer te wijzigen: pas de URL pas aan
// vóór de drukopdracht, niet erna.

import { readFileSync, mkdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'
import puppeteer from 'puppeteer'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'docs', 'folder')
const FONTS_DIR = join(ROOT, 'public', 'fonts')
// Fonts als data-URI inbedden: een file://-URL laadt niet vanuit setContent (about:blank),
// waardoor de pagina stilletjes op Arial terugviel.
const fontData = f => 'data:font/ttf;base64,' + readFileSync(join(FONTS_DIR, f)).toString('base64')
const bebasUrl = fontData('BebasNeue-Regular.ttf')
const monoUrl = fontData('SpaceMono-Regular.ttf')

const BRON_URL = 'https://arno.bot/start?bron=folder-solo'
const KORTE_URL = 'arno.bot/start'

const qrSvg = await QRCode.toString(BRON_URL, {
  type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' },
})

const HTML = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Bebas Neue'; src: url('${bebasUrl}') format('truetype'); }
  @font-face { font-family: 'Space Mono'; src: url('${monoUrl}') format('truetype'); }
  @page { size: 154mm 216mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Space Mono', monospace; font-weight: 400; color: #f1f5f9; }

  .pagina { position: relative; width: 154mm; height: 216mm; overflow: hidden; background: #111827; page-break-after: always; }
  .pagina:last-child { page-break-after: auto; }
  /* 3 mm afloop + 12 mm veilige marge = 15 mm tot de tekst */
  .veilig { position: absolute; inset: 15mm; display: flex; flex-direction: column; }
  .gloed { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 45% at 50% 105%, rgba(245,158,11,0.22), transparent 70%); }

  .logo { font-family: 'Bebas Neue', sans-serif; font-size: 22pt; letter-spacing: 3px; color: #f1f5f9; }
  .logo span { color: #f59e0b; }
  .label { font-family: 'Space Mono', monospace; font-size: 8pt; letter-spacing: 4px; color: #f59e0b; }

  /* VOORKANT */
  .voor-midden { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 9mm; }
  .jij-label { font-family: 'Bebas Neue', sans-serif; font-size: 14pt; letter-spacing: 3px; color: #6b7280; margin-bottom: 2mm; }
  .jij-tekst { font-family: 'Bebas Neue', sans-serif; font-size: 34pt; line-height: 1.12; letter-spacing: 0.5px; color: #f1f5f9; }
  .arno-kaart { background: #1f2937; border-radius: 3mm; padding: 7mm 7mm 8mm; border-left: 1.2mm solid #f59e0b; }
  .arno-label { font-family: 'Bebas Neue', sans-serif; font-size: 14pt; letter-spacing: 3px; color: #f59e0b; margin-bottom: 3mm; }
  .arno-tekst { font-size: 10.5pt; line-height: 1.75; color: #d1d5db; }
  .voor-voet { display: flex; align-items: flex-end; justify-content: space-between; gap: 6mm; }
  .voor-slot { font-family: 'Bebas Neue', sans-serif; font-size: 17pt; letter-spacing: 2px; line-height: 1.2; color: #f1f5f9; }
  .voor-slot span { color: #f59e0b; }

  /* ACHTERKANT */
  .achter-kop { font-family: 'Bebas Neue', sans-serif; font-size: 39pt; line-height: 1.05; letter-spacing: 1.5px; color: #f1f5f9; margin-top: 7mm; }
  .achter-kop span { color: #f59e0b; }
  .punten { margin-top: 9mm; display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 7mm; }
  .punt-titel { font-family: 'Bebas Neue', sans-serif; font-size: 15pt; letter-spacing: 2px; color: #f59e0b; margin-bottom: 1.2mm; }
  .punt-tekst { font-size: 8.5pt; line-height: 1.6; color: #9ca3af; }
  .actie { margin-top: auto; display: flex; align-items: center; gap: 8mm; background: #1f2937; border-radius: 3mm; padding: 7mm; }
  .qr { flex: none; width: 40mm; height: 40mm; background: #ffffff; border-radius: 2mm; padding: 3mm; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .actie-kop { font-family: 'Bebas Neue', sans-serif; font-size: 27pt; letter-spacing: 2px; line-height: 1.05; color: #f1f5f9; }
  .actie-kop span { color: #f59e0b; }
  .actie-sub { margin-top: 2.5mm; font-size: 8.5pt; line-height: 1.6; color: #9ca3af; }
  .actie-url { margin-top: 3mm; font-size: 9.5pt; letter-spacing: 1px; color: #f1f5f9; }
  .voet { margin-top: 5mm; font-size: 7.5pt; line-height: 1.6; color: #6b7280; }
</style></head><body>

<section class="pagina">
  <div class="gloed"></div>
  <div class="veilig">
    <div class="logo">ARNO<span>BOT.</span></div>
    <div class="voor-midden">
      <div>
        <div class="jij-label">JIJ</div>
        <div class="jij-tekst">Ik denk dat ik de deal kwijt ben. Hij reageert niet meer.</div>
      </div>
      <div class="arno-kaart">
        <div class="arno-label">ARNOBOT</div>
        <div class="arno-tekst">Dit is de derde deal die stilvalt nadat je de prijs noemt. Dat ligt niet aan hem, maar aan jouw timing. Niet mailen: bel hem.</div>
      </div>
    </div>
    <div class="voor-voet">
      <div class="voor-slot">DE AI SALES COACH<br>DIE <span>JE GESPREKKEN KENT</span></div>
    </div>
  </div>
</section>

<section class="pagina">
  <div class="gloed"></div>
  <div class="veilig">
    <div class="label">AI SALES COACH</div>
    <div class="achter-kop">SLUIT MEER DEALS MET EEN COACH DIE <span>JE UITDAAGT</span></div>
    <div class="punten">
      <div><div class="punt-titel">HIJ ONTHOUDT</div><div class="punt-tekst">Wat je vorige week zei, weet hij nog. Jij begint nooit meer bij nul.</div></div>
      <div><div class="punt-titel">HIJ SPIEGELT</div><div class="punt-tekst">Eerlijke terugkoppeling op jouw eigen gesprekken. Zo zie je waar je deals blijven hangen.</div></div>
      <div><div class="punt-titel">HIJ LAAT JE OEFENEN</div><div class="punt-tekst">Sparren tegen een lastige prospect of sceptische CFO, voordat het erop aankomt.</div></div>
      <div><div class="punt-titel">HIJ LAAT JE GROEIEN</div><div class="punt-tekst">Mindset, systeem en actie in een coachingrapport. Je ziet je voortgang.</div></div>
    </div>
    <div class="actie">
      <div class="qr">${qrSvg}</div>
      <div>
        <div class="actie-kop">SCAN EN START<br><span>30 DAGEN GRATIS</span></div>
        <div class="actie-sub">Daarna maak je zelf een keuze.</div>
        <div class="actie-url">${KORTE_URL}</div>
      </div>
    </div>
    <div class="voet">Gebouwd op de methode van Arno Diepeveen, oprichter van Royal Dutch Sales.</div>
  </div>
</section>

</body></html>`

mkdirSync(OUT_DIR, { recursive: true })
const preview = process.argv.includes('--preview')

const browser = await puppeteer.launch()
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 582, height: 816, deviceScaleFactor: 2 }) // 154 x 216 mm bij 96 dpi
  await page.setContent(HTML, { waitUntil: 'load', timeout: 60000 })
  await page.evaluateHandle('document.fonts.ready')
  await page.pdf({ path: join(OUT_DIR, 'ArnoBot-A5-solo.pdf'), width: '154mm', height: '216mm', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } })
  console.log('ok  docs/folder/ArnoBot-A5-solo.pdf')
  if (preview) {
    const paginas = await page.$$('.pagina')
    const namen = ['voor', 'achter']
    for (let i = 0; i < paginas.length; i++) {
      await paginas[i].screenshot({ path: join(OUT_DIR, `preview-${namen[i]}.png`) })
      console.log(`ok  docs/folder/preview-${namen[i]}.png`)
    }
  }
} finally {
  await browser.close()
}

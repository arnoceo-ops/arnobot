import puppeteer from 'puppeteer';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Zelf gehost lettertype (public/fonts, via scripts/fetch-fonts.mjs), als data-URI ingebed zodat
// het logo genereren geen verbinding met Google maakt.
const FONT_B64 = readFileSync(join(__dirname, '..', 'public', 'fonts', 'BarlowCondensed-normal-900-latin.woff2')).toString('base64');

async function generateLogo(page, text, outFile) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @font-face { font-family: 'Barlow Condensed'; font-weight: 900; src: url(data:font/woff2;base64,${FONT_B64}) format('woff2'); }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; display: inline-block; }
    .logo {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 300px;
      line-height: 1;
      letter-spacing: -2px;
      white-space: nowrap;
    }
    .dark   { color: #333333; }
    .orange { color: #EE7700; }
  </style>
</head>
<body>
  <div class="logo">${text}</div>
</body>
</html>`;

  await page.setViewport({ width: 3000, height: 400, deviceScaleFactor: 4 });
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  const el = await page.$('.logo');
  const screenshot = await el.screenshot({ omitBackground: true });

  const outPath = join(__dirname, '..', 'public', outFile);
  writeFileSync(outPath, screenshot);
  console.log('Logo opgeslagen:', outPath);
}

const browser = await puppeteer.launch();
const page = await browser.newPage();

await generateLogo(
  page,
  '<span class="dark">ARNO</span><span class="orange">BOT</span>',
  'arnobot-logo.png'
);

await generateLogo(
  page,
  '<span class="orange">SALES</span><span class="dark">CANVAS</span>',
  'salescanvas-logo.png'
);

await browser.close();

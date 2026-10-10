// Erzeugt die PNG-Symbole der App mit Chromium und der mitgelieferten Literata.
// Aufruf: node scripts/make-icons.mjs

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const font = readFileSync(path.join(root, 'src/assets/fonts/literata-latin-wght-normal.woff2')).toString('base64');

const html = (size, pad) => `<!doctype html><html><head><style>
@font-face { font-family: L; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 900; }
html,body { margin:0; background: transparent; }
.i { width:${size}px; height:${size}px; display:grid; place-items:center; background:#2e4e86; border-radius:${pad ? 0 : Math.round(size * 0.22)}px; position:relative; }
.g { font-family: L; font-weight: 600; color:#fff; font-size:${Math.round(size * (pad ? 0.46 : 0.6))}px; line-height:1; transform: translateY(-${Math.round(size * 0.03)}px); }
.u { position:absolute; left:50%; transform:translateX(-50%); bottom:${Math.round(size * (pad ? 0.24 : 0.15))}px; width:${Math.round(size * (pad ? 0.34 : 0.46))}px; height:${Math.max(2, Math.round(size * 0.045))}px; border-radius:99px; background:rgba(255,255,255,.7); }
</style></head><body><div class="i"><span class="g">ß</span><span class="u"></span></div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const out = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [name, size, pad] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size, pad));
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.i').screenshot({ path: path.join(root, 'public', name), omitBackground: !pad });
  console.log('geschrieben:', name);
}
await browser.close();

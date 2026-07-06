// Kuvakaappaustyökalu kehityssilmukan "review"-vaihetta varten: käynnistää
// pienen staattisen palvelimen, avaa pelin Chromiumissa, aloittaa pelin
// valitulla kartalla ja tallentaa kuvan kartta-alueesta. EI osa tuotantoa.
//
// Käyttö: node tools/screenshot.mjs [mapName] [out.png] [w] [h]
//   node tools/screenshot.mjs "Suuri maailma" /tmp/shot.png 900 1400
//
// Vaatii playwright-coren ja esiasennetun Chromiumin (PLAYWRIGHT_BROWSERS_PATH).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

const [, , mapName = '', out = '/tmp/risk-shot.png', w = '900', h = '1500'] = process.argv;

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (p === '/') p = '/index.html';
    const fp = normalize(join(ROOT, p));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('x'); }
    const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); return res.end('x'); }
    res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});

const port = 8099;
await new Promise((r) => server.listen(port, r));

function findChrome() {
  return process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
}

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE EXC:', e.message));

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle' });

// Valitse kartta nimen perusteella (jos annettu).
if (mapName) {
  const ok = await page.evaluate((name) => {
    const btns = [...document.querySelectorAll('#map-picker .map-opt')];
    const b = btns.find((x) => x.textContent.trim() === name);
    if (b) { b.click(); return true; }
    return false;
  }, mapName);
  if (!ok) console.log('VAROITUS: karttaa ei löytynyt:', mapName);
}

// NOSTART=1 → kaappaa aloitusruutu (modal-setup) ilman pelin aloitusta.
if (process.env.NOSTART) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
  console.log('Aloitusruutu tallennettu:', out);
  await browser.close(); server.close(); process.exit(0);
}
await page.click('#btn-start');
// Odota että kartta on rakentunut (aluepolkuja olemassa).
await page.waitForFunction(() => document.querySelectorAll('#g-regions .region, .region').length > 5, { timeout: 8000 }).catch(() => {});
// LITE=1 → pakota kevyt grafiikkatila (verifioi että uudet kerrokset gataantuvat).
if (process.env.LITE) { await page.evaluate(() => document.body.classList.add('lite')); }
await page.waitForTimeout(600);

const map = await page.$('#map-wrap');
await (map || page).screenshot({ path: out });
console.log('Kuva tallennettu:', out);

await browser.close();
server.close();
process.exit(0);

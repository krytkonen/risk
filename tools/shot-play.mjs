// Kuvakaappaus PELITILANTEESTA review-vaihetta varten: ajaa pelin
// hyökkäysvaiheeseen, valitsee hyökkääjän (näyttää valinta- ja
// kohdehighlightit) ja kaappaa kuvan; sitten laukaisee hyökkäyksen ja kaappaa
// hyökkäyskameran zoomin. EI osa tuotantoa.
//
// Käyttö: node tools/shot-play.mjs [mapName] [outPrefix] [w] [h]
//   node tools/shot-play.mjs "Suuri maailma" /tmp/shots/play 900 1500
//   → <prefix>-select.png (highlightit) ja <prefix>-zoom.png (hyökkäyskamera)

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

const [, , mapName = '', prefix = '/tmp/shots/play', w = '900', h = '1500'] = process.argv;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
const port = 8100;
await new Promise((r) => server.listen(port, r));

const chrome = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE EXC:', e.message));

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle' });

if (mapName) {
  await page.evaluate((name) => {
    const b = [...document.querySelectorAll('#map-picker .map-opt')].find((x) => x.textContent.trim() === name);
    if (b) b.click();
  }, mapName);
}
await page.click('#btn-start');
await page.waitForSelector('.region, #g-regions .region', { timeout: 8000 });

const getState = () => page.evaluate(() => {
  const s = window.__risk.getState();
  const owned = Object.keys(s.territories).filter((id) => s.territories[id].owner === s.current);
  // Rajaruutu: oma alue jolla on vihollisnaapuri (→ vahva hyökkääjä syntyy sinne).
  const border = owned.find((id) => window.__risk.adj(id).some((n) => s.territories[n].owner !== s.current));
  return { phase: s.phase, reinforcements: s.reinforcements, owned, border: border || owned[0] };
});
const clickPrimary = async () => {
  const btn = page.locator('#controls button.primary');
  try { await btn.waitFor({ timeout: 2500 }); await btn.click(); await wait(200); }
  catch { /* ei ensisijaista nappia juuri nyt */ }
};

// Vahvistus: valitse oma alue (nappaus valitsee), ensisijainen nappi ("+N")
// sijoittaa kaikki; sen jälkeen ensisijainen nappi vaihtuu "Hyökkäykseen →".
let st = await getState();
let guard = 0;
while (st.phase === 'reinforce' && st.reinforcements > 0 && guard++ < 20) {
  await page.click(`.territory[data-id="${st.border}"]`);  // valitse rajaruutu
  await wait(120);
  await clickPrimary();                                     // "+N" sijoittaa
  st = await getState();
}
// Siirry hyökkäysvaiheeseen.
for (let i = 0; i < 4 && st.phase === 'reinforce'; i++) { await clickPrimary(); st = await getState(); }

// Etsi hyökkääjä jolla vihollisnaapuri.
const atk = await page.evaluate(() => {
  const s = window.__risk.getState();
  for (const id of Object.keys(s.territories)) {
    if (s.territories[id].owner !== s.current || s.territories[id].armies < 2) continue;
    const enemy = window.__risk.adj(id).find((n) => s.territories[n].owner !== s.current);
    if (enemy) return { from: id, to: enemy };
  }
  return null;
});

const map = await page.$('#map-wrap');
if (atk && st.phase === 'attack') {
  await page.click(`.territory[data-id="${atk.from}"]`);   // valitse hyökkääjä → highlightit
  await wait(400);
  await (map || page).screenshot({ path: `${prefix}-select.png` });
  console.log('Kuva:', `${prefix}-select.png`, `(hyökkääjä ${atk.from} → ${atk.to})`);

  await page.click(`.territory[data-id="${atk.to}"]`);      // valitse kohde (punainen rengas)
  await wait(200);
  // Laukaise hyökkäys "Nopat"-napista → cameraFocusIn zoomaa. Yksi kierros ei
  // yleensä valloita (ei valloitusdialogia peittämässä).
  const danger = page.locator('#controls button.danger').first();
  try {
    await danger.waitFor({ timeout: 2500 });
    await danger.click();
    await wait(340);                                        // IN_MS 260 + marginaali → zoom sisällä
    await (map || page).screenshot({ path: `${prefix}-zoom.png` });
    console.log('Kuva:', `${prefix}-zoom.png`, '(hyökkäyskamera zoom)');
  } catch { console.log('Ei Nopat-nappia; ohitin zoom-kuvan'); }

  // --- Valloitusdialogi. Ehkä jo auki (Nopat-hyökkäys valloitti); muuten aja
  //     ison ylivoiman hyökkäys Blitzillä kunnes valloitus. ---
  try {
    if (await page.locator('#modal-conquest:not([hidden])').count()) {
      await wait(200);
      await page.screenshot({ path: `${prefix}-conquest.png` });
      console.log('Kuva:', `${prefix}-conquest.png`, '(valloitusdialogi — Nopat valloitti)');
    } else
    for (let tries = 0; tries < 10; tries++) {
      const best = await page.evaluate(() => {
        const s = window.__risk.getState();
        let b = null;
        for (const id of Object.keys(s.territories)) {
          if (s.territories[id].owner !== s.current || s.territories[id].armies < 3) continue;
          for (const n of window.__risk.adj(id)) {
            if (s.territories[n].owner === s.current) continue;
            const adv = s.territories[id].armies - s.territories[n].armies;
            if (!b || adv > b.adv) b = { from: id, to: n, adv };
          }
        }
        return b;
      });
      if (!best) break;
      await page.click(`.territory[data-id="${best.from}"]`, { force: true });
      await wait(120);
      await page.click(`.territory[data-id="${best.to}"]`, { force: true });
      await wait(120);
      const blitz = page.locator('#controls button.danger').nth(1); // "Blitz ⚡"
      if (!(await blitz.count())) break;
      await blitz.click();
      // Odota joko valloitusdialogi tai taistelun ratkeaminen.
      try {
        await page.waitForSelector('#modal-conquest:not([hidden])', { timeout: 2500 });
        await wait(200);
        await page.screenshot({ path: `${prefix}-conquest.png` });
        console.log('Kuva:', `${prefix}-conquest.png`, `(valloitusdialogi ${best.from}→${best.to})`);
        break;
      } catch { await wait(400); /* ei valloitusta tällä; kokeile seuraavaa */ }
    }
  } catch (e) { console.log('Valloitusdialogin kaappaus ei onnistunut:', e.message); }

  // --- Linnoitusdialogi: sulje mahdollinen valloitus, päätä hyökkäys, avaa
  //     linnoitus (oma alue ≥2 armeijaa → viereinen oma alue). ---
  try {
    if (await page.locator('#modal-conquest:not([hidden])').count()) {
      await page.click('#conquest-confirm'); await wait(300);
    }
    let ph = (await getState()).phase;
    for (let i = 0; i < 4 && ph === 'attack'; i++) { await clickPrimary(); ph = (await getState()).phase; }
    if (ph === 'fortify') {
      const mv = await page.evaluate(() => {
        const s = window.__risk.getState();
        for (const id of Object.keys(s.territories)) {
          if (s.territories[id].owner !== s.current || s.territories[id].armies < 2) continue;
          const own = window.__risk.adj(id).find((n) => s.territories[n].owner === s.current);
          if (own) return { from: id, to: own };
        }
        return null;
      });
      if (mv) {
        await page.click(`.territory[data-id="${mv.from}"]`, { force: true });
        await wait(150);
        await page.click(`.territory[data-id="${mv.to}"]`, { force: true });
        await page.waitForSelector('#modal-fortify:not([hidden])', { timeout: 2500 });
        await wait(200);
        await page.screenshot({ path: `${prefix}-fortify.png` });
        console.log('Kuva:', `${prefix}-fortify.png`, `(linnoitusdialogi ${mv.from}→${mv.to})`);
      } else console.log('Ei linnoitussiirtoa saatavilla');
    }
  } catch (e) { console.log('Linnoitusdialogin kaappaus ei onnistunut:', e.message); }
} else {
  await (map || page).screenshot({ path: `${prefix}-select.png` });
  console.log('Ei hyökkäysmahdollisuutta; kaappasin laudan:', `${prefix}-select.png`, 'phase=', st.phase);
}

await browser.close();
server.close();
process.exit(0);

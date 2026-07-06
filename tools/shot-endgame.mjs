// Kuvakaappaus PELIN LOPUSTA: ajaa aggressiivisen ihmisvuoron kierroksen
// kierrokselta (sijoita rajalle → blitz kaikki mahdolliset → päätä vuoro) ja
// antaa tekoälyn pelata, kunnes peli päättyy → kaappaa voitto-/loppuruutu.
// EI osa tuotantoa.
//
// Käyttö: node tools/shot-endgame.mjs [mapName] [out.png] [w] [h]
//   node tools/shot-endgame.mjs "Taruvaltakunnat" /tmp/shots/gameover.png 900 1500

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
const [, , mapName = 'Taruvaltakunnat', out = '/tmp/shots/gameover.png', w = '900', h = '1500'] = process.argv;
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
const port = 8102;
await new Promise((r) => server.listen(port, r));

const chrome = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE EXC:', e.message));
// Nopea tekoäly (aiDelay 90ms vs 600ms) → nopeampi simulaatio.
await page.addInitScript(() => { try { localStorage.setItem('risk-fast-ai', '1'); } catch (_) {} });
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle' });

// 2 pelaajaa (1 ihminen + 1 TÄ) pienellä kartalla → nopea loppu.
await page.click('#field-players button[data-dir="-1"]').catch(() => {});
await page.evaluate((name) => {
  const b = [...document.querySelectorAll('#map-picker .map-opt')].find((x) => x.textContent.trim() === name);
  if (b) b.click();
}, mapName);
await page.click('#btn-start');
await page.waitForSelector('.region', { timeout: 8000 });

const S = () => page.evaluate(() => {
  const s = window.__risk.getState();
  const cur = s.current;
  const owned = Object.keys(s.territories).filter((id) => s.territories[id].owner === cur);
  const border = owned.find((id) => window.__risk.adj(id).some((n) => s.territories[n].owner !== cur));
  return { phase: s.phase, reinf: s.reinforcements, isAI: s.players[cur].isAI,
    winner: s.winner ?? null, owned, border: border || owned[0], busy: window.__risk.getUi().busy,
    cards: (s.players[cur].cards || []).length };
});
let tradeShot = false;
const primary = async () => { try { await page.click('#controls button.primary', { force: true, timeout: 1200 }); await wait(90); } catch {} };
const clickT = (id) => page.click(`.territory[data-id="${id}"]`, { force: true, timeout: 1200 }).catch(() => {});

let st = await S();
let turns = 0;
while (!st.winner && turns < 60) {
  if (st.phase === 'gameover' || st.winner) break;
  if (st.isAI) { await wait(200); st = await S(); continue; }
  // Korttienvaihto-UI: kun ihmisellä on ≥3 korttia vahvistusvaiheessa, avaa
  // Kortit-nappi → kaappaa (kerran).
  if (process.env.TRADE && !tradeShot && st.phase === 'reinforce' && st.cards >= 3) {
    const btn = page.locator('#controls button', { hasText: 'Kortit' });
    if (await btn.count()) {
      await btn.first().click({ force: true, timeout: 1200 }).catch(() => {});
      if (await page.locator('#modal-trade:not([hidden])').count()) {
        await wait(250);
        await page.screenshot({ path: (out.replace(/\.png$/, '') + '-trade.png') });
        console.log('Kuva:', out.replace(/\.png$/, '') + '-trade.png', `(korttienvaihto, ${st.cards} korttia)`);
        tradeShot = true;
        await page.click('#trade-close', { force: true }).catch(() => {});
        await wait(150);
        st = await S();
      }
    }
  }
  // Ihmisvuoro. Vahvistus:
  let g = 0;
  while (st.phase === 'reinforce' && st.reinf > 0 && g++ < 20) {
    await clickT(st.border); await wait(80); await primary(); st = await S();
  }
  for (let i = 0; i < 3 && st.phase === 'reinforce'; i++) { await primary(); st = await S(); }
  // Hyökkäys: blitz kaikki mahdolliset (ylivoima) muutaman kierroksen.
  let a = 0;
  while (st.phase === 'attack' && a++ < 25) {
    if (await page.locator('#modal-conquest:not([hidden])').count()) {
      await page.click('#conquest-confirm').catch(() => {}); await wait(120); st = await S(); continue;
    }
    const best = await page.evaluate(() => {
      const s = window.__risk.getState();
      let b = null;
      for (const id of Object.keys(s.territories)) {
        if (s.territories[id].owner !== s.current || s.territories[id].armies < 2) continue;
        for (const n of window.__risk.adj(id)) {
          if (s.territories[n].owner === s.current) continue;
          const adv = s.territories[id].armies - s.territories[n].armies;
          if (!b || adv > b.adv) b = { from: id, to: n, adv };
        }
      }
      return b;
    });
    if (!best || best.adv < 1) break;
    await clickT(best.from); await wait(60); await clickT(best.to); await wait(60);
    const blitz = page.locator('#controls button.danger').nth(1);
    if (!(await blitz.count())) break;
    await blitz.click({ force: true, timeout: 1200 }).catch(() => {}); await wait(160);
    st = await S();
  }
  if (await page.locator('#modal-conquest:not([hidden])').count()) { await page.click('#conquest-confirm').catch(() => {}); await wait(150); }
  st = await S();
  for (let i = 0; i < 3 && st.phase === 'attack'; i++) { await primary(); st = await S(); }
  // Linnoitus: ohita (päätä vuoro).
  for (let i = 0; i < 3 && st.phase === 'fortify'; i++) { await primary(); st = await S(); }
  turns++;
  st = await S();
  console.log(`vuoro ${turns}: phase=${st.phase} winner=${st.winner} owned=${st.owned.length}`);
}

// Odota loppuruutua.
await page.waitForSelector('#modal-gameover:not([hidden])', { timeout: 4000 }).catch(() => {});
await wait(500);
await page.screenshot({ path: out });
console.log('Kuva tallennettu:', out, '(winner=', (await S()).winner, ')');

await browser.close();
server.close();
process.exit(0);

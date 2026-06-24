// Playwright-pohjainen savutesti: lataa pelin oikeassa selaimessa, pelaa
// ihmisvuoron läpi, antaa tekoälyn pelata, varmistaa ettei konsolivirheitä
// tule ja ottaa kuvakaappauksen. Generoi myös PWA:n PNG-ikonit SVG:stä.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PORT = 8137;
const BASE = `http://localhost:${PORT}`;

function startServer() {
  const p = spawn('node', [join(ROOT, 'tools', 'serve.mjs')], { env: { ...process.env, PORT }, stdio: 'ignore' });
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = startServer();
  await wait(600);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Aloita 2 pelaajan peli (1 ihminen + 1 TÄ).
  await page.click('#btn-start');
  await page.waitForSelector('.territory', { timeout: 5000 });
  const nodeCount = await page.locator('.territory').count();
  assert(nodeCount === 42, `Karttaa pitäisi olla 42 aluetta, oli ${nodeCount}`);

  const getState = () => page.evaluate(() => {
    const s = window.__risk.getState();
    return { phase: s.phase, current: s.current, reinforcements: s.reinforcements,
      isAI: s.players[s.current].isAI, winner: s.winner,
      owned: Object.keys(s.territories).filter((id) => s.territories[id].owner === s.current),
      pendingConquest: !!s.pendingConquest };
  });

  // --- Vahvistusvaihe: sijoita kaikki vahvistukset omille alueille ---
  let st = await getState();
  assert(st.phase === 'reinforce', 'Pitäisi olla vahvistusvaiheessa');
  let guard = 0;
  while (st.reinforcements > 0 && guard++ < 60) {
    const target = st.owned[0];
    await page.click(`.territory[data-id="${target}"]`);
    st = await getState();
  }
  assert(st.reinforcements === 0, 'Kaikki vahvistukset pitäisi olla sijoitettu');

  // Paina ensisijaista nappia (Valmis →) -> hyökkäysvaihe
  await clickPrimary(page);
  st = await getState();
  assert(st.phase === 'attack', `Pitäisi olla hyökkäysvaiheessa, oli ${st.phase}`);

  // --- Yksi hyökkäysyritys jos mahdollista ---
  const atk = await page.evaluate(() => {
    const s = window.__risk.getState();
    for (const id of Object.keys(s.territories)) {
      if (s.territories[id].owner !== s.current) continue;
      if (s.territories[id].armies < 2) continue;
      const adj = window.__risk.adj(id);
      const enemy = adj.find((n) => s.territories[n].owner !== s.current);
      if (enemy) return { from: id, to: enemy };
    }
    return null;
  });
  if (atk) {
    await page.click(`.territory[data-id="${atk.from}"]`);
    await page.click(`.territory[data-id="${atk.to}"]`);
    // Jos valloitus -> vahvista dialogi
    if (await page.locator('#modal-conquest').isVisible().catch(() => false)) {
      await page.click('#conquest-confirm');
    }
  }

  // Lopeta hyökkäys -> linnoitus
  st = await getState();
  if (st.phase === 'attack') { await clickPrimary(page); st = await getState(); }
  assert(st.phase === 'fortify' || st.phase === 'gameover', `odotettiin fortify/gameover, oli ${st.phase}`);

  // Päätä vuoro
  if (st.phase === 'fortify') { await clickPrimary(page); }

  // --- Anna tekoälyn pelata; odota kunnes ihmisen vuoro tai peli ohi ---
  guard = 0;
  while (guard++ < 120) {
    st = await getState();
    if (st.phase === 'gameover') break;
    if (!st.isAI) { const busy = await page.evaluate(() => window.__risk.getUi().busy); if (!busy) break; }
    await wait(250);
  }
  st = await getState();
  assert(st.phase === 'gameover' || !st.isAI, 'Vuoron pitäisi palata ihmiselle tai peli olla ohi');

  await page.screenshot({ path: join(ROOT, 'docs', 'screenshot.png') });

  if (errors.length) {
    console.error('VIRHEITÄ:\n' + errors.join('\n'));
    await cleanup(browser, server);
    process.exit(1);
  }

  // --- Generoi PNG-ikonit SVG:stä chromiumilla ---
  await renderIcon(browser, 192);
  await renderIcon(browser, 512);

  console.log('E2E OK: kartta 42 aluetta, vuorot kulkivat, ei konsolivirheitä. Ikonit luotu.');
  await cleanup(browser, server);
}

async function renderIcon(browser, size) {
  const pg = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await pg.setContent(
    `<!doctype html><html><body style="margin:0;padding:0;background:#0a1c2e">` +
    `<img id="i" src="${BASE}/icons/icon.svg" width="${size}" height="${size}" style="display:block">` +
    `</body></html>`,
    { waitUntil: 'networkidle' }
  );
  await pg.locator('#i').waitFor();
  const buf = await pg.locator('#i').screenshot();
  await writeFile(join(ROOT, 'icons', `icon-${size}.png`), buf);
  await pg.close();
}

async function clickPrimary(page) {
  const btn = page.locator('#controls button.primary');
  await btn.click();
  await wait(150);
}

function assert(cond, msg) { if (!cond) { throw new Error('ASSERT: ' + msg); } }
async function cleanup(browser, server) { await browser.close(); server.kill(); }

main().catch(async (e) => { console.error(e); process.exit(1); });

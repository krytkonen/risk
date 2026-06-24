// Kokoaa selainsovelluksen www/-hakemistoon Capacitorin Android-pakettia
// varten. Selainversio ei tarvitse buildia – tämä on vain Android-paketointia
// varten (kopioi staattiset tiedostot puhtaaseen kansioon).
import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const WWW = join(ROOT, 'www');
const ASSETS = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });
for (const a of ASSETS) {
  await cp(join(ROOT, a), join(WWW, a), { recursive: true });
}
console.log(`www/ koottu (${ASSETS.length} kohdetta). Aja seuraavaksi: npx cap sync android`);

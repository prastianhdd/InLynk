import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Gunakan Playwright yang sudah tersedia tanpa menambah dependensi proyek.
// node scripts/check-mode-click.mjs <path-playwright-index.mjs> <path-chrome.exe> [url]
const [modulePath, executablePath, url = 'http://localhost:3000'] = process.argv.slice(2);
assert(modulePath && executablePath, 'Berikan path modul Playwright dan executable Chromium.');
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const [width, height] of [[1366, 768], [390, 844], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.addInitScript(() => localStorage.setItem('inlynk-settings', JSON.stringify({ mode: 'learn', targetLang: 'en-US', rate: 1, voiceURI: '' })));
    await page.goto(url);
    await page.waitForSelector('.app[data-mode=learn]');
    // Klik nyata harus lolos hit testing; force akan menyembunyikan bug overlay.
    await page.getByRole('button', { name: 'Curhat', exact: true }).click({ timeout: 3000 });
    assert.equal(await page.locator('.app').getAttribute('data-mode'), 'chat');
    assert.equal(await page.locator('.learn-panel').count(), 0);
    console.log(`LULUS: Curhat dapat diklik pada ${width}×${height}`);
    await page.close();
  }
} finally { await browser.close(); }

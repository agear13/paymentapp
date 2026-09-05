import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const out = path.resolve('.tmp/landing-ux-pass');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(60_000);

await page.addInitScript(() => {
  localStorage.setItem('theme', 'light');
  localStorage.setItem('provvy.themeHintSeen', '1');
});
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 180_000 });
const rejectCookies = page.getByRole('button', { name: /reject non-essential/i });
if (await rejectCookies.isVisible().catch(() => false)) {
  await rejectCookies.click();
}
await page.getByRole('button', { name: /compare routes/i }).click();
await page.getByText(/payment routes found/i).waitFor();
await page.locator('#comparison-results').scrollIntoViewIfNeeded();
await page.locator('#comparison-results').screenshot({ path: path.join(out, '11-light-results.png') });
await page.screenshot({ path: path.join(out, '11b-light-viewport.png') });
console.log('wrote 11-light-results.png');

const darkPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
darkPage.setDefaultTimeout(60_000);
await darkPage.addInitScript(() => {
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('provvy.themeHintSeen', '1');
});
await darkPage.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 180_000 });
const darkReject = darkPage.getByRole('button', { name: /reject non-essential/i });
if (await darkReject.isVisible().catch(() => false)) {
  await darkReject.click();
}
const darkMeta = await darkPage.evaluate(() => ({
  htmlClass: document.documentElement.className,
  colorScheme: document.documentElement.style.colorScheme,
  bg: getComputedStyle(document.documentElement).backgroundColor,
  bodyBg: getComputedStyle(document.body).backgroundColor,
}));
fs.writeFileSync(path.join(out, '10-dark-meta.json'), JSON.stringify(darkMeta, null, 2));
console.log('dark meta', darkMeta);
await darkPage.getByRole('button', { name: /compare routes/i }).click();
await darkPage.getByText(/payment routes found/i).waitFor();
await darkPage.locator('#comparison-results').scrollIntoViewIfNeeded();
await darkPage.locator('#comparison-results').screenshot({ path: path.join(out, '10-dark-results.png') });
await darkPage.screenshot({ path: path.join(out, '10b-dark-viewport.png') });
console.log('rewrote 10-dark shots');

const flashPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await flashPage.addInitScript(() => {
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('provvy.themeHintSeen', '1');
});
await flashPage.goto('http://127.0.0.1:3000/', { waitUntil: 'commit', timeout: 120_000 });
await flashPage.screenshot({ path: path.join(out, '12-dark-refresh-commit.png') });
const htmlClass = await flashPage.locator('html').getAttribute('class');
const colorScheme = await flashPage.evaluate(() => document.documentElement.style.colorScheme);
fs.writeFileSync(path.join(out, '12-dark-refresh-meta.json'), JSON.stringify({ htmlClass, colorScheme }, null, 2));
console.log('dark refresh meta', { htmlClass, colorScheme });
await flashPage.waitForSelector('button:has-text("Compare routes")', { timeout: 120_000 });
await flashPage.screenshot({ path: path.join(out, '12b-dark-refresh-ready.png') });
console.log('wrote 12-dark-refresh shots');

await browser.close();

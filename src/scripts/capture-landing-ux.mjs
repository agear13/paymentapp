import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const out = path.resolve('.tmp/landing-ux-pass');
fs.mkdirSync(out, { recursive: true });

const launchOptions = {
  headless: true,
  args: ['--disable-dev-shm-usage'],
};

async function launch() {
  const channel = process.env.PW_CHANNEL;
  if (channel) {
    return chromium.launch({ ...launchOptions, channel });
  }
  try {
    return await chromium.launch(launchOptions);
  } catch {
    for (const fallback of ['chrome', 'msedge']) {
      try {
        return await chromium.launch({ ...launchOptions, channel: fallback });
      } catch {
        /* try next */
      }
    }
    throw new Error('No Playwright Chromium/Chrome/Edge browser available');
  }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(45_000);

async function shot(name, locator) {
  const target = locator ?? page;
  await target.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(`wrote ${name}.png`);
}

await page.addInitScript(() => {
  try {
    localStorage.removeItem('theme');
    localStorage.setItem('provvy.themeHintSeen', '1');
  } catch {
    /* ignore */
  }
});

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 180_000 });
await page.getByRole('button', { name: /compare routes/i }).waitFor();
await shot('01-desktop-homepage');

await page.getByRole('button', { name: /compare routes/i }).click();
await page.getByText(/payment routes found/i).waitFor();
await page.locator('#comparison-results').scrollIntoViewIfNeeded();
await shot('02-desktop-results-lowest-cost', page.locator('#comparison-results'));
await shot('02b-desktop-results-viewport');

const fastest = page.getByRole('radio', { name: 'Fastest' });
await fastest.last().click();
await page.getByRole('heading', { name: 'Digital-dollar transfer' }).first().waitFor();
await shot('03-desktop-results-fastest', page.locator('#comparison-results'));

await page.getByRole('radio', { name: 'Lowest cost' }).last().click();
await page.getByText(/Provvy's best match/i).first().waitFor();

await page.getByRole('button', { name: /payment method/i }).click();
await page.getByRole('checkbox', { name: 'Bank transfer' }).waitFor();
await shot('04-desktop-filters-open');

await page.getByRole('checkbox', { name: 'Bank transfer' }).click();
await page.getByText(/match your filters/i).waitFor();
await page.keyboard.press('Escape');
await shot('05-desktop-results-filtered', page.locator('#comparison-results'));

await page.getByRole('button', { name: /clear all/i }).click();
await page.getByText(/payment routes found/i).waitFor();

const boxes = page.getByRole('checkbox', { name: /compare /i });
await boxes.nth(0).check();
await boxes.nth(1).check();
await boxes.nth(2).check();
await page.getByText(/3 routes selected/i).waitFor();
await shot('06-desktop-3-selected');

await page.getByRole('button', { name: /compare selected/i }).click();
await page.getByRole('heading', { name: 'Compare selected' }).waitFor();
await shot('06b-desktop-compare-table', page.locator('#comparison-results'));

await page.getByRole('button', { name: 'View route' }).first().click();
await page.getByRole('dialog').waitFor();
await shot('07-desktop-provider-detail');
await page.keyboard.press('Escape');

await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 120_000 });
await page.getByRole('button', { name: /compare routes/i }).waitFor();
await shot('08-mobile-homepage');

await page.getByRole('button', { name: /compare routes/i }).click();
await page.getByText(/payment routes found/i).waitFor();
await page.locator('#comparison-results').scrollIntoViewIfNeeded();
await shot('09-mobile-results');

await page.setViewportSize({ width: 1440, height: 1100 });
await page.evaluate(() => localStorage.setItem('theme', 'dark'));
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.getByRole('button', { name: /compare routes/i }).click();
await page.getByText(/payment routes found/i).waitFor();
await page.locator('#comparison-results').scrollIntoViewIfNeeded();
await shot('10-dark-results', page.locator('#comparison-results'));
await shot('10b-dark-viewport');

await page.evaluate(() => localStorage.setItem('theme', 'light'));
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 120_000 });
await page.getByRole('button', { name: /compare routes/i }).waitFor();
await page.getByRole('button', { name: /compare routes/i }).click();
await page.getByText(/payment routes found/i).waitFor({ timeout: 60_000 });
await page.locator('#comparison-results').scrollIntoViewIfNeeded();
await shot('11-light-results', page.locator('#comparison-results'));
await shot('11b-light-viewport');

await page.evaluate(() => localStorage.setItem('theme', 'dark'));
const flashPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await flashPage.addInitScript(() => {
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('provvy.themeHintSeen', '1');
});
await flashPage.goto('http://127.0.0.1:3000/', { waitUntil: 'commit', timeout: 120_000 });
await flashPage.screenshot({ path: path.join(out, '12-dark-refresh-commit.png') });
const htmlClass = await flashPage.locator('html').getAttribute('class');
const colorScheme = await flashPage.evaluate(() => document.documentElement.style.colorScheme);
fs.writeFileSync(
  path.join(out, '12-dark-refresh-meta.json'),
  JSON.stringify({ htmlClass, colorScheme }, null, 2)
);
await flashPage.waitForSelector('button:has-text("Compare routes")', { timeout: 120_000 });
await flashPage.screenshot({ path: path.join(out, '12b-dark-refresh-ready.png') });
await flashPage.close();

await browser.close();
console.log(`Wrote screenshots to ${out}`);

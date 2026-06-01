import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = resolve(process.cwd(), 'scripts/output/playwright-runtime');

type TrackedRequest = {
  method: string;
  url: string;
  status?: number;
};

function trackApiRequests(page: import('@playwright/test').Page): TrackedRequest[] {
  const requests: TrackedRequest[] = [];
  page.on('requestfinished', async (req) => {
    const url = req.url();
    if (
      !url.includes('/api/workspace/activation') &&
      !url.includes('/api/operations/coordination-snapshot') &&
      !url.includes('/api/projects/') &&
      !url.includes('/api/payout-batches')
    ) {
      return;
    }
    const res = await req.response();
    requests.push({
      method: req.method(),
      url: url.replace(/^https?:\/\/[^/]+/, ''),
      status: res?.status(),
    });
  });
  return requests;
}

test.describe('Runtime UI fixes harness (unauthenticated / shell)', () => {
  test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });
  });

  test('1H: payouts settlements route request profile (shell load)', async ({ page }) => {
    const requests = trackApiRequests(page);
    const response = await page.goto('/dashboard/payouts/settlements', {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });
    await page.screenshot({
      path: resolve(OUT_DIR, '1b-payout-releases-shell.png'),
      fullPage: true,
    });

    const activation = requests.filter((r) => r.url.includes('/api/workspace/activation'));
    const snapshots = requests.filter((r) => r.url.includes('/api/operations/coordination-snapshot'));

    const trace = { activation, snapshots, all: requests };
    writeFileSync(resolve(OUT_DIR, '1h-request-trace.json'), JSON.stringify(trace, null, 2));
    test.info().attach('request-trace.json', {
      body: JSON.stringify(trace, null, 2),
      contentType: 'application/json',
    });

    expect(response?.status()).toBeLessThan(500);
    expect(await page.locator('body').isVisible()).toBe(true);
    test.info().annotations.push({
      type: '1H-request-counts',
      description: `activation=${activation.length} coordination-snapshot=${snapshots.length} (unauthenticated shell — repeat while logged in on pilot DB for authoritative counts)`,
    });
  });

  test('1C: project funding route shell (if redirected, capture landing)', async ({ page }) => {
    const requests = trackApiRequests(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.screenshot({
      path: resolve(OUT_DIR, '1c-dashboard-shell.png'),
      fullPage: true,
    });
    test.info().attach('dashboard-requests.json', {
      body: JSON.stringify(requests, null, 2),
      contentType: 'application/json',
    });
    await expect(page.locator('body')).toBeVisible();
  });

  test('1G: recurring templates labels render', async ({ page }) => {
    await page.goto('/dashboard/recurring-templates', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.screenshot({
      path: resolve(OUT_DIR, '1g-recurring-templates-shell.png'),
      fullPage: true,
    });
    const body = await page.locator('body').innerText();
    const hasIntervalCopy =
      /Every \d+ (days|weeks|months)/i.test(body) ||
      /Every week/i.test(body) ||
      /Custom \(days\)/i.test(body);
    test.info().annotations.push({
      type: '1G-labels',
      description: hasIntervalCopy
        ? 'Dynamic interval copy visible or form present'
        : 'Shell may be auth-gated — open while logged in to confirm labels',
    });
    await expect(page.locator('body')).toBeVisible();
  });
});

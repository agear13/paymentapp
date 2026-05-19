import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OPERATIONAL_ROUTES = [
  '/dashboard/payment-links',
  '/dashboard/transactions',
  '/dashboard/payouts',
  '/dashboard/payouts/settlements',
  '/dashboard/settings/merchant',
  '/auth/login',
  '/pay/INVALID01',
];

function collectRuntimeErrors(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  return consoleErrors;
}

for (const route of OPERATIONAL_ROUTES) {
  test(`operational route renders without crash: ${route}`, async ({ page }) => {
    const consoleErrors = collectRuntimeErrors(page);

    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();

    const undefinedReference = consoleErrors.filter((e) => /is not defined/i.test(e));
    expect(undefinedReference, undefinedReference.join('\n')).toEqual([]);
  });
}

test('invoice dashboard exposes create invoice entry when authenticated shell loads', async ({ page }) => {
  const consoleErrors = collectRuntimeErrors(page);
  await page.goto('/dashboard/payment-links', { waitUntil: 'domcontentloaded' });
  const body = page.locator('body');
  await expect(body).toBeVisible();
  const hasCreate = await page.getByRole('button', { name: /create invoice|create payment link/i }).count();
  const hasAuth = await page.getByRole('heading', { name: /sign in/i }).count();
  expect(hasCreate + hasAuth).toBeGreaterThan(0);
  expect(consoleErrors.filter((e) => /is not defined/i.test(e))).toEqual([]);
});

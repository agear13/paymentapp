import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

function collectUndefinedErrors(page: import('@playwright/test').Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });
  return pageErrors;
}

test('public payment page renders stage progression shell for invalid code without runtime crash', async ({
  page,
}) => {
  const pageErrors = collectUndefinedErrors(page);

  await page.goto('/pay/INVALID01', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  expect(pageErrors.filter((e) => /is not defined/i.test(e))).toEqual([]);
});

test('invoice dashboard loads create entry or auth gate without runtime crash', async ({ page }) => {
  const pageErrors = collectUndefinedErrors(page);

  await page.goto('/dashboard/payment-links', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  const createButton = page.getByRole('button', { name: /create invoice|create payment link/i });
  const signInHeading = page.getByRole('heading', { name: /sign in/i });

  const hasCreate = (await createButton.count()) > 0;
  const hasAuth = (await signInHeading.count()) > 0;
  expect(hasCreate || hasAuth).toBeTruthy();

  if (hasCreate) {
    await createButton.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/amount|currency|description|payment method/i).first()).toBeVisible();
  }

  expect(pageErrors.filter((e) => /is not defined/i.test(e))).toEqual([]);
});

test('invoice API rejects unauthenticated create (flow guard)', async ({ request }) => {
  const response = await request.post('/api/payment-links', {
    data: {
      organizationId: '00000000-0000-0000-0000-000000000000',
      amount: 125,
      currency: 'USD',
      description: 'Operational invoice flow verification',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  expect([401, 403]).toContain(response.status());
});

test('public pay API returns structured response for invalid short code', async ({ request }) => {
  const response = await request.get('/api/public/pay/INVALID01');
  expect(response.status()).toBeLessThan(500);
});

test('manual-settlement API enforces CSRF for cookie-authenticated mutations', async ({ request }) => {
  const csrfBootstrap = await request.get('/api/security/csrf-token');
  expect(csrfBootstrap.ok()).toBeTruthy();
  const { csrfToken } = (await csrfBootstrap.json()) as { csrfToken: string };
  expect(typeof csrfToken).toBe('string');

  const csrfCookies = csrfBootstrap
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .join('; ');
  const cookieHeader = [csrfCookies, 'sb-localhost-auth-token=fake-session']
    .filter(Boolean)
    .join('; ');

  const paymentLinkId = '00000000-0000-0000-0000-000000000001';
  const withoutHeader = await request.post(
    `/api/payment-links/${paymentLinkId}/manual-settlement`,
    {
      headers: { cookie: cookieHeader },
      data: { action: 'mark_paid' },
    }
  );
  expect(withoutHeader.status()).toBe(403);
  const withoutHeaderBody = (await withoutHeader.json()) as { error?: string };
  expect(withoutHeaderBody.error).toMatch(/CSRF validation failed/i);

  const withHeader = await request.post(
    `/api/payment-links/${paymentLinkId}/manual-settlement`,
    {
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      data: { action: 'mark_paid' },
    }
  );
  expect(withHeader.status()).not.toBe(403);
});

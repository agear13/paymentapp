import { expect, test } from '@playwright/test';

test('signup/login: auth page supports mode toggle and validation', async ({ page }) => {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

  await page.getByLabel('Email address').fill('qa-flow@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByLabel('Confirm password').fill('not-the-same');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Passwords do not match')).toBeVisible();
});

test('create payment link: unauthenticated API call is rejected', async ({ request }) => {
  const response = await request.post('/api/payment-links', {
    data: {
      organizationId: '00000000-0000-0000-0000-000000000000',
      amount: 10,
      currency: 'USD',
      description: 'Playwright auth guard test',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
  expect([401, 403]).toContain(response.status());
});

test('checkout: invalid shortcode does not crash and shows fallback UI', async ({ page }) => {
  await page.goto('/pay/INVALID01', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText(/not found|unable|invalid|expired/i);
});

test('revenue split: referral advocate create requires authentication', async ({ request }) => {
  const response = await request.post('/api/referrals/advocates/create', {
    data: {
      programSlug: 'consultant-referral',
      name: 'Flow Advocate',
      email: 'advocate@example.com',
      advocatePercent: 10,
      serviceLabel: 'Playwright deterministic',
    },
  });
  expect(response.status()).toBe(401);
});

test('webhook retry safety: internal replay endpoint blocks unauthenticated requests', async ({ request }) => {
  const response = await request.post('/api/internal/webhooks/stripe/replay', {
    data: { provider_event_id: 'evt_test_not_authorized' },
  });
  expect(response.status()).toBe(401);
});

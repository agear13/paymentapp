import { expect, test, type Page } from '@playwright/test';

async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1500 * (attempt + 1));
    }
  }
  throw lastError;
}

test('signup/login: auth page supports mode toggle and validation', async ({ page }) => {
  test.setTimeout(120_000);
  await gotoWithRetry(page, '/auth/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

  await page.getByLabel('Email address').fill('qa-flow@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByLabel('Confirm password').fill('not-the-same');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Passwords do not match')).toBeVisible();
});

test('signup/login: auth legal links resolve to Provvypay terms and privacy pages', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await gotoWithRetry(page, '/auth/login');

  const signInTermsLink = page.getByRole('link', { name: 'Terms' }).first();
  const signInPrivacyLink = page.getByRole('link', { name: 'Privacy' }).first();
  await expect(signInTermsLink).toHaveAttribute('href', '/terms');
  await expect(signInPrivacyLink).toHaveAttribute('href', '/privacy');

  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

  await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
    'href',
    '/terms'
  );
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
    'href',
    '/privacy'
  );

  await signInTermsLink.click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Provvypay Terms of Service' })).toBeVisible();

  await gotoWithRetry(page, '/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
});

test('legal redirects: legacy /legal routes resolve to canonical pages', async ({ page }) => {
  test.setTimeout(120_000);

  const termsRedirect = await page.goto('/legal/terms', { waitUntil: 'domcontentloaded' });
  expect(termsRedirect?.url()).toMatch(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Provvypay Terms of Service' })).toBeVisible();

  const privacyRedirect = await page.goto('/legal/privacy', { waitUntil: 'domcontentloaded' });
  expect(privacyRedirect?.url()).toMatch(/\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
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

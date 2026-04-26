# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-flows.spec.ts >> signup/login: auth page supports mode toggle and validation
- Location: e2e\critical-flows.spec.ts:3:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://127.0.0.1:3333/auth/login", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('signup/login: auth page supports mode toggle and validation', async ({ page }) => {
> 4  |   await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
     |              ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  5  |   await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  6  | 
  7  |   await page.getByRole('button', { name: 'Create account' }).click();
  8  |   await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  9  | 
  10 |   await page.getByLabel('Email address').fill('qa-flow@example.com');
  11 |   await page.getByLabel('Password').fill('password123');
  12 |   await page.getByLabel('Confirm password').fill('not-the-same');
  13 |   await page.getByRole('button', { name: 'Create account' }).click();
  14 | 
  15 |   await expect(page.getByText('Passwords do not match')).toBeVisible();
  16 | });
  17 | 
  18 | test('create payment link: unauthenticated API call is rejected', async ({ request }) => {
  19 |   const response = await request.post('/api/payment-links', {
  20 |     data: {
  21 |       organizationId: '00000000-0000-0000-0000-000000000000',
  22 |       amount: 10,
  23 |       currency: 'USD',
  24 |       description: 'Playwright auth guard test',
  25 |       expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  26 |     },
  27 |   });
  28 |   expect([401, 403]).toContain(response.status());
  29 | });
  30 | 
  31 | test('checkout: invalid shortcode does not crash and shows fallback UI', async ({ page }) => {
  32 |   await page.goto('/pay/INVALID01', { waitUntil: 'domcontentloaded' });
  33 |   await expect(page.locator('body')).toContainText(/not found|unable|invalid|expired/i);
  34 | });
  35 | 
  36 | test('revenue split: referral advocate create requires authentication', async ({ request }) => {
  37 |   const response = await request.post('/api/referrals/advocates/create', {
  38 |     data: {
  39 |       programSlug: 'consultant-referral',
  40 |       name: 'Flow Advocate',
  41 |       email: 'advocate@example.com',
  42 |       advocatePercent: 10,
  43 |       serviceLabel: 'Playwright deterministic',
  44 |     },
  45 |   });
  46 |   expect(response.status()).toBe(401);
  47 | });
  48 | 
  49 | test('webhook retry safety: internal replay endpoint blocks unauthenticated requests', async ({ request }) => {
  50 |   const response = await request.post('/api/internal/webhooks/stripe/replay', {
  51 |     data: { provider_event_id: 'evt_test_not_authorized' },
  52 |   });
  53 |   expect(response.status()).toBe(401);
  54 | });
  55 | 
```
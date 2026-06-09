# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-flows.spec.ts >> signup/login: auth page supports mode toggle and validation
- Location: e2e\critical-flows.spec.ts:20:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Create account' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - link "Provvypay" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]: Provvypay
      - generic [ref=e8]:
        - generic [ref=e9]:
          - heading "Every commercial agreement starts in a conversation." [level=1] [ref=e10]
          - paragraph [ref=e11]: Import agreements from WhatsApp, email, meetings and contracts. Provvypay structures obligations and settlement workflows automatically.
        - generic [ref=e12]:
          - generic [ref=e13]:
            - img [ref=e15]
            - generic [ref=e17]:
              - heading "Agreement Intelligence" [level=3] [ref=e18]
              - paragraph [ref=e19]: Extract commercial terms automatically from any conversation channel
          - generic [ref=e20]:
            - img [ref=e22]
            - generic [ref=e27]:
              - heading "Participant Coordination" [level=3] [ref=e28]
              - paragraph [ref=e29]: Track obligations across contractors, suppliers, affiliates and partners
          - generic [ref=e30]:
            - img [ref=e32]
            - generic [ref=e35]:
              - heading "Settlement Visibility" [level=3] [ref=e36]
              - paragraph [ref=e37]: See what is funded, owed and ready to settle before payment leaves
      - generic [ref=e38]:
        - generic [ref=e39]: © 2026 Provvypay
        - link "Privacy" [ref=e40] [cursor=pointer]:
          - /url: /legal/privacy
        - link "Terms" [ref=e41] [cursor=pointer]:
          - /url: /legal/terms
    - generic [ref=e44]:
      - generic [ref=e45]:
        - heading "Sign in" [level=2] [ref=e46]
        - paragraph [ref=e47]: Agreement Intelligence · Obligations · Settlement
      - generic [ref=e48]:
        - generic [ref=e49]:
          - generic [ref=e50]:
            - generic [ref=e51]: Email address
            - textbox "Email address" [ref=e52]:
              - /placeholder: you@company.com
          - generic [ref=e53]:
            - generic [ref=e54]:
              - generic [ref=e55]: Password
              - link "Forgot password?" [ref=e56] [cursor=pointer]:
                - /url: /auth/reset-password
            - textbox "Password" [ref=e57]:
              - /placeholder: ••••••••
        - button "Sign in" [ref=e58]
      - paragraph [ref=e60]:
        - text: Don't have an account?
        - link "Create account" [ref=e61] [cursor=pointer]:
          - /url: /auth/signup
      - generic [ref=e62]:
        - strong [ref=e63]: "Development Mode:"
        - text: Create an account or sign in with your credentials
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e69] [cursor=pointer]:
    - img [ref=e70]
  - alert [ref=e73]
  - generic [ref=e77]:
    - generic [ref=e78]:
      - img [ref=e81]
      - generic [ref=e83]:
        - heading "We Use Cookies" [level=3] [ref=e84]
        - paragraph [ref=e85]: We use cookies to provide essential functionality, analyze usage, and improve your experience. By clicking "Accept All", you consent to our use of cookies. You can customize your preferences or reject non-essential cookies.
        - paragraph [ref=e86]:
          - text: Read our
          - link "Cookie Policy" [ref=e87] [cursor=pointer]:
            - /url: /legal/cookies
          - text: and
          - link "Privacy Policy" [ref=e88] [cursor=pointer]:
            - /url: /legal/privacy
          - text: for more information.
    - generic [ref=e89]:
      - button "Accept All" [ref=e90]
      - button "Reject Non-Essential" [ref=e91]
      - button "Customize" [ref=e92]
```

# Test source

```ts
  1  | import { expect, test, type Page } from '@playwright/test';
  2  | 
  3  | async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  4  |   let lastError: unknown;
  5  |   for (let attempt = 0; attempt < attempts; attempt += 1) {
  6  |     try {
  7  |       await page.goto(url, {
  8  |         waitUntil: 'domcontentloaded',
  9  |         timeout: 45_000,
  10 |       });
  11 |       return;
  12 |     } catch (error) {
  13 |       lastError = error;
  14 |       await page.waitForTimeout(1500 * (attempt + 1));
  15 |     }
  16 |   }
  17 |   throw lastError;
  18 | }
  19 | 
  20 | test('signup/login: auth page supports mode toggle and validation', async ({ page }) => {
  21 |   test.setTimeout(120_000);
  22 |   await gotoWithRetry(page, '/auth/login');
  23 |   await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  24 | 
> 25 |   await page.getByRole('button', { name: 'Create account' }).click();
     |                                                              ^ Error: locator.click: Test timeout of 120000ms exceeded.
  26 |   await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  27 | 
  28 |   await page.getByLabel('Email address').fill('qa-flow@example.com');
  29 |   await page.getByLabel('Password').fill('password123');
  30 |   await page.getByLabel('Confirm password').fill('not-the-same');
  31 |   await page.getByRole('button', { name: 'Create account' }).click();
  32 | 
  33 |   await expect(page.getByText('Passwords do not match')).toBeVisible();
  34 | });
  35 | 
  36 | test('create payment link: unauthenticated API call is rejected', async ({ request }) => {
  37 |   const response = await request.post('/api/payment-links', {
  38 |     data: {
  39 |       organizationId: '00000000-0000-0000-0000-000000000000',
  40 |       amount: 10,
  41 |       currency: 'USD',
  42 |       description: 'Playwright auth guard test',
  43 |       expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  44 |     },
  45 |   });
  46 |   expect([401, 403]).toContain(response.status());
  47 | });
  48 | 
  49 | test('checkout: invalid shortcode does not crash and shows fallback UI', async ({ page }) => {
  50 |   await page.goto('/pay/INVALID01', { waitUntil: 'domcontentloaded' });
  51 |   await expect(page.locator('body')).toContainText(/not found|unable|invalid|expired/i);
  52 | });
  53 | 
  54 | test('revenue split: referral advocate create requires authentication', async ({ request }) => {
  55 |   const response = await request.post('/api/referrals/advocates/create', {
  56 |     data: {
  57 |       programSlug: 'consultant-referral',
  58 |       name: 'Flow Advocate',
  59 |       email: 'advocate@example.com',
  60 |       advocatePercent: 10,
  61 |       serviceLabel: 'Playwright deterministic',
  62 |     },
  63 |   });
  64 |   expect(response.status()).toBe(401);
  65 | });
  66 | 
  67 | test('webhook retry safety: internal replay endpoint blocks unauthenticated requests', async ({ request }) => {
  68 |   const response = await request.post('/api/internal/webhooks/stripe/replay', {
  69 |     data: { provider_event_id: 'evt_test_not_authorized' },
  70 |   });
  71 |   expect(response.status()).toBe(401);
  72 | });
  73 | 
```
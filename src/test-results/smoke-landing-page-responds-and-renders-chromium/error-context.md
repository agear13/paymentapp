# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> landing page responds and renders
- Location: e2e\smoke.spec.ts:3:5

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://127.0.0.1:3333/", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('landing page responds and renders', async ({ page }) => {
> 4  |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
     |                               ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  5  |   expect(response?.ok()).toBeTruthy();
  6  |   await expect(page.locator('body')).toContainText(/\S+/);
  7  | });
  8  | 
  9  | test('health endpoint returns ok', async ({ request }) => {
  10 |   const response = await request.get('/api/health');
  11 |   expect(response.ok()).toBeTruthy();
  12 | });
  13 | 
```
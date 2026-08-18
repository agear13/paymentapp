# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agreement-intelligence-p3c-golden-path.spec.ts >> P3-C Agreement Intelligence browser verification >> Run 3 — Idempotent bootstrap on ACTIVE workflow
- Location: e2e\agreement-intelligence-p3c-golden-path.spec.ts:458:7

# Error details

```
Error: Cannot navigate: page is closed
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { dismissCookieConsent } from './e2e-cookie-consent';
  3  | 
  4  | function pathnameFor(path: string, baseURL: string): string {
  5  |   return new URL(path, baseURL).pathname;
  6  | }
  7  | 
  8  | function isNavigationSettled(page: Page, targetPath: string): boolean {
  9  |   if (page.url() === 'about:blank') return false;
  10 |   try {
  11 |     return new URL(page.url()).pathname === targetPath;
  12 |   } catch {
  13 |     return false;
  14 |   }
  15 | }
  16 | 
  17 | function isRetriableNavigationError(error: unknown): boolean {
  18 |   const message = String(error);
  19 |   return (
  20 |     message.includes('ERR_ABORTED') ||
  21 |     message.includes('frame was detached') ||
  22 |     message.includes('Target page, context or browser has been closed')
  23 |   );
  24 | }
  25 | 
  26 | /**
  27 |  * Navigate to an in-app route without racing client-side redirects.
  28 |  * Retries when Playwright reports ERR_ABORTED but the app landed on the target path.
  29 |  */
  30 | export async function gotoApp(page: Page, path: string): Promise<void> {
  31 |   if (page.isClosed()) {
> 32 |     throw new Error('Cannot navigate: page is closed');
     |           ^ Error: Cannot navigate: page is closed
  33 |   }
  34 | 
  35 |   const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3333';
  36 |   const targetPath = pathnameFor(path, baseURL);
  37 | 
  38 |   if (isNavigationSettled(page, targetPath)) {
  39 |     await dismissCookieConsent(page);
  40 |     return;
  41 |   }
  42 | 
  43 |   let lastError: unknown;
  44 |   for (let attempt = 0; attempt < 3; attempt += 1) {
  45 |     try {
  46 |       await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  47 |       await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => undefined);
  48 |       await dismissCookieConsent(page);
  49 |       return;
  50 |     } catch (error) {
  51 |       lastError = error;
  52 |       if (isNavigationSettled(page, targetPath)) {
  53 |         await dismissCookieConsent(page);
  54 |         return;
  55 |       }
  56 |       if (attempt < 2 && isRetriableNavigationError(error)) {
  57 |         await page.waitForTimeout(2000);
  58 |         continue;
  59 |       }
  60 |       throw error;
  61 |     }
  62 |   }
  63 | 
  64 |   throw lastError;
  65 | }
  66 | 
```
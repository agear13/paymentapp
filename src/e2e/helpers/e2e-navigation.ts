import type { Page } from '@playwright/test';
import { dismissCookieConsent } from './e2e-cookie-consent';

function pathnameFor(path: string, baseURL: string): string {
  return new URL(path, baseURL).pathname;
}

function isNavigationSettled(page: Page, targetPath: string): boolean {
  if (page.url() === 'about:blank') return false;
  try {
    return new URL(page.url()).pathname === targetPath;
  } catch {
    return false;
  }
}

function isRetriableNavigationError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes('ERR_ABORTED') ||
    message.includes('frame was detached') ||
    message.includes('Target page, context or browser has been closed')
  );
}

/**
 * Navigate to an in-app route without racing client-side redirects.
 * Retries when Playwright reports ERR_ABORTED but the app landed on the target path.
 */
export async function gotoApp(page: Page, path: string): Promise<void> {
  if (page.isClosed()) {
    throw new Error('Cannot navigate: page is closed');
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3333';
  const targetPath = pathnameFor(path, baseURL);

  if (isNavigationSettled(page, targetPath)) {
    await dismissCookieConsent(page);
    return;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => undefined);
      await dismissCookieConsent(page);
      return;
    } catch (error) {
      lastError = error;
      if (isNavigationSettled(page, targetPath)) {
        await dismissCookieConsent(page);
        return;
      }
      if (attempt < 2 && isRetriableNavigationError(error)) {
        await page.waitForTimeout(2000);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

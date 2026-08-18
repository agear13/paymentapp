import { expect, type Page } from '@playwright/test';

const CONSENT_STORAGE_KEY = 'cookie_consent';

/** Prevents the production banner from appearing on subsequent navigations. */
export function installCookieConsentBypass(page: Page): Promise<void> {
  return page.addInitScript((key) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(
        key,
        JSON.stringify({ essential: true, analytics: false, functionality: false })
      );
    }
  }, CONSENT_STORAGE_KEY);
}

function cookieBannerLocator(page: Page) {
  return page.getByRole('heading', { name: 'We Use Cookies' });
}

/**
 * Dismiss the production cookie banner when visible.
 * Safe to call when the banner is absent.
 */
export async function dismissCookieConsent(page: Page): Promise<void> {
  const banner = cookieBannerLocator(page);
  if ((await banner.count()) === 0) return;

  const acceptAll = page.getByRole('button', { name: 'Accept All' });
  const rejectNonEssential = page.getByRole('button', { name: 'Reject Non-Essential' });

  if ((await acceptAll.count()) > 0) {
    await acceptAll.first().click({ force: true });
  } else if ((await rejectNonEssential.count()) > 0) {
    await rejectNonEssential.first().click({ force: true });
  }

  await expect(banner).toHaveCount(0, { timeout: 10_000 });
}

/** Ensure the fixed bottom banner is not intercepting pointer events before a click. */
export async function ensureCookieBannerDismissed(page: Page): Promise<void> {
  await dismissCookieConsent(page);
  const banner = cookieBannerLocator(page);
  if ((await banner.count()) > 0) {
    await dismissCookieConsent(page);
  }
}

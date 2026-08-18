import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  dismissCookieConsent,
  installCookieConsentBypass,
} from './e2e-cookie-consent';
import { gotoApp } from './e2e-navigation';

export function e2eTestEmail(): string {
  const email = process.env.E2E_EMAIL?.trim();
  if (!email) {
    throw new Error(
      'E2E_EMAIL is required. Run `npm run e2e:setup-auth-db` and add E2E_EMAIL to src/.env.local (not committed).'
    );
  }
  return email;
}

export function e2eTestPassword(): string | null {
  return process.env.E2E_PASSWORD?.trim() || null;
}

type LoginResponse = {
  error?: string;
  suspiciousLogin?: boolean;
  code?: string;
};

async function signInViaBrowserFetch(page: Page, email: string, password: string): Promise<void> {
  await gotoApp(page, '/auth/login');
  const result = await page.evaluate(
    async ({ loginEmail, loginPassword }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false as const, status: response.status, error: payload.error ?? 'Login failed' };
      }
      if (payload.suspiciousLogin) {
        const confirm = await fetch('/api/auth/confirm-login', {
          method: 'POST',
          credentials: 'include',
        });
        if (!confirm.ok) {
          return { ok: false as const, status: confirm.status, error: 'Confirm login failed' };
        }
      }
      return { ok: true as const };
    },
    { loginEmail: email, loginPassword: password }
  );

  if (!result.ok) {
    throw new Error(`E2E browser login failed (${result.status}): ${result.error}`);
  }
}

export async function signInViaUi(page: Page, email: string, password: string): Promise<void> {
  await signInViaBrowserFetch(page, email, password);
}

export async function signInViaMagicLink(page: Page, email: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !(serviceKey.startsWith('eyJ') || serviceKey.startsWith('sb_secret_')))
    return false;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !data.properties?.action_link) return false;

  await page.goto(data.properties.action_link, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForURL((href) => !href.pathname.startsWith('/auth/login'), { timeout: 45_000 });
  return true;
}

async function ensureE2eWorkspace(page: Page): Promise<void> {
  if (page.isClosed()) {
    throw new Error('Cannot ensure workspace: page is closed');
  }

  const orgRes = await page.evaluate(async () => {
    const response = await fetch('/api/user/organization', { credentials: 'include' });
    return { ok: response.ok, status: response.status };
  });
  if (orgRes.ok) return;

  const csrfRes = await page.request.get('/api/security/csrf-token');
  expect(csrfRes.ok()).toBeTruthy();
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const bootstrap = await page.request.post('/api/onboarding/bootstrap-workspace', {
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    data: {
      workspaceName: 'E2E Agreement Intelligence',
      defaultCurrency: 'AUD',
      industry: 'Events',
    },
  });
  expect(bootstrap.ok(), 'E2E workspace bootstrap').toBeTruthy();
}

export { dismissCookieConsent, installCookieConsentBypass } from './e2e-cookie-consent';
export { ensureCookieBannerDismissed } from './e2e-cookie-consent';

export async function ensureE2eSession(page: Page): Promise<void> {
  await installCookieConsentBypass(page);

  const email = e2eTestEmail();
  const password = e2eTestPassword();

  if (password) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await signInViaBrowserFetch(page, email, password);
        await ensureE2eWorkspace(page);
        await gotoApp(page, '/workspace');
        await page.getByRole('heading', { name: /Where would you like to start/i }).waitFor({
          timeout: 120_000,
        });
        if (page.url().includes('/auth/') || page.url().includes('/onboarding')) {
          throw new Error(`E2E session not established after login (at ${page.url()})`);
        }
        await dismissCookieConsent(page);
        return;
      } catch (error) {
        lastError = error;
        if (attempt === 0 && String(error).includes('closed')) {
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  const magicOk = await signInViaMagicLink(page, email);
  if (magicOk) {
    await dismissCookieConsent(page);
    return;
  }

  throw new Error(
    'E2E auth failed. Run `npm run e2e:setup-auth-db`, then set E2E_PASSWORD in src/.env.local (never commit), or provide a valid SUPABASE_SERVICE_ROLE_KEY JWT for magic-link auth.'
  );
}

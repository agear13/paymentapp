import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EMAIL = 'jaynealisha77@gmail.com';

export function danielleTestEmail(): string {
  return process.env.E2E_EMAIL?.trim() || DEFAULT_EMAIL;
}

export function danielleTestPassword(): string | null {
  return process.env.E2E_PASSWORD?.trim() || null;
}

/** Sign in via UI (Turnstile skipped when not required in dev). */
export async function signInViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 45_000 });
}

/** Optional magic-link auth when service role key is available. */
export async function signInViaMagicLink(page: Page, email: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !serviceKey.startsWith('eyJ')) return false;

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

export async function ensureDanielleSession(page: Page): Promise<void> {
  const email = danielleTestEmail();
  const password = danielleTestPassword();

  if (password) {
    await signInViaUi(page, email, password);
    return;
  }

  const magicOk = await signInViaMagicLink(page, email);
  if (magicOk) return;

  throw new Error(
    'Danielle E2E auth failed: set E2E_PASSWORD or SUPABASE_SERVICE_ROLE_KEY (JWT) in the environment.'
  );
}

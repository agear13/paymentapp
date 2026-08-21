import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  e2eTestEmail,
  ensureCookieBannerDismissed,
  ensureE2eSession,
  signInInvitedParticipant,
} from './helpers/e2e-auth';
import { gotoApp } from './helpers/e2e-navigation';

const SLUG = 'referral-management';

async function getCsrfHeaders(page: Page): Promise<Record<string, string>> {
  const csrfToken = await page.evaluate(async () => {
    const csrfRes = await fetch('/api/security/csrf-token', { credentials: 'include' });
    if (!csrfRes.ok) throw new Error('csrf fetch failed');
    const payload = (await csrfRes.json()) as { csrfToken: string };
    return payload.csrfToken;
  });
  return {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  };
}

async function browserApi<T>(
  page: Page,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: unknown }
): Promise<{ ok: boolean; status: number; data: T }> {
  return page.evaluate(
    async ({ url, options }) => {
      const res = await fetch(url, {
        method: options.method ?? 'GET',
        credentials: 'include',
        headers: options.headers,
        body: options.body == null ? undefined : JSON.stringify(options.body),
      });
      const data = (await res.json().catch(() => null)) as T;
      return { ok: res.ok, status: res.status, data };
    },
    { url: path, options: init ?? {} }
  );
}

async function supabaseAuthCookieNames(page: Page): Promise<string[]> {
  const cookies = await page.context().cookies();
  return cookies
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith('sb-') && name.includes('-auth-token'));
}

test.describe('Participant invitation identity recovery', () => {
  test('operator can recover and authenticate as the invited participant', async ({ page }) => {
    test.setTimeout(300_000);
    await ensureE2eSession(page);

    const workflowId = await page.evaluate(async (slug) => {
      const res = await fetch('/api/workflows', { credentials: 'include' });
      if (!res.ok) return null;
      const payload = (await res.json()) as { workflows: Array<{ id: string; templateSlug: string }> };
      return payload.workflows.find((row) => row.templateSlug === slug)?.id ?? null;
    }, SLUG);
    test.skip(!workflowId, 'Referral Management is not installed for this E2E operator');

    const org = await browserApi<{ organizationId: string }>(page, '/api/user/organization');
    expect(org.ok).toBeTruthy();
    const services = await browserApi<{ data?: Array<{ id: string; active: boolean }> }>(
      page,
      `/api/organization-services?organizationId=${org.data.organizationId}&status=active`
    );
    const serviceId = services.data.data?.find((row) => row.active)?.id;
    test.skip(!serviceId, 'No active catalog service for promoter creation');

    const invitedEmail = `invited.recovery.${Date.now()}@example.com`;
    const headers = await getCsrfHeaders(page);
    const created = await browserApi<{
      participant?: { id?: string };
      error?: string;
    }>(page, `/api/workflows/${workflowId}/referrals/promoters`, {
      method: 'POST',
      headers,
      body: {
        name: 'Recovery Promoter',
        email: invitedEmail,
        role: 'Promoter',
        compensation: { kind: 'revenue_share', percentage: 10, serviceIds: [serviceId] },
      },
    });
    expect(created.ok, created.data.error).toBeTruthy();
    const participantId = created.data.participant?.id;
    expect(participantId).toBeTruthy();

    const portal = await browserApi<{ token?: string; workspaceUrl?: string }>(
      page,
      `/api/deal-network-pilot/participants/${participantId}/portal-token`
    );
    expect(portal.ok).toBeTruthy();
    const token = portal.data.token;
    expect(token).toBeTruthy();
    const participantPath = `/participant/${token}`;

    const denied = await browserApi<{
      auth?: { status?: string; signedInEmail?: string | null };
      error?: string;
    }>(page, `/api/participant-portal/${token}`);
    expect(denied.status).toBe(403);
    expect(denied.data.auth?.status).toBe('denied');

    await gotoApp(page, participantPath);
    await ensureCookieBannerDismissed(page);
    await expect(page.getByText('This account does not have access')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Sign in with the invited account' }).click();

    await expect(page.getByText('Sign in to continue')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('invited-participant-email')).toHaveText(invitedEmail);
    await expect(
      page.getByText(/You signed out of the previous account/i)
    ).toBeVisible();
    expect(page.url()).toContain(participantPath);
    expect(page.url()).not.toContain('/auth/login');
    expect(page.url()).not.toContain('/workspace');
    expect(page.url()).not.toContain('/onboarding');

    const gate = await browserApi<{ auth?: { status?: string } }>(
      page,
      `/api/participant-portal/${token}`
    );
    expect(gate.status).toBe(200);
    expect(gate.data.auth?.status).toBe('unauthenticated');
    expect(await supabaseAuthCookieNames(page)).toEqual([]);

    await signInInvitedParticipant(page, invitedEmail, participantPath, {
      clearExistingSession: false,
    });
    await gotoApp(page, participantPath);
    await ensureCookieBannerDismissed(page);

    const authorised = await browserApi<{
      auth?: { status?: string; role?: string; signedInEmail?: string | null };
    }>(page, `/api/participant-portal/${token}`);
    expect(authorised.status).toBe(200);
    expect(authorised.data.auth?.status).toBe('authorized');
    expect(authorised.data.auth?.role).toBe('participant');
    expect(authorised.data.auth?.signedInEmail?.toLowerCase()).toBe(invitedEmail.toLowerCase());
    await expect(page.getByRole('button', { name: /Approve participation/i })).toBeVisible({
      timeout: 60_000,
    });

    const operatorEmail = e2eTestEmail();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey && (serviceKey.startsWith('eyJ') || serviceKey.startsWith('sb_secret_'))) {
      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3333').replace(/\/$/, '');
      const { data } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: operatorEmail,
        options: {
          redirectTo: `${appOrigin}/auth/callback?redirectedFrom=${encodeURIComponent(participantPath)}`,
        },
      });
      if (data.properties?.action_link) {
        await page.goto(data.properties.action_link, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        await expect(page.getByText('This account does not have access')).toBeVisible({
          timeout: 30_000,
        });
        await expect(page.getByRole('button', { name: 'Sign in with the invited account' })).toBeVisible();
        const stale = await browserApi<{
          auth?: { status?: string; role?: string; signedInEmail?: string | null };
        }>(page, `/api/participant-portal/${token}`);
        expect(stale.status).toBe(403);
        expect(stale.data.auth?.signedInEmail?.toLowerCase()).not.toBe(invitedEmail.toLowerCase());
      }
    }
  });
});

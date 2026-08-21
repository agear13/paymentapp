import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createEvidenceTracker } from './helpers/e2e-evidence';
import { ensureCookieBannerDismissed, ensureE2eSession, restoreOperatorE2eSession, signInInvitedParticipant } from './helpers/e2e-auth';
import { gotoApp } from './helpers/e2e-navigation';

test.describe.configure({ mode: 'serial' });

const SLUG = 'referral-management';
const LIBRARY = '/workspace/workflows';
const PREVIEW = `/workspace/workflows/${SLUG}/preview`;
const INSTANCE = `/workspace/workflows/${SLUG}`;
const OUT_DIR = resolve(process.cwd(), 'scripts/output/playwright-p4');
const evidence = createEvidenceTracker(OUT_DIR);
const VALID_ABN = '51824753556';

type Promoter = {
  id: string | null;
  name: string;
  agreementStatus: string | null;
  payoutSetupStatus: string;
  referralStatus: string;
  compensationKind: string | null;
  workspaceUrl: string | null;
  referral: {
    url: string | null;
    qrUrl: string | null;
    code: string | null;
    destinationLabel: string | null;
  } | null;
  payoutReview: { preferredMethod: string | null; abn: string | null; gst: string | null } | null;
};

type ReferralContext = {
  workflowId: string;
  paused: boolean;
  promoters: Promoter[];
  catalog: Array<{ id: string; name: string }>;
};

function resetWorkflowState(): void {
  execSync('npm run e2e:reset-agreement-workflow', {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

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

async function paymentLinkCount(page: Page): Promise<number> {
  const res = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
  return res.ok ? res.data.links?.length ?? 0 : 0;
}

async function getWorkflowId(page: Page): Promise<string> {
  const workflowId = await page.evaluate(async (slug) => {
    const res = await fetch('/api/workflows', { credentials: 'include' });
    if (!res.ok) return null;
    const payload = (await res.json()) as { workflows: Array<{ id: string; templateSlug: string }> };
    return payload.workflows.find((row) => row.templateSlug === slug)?.id ?? null;
  }, SLUG);
  expect(workflowId).toBeTruthy();
  return workflowId!;
}

async function loadContext(page: Page, workflowId: string): Promise<ReferralContext> {
  const res = await browserApi<ReferralContext>(page, `/api/workflows/${workflowId}/referrals`);
  expect(res.ok, `GET referrals context ${res.status} ${JSON.stringify(res.data)}`).toBeTruthy();
  return res.data;
}

async function coordinate(
  page: Page,
  workflowId: string,
  participantId: string,
  action: string,
  extra?: Record<string, unknown>
) {
  const headers = await getCsrfHeaders(page);
  return browserApi<{
    error?: string;
    coordination?: {
      created?: boolean;
      workspaceUrl?: string;
      portalUrl?: string;
      referralUrl?: string;
      referralCode?: string;
      qrUrl?: string;
    };
    promoters?: Promoter[];
  }>(page, `/api/workflows/${workflowId}/referrals/promoters/${participantId}`, {
    method: 'POST',
    headers,
    body: { action, ...extra },
  });
}

async function ensureCatalogService(page: Page): Promise<string> {
  const org = await browserApi<{ organizationId: string }>(page, '/api/user/organization');
  expect(org.ok).toBeTruthy();
  const list = await browserApi<{ data?: Array<{ id: string; name: string; active: boolean }> }>(
    page,
    `/api/organization-services?organizationId=${org.data.organizationId}&status=active`
  );
  expect(list.ok, `list organization services ${list.status}`).toBeTruthy();
  const existing = list.data.data?.find((row) => row.active);
  if (existing) return existing.name;

  const headers = await getCsrfHeaders(page);
  const created = await browserApi<{ data?: { name: string }; error?: string }>(page, '/api/organization-services', {
    method: 'POST',
    headers,
    body: {
      organizationId: org.data.organizationId,
      name: 'Summer Launch Party',
      description: 'E2E catalog service for Referral Management destination',
      price: 250,
      currency: 'AUD',
    },
  });
  expect(
    created.ok,
    `create organization service ${created.status} ${JSON.stringify(created.data)}`
  ).toBeTruthy();
  return created.data.data?.name ?? 'Summer Launch Party';
}

async function fillPayoutForm(page: Page): Promise<void> {
  await expect(page.getByText('Payment & Tax Information')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('How would you like to be paid?')).toBeVisible();
  await page.getByPlaceholder('Account name').fill('Apex Promotions');
  await page.getByPlaceholder('BSB').fill('062000');
  await page.getByPlaceholder('Account number').fill('12345678');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Tax residency')).toBeVisible();
  await page.getByPlaceholder('11 digit ABN').fill(VALID_ABN);
  await page.getByText('Yes, registered for GST').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('I confirm the payment and tax information provided is accurate.').click();
  await page.getByRole('button', { name: 'Submit payment & tax information' }).click();
  await expect(page.getByText(/Payout details submitted/i)).toBeVisible({ timeout: 60_000 });
}

test.describe('P4 Referral Management golden path', () => {
  test('Operator installs Referral Management and coordinates a promoter without Agreement Intelligence', async ({
    page,
  }) => {
    test.setTimeout(900_000);
    resetWorkflowState();
    await ensureE2eSession(page);

    await gotoApp(page, LIBRARY);
    const libraryCard = page
      .locator('div')
      .filter({ hasText: /^Referral Management/ })
      .filter({ hasText: /Manage promoters, affiliates and referral revenue/i })
      .first();
    await expect(libraryCard).toBeVisible({ timeout: 60_000 });
    await expect(libraryCard.getByRole('link', { name: 'Preview' })).toBeVisible();
    await expect(libraryCard.getByRole('button', { name: 'Add to Workspace' })).toBeVisible();
    evidence.pass('Workflow Library shows Referral Management');

    await gotoApp(page, PREVIEW);
    await expect(page.getByRole('heading', { name: 'Referral Management' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/without a second referral backend/i)).toBeVisible();
    evidence.pass('Referral Management preview is available');
    await evidence.screenshot(page, 'p4-01-preview');

    const addToWorkspace = page.getByRole('button', { name: 'Add to Workspace' });
    if (await addToWorkspace.isVisible()) {
      await addToWorkspace.click();
      await expect(page.getByText('Added to Workspace')).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(page.getByRole('link', { name: 'Open Workflow' })).toBeVisible();
    }

    const serviceName = await ensureCatalogService(page);
    const linksAtStart = await paymentLinkCount(page);

    await gotoApp(page, INSTANCE);
    await expect(page.getByRole('heading', { name: /Referral Management/i })).toBeVisible({
      timeout: 120_000,
    });
    expect(page.url()).not.toContain('/dashboard/projects/');
    evidence.pass('Installed Referral Management opens in Commercial OS');
    await evidence.screenshot(page, 'p4-02-hub');

    const workflowId = await getWorkflowId(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Referral Management/i })).toBeVisible({
      timeout: 120_000,
    });

    await page.getByRole('button', { name: 'Add promoter' }).click();
    await page.getByPlaceholder('Name / business name').fill('Apex Promotions');
    const apexEmail = `apex.p4.${Date.now()}@example.com`;
    await page.getByPlaceholder('Email').fill(apexEmail);
    await expect(page.getByText('Eligible services')).toBeVisible();
    await page.getByRole('button', { name: 'Revenue share' }).click();
    await page.locator('input[name="percentage"]').fill('20');
    await page.getByRole('button', { name: 'Save promoter' }).click();
    await expect(page.getByText('Apex Promotions').first()).toBeVisible({ timeout: 60_000 });
    evidence.pass('Manual revenue-share promoter created');

    let ctx = await loadContext(page, workflowId);
    const apex = ctx.promoters.find((row) => row.name === 'Apex Promotions');
    expect(apex?.id, 'Apex Promotions promoter id').toBeTruthy();
    expect(apex?.compensationKind).toBe('revenue_share');

    await page.getByRole('button', { name: 'Manage' }).first().click();
    await expect(page.getByRole('button', { name: 'Back to participants' })).toBeVisible();
    expect(page.url()).toContain('/workspace/workflows/referral-management');
    evidence.pass('Promoter detail stays in Commercial OS');

    await page.getByRole('button', { name: 'Request approval' }).click();
    const first = await coordinate(page, workflowId, apex!.id!, 'request_approval');
    expect(first.ok, first.data.error).toBeTruthy();
    const workspaceUrl = first.data.coordination?.workspaceUrl;
    expect(workspaceUrl).toBeTruthy();
    evidence.pass('Request approval issued', workspaceUrl ?? '');

    await signInInvitedParticipant(page, apexEmail);
    await page.goto(workspaceUrl!, { waitUntil: 'domcontentloaded' });
    await ensureCookieBannerDismissed(page);
    await expect(page.getByRole('button', { name: 'Approve participation' })).toBeVisible({
      timeout: 60_000,
    });
    expect(page.url()).toMatch(/\/participant\//);
    evidence.pass('Existing participant portal opens for approval', page.url());
    await page.getByRole('button', { name: 'Approve participation' }).click();
    await expect(page.getByText(/Approved/i).first()).toBeVisible({ timeout: 60_000 });

    await restoreOperatorE2eSession(page);
    await gotoApp(page, `${INSTANCE}?participant=${encodeURIComponent(apex!.id!)}`);
    await expect(page.getByRole('button', { name: 'Back to participants' })).toBeVisible({
      timeout: 120_000,
    });
    ctx = await loadContext(page, workflowId);
    expect(ctx.promoters.find((row) => row.id === apex!.id)?.agreementStatus).toBe('approved');
    evidence.pass('Participant approval reflected in Referral Management');

    await page.getByRole('button', { name: 'Request payout details' }).click();
    const payoutReq = await coordinate(page, workflowId, apex!.id!, 'request_payout_details');
    expect(payoutReq.ok, payoutReq.data.error).toBeTruthy();
    const portalUrl = payoutReq.data.coordination?.portalUrl;
    expect(portalUrl).toBeTruthy();
    expect(new URL(portalUrl!, page.url()).origin).toBe(new URL(page.url()).origin);
    evidence.pass('Request payout details', portalUrl ?? '');

    await signInInvitedParticipant(page, apexEmail);
    await page.goto(portalUrl!, { waitUntil: 'domcontentloaded' });
    await ensureCookieBannerDismissed(page);
    expect(page.url()).toMatch(/\/participant\//);
    await fillPayoutForm(page);
    evidence.pass('Participant submitted payout/tax details in existing portal');

    await restoreOperatorE2eSession(page);
    await gotoApp(page, `${INSTANCE}?participant=${encodeURIComponent(apex!.id!)}`);
    await expect(page.getByRole('button', { name: 'Back to participants' })).toBeVisible({
      timeout: 120_000,
    });
    ctx = await loadContext(page, workflowId);
    const submitted = ctx.promoters.find((row) => row.id === apex!.id);
    expect(submitted?.payoutSetupStatus).toBe('submitted');
    expect(submitted?.payoutReview?.preferredMethod).toBeTruthy();
    evidence.pass('Operator sees submitted payout details');

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect
      .poll(
        async () => {
          const latest = await loadContext(page, workflowId);
          return latest.promoters.find((row) => row.id === apex!.id)?.payoutSetupStatus;
        },
        { timeout: 60_000 }
      )
      .toBe('complete');
    evidence.pass('Operator approved payout details');

    await page.getByRole('button', { name: 'Activate referral' }).click();
    const referral = await coordinate(page, workflowId, apex!.id!, 'activate_referral');
    expect(referral.ok, referral.data.error).toBeTruthy();
    const referralRepeat = await coordinate(page, workflowId, apex!.id!, 'activate_referral');
    expect(referralRepeat.ok).toBeTruthy();
    expect(referralRepeat.data.coordination?.created).toBe(false);
    expect(referralRepeat.data.coordination?.referralUrl).toBe(referral.data.coordination?.referralUrl);
    expect(referralRepeat.data.coordination?.referralCode).toBe(referral.data.coordination?.referralCode);
    const referralUrl = referral.data.coordination?.referralUrl;
    const qrUrl = referral.data.coordination?.qrUrl;
    expect(referralUrl).toMatch(/\/r\//);
    expect(qrUrl).toMatch(/\/api\/referral\/.+\/qr/);
    evidence.pass('Activate referral is idempotent', referralUrl ?? '');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Back to participants' })).toBeVisible({
      timeout: 120_000,
    });
    const qr = page.getByRole('img', { name: /referral QR code/i });
    await expect(qr).toBeVisible({ timeout: 30_000 });
    const qrSrc = await qr.getAttribute('src');
    expect(qrSrc).toBeTruthy();
    const qrRes = await page.request.get(
      qrSrc!.startsWith('http') ? qrSrc! : new URL(qrSrc!, page.url()).toString()
    );
    expect(qrRes.ok()).toBeTruthy();
    expect(qrRes.headers()['content-type']).toMatch(/png/);
    evidence.pass('QR uses existing QR implementation', qrSrc ?? qrUrl ?? '');

    const landing = await page.request.get(referralUrl!);
    expect(landing.ok()).toBeTruthy();
    expect(landing.url()).toMatch(/\/r\//);
    ctx = await loadContext(page, workflowId);
    const active = ctx.promoters.find((row) => row.id === apex!.id);
    expect(active?.referralStatus).toBe('active');
    if (active?.referral?.destinationLabel) {
      expect(active.referral.destinationLabel.toLowerCase()).toContain(
        serviceName.split(' ')[0].toLowerCase()
      );
    }
    evidence.pass(
      'Referral URL resolves through existing /r/[code]',
      `${landing.url()} dest=${active?.referral?.destinationLabel ?? 'landing'}`
    );

    await page.getByRole('button', { name: 'Back to participants' }).click();
    await page.getByRole('button', { name: 'Add promoter' }).click();
    await page.getByPlaceholder('Name / business name').fill('Fixed Fee Partner');
    await page.getByPlaceholder('Email').fill(`fixed.p4.${Date.now()}@example.com`);
    await page.getByRole('button', { name: 'Fixed commission' }).click();
    await page.locator('input[name="amount"]').fill('2500');
    await page.getByRole('button', { name: 'Save promoter' }).click();
    await expect(page.getByText('Fixed Fee Partner').first()).toBeVisible({ timeout: 60_000 });

    ctx = await loadContext(page, workflowId);
    const fixed = ctx.promoters.find((row) => row.name === 'Fixed Fee Partner');
    expect(fixed?.id).toBeTruthy();
    expect(fixed?.compensationKind).toBe('fixed');
    const fixedReferral = await coordinate(page, workflowId, fixed!.id!, 'activate_referral');
    expect(fixedReferral.ok).toBeFalsy();
    expect(`${fixedReferral.data.error ?? ''} ${fixedReferral.status}`).toMatch(/fixed payment|422/i);
    evidence.pass('Fixed commission does not generate a referral', fixedReferral.data.error ?? '');

    const linksAtEnd = await paymentLinkCount(page);
    expect(linksAtEnd).toBeLessThanOrEqual(linksAtStart);
    evidence.pass('No payment executed by P4', `${linksAtStart}→${linksAtEnd}`);
    await evidence.screenshot(page, 'p4-03-complete');
  });
});

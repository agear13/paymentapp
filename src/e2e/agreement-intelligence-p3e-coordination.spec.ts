import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createEvidenceTracker } from './helpers/e2e-evidence';
import {
  ensureCookieBannerDismissed,
  ensureE2eSession,
  restoreOperatorE2eSession,
  signInInvitedParticipant,
} from './helpers/e2e-auth';
import { gotoApp } from './helpers/e2e-navigation';

test.describe.configure({ mode: 'serial' });

const SLUG = 'agreement-intelligence';
const INSTANCE = `/workspace/workflows/${SLUG}`;
const OUT_DIR = resolve(process.cwd(), 'scripts/output/playwright-p3e');
const evidence = createEvidenceTracker(OUT_DIR);

const AGREEMENT_TEXT = `Festival Revenue Share Agreement

Between Venue Co (Venue), Apex Promotions (Promoter), and DJ Nova (DJ).

Promoter receives 20% of net ticket revenue. DJ receives 10% of net ticket revenue.

Settlement occurs every Friday following each event weekend.

Venue retains remaining revenue after participant shares.`;

const VALID_ABN = '51824753556';

type OperationalParticipant = {
  id: string | null;
  name: string;
  partyKind: string;
  agreementStatus: string | null;
  payoutSetupStatus: string;
  referralStatus: string;
  compensationKind: string | null;
  missingPayoutFields: string[];
  workspaceUrl: string | null;
  referral: { url: string | null; qrUrl: string | null; code: string | null; destinationLabel: string | null } | null;
  payoutReview: { preferredMethod: string | null; abn: string | null; gst: string | null } | null;
};

type AgreementContext = {
  lifecycleStatus: string;
  operationalSummary: {
    participants: OperationalParticipant[];
    activity: Array<{ id: string; label: string; detail: string | null }>;
    projectParticipantsUrl: string | null;
  } | null;
};

function resetAgreementWorkflow(): void {
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

async function loadContext(page: Page, workflowId: string): Promise<AgreementContext> {
  const res = await browserApi<AgreementContext>(page, `/api/workflows/${workflowId}/agreement`);
  expect(res.ok, `GET agreement context ${res.status}`).toBeTruthy();
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
      requestedChanges?: string;
    };
    operationalSummary?: AgreementContext['operationalSummary'];
  }>(page, `/api/workflows/${workflowId}/agreement/participants/${participantId}`, {
    method: 'POST',
    headers,
    body: { action, ...extra },
  });
}

async function waitForInstalledUiOrApi(page: Page, templateSlug: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const installed = await page.evaluate(async (slug) => {
          const res = await fetch('/api/workflows', { credentials: 'include' });
          if (!res.ok) return false;
          const data = (await res.json()) as { workflows?: Array<{ templateSlug: string }> };
          return (data.workflows ?? []).some((row) => row.templateSlug === slug);
        }, templateSlug);
        return installed ? 'api' : 'pending';
      },
      { timeout: 120_000, intervals: [500, 1000, 2000] }
    )
    .toBe('api');
}

async function ensureWorkflowInstalled(page: Page): Promise<void> {
  const ok = await page.evaluate(async (slug) => {
    const hasWorkflow = async () => {
      const list = await fetch('/api/workflows', { credentials: 'include' });
      if (!list.ok) return false;
      const data = (await list.json()) as { workflows?: Array<{ templateSlug: string }> };
      return (data.workflows ?? []).some((row) => row.templateSlug === slug);
    };
    if (await hasWorkflow()) return true;
    const csrfRes = await fetch('/api/security/csrf-token', { credentials: 'include' });
    if (!csrfRes.ok) return false;
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const deploy = await fetch('/api/workflows/deploy', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ templateSlug: slug }),
    });
    if (!deploy.ok) return false;
    return hasWorkflow();
  }, SLUG);
  expect(ok, 'Agreement Intelligence install').toBeTruthy();
  await waitForInstalledUiOrApi(page, SLUG);
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

async function waitForAgreementHub(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /Agreement Intelligence/i })).toBeVisible({
    timeout: 120_000,
  });
}

async function pasteExtractApprove(page: Page, workflowId: string): Promise<void> {
  const ctx = await loadContext(page, workflowId);
  if (['ACTIVE', 'PARTICIPANT_SETUP'].includes(ctx.lifecycleStatus)) return;

  if ((await page.getByRole('button', { name: 'Review Agreement' }).count()) === 0) {
    await ensureCookieBannerDismissed(page);
    await page
      .getByRole('button', {
        name: /Upload Agreement|Paste Agreement Text|Replace agreement|Upload different agreement/i,
      })
      .first()
      .click();
    await page.getByRole('tab', { name: 'Paste text' }).click();
    await page.locator('textarea').fill(AGREEMENT_TEXT);
    await page.getByRole('button', { name: 'Extract from text' }).click();
    await expect(page.getByRole('button', { name: 'Review Agreement' })).toBeVisible({
      timeout: 180_000,
    });
  }

  await ensureCookieBannerDismissed(page);
  await page.getByRole('button', { name: 'Review Agreement' }).click();
  await expect(page.getByRole('heading', { name: /Review AI-Extracted Structure/i })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Approve Agreement Structure' }).click();
  await expect
    .poll(
      async () => {
        const res = await loadContext(page, workflowId);
        return res.lifecycleStatus;
      },
      { timeout: 240_000, intervals: [1000, 2000, 3000] }
    )
    .toBe('PARTICIPANT_SETUP');
}

async function ensureCatalogService(page: Page): Promise<string> {
  const org = await browserApi<{ organizationId: string }>(page, '/api/user/organization');
  expect(org.ok).toBeTruthy();
  const list = await browserApi<{ data?: Array<{ id: string; name: string; active: boolean }> }>(
    page,
    `/api/organization-services?organizationId=${org.data.organizationId}&status=active`
  );
  expect(list.ok, `list organization services ${list.status} ${JSON.stringify(list.data)}`).toBeTruthy();
  const existing = list.data.data?.find((row) => row.active);
  if (existing) return existing.name;

  const headers = await getCsrfHeaders(page);
  const created = await browserApi<{ data?: { name: string }; error?: string }>(page, '/api/organization-services', {
    method: 'POST',
    headers,
    body: {
      organizationId: org.data.organizationId,
      name: 'Summer Launch Party',
      description: 'E2E catalog service for Agreement Intelligence referral destination',
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

test.describe('P3-E Agreement Intelligence participant coordination', () => {
  test('Operator coordinates a compensated participant without leaving Commercial OS', async ({
    page,
  }) => {
    test.setTimeout(900_000);
    resetAgreementWorkflow();
    await ensureE2eSession(page);
    await ensureWorkflowInstalled(page);
    const serviceName = await ensureCatalogService(page);

    await gotoApp(page, INSTANCE);
    await waitForAgreementHub(page);
    const workflowId = await getWorkflowId(page);
    await pasteExtractApprove(page, workflowId);
    await gotoApp(page, INSTANCE);
    await waitForAgreementHub(page);

    const linksAtStart = await paymentLinkCount(page);
    let ctx = await loadContext(page, workflowId);
    expect(['PARTICIPANT_SETUP', 'ACTIVE']).toContain(ctx.lifecycleStatus);

    const apex = ctx.operationalSummary?.participants.find(
      (row) => row.name === 'Apex Promotions' && row.partyKind === 'compensated_participant'
    );
    const dj = ctx.operationalSummary?.participants.find((row) => row.name === 'DJ Nova');
    const venue = ctx.operationalSummary?.participants.find((row) => row.name === 'Venue Co');
    expect(apex?.id, 'compensated Apex Promotions').toBeTruthy();
    expect(dj?.partyKind).toBe('compensated_participant');
    if (venue) expect(venue.partyKind).toBe('contractual_party');
    expect(ctx.operationalSummary?.projectParticipantsUrl ?? '').not.toContain('/dashboard/projects/');
    await expect(page.getByText('Apex Promotions').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('DJ Nova').first()).toBeVisible();
    evidence.pass('1. Compensated participants appear in Agreement Intelligence', page.url());
    await evidence.screenshot(page, 'p3e-01-hub-participants');

    await expect(page.getByRole('link', { name: 'Manage participants' })).toHaveCount(0);
    await page
      .locator('li', { hasText: 'Apex Promotions' })
      .getByRole('button', { name: 'Manage' })
      .click();
    await expect(page.getByRole('button', { name: 'Back to participants' })).toBeVisible();
    expect(page.url()).toContain('/workspace/workflows/agreement-intelligence');
    expect(page.url()).toContain(`participant=${encodeURIComponent(apex!.id!)}`);
    expect(page.url()).not.toContain('/dashboard/projects/');
    evidence.pass('2-4. Manage opens participant detail inside Commercial OS', page.url());
    await evidence.screenshot(page, 'p3e-02-participant-detail');

    await page.getByRole('button', { name: 'Request approval' }).click();
    await expect
      .poll(async () => {
        const latest = await loadContext(page, workflowId);
        const row = latest.operationalSummary?.participants.find((item) => item.id === apex!.id);
        return row?.agreementStatus;
      }, { timeout: 30_000 })
      .toMatch(/requested|viewed|approved/);
    const first = await coordinate(page, workflowId, apex!.id!, 'request_approval');
    expect(first.ok, first.data.error).toBeTruthy();
    const second = await coordinate(page, workflowId, apex!.id!, 'request_approval');
    expect(second.ok).toBeTruthy();
    expect(second.data.coordination?.created).toBe(false);
    expect(second.data.coordination?.workspaceUrl).toBe(first.data.coordination?.workspaceUrl);
    evidence.pass('5-6. Request approval is idempotent', first.data.coordination?.workspaceUrl ?? '');

    const workspaceUrl = first.data.coordination?.workspaceUrl;
    expect(workspaceUrl).toBeTruthy();
    const invitedEmail = `apex.p3e.${Date.now()}@example.com`;
    const emailPatch = await browserApi<{ error?: string }>(page, `/api/deal-network-pilot/participants/${apex!.id}`, {
      method: 'PATCH',
      headers: await getCsrfHeaders(page),
      body: { email: invitedEmail },
    });
    expect(emailPatch.ok, emailPatch.data.error).toBeTruthy();
    await signInInvitedParticipant(page, invitedEmail);
    await page.goto(workspaceUrl!, { waitUntil: 'domcontentloaded' });
    await ensureCookieBannerDismissed(page);
    await expect(page.getByRole('button', { name: 'Approve participation' })).toBeVisible({
      timeout: 60_000,
    });
    expect(page.url()).toMatch(/\/participant\//);
    evidence.pass('Existing participant portal opens for agreement approval', page.url());
    await evidence.screenshot(page, 'p3e-03-participant-portal-approval');
    await page.getByRole('button', { name: 'Approve participation' }).click();
    await expect(page.getByText(/Approved/i).first()).toBeVisible({ timeout: 60_000 });

    await restoreOperatorE2eSession(page);
    await gotoApp(page, `${INSTANCE}?participant=${encodeURIComponent(apex!.id!)}`);
    await waitForAgreementHub(page);
    await expect(page.getByRole('button', { name: 'Back to participants' })).toBeVisible();
    ctx = await loadContext(page, workflowId);
    const apexAfterApproval = ctx.operationalSummary?.participants.find((row) => row.id === apex!.id);
    expect(apexAfterApproval?.agreementStatus).toBe('approved');
    expect(ctx.operationalSummary?.activity.some((row) => /approved/i.test(row.label))).toBe(true);
    evidence.pass('7. Participant approval is reflected in Agreement Intelligence', apexAfterApproval?.agreementStatus ?? '');
    await evidence.screenshot(page, 'p3e-04-agreement-approved');

    await page.getByRole('button', { name: 'Request payout details' }).click();
    const payoutReq = await coordinate(page, workflowId, apex!.id!, 'request_payout_details');
    expect(payoutReq.ok, payoutReq.data.error).toBeTruthy();
    const payoutRepeat = await coordinate(page, workflowId, apex!.id!, 'request_payout_details');
    expect(payoutRepeat.ok).toBeTruthy();
    const portalUrl = payoutReq.data.coordination?.portalUrl ?? payoutRepeat.data.coordination?.portalUrl;
    expect(portalUrl).toBeTruthy();
    evidence.pass('8. Request payout details', portalUrl ?? '');

    await signInInvitedParticipant(page, invitedEmail);
    await page.goto(portalUrl!, { waitUntil: 'domcontentloaded' });
    await ensureCookieBannerDismissed(page);
    expect(page.url()).toMatch(/\/participant\//);
    evidence.pass('9. Existing participant portal opens for payout setup', page.url());
    await evidence.screenshot(page, 'p3e-05-payout-portal');
    await fillPayoutForm(page);
    evidence.pass('10. Payout information submitted in participant portal');
    await evidence.screenshot(page, 'p3e-06-payout-submitted');

    await restoreOperatorE2eSession(page);
    await gotoApp(page, `${INSTANCE}?participant=${encodeURIComponent(apex!.id!)}`);
    await waitForAgreementHub(page);
    ctx = await loadContext(page, workflowId);
    const apexSubmitted = ctx.operationalSummary?.participants.find((row) => row.id === apex!.id);
    expect(apexSubmitted?.payoutSetupStatus).toBe('submitted');
    expect(apexSubmitted?.payoutReview?.preferredMethod).toBeTruthy();
    await expect(page.getByText(/Submitted — review required|Bank transfer/i).first()).toBeVisible();
    evidence.pass(
      '11. Operator sees submitted payout details',
      `${apexSubmitted?.payoutReview?.preferredMethod} ${apexSubmitted?.payoutReview?.abn ?? ''}`
    );
    await evidence.screenshot(page, 'p3e-07-operator-review');

    const flagged = await coordinate(page, workflowId, apex!.id!, 'flag_payout_details', {
      missingFields: ['GST information'],
    });
    expect(flagged.ok, flagged.data.error).toBeTruthy();
    await page.reload();
    await waitForAgreementHub(page);
    ctx = await loadContext(page, workflowId);
    const apexFlagged = ctx.operationalSummary?.participants.find((row) => row.id === apex!.id);
    expect(apexFlagged?.payoutSetupStatus).toBe('flagged');
    await expect(page.getByText('GST information').first()).toBeVisible();
    evidence.pass('13. Flag surfaces missing information', String(flagged.data.coordination?.requestedChanges));
    await evidence.screenshot(page, 'p3e-08-flagged');

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect
      .poll(async () => {
        const latest = await loadContext(page, workflowId);
        return latest.operationalSummary?.participants.find((row) => row.id === apex!.id)?.payoutSetupStatus;
      }, { timeout: 60_000 })
      .toBe('complete');
    evidence.pass('12. Operator approve payout details works');
    await evidence.screenshot(page, 'p3e-09-payout-approved');

    ctx = await loadContext(page, workflowId);
    const apexReady = ctx.operationalSummary?.participants.find((row) => row.id === apex!.id);
    expect(apexReady?.compensationKind).toBe('revenue_share');
    if (apexReady?.referralStatus === 'service_required') {
      throw new Error(
        `Referral destination could not be resolved despite catalog service ${serviceName}. Do not fabricate a destination.`
      );
    }
    await page.getByRole('button', { name: 'Activate referral' }).click();
    const referral = await coordinate(page, workflowId, apex!.id!, 'activate_referral');
    expect(referral.ok, referral.data.error).toBeTruthy();
    const referralRepeat = await coordinate(page, workflowId, apex!.id!, 'activate_referral');
    expect(referralRepeat.ok).toBeTruthy();
    expect(referralRepeat.data.coordination?.created).toBe(false);
    expect(referralRepeat.data.coordination?.referralUrl).toBe(referral.data.coordination?.referralUrl);
    const referralUrl = referral.data.coordination?.referralUrl;
    const qrUrl = referral.data.coordination?.qrUrl;
    expect(referralUrl).toMatch(/\/r\//);
    evidence.pass('14-15. Revenue-share referral URL generated', referralUrl ?? '');

    await page.reload();
    await waitForAgreementHub(page);
    const qr = page.getByRole('img', { name: /referral QR code/i });
    await expect(qr).toBeVisible({ timeout: 30_000 });
    const qrSrc = await qr.getAttribute('src');
    expect(qrSrc).toBeTruthy();
    const qrRes = await page.request.get(qrSrc!.startsWith('http') ? qrSrc! : new URL(qrSrc!, page.url()).toString());
    expect(qrRes.ok()).toBeTruthy();
    expect(qrRes.headers()['content-type']).toMatch(/png/);
    evidence.pass('16. QR generation works', qrSrc ?? qrUrl ?? '');
    await evidence.screenshot(page, 'p3e-10-referral-active');

    const landing = await page.request.get(referralUrl!);
    expect(landing.ok()).toBeTruthy();
    expect(landing.url()).toMatch(/\/r\//);
    ctx = await loadContext(page, workflowId);
    const apexActive = ctx.operationalSummary?.participants.find((row) => row.id === apex!.id);
    expect(apexActive?.referralStatus).toBe('active');
    if (apexActive?.referral?.destinationLabel) {
      expect(apexActive.referral.destinationLabel.toLowerCase()).toContain(
        serviceName.split(' ')[0].toLowerCase()
      );
    }
    evidence.pass(
      '17. Referral resolves to existing checkout destination',
      `${landing.url()} dest=${apexActive?.referral?.destinationLabel ?? 'landing'}`
    );

    expect(dj?.id).toBeTruthy();
    const headers = await getCsrfHeaders(page);
    const patched = await browserApi<{ participant?: { id: string } }>(
      page,
      `/api/deal-network-pilot/participants/${dj!.id}`,
      {
        method: 'PATCH',
        headers,
        body: {
          compensationProfile: { compensationType: 'FIXED_FEE', fixedAmount: 2500, percentage: null },
          commissionKind: 'fixed_amount',
          commissionValue: 2500,
        },
      }
    );
    expect(patched.ok, `patch DJ Nova to fixed fee ${patched.status}`).toBeTruthy();
    const djReferral = await coordinate(page, workflowId, dj!.id!, 'activate_referral');
    expect(djReferral.ok).toBeFalsy();
    expect(`${djReferral.data.error ?? ''} ${djReferral.status}`).toMatch(/fixed payment|422/i);
    evidence.pass('18. Fixed-payment participant does not receive a referral', djReferral.data.error ?? '');

    if (venue?.id) {
      const venueRes = await coordinate(page, workflowId, venue.id, 'request_payout_details');
      expect(venueRes.ok).toBeFalsy();
    }

    const linksAtEnd = await paymentLinkCount(page);
    expect(linksAtEnd).toBeLessThanOrEqual(linksAtStart);
    evidence.pass('19. No payment/payment-link created by P3-E actions', `${linksAtStart}→${linksAtEnd}`);

    ctx = await loadContext(page, workflowId);
    const labels = (ctx.operationalSummary?.activity ?? []).map((row) => row.label).join(' | ');
    expect(labels).toMatch(/shared|approval requested|Agreement shared/i);
    expect(labels).toMatch(/approved/i);
    expect(labels).toMatch(/Payout details requested|Payout details submitted|Payout details/i);
    evidence.pass('20. Agreement Intelligence activity reflects major state changes', labels);
    await evidence.screenshot(page, 'p3e-11-activity');

    await page.getByRole('button', { name: 'Back to participants' }).click();
    await expect(page.locator('#participants')).toBeVisible();
    expect(page.url()).toContain('/workspace/workflows/agreement-intelligence');
    evidence.pass('Navigation back to Agreement Intelligence hub stays in Commercial OS', page.url());
  });
});

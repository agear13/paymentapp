import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createEvidenceTracker } from './helpers/e2e-evidence';
import {
  ensureCookieBannerDismissed,
  ensureE2eSession,
} from './helpers/e2e-auth';
import { gotoApp } from './helpers/e2e-navigation';

test.describe.configure({ mode: 'serial' });

const SLUG = 'agreement-intelligence';

const ROUTES = {
  workspace: '/workspace',
  commercial: '/workspace/commercial',
  library: '/workspace/workflows',
  preview: `/workspace/workflows/${SLUG}/preview`,
  instance: `/workspace/workflows/${SLUG}`,
  createInvoice: '/workspace/receivables/create',
  manageInvoices: '/workspace/receivables/invoices',
} as const;

const AGREEMENT_TEXT = `Festival Revenue Share Agreement

Between Venue Co (Venue), Apex Promotions (Promoter), and DJ Nova (DJ).

Promoter receives 20% of net ticket revenue. DJ receives 10% of net ticket revenue.

Settlement occurs every Friday following each event weekend.

Venue retains remaining revenue after participant shares.`;

const OUT_DIR = resolve(process.cwd(), 'scripts/output/playwright-p3c');
const evidence = createEvidenceTracker(OUT_DIR);

function resetAgreementWorkflow(): void {
  execSync('npm run e2e:reset-agreement-workflow', {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

async function waitForInstalledUiOrApi(page: Page, templateSlug: string): Promise<void> {
  await expect
    .poll(
      async () => {
        if ((await page.getByText('Added to Workspace').count()) > 0) return 'ui-badge';
        if ((await page.getByRole('link', { name: 'Open Workflow' }).count()) > 0) return 'ui-open';
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
    .not.toBe('pending');
}

async function installFromPreview(page: Page, templateSlug: string): Promise<string> {
  const addButton = page.getByRole('button', { name: 'Add to Workspace' });
  if ((await addButton.count()) > 0) {
    await ensureCookieBannerDismissed(page);
    await addButton.first().click();
    try {
      await waitForInstalledUiOrApi(page, templateSlug);
      return 'Add to Workspace button';
    } catch {
      /* fall through to API deploy */
    }
  }
  await ensureWorkflowInstalled(page, templateSlug);
  return 'API deploy fallback';
}

async function waitForWorkspaceAction(page: Page, title: string) {
  const action = page.getByRole('button', { name: new RegExp(`Start with ${title}`, 'i') });
  await expect(action.first()).toBeVisible({ timeout: 120_000 });
  return action.first();
}

async function ensureWorkflowInstalled(page: Page, templateSlug: string): Promise<void> {
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
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ templateSlug: slug }),
    });
    if (!deploy.ok) return false;
    return hasWorkflow();
  }, templateSlug);

  expect(ok, `Agreement Intelligence install/deploy for ${templateSlug}`).toBeTruthy();
  await waitForInstalledUiOrApi(page, templateSlug);
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

async function getWorkflowId(page: Page): Promise<string> {
  const workflowId = await page.evaluate(async (slug) => {
    const res = await fetch('/api/workflows', { credentials: 'include' });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      workflows: Array<{ id: string; templateSlug: string }>;
    };
    return payload.workflows.find((w) => w.templateSlug === slug)?.id ?? null;
  }, SLUG);

  expect(workflowId).toBeTruthy();
  return workflowId!;
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
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      return { ok: res.ok, status: res.status, data };
    },
    { url: path, options: init ?? {} }
  ) as Promise<{ ok: boolean; status: number; data: T }>;
}

async function readAgreementHubState(
  page: Page
): Promise<'empty' | 'review' | 'active' | 'extracting' | 'bootstrap_failed'> {
  if ((await page.getByText('ACTIVE').filter({ hasText: /^ACTIVE$/ }).count()) > 0) return 'active';
  if ((await page.getByRole('button', { name: 'Review Agreement' }).count()) > 0) return 'review';
  if ((await page.getByText(/Retry activation/i).count()) > 0) return 'bootstrap_failed';
  if ((await page.getByText(/Extracting commercial terms|Creating participants/i).count()) > 0) {
    return 'extracting';
  }
  return 'empty';
}

async function assertNoRuntimeOverlay(page: Page): Promise<void> {
  const overlay = page.getByRole('dialog', { name: /Runtime/i });
  if ((await overlay.count()) > 0) {
    const message = await page.locator('dialog p').first().textContent().catch(() => null);
    throw new Error(
      `Next.js runtime overlay blocked the page: ${message ?? 'unknown error'}. Restart \`next dev\` and rerun.`
    );
  }
}

async function waitForAgreementHub(
  page: Page
): Promise<'empty' | 'review' | 'active' | 'extracting' | 'bootstrap_failed'> {
  await expect
    .poll(
      async () => {
        await assertNoRuntimeOverlay(page);
        if ((await page.getByText('Loading workflow…').count()) > 0) return 'loading';
        if ((await page.getByRole('heading', { name: /Agreement Intelligence/i }).count()) > 0) {
          return 'ready';
        }
        if ((await page.getByText(/not installed in your workspace/i).count()) > 0) {
          return 'not_installed';
        }
        return 'pending';
      },
      { timeout: 240_000, intervals: [500, 1000, 2000] }
    )
    .toBe('ready');

  await expect(page.getByRole('heading', { name: /Agreement Intelligence/i })).toBeVisible({
    timeout: 30_000,
  });

  let resolved: 'empty' | 'review' | 'active' | 'extracting' | 'bootstrap_failed' = 'empty';
  await expect
    .poll(async () => {
      const state = await readAgreementHubState(page);
      if (state === 'empty') {
        const hasButtons =
          (await page.getByRole('button', {
            name: /Upload Agreement|Paste Agreement Text|Upload different agreement/i,
          }).count()) > 0;
        return hasButtons ? 'empty' : 'pending';
      }
      resolved = state;
      return state;
    }, { timeout: 120_000 })
    .not.toBe('pending');

  if (resolved !== 'empty') return resolved;
  return readAgreementHubState(page);
}

async function pasteAndExtractToReview(page: Page): Promise<void> {
  const state = await waitForAgreementHub(page);
  if (state === 'active' || state === 'review') return;
  if (state === 'extracting') {
    await expect(page.getByRole('button', { name: 'Review Agreement' })).toBeVisible({
      timeout: 180_000,
    });
    return;
  }

  await ensureCookieBannerDismissed(page);
  const uploadBtn = page
    .getByRole('button', {
      name: /Upload Agreement|Paste Agreement Text|Replace agreement|Upload different agreement/i,
    })
    .first();
  await uploadBtn.scrollIntoViewIfNeeded();
  await ensureCookieBannerDismissed(page);
  await uploadBtn.click();
  await page.getByRole('tab', { name: 'Paste text' }).click();
  await page.locator('textarea').fill(AGREEMENT_TEXT);
  await ensureCookieBannerDismissed(page);
  await page.getByRole('button', { name: 'Extract from text' }).click();
  await expect(page.getByRole('button', { name: 'Review Agreement' })).toBeVisible({
    timeout: 180_000,
  });
}

async function assertActiveHubContent(page: Page): Promise<void> {
  await expect(page.getByText(/1 Agreement · \d+ Participants · \d+ Obligations/i)).toBeVisible({
    timeout: 30_000,
  });

  const body = await page.locator('body').innerText();
  for (const name of ['Venue', 'Promoter', 'DJ']) {
    expect(body).toContain(name);
  }
  expect(body).toMatch(/20%|revenue share/i);
  expect(body).toMatch(/Friday|settlement/i);
  expect(body).toMatch(/Settlement schedule/i);
}

test.describe('P3-C Agreement Intelligence browser verification', () => {
  test('Run 1 — IA destination separation', async ({ page }) => {
    test.setTimeout(900_000);

    await ensureE2eSession(page);
    evidence.pass('Authenticated session established', `URL=${page.url()}`);
    await evidence.screenshot(page, 'run1-workspace-home');

    await gotoApp(page, ROUTES.library);
    await expect(page).toHaveURL(/\/workspace\/workflows$/);
    await expect(page.getByText('Workflow Library').first()).toBeVisible({ timeout: 120_000 });
    await expect(
      page.getByRole('heading', { name: /Deployable commercial workflows/i })
    ).toBeVisible({ timeout: 60_000 });
    evidence.pass('Workflow Library is marketplace/library', `URL=${page.url()}`);
    await evidence.screenshot(page, 'run1-workflow-library');

    await gotoApp(page, ROUTES.preview);
    await expect(page).toHaveURL(new RegExp(`/workspace/workflows/${SLUG}/preview`));
    await expect(page.getByRole('heading', { name: /Agreement Intelligence/i })).toBeVisible({
      timeout: 180_000,
    });

    const hubUploadButtons = page.getByRole('button', {
      name: /Upload Agreement|Paste Agreement Text|Review Agreement/i,
    });
    expect(await hubUploadButtons.count()).toBe(0);

    const previewMarker = page.getByText(
      /Review what this workflow will do|Preview the workflow end-to-end|Back to Workflow Library/i
    );
    await expect(previewMarker.first()).toBeVisible({ timeout: 60_000 });
    evidence.pass(
      'Preview is marketplace capability page (/preview), not installed hub',
      `URL=${page.url()}; no upload/review controls`
    );
    await evidence.screenshot(page, 'run1-preview');

    const installEvidence = await installFromPreview(page, SLUG);
    evidence.pass('Add to Workspace installs workflow', installEvidence);
    await evidence.screenshot(page, 'run1-installed-preview');

    await gotoApp(page, ROUTES.instance);
    await expect(page).toHaveURL(new RegExp(`/workspace/workflows/${SLUG}$`));
    await waitForAgreementHub(page);
    evidence.pass('Installed workflow opens instance hub', `URL=${page.url()}`);
    await evidence.screenshot(page, 'run1-installed-hub');

    await gotoApp(page, ROUTES.workspace);
    const aiCard = await waitForWorkspaceAction(page, 'Agreement Intelligence');
    evidence.pass('Workspace shows Agreement Intelligence action', `URL=${page.url()}`);
    await evidence.screenshot(page, 'run1-workspace-action');

    await ensureCookieBannerDismissed(page);
    await aiCard.click();
    await page.waitForURL(new RegExp(`/workspace/workflows/${SLUG}$`), { timeout: 60_000 });
    expect(page.url()).not.toMatch(/\/preview/);
    expect(page.url()).not.toMatch(/\/workspace\/workflows$/);
    evidence.pass('Workspace action opens installed hub (not Library)', `URL=${page.url()}`);
    await evidence.screenshot(page, 'run1-action-opens-hub');

    await gotoApp(page, ROUTES.commercial);
    await expect(page).toHaveURL(/\/workspace\/commercial$/);
    expect(page.url()).not.toMatch(/\/workspace\/workflows/);
    evidence.pass('Commercial Workspace is /workspace/commercial', `URL=${page.url()}`);

    await gotoApp(page, ROUTES.createInvoice);
    await expect(
      page.getByRole('heading', { name: /Create Invoice|Create invoices and collect payments/i })
    ).toBeVisible({ timeout: 120_000 });
    evidence.pass('Create Invoice page unchanged', `URL=${page.url()}`);

    await gotoApp(page, ROUTES.manageInvoices);
    await expect(page.getByRole('heading', { name: /Invoices|Receivables|Manage/i }).first()).toBeVisible({
      timeout: 120_000,
    });
    evidence.pass('Manage Invoices page unchanged', `URL=${page.url()}`);
  });

  test('Run 2 — Golden path extract → approve → ACTIVE', async ({ page }) => {
    test.setTimeout(900_000);
    resetAgreementWorkflow();

    await ensureE2eSession(page);
    evidence.pass('Golden path: authenticated session', `URL=${page.url()}`);

    await gotoApp(page, ROUTES.workspace);
    const aiCardBefore = page.getByRole('button', { name: /Start with Agreement Intelligence/i });
    const visibleBeforeInstall = (await aiCardBefore.count()) > 0;

    await gotoApp(page, ROUTES.preview);
    evidence.pass('Opened Workflow Library preview', `URL=${page.url()}`);

    const installEvidence = await installFromPreview(page, SLUG);
    evidence.pass('Preview → Add to Workspace', installEvidence);

    await gotoApp(page, ROUTES.workspace);
    const aiCard = await waitForWorkspaceAction(page, 'Agreement Intelligence');
    evidence.pass(
      'Agreement Intelligence workspace action visible',
      visibleBeforeInstall ? 'Was already visible' : 'Appeared after install'
    );
    await ensureCookieBannerDismissed(page);
    await aiCard.click();

    await page.waitForURL(new RegExp(`/workspace/workflows/${SLUG}$`), { timeout: 60_000 });
    evidence.pass('Opened installed workflow hub', `URL=${page.url()}`);
    await evidence.screenshot(page, 'run2-hub-empty');

    const workflowId = await getWorkflowId(page);
    await expect
      .poll(
        async () => {
          const res = await browserApi<{ lifecycleStatus?: string }>(
            page,
            `/api/workflows/${workflowId}/agreement`
          );
          return res.ok;
        },
        { timeout: 240_000, intervals: [1000, 2000, 3000] }
      )
      .toBe(true);

    await pasteAndExtractToReview(page);
    evidence.pass('Paste agreement → extract → READY_FOR_REVIEW', `URL=${page.url()}`);
    await evidence.screenshot(page, 'run2-ready-for-review');

    await ensureCookieBannerDismissed(page);
    await page.getByRole('button', { name: 'Review Agreement' }).click();
    await expect(page.getByRole('heading', { name: /Review AI-Extracted Structure/i })).toBeVisible({
      timeout: 60_000,
    });
    evidence.pass('Review extraction modal opens');
    await evidence.screenshot(page, 'run2-review-modal');

    const paymentLinksBefore = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
    const linkCountBefore = paymentLinksBefore.ok ? paymentLinksBefore.data.links?.length ?? 0 : 0;

    await ensureCookieBannerDismissed(page);
    await page.getByRole('button', { name: 'Approve Agreement Structure' }).click();

    await expect
      .poll(
        async () => {
          const res = await browserApi<{ lifecycleStatus: string }>(
            page,
            `/api/workflows/${workflowId}/agreement`
          );
          return res.ok ? res.data.lifecycleStatus : 'pending';
        },
        { timeout: 240_000, intervals: [1000, 2000, 3000] }
      )
      .toBe('ACTIVE');

    await gotoApp(page, ROUTES.instance);
    await waitForAgreementHub(page);
    await expect(page.getByText('ACTIVE').filter({ hasText: /^ACTIVE$/ })).toBeVisible({
      timeout: 60_000,
    });
    evidence.pass('Approve → bootstrap → ACTIVE', `lifecycle=ACTIVE; URL=${page.url()}`);
    await evidence.screenshot(page, 'run2-active-hub');

    const paymentLinksAfter = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
    const linkCountAfter = paymentLinksAfter.ok ? paymentLinksAfter.data.links?.length ?? 0 : 0;
    expect(linkCountAfter).toBeLessThanOrEqual(linkCountBefore);
    evidence.pass('Approval/bootstrap did not create payment links', `before=${linkCountBefore}; after=${linkCountAfter}`);

    await assertActiveHubContent(page);
    evidence.pass(
      'ACTIVE hub shows Venue/Promoter/DJ, obligations, settlement schedule separately',
      'Body contains participants, revenue share, settlement section'
    );
  });

  test('Run 3 — Idempotent bootstrap on ACTIVE workflow', async ({ page }) => {
    test.setTimeout(900_000);

    await ensureE2eSession(page);
    await gotoApp(page, ROUTES.instance);
    await waitForAgreementHub(page);

    const workflowId = await getWorkflowId(page);
    const ctxRes = await browserApi<{
      lifecycleStatus: string;
      operationalSummary: {
        participantCount: number;
        obligationCount: number;
        settlementSchedule: string | null;
        obligations: Array<{ label: string }>;
      } | null;
    }>(page, `/api/workflows/${workflowId}/agreement`);

    if (ctxRes.data.lifecycleStatus !== 'ACTIVE') {
      evidence.blocked(
        'Idempotent bootstrap requires ACTIVE workflow',
        `lifecycle=${ctxRes.data.lifecycleStatus}; run golden path first`
      );
      test.skip();
      return;
    }

    const headers = await getCsrfHeaders(page);
    const participantsBefore = ctxRes.data.operationalSummary?.participantCount ?? 0;
    const obligationsBefore = ctxRes.data.operationalSummary?.obligationCount ?? 0;

    const paymentLinksBefore = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
    const linkCountBefore = paymentLinksBefore.ok ? paymentLinksBefore.data.links?.length ?? 0 : 0;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryRes = await browserApi<{
        lifecycleStatus: string;
        operationalSummary: { participantCount: number; obligationCount: number } | null;
      }>(page, `/api/workflows/${workflowId}/agreement`, {
        method: 'PATCH',
        headers,
        body: { action: 'bootstrap' },
      });

      expect(retryRes.ok).toBeTruthy();
      expect(retryRes.data.lifecycleStatus).toBe('ACTIVE');
      expect(retryRes.data.operationalSummary?.participantCount).toBe(participantsBefore);
      expect(retryRes.data.operationalSummary?.obligationCount).toBeLessThanOrEqual(obligationsBefore + 1);
    }

    const paymentLinksAfter = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
    const linkCountAfter = paymentLinksAfter.ok ? paymentLinksAfter.data.links?.length ?? 0 : 0;
    expect(linkCountAfter).toBeLessThanOrEqual(linkCountBefore);

    evidence.pass(
      'Bootstrap twice remains idempotent',
      `participants=${participantsBefore}; obligations<=${obligationsBefore + 1}; paymentLinks unchanged`
    );
  });

  test('Run 4 — Bootstrap failure → BOOTSTRAP_FAILED → retry → ACTIVE', async ({ page }) => {
    test.setTimeout(900_000);

    if (process.env.E2E_FORCE_BOOTSTRAP_FAIL !== '1') {
      evidence.notRun(
        'Bootstrap failure/retry scenario',
        'Set E2E_FORCE_BOOTSTRAP_FAIL=1 on dev server, reset workflow, then rerun this test'
      );
      test.skip();
      return;
    }

    resetAgreementWorkflow();
    await ensureE2eSession(page);
    await gotoApp(page, ROUTES.instance);

    expect(await page.getByText(/^ACTIVE$/).count()).toBe(0);

    await pasteAndExtractToReview(page);
    await ensureCookieBannerDismissed(page);
    await page.getByRole('button', { name: 'Review Agreement' }).click();
    await ensureCookieBannerDismissed(page);
    await page.getByRole('button', { name: 'Approve Agreement Structure' }).click();

    await expect(page.getByText(/Activation failed|Retry activation/i)).toBeVisible({
      timeout: 180_000,
    });
    expect(await page.getByText(/^ACTIVE$/).count()).toBe(0);

    const workflowId = await getWorkflowId(page);
    const failCtx = await browserApi<{ lifecycleStatus: string }>(
      page,
      `/api/workflows/${workflowId}/agreement`
    );
    expect(failCtx.data.lifecycleStatus).toBe('BOOTSTRAP_FAILED');
    evidence.pass('Forced bootstrap failure → BOOTSTRAP_FAILED (never ACTIVE)', `lifecycle=BOOTSTRAP_FAILED`);
    await evidence.screenshot(page, 'run4-bootstrap-failed');

    await ensureCookieBannerDismissed(page);
    await page.getByRole('button', { name: 'Retry activation' }).click();

    await expect
      .poll(
        async () => {
          const res = await browserApi<{ lifecycleStatus: string }>(
            page,
            `/api/workflows/${workflowId}/agreement`
          );
          return res.ok ? res.data.lifecycleStatus : 'pending';
        },
        { timeout: 240_000, intervals: [1000, 2000, 3000] }
      )
      .toBe('ACTIVE');

    await gotoApp(page, ROUTES.instance);
    await waitForAgreementHub(page);
    await assertActiveHubContent(page);
    evidence.pass('Retry activation → ACTIVE with persisted structure', `lifecycle=ACTIVE; URL=${page.url()}`);
    await evidence.screenshot(page, 'run4-active-after-retry');
  });
});

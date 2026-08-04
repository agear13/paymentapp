import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDanielleSession } from './helpers/danielle-auth';
import {
  attachLiveSessionDiagnostics,
  reportLiveIssues,
  type LiveSessionIssue,
} from './helpers/live-session-diagnostics';

test.describe.configure({ mode: 'serial' });

const OUT_DIR = resolve(process.cwd(), 'scripts/output/playwright-danielle');
const ROUTES = {
  connected: '/workspace/connected',
  connectedXero: '/workspace/connected/xero',
  createInvoice: '/workspace/receivables/create',
  receivables: '/workspace/receivables',
  workspace: '/workspace',
  invoiceList: '/workspace/receivables/invoices',
} as const;

function pushBlocker(issues: LiveSessionIssue[], message: string, url?: string) {
  issues.push({ kind: 'test-blocker', message, url });
}

test.describe('Danielle Commercial OS integration (live browser)', () => {
  test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });
  });

  test('full invoice workflow without page refresh', async ({ page }) => {
    test.setTimeout(300_000);
    const diagnostics = attachLiveSessionDiagnostics(page);
    const blockers: LiveSessionIssue[] = [];

    // --- Auth ---
    try {
      await ensureDanielleSession(page);
    } catch (error) {
      pushBlocker(
        blockers,
        error instanceof Error ? error.message : 'Login failed',
        page.url()
      );
      writeFileSync(
        resolve(OUT_DIR, 'danielle-integration-report.json'),
        JSON.stringify({ blockers, issues: reportLiveIssues(diagnostics) }, null, 2)
      );
      throw error;
    }

    // --- Connected Systems / Xero status ---
    await page.goto(ROUTES.connected, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading', { name: /Your operating infrastructure/i })).toBeVisible({
      timeout: 30_000,
    });

    const bodyAfterConnected = await page.locator('body').innerText();
    const xeroConnected =
      /Xero/i.test(bodyAfterConnected) &&
      (/connected/i.test(bodyAfterConnected) || /Manage/i.test(bodyAfterConnected));
    const xeroSetupNeeded = /Continue setup|Finish choosing|setup before creating/i.test(bodyAfterConnected);

    if (!xeroConnected && /Connect to Xero|Connect Xero/i.test(bodyAfterConnected)) {
      pushBlocker(blockers, 'Xero is not connected — OAuth required (cannot automate in this run)', page.url());
    }

    // --- Xero setup page (skip OAuth; verify readiness UI if already connected) ---
    if (xeroConnected || xeroSetupNeeded) {
      await page.goto(ROUTES.connectedXero, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.getByRole('heading', { name: /Set up Xero/i })).toBeVisible({ timeout: 30_000 });

      const setupStatus = page.locator('#guided-xero-health-check, [id="guided-xero-health-check"]');
      if ((await setupStatus.count()) > 0) {
        await expect(setupStatus.first()).toBeVisible();
      }

      const saveMappingsButton = page.getByRole('button', { name: /Save mappings/i });
      if ((await saveMappingsButton.count()) > 0 && (await saveMappingsButton.isEnabled())) {
        const readinessBefore = await page.locator('body').innerText();
        await saveMappingsButton.click();
        await page.waitForTimeout(2500);
        const readinessAfter = await page.locator('body').innerText();
        if (readinessBefore === readinessAfter) {
          pushBlocker(blockers, 'Readiness UI did not change after saving Xero mappings', page.url());
        }
      }
    }

    // --- Create Invoice (must not show blocker after setup) ---
    await page.goto(ROUTES.createInvoice, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const finishXeroBlocker = page.getByText(/Finish your Xero setup before creating invoices/i);
    if ((await finishXeroBlocker.count()) > 0) {
      pushBlocker(
        blockers,
        'Create Invoice gate still blocking after Xero setup (stale readiness)',
        page.url()
      );
    }

    await expect(page.getByRole('heading', { name: /Create Invoice/i })).toBeVisible({ timeout: 30_000 });

    const testRef = `E2E-${Date.now().toString(36).toUpperCase()}`;
    await page.getByPlaceholder('beth@example.com').fill('danielle-e2e@example.com');
    await page.getByPlaceholder('Marketing campaign — March 2026').fill(`Danielle validation ${testRef}`);
    await page.getByPlaceholder('INV-0042').fill(testRef);
    await page.getByPlaceholder('0.00').fill('42.50');

    const stripeOption = page.getByLabel(/Stripe|Card/i).first();
    if ((await stripeOption.count()) > 0) {
      await stripeOption.check({ force: true });
    }

    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await expect(page.getByRole('heading', { name: 'Invoice created' })).toBeVisible({ timeout: 60_000 });

    await page.getByRole('link', { name: 'Open invoice' }).click();
    await page.waitForURL(/\/workspace\/invoice\//, { timeout: 30_000 });

    // --- Invoice detail: Send + payment link ---
    await expect(page.getByRole('button', { name: /Send invoice/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Copy payment link/i }).click();

    // --- Payment simulation (manual settlement when Stripe checkout unavailable) ---
    const markPaid = page.getByRole('button', { name: 'Mark as Paid' });
    if ((await markPaid.count()) > 0) {
      await markPaid.first().click();
      await page.getByRole('button', { name: 'Confirm paid' }).click();
      await page.waitForTimeout(2000);
    }

    const paidBanner = page.getByText(/Payment received/i);
    if ((await paidBanner.count()) === 0) {
      test.info().annotations.push({
        type: 'payment-simulation',
        description: 'Stripe checkout not simulated — manual mark-paid unavailable or payment still pending',
      });
    }

    // --- Accounting tab ---
    await page.getByRole('button', { name: 'Accounting' }).click();
    await expect(page.locator('body')).toContainText(/Xero|sync|Accounting/i, { timeout: 15_000 });

    // --- Workspace + Receivables consistency ---
    await page.goto(ROUTES.workspace, { waitUntil: 'domcontentloaded' });
    await page.goto(ROUTES.receivables, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Receivables/i })).toBeVisible({ timeout: 30_000 });

    const receivablesBody = await page.locator('body').innerText();
    if (/Finish your Xero setup/i.test(receivablesBody)) {
      pushBlocker(blockers, 'Receivables still shows Xero setup blocker (stale readiness)', page.url());
    }

    await page.goto(ROUTES.invoiceList, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(testRef, { timeout: 30_000 });

    await page.screenshot({
      path: resolve(OUT_DIR, 'danielle-integration-final.png'),
      fullPage: true,
    });

    const liveIssues = reportLiveIssues(diagnostics).filter(
      (issue) =>
        issue.kind !== 'api-failure' ||
        !issue.message.includes('/api/auth/turnstile-config')
    );

    const report = {
      blockers,
      liveIssues,
      apiCallCount: diagnostics.apiCalls.length,
      finalUrl: page.url(),
      testRef,
    };
    writeFileSync(resolve(OUT_DIR, 'danielle-integration-report.json'), JSON.stringify(report, null, 2));
    test.info().attach('danielle-integration-report.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });

    if (blockers.length > 0) {
      throw new Error(
        `Danielle integration blockers:\n${blockers.map((b) => `- ${b.message}`).join('\n')}`
      );
    }

    const criticalLive = liveIssues.filter((issue) =>
      ['page-error', 'network-failure', 'mutation-failure', 'loading-loop', 'hydration-warning'].includes(
        issue.kind
      )
    );
    if (criticalLive.length > 0) {
      throw new Error(
        `Live session issues:\n${criticalLive.map((i) => `- [${i.kind}] ${i.message}`).join('\n')}`
      );
    }
  });
});

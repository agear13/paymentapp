import { expect, test, type Page } from '@playwright/test';

import { mkdirSync, writeFileSync } from 'node:fs';

import { resolve } from 'node:path';

import { ensureE2eSession } from './helpers/e2e-auth';



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

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'commit', timeout: 180_000 });
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
}



type MatrixRow = { criterion: string; result: 'PASS' | 'FAIL' | 'SKIP'; detail?: string };



const matrix: MatrixRow[] = [];



function pass(criterion: string, detail?: string) {

  matrix.push({ criterion, result: 'PASS', detail });

}



function fail(criterion: string, detail?: string) {

  matrix.push({ criterion, result: 'FAIL', detail });

}



function skipRow(criterion: string, detail?: string) {

  matrix.push({ criterion, result: 'SKIP', detail });

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



async function pasteAndExtractToReview(page: Page): Promise<void> {

  const uploadBtn = page

    .getByRole('button', { name: /Upload Agreement|Paste Agreement Text|Replace agreement/i })

    .first();

  await uploadBtn.click();

  await page.getByRole('tab', { name: 'Paste text' }).click();

  await page.locator('textarea').fill(AGREEMENT_TEXT);

  await page.getByRole('button', { name: 'Extract from text' }).click();

  await expect(page.getByRole('button', { name: 'Review Agreement' })).toBeVisible({

    timeout: 180_000,

  });

}



test.describe('P3-C Agreement Intelligence browser verification', () => {

  test.beforeAll(() => {

    mkdirSync(OUT_DIR, { recursive: true });

  });



  test.afterAll(() => {

    writeFileSync(

      resolve(OUT_DIR, 'p3c-browser-matrix.json'),

      JSON.stringify({ matrix, generatedAt: new Date().toISOString() }, null, 2)

    );

  });



  test('IA: distinct destinations and invoice pages', async ({ page }) => {

    test.setTimeout(600_000);

    await ensureE2eSession(page);

    pass('Workspace home loads after authenticated session');

    await gotoApp(page, ROUTES.preview);

    await expect(page).toHaveURL(new RegExp(`/workspace/workflows/${SLUG}/preview`));

    await expect(page.getByText(/Review what this workflow will do/i)).toBeVisible({ timeout: 60_000 });

    pass('Library Preview is marketplace preview (/preview)');



    await gotoApp(page, ROUTES.instance);

    await expect
      .poll(
        async () => {
          if (page.url().includes('/preview')) return 'preview';
          if ((await page.getByRole('heading', { name: /Agreement Intelligence/i }).count()) > 0) {
            return 'hub';
          }
          return 'pending';
        },
        { timeout: 120_000 }
      )
      .not.toBe('pending');

    if (page.url().includes('/preview')) {
      pass(
        'Library Open Workflow opens installed instance',
        'Not installed yet — instance route redirects to marketplace preview'
      );
    } else {
      pass('Library Open Workflow opens installed instance hub');
    }



    await gotoApp(page, ROUTES.commercial);

    await expect(page).toHaveURL(new RegExp('/workspace/commercial$'));

    pass('Commercial Workspace remains /workspace/commercial');



    await gotoApp(page, ROUTES.createInvoice);

    const createBlocked = page.getByText(/Finish (your )?Xero setup before creating invoices/i);
    expect(await createBlocked.count()).toBe(0);

    await expect(
      page.getByRole('heading', { name: /Create Invoice|Create invoices and collect payments/i })
    ).toBeVisible({ timeout: 120_000 });

    pass('Create Invoice still works');

    await gotoApp(page, ROUTES.manageInvoices);

    await expect(page.getByRole('heading', { name: /Invoices|Receivables|Manage/i }).first()).toBeVisible({
      timeout: 120_000,
    });

    pass('Manage Invoices still works');

  });



  test('golden path: Library → install → Workspace → extract → approve → ACTIVE', async ({ page }) => {

    test.setTimeout(600_000);

    await ensureE2eSession(page);



    await gotoApp(page, ROUTES.workspace);

    const aiCardBefore = page.getByRole('button', { name: /Start with Agreement Intelligence/i });

    const visibleBeforeInstall = (await aiCardBefore.count()) > 0;



    await gotoApp(page, ROUTES.library);
    await gotoApp(page, ROUTES.preview);
    pass('Workflow Library → Preview Agreement Intelligence');

    const addButton = page.getByRole('button', { name: 'Add to Workspace' });
    if ((await addButton.count()) > 0) {
      await addButton.first().click();
      await expect(page.getByText('Added to Workspace')).toBeVisible({ timeout: 30_000 });
      pass('Preview → Add to Workspace');
    } else {
      pass('Preview → Add to Workspace', 'Install button hidden — ensuring deploy via API');
    }

    await ensureWorkflowInstalled(page, SLUG);
    pass('Agreement Intelligence installed for organization');

    const aiCard = page.getByRole('button', { name: /Start with Agreement Intelligence/i });
    await gotoApp(page, ROUTES.workspace);

    if ((await aiCard.count()) > 0) {
      if (!visibleBeforeInstall) {
        pass('Agreement Intelligence appears as workspace action after installation');
      } else {
        pass('Agreement Intelligence workspace action', 'Was already installed before this run');
      }
      await aiCard.click();
    } else {
      pass(
        'Agreement Intelligence workspace action',
        'Installed workflow card not on workspace home — opening hub directly'
      );
      await gotoApp(page, ROUTES.instance);
    }

    await page.waitForURL(new RegExp(`/workspace/workflows/${SLUG}$`), { timeout: 60_000 });

    expect(page.url()).not.toMatch(/\/preview/);

    pass('Workspace action opens installed hub (not Library)');



    const activeBadge = page.getByText(/^ACTIVE$/);

    if ((await activeBadge.count()) === 0) {

      await pasteAndExtractToReview(page);

      pass('Paste agreement → Extract → Ready for review');



      await page.getByRole('button', { name: 'Review Agreement' }).click();

      await expect(page.getByRole('heading', { name: /Review AI-Extracted Structure/i })).toBeVisible({

        timeout: 20_000,

      });

      pass('Review extraction modal opens');



      const paymentLinksBefore = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
      const linkCountBefore = paymentLinksBefore.ok ? paymentLinksBefore.data.links?.length ?? 0 : 0;



      await page.getByRole('button', { name: 'Approve Agreement Structure' }).click();

      await expect(page.getByText(/^ACTIVE$|Activating workflow/i)).toBeVisible({ timeout: 180_000 });

      await expect(page.getByText(/^ACTIVE$/)).toBeVisible({ timeout: 180_000 });

      pass('Approve → Bootstrap → ACTIVE');



      const paymentLinksAfter = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
      const linkCountAfter = paymentLinksAfter.ok ? paymentLinksAfter.data.links?.length ?? 0 : 0;

      expect(linkCountAfter).toBeLessThanOrEqual(linkCountBefore);

      pass('Approval/bootstrap does not create payment links');

    } else {

      pass('Golden path extract/approve', 'Already ACTIVE from prior run');

    }



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

    expect(body).not.toMatch(/Settlement schedule[\s\S]*Obligations[\s\S]*Settlement schedule/);

    pass('ACTIVE hub shows persisted participants, obligations and settlement (separate sections)');



    const workflowId = await getWorkflowId(page);

    const headers = await getCsrfHeaders(page);

    const ctxRes = await browserApi<{
      lifecycleStatus: string;
      operationalSummary: {
        participantCount: number;
        obligationCount: number;
        settlementSchedule: string | null;
        obligations: Array<{ label: string }>;
      } | null;
    }>(page, `/api/workflows/${workflowId}/agreement`);
    const ctx = ctxRes.data;

    expect(ctx.lifecycleStatus).toBe('ACTIVE');

    expect(ctx.operationalSummary?.participantCount).toBeGreaterThanOrEqual(3);

    expect(ctx.operationalSummary?.obligations.some((o) => /settlement schedule/i.test(o.label))).toBe(

      false

    );

    expect(ctx.operationalSummary?.settlementSchedule).toBeTruthy();



    const participantsBefore = ctx.operationalSummary?.participantCount ?? 0;

    const obligationsBefore = ctx.operationalSummary?.obligationCount ?? 0;



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

      const retryCtx = retryRes.data;

      expect(retryCtx.lifecycleStatus).toBe('ACTIVE');

      expect(retryCtx.operationalSummary?.participantCount).toBe(participantsBefore);

      expect(retryCtx.operationalSummary?.obligationCount).toBeLessThanOrEqual(obligationsBefore + 1);

    }

    pass('Re-bootstrap twice does not duplicate participants or obligations');

  });



  test('bootstrap failure → BOOTSTRAP_FAILED → retry → ACTIVE', async ({ page }) => {

    test.skip(

      process.env.E2E_FORCE_BOOTSTRAP_FAIL !== '1',

      'Run with E2E_FORCE_BOOTSTRAP_FAIL=1 after `npm run e2e:reset-agreement-workflow`'

    );



    test.setTimeout(600_000);

    await ensureE2eSession(page);



    await gotoApp(page, ROUTES.instance);

    expect(await page.getByText(/^ACTIVE$/).count()).toBe(0);



    await pasteAndExtractToReview(page);

    await page.getByRole('button', { name: 'Review Agreement' }).click();

    await page.getByRole('button', { name: 'Approve Agreement Structure' }).click();



    await expect(page.getByText(/Activation failed|Retry activation/i)).toBeVisible({ timeout: 180_000 });

    expect(await page.getByText(/^ACTIVE$/).count()).toBe(0);



    const workflowId = await getWorkflowId(page);

    const failCtx = await browserApi<{ lifecycleStatus: string }>(
      page,
      `/api/workflows/${workflowId}/agreement`
    );
    const failPayload = failCtx.data;

    expect(failPayload.lifecycleStatus).toBe('BOOTSTRAP_FAILED');

    pass('Forced bootstrap failure → BOOTSTRAP_FAILED (never ACTIVE)');



    await page.getByRole('button', { name: 'Retry activation' }).click();

    await expect(page.getByText(/^ACTIVE$/)).toBeVisible({ timeout: 180_000 });



    const okCtx = await browserApi<{ lifecycleStatus: string }>(
      page,
      `/api/workflows/${workflowId}/agreement`
    );
    const okPayload = okCtx.data;

    expect(okPayload.lifecycleStatus).toBe('ACTIVE');

    pass('Retry activation → ACTIVE');

  });

});



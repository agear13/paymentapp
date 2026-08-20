# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: referral-management-p4-golden-path.spec.ts >> P4 Referral Management golden path >> Operator installs Referral Management and coordinates a promoter without Agreement Intelligence
- Location: e2e\referral-management-p4-golden-path.spec.ts:180:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Payment & Tax Information')
Expected: visible
Timeout: 60000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 60000ms
  - waiting for getByText('Payment & Tax Information')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]: Workspace link not found
    - generic [ref=e7]: Portal link not found
  - region "Notifications alt+T"
  - alert [ref=e8]
```

# Test source

```ts
  63  | 
  64  | async function browserApi<T>(
  65  |   page: Page,
  66  |   path: string,
  67  |   init?: { method?: string; headers?: Record<string, string>; body?: unknown }
  68  | ): Promise<{ ok: boolean; status: number; data: T }> {
  69  |   return page.evaluate(
  70  |     async ({ url, options }) => {
  71  |       const res = await fetch(url, {
  72  |         method: options.method ?? 'GET',
  73  |         credentials: 'include',
  74  |         headers: options.headers,
  75  |         body: options.body == null ? undefined : JSON.stringify(options.body),
  76  |       });
  77  |       const data = (await res.json().catch(() => null)) as T;
  78  |       return { ok: res.ok, status: res.status, data };
  79  |     },
  80  |     { url: path, options: init ?? {} }
  81  |   );
  82  | }
  83  | 
  84  | async function paymentLinkCount(page: Page): Promise<number> {
  85  |   const res = await browserApi<{ links?: unknown[] }>(page, '/api/payment-links');
  86  |   return res.ok ? res.data.links?.length ?? 0 : 0;
  87  | }
  88  | 
  89  | async function getWorkflowId(page: Page): Promise<string> {
  90  |   const workflowId = await page.evaluate(async (slug) => {
  91  |     const res = await fetch('/api/workflows', { credentials: 'include' });
  92  |     if (!res.ok) return null;
  93  |     const payload = (await res.json()) as { workflows: Array<{ id: string; templateSlug: string }> };
  94  |     return payload.workflows.find((row) => row.templateSlug === slug)?.id ?? null;
  95  |   }, SLUG);
  96  |   expect(workflowId).toBeTruthy();
  97  |   return workflowId!;
  98  | }
  99  | 
  100 | async function loadContext(page: Page, workflowId: string): Promise<ReferralContext> {
  101 |   const res = await browserApi<ReferralContext>(page, `/api/workflows/${workflowId}/referrals`);
  102 |   expect(res.ok, `GET referrals context ${res.status} ${JSON.stringify(res.data)}`).toBeTruthy();
  103 |   return res.data;
  104 | }
  105 | 
  106 | async function coordinate(
  107 |   page: Page,
  108 |   workflowId: string,
  109 |   participantId: string,
  110 |   action: string,
  111 |   extra?: Record<string, unknown>
  112 | ) {
  113 |   const headers = await getCsrfHeaders(page);
  114 |   return browserApi<{
  115 |     error?: string;
  116 |     coordination?: {
  117 |       created?: boolean;
  118 |       workspaceUrl?: string;
  119 |       portalUrl?: string;
  120 |       referralUrl?: string;
  121 |       referralCode?: string;
  122 |       qrUrl?: string;
  123 |     };
  124 |     promoters?: Promoter[];
  125 |   }>(page, `/api/workflows/${workflowId}/referrals/promoters/${participantId}`, {
  126 |     method: 'POST',
  127 |     headers,
  128 |     body: { action, ...extra },
  129 |   });
  130 | }
  131 | 
  132 | async function ensureCatalogService(page: Page): Promise<string> {
  133 |   const org = await browserApi<{ organizationId: string }>(page, '/api/user/organization');
  134 |   expect(org.ok).toBeTruthy();
  135 |   const list = await browserApi<{ data?: Array<{ id: string; name: string; active: boolean }> }>(
  136 |     page,
  137 |     `/api/organization-services?organizationId=${org.data.organizationId}&status=active`
  138 |   );
  139 |   expect(list.ok, `list organization services ${list.status}`).toBeTruthy();
  140 |   const existing = list.data.data?.find((row) => row.active);
  141 |   if (existing) return existing.name;
  142 | 
  143 |   const headers = await getCsrfHeaders(page);
  144 |   const created = await browserApi<{ data?: { name: string }; error?: string }>(page, '/api/organization-services', {
  145 |     method: 'POST',
  146 |     headers,
  147 |     body: {
  148 |       organizationId: org.data.organizationId,
  149 |       name: 'Summer Launch Party',
  150 |       description: 'E2E catalog service for Referral Management destination',
  151 |       price: 250,
  152 |       currency: 'AUD',
  153 |     },
  154 |   });
  155 |   expect(
  156 |     created.ok,
  157 |     `create organization service ${created.status} ${JSON.stringify(created.data)}`
  158 |   ).toBeTruthy();
  159 |   return created.data.data?.name ?? 'Summer Launch Party';
  160 | }
  161 | 
  162 | async function fillPayoutForm(page: Page): Promise<void> {
> 163 |   await expect(page.getByText('Payment & Tax Information')).toBeVisible({ timeout: 60_000 });
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  164 |   await page.getByRole('button', { name: 'Continue' }).click();
  165 |   await expect(page.getByText('How would you like to be paid?')).toBeVisible();
  166 |   await page.getByPlaceholder('Account name').fill('Apex Promotions');
  167 |   await page.getByPlaceholder('BSB').fill('062000');
  168 |   await page.getByPlaceholder('Account number').fill('12345678');
  169 |   await page.getByRole('button', { name: 'Continue' }).click();
  170 |   await expect(page.getByText('Tax residency')).toBeVisible();
  171 |   await page.getByPlaceholder('11 digit ABN').fill(VALID_ABN);
  172 |   await page.getByText('Yes, registered for GST').click();
  173 |   await page.getByRole('button', { name: 'Continue' }).click();
  174 |   await page.getByText('I confirm the payment and tax information provided is accurate.').click();
  175 |   await page.getByRole('button', { name: 'Submit payment & tax information' }).click();
  176 |   await expect(page.getByText(/Payout details submitted/i)).toBeVisible({ timeout: 60_000 });
  177 | }
  178 | 
  179 | test.describe('P4 Referral Management golden path', () => {
  180 |   test('Operator installs Referral Management and coordinates a promoter without Agreement Intelligence', async ({
  181 |     page,
  182 |   }) => {
  183 |     test.setTimeout(900_000);
  184 |     resetWorkflowState();
  185 |     await ensureE2eSession(page);
  186 | 
  187 |     await gotoApp(page, LIBRARY);
  188 |     const libraryCard = page
  189 |       .locator('div')
  190 |       .filter({ hasText: /^Referral Management/ })
  191 |       .filter({ hasText: /Manage promoters, affiliates and referral revenue/i })
  192 |       .first();
  193 |     await expect(libraryCard).toBeVisible({ timeout: 60_000 });
  194 |     await expect(libraryCard.getByRole('link', { name: 'Preview' })).toBeVisible();
  195 |     await expect(libraryCard.getByRole('button', { name: 'Add to Workspace' })).toBeVisible();
  196 |     evidence.pass('Workflow Library shows Referral Management');
  197 | 
  198 |     await gotoApp(page, PREVIEW);
  199 |     await expect(page.getByRole('heading', { name: 'Referral Management' })).toBeVisible({
  200 |       timeout: 60_000,
  201 |     });
  202 |     await expect(page.getByText(/without a second referral backend/i)).toBeVisible();
  203 |     evidence.pass('Referral Management preview is available');
  204 |     await evidence.screenshot(page, 'p4-01-preview');
  205 | 
  206 |     const addToWorkspace = page.getByRole('button', { name: 'Add to Workspace' });
  207 |     if (await addToWorkspace.isVisible()) {
  208 |       await addToWorkspace.click();
  209 |       await expect(page.getByText('Added to Workspace')).toBeVisible({ timeout: 60_000 });
  210 |     } else {
  211 |       await expect(page.getByRole('link', { name: 'Open Workflow' })).toBeVisible();
  212 |     }
  213 | 
  214 |     const serviceName = await ensureCatalogService(page);
  215 |     const linksAtStart = await paymentLinkCount(page);
  216 | 
  217 |     await gotoApp(page, INSTANCE);
  218 |     await expect(page.getByRole('heading', { name: /Referral Management/i })).toBeVisible({
  219 |       timeout: 120_000,
  220 |     });
  221 |     expect(page.url()).not.toContain('/dashboard/projects/');
  222 |     evidence.pass('Installed Referral Management opens in Commercial OS');
  223 |     await evidence.screenshot(page, 'p4-02-hub');
  224 | 
  225 |     const workflowId = await getWorkflowId(page);
  226 |     await page.reload();
  227 |     await expect(page.getByRole('heading', { name: /Referral Management/i })).toBeVisible({
  228 |       timeout: 120_000,
  229 |     });
  230 | 
  231 |     await page.getByRole('button', { name: 'Add promoter' }).click();
  232 |     await page.getByPlaceholder('Name / business name').fill('Apex Promotions');
  233 |     const apexEmail = `apex.p4.${Date.now()}@example.com`;
  234 |     await page.getByPlaceholder('Email').fill(apexEmail);
  235 |     await expect(page.locator('select[name="serviceId"]')).toBeVisible();
  236 |     await page.getByRole('button', { name: 'Revenue share' }).click();
  237 |     await page.locator('input[name="percentage"]').fill('20');
  238 |     await page.getByRole('button', { name: 'Save promoter' }).click();
  239 |     await expect(page.getByText('Apex Promotions').first()).toBeVisible({ timeout: 60_000 });
  240 |     evidence.pass('Manual revenue-share promoter created');
  241 | 
  242 |     let ctx = await loadContext(page, workflowId);
  243 |     const apex = ctx.promoters.find((row) => row.name === 'Apex Promotions');
  244 |     expect(apex?.id, 'Apex Promotions promoter id').toBeTruthy();
  245 |     expect(apex?.compensationKind).toBe('revenue_share');
  246 | 
  247 |     await page.getByRole('button', { name: 'Manage' }).first().click();
  248 |     await expect(page.getByRole('button', { name: 'Back to participants' })).toBeVisible();
  249 |     expect(page.url()).toContain('/workspace/workflows/referral-management');
  250 |     evidence.pass('Promoter detail stays in Commercial OS');
  251 | 
  252 |     await page.getByRole('button', { name: 'Request approval' }).click();
  253 |     const first = await coordinate(page, workflowId, apex!.id!, 'request_approval');
  254 |     expect(first.ok, first.data.error).toBeTruthy();
  255 |     const workspaceUrl = first.data.coordination?.workspaceUrl;
  256 |     expect(workspaceUrl).toBeTruthy();
  257 |     evidence.pass('Request approval issued', workspaceUrl ?? '');
  258 | 
  259 |     await page.goto(workspaceUrl!, { waitUntil: 'domcontentloaded' });
  260 |     await ensureCookieBannerDismissed(page);
  261 |     await expect(page.getByRole('button', { name: 'Approve participation' })).toBeVisible({
  262 |       timeout: 60_000,
  263 |     });
```
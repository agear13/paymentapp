# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agreement-intelligence-p3c-golden-path.spec.ts >> P3-C Agreement Intelligence browser verification >> golden path: Library → install → Workspace → extract → approve → ACTIVE
- Location: e2e\agreement-intelligence-p3c-golden-path.spec.ts:307:7

# Error details

```
Test timeout of 600000ms exceeded.
```

```
Error: locator.click: Test timeout of 600000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Upload Agreement|Paste Agreement Text|Replace agreement/i }).first()

```

# Test source

```ts
  90  | 
  91  | 
  92  | type MatrixRow = { criterion: string; result: 'PASS' | 'FAIL' | 'SKIP'; detail?: string };
  93  | 
  94  | 
  95  | 
  96  | const matrix: MatrixRow[] = [];
  97  | 
  98  | 
  99  | 
  100 | function pass(criterion: string, detail?: string) {
  101 | 
  102 |   matrix.push({ criterion, result: 'PASS', detail });
  103 | 
  104 | }
  105 | 
  106 | 
  107 | 
  108 | function fail(criterion: string, detail?: string) {
  109 | 
  110 |   matrix.push({ criterion, result: 'FAIL', detail });
  111 | 
  112 | }
  113 | 
  114 | 
  115 | 
  116 | function skipRow(criterion: string, detail?: string) {
  117 | 
  118 |   matrix.push({ criterion, result: 'SKIP', detail });
  119 | 
  120 | }
  121 | 
  122 | 
  123 | 
  124 | async function getCsrfHeaders(page: Page): Promise<Record<string, string>> {
  125 |   const csrfToken = await page.evaluate(async () => {
  126 |     const csrfRes = await fetch('/api/security/csrf-token', { credentials: 'include' });
  127 |     if (!csrfRes.ok) throw new Error('csrf fetch failed');
  128 |     const payload = (await csrfRes.json()) as { csrfToken: string };
  129 |     return payload.csrfToken;
  130 |   });
  131 | 
  132 |   return {
  133 |     'Content-Type': 'application/json',
  134 |     'x-csrf-token': csrfToken,
  135 |   };
  136 | }
  137 | 
  138 | async function getWorkflowId(page: Page): Promise<string> {
  139 |   const workflowId = await page.evaluate(async (slug) => {
  140 |     const res = await fetch('/api/workflows', { credentials: 'include' });
  141 |     if (!res.ok) return null;
  142 |     const payload = (await res.json()) as {
  143 |       workflows: Array<{ id: string; templateSlug: string }>;
  144 |     };
  145 |     return payload.workflows.find((w) => w.templateSlug === slug)?.id ?? null;
  146 |   }, SLUG);
  147 | 
  148 |   expect(workflowId).toBeTruthy();
  149 |   return workflowId!;
  150 | }
  151 | 
  152 | async function browserApi<T>(
  153 |   page: Page,
  154 |   path: string,
  155 |   init?: { method?: string; headers?: Record<string, string>; body?: unknown }
  156 | ): Promise<{ ok: boolean; status: number; data: T }> {
  157 |   return page.evaluate(
  158 |     async ({ url, options }) => {
  159 |       const res = await fetch(url, {
  160 |         method: options.method ?? 'GET',
  161 |         credentials: 'include',
  162 |         headers: options.headers,
  163 |         body: options.body ? JSON.stringify(options.body) : undefined,
  164 |       });
  165 |       const text = await res.text();
  166 |       let data: unknown = null;
  167 |       if (text) {
  168 |         try {
  169 |           data = JSON.parse(text);
  170 |         } catch {
  171 |           data = text;
  172 |         }
  173 |       }
  174 |       return { ok: res.ok, status: res.status, data };
  175 |     },
  176 |     { url: path, options: init ?? {} }
  177 |   ) as Promise<{ ok: boolean; status: number; data: T }>;
  178 | }
  179 | 
  180 | 
  181 | 
  182 | async function pasteAndExtractToReview(page: Page): Promise<void> {
  183 | 
  184 |   const uploadBtn = page
  185 | 
  186 |     .getByRole('button', { name: /Upload Agreement|Paste Agreement Text|Replace agreement/i })
  187 | 
  188 |     .first();
  189 | 
> 190 |   await uploadBtn.click();
      |                   ^ Error: locator.click: Test timeout of 600000ms exceeded.
  191 | 
  192 |   await page.getByRole('tab', { name: 'Paste text' }).click();
  193 | 
  194 |   await page.locator('textarea').fill(AGREEMENT_TEXT);
  195 | 
  196 |   await page.getByRole('button', { name: 'Extract from text' }).click();
  197 | 
  198 |   await expect(page.getByRole('button', { name: 'Review Agreement' })).toBeVisible({
  199 | 
  200 |     timeout: 180_000,
  201 | 
  202 |   });
  203 | 
  204 | }
  205 | 
  206 | 
  207 | 
  208 | test.describe('P3-C Agreement Intelligence browser verification', () => {
  209 | 
  210 |   test.beforeAll(() => {
  211 | 
  212 |     mkdirSync(OUT_DIR, { recursive: true });
  213 | 
  214 |   });
  215 | 
  216 | 
  217 | 
  218 |   test.afterAll(() => {
  219 | 
  220 |     writeFileSync(
  221 | 
  222 |       resolve(OUT_DIR, 'p3c-browser-matrix.json'),
  223 | 
  224 |       JSON.stringify({ matrix, generatedAt: new Date().toISOString() }, null, 2)
  225 | 
  226 |     );
  227 | 
  228 |   });
  229 | 
  230 | 
  231 | 
  232 |   test('IA: distinct destinations and invoice pages', async ({ page }) => {
  233 | 
  234 |     test.setTimeout(600_000);
  235 | 
  236 |     await ensureE2eSession(page);
  237 | 
  238 |     pass('Workspace home loads after authenticated session');
  239 | 
  240 |     await gotoApp(page, ROUTES.preview);
  241 | 
  242 |     await expect(page).toHaveURL(new RegExp(`/workspace/workflows/${SLUG}/preview`));
  243 | 
  244 |     await expect(page.getByText(/Review what this workflow will do/i)).toBeVisible({ timeout: 60_000 });
  245 | 
  246 |     pass('Library Preview is marketplace preview (/preview)');
  247 | 
  248 | 
  249 | 
  250 |     await gotoApp(page, ROUTES.instance);
  251 | 
  252 |     await expect
  253 |       .poll(
  254 |         async () => {
  255 |           if (page.url().includes('/preview')) return 'preview';
  256 |           if ((await page.getByRole('heading', { name: /Agreement Intelligence/i }).count()) > 0) {
  257 |             return 'hub';
  258 |           }
  259 |           return 'pending';
  260 |         },
  261 |         { timeout: 120_000 }
  262 |       )
  263 |       .not.toBe('pending');
  264 | 
  265 |     if (page.url().includes('/preview')) {
  266 |       pass(
  267 |         'Library Open Workflow opens installed instance',
  268 |         'Not installed yet — instance route redirects to marketplace preview'
  269 |       );
  270 |     } else {
  271 |       pass('Library Open Workflow opens installed instance hub');
  272 |     }
  273 | 
  274 | 
  275 | 
  276 |     await gotoApp(page, ROUTES.commercial);
  277 | 
  278 |     await expect(page).toHaveURL(new RegExp('/workspace/commercial$'));
  279 | 
  280 |     pass('Commercial Workspace remains /workspace/commercial');
  281 | 
  282 | 
  283 | 
  284 |     await gotoApp(page, ROUTES.createInvoice);
  285 | 
  286 |     const createBlocked = page.getByText(/Finish (your )?Xero setup before creating invoices/i);
  287 |     expect(await createBlocked.count()).toBe(0);
  288 | 
  289 |     await expect(
  290 |       page.getByRole('heading', { name: /Create Invoice|Create invoices and collect payments/i })
```
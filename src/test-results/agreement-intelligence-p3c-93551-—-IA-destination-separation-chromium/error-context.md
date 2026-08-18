# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agreement-intelligence-p3c-golden-path.spec.ts >> P3-C Agreement Intelligence browser verification >> Run 1 — IA destination separation
- Location: e2e\agreement-intelligence-p3c-golden-path.spec.ts:355:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Start with Agreement Intelligence/i }).first()
Expected: visible
Timeout: 120000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 120000ms
  - waiting for getByRole('button', { name: /Start with Agreement Intelligence/i }).first()

```

# Page snapshot

```yaml
- generic:
  - generic [active]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - navigation [ref=e6]:
            - button "previous" [disabled] [ref=e7]:
              - img "previous" [ref=e8]
            - generic [ref=e10]:
              - generic [ref=e11]: 1/
              - text: "1"
            - button "next" [disabled] [ref=e12]:
              - img "next" [ref=e13]
          - img
        - generic [ref=e15]:
          - link "Next.js 15.5.7 (outdated) Webpack" [ref=e16] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
            - img [ref=e17]
            - generic "An outdated version detected (latest is 16.3.1), upgrade is highly recommended!" [ref=e19]: Next.js 15.5.7 (outdated)
            - generic [ref=e20]: Webpack
          - img
      - generic [ref=e21]:
        - dialog "Runtime SyntaxError" [ref=e22]:
          - generic [ref=e25]:
            - generic [ref=e26]:
              - generic [ref=e27]:
                - generic [ref=e29]: Runtime SyntaxError
                - generic [ref=e30]:
                  - button "Copy Error Info" [ref=e31] [cursor=pointer]:
                    - img [ref=e32]
                  - button "No related documentation found" [disabled] [ref=e34]:
                    - img [ref=e35]
                  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools" [ref=e37] [cursor=pointer]:
                    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
                    - img [ref=e38]
              - paragraph [ref=e47]: Unexpected end of JSON input
            - generic [ref=e49]:
              - generic [ref=e50]:
                - paragraph [ref=e51]:
                  - text: Call Stack
                  - generic [ref=e52]: "19"
                - button "Show 18 ignore-listed frame(s)" [ref=e53] [cursor=pointer]:
                  - text: Show 18 ignore-listed frame(s)
                  - img [ref=e54]
              - generic [ref=e56]:
                - generic [ref=e57]: JSON.parse
                - text: <anonymous>
          - generic [ref=e58]:
            - generic [ref=e59]: "1"
            - generic [ref=e60]: "2"
        - contentinfo [ref=e61]:
          - region "Error feedback" [ref=e62]:
            - paragraph [ref=e63]:
              - link "Was this helpful?" [ref=e64] [cursor=pointer]:
                - /url: https://nextjs.org/telemetry#error-feedback
            - button "Mark as helpful" [ref=e65] [cursor=pointer]:
              - img [ref=e66]
            - button "Mark as not helpful" [ref=e69] [cursor=pointer]:
              - img [ref=e70]
    - generic [ref=e76] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e77]:
        - img [ref=e78]
      - generic [ref=e81]:
        - button "Open issues overlay" [ref=e82]:
          - generic [ref=e83]:
            - generic [ref=e84]: "0"
            - generic [ref=e85]: "1"
          - generic [ref=e86]: Issue
        - button "Collapse issues badge" [ref=e87]:
          - img [ref=e88]
  - alert [ref=e90]
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | import { execSync } from 'node:child_process';
  3   | import { resolve } from 'node:path';
  4   | 
  5   | import { createEvidenceTracker } from './helpers/e2e-evidence';
  6   | import {
  7   |   ensureCookieBannerDismissed,
  8   |   ensureE2eSession,
  9   | } from './helpers/e2e-auth';
  10  | import { gotoApp } from './helpers/e2e-navigation';
  11  | 
  12  | test.describe.configure({ mode: 'serial' });
  13  | 
  14  | const SLUG = 'agreement-intelligence';
  15  | 
  16  | const ROUTES = {
  17  |   workspace: '/workspace',
  18  |   commercial: '/workspace/commercial',
  19  |   library: '/workspace/workflows',
  20  |   preview: `/workspace/workflows/${SLUG}/preview`,
  21  |   instance: `/workspace/workflows/${SLUG}`,
  22  |   createInvoice: '/workspace/receivables/create',
  23  |   manageInvoices: '/workspace/receivables/invoices',
  24  | } as const;
  25  | 
  26  | const AGREEMENT_TEXT = `Festival Revenue Share Agreement
  27  | 
  28  | Between Venue Co (Venue), Apex Promotions (Promoter), and DJ Nova (DJ).
  29  | 
  30  | Promoter receives 20% of net ticket revenue. DJ receives 10% of net ticket revenue.
  31  | 
  32  | Settlement occurs every Friday following each event weekend.
  33  | 
  34  | Venue retains remaining revenue after participant shares.`;
  35  | 
  36  | const OUT_DIR = resolve(process.cwd(), 'scripts/output/playwright-p3c');
  37  | const evidence = createEvidenceTracker(OUT_DIR);
  38  | 
  39  | function resetAgreementWorkflow(): void {
  40  |   execSync('npm run e2e:reset-agreement-workflow', {
  41  |     cwd: process.cwd(),
  42  |     stdio: 'pipe',
  43  |     encoding: 'utf8',
  44  |   });
  45  | }
  46  | 
  47  | async function waitForInstalledUiOrApi(page: Page, templateSlug: string): Promise<void> {
  48  |   await expect
  49  |     .poll(
  50  |       async () => {
  51  |         if ((await page.getByText('Added to Workspace').count()) > 0) return 'ui-badge';
  52  |         if ((await page.getByRole('link', { name: 'Open Workflow' }).count()) > 0) return 'ui-open';
  53  |         const installed = await page.evaluate(async (slug) => {
  54  |           const res = await fetch('/api/workflows', { credentials: 'include' });
  55  |           if (!res.ok) return false;
  56  |           const data = (await res.json()) as { workflows?: Array<{ templateSlug: string }> };
  57  |           return (data.workflows ?? []).some((row) => row.templateSlug === slug);
  58  |         }, templateSlug);
  59  |         return installed ? 'api' : 'pending';
  60  |       },
  61  |       { timeout: 120_000, intervals: [500, 1000, 2000] }
  62  |     )
  63  |     .not.toBe('pending');
  64  | }
  65  | 
  66  | async function installFromPreview(page: Page, templateSlug: string): Promise<string> {
  67  |   const addButton = page.getByRole('button', { name: 'Add to Workspace' });
  68  |   if ((await addButton.count()) > 0) {
  69  |     await ensureCookieBannerDismissed(page);
  70  |     await addButton.first().click();
  71  |     try {
  72  |       await waitForInstalledUiOrApi(page, templateSlug);
  73  |       return 'Add to Workspace button';
  74  |     } catch {
  75  |       /* fall through to API deploy */
  76  |     }
  77  |   }
  78  |   await ensureWorkflowInstalled(page, templateSlug);
  79  |   return 'API deploy fallback';
  80  | }
  81  | 
  82  | async function waitForWorkspaceAction(page: Page, title: string) {
  83  |   const action = page.getByRole('button', { name: new RegExp(`Start with ${title}`, 'i') });
> 84  |   await expect(action.first()).toBeVisible({ timeout: 120_000 });
      |                                ^ Error: expect(locator).toBeVisible() failed
  85  |   return action.first();
  86  | }
  87  | 
  88  | async function ensureWorkflowInstalled(page: Page, templateSlug: string): Promise<void> {
  89  |   const ok = await page.evaluate(async (slug) => {
  90  |     const hasWorkflow = async () => {
  91  |       const list = await fetch('/api/workflows', { credentials: 'include' });
  92  |       if (!list.ok) return false;
  93  |       const data = (await list.json()) as { workflows?: Array<{ templateSlug: string }> };
  94  |       return (data.workflows ?? []).some((row) => row.templateSlug === slug);
  95  |     };
  96  | 
  97  |     if (await hasWorkflow()) return true;
  98  | 
  99  |     const csrfRes = await fetch('/api/security/csrf-token', { credentials: 'include' });
  100 |     if (!csrfRes.ok) return false;
  101 |     const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  102 | 
  103 |     const deploy = await fetch('/api/workflows/deploy', {
  104 |       method: 'POST',
  105 |       credentials: 'include',
  106 |       headers: {
  107 |         'Content-Type': 'application/json',
  108 |         'x-csrf-token': csrfToken,
  109 |       },
  110 |       body: JSON.stringify({ templateSlug: slug }),
  111 |     });
  112 |     if (!deploy.ok) return false;
  113 |     return hasWorkflow();
  114 |   }, templateSlug);
  115 | 
  116 |   expect(ok, `Agreement Intelligence install/deploy for ${templateSlug}`).toBeTruthy();
  117 |   await waitForInstalledUiOrApi(page, templateSlug);
  118 | }
  119 | 
  120 | async function getCsrfHeaders(page: Page): Promise<Record<string, string>> {
  121 |   const csrfToken = await page.evaluate(async () => {
  122 |     const csrfRes = await fetch('/api/security/csrf-token', { credentials: 'include' });
  123 |     if (!csrfRes.ok) throw new Error('csrf fetch failed');
  124 |     const payload = (await csrfRes.json()) as { csrfToken: string };
  125 |     return payload.csrfToken;
  126 |   });
  127 | 
  128 |   return {
  129 |     'Content-Type': 'application/json',
  130 |     'x-csrf-token': csrfToken,
  131 |   };
  132 | }
  133 | 
  134 | async function getWorkflowId(page: Page): Promise<string> {
  135 |   const workflowId = await page.evaluate(async (slug) => {
  136 |     const res = await fetch('/api/workflows', { credentials: 'include' });
  137 |     if (!res.ok) return null;
  138 |     const payload = (await res.json()) as {
  139 |       workflows: Array<{ id: string; templateSlug: string }>;
  140 |     };
  141 |     return payload.workflows.find((w) => w.templateSlug === slug)?.id ?? null;
  142 |   }, SLUG);
  143 | 
  144 |   expect(workflowId).toBeTruthy();
  145 |   return workflowId!;
  146 | }
  147 | 
  148 | async function browserApi<T>(
  149 |   page: Page,
  150 |   path: string,
  151 |   init?: { method?: string; headers?: Record<string, string>; body?: unknown }
  152 | ): Promise<{ ok: boolean; status: number; data: T }> {
  153 |   return page.evaluate(
  154 |     async ({ url, options }) => {
  155 |       try {
  156 |         const res = await fetch(url, {
  157 |           method: options.method ?? 'GET',
  158 |           credentials: 'include',
  159 |           headers: options.headers,
  160 |           body: options.body ? JSON.stringify(options.body) : undefined,
  161 |         });
  162 |         const text = await res.text();
  163 |         let data: unknown = null;
  164 |         if (text) {
  165 |           try {
  166 |             data = JSON.parse(text);
  167 |           } catch {
  168 |             data = text;
  169 |           }
  170 |         }
  171 |         return { ok: res.ok, status: res.status, data };
  172 |       } catch {
  173 |         return { ok: false, status: 0, data: null };
  174 |       }
  175 |     },
  176 |     { url: path, options: init ?? {} }
  177 |   ) as Promise<{ ok: boolean; status: number; data: T }>;
  178 | }
  179 | 
  180 | async function readAgreementHubState(
  181 |   page: Page
  182 | ): Promise<'empty' | 'review' | 'active' | 'participant_setup' | 'extracting' | 'bootstrap_failed'> {
  183 |   if ((await page.getByText('ACTIVE').filter({ hasText: /^ACTIVE$/ }).count()) > 0) return 'active';
  184 |   if ((await page.getByText('PARTICIPANT SETUP').count()) > 0) return 'participant_setup';
```
# B1 Remediation Analysis — `GET /api/xero/debug`

**Date:** 2026-06-04  
**Scope:** Pre-implementation investigation only (no code changes).  
**Baseline:** [tenant-isolation-audit.md](./production-readiness/tenant-isolation-audit.md) F-01, [security-audit.md](./production-readiness/security-audit.md) S-CR-01, launch blocker **B1**.

---

## Endpoint under review

| Field | Value |
|-------|--------|
| Route | `GET /api/xero/debug` |
| File | `src/app/api/xero/debug/route.ts` |
| Method | GET only (no POST) |
| Dynamic config | None (`export async function GET()` — default Next.js App Router deployment) |

---

## Investigation answers

### 1. What data is exposed?

The handler returns a **global, cross-tenant snapshot** of platform Xero/payment state. No `organization_id` filter is applied anywhere.

| Response section | Source query | Data exposed (per record / aggregate) |
|------------------|--------------|----------------------------------------|
| `summary` | Derived | Counts: syncs by status, paid links, paid-without-sync, whether *any* Xero connection exists, token expiry flag |
| `xeroConnection` | `xero_connections.findFirst()` | **One arbitrary org’s** connection: internal connection `id`, `organization_id` (in DB select, **omitted from JSON**), `tenant_id`, `expires_at`, `connected_at` |
| `allSyncs` | Last **50** `xero_syncs` globally | Sync id, `payment_link_id`, short code, amount, currency (via join), sync type/status, retry count, **`error_message`**, Xero invoice/payment ids, timestamps |
| `paidLinksWithoutSyncs` | Subset of global PAID links | Link id, short code, amount, currency, status, created/updated timestamps (**`organization_id` in DB but not in mapped JSON**) |
| `recentPaymentEvents` | Last **10** `PAYMENT_CONFIRMED` globally | Event id, `payment_link_id`, event type, payment method, created_at |
| `diagnostics` | Derived | Human-readable issue list (e.g. “N paid link(s) never queued”) |

**Not returned in JSON but derivable / adjacent:**

- Cross-tenant **invoice references** via `short_code`, amounts, currencies.
- **Operational errors** from other merchants (`error_message`).
- **Xero external IDs** (`xero_invoice_id`, `xero_payment_id`) for other tenants’ syncs.
- Which **Xero tenant** the platform has connected first (`tenantId` from `findFirst()` — not scoped to caller’s org).

**Not exposed:** Raw `request_payload` / `response_payload` from `xero_syncs`, OAuth tokens (access/refresh), or full `organization_id` on payment links in the mapped response (still a confidentiality breach via business metadata).

---

### 2. Is the endpoint reachable in production?

**Yes**, unless blocked outside the app (not observed in repo).

- Implemented as a normal App Router API route under `src/app/api/xero/debug/route.ts`.
- No `NODE_ENV` guard, feature flag, or `dynamic = 'force-dynamic'` special casing that would disable it in production.
- Deployed with the main Next.js app (e.g. Render) like other `/api/*` routes.
- **Not** listed in middleware as admin-only; **not** excluded from production builds.

**Reachability:** Any deployment that serves the dashboard also serves `GET /api/xero/debug`.

---

### 3. What authentication is required?

**Supabase session authentication** (cookie-based via server client).

```typescript
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) → 401
```

- Unauthenticated callers receive `401 Unauthorized - please log in`.
- No API key, cron secret, or webhook signature on this route.

---

### 4. What authorization is required?

**None beyond “has a valid login”.**

- No `hasOrganizationPermission`.
- No `checkAdminAuth` / `ADMIN_EMAILS`.
- No `isBetaAdminEmail`.
- No role check (`view_settings`, `manage_ledger`, etc.).

Any user who can sign up / log in to the product can call the endpoint.

---

### 5. Is organization scoping enforced?

**No.**

| Query | Scoping |
|-------|---------|
| `xero_syncs.findMany` | Global, `take: 50` |
| `payment_links.findMany` (`status: PAID`) | Global, `take: 50` |
| `xero_connections.findFirst` | Global (first row in table) |
| `payment_events.findMany` | Global, `take: 10` |

Contrast with **correct** Xero APIs in the same area:

| Route | AuthZ pattern |
|-------|----------------|
| `GET /api/xero/status` | `organization_id` query + `hasOrganizationPermission(..., 'view_settings')` |
| `GET /api/xero/sync/stats` | Same |
| `GET /api/xero/sync/failed` | Same |
| `GET /api/xero/sync/status` | `organization_id` + payment link ownership check + `view_settings` |
| `POST /api/xero/sync/replay` | Org-scoped (per route implementation) |

---

### 6. Can one tenant access another tenant’s records?

**Yes — confirmed FAIL (F-01).**

A merchant user in **Organization A** who is authenticated can:

1. Read sync rows and payment metadata for **Organization B** (and all orgs) in `allSyncs` / `paidLinksWithoutSyncs`.
2. Infer platform-wide queue health and failure messages.
3. See **recent payment events** across all orgs.
4. See **a** Xero connection’s `tenantId` (whichever row `findFirst()` returns), which may not belong to their org.

This is **read-only** cross-tenant access (no write via debug), but it violates tenant isolation for payments/ledger-adjacent data.

---

### 7. Is the endpoint referenced anywhere in the UI?

**Yes — one production UI link.**

| Location | Usage |
|----------|--------|
| `src/components/dashboard/settings/xero-sync-queue.tsx` | Collapsible “Advanced” section: `<Link href="/api/xero/debug" target="_blank">View detailed sync diagnostics</Link>` |
| Parent page | `src/app/(dashboard)/dashboard/settings/integrations/page.tsx` renders `<XeroSyncQueue organizationId={organizationId} />` for any logged-in user with an org |

**Implications:**

- Link is visible on **Settings → Integrations** to normal merchants (not admin-gated in UI).
- Opens raw JSON in a new tab (browser navigation to API URL).
- The same component’s primary data uses `/api/xero/queue/process-now`, which **is** admin/cron-gated — so many users see “load failed” for queue status but can still open **debug** (weaker auth).

**Not found:** E2E tests, Playwright, or other UI paths referencing `/api/xero/debug`.

---

### 8. Is the endpoint used operationally?

| Use type | Evidence |
|----------|----------|
| **Documented ops / dev** | `XERO_BACKFILL_FIX.md` — troubleshooting steps use `GET /api/xero/debug` |
| **Production readiness docs** | failure-scenario-review: “do not use xero/debug in prod” (advisory, not enforced) |
| **In-app** | Link above — informal operator diagnostics |
| **CI / cron** | No references |
| **Admin dashboards** | Admin surfaces use `/api/xero/sync/stats`, `/api/xero/sync/failed`, `/api/xero/sync/replay` — **not** debug |

**Conclusion:** Used as a **convenience troubleshooting** endpoint during Xero backfill work; not required for normal merchant workflows. **Replaceable** by existing org-scoped sync APIs + admin tools.

---

## Related routes (same problem class)

Not B1, but should be tracked if touching Xero security:

| Route | Issue |
|-------|--------|
| `POST/GET /api/xero/queue/backfill` | Authenticated only; scans **all** `PAID` payment links globally; UI sends `organizationId` in body but **server ignores it** — cross-tenant read + potential cross-tenant queue writes |
| `GET /api/xero/queue/process-now` | Global pending count + last 10 syncs for **admins/cron only** — acceptable for platform ops, still global |

---

## Remediation options

### Option A — Delete endpoint completely

Remove `src/app/api/xero/debug/route.ts` and remove the Integrations UI link (or point to org-scoped stats).

| | |
|--|--|
| **Impact** | Eliminates cross-tenant read path. Merchants lose one-click global JSON dump. Ops use `sync/stats`, `sync/failed`, `sync/status`, Render logs, or DB read replicas instead. |
| **Risk** | **Low** — documented troubleshooting in `XERO_BACKFILL_FIX.md` becomes stale until updated. No breaking change for programmatic clients (none found). |
| **Effort** | **Small** (~1 file delete + 1 UI link change + doc touch). |

---

### Option B — Admin-only endpoint

Keep route; gate with `checkAdminAuth()` (same pattern as `GET/POST /api/xero/queue/process-now`) and optionally `isBetaAdminEmail` for consistency with other beta admin APIs.

| | |
|--|--|
| **Impact** | Platform operators retain global visibility; merchants cannot enumerate other tenants. Still exposes **global** data to anyone on `ADMIN_EMAILS` / beta admin list. |
| **Risk** | **Medium-Low** — admin account compromise exposes all tenants; does not fix “global” semantics, only shrinks audience. UI link should be hidden for non-admins. |
| **Effort** | **Small** — add admin check at top of handler; conditional UI link. |

---

### Option C — Organization-scoped endpoint

Change contract to `GET /api/xero/debug?organization_id=<uuid>` (or rename to `/api/xero/sync/diagnostics`):

- `hasOrganizationPermission(user, organizationId, 'view_settings')`
- Filter all queries via `payment_links.organization_id` (join for `xero_syncs`, `payment_events`, `xero_connections.findUnique({ where: { organization_id } })`)

| | |
|--|--|
| **Impact** | Merchants get safe “diagnostics” for **their** org only; aligns with Sprint 13 sync APIs. Supports self-service Integrations troubleshooting. |
| **Risk** | **Low** if implemented consistently — regression risk if any query forgets the org filter. Slightly larger test surface than delete. |
| **Effort** | **Medium** — refactor queries + tests + update UI link with `organizationId` query param; update internal docs. |

---

## Recommendation

**Choose Option A (delete)** as the safest fix with the **lowest implementation risk**.

| Criterion | Why A wins |
|-----------|------------|
| Security | Removes the vulnerability entirely; no filter logic to get wrong later |
| Effort | Smallest diff; no new contract to maintain |
| Functional replacement | Already exists: `GET /api/xero/sync/stats`, `GET /api/xero/sync/failed`, `GET /api/xero/sync/status`, admin `sync-queue-dashboard` / `error-logs-viewer` |
| UI | Replace link text with “View sync errors” → org-scoped failed syncs or expand existing `XeroSyncQueue` to use `sync/stats?organization_id=` (already passed as prop) |
| Ops | Global ops should use admin auth + existing tools or DB, not a merchant-grade debug route |

**If product insists on in-app “diagnostics” for merchants:** implement **Option C** (not B) as a follow-up — scoped diagnostics, not a renamed global debug route. Option B is a reasonable **interim** only if operators actively use global debug today and delete would block incident response; audit found no hard production dependency beyond docs and one settings link.

---

## Implementation checklist (when approved — out of scope for this doc)

1. Delete `src/app/api/xero/debug/route.ts`.
2. Update `xero-sync-queue.tsx` link → `/dashboard/...` or `fetch('/api/xero/sync/stats?organization_id=...')` pattern.
3. Update `XERO_BACKFILL_FIX.md` and any runbooks referencing `/api/xero/debug`.
4. Add regression test: route returns 404 or is absent.
5. **Separate ticket:** org-scope or admin-gate `POST /api/xero/queue/backfill` (related cross-tenant issue).

---

## References

| Artifact | Path |
|----------|------|
| Debug handler | `src/app/api/xero/debug/route.ts` |
| UI link | `src/components/dashboard/settings/xero-sync-queue.tsx` |
| Org-scoped reference | `src/app/api/xero/sync/stats/route.ts` |
| Tenant FAIL | `docs/production-readiness/tenant-isolation-audit.md` |
| Security CRITICAL | `docs/production-readiness/security-audit.md` |

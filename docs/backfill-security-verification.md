# Xero Backfill — Security Verification

**Date:** 2026-06-04  
**Remediation:** Organization-scoped backfill + admin-only global (Option C).

---

## Merchant user — own organization

| Check | Expected | Implementation |
|-------|----------|----------------|
| POST with `{ organizationId, scope: 'organization' }` | 200 when user has `manage_settings` on org | `authorizeXeroBackfill` → `hasOrganizationPermission` |
| Queries | Only `payment_links` where `organization_id = :org` and `status = PAID` missing `xero_syncs` | `paidLinksMissingSyncWhere` |
| Queue | `queueXeroSync` uses link’s `organization_id` | `executeXeroBackfill` loop |
| Audit | `audit_logs` row with `organization_id`, `XERO_BACKFILL_EXECUTED` | `executeXeroBackfill` |
| Log | `backfill_requested` / `backfill_completed` with org id | `xero-backfill-trace.ts` |

**UI:** `xero-sync-queue.tsx` sends `organizationId` + `scope: 'organization'`.

---

## Cross-tenant attempt — denied

| Attempt | Expected | Code |
|---------|----------|------|
| POST with another org’s UUID | **403** | `BACKFILL_FORBIDDEN` (no membership / permission) |
| POST without `organizationId` | **400** | `BACKFILL_ORGANIZATION_REQUIRED` |
| GET preview without `organization_id` query | **400** | Same |
| Merchant POST `{ scope: 'global' }` | **403** | `BACKFILL_GLOBAL_ADMIN_REQUIRED` |

**Evidence:** No route-level global `payment_links.findMany({ status: 'PAID' })` without org filter for merchant scope.

---

## Admin user — global backfill

| Check | Expected |
|-------|----------|
| `scope=global` (query or body) | Allowed only if `checkAdminAuth()` passes (`config.admin.emailAllowlist`) |
| Queries | All tenants’ PAID links missing syncs (`organizationId` null in where helper) |
| Audit | `organization_id` null on audit row; `scope: 'global'` in `new_values` |

**Not exposed in merchant UI** — ops use API/curl with admin session.

---

## Unauthorized request

| Case | Status |
|------|--------|
| No session | **401** |

---

## Existing Xero sync functionality

| Path | Impact |
|------|--------|
| `confirmPayment` → `xero_syncs.upsert` | **Unchanged** |
| `queueXeroPaymentSyncIfEnabled` | **Unchanged** |
| B3 `xero-queue` cron → `queue/process` | **Unchanged** |
| `GET /api/xero/sync/stats?organization_id=` | **Unchanged** (org RBAC) |

Backfill only affects explicit backfill HTTP calls.

---

## Automated verification

```bash
cd src
npx jest __tests__/xero/xero-backfill-security.test.ts
```

Contract tests assert: authorization module, org-scoped where clauses, admin gate, trace + audit, no inline global scan in route.

---

## Manual test matrix (staging)

| # | Actor | Request | Expect |
|---|-------|---------|--------|
| 1 | Org member | POST `{ organizationId: <own>, scope: 'organization' }` | 200, queued ≥ 0, only own links in `details` |
| 2 | Org member | POST `{ organizationId: <other> }` | 403 |
| 3 | Anonymous | POST | 401 |
| 4 | Admin | POST `{ scope: 'global' }` | 200, audit + logs with `scope: global` |
| 5 | Member | POST `{ scope: 'global' }` | 403 |

---

## Certification update

| Finding | Status |
|---------|--------|
| Backfill endpoint global cross-tenant | **RESOLVED** (forward path) |

Historical sync rows created by prior global backfill are unchanged; no data migration required.

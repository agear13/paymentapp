# Xero Backfill Remediation — Impact Analysis

**Date:** 2026-06-04  
**Finding:** `final-launch-certification.md` — global `/api/xero/queue/backfill` cross-tenant risk.

---

## Phase 1 — Routes

| Method | Path | Purpose (pre-remediation) |
|--------|------|---------------------------|
| **GET** | `/api/xero/queue/backfill` | Preview PAID links missing `xero_syncs` |
| **POST** | `/api/xero/queue/backfill` | Queue missing syncs via `queueXeroSync` |

**File:** `src/app/api/xero/queue/backfill/route.ts`

---

## Callers

| Caller | Type | Notes |
|--------|------|-------|
| `src/components/dashboard/settings/xero-sync-queue.tsx` | UI (merchant settings) | `POST` with JSON `{ organizationId }` — **body was ignored** by server |
| `docs/production-readiness/system-architecture-map.md` | Documentation | Listed in architecture map |
| `XERO_BACKFILL_FIX.md` | Documentation | curl examples without org scope |
| `docs/launch-readiness-reassessment*.md`, `docs/final-launch-certification.md` | Certification | Flagged as P0/P1 |

**Not found in `src/`:** server actions, cron jobs, admin scripts calling this HTTP route.

---

## Data access (pre-remediation)

| Step | Table / API | Scope |
|------|-------------|-------|
| Auth | Supabase session | User identity only |
| List paid invoices | `payment_links` | **Global** `where: { status: 'PAID' }` |
| Existing syncs | `xero_syncs` | **Global** all rows (`payment_link_id` only) |
| Queue | `queueXeroSync` | Per link `organizationId` from row |

**Intentional global scan:** None documented — UI implied org scope via `organizationId`.

---

## Phase 2 — Security review

### Can a normal merchant…?

| Question | Pre-remediation | Evidence |
|----------|-----------------|----------|
| Trigger backfill for **another** organization? | **Yes** | `POST` ignored body; queued syncs for **all** tenants’ missing links |
| Inspect another org’s backfill preview? | **Yes** | `GET` returned counts/preview across **all** PAID links |
| Influence another org’s records? | **Yes** | `queueXeroSync` called for every missing link platform-wide |
| Cause excessive global workload? | **Yes** | Full-table scan + loop over all tenants |

---

## Phase 3 — Design

### Option A — Organization-scoped only

- Merchants: membership + `manage_settings` (or `view_settings` for GET).
- Queries: `payment_links.organization_id = :org` and `xero_syncs` via relation.

### Option B — Admin-only global

- Removes merchant self-service backfill in settings UI unless paired with org id.

### Option C — Hybrid (**recommended**)

| Actor | Scope | Authorization |
|-------|-------|----------------|
| Merchant | **Organization** | `hasOrganizationPermission` + required `organization_id` |
| Platform admin | **Global** (optional) | `checkAdminAuth` + `scope=global` + audit |

**Rationale:**

| Criterion | Assessment |
|-----------|------------|
| Security | Closes cross-tenant path for merchants; admin global retained for ops |
| Operational | Settings UI unchanged (org id already sent) |
| Migration | Low — no schema change |
| Complexity | Small — shared service module + route thin layer |

---

## Phase 4 — Implementation summary

| Artifact | Role |
|----------|------|
| `src/lib/xero/xero-backfill.server.ts` | Scoped queries, auth, audit |
| `src/lib/xero/xero-backfill-trace.ts` | `backfill_requested` / `completed` / `denied` |
| `src/app/api/xero/queue/backfill/route.ts` | HTTP adapter |
| `xero-sync-queue.tsx` | Sends `organizationId` (unchanged contract) |

---

## Phase 5–6

See `docs/backfill-security-verification.md` and `src/__tests__/xero/xero-backfill-security.test.ts`.

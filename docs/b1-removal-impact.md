# B1 Removal Impact — `GET /api/xero/debug`

**Date:** 2026-06-04  
**Remediation:** Option A — delete endpoint and remove merchant access (no admin replacement, no org-scoped debug).

---

## Step 1 — Inventory

### Route files (to remove)

| Path | Action |
|------|--------|
| `src/app/api/xero/debug/route.ts` | **Delete** — sole handler for `GET /api/xero/debug` |

No `route.ts` siblings under `debug/`; no middleware special case.

### UI entry points (to change)

| Path | Element | Action |
|------|---------|--------|
| `src/components/dashboard/settings/xero-sync-queue.tsx` | Collapsible “Advanced” → link “View detailed sync diagnostics” → `href="/api/xero/debug"` | **Remove** link (and `next/link` import if unused) |
| `src/app/(dashboard)/dashboard/settings/integrations/page.tsx` | Renders `XeroSyncQueue` only | **No change** (parent unchanged) |

**Not found:** menu/nav entries, buttons elsewhere, admin dashboards linking to debug.

### Documentation references (informational — not all updated in B1 scope)

| Path | Notes |
|------|--------|
| `docs/b1-remediation-analysis.md` | Analysis; remains historical |
| `docs/production-readiness/*.md` | Audit findings; update at next doc pass |
| `XERO_BACKFILL_FIX.md` | Ops runbook cites debug; **stale after removal** — use `/api/xero/sync/stats` + `/api/xero/sync/failed` |
| `docs/workflow-correctness-reassessment.md` | Mentions B1 P0 |

### Tests (before B1)

| Path | References debug? |
|------|-----------------|
| E2E / Playwright | **No** |
| Jest | **No** existing test |

**Planned tests (Step 5):** `src/__tests__/xero/xero-debug-removed.test.ts` — contract checks (file absent, UI string absent, org-scoped routes present).

### Dependent functionality (must remain)

| Capability | Replacement |
|------------|-------------|
| Org sync statistics | `GET /api/xero/sync/stats?organization_id=` |
| Failed sync list | `GET /api/xero/sync/failed?organization_id=` |
| Per-invoice sync status | `GET /api/xero/sync/status?payment_link_id=&organization_id=` |
| Admin error dashboard | `sync-queue-dashboard.tsx`, `error-logs-viewer.tsx` |
| Queue process (admin/cron) | `POST /api/xero/queue/process-now` |
| Xero connection status | `GET /api/xero/status?organization_id=` |

---

## Step 4 — `/api/xero/queue/backfill` audit (document only)

**Out of scope for B1 code changes** per instructions.

| Method | Auth | Org filter | Cross-tenant |
|--------|------|------------|--------------|
| `POST` | Logged-in user only | **No** — scans all `PAID` payment_links globally | **Yes** — can queue syncs for any org’s links |
| `GET` (preview) | Logged-in user only | **No** — returns global paid links without syncs | **Yes** — exposes amounts/short codes across tenants in `previewLinks` |

UI (`xero-sync-queue.tsx`) sends `organizationId` in POST body; **server ignores it** (handler takes no body).

**Recommendation:** Separate ticket (not B1) — org-scope backfill POST/GET + `view_settings` permission.

---

## Step 2–3 — Planned code changes

1. Delete `src/app/api/xero/debug/route.ts`.
2. Remove diagnostics link from `xero-sync-queue.tsx`.
3. Add Jest contract tests for removal and preserved sync routes.

**Post-deploy behavior:** `GET /api/xero/debug` → **404** (route not registered). No 410 stub (no callers require graceful deprecation).

---

## Risk assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Broken UI link | Low | Link removed |
| Ops runbook uses debug | Low | Document in this file + historical `XERO_BACKFILL_FIX.md` |
| Normal Xero sync | None | `confirmPayment` xero upsert + queue processor unchanged |
| Backfill cross-tenant | Unchanged | Documented; not introduced by B1 |

---

## Success criteria mapping

| Criterion | How verified |
|-----------|----------------|
| No merchant global Xero/payment/event diagnostics | Route deleted |
| No UI path to debug | Link removed + test |
| Stats/failed sync still work | Tests assert route files exist; manual/org APIs unchanged |

---

## Implementation status (completed)

| Change | File |
|--------|------|
| Deleted debug route | `src/app/api/xero/debug/route.ts` (removed) |
| Removed UI link | `src/components/dashboard/settings/xero-sync-queue.tsx` |
| Tests | `src/__tests__/xero/xero-debug-removed.test.ts` (4 passing) |

`GET /api/xero/debug` returns **404** in deployments (no route registered). Backfill global exposure **unchanged** — see Step 4.

# B3 Deployment Gap Analysis

**Date:** 2026-06-04  
**Compared to:** Pre-B3 `render.yaml` (web-only Phase 1)

---

## Pre-B3 state

| Component | Status | Gap |
|-----------|--------|-----|
| `provvypay-api` (web) | **Enabled** | Healthy — serves jobs when HTTP-called |
| `provvypay-worker` | **Disabled** (commented) | No long-running worker |
| `provvypay-cron-fx` | **Disabled** | Referenced `npm run cron:fx-rates` → **file missing** |
| `provvypay-cron-reconcile` | **Disabled** | Referenced `npm run cron:reconcile` → **file missing** |
| HTTP `/api/jobs/*` | **Implemented** | Never called without external scheduler |
| `CRON_SECRET` enforcement | **Partial** | Xero `queue/process` allowed unauthenticated POST when `CRON_SECRET` unset |
| Vercel `vercel.json` crons | **Not present** | Render is source of truth |

**Risk:** Repair and reconciliation code existed but **did not run** in production unless an operator manually curled endpoints.

---

## Post-B3 state

| Component | Status | Notes |
|-----------|--------|-------|
| Web service | **Unchanged** | `healthCheckPath: /api/health` preserved |
| Worker | **Still disabled** | B3 constraint: no worker redesign |
| Render cron services | **8 enabled** | Each runs `node scripts/render-cron-invoke.mjs <target>` |
| Job invoke script | **Added** | `src/scripts/render-cron-invoke.mjs` |
| Shared cron auth | **Added** | `src/lib/jobs/cron-request-auth.ts`; Xero queue hardened |
| `npm run cron:invoke` | **Added** | Manual: `npm run cron:invoke -- expired-links` |

---

## Render cron schedule map (B3)

| Render service | Schedule | Target |
|----------------|----------|--------|
| `provvypay-cron-expired-links` | `*/5 * * * *` | expired-links |
| `provvypay-cron-recurring-templates` | `*/5 * * * *` | recurring-templates |
| `provvypay-cron-xero-queue` | `*/5 * * * *` | xero-queue |
| `provvypay-cron-stuck-payments` | `*/15 * * * *` | stuck-payments |
| `provvypay-cron-stripe-reconciliation` | `*/10 * * * *` | stripe-reconciliation |
| `provvypay-cron-ledger-integrity` | `0 */6 * * *` | ledger-integrity |
| `provvypay-cron-system-integrity` | `0 */4 * * *` | system-integrity |
| `provvypay-cron-monitoring-alerts` | `0 * * * *` | monitoring-alerts |

Cron containers need from `provvypay-production` env group:

- `CRON_SECRET` (required)
- `NEXT_PUBLIC_APP_URL` or `CRON_BASE_URL` (public HTTPS URL of `provvypay-api`)

---

## Duplicate execution paths — assessment

| Concern | Mitigation |
|---------|------------|
| Cron + manual UI both drain Xero | **OK** — `process-now` for operators; cron for automation; same `processQueue` |
| Overlapping cron ticks | **OK** — `operational_job_leases` on stripe-reconciliation, ledger-integrity, system-integrity |
| Separate worker queue | **Not introduced** — B3 constraint |
| Legacy `cron:fx-rates` / `cron:reconcile` | **Not enabled** — scripts absent; HTTP jobs used instead |

---

## Still missing (out of B3 scope)

| Item | Why deferred |
|------|----------------|
| Dedicated worker process | Constraint: no worker redesign |
| FX hourly cron script | No `cron/fx-rates.js`; FX warmed on API traffic |
| `launch-financial-verification` schedule | LOW criticality; on-demand only |
| Org-scoped Xero backfill | Separate remediation (backfill endpoint) |
| External paging (Sentry/PagerDuty) | Observability H1 — not B3 |

---

## Operator actions after deploy

1. Set `CRON_SECRET` in `provvypay-production` (≥ 32 random bytes).
2. Confirm `NEXT_PUBLIC_APP_URL` matches live `provvypay-api` URL (or set `CRON_BASE_URL`).
3. Apply Render blueprint — verify 8 cron services show last run success.
4. Run `node scripts/validate-render-env.js` locally with production env export (includes `CRON_SECRET` check).

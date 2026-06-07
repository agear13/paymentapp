# B3 Job Inventory

**Date:** 2026-06-04  
**Scope:** Scheduled and operator-triggered background work for production reconciliation, repair, settlement support, accounting, and monitoring.

---

## HTTP job routes (`/api/jobs/*`)

| Job | Endpoint | Method | Auth | Purpose | Recommended schedule | Criticality | Dependencies |
|-----|----------|--------|------|---------|----------------------|-------------|--------------|
| Expired links | `/api/jobs/expired-links` | POST | `X-Cron-Secret` | Transition past-due `OPEN` links to `EXPIRED` | `*/5 * * * *` | **HIGH** | Prisma, state machine, `executeJob` |
| Recurring templates | `/api/jobs/recurring-templates` | POST | `X-Cron-Secret` | Generate payment links from due recurring templates | `*/5 * * * *` | **MEDIUM** | Prisma, recurring template processor |
| Stuck payments | `/api/jobs/stuck-payments` | POST | `X-Cron-Secret` | Detect links stuck in `OPEN` with payment activity | `*/15 * * * *` | **CRITICAL** | `checkStuckPaymentLinks`, job scheduler |
| Stripe reconciliation | `/api/jobs/stripe-reconciliation` | POST | `X-Cron-Secret` | Replay missed Stripe successes via `confirmPayment` | `*/10 * * * *` | **CRITICAL** | Stripe API, `confirmPayment`, job lease |
| Ledger integrity | `/api/jobs/ledger-integrity` | POST | `X-Cron-Secret` | Validate ledger invariants on recent `PAYMENT_CONFIRMED` | `0 */6 * * *` | **CRITICAL** | `validateLedgerInvariant`, job lease |

All `/api/jobs/*` routes return **503** if `CRON_SECRET` is unset and **401** on bad secret. Several support GET for status/history (same auth).

---

## Accounting queue

| Job | Endpoint | Method | Auth | Purpose | Recommended schedule | Criticality | Dependencies |
|-----|----------|--------|------|---------|----------------------|-------------|--------------|
| Xero queue drain | `/api/xero/queue/process` | POST | `Bearer CRON_SECRET` or `X-Cron-Secret` | Process pending `xero_syncs` rows | `*/5 * * * *` | **CRITICAL** (if Xero on) | `processQueue`, `ENABLE_XERO_SYNC` / feature flags |
| Xero process now | `/api/xero/queue/process-now` | POST/GET | Admin or `CRON_SECRET` | Manual drain (dashboard) | On-demand | **HIGH** | Same processor — **not** a duplicate cron path |
| Xero backfill | `/api/xero/queue/backfill` | POST | Session auth only | Queue PAID links missing sync | On-demand | **MEDIUM** | Global scan — out of B3 scope |

---

## Integrity & monitoring

| Job | Endpoint | Method | Auth | Purpose | Recommended schedule | Criticality | Dependencies |
|-----|----------|--------|------|---------|----------------------|-------------|--------------|
| System integrity | `/api/internal/system-integrity` | GET | `Bearer CRON_SECRET` or admin | Settlement/ledger/Xero/reconciliation scans | `0 */4 * * *` | **CRITICAL** | `runIntegrityChecks`, job lease |
| Monitoring alerts | `/api/monitoring/alerts` | POST | `Bearer CRON_SECRET` or admin | Evaluate alert rules platform-wide | `0 * * * *` | **HIGH** | `evaluateAllAlerts` |
| Launch financial verification | `/api/internal/launch-financial-verification` | GET | `Bearer CRON_SECRET` or admin | Read-only integrity + matrix snapshot | On-demand | **LOW** | No writes |

---

## Not cron-scheduled (documented)

| Capability | Endpoint / module | Criticality | Notes |
|------------|-------------------|-------------|-------|
| Hedera transaction poll | `POST /api/hedera/transactions/monitor` | **HIGH** | Payer/session-driven single check, not batch cron |
| Hedera manual verify | `POST /api/hedera/transactions/verify` | **HIGH** | Operator-triggered; separate from checker `confirmPayment` path (R4) |
| Stripe webhooks | `POST /api/stripe/webhook` | **CRITICAL** | Event-driven settlement — unchanged by B3 |
| FX rate cache | `lib/fx/rate-cache.ts` | **MEDIUM** | In-process refresh on API use; no standalone cron file in repo |
| Data repair utilities | `lib/data/repair-utilities.ts` | **MEDIUM** | Manual/ops scripts; can promote `PAID` without `confirmPayment` (R11) |

---

## Legacy / missing scripts (not scheduled by B3)

| Reference | Status |
|-----------|--------|
| `npm run cron:fx-rates` → `cron/fx-rates.js` | **Missing file** — not enabled |
| `npm run cron:reconcile` → `cron/reconciliation.js` | **Missing file** — superseded by `/api/jobs/stripe-reconciliation` |
| `npm run worker` → `workers/index.js` | **Missing file** — worker not used |

---

## B3 Render cron targets

`src/scripts/render-cron-invoke.mjs` maps one Render cron service per target:

| Target key | Invokes |
|------------|---------|
| `expired-links` | POST `/api/jobs/expired-links` |
| `recurring-templates` | POST `/api/jobs/recurring-templates` |
| `xero-queue` | POST `/api/xero/queue/process?batchSize=10` |
| `stuck-payments` | POST `/api/jobs/stuck-payments` |
| `stripe-reconciliation` | POST `/api/jobs/stripe-reconciliation` |
| `ledger-integrity` | POST `/api/jobs/ledger-integrity` |
| `system-integrity` | GET `/api/internal/system-integrity` |
| `monitoring-alerts` | POST `/api/monitoring/alerts` |

---

## Criticality summary

| Tier | Jobs |
|------|------|
| **CRITICAL** | stuck-payments, stripe-reconciliation, ledger-integrity, system-integrity, xero-queue (when Xero enabled) |
| **HIGH** | expired-links, monitoring-alerts |
| **MEDIUM** | recurring-templates, xero backfill (manual), FX on-demand |
| **LOW** | launch-financial-verification |

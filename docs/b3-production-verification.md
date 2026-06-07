# B3 Production Verification

**Date:** 2026-06-04  
**Purpose:** Confirm critical jobs are scheduled, secured, and runnable after B3 deploy.

---

## Jobs that will execute (post-deploy)

Assuming Render blueprint applied and env group configured:

| Job | Render cron service | Schedule (UTC) | HTTP call |
|-----|---------------------|----------------|-----------|
| Expired links | `provvypay-cron-expired-links` | Every 5 min | `POST /api/jobs/expired-links` |
| Recurring templates | `provvypay-cron-recurring-templates` | Every 5 min | `POST /api/jobs/recurring-templates` |
| Xero queue | `provvypay-cron-xero-queue` | Every 5 min | `POST /api/xero/queue/process?batchSize=10` |
| Stuck payments | `provvypay-cron-stuck-payments` | Every 15 min | `POST /api/jobs/stuck-payments` |
| Stripe reconciliation | `provvypay-cron-stripe-reconciliation` | Every 10 min | `POST /api/jobs/stripe-reconciliation` |
| Ledger integrity | `provvypay-cron-ledger-integrity` | Every 6 hours | `POST /api/jobs/ledger-integrity` |
| System integrity | `provvypay-cron-system-integrity` | Every 4 hours | `GET /api/internal/system-integrity` |
| Monitoring alerts | `provvypay-cron-monitoring-alerts` | Hourly | `POST /api/monitoring/alerts` |

Invoke chain: **Render cron** → `render-cron-invoke.mjs` → **HTTPS** → **provvypay-api** → existing route handlers.

---

## Security controls

| Control | Behavior |
|---------|----------|
| `CRON_SECRET` required | `/api/jobs/*` return **503** if unset; Xero `queue/process` same via `verifyCronRequest` |
| Unauthorized rejected | Wrong/missing secret → **401** |
| Header formats | `X-Cron-Secret: <secret>` or `Authorization: Bearer <secret>` |
| Cron containers | Hold secret; never expose in logs (invoke script logs status only) |
| Web health | Unchanged — `/api/health` public, no cron secret |
| Admin override | `process-now`, `monitoring/alerts` POST, integrity routes still allow global admin when cron auth fails |
| Lease anti-overlap | stripe-reconciliation, ledger-integrity, system-integrity skip when lease active |

---

## Monitoring coverage

| Signal | Source |
|--------|--------|
| Cron run success/fail | Render dashboard per cron service |
| Job execution logs | Pino `loggers.jobs` on API service |
| Stuck payment findings | stuck-payments job result payload |
| Integrity anomalies | system-integrity JSON response |
| Alert evaluation | monitoring-alerts POST result |
| Xero backlog | xero-queue stats + `xero_syncs` table |
| Lease contention | `skipped: true, reason: lease_active` in job responses |

**Gap (unchanged):** No automated PagerDuty/Sentry alert wiring — cron failure visible in Render logs only.

---

## Pre-flight checklist

- [ ] `CRON_SECRET` set in `provvypay-production`
- [ ] `NEXT_PUBLIC_APP_URL` (or `CRON_BASE_URL`) is HTTPS and reachable from Render cron network
- [ ] Blueprint deploy shows 1 web + 8 cron services
- [ ] Manual smoke: `cd src && npm run cron:invoke -- expired-links` (from machine with env)
- [ ] Unauthorized curl returns 401:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$APP_URL/api/jobs/expired-links" \
  -H "X-Cron-Secret: wrong"
# expect 401
```

- [ ] Authorized curl returns 2xx (with real secret):

```bash
curl -s -X POST "$APP_URL/api/jobs/expired-links" \
  -H "X-Cron-Secret: $CRON_SECRET"
```

---

## Automated tests (CI)

| Test file | Covers |
|-----------|--------|
| `src/__tests__/jobs/cron-auth.test.ts` | 503/401/accept header + bearer |
| `src/__tests__/jobs/b3-render-cron.test.ts` | Registry, render.yaml crons, Xero hardening, Stripe unchanged |

Run:

```bash
cd src && npx jest __tests__/jobs/ --no-cache
```

---

## Payment flows — regression assertion

B3 does **not** modify:

- `confirmPayment` / settlement math
- Stripe webhook handler
- Payment link state machine transitions from payer flows

Contract test asserts Stripe webhook still calls `confirmPayment({ provider: 'stripe' })`.

---

## Success criteria mapping

| Criterion | Status |
|-----------|--------|
| Critical jobs scheduled | **Yes** — 8 Render cron services |
| CRON_SECRET enforced | **Yes** — jobs + hardened Xero process |
| Health checks preserved | **Yes** — web `healthCheckPath` unchanged |
| No duplicate worker queue | **Yes** — HTTP-only invoke path |
| Capable of running in production | **Yes** — after env + blueprint apply |

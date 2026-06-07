# Pre-Launch Operational Checklist

**Date:** 2026-06-04  
**Purpose:** Validate implemented architecture before controlled GA (10–20 merchants).  
**Assumed complete:** B1, B3, B5, R1, R2, R3, R4, R5, Xero backfill authorization.

---

## Phase 1 — Payment rail matrix (code validation)

All invoice settlement paths below converge on `confirmPayment()` in `src/lib/services/payment-confirmation.ts`, which atomically creates `PAYMENT_CONFIRMED`, posts ledger (in txn), upserts `xero_syncs` (if enabled), then post-commit: referral conversion, commission (`applyRevenueShareSplits` or R5 reconcile on replay), funding (`orchestrateFundingAfterInvoiceSettlement`).

| Rail | Entry → `confirmPayment` | Pre-settlement state | Provider / idempotency |
|------|--------------------------|----------------------|-------------------------|
| **Stripe** | Webhook `payment_intent.succeeded` / `checkout.session.completed` | `OPEN` | `provider: stripe`, `providerRef: event.id` |
| **Stripe recovery** | Cron `stripe-reconciliation` → job route | `OPEN` (typical) | Same via `confirmPayment` |
| **Wise** | `POST /api/webhooks/wise` funded transfer | `OPEN` | `provider: wise`, transfer id |
| **Hedera confirm** | `POST /api/hedera/confirm` | `OPEN` | `provider: hedera`, normalized tx id |
| **Hedera monitor** | `POST /api/hedera/transactions/monitor` → `transaction-checker` | `OPEN` (early exit if already PAID) | `provider: hedera` |
| **Hedera verify** | `POST /api/hedera/transactions/verify` → `executeHederaMirrorSettlement` (R4) | `OPEN` (+ entry states per state machine) | `provider: hedera`, `manuallyVerified` metadata |
| **Manual settlement (R1)** | `POST /api/payment-links/[id]/manual-settlement` → `executeOperatorManualInvoiceSettlement` | `OPEN` only | `provider: manual`, `manual-settlement:{linkId}` |
| **Bank review (R3)** | `POST .../manual-bank-confirmations/[id]/review` `mark_valid` | `PAID_UNVERIFIED` / `REQUIRES_REVIEW` / PAID backfill | `provider: manual`, `bank-review:{confirmationId}` |
| **Crypto review (R3)** | `POST .../crypto-confirmations/[id]/review` `mark_valid` | Same | `provider: manual`, `crypto-review:{confirmationId}` |

**Blocked paths (validated):**

| Path | Guard |
|------|--------|
| Status API → PAID (R2) | `payment-link-status-api-policy.ts` → 409 |
| Global Xero backfill | Org-scoped + `manage_settings`; global admin-only |

**Out of scope (not invoice GA rails):** payout `mark-paid`, legacy `confirmHederaPayment` (no HTTP route), `repair-utilities` STATUS_MISMATCH → PAID without event.

### Downstream chain (all canonical rails)

```text
Invoice (OPEN)
  → Payment evidence (webhook / mirror / operator)
  → confirmPayment()
      → PAID + PAYMENT_CONFIRMED + FX snapshot + ledger (txn)
      → xero_syncs PENDING upsert (txn, if feature on)
  → Post-commit: referral conversion
  → Commission: applyRevenueShareSplits (new) OR reconcile (replay, R5)
  → Funding: orchestrateFundingAfterInvoiceSettlement
  → Xero: B3 cron processes queue → Xero API
```

### Assisted flows (payment before settlement)

| Flow | Before `confirmPayment` | Settlement trigger |
|------|-------------------------|-------------------|
| Manual bank payer submit | `PAID_UNVERIFIED` or `REQUIRES_REVIEW` | Merchant `mark_valid` (R3) |
| Crypto payer submit | Same pattern | Merchant `mark_valid` (R3) |

---

## Phase 2 — Operational validation

| Area | Status in code | Pre-launch verify in prod |
|------|----------------|---------------------------|
| **Cron scheduled** | `render.yaml` — 8 cron services | Render dashboard: all crons **Active**, last run success |
| **CRON_SECRET** | B5 `assertProductionEnvGuards`; job routes 401 without secret | Env group has secret ≥16 chars; test one cron invoke |
| **Cron invoke map** | `render-cron-invoke.mjs` → 8 targets | Match blueprint to live services |
| **Health check** | `GET /api/health` (shallow default); deep if `HEALTHCHECK_DEEP=1` | Render health check path `/api/health` returns 200 |
| **Xero queue** | Cron `xero-queue` → `POST /api/xero/queue/process` + `verifyCronRequest` | Pending `xero_syncs` drain after test payment |
| **Stripe reconciliation** | Cron every 10m → `/api/jobs/stripe-reconciliation` | Logs show idempotent skips / confirms |
| **Ledger integrity** | Cron every 6h → `/api/jobs/ledger-integrity` | No sustained `violations` in response |
| **System integrity** | Cron every 4h → `GET /api/internal/system-integrity` | Bearer auth works |
| **Monitoring alerts** | Cron hourly → `/api/monitoring/alerts` | Alerts channel configured |
| **Commission repair job** | **No dedicated cron** — R5 runs on `confirmPayment` replay only | Ops: use reconcile script/API for historical gaps |
| **Launch financial snapshot** | `GET /api/internal/launch-financial-verification` (cron secret or admin) | Run once pre-launch; review `PAID_WITHOUT_PAYMENT_CONFIRMED` count |

### Operational gaps (documented, not blockers for controlled GA)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No nightly commission backfill cron | Historical / first-run B4′ gaps persist until manual reconcile | Pre-launch SQL + R5 reconcile runbook |
| Shallow health check by default | DB outage may not fail Render health until deep mode | Set `HEALTHCHECK_DEEP=1` for production if desired |
| Mixed cron auth (`X-Cron-Secret` vs Bearer) | Misconfigured secret breaks subset of jobs | Use `render-cron-invoke.mjs` only (already wired) |
| `BETA_LOCKDOWN_MODE` default on | Partner payout APIs admin-only | Document in merchant onboarding |

---

## Required before launch

- [ ] Production env: B5 guards pass on deploy (`STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, live Stripe keys or explicit staging flag)
- [ ] `ADMIN_EMAIL_ALLOWLIST` set; admin access tested
- [ ] All 8 Render cron jobs enabled and succeeding (see `render.yaml`)
- [ ] Stripe webhook endpoint live + signing secret matches env
- [ ] Wise webhook configured (if Wise GA for cohort)
- [ ] Hedera network matches merchant config (testnet vs mainnet)
- [ ] Xero OAuth connected for pilot orgs; `xeroSync` feature flag understood
- [ ] Run `GET /api/internal/launch-financial-verification` (admin or cron secret) — **zero** `PAID_WITHOUT_PAYMENT_CONFIRMED` for pilot orgs (or documented repair plan)
- [ ] Execute [production-smoke-test-plan.md](./production-smoke-test-plan.md) for each rail in scope
- [ ] Confirm backfill: org-scoped only from settings UI (`manage_settings`)

---

## Recommended before launch

- [ ] Historical R5 reconcile for pre-R4 Hedera `manuallyVerified` events (see `r4-historical-impact-analysis.md`)
- [ ] Pre-R3 bank/crypto `mark_valid` rows: `executeAssistedReviewSettlement` or `confirmPayment` backfill per `r3-historical-impact.md`
- [ ] Set `HEALTHCHECK_DEEP=1` on web service
- [ ] Document ops ban on `repair-utilities` STATUS_MISMATCH → PAID without `confirmPayment`
- [ ] Pilot deal UI: warn operators that deal “Paid” may differ from ledger (R8) until refreshed from events
- [ ] Track `typecheck:repo` error count; do not claim B2 closed

---

## Post-launch monitoring (first 2 weeks)

| Signal | Where | Action threshold |
|--------|-------|------------------|
| `PAID_WITHOUT_PAYMENT_CONFIRMED` | `launch-financial-verification` / integrity job | Any new row → P1 investigate |
| Ledger violations | `ledger-integrity` cron JSON | Any violation → finance + eng |
| Xero FAILED retry_count > 3 | `integrity-checks` / dashboard | Per-org reconnect or manual sync |
| Stripe stuck OPEN > 30m | `integrity-checks` | Reconciliation cron should heal |
| `commission_apply` errors | App logs `Revenue share failed` | R5 reconcile by `payment_event_id` |
| Cron 401 / 503 | Render cron logs | `CRON_SECRET` rotation mismatch |
| Webhook duplicate rate | Stripe dashboard | Should be safe (idempotent); monitor confirmPayment duration |

---

## Launch decision (summary)

See [launch-risk-review.md](./launch-risk-review.md) — **Launch after checklist completion** (controlled GA).

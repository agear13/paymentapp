# Failure Scenario Review — Provvypay

**Audit date:** 2026-05-20  
For each scenario: current behaviour, recovery path, operational risk, recommendation.

---

## 1. Stripe Outage

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Checkout/PI creation fails at Stripe API; webhooks may delay; in-flight payments may complete when Stripe recovers |
| **Recovery** | Retry customer checkout; `stripe-reconciliation` job compares Stripe vs DB when run |
| **Operational risk** | HIGH — no payments until Stripe up; queued webhooks may arrive in burst |
| **Recommendation** | Status page communication; enable reconciliation cron post-outage; monitor `webhook_events` backlog |

---

## 2. Webhook Failures (Signature / 5xx)

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Invalid signature → 401; handler exception → likely 5xx → Stripe retries; audit row tracks state |
| **Recovery** | Stripe automatic retries; manual replay via `/api/internal/webhooks/stripe/replay` (admin/token) |
| **Operational risk** | HIGH if prolonged — payment confirmed at Stripe but not in DB |
| **Recommendation** | Alert on webhook 5xx; run reconciliation job; use admin commission trace for single-PI diagnosis |

---

## 3. Duplicate Webhooks

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | `recordStripeWebhookReceived` detects duplicate → 200 `{ duplicate: true }`, handlers skipped |
| **Recovery** | None needed — idempotent |
| **Operational risk** | LOW for payment; **MEDIUM** for commission items if first run partial-failed before obligation commit |
| **Recommendation** | Fix W-A3 (obligation items on replay); add integrity check: ledger without items |

---

## 4. Failed Accounting Sync (Xero)

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Rows in `xero_syncs` with failure status; queue processor routes for retry/replay |
| **Recovery** | `xero/sync/replay`, `queue/process`, `sync/failed` admin flows |
| **Operational risk** | HIGH if jobs not scheduled — books diverge from platform |
| **Recommendation** | Enable scheduled `xero/queue/process`; dashboard for FAILED count; do not use `xero/debug` in prod |

---

## 5. Worker Crashes

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | **No separate worker** — background work is HTTP handlers on web service or not run |
| **Recovery** | Re-hit `/api/jobs/*` with CRON_SECRET |
| **Operational risk** | CRITICAL if cron not configured — silent failure |
| **Recommendation** | Enable Render cron or worker Phase 2; job lease prevents duplicate concurrent runs when retried |

---

## 6. API Failures (Application 5xx)

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Route-level try/catch; obligations route returns empty degraded payload in some paths |
| **Recovery** | User retry; check Render logs / Sentry |
| **Operational risk** | MEDIUM — obligations 502 was gateway timeout (mitigated serialization); still possible under load |
| **Recommendation** | Increase starter plan or add caching for heavy obligation queries; keep per-row try/catch |

---

## 7. Database Outage

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | `/api/health` fails; Prisma errors propagate; middleware/pages error |
| **Recovery** | Render Postgres restart/failover; no app-level queue for writes |
| **Operational risk** | CRITICAL — full platform down |
| **Recommendation** | Render DB backups verified; RTO/RPO documented; read-only maintenance page |

---

## 8. Partial Settlement Failures

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Payout batch submit/mark-paid/failed per payout; Hedera paths optional |
| **Recovery** | Manual mark-failed / retry batch; integrity checks |
| **Operational risk** | HIGH under beta — limited operators; batch may be half-submitted |
| **Recommendation** | Transactional batch state machine audit; admin view for batch in `SUBMITTING` stuck state |

---

## 9. Commission Posting Partial Failure

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | `applyRevenueShareSplits` best-effort; ledger may post; obligation/items may not |
| **Recovery** | Admin `commission-propagation-trace`; replay ledger script paths |
| **Operational risk** | HIGH — operator sees earnings mismatch |
| **Recommendation** | P0 fix idempotent item creation; nightly reconciliation job: ledger partner payable vs obligation items |

---

## 10. Payment Lock Stuck

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | `acquirePaymentLock` / `releasePaymentLock` in edge-case-handler |
| **Recovery** | `stuck-payments` job |
| **Operational risk** | MEDIUM |
| **Recommendation** | Alert if lock held > N minutes; document lock TTL in runbook |

---

## 11. ENV Misconfiguration at Deploy

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Runtime `validateEnv()` throws on missing vars — **unless** build/test relax paths |
| **Recovery** | Fix Render env group; redeploy |
| **Operational risk** | HIGH — instant 500 on boot |
| **Recommendation** | Pre-deploy `validate-env` script in CI against production variable **names** (not values) |

---

## 12. BETA_LOCKDOWN_MODE / Feature Flag Confusion

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Settlement APIs return lockdown response for non-beta admins |
| **Recovery** | Set env + redeploy (explicit business decision) |
| **Operational risk** | MEDIUM — support tickets, not data loss |
| **Recommendation** | Launch checklist item: document which features need `BETA_LOCKDOWN_MODE=false` |

---

## 13. R2 / Storage Unavailable

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Upload failures; `STORAGE_ALLOW_LOCAL_FALLBACK` optional locally |
| **Recovery** | Retry upload; use local fallback only dev |
| **Operational risk** | MEDIUM — payments may work without attachment |
| **Recommendation** | Fail attachment gracefully on create link; monitor R2 error rate |

---

## 14. Anthropic / AI Extractor Down

| Aspect | Detail |
|--------|--------|
| **Current behaviour** | Extract API errors; manual onboarding still available |
| **Recovery** | Retry extract |
| **Operational risk** | LOW for payments — HIGH for AI-first onboarding UX |
| **Recommendation** | Circuit breaker + user message; do not block payment link creation |

---

## Recovery Runbook Index

| Symptom | First action |
|---------|--------------|
| PI paid, no ledger | Stripe dashboard + webhook_events + replay |
| Ledger, no attribution UI | `commission-propagation-trace` + items backfill |
| Xero mismatch | `xero/sync/failed` + queue process |
| Obligations empty | Check obligations API logs; refresh pilot obligations |
| Jobs not running | Verify CRON_SECRET + external scheduler URLs |

---

## Overall Resilience Score (Estimate)

**55 / 100** — strong Stripe webhook idempotency; weak background job independence and commission/obligation reconciliation.

# Observability & Operational Readiness Audit — Provvypay

**Audit date:** 2026-05-20  
**Deployment:** Render `provvypay-api` (Oregon), Postgres `provvypay-db`, Phase 1 (web only).

---

## Logging

| Component | Implementation | Coverage |
|-----------|----------------|----------|
| Application logs | Pino (`lib/logger.ts`) | Structured JSON in production |
| Domain loggers | `loggers.api`, webhook modules | API + webhook paths |
| Stripe audit | `lib/webhooks/stripe-audit.ts` | Received / processing / outcome per event |
| Operational API phases | `logOperationalApiRoutePhase` | Coordination + obligations timing |
| Ad-hoc diagnostics | `[ATTRIBUTION_*]`, `[PARTICIPANT_EARNINGS_FAILURE]` console | **Remove or gate before GA** |

### Gaps

- No documented **log retention** or Render log drain to SIEM.
- `TEST_MODE ACTIVE` printed on every cold start from `env.ts` — pollutes logs.
- Correlation IDs exist for Stripe (`generateCorrelationId`) — **not verified** on all API routes.

---

## Monitoring & Alerting

| Capability | Status |
|------------|--------|
| Sentry (`@sentry/nextjs`) | **Optional** — only if `SENTRY_DSN` set |
| Render health check | `GET /api/health` — DB connectivity |
| Metrics API | `GET /api/metrics` — admin-oriented |
| Monitoring dashboard page | `dashboard/monitoring` |
| Webhook monitoring | DB table `webhook_events` + audit helpers |
| Payment monitoring | `payment_events`, integrity job |
| Background job monitoring | `operational_job_leases` — lease-based |

### Critical alerts (recommended — not all implemented)

| Alert | Trigger | Priority |
|-------|---------|----------|
| Stripe webhook error rate | 5xx on `/api/stripe/webhook` or `markStripeWebhookOutcome` failures | P0 |
| Webhook processing disabled | `STRIPE_WEBHOOK_SECRET=disabled` | P0 |
| Payment confirmation stall | `stuck-payments` job findings > 0 | P0 |
| Ledger imbalance | `ledger-integrity` job / `system-integrity` | P0 |
| Xero sync backlog | `xero_syncs` FAILED count threshold | P1 |
| Job lease stuck | lease not released > TTL | P1 |
| 5xx rate on obligations API | `[PARTICIPANT_EARNINGS_FAILURE]` spike | P1 |
| Health check failing | Render auto-restart — still need paging | P0 |
| CRON_SECRET missing | jobs return 503 | P1 |

---

## Tracing

| Area | Status |
|------|--------|
| Distributed tracing | **Not present** (no OpenTelemetry) |
| Stripe correlation IDs | **Partial** |
| Request ID middleware | **UNKNOWN** |

---

## Error Handling

| Pattern | Assessment |
|---------|------------|
| API routes try/catch + JSON errors | Common |
| Obligations API degraded 200 | Good UX; may **mask** failures in monitoring |
| Public pay | User-facing error states on pages |
| Webhook fail | Returns non-2xx for signature failure; duplicate returns 200 |

---

## Health Checks

| Endpoint | Checks |
|----------|--------|
| `/api/health` | App + DB (Prisma) |
| `/api/fx/health` | FX subsystem |
| `/api/build-info` | Deploy version |

**Load test note (`SECURITY_AND_SCALE.md`):** Health failed under 1000 concurrent users when DB auth failed — capacity planning incomplete.

---

## Background Job Operations

| Job | Trigger | Monitoring |
|-----|---------|------------|
| `expired-links` | HTTP + CRON_SECRET | Manual |
| `stripe-reconciliation` | HTTP + CRON_SECRET | Manual |
| `ledger-integrity` | HTTP + CRON_SECRET | Manual |
| `stuck-payments` | HTTP + CRON_SECRET | Manual |
| `recurring-templates` | HTTP + CRON_SECRET | Manual |
| Xero queue process | API / manual | `xero/sync/stats` |

**Blind spot:** Render worker/cron **disabled** — if external scheduler not configured, **no jobs run**.

---

## Founder Visibility (Recommended Dashboards)

1. **Payments today** — count/GMV from `payment_events` + failed webhooks  
2. **Webhook backlog** — unprocessed `webhook_events`  
3. **Commission propagation health** — obligations without items (admin trace aggregate)  
4. **Xero sync failures** — last 24h FAILED  
5. **Stuck payments** — output of stuck-payments job  
6. **Deploy version** — `build-info` vs Render commit  

---

## Sentry Coverage

| Surface | Expected |
|---------|----------|
| Next.js app router | Auto via SDK |
| API routes | Uncaught exceptions |
| Webhook handlers | Should capture handler failures |

**Gap:** Optional DSN — production may run **without** error aggregation.

---

## Pino Coverage

| Surface | Expected |
|---------|----------|
| Server APIs using `log` / `loggers` | Yes |
| Client-side | Browser console only |

---

## Launch Monitoring Requirements

Minimum for public launch week:

1. Sentry (or equivalent) **required** in production env.  
2. Pager/email on health check failure + Stripe webhook 5xx.  
3. Daily cron: `stripe-reconciliation`, `ledger-integrity`, `stuck-payments`.  
4. Runbook links in `docs/production-readiness/failure-scenario-review.md`.  
5. Strip `[ATTRIBUTION_RUNTIME_DIAG]` and debug `console.info` from hot paths.  

---

## Production Blind Spots

| Blind spot | Impact |
|------------|--------|
| No worker process | Xero queue + reconciliation depend on HTTP cron |
| Degraded 200 on obligations | Operators see empty state, not alert |
| 698 TS errors shipped | Runtime type failures undetected at build |
| No full-route authz CI | Tenant bugs reach prod |
| E2E suite flaky | Regressions caught late |
| Load test invalid | Unknown real RPS capacity |

---

## Operational Readiness Score (Estimate)

**52 / 100** — logging foundation exists; alerting, job scheduling, and error aggregation not launch-grade without configuration work.

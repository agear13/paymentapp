# SECURITY_AND_SCALE Report

Date: 2026-06-08  
Scope: OWASP Top 10 review, scalability architecture, load testing, Playwright E2E

## Executive Status

| Area | Status |
|---|---|
| 1,000 concurrent users (single instance) | **Not production-ready** without horizontal scale + edge protection |
| Code-level scale optimizations | **Applied** (see §1) |
| OWASP Top 10 | **PARTIAL** across categories — controls exist; gaps documented in §2 |
| Playwright critical flows | **5/5 passing** after auth navigation retry fix (§3) |
| TypeScript strict build | Still bypassed (`typescript.ignoreBuildErrors: true`) |

## 1) Scalability

### 1.1 Architecture (required for thousands of concurrent users)

A single Render Starter web instance (`minInstances: 1`) cannot sustain 1,000 simultaneous connections. Valid production path:

1. **Edge / WAF** — rate-limit and absorb scanners before origin (Cloudflare, Render edge rules).
2. **Horizontal web tier** — `minInstances ≥ 2`, autoscale on CPU/memory; sticky sessions not required (stateless APIs).
3. **Pooled Postgres** — `DATABASE_URL` via PgBouncer/Neon pooler; `PRISMA_CONNECTION_LIMIT` per instance (e.g. `10`).
4. **Redis** — Upstash for rate limits; fail-open with short timeout (already in `src/lib/rate-limit.ts`).
5. **Worker tier** — move Stripe webhooks, Xero sync, notifications off the request thread (queue + fast ACK).
6. **Shallow health** — `/api/health` skips DB by default; set `HEALTHCHECK_DEEP=1` only for orchestrator deep checks.

### 1.2 Code optimizations (this pass)

| Change | File | Effect |
|---|---|---|
| Prisma singleton in production + optional `PRISMA_CONNECTION_LIMIT` | `src/lib/server/prisma.ts` | Fewer connections; no dev query-counter overhead in prod |
| Lazy Prisma on deep health only | `src/app/api/health/route.ts` | Shallow health avoids DB module init |
| Shared negative cache for unknown short codes | `src/lib/cache/public-negative-cache.ts` | Cuts DB/Redis on repeated 404 bursts |
| Single-query merchant lookup | `src/app/api/public/merchant/[shortCode]/route.ts` | 2 round-trips → 1 |
| Negative cache on pay + wise routes | `src/app/api/public/pay/**` | Aligns hot miss paths |

### 1.3 Load test results (reference)

**Invalid benchmark target:** `next dev` at 1,000 concurrency — ~90%+ transport failures (connection resets/timeouts), not representative of production.

**Valid benchmark target:** `NODE_ENV=production npm run build && next start` at 1,000 concurrency, 30s:

- Aggregate failure rate ~92% on a **single** Node process
- `/api/health` (shallow) — only path with meaningful successful RPS under extreme load
- DB-backed public routes — dominated by connection pool + single-process limits

Re-run after deploying multi-instance + pooler; expect order-of-magnitude improvement on successful RPS, not from route micro-optimizations alone.

Commands:

```bash
cd src
NODE_ENV=production npm run build
PORT=3456 RELAX_ENV_VALIDATION=1 npm run start
LOAD_TEST_BASE_URL=http://127.0.0.1:3456 LOAD_TEST_CONCURRENCY=1000 npm run load:test
```

Stepped per-route harness: `tsx scripts/route-load-stepped.ts`

## 2) OWASP Top 10 Matrix (2021)

| Category | Status | Key controls | Remaining work |
|---|---|---|---|
| A01 Broken Access Control | PARTIAL | Org membership checks, RBAC, owner/admin gates on org PATCH | Route-level auth regression suite |
| A02 Cryptographic Failures | PARTIAL | `crypto.randomBytes` for tokens; timing-safe internal compare | Key rotation policy + audit |
| A03 Injection | PARTIAL | Prisma parameterized queries; Zod validation | Malicious payload corpus in CI |
| A04 Insecure Design | PARTIAL | Fail-closed webhooks/cron; public short-code format validation | Threat-model + abuse simulations |
| A05 Security Misconfiguration | PARTIAL | `env.ts` schema; prod fail-closed secrets; shallow health default | CSP header; strip `RELAX_ENV_VALIDATION` from prod |
| A06 Vulnerable Components | PARTIAL | Dependabot/npm audit in CI path | Formal SCA SLA |
| A07 Auth Failures | PARTIAL | Supabase session; middleware on `/dashboard/*` | Stable authenticated E2E with test user |
| A08 Integrity Failures | PARTIAL | Stripe signature verify; internal replay token | Async webhook queue + idempotency tests |
| A09 Logging/Monitoring | PARTIAL | Structured logging; webhook audit | Alert SLOs under load |
| A10 SSRF | PARTIAL | Env-gated external calls | Outbound URL allowlist for integrations |

### Security controls inventory

- **CSRF:** `src/lib/security/csrf.ts` — cookie + header for mutating dashboard requests
- **Rate limiting:** `src/lib/rate-limit.ts` — Redis-backed, fail-open on timeout
- **Public API hardening:** short-code validation before DB; negative cache on 404
- **Internal routes:** bearer token on `/api/internal/webhooks/stripe/replay`
- **Headers:** security headers in middleware (review CSP for inline scripts)

## 3) Playwright E2E — Critical Flows

Suite: `src/e2e/critical-flows.spec.ts`

| Flow | Assertion |
|---|---|
| Signup/login UI | Mode toggle; password mismatch validation |
| Create payment link | `POST /api/payment-links` → 401/403 without session |
| Checkout | `/pay/INVALID01` shows not-found fallback |
| Revenue split | `POST /api/referrals/advocates/create` → 401 |
| Webhook retry | `POST /api/internal/webhooks/stripe/replay` → 401 |

**Latest run (2026-06-08):** 5 passed, 0 failed  
Fix applied: retry navigation on `/auth/login` + limit local Playwright workers to 2 against `next dev`.

```bash
cd src
npm run test:e2e -- e2e/critical-flows.spec.ts
```

## 4) Build Strictness

- ESLint: strict (`eslint.ignoreDuringBuilds: false`)
- TypeScript: **temporary bypass** (`typescript.ignoreBuildErrors: true`) — clear debt before enabling

## 5) Environment variables (scale + security)

| Variable | Purpose |
|---|---|
| `PRISMA_CONNECTION_LIMIT` | Cap connections per web instance |
| `PUBLIC_NEGATIVE_CACHE_TTL_MS` | TTL for in-process 404 cache (default 30s) |
| `HEALTHCHECK_DEEP=1` | Enable DB check on `/api/health` |
| `RELAX_ENV_VALIDATION=1` | **Dev/CI only** — placeholder env merge |

**Never set `RELAX_ENV_VALIDATION` in production.**

## 6) Next actions (priority)

1. Deploy multi-instance web + DB pooler; re-benchmark at 500–1000 concurrency.
2. Webhook fast-ACK + background worker queue.
3. Enable `typescript.ignoreBuildErrors: false` after TS debt burn-down.
4. Authenticated E2E fixture (Supabase test user) for full payment-link creation flow.
5. Add CSP and outbound SSRF allowlist tests.

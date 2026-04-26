# SECURITY_AND_SCALE Report

Date: 2026-04-26
Scope: OWASP Top 10 review + scalability/load test + deterministic E2E status

## Executive Status

- Load test with 1,000 concurrent users: **executed** (results below).
- OWASP Top 10 matrix: **completed** in this document.
- Critical Playwright flow suite: **implemented and executed**, but not fully green yet.
- Next.js build strictness:
  - `eslint.ignoreDuringBuilds`: **false** (strict)
  - `typescript.ignoreBuildErrors`: **true** (temporary exception still required)
- Final report file committed target: `SECURITY_AND_SCALE.md` (this file).

## 1) 1,000 Concurrent User Load Test (Actual Run)

Command (executed):

`LOAD_TEST_BASE_URL=http://127.0.0.1:3456 LOAD_TEST_CONCURRENCY=1000 LOAD_TEST_DURATION_SECONDS=10 npm run load:test`

Observed aggregate metrics:

- Avg latency: **N/A** (no completed HTTP responses; all requests failed at transport/runtime level)
- p95 latency: **N/A** (same reason)
- Error rate: **92.18%**
- Throughput:
  - Successful throughput (Req/Sec from completed responses): **0 RPS**
  - Attempted throughput (`requestsSent / duration`): **3837.2 RPS**

Per-scenario outcomes:

- `/api/public/pay/INVALID01`
  - attempted throughput: 1598.4 RPS
  - failure rate: 93.74%
- `/api/public/merchant/INVALID01`
  - attempted throughput: 1138.6 RPS
  - failure rate: 91.22%
- `/api/health`
  - attempted throughput: 1100.2 RPS
  - failure rate: 90.91%

Notes:

- Runtime logs showed database authentication failures from health checks under load (`PrismaClientInitializationError`), which prevented meaningful latency percentiles for successful responses.

## 2) OWASP Top 10 Matrix (2021)

| OWASP Category | Status | Affected Files / Routes | Implemented Fixes | Remaining Work |
|---|---|---|---|---|
| A01 Broken Access Control | **PARTIAL** | `src/app/api/xero/*`, `src/app/api/merchant-settings/*`, `src/app/api/settings/xero-mappings/route.ts`, `src/app/api/organizations/[id]/route.ts`, `src/lib/auth/organization-access.ts` | Added org membership/permission/role checks; owner/admin restriction for org PATCH; admin-only metrics access | Full route-by-route authorization regression tests still needed |
| A02 Cryptographic Failures | **PARTIAL** | `src/app/api/referrals/advocates/create/route.ts`, `src/app/api/referrals/reviews/create-token/route.ts`, `src/app/api/internal/webhooks/stripe/replay/route.ts` | Replaced `Math.random` token generation with `crypto.randomBytes`; timing-safe internal token comparison | Broader key rotation + secret lifecycle policy verification still pending |
| A03 Injection | **PARTIAL** | API routes using Prisma (`src/app/api/**`), validation layer (`src/lib/validations/*`) | Prisma parameterized queries used; validation middleware strengthened | Full malicious payload test corpus not complete |
| A04 Insecure Design | **PARTIAL** | Public payment/link flows and referral flows (`src/app/(public)/pay/*`, `src/lib/referrals/*`) | Added explicit webhook/internal auth checks and fail-closed cron behavior | Threat-model artifacts and abuse-case simulation still incomplete |
| A05 Security Misconfiguration | **PARTIAL** | `src/lib/config/env.ts`, `src/app/api/webhooks/resend/route.ts`, `src/app/api/jobs/*` | Environment schema validation; production fail-closed behavior for missing secrets; Resend signature enforcement in production | Local/test env hardening still inconsistent (DB/env drift affects reproducibility) |
| A06 Vulnerable/Outdated Components | **PARTIAL** | `src/package.json` dependency surface | Modernized several integrations and strict checks in CI path | Dedicated SCA report + remediation SLAs not yet added in repo |
| A07 Identification and Authentication Failures | **PARTIAL** | `src/app/auth/*`, protected APIs and middleware | Auth checks present on protected APIs; middleware route gating; internal token-based replay auth | Deterministic end-to-end auth flow is not yet fully stable in CI/local |
| A08 Software and Data Integrity Failures | **PARTIAL** | webhook replay and queue/retry paths (`src/app/api/internal/webhooks/stripe/replay/route.ts`, `src/lib/webhooks/*`) | Signature/authorization checks tightened; replay endpoint hardened | End-to-end webhook replay safety test remains flaky due environment/runtime instability |
| A09 Security Logging and Monitoring Failures | **PARTIAL** | `src/lib/logger.ts`, `src/lib/webhooks/stripe-audit.ts`, monitoring endpoints | Added structured logging and webhook audit writes | Need log quality SLOs + alert thresholds validated in load conditions |
| A10 Server-Side Request Forgery (SSRF) | **PARTIAL** | external integration points (`src/lib/xero/*`, `src/lib/payments/wise.ts`, webhook handlers) | Route protections and env checks improved | Formal outbound allowlist and SSRF-focused tests are still pending |

## 3) Deterministic Playwright Critical Flows

Suite added: `src/e2e/critical-flows.spec.ts`

Covered flows:

- signup/login
- create payment link (unauthenticated guard)
- checkout
- revenue split
- webhook retry safety

Latest execution result:

- **1 passed / 4 failed**
- Pass: revenue split unauthenticated guard
- Failing cases are dominated by environment/runtime instability (timeouts, server aborts, DB/auth dependency failures) rather than assertion-only test logic.

## 4) Build Strictness

- ESLint strict build check is enabled:
  - `src/next.config.ts`: `eslint.ignoreDuringBuilds = false`
- TypeScript strict build check still has temporary bypass:
  - `src/next.config.ts`: `typescript.ignoreBuildErrors = true`

Reason:

- There is remaining TypeScript debt in payment/referral/runtime-integration paths that prevents reliable strict green builds.

## 5) Remaining Risk / Next Actions

1. Fix DB credentials/runtime environment used for load+E2E (`/api/health` currently fails under load because Prisma cannot authenticate).
2. Re-run 1,000 concurrency test with stable DB to produce non-null avg/p95.
3. Stabilize Playwright by decoupling API dependency or providing deterministic fixtures/mocks for auth + payment-link creation + checkout.
4. Clear remaining TypeScript strict errors and set `typescript.ignoreBuildErrors = false`.
5. Re-run CI with strict TS + Playwright all-green gates.

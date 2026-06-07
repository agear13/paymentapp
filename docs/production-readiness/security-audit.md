# Security & Secrets Audit — Provvypay

**Audit date:** 2026-05-20  
**Scope:** Environment variables, deployment, CI/CD, integrations, secret handling.

---

## Classification Legend

| Level | Meaning |
|-------|---------|
| CRITICAL | Exploitable or active data leak; fix before public launch |
| HIGH | Significant risk if misconfigured in production |
| MEDIUM | Defense-in-depth gap |
| LOW | Hygiene / documentation |

---

## CRITICAL

### S-CR-01: Cross-tenant data via Xero debug API

| Item | Detail |
|------|--------|
| Location | `src/app/api/xero/debug/route.ts` |
| Issue | Authenticated users can read other organizations' sync rows and payment links |
| Fix | Remove endpoint or admin+org filter |

### S-CR-02: Production builds ignore TypeScript errors

| Item | Detail |
|------|--------|
| Location | `src/next.config.ts` — `ignoreBuildErrors: true` |
| Issue | 698 type errors may hide unsafe casts in payment/ledger code |
| Fix | Phased type burn-down; enable strict builds |

---

## HIGH

### S-HI-01: Build-time placeholder secrets

| Item | Detail |
|------|--------|
| Location | `src/lib/config/env.ts` — `buildTimePlaceholderRecord()` |
| Issue | `sk_test_placeholder`, `placeholder-key` for Supabase service role during Next build |
| Mitigation | Only used when `NEXT_PHASE` is build or `RELAX_ENV_VALIDATION`; runtime production uses `envSchema.parse(process.env)` |
| Risk | Misconfigured deploy that skips runtime validation could run with placeholders — **verify Render env group completeness** |

### S-HI-02: Supabase service role on server

| Item | Detail |
|------|--------|
| Location | `legacy-supabase-storage.ts`, config export |
| Issue | Service role bypasses RLS — acceptable only server-side with path validation |
| Fix | Prefer R2; audit all service-role call sites |

### S-HI-03: `BETA_LOCKDOWN_MODE` default `true`

| Item | Detail |
|------|--------|
| Location | `env.ts` default |
| Issue | Not a direct security bug — prevents accidental settlement by non-admins |
| Risk | Misleading if public launch advertises full payouts while lockdown on |

### S-HI-04: ESLint disabled during production build

| Item | Detail |
|------|--------|
| Location | `next.config.ts` `eslint.ignoreDuringBuilds: true` |
| Issue | Security lint rules not enforced at deploy |

### S-HI-05: Stripe webhook disable switch

| Item | Detail |
|------|--------|
| Location | `stripe/webhook/route.ts` — if `STRIPE_WEBHOOK_SECRET` is `disabled` |
| Issue | Webhooks acknowledged but not processed — payments could stall |
| Fix | Alert if disabled in production; fail deploy validation |

### S-HI-06: CRON_SECRET dependency for jobs

| Item | Detail |
|------|--------|
| Location | `/api/jobs/*`, internal integrity |
| Issue | Weak or missing secret → 503 or open endpoint depending on route |
| Fix | Require `CRON_SECRET` in production schema (currently optional in zod — **verify**) |

### S-HI-07: No dedicated worker isolation

| Item | Detail |
|------|--------|
| Location | `render.yaml` — jobs on same web service |
| Issue | Long-running job HTTP calls compete with user traffic; DoS surface |

---

## MEDIUM

### S-ME-01: `TEST_MODE` logging and env bypass

| Item | Detail |
|------|--------|
| Location | `env.ts` line ~193 `console.log("TEST_MODE ACTIVE:")` |
| Issue | Noise; `TEST_MODE=true` skips validation in non-production |
| Fix | Remove console.log; ensure production cannot set TEST_MODE |

### S-ME-02: Test refund endpoint

| Item | Detail |
|------|--------|
| Location | `/api/test/refund-atomicity` |
| Issue | Blocked in production — **PASS** if `NODE_ENV` trustworthy |

### S-ME-03: Internal Stripe replay

| Item | Detail |
|------|--------|
| Location | `/api/internal/webhooks/stripe/replay` |
| Issue | Powerful; requires strong token rotation policy |

### S-ME-04: Wise demo UI flag

| Item | Detail |
|------|--------|
| Location | `NEXT_PUBLIC_SHOW_WISE_DEMO` default true |
| Issue | Users may attempt Wise pay without configured backend |

### S-ME-05: Images `remotePatterns: hostname: '**'`

| Item | Detail |
|------|--------|
| Location | `next.config.ts` |
| Issue | SSRF-style risk if Next image optimizer abused — scope limited to image optimizer |

### S-ME-06: Middleware JWT email for UX routing

| Item | Detail |
|------|--------|
| Location | `middleware.ts` |
| Issue | Must never be sole authz — documented |

### S-ME-07: `RELAX_ENV_VALIDATION` in CI

| Item | Detail |
|------|--------|
| Issue | Acceptable for tests; must not leak to production config |

---

## LOW

### S-LO-01: Hardcoded test credentials in tests only

| Item | Detail |
|------|--------|
| Location | `__tests__/branding/resolve-merchant-branding.test.ts` sets `R2_SECRET_ACCESS_KEY` |
| Issue | Test-only — acceptable |

### S-LO-02: Admin email allowlists in code

| Item | Detail |
|------|--------|
| Location | `lib/auth/admin-shared.ts` |
| Issue | Operational — prefer env `ADMIN_EMAIL_ALLOWLIST` for rotation |

### S-LO-03: Huntpay routes exposed

| Item | Detail |
|------|--------|
| Issue | Separate product surface — review if should be disabled at launch |

---

## Environment Variables (Production Checklist)

| Variable | Required at runtime | Notes |
|----------|---------------------|-------|
| `DATABASE_URL` | Yes | Render Postgres |
| `NEXT_PUBLIC_SUPABASE_*` | Yes | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only — never `NEXT_PUBLIC_` |
| `STRIPE_SECRET_KEY` | Yes | Must be `sk_live_*` for production launch |
| `STRIPE_WEBHOOK_SECRET` | Yes | Must not be `disabled` |
| `ENCRYPTION_KEY` | Yes | 32+ chars |
| `CRON_SECRET` | **Should be required** | Job authentication |
| `SESSION_SECRET` | Recommended | Optional in schema |
| `R2_*` | Yes for attachments | Render.yaml lists keys |
| `SENTRY_DSN` | Recommended | Error visibility |
| `RESEND_WEBHOOK_SECRET` | Yes if Resend webhooks used | Fail-closed in prod |
| `WISE_WEBHOOK_SECRET` | Yes if Wise enabled | Signature verification added |
| `XERO_*` | If accounting launch feature | OAuth secrets |
| `BETA_LOCKDOWN_MODE` | Explicit choice | `false` only when ready for settlement GA |

---

## Stripe Configuration

| Check | Status |
|-------|--------|
| Webhook signature verification | Implemented |
| Duplicate event dedupe | `webhook_events` |
| Test vs live key detection | `config.isBeta` from `sk_test_` prefix |
| Idempotent payment confirmation | `checkDuplicatePayment`, locks |

**Launch:** Confirm live mode keys + webhook endpoint on production URL only.

---

## Supabase Configuration

| Check | Status |
|-------|--------|
| Anon key client-side | Expected |
| Service role server-only | Yes — **never expose** |
| RLS | Bypassed by service role paths — **HIGH** if path traversal |

---

## Webhook Configuration

| Provider | Verification |
|----------|--------------|
| Stripe | HMAC signature |
| Resend | Svix (`RESEND_WEBHOOK_SECRET`) |
| Wise | Shared secret header |

---

## Deployment (`render.yaml`)

| Check | Status |
|-------|--------|
| Health check `/api/health` | Configured |
| Worker/cron | **Disabled** — operational risk not secret risk |
| Env from group `provvypay-production` | Manual dashboard step |
| `NODE_ENV=production` | Set |

---

## CI/CD (Repository)

| Check | Finding |
|-------|---------|
| Pre-push hook | Operations typecheck + tests — not full TS |
| Secrets in repo | No live keys found in `src/` grep sample |
| `.env` committed | **Verify** `.gitignore` — not audited file-by-file |

---

## Hardcoded Secrets Scan

Grep for `sk_live`, `sk_test`, `SUPABASE_SERVICE_ROLE` in application code: **only placeholders in `env.ts` build path and test fixtures** — no live keys in source.

---

## Recommendations Summary

1. **P0:** Fix or remove `xero/debug`.  
2. **P0:** Production env validation: reject placeholders, require `CRON_SECRET`, reject `STRIPE_WEBHOOK_SECRET=disabled`.  
3. **P1:** Enable Sentry + alert on webhook processing disabled.  
4. **P1:** Secret rotation runbook (Stripe, CRON, Xero, R2).  
5. **P2:** Narrow Next.js image remote patterns to known CDN hosts.

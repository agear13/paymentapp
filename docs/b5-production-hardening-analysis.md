# B5 Production Hardening Analysis

**Date:** 2026-06-04  
**Scope:** Environment validation, deployment configuration, integration secrets, feature flags, and B3 cron posture.  
**Method:** Codebase review only — no changes implemented.  
**Verdict:** Production hardening is **partial**. Runtime Zod validation covers core payment/auth secrets, but **deploy-time gates are weak**, several **unsafe defaults and opt-out switches** remain, and **B3 depends on operator env discipline** not application schema enforcement.

---

## Executive summary

| Area | Sufficiency for launch |
|------|------------------------|
| Runtime env validation (`env.ts`) | **Partial** — strong for core Stripe/Supabase/DB; gaps for `CRON_SECRET`, admin allowlists, production-mode guards |
| Deploy validation scripts | **Partial** — `validate-render-env.js` improved for B3; not wired to CI/Render deploy; `validate-env.js` stale |
| Stripe | **At risk** if `STRIPE_WEBHOOK_SECRET=disabled` or test keys in prod |
| Supabase | **Adequate** if service role never exposed client-side; RLS bypass is intentional server-only |
| Xero | **Optional** — feature flag can imply sync on without credentials |
| Cron (B3) | **Adequate when configured** — routes enforce secret; app boot does not require `CRON_SECRET` |
| Webhooks | **Mixed** — Stripe disable switch; Wise open if secret unset; Resend fails closed in production |
| Feature flags | **Misalignment risk** — beta lockdown, Wise demo UI, Hedera defaults |
| Deploy safeguards | **Insufficient** — build skips TS/ESLint; prebuild non-blocking; no production env CI job |

**Launch recommendation:** Treat B5 as **open** until operators complete the **Production Hardening Checklist** at the end of this document and verify live Render env (not repo files alone).

---

## Environment validation architecture

### Primary: `src/lib/config/env.ts`

| Behavior | Finding |
|----------|---------|
| Runtime Zod parse | Required: `NEXT_PUBLIC_APP_URL`, DB, Supabase URL/keys, Stripe keys + webhook secret, Hedera public config, `ENCRYPTION_KEY` |
| Build time | **Skips validation** — merges `buildTimePlaceholderRecord()` (`sk_test_placeholder`, `placeholder-key`, etc.) |
| `RELAX_ENV_VALIDATION=1` | Placeholders only when `NODE_ENV=development` or `CI+test` — **not** when `NODE_ENV=production` |
| `TEST_MODE=true` | Bypasses validation only when `NODE_ENV !== 'production'` |
| `CRON_SECRET` | **Not in schema** — not validated at app startup |
| `SESSION_SECRET` | **Optional** in Zod |
| `ADMIN_EMAIL_ALLOWLIST` | Optional; used by `isAdminEmail()` |
| `ADMIN_EMAILS` | **Not in schema** — used by `checkAdminAuth()` |

**Risk:** Production process can start with valid Zod parse but **missing cron secret** → all scheduled jobs return **503** while health check stays **200** (shallow `/api/health`).

### Secondary: `scripts/validate-render-env.js`

| Checks | Gaps |
|--------|------|
| Required URLs, Stripe prefix `sk_`/`pk_`/`whsec_`, `ENCRYPTION_KEY` ≥ 32 | Does **not** require `sk_live_` / `pk_live_` for production |
| `CRON_SECRET` presence (B3) | Does **not** reject `STRIPE_WEBHOOK_SECRET=disabled`; no min length on `CRON_SECRET` |
| Optional Xero, Sentry, flags | Not run automatically on Render deploy |

### Tertiary: `scripts/validate-env.js`

| Issue | Impact |
|-------|--------|
| Expects `.env.production` with **stale variable names** (`STRIPE_PUBLISHABLE_KEY`, `HEDERA_PRIVATE_KEY`, `COINGECKO_API_KEY`) | Misleading if operators rely on it; diverges from actual `env.ts` |
| Requires `sk_live_`, `SENTRY_DSN`, full Xero | Stricter than app — **false sense** if script not run |

### Prebuild: `src/scripts/prebuild-validation.js`

| Behavior | Impact |
|----------|--------|
| Non-blocking warnings for missing `NEXT_PUBLIC_APP_URL` / `DATABASE_URL` at build | Render build can succeed with incomplete env |
| Never validates secrets | **No deploy hard gate** |

### CI: `.github/workflows/ci.yml`

| Behavior | Impact |
|----------|--------|
| `RELAX_ENV_VALIDATION=1` for tests | Correct for CI |
| No `validate-render-env.js` step | Production misconfig not caught in pipeline |

---

## Deployment configuration (`render.yaml`)

| Item | Status |
|------|--------|
| Web `provvypay-api` | Enabled; `healthCheckPath: /api/health`; `NODE_ENV=production` |
| Cron services (B3) | **8 enabled** — `render-cron-invoke.mjs` |
| Worker | Disabled (by design) |
| Env group | `fromGroup: provvypay-production` — **all secrets operator-defined** |
| `CRON_SECRET` in blueprint | **Not declared** — must exist in env group manually |
| R2 vars | Listed `sync: false` — required for production object storage |

**Gap:** Blueprint does not enforce secret presence; failed cron runs only visible in Render cron logs.

---

## B3 verification (current implementation)

| Control | Verified in code | Launch sufficiency |
|---------|------------------|-------------------|
| `CRON_SECRET` on `/api/jobs/*` | **503** if unset, **401** if wrong | **PASS** per route |
| `verifyCronRequest` on Xero `queue/process` | **503/401** hardened (post-B3) | **PASS** |
| `render.yaml` cron services | 8 schedules documented in `docs/b3-production-verification.md` | **PASS** if blueprint applied |
| `scripts/validate-render-env.js` | Lists `CRON_SECRET` | **PASS** as manual checklist only |
| `CRON_SECRET` in `env.ts` | **Absent** | **FAIL** — app starts without it |
| Cron env on Render | Cron services use same env group as web | **PASS** if group complete; **FAIL** if secret only on web |
| `render-cron-invoke.mjs` | Requires secret + `NEXT_PUBLIC_APP_URL`/`CRON_BASE_URL` | **PASS** — fails fast on cron container |
| Duplicate paths | No worker queue; leases on heavy jobs | **PASS** |

### Additional safeguards recommended for B3 (operator / future code — not implemented)

1. Add `CRON_SECRET` to production Zod schema (min length ≥ 32).
2. Run `validate-render-env.js` in Render **pre-deploy** or release command.
3. Alert when job routes return 503 `CRON_SECRET is not configured` in logs.
4. Post-deploy: one successful cron run per service in Render dashboard.
5. Optional `CRON_BASE_URL` if cron must call a private URL different from public app URL.

---

## Stripe configuration

| Variable | Validation | Risk |
|----------|------------|------|
| `STRIPE_SECRET_KEY` | Required; `config.stripe.isTestMode` if `sk_test_` | Test keys in production allowed |
| `STRIPE_WEBHOOK_SECRET` | Required string; **no ban on `disabled`** | See Critical #1 |
| Webhook route | If secret missing or `disabled` → **200** `processed: false` | Payments never confirm |
| Reconciliation job | B3 cron `stripe-reconciliation` | Mitigates missed webhooks **if** cron + secret work |

**Files:** `src/app/api/stripe/webhook/route.ts`, `src/lib/stripe/webhook.ts`, `src/lib/config/env.ts`

---

## Supabase configuration

| Variable | Role | Risk |
|----------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Client auth | Public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin client (`lib/supabase/admin.ts`) | **HIGH** if leaked — bypasses RLS |
| Validation | Required at runtime | **PASS** if real keys set |

**Mitigation in code:** `server-only` admin module; routes should use org-scoped Prisma for tenant data.

**Gap:** `validate-render-env` does not detect `placeholder-key` if someone copies build placeholders into Render (unlikely but possible).

---

## Xero configuration

| Variable | Role | Risk |
|----------|------|------|
| `XERO_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Optional in Zod | |
| `ENABLE_XERO_SYNC` | Default **`true`** in schema | UI/ops may expect sync while `config.xero.isConfigured` is false |
| `config.features.xeroSync` | `ENABLE_XERO_SYNC === 'true'` **and** credentials present | Actual gate is OK |
| B3 `xero-queue` cron | Drains queue when feature + credentials work | **PASS** when configured |

---

## Cron configuration (beyond B3 routes)

| Item | Status |
|------|--------|
| `npm run cron:fx-rates` / `cron:reconcile` | Point to **missing** `cron/*.js` files — not used |
| Legacy Render commented crons | Superseded by B3 HTTP invoke |
| `INTERNAL_ADMIN_TOKEN` | Stripe replay (`/api/internal/webhooks/stripe/replay`) — **not** in Zod; powerful if set weakly |

---

## Webhook configuration

| Webhook | Auth | Empty-secret behavior |
|---------|------|------------------------|
| Stripe | Signature (`whsec_`) | **`disabled` → no processing** (Critical) |
| Wise | HMAC if `WISE_WEBHOOK_SECRET` set | **If unset → verification returns true** (High) |
| Resend | Svix if `RESEND_WEBHOOK_SECRET` set | **Production without secret → 503** (Good) |

**Files:** `src/app/api/webhooks/wise/route.ts`, `src/app/api/webhooks/resend/route.ts`

---

## Authentication & admin secrets

| Mechanism | Config | Finding |
|-----------|--------|---------|
| `checkAdminAuth()` | `ADMIN_EMAILS` env | **Not** in Zod; empty → no admin |
| `isAdminEmail()` | `ADMIN_EMAIL_ALLOWLIST` | Different env var — **split brain** |
| Beta admin | Hardcoded `BETA_ADMIN_EMAILS` in `admin-shared.ts` | Always works for listed email regardless of env |
| `BETA_LOCKDOWN_MODE` | Default **`true`** | Payout/settlement APIs gated — product truth issue |
| `ENCRYPTION_KEY` | Required, min 1 char in Zod; render script ≥ 32 | Enforce 32+ in production checklist |
| `SESSION_SECRET` | Optional in app | `validate-env.js` expects required — inconsistent |

---

## Service role & internal tokens

| Secret | Exposure risk |
|--------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; required for admin Supabase ops |
| `CRON_SECRET` | HTTP header to job routes — rotate if leaked |
| `INTERNAL_ADMIN_TOKEN` | Stripe webhook replay — must be long/random if used |
| R2 keys | Server-side storage; in Render env group |

---

## Production feature flags (defaults)

| Flag | Default | Launch note |
|------|---------|-------------|
| `ENABLE_HEDERA_PAYMENTS` | `true` | OK if Hedera intended |
| `ENABLE_HEDERA_STABLECOINS` | `false` | |
| `ENABLE_XERO_SYNC` | `true` | Misleading without Xero creds |
| `ENABLE_WISE_PAYMENTS` | `false` | |
| `NEXT_PUBLIC_SHOW_WISE_DEMO` | **`true`** | May show Wise demo UI when backend off |
| `BETA_LOCKDOWN_MODE` | **`true`** | Blocks mass payouts for non-beta admins |
| `ENABLE_BETA_OPS` | `false` | |

**Beta detection:** `config.isBeta` if `sk_test_` **or** Hedera testnet — warns in logs but **does not block** production boot.

---

## Public exposure & disabled checks

| Issue | Severity |
|-------|----------|
| `typescript.ignoreBuildErrors: true` | Critical (build safety — related B2) |
| `eslint.ignoreDuringBuilds: true` | High |
| `images.remotePatterns` hostname `**` | Medium (supply-chain / SSRF-style image loads) |
| Shallow health check default | Medium — DB/storage not verified unless `HEALTHCHECK_DEEP=1` |
| `TEST_MODE ACTIVE` logged on every import (`env.ts` ~193) | Low — noise / reconnaissance |
| `ALLOW_INFRASTRUCTURE_DOMAINS=true` | Medium in prod — allows onrender URLs in customer-facing links |

---

## Findings by severity

### Critical — must fix before launch

| # | Finding | File(s) | Variable / control | Impact | Effort |
|---|---------|---------|-------------------|--------|--------|
| C1 | Stripe webhooks can be **silently disabled** | `src/app/api/stripe/webhook/route.ts`, `src/lib/stripe/webhook.ts` | `STRIPE_WEBHOOK_SECRET=disabled` or empty | Returns 200 without `confirmPayment` — invoices stuck OPEN | **Small** — set real `whsec_`; add deploy check |
| C2 | **No automated production env gate** on deploy | `render.yaml`, CI, `prebuild-validation.js` | N/A | Invalid/disabled secrets reach production | **Medium** — wire `validate-render-env.js` to release |
| C3 | **`CRON_SECRET` not required at app startup** | `src/lib/config/env.ts` | `CRON_SECRET` | B3 crons 503; ops think jobs run; shallow health OK | **Small** — env group + schema/checklist |
| C4 | **Admin allowlist split** | `admin.server.ts` vs `env.ts` | `ADMIN_EMAILS` vs `ADMIN_EMAIL_ALLOWLIST` | `checkAdminAuth` fails if only wrong var set; Xero process-now / integrity admin broken | **Small** — set both to same value or align names |
| C5 | **Test Stripe keys allowed in production** | `env.ts`, `validate-render-env.js` | `STRIPE_SECRET_KEY` (`sk_test_`) | Real money paths use test mode; compliance/reconciliation risk | **Small** — enforce `sk_live_` in prod validator |

### High — should fix before launch

| # | Finding | File(s) | Variable | Impact | Effort |
|---|---------|---------|----------|--------|--------|
| H1 | Build uses **placeholder secrets** | `src/lib/config/env.ts` | `buildTimePlaceholderRecord()` | Safe only if runtime parse always runs; mis-set `NODE_ENV`/RELAX could theorize weak boot | **Low** — verify Render `NODE_ENV=production` |
| H2 | **Wise webhooks accept unsigned** when secret unset | `src/app/api/webhooks/wise/route.ts` | `WISE_WEBHOOK_SECRET` | Forged Wise events if `ENABLE_WISE_PAYMENTS=true` | **Small** — require secret when Wise on |
| H3 | **R2 not enforced** at runtime schema | `render.yaml`, `storage-config.ts` | `R2_*` | Production uploads may misconfigure (`provider: r2` without creds) | **Medium** — set all R2 vars; deep health |
| H4 | **`validate-render-env` weak** for production | `scripts/validate-render-env.js` | Multiple | Passes `sk_test_`, allows `disabled` webhook | **Small** — extend script (ops doc today) |
| H5 | **`SESSION_SECRET` optional** in app | `env.ts` | `SESSION_SECRET` | Session/crypto features weakened if used | **Small** — set if session features enabled |
| H6 | **`ENABLE_XERO_SYNC` default true** | `env.ts` | `ENABLE_XERO_SYNC` | Operational confusion; queue rows with no OAuth | **Small** — set `false` if Xero not GA |
| H7 | **`NEXT_PUBLIC_SHOW_WISE_DEMO` default true** | `env.ts` | `NEXT_PUBLIC_SHOW_WISE_DEMO` | Public UI shows Wise before backend ready | **Small** — set `false` for GA |
| H8 | **Shallow health check** default | `src/app/api/health/route.ts` | `HEALTHCHECK_DEEP` | Render marks healthy while DB/jobs broken | **Small** — enable deep check or synthetic job probe |
| H9 | **Supabase service role** power | `lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Full DB bypass if leaked | **Low** — secret hygiene, audit call sites |
| H10 | **B3 depends on env group completeness** | `render.yaml`, B3 docs | `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` | Cron containers fail invoke if URL/secret missing | **Small** — pre-flight in checklist |

### Medium — fix shortly after launch

| # | Finding | File(s) | Variable | Impact | Effort |
|---|---------|---------|----------|--------|--------|
| M1 | `validate-env.js` **out of date** | `scripts/validate-env.js` | Many wrong names | Operators get false results | **Medium** — deprecate or sync |
| M2 | `TEST_MODE` console on every boot | `env.ts` | `TEST_MODE` | Log noise; confirms test flag presence | **Small** |
| M3 | `INTERNAL_ADMIN_TOKEN` not in schema | `internal/webhooks/stripe/replay/route.ts` | `INTERNAL_ADMIN_TOKEN` | Powerful replay if token weak | **Small** — unset in prod or strong token |
| M4 | `ALLOW_INFRASTRUCTURE_DOMAINS` in production | `lib/runtime/customer-facing-url.ts` | `ALLOW_INFRASTRUCTURE_DOMAINS` | Customer links on `onrender.com` | **Small** — false when custom domain live |
| M5 | Hardcoded beta admin email | `lib/auth/admin-shared.ts` | `BETA_ADMIN_EMAILS` | Non-env bypass of lockdown | **Small** — document; move to env for GA |
| M6 | No **Sentry** required | `env.ts` | `SENTRY_DSN` | No automated P0 alerts | **Medium** |
| M7 | Hedera **mainnet default** + test Stripe | `env.ts` | `NEXT_PUBLIC_HEDERA_NETWORK` | Inconsistent “beta” warnings only | **Small** — align network with GA matrix |
| M8 | CI never runs production env validation | `.github/workflows/ci.yml` | N/A | Regressions in required vars undetected | **Medium** |

### Low — can defer

| # | Finding | File(s) | Impact | Effort |
|---|---------|---------|--------|--------|
| L1 | `jest.setup-env.js` sets `TEST_MODE=true` | Test only | None in prod | — |
| L2 | Missing `cron/fx-rates.js` scripts | `package.json` | Unused legacy | **Low** |
| L3 | `RELAX_ENV_VALIDATION` comment only | `env.ts` | Blocked in prod by NODE_ENV guard | **Low** |
| L4 | Wide image `remotePatterns` | `next.config.ts` | Branding URL risk | **Medium** later |

---

## Definitive production hardening checklist

Use this as the **launch gate** for B5 (operator-verified on Render + Stripe/Supabase dashboards).

### A. Render environment group (`provvypay-production`)

- [ ] `NODE_ENV=production` on web service (set in blueprint)
- [ ] `NEXT_PUBLIC_APP_URL` = canonical HTTPS customer URL (not placeholder)
- [ ] `CRON_SECRET` = cryptographically random (≥ 32 bytes); **same value** on web + all 8 cron services via env group
- [ ] Optional `CRON_BASE_URL` only if invoke URL must differ from public app URL
- [ ] `DATABASE_URL` / `DIRECT_URL` = production Postgres (not local)
- [ ] `STRIPE_SECRET_KEY` starts with **`sk_live_`** for live GA
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with **`pk_live_`**
- [ ] `STRIPE_WEBHOOK_SECRET` starts with **`whsec_`** and is **not** `disabled`
- [ ] Stripe Dashboard webhook endpoint points to `https://<app>/api/stripe/webhook`; events match enabled products
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` = production project
- [ ] `ENCRYPTION_KEY` ≥ 32 characters (openssl rand -base64 32)
- [ ] `ADMIN_EMAILS` and `ADMIN_EMAIL_ALLOWLIST` set to **same comma-separated ops emails** (until code unified)
- [ ] `SESSION_SECRET` set (≥ 32) if any session-dependent feature is used
- [ ] R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` all set
- [ ] `STORAGE_ALLOW_LOCAL_FALLBACK` unset or `false` in production
- [ ] `ALLOW_INFRASTRUCTURE_DOMAINS=false` when using custom domain (unless intentional staging)
- [ ] `BETA_LOCKDOWN_MODE` explicitly set to match **marketed** payout capabilities
- [ ] `ENABLE_XERO_SYNC` / Xero OAuth vars aligned (if accounting GA: all three Xero vars; else `ENABLE_XERO_SYNC=false`)
- [ ] `ENABLE_WISE_PAYMENTS` / `WISE_WEBHOOK_SECRET` aligned (if Wise GA: token + profile + webhook secret)
- [ ] `WISE_WEBHOOK_SECRET` set whenever `ENABLE_WISE_PAYMENTS=true`
- [ ] `RESEND_WEBHOOK_SECRET` set if Resend webhooks configured
- [ ] `INTERNAL_ADMIN_TOKEN` unset in production **or** strong random + known rotation
- [ ] `RELAX_ENV_VALIDATION` **unset** in production
- [ ] `TEST_MODE` **unset** in production
- [ ] `SENTRY_DSN` set for P0 alerting (recommended)

### B. Validation commands (before/after deploy)

- [ ] Export Render env locally (secure workstation) and run: `node scripts/validate-render-env.js`
- [ ] Manually confirm `STRIPE_WEBHOOK_SECRET` ≠ `disabled` (script enhancement recommended)
- [ ] Post-deploy: `curl` job endpoint with wrong secret → **401**
- [ ] Post-deploy: Render cron “last run succeeded” for all 8 `provvypay-cron-*` services
- [ ] Optional: `cd src && npm run cron:invoke -- expired-links` with production env

### C. B3-specific (required for scheduled ops)

- [ ] All 8 cron services deployed from current `render.yaml`
- [ ] Cron logs show HTTP 2xx from `render-cron-invoke.mjs`
- [ ] API logs show job execution (not `CRON_SECRET is not configured`)
- [ ] Xero queue cron runs only if Xero integration is in GA scope

### D. Integration dashboards

- [ ] Stripe: live mode, webhook signing secret matches env
- [ ] Supabase: RLS policies reviewed; service role key rotated if ever exposed
- [ ] Xero: redirect URI matches `XERO_REDIRECT_URI` exactly (HTTPS)
- [ ] Wise/Resend: webhook URLs and secrets registered

### E. Known non-blocking (document acceptance)

- [ ] TypeScript `ignoreBuildErrors` (B2) — accepted risk with dated burn-down
- [ ] ESLint ignored at build — accepted with manual security review on payment changes
- [ ] Worker process disabled — B3 HTTP cron model accepted

---

## Is production configuration sufficient for launch?

| Launch tier | B5 sufficient? |
|-------------|----------------|
| **Controlled GA** (Stripe live + limited features + B3 cron + ops checklist complete) | **Yes**, if checklist **A + B + C** verified and C1/C4/C5 addressed |
| **Public launch** (full payouts, Xero, Wise, no beta lockdown surprises) | **No** until H2, H6, H7, B6 product alignment, and deploy automation (C2) |
| **Enterprise** | **No** — Sentry/alerting, deep health, admin env unification, CI prod validation required |

---

## References

| Document / file | Role |
|-----------------|------|
| `src/lib/config/env.ts` | Runtime validation & feature flags |
| `scripts/validate-render-env.js` | Manual Render checklist (incl. B3 `CRON_SECRET`) |
| `render.yaml` | Web + B3 cron services |
| `docs/b3-production-verification.md` | Cron schedules & auth |
| `docs/b3-job-inventory.md` | Job catalog |
| `docs/production-readiness/security-audit.md` | S-HI-01, S-HI-05, S-HI-06 |
| `docs/launch-readiness-reassessment-v2.md` | B5 listed as open (env checklist) |

# B5 Hardening Implementation Plan

**Date:** 2026-06-04  
**Scope:** C1, C3, C4, C5 only (per production hardening audit).

---

## Objectives

| ID | Goal |
|----|------|
| **C1** | Production cannot boot with empty or `disabled` `STRIPE_WEBHOOK_SECRET` |
| **C3** | Production cannot boot without `CRON_SECRET` (B3 scheduled jobs) |
| **C4** | Single admin allowlist source; `ADMIN_EMAIL_ALLOWLIST` authoritative, `ADMIN_EMAILS` deprecated fallback |
| **C5** | Production cannot boot with `sk_test_` / `pk_test_` unless `ALLOW_STRIPE_TEST_KEYS=true` |

Settlement, commission, cron schedules, and payment math are **out of scope**.

---

## Affected files

| File | Change |
|------|--------|
| `src/lib/config/production-env-guards.ts` | **New** — production-only assertions (C1, C3, C5) |
| `src/lib/config/admin-email-allowlist.ts` | **New** — resolve/merge admin emails (C4) |
| `src/lib/config/env.ts` | Wire guards after parse; resolved admin list in `config` |
| `src/lib/auth/admin.server.ts` | `checkAdminAuth` uses `config.admin.emailAllowlist` (C4) |
| `scripts/validate-render-env.js` | Align pre-deploy checks with C1/C3/C5 |
| `src/app/api/xero/queue/process-now/route.ts` | Comment: `ADMIN_EMAIL_ALLOWLIST` |
| `src/app/(dashboard)/dashboard/programs/conversions/page.tsx` | Debug UI: show resolved allowlist vars |
| `src/__tests__/config/production-env-guards.test.ts` | **New** — guard unit tests |
| `src/__tests__/config/admin-email-allowlist.test.ts` | **New** — C4 merge tests |
| `docs/b5-deployment-checklist.md` | **New** — operator rollout (Phase 6) |

**Not modified:** Stripe webhook settlement handlers (only startup + optional comment), `render.yaml`, cron invoke scripts.

---

## Migration impact

| Area | Impact |
|------|--------|
| **Database** | None |
| **API contracts** | None |
| **Admin auth behavior** | **Union** of `ADMIN_EMAIL_ALLOWLIST` + legacy `ADMIN_EMAILS` (deduped, lowercased). Operators who only set `ADMIN_EMAILS` keep access. |
| **Breaking** | Production deploy **fails fast** if previously running with: `STRIPE_WEBHOOK_SECRET=disabled`, missing `CRON_SECRET`, test Stripe keys without override, or invalid webhook secret format |

---

## Deployment impact

1. **Before deploy:** Set/fix env in `provvypay-production` (see `b5-deployment-checklist.md`).
2. **Deploy:** Web service will not start until guards pass (Node process exits on `env.ts` import).
3. **Cron services:** Same env group must include `CRON_SECRET` (already required by B3 invoke script).
4. **Rollback:** Revert release **and** restore prior env if old config relied on disabled webhook or test keys.

---

## Required env changes

| Variable | Production requirement |
|----------|------------------------|
| `STRIPE_WEBHOOK_SECRET` | Valid `whsec_*` value; **not** `disabled` or empty |
| `CRON_SECRET` | Required; minimum 16 characters |
| `STRIPE_SECRET_KEY` | `sk_live_*` unless `ALLOW_STRIPE_TEST_KEYS=true` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_*` unless `ALLOW_STRIPE_TEST_KEYS=true` |
| `ADMIN_EMAIL_ALLOWLIST` | **Authoritative** comma-separated admin emails |
| `ADMIN_EMAILS` | **Deprecated** — still honored if allowlist empty (warning logged once) |

### Optional overrides (non-production / staging)

| Variable | When |
|----------|------|
| `ALLOW_STRIPE_TEST_KEYS=true` | Staging Render with test Stripe keys only |
| `RELAX_ENV_VALIDATION=1` | Local dev / CI test only (unchanged) |
| `TEST_MODE=true` | Local test only, `NODE_ENV !== production` (unchanged) |

---

## Implementation sequence

1. Add `admin-email-allowlist.ts` + `production-env-guards.ts`
2. Integrate into `env.ts` `validateEnv()` after Zod parse
3. Update `admin.server.ts` + comments
4. Extend `validate-render-env.js`
5. Tests + `b5-deployment-checklist.md`

---

## Local development preservation

Guards run **only** when `NODE_ENV === 'production'` after normal parse, excluding:

- Next.js build phases (`NEXT_PHASE` build)
- `RELAX_ENV_VALIDATION=1` in development or CI test
- `TEST_MODE=true` with `NODE_ENV !== 'production'`

Development may continue using `sk_test_*`, `whsec_placeholder`, and optional `CRON_SECRET`.

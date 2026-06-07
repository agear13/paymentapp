# Historical Payment Repair — Environment Validation Analysis

**Date:** 2026-06-04

## Symptom

```text
❌ Invalid environment variables:
Fatal: Environment validation failed
```

No per-variable detail was printed.

## Root cause (diagnostics bug)

The project uses **Zod v4** (`^4.1.13`). `ZodError` exposes failures on **`issues`**, not `errors`.

`src/lib/config/env.ts` only iterated `error.errors` (Zod v3 API), so the catch block logged the header and threw without listing any variables.

**Fix (implemented):** `src/lib/config/env-validation-diagnostics.ts` + `printZodEnvValidationFailures()` in the `validateEnv()` catch path. Output format:

```text
VARIABLE_NAME -> status (rule)
```

Secret values are never printed.

---

## Validation path for `npx tsx scripts/historical-payment-repair.ts --limit=10`

```text
scripts/historical-payment-repair.ts
  ├── dotenv: src/.env.local, src/.env, repo-root .env.local, repo-root .env
  └── dynamic import → lib/payments/historical-payment-repair.core.ts
        ├── @/lib/server/prisma
        ├── @/lib/services/payment-confirmation.ts
        │     └── import config from '@/lib/config/env'   ← validation runs here (module load)
        └── @/lib/referrals/commission-reconcile.server.ts
              └── (transitive) funding, metadata, ledger → may also import env/config
```

**Validation module:** `src/lib/config/env.ts`

- `validateEnv()` → `envSchema.parse(process.env)` (Zod)
- On success in production: `assertProductionEnvGuards()` (`src/lib/config/production-env-guards.ts`)
- Module top-level: `const env = validateEnv()` runs **as soon as any importer loads `env.ts`**

Dry-run does **not** skip this: importing `confirmPayment` loads `payment-confirmation.ts`, which loads `env.ts` before any repair code runs.

---

## Required environment variables (schema)

These must be present and pass Zod rules (no bypass):

| Variable | Rule |
|----------|------|
| `NODE_ENV` | `development` \| `production` \| `test` (default `development`) |
| `NEXT_PUBLIC_APP_URL` | Valid URL |
| `DATABASE_URL` | Non-empty string |
| `NEXT_PUBLIC_SUPABASE_URL` | Valid URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Non-empty |
| `SUPABASE_SERVICE_ROLE_KEY` | Non-empty |
| `STRIPE_SECRET_KEY` | Non-empty |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Non-empty |
| `STRIPE_WEBHOOK_SECRET` | Non-empty |
| `NEXT_PUBLIC_HEDERA_NETWORK` | `mainnet` \| `testnet` \| `previewnet` (default `mainnet`) |
| `NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL` | Valid URL |
| `ENCRYPTION_KEY` | Non-empty |

**Optional** (but validated if set): `UPSTASH_REDIS_REST_URL` must be a valid URL or omitted entirely; empty string fails as **invalid format**.

Many other vars (Xero, Wise, R2, etc.) are optional.

---

## Exact failing variables (this workspace, after diagnostic fix)

Captured from:

```bash
cd src
npx tsx scripts/historical-payment-repair.ts --limit=10
```

| Variable | Status | Rule |
|----------|--------|------|
| `NEXT_PUBLIC_APP_URL` | **missing** | expected string (URL) |
| `NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL` | **missing** | expected string (URL) |
| `ENCRYPTION_KEY` | **missing** | expected string |
| `UPSTASH_REDIS_REST_URL` | **invalid format** | invalid format (likely empty or non-URL in `.env`) |

Other required keys (`DATABASE_URL`, Stripe, Supabase, etc.) are satisfied in the current `src/.env.local` merge.

Your machine may differ; re-run the CLI after the diagnostic fix to get the authoritative list.

---

## Required for dry-run?

| Category | Required for dry-run inventory? |
|----------|----------------------------------|
| Full `env.ts` schema | **Yes** — loaded at import time via `confirmPayment` |
| `DATABASE_URL` | **Yes** — Prisma inventory queries |
| Stripe / Supabase / Hedera / encryption keys | **Yes for startup** — same module load; not all used in every dry-run row |
| `UPSTASH_REDIS_REST_URL` | **No** if unset — remove or fix; do not set to `""` |

Repair dry-run does not call Stripe APIs for most cohort rows, but the process still **must pass env validation** to start.

---

## Minimum `src/.env.local` changes (safe inventory dry-run)

Add or fix (use real values from your deployment secrets store; examples are shapes only):

```env
NEXT_PUBLIC_APP_URL=https://your-app.example.com
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://mainnet-public.mirrornode.hedera.com
ENCRYPTION_KEY=<32+ character secret used elsewhere in the app>
```

Fix optional Redis URL (choose one):

```env
# Option A: remove UPSTASH_REDIS_REST_URL entirely if unused locally
# Option B: set a valid URL
UPSTASH_REDIS_REST_URL=https://your-upstash-endpoint.upstash.io
```

Ensure existing entries remain for: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, etc.

**Production dry-run:** use read-replica `DATABASE_URL` if available; keep `--limit` small; do not pass `--execute` until reviewed.

---

## Verification

```bash
cd src
npx tsx scripts/historical-payment-repair.ts --limit=10
npx jest __tests__/config/env-validation-diagnostics.test.ts
```

When env is valid, the CLI prints the repair summary and writes `scripts/.repair-audit/historical-payment-repair-<timestamp>.json`.

---

## What was not changed

- Validation rules / schema strictness
- Bypass flags (`TEST_MODE`, `RELAX_ENV_VALIDATION`) behavior
- Historical repair logic
- Settlement or commission code

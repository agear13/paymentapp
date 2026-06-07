# Historical Payment Repair CLI — Analysis

**Date:** 2026-06-04

## Symptom

Running the repair CLI under plain Node failed immediately:

```text
Error: This module cannot be imported from a Client Component module.
It should only be used from a Server Component.

Import chain:
  historical-payment-repair.ts
    → historical-payment-repair.server.ts
      → import "server-only"
```

Command: `npx tsx scripts/historical-payment-repair.ts` (from `src/`)

## Root cause

The `server-only` package is a **Next.js build-time guard**. Its `index.js` unconditionally throws when loaded in non–Server Component contexts. That includes **tsx / plain Node scripts**, which are not part of the Next.js RSC graph.

The repair module was tagged with `import 'server-only'` to prevent accidental client bundling in Next.js. That is correct for App Router routes, but it blocks standalone script execution.

### Transitive `server-only` dependencies

Even after removing `server-only` from the repair module itself, the repair stack still imports:

| Module | `server-only` |
|--------|----------------|
| `commission-reconcile.server.ts` | Yes |
| `commission-metadata.server.ts` | Yes (via reconcile) |
| `bridge-invoice-settlement.server.ts` | Yes (via reconcile) |

Settlement helpers (`assisted-review-settlement.server.ts`, `manual-invoice-settlement.server.ts`) also use `server-only`, but repair only needed **provider ref string formatters** — not full settlement executors.

`confirmPayment()` and `@/lib/server/prisma` are already script-safe (prisma uses try/catch around `require('server-only')`).

## Can repair run from standalone Node?

**Yes**, when:

1. Repair logic lives in a module **without** `import 'server-only'`.
2. Provider ref helpers come from a **runtime-safe** module (`settlement-provider-refs.ts`).
3. The CLI registers a **no-op stub** for `server-only` before loading transitive `.server` modules (commission reconcile, funding bridge, metadata).

Repair behavior is unchanged: same `confirmPayment()` and `reconcileCommissionArtifactsForPaymentEvent()` calls, same idempotency and dry-run defaults.

## Refactor (implemented)

| File | Role |
|------|------|
| `historical-payment-repair.core.ts` | Full repair logic; no `server-only` |
| `historical-payment-repair.server.ts` | `import 'server-only'` + `export *` from core (Next.js) |
| `settlement-provider-refs.ts` | Shared `bank-review:`, `crypto-review:`, `manual-settlement:` refs |
| `scripts/lib/register-server-only-stub.ts` | Patches CJS `_load` to no-op `server-only` in scripts |
| `scripts/historical-payment-repair.ts` | Stub first → import **core**; `--help` added |

## What was not changed

- Repair algorithms and cohort classification
- `confirmPayment()` implementation
- Commission reconcile implementation
- Forward-path settlement routes

## CLI bootstrap order

1. `register-server-only-stub` (before any `.server` transitive import)
2. `--help` early exit (no dotenv / no repair module)
3. `dotenv` from `src/.env.local` then `src/.env`, then repo root
4. Dynamic `import()` of `historical-payment-repair.core` (after env is loaded)

## Environment requirements

The repair module pulls `confirmPayment` → full `env.ts` validation. The CLI needs the same variables as other `src/scripts/*` tools (`DATABASE_URL`, Stripe, Supabase, etc.) in `src/.env.local` or repo-root `.env.local`.

## Verification

```bash
cd src
npx tsx scripts/historical-payment-repair.ts --help
npx tsx scripts/historical-payment-repair.ts --limit=5
npx jest __tests__/payments/historical-payment-repair.test.ts
```

`--help` runs without database or env validation. Inventory dry-run requires a valid `src/.env.local`.

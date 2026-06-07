# Build Integrity Audit — Provvypay

**Audit date:** 2026-05-20  
**Objective:** Identify suppressed type safety and whether `typescript.ignoreBuildErrors` can be removed.

---

## Summary Verdict

| Question | Answer |
|----------|--------|
| Can `ignoreBuildErrors: true` be safely removed **today**? | **NO** |
| Full-repo `tsc --noEmit` error count | **698** errors |
| Scoped `npm run typecheck` (`tsconfig.operations.json`) | **PASS** (0 errors) |
| `@ts-ignore` / `@ts-expect-error` in `src/` | **0** occurrences |
| `eslint-disable` / hook deps suppressions | **~27** occurrences (mostly scripts/tests/UI) |

**Recommendation:** Do **not** flip `ignoreBuildErrors` until error count is driven down in phases (payments → referrals → xero JSON). Use CI `typecheck:repo` as a trending metric; keep `typecheck` (operations) as merge gate.

---

## Next.js Build Configuration

| Setting | File | Value | Risk |
|---------|------|-------|------|
| `typescript.ignoreBuildErrors` | `src/next.config.ts:17` | `true` | **CRITICAL** — production ships with type errors |
| `eslint.ignoreDuringBuilds` | `src/next.config.ts:12` | `true` | **HIGH** — ESLint not blocking Render builds (devDeps note in comment) |
| `skipLibCheck` | `src/tsconfig.json` | `true` | **LOW** — standard for app repos; does not skip app code |

Comment in `next.config.ts` cites debt in `lib/payments/*`, `lib/payment/edge-case-handler.ts`, Prisma JSON snapshots — aligns with `SECURITY_AND_SCALE.md`.

**Discrepancy:** `SECURITY_AND_SCALE.md` states `eslint.ignoreDuringBuilds = false`; **actual config is `true`**. Update doc or config for consistency.

---

## TypeScript Error Volume

Command executed:

```bash
cd src && npm run typecheck:repo
# tsc --noEmit → 698 lines matching "error TS"
```

**Implication:** Removing `ignoreBuildErrors` will **fail Render builds** until substantial remediation (estimated multi-week, not a launch-day toggle).

### Partial Strictness Already in Place

`tsconfig.operations.json` enforces strict checking on:

- `lib/operations/**`
- `app/api/operations/**`, `deal-network-pilot/**`
- Selected payout/funding/onboarding routes

This is the **correct pattern** for incremental hardening.

---

## Suppression Inventory

### `@ts-ignore` / `@ts-expect-error`

**None found** in `src/`. Good — no inline TypeScript suppression in application code.

### `eslint-disable` (representative)

| File | Line(s) | Explanation | Risk | Recommendation |
|------|---------|-------------|------|----------------|
| `lib/xero/invoice-service.ts` | 212, 215, 269 | `@typescript-eslint/no-explicit-any` for Xero payloads | MEDIUM | Type Xero SDK responses incrementally |
| `lib/xero/payment-service.ts` | 178 | same | MEDIUM | same |
| `lib/server/prisma.ts` | 14 | `no-require-imports` for optional bundle | LOW | Keep until Prisma lazy-load pattern replaced |
| `middleware.ts` | 217, 227, 259 | `no-console` for pilot diagnostics | LOW | Remove before GA or gate behind `DEBUG` |
| `components/dashboard/app-sidebar.tsx` | 89 | `any` on nav item | LOW | Type nav config |
| `hooks/use-project-context.ts` | 145 | exhaustive-deps | LOW | Fix deps or document |
| `deal-network-copilot-panel.tsx` | 124 | exhaustive-deps | LOW | same |
| `scripts/load-test-1000-users.ts` | multiple | await-in-loop, console | LOW | Scripts only — exclude from prod |
| `scripts/route-load-stepped.ts` | multiple | same | LOW | same |
| `__tests__/operations/*.tsx` | console in tests | LOW | Acceptable in tests |

### `transpileOnly`

**Not used** in production build path.

### Disabled Type Checking Paths

| Mechanism | Effect |
|-----------|--------|
| `ignoreBuildErrors: true` | Next build succeeds despite 698 TS errors |
| `RELAX_ENV_VALIDATION=1` | Dev/CI test placeholders — not production |
| `TEST_MODE=true` | Skips env validation for test endpoints |

---

## CI / Pre-Push Hooks

`package.json` `check:pre-push` runs:

- duplicate import scan
- circular deps scan
- **`npm run typecheck`** (operations only — **not** full repo)
- `test:operations`

**Gap:** Full repo typecheck is **not** a merge blocker.

---

## Risk Levels by Category

| Category | Risk | Notes |
|----------|------|-------|
| Shipping 698 unknown type errors | CRITICAL | Runtime surprises in payments/ledger |
| ESLint ignored on build | HIGH | Style/bug rules bypassed on deploy |
| Operations subset strict | LOW (positive) | Coordination/pilot paths better guarded |
| No ts-ignore in app code | LOW (positive) | Team not bypassing locally |

---

## Phased Remediation Plan (No Architecture Redesign)

### Phase A — Measure & gate (pre-launch)

1. Add CI job: `npm run typecheck:repo` — **allow failure** with published error count trend.
2. Fix `SECURITY_AND_SCALE.md` vs `next.config.ts` ESLint discrepancy.

### Phase B — Burn down (launch+30d)

1. Target `lib/payments/*`, `edge-case-handler.ts`, Stripe webhook route types.
2. Prisma JSON: use `Prisma.JsonValue` + zod parsers at boundaries.
3. Xero services: replace `any` with narrow interfaces.

### Phase C — Strict production build

1. When `typecheck:repo` → 0 errors: set `typescript.ignoreBuildErrors: false`.
2. Re-enable ESLint on build when devDeps available on Render (`--include=dev` already in buildCommand).

---

## Implementation Decision (This Audit)

Per constraints (**document before major code changes**) and measured **698 errors**:

- **`ignoreBuildErrors` was NOT changed** in this audit.
- Enabling strict builds without remediation would **block deployment** with no user-requested fix window.

---

## Files to Watch First (Highest Type Debt — Inferred)

- `src/lib/payments/**`
- `src/lib/payment/edge-case-handler.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/lib/referrals/commission-posting.ts`
- `src/lib/xero/**`
- Prisma client extensions / JSON metadata on `payment_events`, `payment_links`

Run `npm run typecheck:repo 2>&1 | Select-String "error TS" | Group-Object { ($_ -split '\(')[0] }` locally to prioritize files by error density.

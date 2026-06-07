# Launch Readiness Reassessment

**Date:** 2026-06-04  
**Baseline:** [launch-readiness-review.md](./production-readiness/launch-readiness-review.md) (2026-05-20, **62%** overall)  
**Completed remediations verified in codebase:** **R1** (manual settlement → `confirmPayment`), **R2** (status API cannot set `PAID`), **R5** (commission artifact reconcile on idempotent replay), **B1** (delete `GET /api/xero/debug` + UI link)  
**Method:** Documentation-only reassessment; spot-checks against current `src/` (no full route penetration retest).

---

## Executive summary

Launch posture improved from **62% → 68%** (same seven-dimension model as May). The largest gains are **workflow/financial controls** (R1, R2, R5) and **security/authorization** (B1). **No change** to operational job scheduling, TypeScript build safety, beta payout lockdown, or dual obligation / pilot projection models.

**Certification:** Still **NOT APPROVED** for unrestricted public launch of payouts, full Xero automation, and bank/crypto “mark valid” settlement. **Approved for a narrower GA** than May if marketing matches: Stripe/Wise/Hedera automated rails + operator manual settlement via `confirmPayment` + attribution (with R5 replay repair), **without** bank/crypto mark-valid as settlement truth.

---

## Recalculated scores

### Summary table (requested dimensions)

| Score | May 2026 baseline | Current (post R1, R2, R5, B1) | Δ |
|-------|-------------------|-------------------------------|---|
| **Launch readiness (overall)** | **62%** | **68%** | **+6** |
| **Workflow integrity** | **58** | **72** | **+14** |
| **Security** | **68** | **80** | **+12** |
| **Authorization** | **70** | **75** | **+5** |
| **Operational readiness** | **50** | **50** | **0** |

### Full seven-dimension model (May parity)

| Dimension | May | Current | Δ | Rationale |
|-----------|-----|---------|---|-----------|
| Infrastructure | 65 | 65 | 0 | Render web + Postgres; worker/cron still not assumed enabled |
| **Security** | 68 | **80** | +12 | B1 removes S-CR-01 / F-01; webhooks/crypto patterns unchanged; `ignoreBuildErrors` + global backfill remain |
| **Authorization** | 70 | **75** | +5 | No more any-user global debug read; sampled org RBAC intact; **backfill** still auth-only global |
| **Workflow integrity** | 58 | **72** | +14 | R1/R2 close PAID bypasses; R5 repairs commission on replay; R3/R4/R8/W-A1 open |
| Financial controls | 72 | 78 | +6 | Settlement idempotency + manual rail canonical; divergent paths remain |
| Observability | 52 | 52 | 0 | Sentry optional; alerting not codified |
| **Operational readiness** | 50 | **50** | 0 | B3 jobs; flaky E2E history; manual cron dependency |

**Overall launch readiness** = arithmetic mean of seven dimensions = **(65+80+75+72+78+52+50) / 7 ≈ 68%**.

---

## Remediations closed since May

| ID | What changed | Effect on scores |
|----|--------------|------------------|
| **R1** | `manual-settlement` → `confirmPayment({ provider: 'manual' })` | Workflow +6, Financial +4 |
| **R2** | Status API blocks `PAID` (`PAID_TRANSITION_BLOCKED_CODE`) | Workflow +4, Financial +2 |
| **R5** | `reconcileCommissionArtifactsForPaymentEvent` on `alreadyProcessed` / provider idempotency | Workflow +4; former **B4** downgraded |
| **B1** | `src/app/api/xero/debug/route.ts` deleted; UI link removed | Security +12, Authorization +5 |

---

## Remaining launch blockers (re-ranked)

Only issues that **still exist** in the current codebase. Former **B1** and payment-path bypasses **omitted**.

| Rank | ID | Blocker | Severity | Impact | Likelihood | Effort | Evidence (current) |
|------|-----|---------|----------|--------|------------|--------|---------------------|
| **1** | **B2** | TypeScript **698+ errors** + `ignoreBuildErrors: true` in `next.config.ts` | **P0** | Critical | High | Large | Build can ship unsafe payment/ledger casts |
| **2** | **B3** | Background jobs **not scheduled** (Xero queue, integrity, stuck payments, reconciliation) | **P0** | High | High (if features on) | Medium | `operational-readiness-audit.md`; Render cron/worker gap |
| **3** | **R3** | Bank/crypto **`mark_valid` → `PAID`** without `confirmPayment` | **P0** (if rails GA) | Critical | High when used | Medium | `manual-bank-confirmations/.../review`, `crypto-confirmations/.../review` |
| **4** | **B5** | Production **env hardening** not verified (placeholders, `STRIPE_WEBHOOK_SECRET=disabled`, missing `CRON_SECRET`) | **P0** | Critical | Medium | Small | `security-audit.md` S-HI-01 / runtime validation |
| **5** | **B6** | **`BETA_LOCKDOWN_MODE`** default vs marketed GA payouts / release | **P0** (product) | High | Certain if mis-marketed | Small (decision) | Payout batch API beta gate |
| **6** | **R4** | **Hedera verify** bypasses `confirmPayment` (inline event + ledger) | **P0** | Critical | Medium | Medium | `hedera/transactions/verify/route.ts` |
| **7** | **Backfill** | **`POST/GET /api/xero/queue/backfill`** — global PAID scan; UI `organizationId` ignored | **P1→P0** if Xero GA | Critical (tenant) | Medium | Medium | `queue/backfill/route.ts`; related to B1 class |
| **8** | **B4′** | Commission **items skip** on first-run `createdObligation` guard; reconcile **not** on same-request failure | **P1** | High | Low–Medium | Low | `commission-posting.ts` ~718; R5 mitigates on **replay only** |
| **9** | **W-A1** | **Dual obligation stores** (pilot vs `commission_obligations` / items) | **P1** | High | High | High | Unchanged architecture |
| **10** | **R8** | Pilot deal **`paymentStatus: Paid`** without `payment_events` | **P1** | High | Medium | High | Deal network UI / refresh |
| **11** | **R10** | Parallel **Supabase** referral `payment_completed` vs Prisma commission | **P1** | High | Low–Medium | High | Dual stack |
| **12** | **R11** | **Repair utilities** can promote `PAID` without `confirmPayment` (`STATUS_MISMATCH`) | **P2** | Medium | Low | Medium | `repair-utilities.ts` |
| **13** | **R6** | Legacy **`confirmHederaPayment`** alternate writer | **P2** | Medium | Low | Low | `hedera/payment-confirmation.ts` |
| **14** | **Historical** | **PAID** rows without `PAYMENT_CONFIRMED` (pre-R1 manual / status API) | **P2** | Medium | Medium (legacy) | Medium | Integrity checks; backfill/repair |

### Removed from blocker list (resolved)

| Former blocker | Status |
|----------------|--------|
| **B1** `GET /api/xero/debug` cross-tenant leak | **Resolved** — route deleted; tests in `xero-debug-removed.test.ts` |
| Operator manual **PAID without settlement** (R1) | **Resolved** for new operations |
| Status API **PAID bypass** (R2) | **Resolved** for new operations |
| Permanent **commission gap on webhook replay** (R5) | **Mitigated** — reconcile on idempotent paths; not full B4 |

---

## High-priority (non-blocker) — still open

| Item | Still exists? |
|------|----------------|
| H1 Sentry + P0 alerts | Yes |
| H2 Auth matrix CI for all routes | Yes |
| H3 Pilot data org tenancy | Yes |
| H4 Diagnostic console noise | Yes |
| H5 Canonical financial truth documentation | Partial |
| H6 Load test / RPS limits | Yes |
| H7 Playwright stability | Yes |
| M5 Historical `commission_obligation_items` backfill | Yes |
| M6 Xero worker enablement | Same as B3 |

---

## Smallest safe launch slice (updated)

**In scope after R1, R2, R5, B1:**

- Payment links + **Stripe** (and **Wise/Hedera** where `confirmPayment` is the only settlement path)  
- **Operator manual mark paid** (canonical `confirmPayment`)  
- Referral attribution reporting (with awareness of R13 first-run edge + historical backfill)  
- Integrations Xero **connection** + org-scoped sync stats/failed views  

**Out of scope until blockers 3, 4, 6, 7 addressed:**

- Merchant **bank/crypto “Mark valid”** as financial settlement  
- **Hedera mirror verify** as settlement  
- Claims of **fully automated Xero books** without B3/M6  
- **Mass partner payout / release** without B6 decision  

---

## Sign-off checklist (current)

| Item | Status |
|------|--------|
| B1 xero/debug remediated | **Done** |
| R1 manual → confirmPayment | **Done** |
| R2 status API PAID blocked | **Done** |
| R5 commission reconcile on replay | **Done** |
| B3 cron / jobs | **Open** |
| B4 commission items (first-run) | **Partial** (R5 replay) |
| B5 env checklist on Render | **Open** |
| B6 beta lockdown documented | **Open** |
| B2 typecheck / strict build | **Open** |
| R3 / R4 payment path convergence | **Open** |
| Backfill org scope | **Open** |

**Certification status:** **NOT APPROVED** for full public launch — **narrower controlled GA** acceptable if feature matrix matches table above and blockers **1–7** are accepted risks or scheduled fixes with dates.

---

## References

| Document | Role |
|----------|------|
| [launch-readiness-review.md](./production-readiness/launch-readiness-review.md) | May baseline (62%) |
| [workflow-correctness-reassessment.md](./workflow-correctness-reassessment.md) | R1/R2/R5 (71 workflow pre-B1) |
| [b1-removal-impact.md](./b1-removal-impact.md) | B1 completion |
| [payment-path-remediation-plan.md](./payment-path-remediation-plan.md) | Open R3–R11 |

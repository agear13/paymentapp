# Payment Path Remediation Plan

**Prerequisite:** Read `canonical-payment-lifecycle.md` for the full pathway map.  
**Goal:** Close divergences so operator and automated paths share one settlement truth.  
**No implementation in this document** — planning only.

---

## Remediation principles

1. **No new `PAID` writers** outside `confirmPayment()` (or a thin wrapper that only calls it).
2. **`PAYMENT_CONFIRMED` is created only inside** the same transaction as ledger settlement (today: `confirmPayment` txn).
3. **Manual / bank / crypto “mark valid”** must call `confirmPayment({ provider: 'manual', ... })` with synthetic provider ref + amount, not only `transitionPaymentLinkState`.
4. **Deprecate** `confirmHederaPayment` and inline verify ledger posting; route through `confirmPayment`.
5. **Replay safety:** commission + obligation items must upsert on idempotent payment replay.

---

## Ranked divergences

### CRITICAL

#### R1 — Operator manual settlement marks PAID without settlement

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `OPEN → PAID` with Xero + funding but no `PAYMENT_CONFIRMED`, ledger, or commission |
| **Route** | `POST /api/payment-links/[id]/manual-settlement` (`mark_paid`) |
| **File** | `src/app/api/payment-links/[id]/manual-settlement/route.ts` |
| **Risk** | Invoice shows paid; books and partner earnings empty; Xero may record payment anyway |
| **Complexity** | **Medium** — wire to `confirmPayment` with `provider: 'manual'`, amount from link |
| **Affected files** | `manual-settlement/route.ts`, `payment-confirmation.ts` (accept manual provider), possibly `posting-rules` for manual rail |
| **Migration risk** | **Medium** — historical PAID-without-event rows need backfill or integrity repair |

#### R2 — Generic status API can set PAID without any settlement

| Attribute | Detail |
|-----------|--------|
| **Divergence** | Authenticated `POST .../status` with `{ status: "PAID" }` |
| **File** | `src/app/api/payment-links/[id]/status/route.ts` |
| **Risk** | Permissioned users can bypass all financial propagation |
| **Complexity** | **Low** — forbid transition to `PAID` here; require `manual-settlement` or `confirmPayment` |
| **Affected files** | `status/route.ts`, API docs, UI that calls status endpoint |
| **Migration risk** | **Low** if UI already uses manual-settlement; **High** if integrations use status API for PAID |

#### R3 — Bank/crypto `mark_valid` → PAID without confirmPayment

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `PAID_UNVERIFIED\|REQUIRES_REVIEW → PAID` only via state machine |
| **Files** | `manual-bank-confirmations/[id]/review/route.ts`, `crypto-confirmations/[id]/review/route.ts` |
| **Risk** | Merchant believes invoice settled; no ledger/commission; referral conversion only if stray `PAYMENT_CONFIRMED` exists |
| **Complexity** | **Medium** — on `mark_valid`, call `confirmPayment` with manual provider + submission metadata |
| **Affected files** | Both review routes, `payment-confirmation.ts`, submission services (pass amounts/refs) |
| **Migration risk** | **High** for in-flight unverified invoices mid-migration |

#### R4 — Hedera manual verify bypasses confirmPayment

| Attribute | Detail |
|-----------|--------|
| **Divergence** | Creates `PAYMENT_CONFIRMED` + ledger inline; no commission/funding |
| **File** | `src/app/api/hedera/transactions/verify/route.ts` |
| **Risk** | Split-brain with checker path that uses `confirmPayment`; duplicate posting styles |
| **Complexity** | **Medium** — replace body with `confirmPayment` call after mirror validation |
| **Affected files** | `verify/route.ts`, possibly remove duplicate ledger writes |
| **Migration risk** | **Medium** — verify idempotency keys align with checker path |

#### R5 — confirmPayment replay skips commission repair

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `alreadyProcessed === true` → no `applyRevenueShareSplits` |
| **File** | `src/lib/services/payment-confirmation.ts` |
| **Risk** | First partial failure leaves permanent ledger/obligation gap |
| **Complexity** | **Low–Medium** — always run idempotent commission reconcile on replay |
| **Affected files** | `payment-confirmation.ts`, `commission-posting.ts` |
| **Migration risk** | **Low** — additive heal behavior |

---

### HIGH

#### R6 — Legacy `confirmHederaPayment` alternate settlement writer

| Attribute | Detail |
|-----------|--------|
| **Divergence** | Separate txn; ledger errors swallowed; no commission |
| **File** | `src/lib/hedera/payment-confirmation.ts` |
| **Risk** | Reintroduction via batch/repair calls creates duplicate or partial settlement |
| **Complexity** | **Low** — delete or delegate to `confirmPayment`; keep `retryLedgerPosting` only |
| **Affected files** | `hedera/payment-confirmation.ts`, `repair-utilities.ts` imports |
| **Migration risk** | **Low** if unused; confirm no production caller |

#### R7 — Xero queued on manual PAID without ledger

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `manual-settlement` queues Xero when feature on |
| **File** | `manual-settlement/route.ts` |
| **Risk** | External accounting shows payment; platform ledger does not |
| **Complexity** | **Low** once R1 fixed (queue only after confirmPayment) |
| **Affected files** | `manual-settlement/route.ts`, `xero/queue-service.ts` |
| **Migration risk** | **Medium** — reconcile Xero vs platform for historical rows |

#### R8 — Pilot deal `paymentStatus: Paid` without payment_events

| Attribute | Detail |
|-----------|--------|
| **Divergence** | Client-side deal status drives `legacyMoney` in obligation refresh |
| **Files** | `deal-network/page.tsx`, `deal-network-pilot-obligations.ts` |
| **Risk** | Obligations show funded/paid without invoice settlement |
| **Complexity** | **High** — tie funding to `PAYMENT_CONFIRMED` or project funding sources only |
| **Affected files** | Deal network UI, pilot obligations, funding servers |
| **Migration risk** | **High** — demo/production pilot data may rely on legacy flag |

#### R9 — Pilot manual PAYMENT_CONFIRMED without payment_link

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `createManualPilotDealPaymentEvent` — allowed by CI allowlist |
| **File** | `pilot-deal-payment-events.server.ts`, `payment-events/route.ts` |
| **Risk** | Funding graph treats deal as funded without invoice |
| **Complexity** | **Medium** — require link to real `confirmPayment` event or mark as demo-only |
| **Affected files** | Pilot API routes, funding bridge |
| **Migration risk** | **Medium** for pilot users using manual funding entry |

#### R10 — Parallel Supabase referral `payment_completed` ledger

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `POST /api/referrals/payment-completed` writes Supabase ledger, not Prisma |
| **Files** | `payment-completed/route.ts`, `partners-integration.ts`, `payment-conversion.ts` |
| **Risk** | Double attribution if both stacks run for same payment |
| **Complexity** | **High** — consolidate on Prisma commission path or gate Supabase writes |
| **Affected files** | Referral API suite, payment-confirmation hook |
| **Migration risk** | **High** — partners history in Supabase |

---

### MEDIUM

#### R11 — Repair utilities promote PAID without confirmPayment

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `STATUS_MISMATCH` repair → `PAID` |
| **File** | `src/lib/data/repair-utilities.ts` |
| **Complexity** | **Medium** — repair should invoke `confirmPayment` or reopen, not status-only |
| **Migration risk** | **Low** — admin-only |

#### R12 — `PAID_UNVERIFIED` treated as “paid” in UX

| Attribute | Detail |
|-----------|--------|
| **Divergence** | Payer submission states; success page messaging |
| **Files** | `crypto-submission-service.ts`, `manual-bank-submission-service.ts`, public pay UI |
| **Complexity** | **Low** — copy/UI clarity; optional blockers on reporting |
| **Migration risk** | **Low** |

#### R13 — Commission obligation items skipped on idempotent obligation create

| Attribute | Detail |
|-----------|--------|
| **Divergence** | `createdObligation` guard in `commission-posting.ts` |
| **Complexity** | **Low** — upsert items on replay |
| **Migration risk** | **Low** — backfill script for historical |

#### R14 — Hedera verify / legacy path: no funding orchestration

| Attribute | Detail |
|-----------|--------|
| **Divergence** | Missing `orchestrateFundingAfterInvoiceSettlement` |
| **Complexity** | **Low** after R4 |
| **Migration risk** | **Low** |

#### R15 — Internal status poll auto-expire only

| Attribute | Detail |
|-----------|--------|
| **Note** | `GET .../status` can `OPEN → EXPIRED` — not a false PAID |
| **Complexity** | N/A |
| **Migration risk** | None |

---

### LOW

#### R16 — Legacy `confirmHederaPayment` in approved writers list

| Attribute | Detail |
|-----------|--------|
| **File** | `scripts/check-forbidden-payment-state-mutations.js` |
| **Complexity** | **Low** — remove from approved list when code deleted |
| **Migration risk** | None |

#### R17 — Seed / test PAYMENT_CONFIRMED writers

| Attribute | Detail |
|-----------|--------|
| **Files** | `seed.ts`, `refund-atomicity` test route |
| **Complexity** | **Low** — keep allowlisted |
| **Migration risk** | None in production |

#### R18 — Payout `mark-paid` naming collision

| Attribute | Detail |
|-----------|--------|
| **Note** | Partner payout PAID ≠ invoice PAID — documentation/training |
| **Complexity** | **Low** |
| **Migration risk** | None |

#### R19 — Deal obligation / commission “PAID” enums

| Attribute | Detail |
|-----------|--------|
| **Note** | Separate lifecycle; document in operator runbook |
| **Complexity** | **Low** (docs) |
| **Migration risk** | None |

#### R20 — HuntPay conversion approve

| Attribute | Detail |
|-----------|--------|
| **Note** | Separate product surface |
| **Complexity** | **Medium** if unified with referrals |
| **Migration risk** | **Medium** |

---

## Suggested implementation phases

### Phase 0 — Observability (no behavior change)

- Run `integrity-checks` / `ledger-integrity` job; export `PAID_WITHOUT_PAYMENT_CONFIRMED` count.
- Admin report: links by settlement path (event metadata `source` / `confirmPayment:${provider}`).

### Phase 1 — Block new divergences (CRITICAL)

1. R2 — Disallow `PAID` via status API.
2. R1 — Manual settlement → `confirmPayment`.
3. R3 — Bank/crypto mark_valid → `confirmPayment`.
4. R4 — Hedera verify → `confirmPayment`.

### Phase 2 — Replay and repair (CRITICAL/HIGH)

5. R5 + R13 — Commission reconcile on replay + item upsert.
6. R11 — Repair utilities call confirm or revert status.
7. R6 — Remove legacy Hedera confirmation.

### Phase 3 — Data and parallel stacks (HIGH)

8. R7 — Xero only after ledger exists.
9. R8 + R9 — Pilot funding truth tied to real events.
10. R10 — Referral ledger consolidation strategy.

### Phase 4 — Hardening (MEDIUM/LOW)

11. CI guard: fail build on new `targetState: 'PAID'` outside allowlist.
12. Docs/runbooks for payout vs invoice PAID (R18–R19).

---

## Complexity summary

| Rank | Count | Est. eng effort |
|------|-------|-----------------|
| CRITICAL | 5 | 2–4 weeks focused |
| HIGH | 5 | 2–3 weeks (pilot + referral highest) |
| MEDIUM | 5 | 1 week |
| LOW | 5 | Days (mostly docs/guards) |

---

## Migration risk matrix

| Risk level | Items | Mitigation |
|------------|-------|------------|
| **High** | R3, R8, R10 | Feature flags; backfill scripts; operator comms |
| **Medium** | R1, R4, R7, R9 | Staged rollout; integrity repair job |
| **Low** | R2, R5, R6, R11, R13 | Immediate or additive |

---

## Acceptance criteria (canonical achieved)

- [ ] Zero new `payment_links.status = PAID` without a matching `PAYMENT_CONFIRMED` in the same logical operation.
- [ ] All `PAYMENT_CONFIRMED` rows for payment links created only via `confirmPayment` (except seed/test allowlist).
- [ ] Every `PAYMENT_CONFIRMED` on a payment link has balanced settlement ledger entries in the same transaction.
- [ ] Commission propagation runnable on idempotent replay (admin trace shows items).
- [ ] Integrity check `PAID_WITHOUT_PAYMENT_CONFIRMED` → 0 in production (or documented exceptions).
- [ ] Operator runbook lists one “Mark invoice paid” flow (converges all side effects).

---

## Related documents

- `docs/canonical-payment-lifecycle.md` — full pathway map
- `docs/production-readiness/workflow-consistency-audit.md` — obligation/commission drift
- `src/lib/payments/integrity-checks.ts` — automated divergence detection
- `scripts/check-forbidden-payment-state-mutations.js` — CI guard for status mutations

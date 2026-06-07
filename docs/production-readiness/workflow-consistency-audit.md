# Workflow Consistency Audit — Provvypay

**Audit date:** 2026-05-20  
**Focus:** Business correctness, state drift, idempotency — not infrastructure.

---

## 1. Agreement Extraction → Financial Propagation

### Expected propagation chain

```
AI extract / manual onboarding
  → deal_network_pilot_deals + participants
  → obligations (pilot projection)
  → payment link / checkout metadata
  → PAYMENT_CONFIRMED (payment_events)
  → applyRevenueShareSplits (commission-posting.ts)
  → ledger_entries + commission_obligations + commission_obligation_items
  → attribution-earnings API → Participant Earnings UI
```

### Findings

| ID | Finding | Risk | Detail |
|----|---------|------|--------|
| W-A1 | **Dual obligation stores** | HIGH | `deal_network_pilot_obligations` (UI) vs `commission_obligations` (financial). Refresh can drift from ledger truth. |
| W-A2 | **Attribution excluded from pilot obligation projection** | MEDIUM (by design) | Attribution uses `commission_obligation_items`; pilot refresh excludes attribution participants — correct split if documented for ops. |
| W-A3 | **`commission_obligation_items` only on `createdObligation`** | HIGH | In `commission-posting.ts` ~718: idempotent replay (`P2002`) skips item creation while ledger may exist → **Attribution UI empty despite ledger** |
| W-A4 | Legacy path writes `commission_obligation_lines` not `items` | MEDIUM | Old payments may show in ledger but not attribution-earnings query |
| W-A5 | `stripe_event_id` on obligations uses `payment_events.id` UUID when via confirmPayment | LOW | Operators searching `pi_*` must use admin trace tool |

### State drift risks

- Pilot obligation **refresh** racing with webhook posting → transient wrong statuses on obligations page (mitigated: obligations API returns degraded 200, not hard fail).
- Onboarding partial complete → coordination graph **not converged** → release disabled but attribution view now decoupled.

### Recommendations

1. **P0:** On obligation idempotent hit, **upsert** `commission_obligation_items` from ledger/split metadata (no `createdObligation`-only guard).
2. **P1:** Single operator-facing source for attribution balances (always read `commission_obligation_items` + reconcile job).
3. **P2:** Backfill script for historical payments missing items.

---

## 2. Coordination Layer

### State transitions

| Component | Mechanism |
|-----------|-----------|
| Operational graph | `resolveOperationalCoordinationSnapshot` |
| Initialization | `resolveOperationalInitializationSnapshot` when `includeInitialization=true` |
| Release gating | `deriveReleaseBatchEligibility`, `deriveReleaseInteractionState` |
| Funding mutations | `operational-mutation-orchestrator` + audit entries |

### Findings

| ID | Finding | Risk |
|----|---------|------|
| W-C1 | Graph convergence required for settlement actions | MEDIUM — intentional beta safety; confusing if marketing claims full payouts at launch |
| W-C2 | `canQueryReferralCommissionLedger` still tied to beta settlement | LOW — referral **history** hidden; attribution decoupled separately |
| W-C3 | Participant persistence across onboarding steps | MEDIUM — race if two tabs bootstrap same project |
| W-C4 | Approval workflows (pilot invites) | LOW — token-based; org binding on approve needs verification (**UNKNOWN**) |

### Missing validation

- No explicit guard preventing funding source delete when active allocations exist (**UNKNOWN** — verify `funding-sources/[sourceId]` DELETE handler).

### Race conditions

- Concurrent `POST /api/payout-batches/create` — mitigated by graph eligibility + DB constraints (**partial**).
- Coordination snapshot polled from UI while webhook updates payment — UI may flash stale graph until refetch.

---

## 3. Revenue Share Engine

### Flow

```
referral_link_splits / metadata
  → Stripe session metadata
  → webhook / confirmPayment
  → applyRevenueShareSplits
  → provisionCommissionLedgerAccounts
  → ledger DR/CR
  → commission_obligations (+ items if createdObligation)
```

### Findings

| ID | Finding | Risk |
|----|---------|------|
| W-R1 | Commission basis GROSS vs NET | MEDIUM — misconfiguration in metadata causes wrong amounts |
| W-R2 | Multi-level splits | MEDIUM — complex metadata parsing; contract tests exist for extraction, not all payment paths |
| W-R3 | Idempotent ledger posting | LOW (positive) | Ledger service designed webhook-safe |
| W-R4 | Payout generation from obligations | HIGH when beta on | Beta lockdown blocks batch create for normal operators |

### Edge cases

- Refund after commission posted → `postStripeRefundReversal` path; test endpoint exists non-prod.
- Zero-amount or micro-amount payments (e.g. $0.10) — rounding and minimum display thresholds in UI.
- Payment without referral metadata — skips splits; no obligation — **correct**.

---

## 4. Payment Processing

### Invoice / payment link lifecycle

| State | Driver |
|-------|--------|
| DRAFT → SENT → PAID / EXPIRED / CANCELED | `transitionPaymentLinkState` |

### Payment lifecycle

```
Stripe webhook → duplicate check → payment lock → confirmPayment → payment_events PAYMENT_CONFIRMED
```

| ID | Finding | Risk |
|----|---------|------|
| W-P1 | Duplicate webhook handling | LOW (positive) | `webhook_events` + `checkDuplicatePayment` |
| W-P2 | Payment lock acquire/release | MEDIUM | Failure path must release lock — verify in edge-case-handler |
| W-P3 | Manual bank / crypto confirmation | MEDIUM | Separate review queues; must not double-settle with Stripe |
| W-P4 | Wise rail | MEDIUM | Demo flag `NEXT_PUBLIC_SHOW_WISE_DEMO` may show UI without backend |

### Settlement lifecycle

- Payout batches: create → submit → Hedera optional → mark paid/failed.
- **Beta lockdown** prevents general availability.

### Accounting sync (Xero)

| ID | Finding | Risk |
|----|---------|------|
| W-X1 | Async queue `xero_syncs` | HIGH if jobs not scheduled | Worker disabled on Render |
| W-X2 | Failed sync retry | MEDIUM | `xero/sync/replay`, `failed` routes exist |
| W-X3 | Sync without org filter in debug | CRITICAL | See tenant audit |

---

## 5. Duplicated State Summary

| Domain | Copy A | Copy B | Drift symptom |
|--------|--------|--------|---------------|
| Obligations | `commission_obligations` | `deal_network_pilot_obligations` | Earnings page ≠ ledger |
| Payment links API | v1 | v2 | Feature parity bugs |
| Commissions UI | `/dashboard/payouts/commissions` | `/dashboard/partners/commissions` | Duplicate UX |
| Ledger views | `/dashboard/ledger` | partners/platform ledger | Same data, different nav |

---

## 6. Workflow Test Coverage Gaps

| Workflow | Automated coverage |
|----------|-------------------|
| Operational graph / release | `test:operations` Jest suite — **good** |
| Commission propagation | Admin trace + script; **no** CI golden-path for items |
| Stripe webhook E2E | Playwright critical flows — **flaky** per SECURITY_AND_SCALE |
| Xero sync E2E | **weak** |

---

## Business Correctness Launch Gates

**Must fix before claiming accurate participant earnings:**

1. W-A3 obligation items on idempotent replay  
2. W-A1 operator documentation: which screen is financial truth  

**Must fix before claiming settlement at GA:**

1. W-R4 beta lockdown policy (`BETA_LOCKDOWN_MODE`)  
2. W-X1 job scheduling for Xero queue  

---

## Overall Workflow Integrity Score (Auditor Estimate)

**58 / 100** — core payment→ledger path is strong; projection layers and idempotent commission items undermine operator trust.

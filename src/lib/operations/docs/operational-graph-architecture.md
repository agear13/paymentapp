# Operational Graph Architecture

The payouts/operations subsystem is governed by **one authoritative operational graph**. All UI surfaces are projections over this graph — not independent calculators.

## Core principle

**THE GRAPH IS THE SYSTEM.**

Every operational surface must derive from:

- `getOperationalCoordinationSnapshot()` — authoritative server graph
- `deriveOperationalReadinessHierarchy()` — layered readiness
- `deriveParticipantReleaseEligibility()` — release/batch eligibility
- `operational-graph-adapter.ts` — legacy UI compatibility only

## Orchestration lifecycle

Every operational mutation follows this contract:

1. **Persist mutation** (database / pilot snapshot)
2. **Refresh obligations** (`refreshDealNetworkPilotObligationsForDeal`)
3. **Resolve graph** (`resolveOperationalCoordinationSnapshot`)
4. **Emit canonical event** (`operationalEventFromMutation`)
5. **Recompute graph** (`executeStrictOperationalOrchestration`)
6. **Validate invariants** (`assertOperationalInvariants` — development only)
7. **Emit completion** (`SYNCHRONIZATION_COMPLETED`)
8. **Propagate to clients** (event bus + audit store + workspace invalidation)

Entry point: `orchestrateOperationalMutation()` in `operational-mutation-orchestrator.server.ts`

## Readiness hierarchy

Four layers, derived in `readiness-hierarchy.ts`:

| Layer | Question |
|-------|----------|
| Participant | Can participant receive payouts? |
| Obligation | Can obligations be generated? |
| Funding | Can obligations be funded? |
| Release | Can payout releases be generated? |

## Funding lifecycle

Canonical states in `funding-lifecycle.ts`:

`UNLINKED → SOURCE_CONNECTED → FUNDING_RESERVED → FUNDING_SETTLED → RELEASE_FUNDED → RELEASED`

## Agreement lifecycle

`DRAFT → SHARED_FOR_APPROVAL → VIEWED_BY_PARTICIPANT → APPROVED_BY_PARTICIPANT → OPERATOR_CONFIRMED → READY_FOR_PAYOUT`

Only `SHARED_FOR_APPROVAL` and `VIEWED_BY_PARTICIPANT` links can approve. Copy/view never mutate lifecycle.

## Release eligibility

Single selector: `deriveParticipantReleaseEligibility()`

Used by:

- Release batch preview (`/api/operations/release-batch-eligibility`)
- Batch creation gate (`/api/payout-batches/create`)
- Coordination snapshot summaries

## Audit event system

- **Server derivation**: `deriveAuditTimelineFromGraph()` from persisted participant state
- **Mutation audit**: `auditEntryFromOperationalEvent()` on each orchestrated mutation
- **Client store**: `useOperationalAuditStore()` — shared across all surfaces
- **UI**: `OperationalActivitySection` / `OperationalAuditTimeline`

## Event propagation

- Server returns `operationalSync` payload with `operationalEvent`, `completionEvent`, `auditEntry`
- Client: `applyOperationalSyncRefresh()` → event bus (deduped) → audit store → workspace refresh
- Project workspace: `subscribeProjectOperationalEvents()` in `use-project-context.ts`

## Graph ownership rules

**DO:**

- Consume graph via `/api/operations/coordination-snapshot` or server resolver
- Use graph adapters for legacy activation/guidance shapes
- Wire all mutations through `orchestrateOperationalMutation()`

**DO NOT:**

- Count payout-ready participants locally for release decisions
- Derive blockers outside `deriveOperationalBlocker()` / graph snapshot
- Bypass orchestration on operational mutations
- Add page-local readiness heuristics

## Development diagnostics

- `OperationalGraphDiagnostics` — floating dev panel (NODE_ENV=development)
- `assertOperationalInvariants()` — throws on impossible states
- `assertBatchInvariants()` — release batch consistency
- `warnOperationalInconsistency()` — non-fatal diagnostics

## Legacy deprecation

Deprecated selectors live in `lib/operations/legacy/legacy-operational-selectors.ts`. New code must not import these directly — use graph adapters instead.

## Key files

| File | Purpose |
|------|---------|
| `selectors/operational-coordination-snapshot.ts` | Authoritative graph |
| `selectors/resolve-operational-coordination.server.ts` | Server resolver |
| `selectors/operational-graph-adapter.ts` | UI adapters |
| `selectors/derive-release-batch-eligibility.ts` | Batch eligibility |
| `orchestration/operational-mutation-orchestrator.server.ts` | Mutation entry |
| `orchestration/strict-operational-orchestration.ts` | 7-step contract |
| `orchestration/operational-sync-client.ts` | Client propagation |
| `audit/derive-audit-timeline-from-state.ts` | Persisted audit derivation |
| `hooks/use-operational-audit-store.ts` | Shared audit timeline |

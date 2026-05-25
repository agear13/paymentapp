# Operational Graph Guardrails

**THE GRAPH IS THE SYSTEM.**

This document defines engineering rules that protect the operational coordination architecture from regression, bypass, and silent drift.

## Canonical ownership

| Concern | Owner | Do not duplicate in |
|---------|--------|---------------------|
| Operational truth | `getOperationalCoordinationSnapshot()` | Page components, hooks, API handlers |
| Release eligibility | `deriveParticipantReleaseEligibility()` | Settlements UI, batch dialogs |
| Readiness hierarchy | `deriveOperationalReadinessHierarchy()` | Project cards, hub summaries |
| Funding lifecycle | `deriveCanonicalFundingLifecycle()` | Treasury panels, local heuristics |
| Agreement lifecycle | `canonical-agreement-lifecycle.ts` | Invite pages, agreement panels |
| Blockers | `deriveOperationalBlocker()` / graph snapshot | Attention strips, local counts |
| Mutations | `orchestrateOperationalMutation()` | Direct DB writes without sync |

## No local readiness derivations

UI surfaces are **projections** over the graph:

- Use `/api/operations/coordination-snapshot` or server resolver
- Use `useOperationalGuidance()` + graph adapters on the client
- Pass `graphSummary` into `summarizeProject()` — never `countPayoutReadyParticipants()` for release decisions

## No duplicate payout eligibility systems

Release batch preview, project hub counts, and batch creation gates must all consume:

- `deriveReleaseBatchEligibility()` (server)
- `/api/operations/release-batch-eligibility` (client)

## No screen-level orchestration

Every operational mutation must:

1. Persist change
2. Call `orchestrateOperationalMutation()`
3. Return `operationalSync` payload
4. Client applies `applyOperationalSyncRefresh()`

No silent mutations. No “save and hope the UI refreshes.”

## Orchestration contract

`executeStrictOperationalOrchestration()` enforces:

- Event emission (`operationalEventFromMutation`)
- Graph invalidation scopes
- Invariant checks (development)
- `SYNCHRONIZATION_COMPLETED` audit completion

## Graph synchronization rules

- Server returns `operationalSync` on every orchestrated route
- Client event bus dedupes rapid replays (500ms)
- Project workspace subscribes via `subscribeProjectOperationalEvents()`
- Audit timeline merges server-derived + mutation entries in shared store

## Invariant philosophy

Development-only assertions in `operational-invariants.ts` fail loudly on impossible states:

- Release-ready without agreement
- Batch created with zero eligible participants
- Approved + configured participant without obligations
- Stale synchronization timestamps

Production: log/warn, do not throw.

## Mutation orchestration requirements

Routes that touch participants, funding, obligations, agreements, or payouts **must** orchestrate. See `operational-mutation-orchestrator.server.ts`.

## Event bus guarantees

- One canonical event per mutation
- One completion event per orchestration
- Client propagation via `operational-sync-client.ts`
- No page-local event systems

## Readiness hierarchy ownership

Four layers — participant → obligation → funding → release — derived only in `readiness-hierarchy.ts`. UI explains; it does not compute.

## CI protection

The following must pass before deploy:

| Stage | Script |
|-------|--------|
| Typecheck (ops graph) | `npm run typecheck` |
| Duplicate imports | `npm run check:duplicate-imports` |
| Circular deps (ops core) | `npm run check:circular-deps` |
| Operations tests | `npm run test:operations` |
| Production build | `npm run build` |

Optional local: `npm run check:pre-push`

## Further reading

- Architecture: `src/lib/operations/docs/operational-graph-architecture.md`
- Legacy (deprecated): `src/lib/operations/legacy/legacy-operational-selectors.ts`

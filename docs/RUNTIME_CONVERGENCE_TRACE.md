# Runtime convergence trace map

Persisted DB/participant rows are authoritative. Events and `graphReady` are informational only.

## Single intended pipeline

```
Persisted entities (DB / workspace provider)
  → GET /api/operations/coordination-snapshot  (always resolves graph)
  → GET /api/workspace/activation            (always resolves graph)
  → useOperationalGuidance → effectiveGraph
  → useCanonicalOperationalState → reduceOperationalState
  → useOperationalCoordinationState → { kpis, blockers, activation, workspaceContext }
  → UI
```

Project-scoped pages may additionally pass `options.participants` + `treasury` into the same hook (local seed only when API graph is still empty).

---

## Per-symptom trace

### 1. "0 payout ready"

| Stage | Source |
|-------|--------|
| **Persisted truth** | `participant.payoutVerificationConfirmed`, `approvalStatus`, `compensationProfile` |
| **Reducer KPI** | `deriveOperationalKPIsFromParticipants` — `compensationConfigured && agreementApproved && payoutConfirmed` |
| **UI surfaces** | |

| Surface | Hook | Rendered value |
|---------|------|----------------|
| Participants KPI card | `useOperationalCoordinationState` → `kpis.payoutReadyCount` | `stats.readyForPayout` (overrides row metrics when `canonicalKpis` set) |
| Project hub card | `useProjectWorkspace` → `summarizeProject` | `summary.participantsReady` from per-project coordination-snapshot fetch OR legacy `countPayoutReadyParticipants` |
| Project readiness line | `ProjectReadinessBreakdown` | `graph.summary.releaseReadyCount` or `summarizeProjectReadinessGaps` |
| Homepage attention | `deriveOperationalSeverity` | Uses `workspace.participantsConfiguredCount`, not payout-ready directly |
| Release confidence | `guidance.releaseConfidence.readyToRelease` | `canonical.kpis.releaseEligibleCount` |

**Stale / duplicate paths (audit):**

- `useReleaseInteractionCapability` — was second `useOperationalGuidance()` instance → **fixed** to `useOperationalCoordinationState`
- `project-payouts-view` — still calls `useOperationalGuidance` only (unused); summary from workspace not coordination
- `deriveOperationalSeverity` — `workspace.participantsConfiguredCount` when `canonicalState === null` → zeros
- `loadGraph` skipped fetch when `!graphReadyForProjection` → **fixed** (always fetches)
- `parseCoordinationSnapshotProjection` returned null when `graphReady === false` → **fixed** (allows summary with participants)

---

### 2. "3 earnings still need setup"

| Stage | Source |
|-------|--------|
| **String origin** | `derive-operational-release-blockers.ts` — `participantsNeedSetup` from `deriveWorkspaceParticipantPayoutSummary` |
| **Also** | `derive-operational-severity.ts` — `workspace.participantCount - workspace.participantsConfiguredCount` |
| **Homepage hero** | `OperationalCommandCenterHero` → `guidance.explanation.blockers` via `compressOperationalBlockers` |
| **Attention board** | `deriveOperationalSeverity` → `OperationalAttentionBoard` |

**Chain when broken:**

```
workspace.participantsConfiguredCount === 0   (empty graph / degradedGuidance)
  → participantsIncomplete === true
  → "${missing} participants still need earnings setup"
```

**Canonical path when working:**

```
effectiveGraph.summary.earningsConfiguredCount
  → workspaceContextFromGraph (max with activation)
  → buildCanonicalStateFromSnapshot → kpis.earningsConfiguredCount
  → activation.participantsConfiguredCount
```

---

### 3. "No funding sources connected"

| Stage | Source |
|-------|--------|
| **Persisted** | `sumConfirmedFundingForProject`, funding sources table, treasury API |
| **Project list label** | `summarizeProject` → `treasury.fundingLabel` or `legacyFundingLabel(deal)` |
| **Treasury API** | `treasury-summary.ts` → `'No funding sources connected yet'` when `!hasFundingSources` |
| **Blockers** | `deriveOperationalReleaseBlockers` → `fundingBlockerDetail(snapshot.funding.stage)` |
| **Graph funding** | `resolveOperationalCoordinationSnapshot` → `fundingSourceConnected` |

**Not from reducer KPIs.** Often correct when treasury not loaded; project hub passes `treasury` into coordination only on detail hub, not always on list cards.

---

### 4. Obligations page init shell vs table

| Gate | Condition |
|------|-----------|
| **Early return** | `showInitializationShell = settlementInitialization.showInitializationShell && !hasOperationalEvidence` |
| **hasOperationalEvidence** | `kpis.* > 0` OR `allRows.length > 0` |
| **Data load** | `fetch('/api/deal-network-pilot/obligations')` — **no longer gated** by init shell |
| **Table render** | After early return bypass; uses `allRows` from API |

**If shell still shows:** `kpis` null (canonical not built) AND obligations API returned `[]` AND `settlementInitialization.showInitializationShell` true.

---

## Remaining non-authoritative paths (grep audit)

| Symbol | Risk | Status |
|--------|------|--------|
| `degradedGuidance()` | Zeros all guidance when graph empty | Still fallback for workspace with no participants + failed API |
| `buildPersistedCoordinationSnapshot` | Second builder | Only when `options.participants` passed (project pages) |
| `parseCoordinationSnapshotProjection` | Client gate | **Fixed** — allows persisted summary |
| `loadGraph` + `graphReadyForProjection` | Skipped API | **Fixed** — always loads |
| `safeOperationalProjection` converged | Required graphReady | **Fixed** — summary participantCount |
| `useOperationalGuidance` (direct) | Bypasses canonical | `project-payouts-view`, `project-activity-view`, `operational-guidance-region`, `operational-graph-diagnostics` |
| `safeOperationalRouteState` / `draft-safe-routing` | Local route KPIs | Participants progressive panel |
| `computeKpis(rows)` on obligations page | API row KPIs only | Obligations table header cards (not coordination KPIs) |
| `useWorkspaceActivation` `degraded` flag | Stale activation snapshot | Until refresh after graph fix |

---

## Runtime verification checklist (browser)

1. Network: `coordination-snapshot` — expect `summary.participantCount > 0`, `participants[]` full rows, `graphReady: true` when DB has participants.
2. Network: `workspace/activation` — expect `participantsConfiguredCount` matches DB, not 0.
3. React: `useOperationalCoordinationState().kpis` — non-null, `payoutReadyCount` matches rows.
4. React: `useOperationalGuidance().degraded` — `false` when participants exist.
5. Obligations: `allRows.length > 0` → page must not show init shell.

Dev-only: `assertPersistedEntityDominanceInvariants` in `useCanonicalOperationalState` when `options.participants` provided.

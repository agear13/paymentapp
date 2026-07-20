# HackCanton — Real Canton LocalNet Path

**Status:** Implemented  
**Architecture:** unchanged — only the adapter behind `CantonCommercialNetworkProvider`  
**Simulated runtime:** retained as unit-test / default double (`CANTON_LEDGER_MODE=simulated`)

**End-to-end operator guide:** [localnet-runbook.md](./localnet-runbook.md) (prerequisites, exact commands, env vars, smoke test, troubleshooting).

---

## Target flow

```text
Commercial Network Layer
        ↓
CantonCommercialNetworkProvider  (interface unchanged)
        ↓
LocalNet JSON API Adapter        (mediated — Create / Exercise / events)
        ↓
Quickstart Participant JSON API  (e.g. http://localhost:3975)
        ↓
Canton LocalNet ledger
        ↓
Ledger transaction tree
        ↓
CommercialNetworkEvent
        ↓
Projection Service
        ↓
Commercial Domain → existing UI
```

Provvypay never knows whether the provider is simulated, LocalNet, or future MainNet.

---

## Prerequisites

1. Docker Desktop (≥ 8 GB RAM recommended)  
2. Official Quickstart under `canton/cn-quickstart` (already cloned)  
3. Daml SDK / `dpm` (via Quickstart `make install-daml-sdk`)  
4. `curl`, `jq`

---

## 1. Start LocalNet

```bash
cd canton/cn-quickstart/quickstart
make setup    # first time: OAuth2 optional; disable TEST MODE for demos
make build
make start
make status
```

App Provider JSON API (default): `http://localhost:3975`  
App User JSON API: `http://localhost:2975`

Obtain a bearer token (OAuth2 disabled → use Quickstart static token from `.env` / docs; OAuth2 enabled → Keycloak client credentials as in [JSON API tutorial](https://docs.canton.network/appdev/quickstart/json-api)).

```bash
export CANTON_JSON_API_URL=http://localhost:3975
export CANTON_AUTH_TOKEN="<token>"
```

---

## 2. Build + upload DAR

```bash
# from repo root
chmod +x canton/scripts/build-and-upload-dar.sh
./canton/scripts/build-and-upload-dar.sh
```

Manual equivalent:

```bash
cd canton/cn-quickstart/quickstart/daml/shared-commercial-agreement
dpm build
curl -X POST "$CANTON_JSON_API_URL/v2/packages" \
  -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @.daml/dist/provvypay-shared-commercial-agreement-0.1.0.dar
```

Also build/run Daml Script tests (no LocalNet required):

```bash
cd ../shared-commercial-agreement-tests
dpm build && dpm test
```

---

## 3. Allocate parties

```bash
chmod +x canton/scripts/allocate-sca-parties.sh
./canton/scripts/allocate-sca-parties.sh
```

Resolve and export:

```bash
export CANTON_PLATFORM_PARTY="..."   # Provvypay Platform
export CANTON_VENUE_PARTY="..."
export CANTON_PROMOTER_PARTY="..."
export CANTON_ARTIST_PARTY="..."
```

Hackathon simplification: all parties on App Provider participant. Production may split validators.

---

## 4. Enable LocalNet adapter in Provvypay

```bash
export CANTON_LEDGER_MODE=localnet
export CANTON_JSON_API_URL=http://localhost:3975
export CANTON_AUTH_TOKEN=...
export CANTON_PACKAGE_NAME=provvypay-shared-commercial-agreement
export CANTON_MODULE_NAME=SharedCommercialAgreement.Workflow
export CANTON_APPLICATION_ID=provvypay-sca
```

Optional per-party routing (multi-participant):

```bash
export CANTON_PARTY_JSON_API_URLS='{"party::venue":"http://localhost:2975"}'
export CANTON_PARTY_AUTH_TOKENS='{"party::venue":"<user-token>"}'
```

Default without `CANTON_LEDGER_MODE=localnet` → **simulated** (unit tests).

---

## 5. Smoke test (real ledger)

```bash
cd src
CANTON_LEDGER_MODE=localnet \
CANTON_AUTH_TOKEN=... \
CANTON_PLATFORM_PARTY=... \
CANTON_VENUE_PARTY=... \
CANTON_PROMOTER_PARTY=... \
CANTON_ARTIST_PARTY=... \
npm test -- __tests__/commercial-network/localnet-smoke.test.ts
```

Mocked adapter unit tests (no LocalNet):

```bash
npm test -- __tests__/commercial-network/localnet-adapter.test.ts
```

---

## 6. Projection verification

After smoke:

1. `AgreementCreated` / `ParticipantApproved` / `SettlementReady` events hit the CNL dispatcher  
2. `ProjectionService` updates agreement / participant / settlement read models  
3. UI continues to read Commercial Domain projections only — never ledger contract IDs  

---

## Adapter surface (mediated only)

| Operation | Ledger command |
|-----------|----------------|
| Create agreement | `CreateCommand` → `CommercialAgreementProposal` |
| Accept | `ExerciseCommand` → `Accept` |
| Reject | `ExerciseCommand` → `Reject` |
| Withdraw | `ExerciseCommand` → `Withdraw` |
| SettlementReady | `ExerciseCommand` → `DeclareSettlementReady` |
| Events | Parsed from `submit-and-wait-for-transaction-tree` → `CommercialNetworkEvent` |

No business logic in the adapter.

---

## What stayed the same

- Commercial Operating System  
- Commercial Network Layer interface  
- Approved Daml templates / choices  
- Projection Service  
- `CantonLedgerRuntime` as **test double**  

## What changed

- `CantonCommercialNetworkProvider` selects adapter by `CANTON_LEDGER_MODE`  
- New `LocalNetJsonApiAdapter` for real LocalNet execution  

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `JSON API not reachable` | `make status`, port `3975`, token |
| Package not found | Re-run DAR upload; confirm `#provvypay-shared-commercial-agreement:...` |
| Authorization errors | Token realm / `actAs` party hosted on that participant |
| Contract id missing in tree | Inspect raw JSON API response; template name mismatch |

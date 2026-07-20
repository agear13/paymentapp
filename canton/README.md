# Provvypay × Canton (HackCanton)

Provvypay remains the **Commercial Operating System**.  
Canton is the **shared workflow runtime** for multi-party commercial binding.

This directory extends the official [Digital Asset cn-quickstart](https://github.com/digital-asset/cn-quickstart) — it does not replace it.

## Layout

```text
canton/
  README.md                          ← this file
  cn-quickstart/                     ← official Quickstart (cloned / extended)
    quickstart/daml/
      shared-commercial-agreement/   ← Provvypay Daml model
      shared-commercial-agreement-tests/
      multi-package.yaml             ← includes Provvypay packages
```

Provvypay TypeScript integration lives in:

```text
src/lib/commercial-network/providers/canton/
  Workflow.daml mirror runtime
  CantonCommercialNetworkProvider
  HackCanton demo dataset + orchestration
```

## Approved workflow (frozen)

```text
Agreement Upload (Provvypay)
  → AI Agreement Intelligence (Provvypay)
  → CommercialAgreementProposal          ← Platform proposes
  → Venue Accept → Promoter Accept → Artist Accept
  → CommercialAgreement (bound terms)
  → SettlementReady                      ← Platform attests
  → Projection into Provvypay Ops Workspace
```

- **Platform** (UI / narration) = Daml field `platform` (AppProvider analogue)
- **Accountant** is **not** a ledger party (Provvypay OS role only)
- Completion is derived from `requiredParticipants` (not a hard-coded count of 3)

## Build Daml (Quickstart)

Requires Daml SDK / `dpm` from Quickstart setup:

```bash
cd canton/cn-quickstart/quickstart
make setup   # if first time
cd daml/shared-commercial-agreement && dpm build
cd ../shared-commercial-agreement-tests && dpm build && dpm test
```

Or from `daml/` with multi-package:

```bash
cd canton/cn-quickstart/quickstart/daml
dpm build --all
dpm test --all
```

## Ledger backends (adapter swap only)

| Mode | Env | Implementation |
|------|-----|----------------|
| **simulated** (default) | `CANTON_LEDGER_MODE=simulated` or unset | `CantonLedgerRuntime` test double |
| **localnet** | `CANTON_LEDGER_MODE=localnet` + token/URL | Quickstart JSON Ledger API adapter |

Commercial Network Provider interface is unchanged. See [docs/hackcanton-localnet.md](../docs/hackcanton-localnet.md).

## Run Provvypay TypeScript demo / tests

```bash
cd src
npm test -- __tests__/commercial-network/
```

## Documentation

- [docs/hackcanton-localnet.md](../docs/hackcanton-localnet.md) — LocalNet deploy, DAR, parties, smoke
- [docs/hackcanton-shared-commercial-agreement.md](../docs/hackcanton-shared-commercial-agreement.md)
- [docs/commercial-network.md](../docs/commercial-network.md)

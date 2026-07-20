# HackCanton — Shared Commercial Agreement

**Status:** Implemented (frozen architecture)  
**Quickstart base:** `canton/cn-quickstart` (official Digital Asset cn-quickstart, extended)  
**Daml package:** `provvypay-shared-commercial-agreement`  
**Provvypay integration:** `src/lib/commercial-network/providers/canton/`

---

## Product framing

| Layer | Owns |
|-------|------|
| **Provvypay** | Commercial Operating System — AI, forecasting, automation, accounting, settlement execution, reporting, participant & operations workspaces |
| **Canton** | Shared commercial workflow — multi-party approval, shared state, lifecycle, SettlementReady attestation, events for projection |

UI reads **Commercial Domain projections** only. Never bind UI directly to Daml contracts.

---

## Workflow

```text
Agreement Upload
      ↓
AI Agreement Intelligence          ← Provvypay (off-ledger)
      ↓
CommercialAgreementProposal        ← Platform proposes on Canton
      ↓
Venue Accepts
      ↓
Promoter Accepts
      ↓
DJ / Artist Accepts
      ↓
CommercialAgreement (bound)        ← all requiredParticipants are signatories
      ↓
SettlementReady                    ← Platform attests
      ↓
Projection → Provvypay Ops Workspace
```

### Parties

| Ledger | UI / narration |
|--------|----------------|
| `platform` | **Provvypay Platform** / Platform |
| Venue, Promoter, Artist | Same (Artist may display as DJ) |

**Accountant** is not a ledger signatory or approval party. Remains a Provvypay OS role (exports, reconciliation, reporting).

### Extensibility

`requiredParticipants : [{ party, role }]` drives completion. Adding a Sponsor (or any counterparty) does not change the state machine — only the required list.

---

## Daml templates

| Template | Role |
|----------|------|
| `CommercialAgreementProposal` | Platform-led proposal; progressive Accept / Reject / Withdraw |
| `CommercialAgreement` | Versioned bound commercial terms |
| `SettlementReady` | Ops attestation (not payment) |

Choices: `Accept`, `Reject`, `Withdraw`, `DeclareSettlementReady`.

Source:  
`canton/cn-quickstart/quickstart/daml/shared-commercial-agreement/daml/SharedCommercialAgreement/Workflow.daml`

---

## Commercial Network Layer

`CantonCommercialNetworkProvider` implements:

- create → Proposal  
- submitParticipantApproval → Accept  
- submitSettlementApproval → DeclareSettlementReady  
- events → Projection Service → Provvypay read models  

Demo dataset + orchestration: `hackcanton-demo.ts` (`runHackCantonDemoWorkflow`).

**Ledger backends** (CNL interface unchanged):

- `CANTON_LEDGER_MODE=simulated` (default) → `CantonLedgerRuntime` test double  
- `CANTON_LEDGER_MODE=localnet` → Quickstart JSON Ledger API adapter  

Full LocalNet instructions: [hackcanton-localnet.md](./hackcanton-localnet.md).

---

## Explicitly out of scope

- CommercialRelationship  
- Obligation child contracts  
- CIP-56 / Canton Coin  
- Invoice finance  
- SettlementCompleted  
- Accountant as ledger party  

---

## Definition of Done (demo)

1. Agreement uploaded (fixture)  
2. AI extracts counterparties (fixture)  
3. Shared Commercial Agreement created on Canton  
4. Three independent counterparties accept  
5. Workflow reaches SettlementReady  
6. Ledger events project into Provvypay  
7. Operations fields update via projection helpers  

```bash
cd src && npm test -- __tests__/commercial-network/hackcanton-workflow.test.ts
```

# HackCanton LocalNet Runbook

**Audience:** Someone who has never run this project before  
**Goal:** Start Quickstart LocalNet, upload the Shared Commercial Agreement DAR, allocate parties, run the smoke test against a **real** Canton ledger, and verify projections.  
**Time:** First run often 45–90 minutes (Docker pull + LocalNet boot). Later runs are faster.

Related architecture docs (optional background):

- [wsl-quickstart-migration.md](./wsl-quickstart-migration.md) — **Windows → WSL 2** (official Quickstart path)  
- [hackcanton-localnet.md](./hackcanton-localnet.md) — adapter design  
- [hackcanton-shared-commercial-agreement.md](./hackcanton-shared-commercial-agreement.md) — workflow  
- [commercial-network.md](./commercial-network.md) — Commercial Network Layer  

---

## Success criteria (definition of done)

You are done when **all** of the following are true:

1. `make status` shows LocalNet / Quickstart containers healthy.  
2. DAR `provvypay-shared-commercial-agreement` is uploaded to the App Provider participant.  
3. Four party IDs exist and are exported: Platform, Venue, Promoter, Artist.  
4. Live smoke test passes:

   ```text
   propose → Venue Accept → Promoter Accept → Artist Accept → SettlementReady → projection
   ```

5. Projection assertions pass (agreement projected; Venue participant `Approved`).  
6. You can explain: Provvypay talks only to the Commercial Network Layer; the ledger is behind the LocalNet adapter.

If the smoke test is **skipped**, LocalNet mode is **not** configured — see [Troubleshooting](#troubleshooting).

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| OS | macOS, Linux, or **Windows via WSL 2** (official Quickstart requirement). See [wsl-quickstart-migration.md](./wsl-quickstart-migration.md). |
| Docker Desktop | Running; **≥ 8 GB RAM** allocated to Docker (16 GB preferred). On Windows: enable **WSL integration**. |
| CPU / disk | Multi-core; several GB free for images |
| Tools | `git`, `curl`, `jq`, `make`; Quickstart prefers **Nix + Direnv** for JDK 21, Node 20, `dpm` |
| Repo | This repository with `canton/cn-quickstart` present |
| Daml SDK (`dpm`) | Via Nix flake (`direnv allow`) or `make install-daml-sdk` if present in your checkout |

### Check tools

```bash
docker info
git --version
curl --version
jq --version
make --version
node --version
npm --version
```

Expected: each command prints a version / Docker server info (not “command not found”).

### Confirm Quickstart is present

From the **repository root** (`paymentlink-repo`):

```bash
ls canton/cn-quickstart/quickstart/Makefile
ls canton/cn-quickstart/quickstart/daml/shared-commercial-agreement/daml.yaml
```

If `cn-quickstart` is missing:

```bash
git clone --depth 1 https://github.com/digital-asset/cn-quickstart.git canton/cn-quickstart
```

---

## Mental model (what you are running)

```text
You (this runbook)
  → Quickstart LocalNet (Docker: validators + JSON API)
  → Upload DAR + allocate parties
  → Provvypay smoke test (Node)
       → Commercial Network Layer
       → Canton provider (CANTON_LEDGER_MODE=localnet)
       → JSON Ledger API (http://localhost:3975)
       → Real ledger Create / Accept / SettlementReady
       → Events → Projection Service
```

| Port | Service |
|------|---------|
| `3975` | App Provider **JSON Ledger API** (primary for this demo) |
| `2975` | App User JSON Ledger API (optional) |
| `3903` | App Provider validator health |
| `3000` | Quickstart app UI (optional; not required for smoke) |
| `8082` | Keycloak (only if OAuth2 enabled) |

---

## Step 0 — Open a working shell

All paths below assume:

```bash
cd /path/to/paymentlink-repo
export REPO_ROOT="$(pwd)"
```

On Windows, use **WSL 2** (official). Do not rely on native PowerShell/CMD for Quickstart.

---

## Step 1 — Install Daml SDK (first time only)

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make install-daml-sdk
dpm --version
```

**Expected:** `dpm` prints a version (Quickstart pins SDK **3.5.x**, matching `daml.yaml`).

---

## Step 2 — Configure Quickstart (`make setup`)

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make setup
```

**Recommended prompts for this HackCanton demo:**

| Prompt | Choice | Why |
|--------|--------|-----|
| OAuth2 | Enable **or** disable (pick one and stay consistent) | Token steps differ below |
| Observability | Off (unless you want Grafana) | Faster / lighter |
| TEST MODE | **Off** | Demo / smoke path |
| Party hint | Leave default | Fine for LocalNet |

**Expected:** setup completes without error; `.env.local` (or equivalent) is written.

---

## Step 3 — Build and start LocalNet

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make build
make start
```

First `make start` can take a long time (image pulls + Canton boot).

### Verify health

```bash
make status
curl -sf http://localhost:3903/api/validator/readyz && echo "provider validator OK"
curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:3975/v2/version
```

**Expected:**

- `make status` shows running containers.  
- Validator readyz returns empty/OK (not connection refused).  
- JSON API `/v2/version` returns **200** (may require auth depending on config — if 401, continue to token step).

### Optional: capture logs (second terminal)

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make capture-logs
```

Leave this running while debugging.

---

## Step 4 — Obtain `CANTON_AUTH_TOKEN`

You need a Bearer token that can call the App Provider JSON API (`3975`).

### Path A — OAuth2 **enabled** (Keycloak)

```bash
export CANTON_AUTH_TOKEN="$(
  curl -fsS "http://keycloak.localhost:8082/realms/AppProvider/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=app-provider-validator" \
    -d "client_secret=AL8648b9SfdTFImq7FV56Vd0KHifHBuC" \
    -d "grant_type=client_credentials" \
    -d "scope=openid" | jq -r .access_token
)"

echo "token length: ${#CANTON_AUTH_TOKEN}"
```

**Expected:** `token length` is a large number (hundreds+), not `0`, and not the string `null`.

> Client id/secret come from Quickstart Keycloak LocalNet config. If your `make setup` generated different secrets, read them from `quickstart` env files under `docker/modules/keycloak/` / `.env`.

Verify:

```bash
curl -fsS -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  http://localhost:3975/v2/parties | jq .
```

**Expected:** JSON listing parties (may be empty before allocation).

### Path B — OAuth2 **disabled** (shared / static token)

Use the static App Provider admin token from your Quickstart `.env` / onboarding env (name varies by setup). Typical pattern:

```bash
# Example only — replace with the value from your generated env after make setup
export CANTON_AUTH_TOKEN="<AUTH_APP_PROVIDER_WALLET_ADMIN_TOKEN or equivalent from .env>"
curl -fsS -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  http://localhost:3975/v2/parties | jq .
```

**Expected:** HTTP 200 + JSON (not 401).

### Set JSON API URL

```bash
export CANTON_JSON_API_URL=http://localhost:3975
```

---

## Step 5 — Build and upload the DAR

### Using the helper script (repo root)

```bash
cd "$REPO_ROOT"
chmod +x canton/scripts/build-and-upload-dar.sh
./canton/scripts/build-and-upload-dar.sh
```

### Manual equivalent

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart/daml/shared-commercial-agreement"
dpm build
ls .daml/dist/provvypay-shared-commercial-agreement-*.dar

curl -fsS -X POST "$CANTON_JSON_API_URL/v2/packages" \
  -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @.daml/dist/provvypay-shared-commercial-agreement-0.1.0.dar

curl -fsS -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  "$CANTON_JSON_API_URL/v2/packages" | jq .
```

**Expected:**

- `dpm build` succeeds.  
- Upload returns success (empty or package ack).  
- Package list includes something referencing `provvypay-shared-commercial-agreement` (exact JSON shape varies by API version).

### Optional: Daml Script tests (no LocalNet)

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart/daml/shared-commercial-agreement-tests"
dpm build
dpm test
```

**Expected:** `testHappyPathSettlementReady` and related scripts report `ok`.

---

## Step 6 — Allocate parties

```bash
cd "$REPO_ROOT"
chmod +x canton/scripts/allocate-sca-parties.sh
./canton/scripts/allocate-sca-parties.sh
```

This best-effort allocates hints:

- `Provvypay-Platform` → **Provvypay Platform** (ledger field `platform`)  
- `Venue`  
- `Promoter`  
- `Artist` (UI may say DJ)  

### Resolve and export party IDs

List parties:

```bash
curl -fsS -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  "$CANTON_JSON_API_URL/v2/parties" | jq .
```

Copy the full party strings (they often look like `Provvypay-Platform::...` or `venue::...` — **use the exact values returned**).

```bash
export CANTON_PLATFORM_PARTY="<paste Provvypay-Platform party id>"
export CANTON_VENUE_PARTY="<paste Venue party id>"
export CANTON_PROMOTER_PARTY="<paste Promoter party id>"
export CANTON_ARTIST_PARTY="<paste Artist party id>"
```

**Expected:** all four exports are non-empty and distinct.

> Hackathon simplification: all parties on the **App Provider** participant (`3975`). That is intentional.

---

## Step 7 — Configure Provvypay for LocalNet mode

In the **same shell** (env vars must be visible to npm):

```bash
export CANTON_LEDGER_MODE=localnet
export CANTON_JSON_API_URL=http://localhost:3975
export CANTON_AUTH_TOKEN   # already set
export CANTON_PLATFORM_PARTY
export CANTON_VENUE_PARTY
export CANTON_PROMOTER_PARTY
export CANTON_ARTIST_PARTY

# Defaults (override only if needed)
export CANTON_PACKAGE_NAME=provvypay-shared-commercial-agreement
export CANTON_MODULE_NAME=SharedCommercialAgreement.Workflow
export CANTON_APPLICATION_ID=provvypay-sca
```

### Environment variable reference

| Variable | Required | Example / default |
|----------|----------|-------------------|
| `CANTON_LEDGER_MODE` | Yes for live smoke | `localnet` |
| `CANTON_JSON_API_URL` | Recommended | `http://localhost:3975` |
| `CANTON_AUTH_TOKEN` | Yes | Bearer token |
| `CANTON_PLATFORM_PARTY` | Yes (smoke) | Party id |
| `CANTON_VENUE_PARTY` | Yes (smoke) | Party id |
| `CANTON_PROMOTER_PARTY` | Yes (smoke) | Party id |
| `CANTON_ARTIST_PARTY` | Yes (smoke) | Party id |
| `CANTON_PACKAGE_NAME` | No | `provvypay-shared-commercial-agreement` |
| `CANTON_MODULE_NAME` | No | `SharedCommercialAgreement.Workflow` |
| `CANTON_APPLICATION_ID` | No | `provvypay-sca` |
| `CANTON_PARTY_JSON_API_URLS` | No | JSON map party→JSON API URL |
| `CANTON_PARTY_AUTH_TOKENS` | No | JSON map party→token |

**Sanity check:**

```bash
echo "mode=$CANTON_LEDGER_MODE"
echo "api=$CANTON_JSON_API_URL"
echo "platform=$CANTON_PLATFORM_PARTY"
test -n "$CANTON_AUTH_TOKEN" && echo "token=set" || echo "token=MISSING"
```

---

## Step 8 — Install Provvypay deps (first time)

```bash
cd "$REPO_ROOT/src"
npm install
```

**Expected:** install completes; `node_modules` present.

---

## Step 9 — Run the LocalNet smoke test

```bash
cd "$REPO_ROOT/src"

npm test -- __tests__/commercial-network/localnet-smoke.test.ts --forceExit
```

### What the smoke test does

1. Creates `CantonCommercialNetworkProvider` with `getLedgerMode() === 'localnet'`.  
2. `validateConnection()` against JSON API.  
3. Creates `CommercialAgreementProposal` on the ledger.  
4. Exercises **Accept** as Venue → Promoter → Artist.  
5. Platform declares **SettlementReady**.  
6. Asserts **Projection Service** updated (agreement present; Venue `Approved`).

### Expected output (success)

```text
PASS __tests__/commercial-network/localnet-smoke.test.ts
  LocalNet smoke (real Canton)
    √ propose → 3× accept → SettlementReady → projection

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

### Expected output if misconfigured (skipped)

```text
Test Suites: 1 skipped, 0 of 1 total
Tests:       1 skipped, 1 total
```

→ One or more of `CANTON_LEDGER_MODE`, `CANTON_AUTH_TOKEN`, or party env vars are missing. Fix Step 7 and re-run.

Timeout is **120s** per test to allow LocalNet latency.

---

## Step 10 — Verify projections

The smoke test already asserts projections. To reason about them:

| Event (Commercial Network) | Projection effect |
|----------------------------|-------------------|
| `AgreementCreated` | Agreement read model created |
| `ParticipantApproved` (×3) | Participant read models `Approved` |
| `SettlementReady` | Settlement read model `ready` |

Flow (must remain one-way):

```text
Ledger transaction
  → CommercialNetworkEvent
  → Projection Service
  → Commercial Domain read models
  → UI (never binds to Daml contract IDs)
```

Optional: run mocked adapter tests (no LocalNet) to confirm CI path still green:

```bash
cd "$REPO_ROOT/src"
npm test -- __tests__/commercial-network/localnet-adapter.test.ts --forceExit
```

**Expected:** `PASS` (uses mocked `fetch`, not a real ledger).

---

## Step 11 — Stop LocalNet (when finished)

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make stop
```

Full reset (destructive — removes LocalNet data):

```bash
make clean-all
```

---

## End-to-end command checklist (copy/paste)

After prerequisites and `make setup` once:

```bash
# 1) Start LocalNet
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make build && make start && make status

# 2) Token (OAuth2 example — adjust if OAuth2 off)
export CANTON_AUTH_TOKEN="$(
  curl -fsS "http://keycloak.localhost:8082/realms/AppProvider/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=app-provider-validator" \
    -d "client_secret=AL8648b9SfdTFImq7FV56Vd0KHifHBuC" \
    -d "grant_type=client_credentials" \
    -d "scope=openid" | jq -r .access_token
)"
export CANTON_JSON_API_URL=http://localhost:3975

# 3) DAR
cd "$REPO_ROOT"
./canton/scripts/build-and-upload-dar.sh

# 4) Parties
./canton/scripts/allocate-sca-parties.sh
# then export CANTON_*_PARTY from jq output

# 5) Smoke
export CANTON_LEDGER_MODE=localnet
cd "$REPO_ROOT/src"
npm test -- __tests__/commercial-network/localnet-smoke.test.ts --forceExit
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Docker OOM / containers exit | Insufficient Docker RAM | Raise Docker memory to ≥ 8 GB; `make clean-all && make start` |
| `make start` hangs / 404 from helpers | LocalNet not ready | Wait; `make status`; check `make capture-logs` |
| `curl: connection refused` on `3975` | JSON API not up | Wait for participant; confirm `make start` finished |
| `401` / `403` on JSON API | Bad/missing token | Re-fetch token; confirm OAuth2 on/off matches setup |
| `token length: 0` or `null` | Keycloak not up / wrong secret | Start Keycloak path; verify client_secret in Quickstart env |
| `dpm: command not found` | SDK / Nix env not loaded | `direnv allow` in `cn-quickstart`, or `make install-daml-sdk` if that target exists |
| DAR upload fails | Auth or API path | Confirm token + `POST /v2/packages` with octet-stream |
| Smoke test **skipped** | Env incomplete | Export all vars in Step 7; re-run from **same** shell |
| `getLedgerMode()` not `localnet` | `CANTON_LEDGER_MODE` unset | `export CANTON_LEDGER_MODE=localnet` |
| `JSON API not reachable` in provider | Wrong URL / LocalNet down | `CANTON_JSON_API_URL=http://localhost:3975` |
| `Package not found` / template error | DAR not uploaded | Re-run Step 5 |
| `Accepting party must be a required participant` | Party id mismatch | Re-export exact party strings from `/v2/parties` |
| `Active CommercialAgreementProposal not found` | Wrong contract id / failed create | Inspect smoke failure message; re-run with logs |
| Contract id missing in transaction tree | Response shape / template name | Confirm package/module names; see adapter template id `#package:module:Template` |
| Windows `./script.sh` fails | Not bash / no +x / CRLF | Use WSL; `chmod +x`; `dos2unix` if needed — see [WSL migration](./wsl-quickstart-migration.md) |
| npm test cannot find module | Deps missing | `cd src && npm install` |

### Recover from a broken LocalNet

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make stop
make clean-all
make build
make start
```

Then repeat Steps 4–9 (token → DAR → parties → smoke).

---

## What not to do

- Do **not** point React at the Ledger API or contract IDs.  
- Do **not** change Daml templates for this runbook.  
- Do **not** expect the smoke test to hit LocalNet unless `CANTON_LEDGER_MODE=localnet` and all party/token vars are set.  
- Do **not** confuse **simulated** mode (unit tests, default) with **localnet** mode (this runbook).

---

## Quick verification matrix

| Check | Command | Pass looks like |
|-------|---------|-----------------|
| LocalNet up | `make status` | Containers running |
| JSON API | `curl …/v2/parties` with token | HTTP 200 + JSON |
| DAR uploaded | `curl …/v2/packages` | Package listed |
| Parties | env echoes | Four non-empty party ids |
| Smoke | `npm test … localnet-smoke` | `1 passed` (not skipped) |
| Projections | smoke assertions | Agreement + Venue Approved |

When that matrix is green, the HackCanton LocalNet path is operational.

# WSL 2 Migration Guide — Canton Quickstart LocalNet

**Audience:** Moving from native Windows / Git Bash to the **officially supported** Quickstart environment  
**Goal:** A clean WSL 2 terminal that can `make build` / `make start`, upload the Shared Commercial Agreement DAR, allocate parties, and pass the LocalNet smoke test  
**Official reference:** [Prerequisites and Installation](https://docs.canton.network/appdev/quickstart/prerequisites)

Related:

- [localnet-runbook.md](./localnet-runbook.md) — full operator steps (token details, troubleshooting)
- [hackcanton-localnet.md](./hackcanton-localnet.md) — adapter design

---

## Verdict (read this first)

| Topic | Official answer |
|-------|-----------------|
| Supported Windows path | **WSL 2 only** (with admin privileges for install). Not native PowerShell / CMD / bare Git Bash. |
| Startup choreography | **`make`** inside `canton/cn-quickstart/quickstart/` |
| Host tooling preference | **Nix + Direnv** (provides JDK 21, Node 20, `dpm`) |
| Docker | **Docker Desktop** on Windows with **WSL integration** enabled for your distro |

Do **not** install GNU Make on native Windows to “follow Quickstart.” Use Make inside WSL.

---

## 1. Prerequisites

### 1.1 On Windows (host)

| Item | Notes |
|------|--------|
| WSL 2 | Install a Linux distro (Ubuntu recommended). `wsl -l -v` must show version **2**. |
| Docker Desktop | Running; allocate **≥ 8 GB RAM** (16 GB preferred). Decline Observability in setup if memory is tight. |
| Docker ↔ WSL | Settings → Resources → **WSL Integration** → enable your distro. Settings → General → **Use WSL 2 based engine**. |
| Docker Hub login | Needed for image pulls: `docker login` (from WSL after integration works). |

Do **not** install a separate Docker Engine inside WSL if Docker Desktop is already providing the CLI — that conflicts with Desktop’s WSL backend.

### 1.2 Inside WSL (official Quickstart set)

Per [official prerequisites](https://docs.canton.network/appdev/quickstart/prerequisites):

| Tool | Why |
|------|-----|
| **Curl** | Downloads / API calls |
| **Nix** | Reproducible toolchain (recommended) |
| **Direnv** | Loads the Quickstart Nix flake when you `cd` into `cn-quickstart` |
| **Make** | Official choreography (`make setup` / `build` / `start`) — usually via `build-essential` or similar |
| **Git**, **jq** | Repo + JSON helpers for our Provvypay scripts |

Install Nix (Linux / WSL form from official docs):

```bash
sh <(curl -L https://nixos.org/nix/install) --daemon
# restart the WSL shell after install
```

Install Direnv and common CLI tools (Ubuntu example):

```bash
sudo apt update
sudo apt install -y curl git make jq direnv build-essential
```

Hook Direnv into your shell (bash):

```bash
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
source ~/.bashrc
```

### 1.3 What Nix / Direnv provides (so you often need not install these by hand)

From `canton/cn-quickstart/nix/shell.nix`, the Quickstart flake puts on `PATH`:

| Package | Role |
|---------|------|
| **jdk21** (`JAVA_HOME`) | Host Gradle builds (`./gradlew`) |
| **nodejs_20** | Quickstart frontend + Provvypay `npm test` |
| **dpm** (Daml SDK 3.5.x) | Build / upload Shared Commercial Agreement DAR |

After `direnv allow` in `canton/cn-quickstart`, verify:

```bash
java -version          # 21.x
node --version         # v20.x
npm --version
dpm --version          # 3.5.x (matches quickstart/.env DAML_RUNTIME_VERSION)
make --version
docker info            # must see a running Docker engine
```

### 1.4 About `make install-daml-sdk`

Official docs still list:

```bash
cd quickstart
make install-daml-sdk
```

In the current Quickstart tree, **`dpm` is supplied by the Nix flake**; the Makefile may not define `install-daml-sdk`. Prefer:

1. Nix + Direnv (official preferred path), **or**
2. If docs/target exist in your checkout: `make install-daml-sdk`

Either way you need a working `dpm` before DAR upload.

### 1.5 Optional without Nix (not preferred)

Quickstart allows working in `quickstart/` without Nix if you install binaries yourself (JDK 21, Node 20, `dpm`). Official FAQ does **not** document that path in detail. Stick to Nix unless you have a reason not to.

---

## 2. Accessing this repository from WSL

### Option A — Use the existing Windows clone (fastest migration)

Your Windows path maps into WSL as `/mnt/c/...`:

```bash
cd /mnt/c/Users/alish/Documents/paymentlink-repo
export REPO_ROOT="$(pwd)"
ls "$REPO_ROOT/canton/cn-quickstart/quickstart/Makefile"
```

**Trade-off:** `/mnt/c` is slower and more permission-sensitive than the Linux filesystem. Fine for a first bring-up; for heavy daily builds, prefer Option B.

### Option B — Clone or copy into the Linux filesystem (recommended long-term)

```bash
mkdir -p ~/src
# Either clone fresh, or copy once from /mnt/c:
cp -a /mnt/c/Users/alish/Documents/paymentlink-repo ~/src/paymentlink-repo
cd ~/src/paymentlink-repo
export REPO_ROOT="$(pwd)"
```

Keep editing in Cursor on Windows if you want; just run Quickstart / smoke from WSL against the Linux tree (or accept `/mnt/c` performance).

### Activate Quickstart env

```bash
cd "$REPO_ROOT/canton/cn-quickstart"
direnv allow
# enter quickstart for make targets
cd quickstart
```

`make` only works from `quickstart/` (official note).

---

## 3. Files generated on Windows — keep vs regenerate

| Path | Action | Notes |
|------|--------|--------|
| `canton/cn-quickstart/quickstart/.env.local` | **Keep** | Your HackCanton profile (`OBSERVABILITY_ENABLED=false`, `AUTH_MODE=shared-secret`, `PARTY_HINT=provvypay-platform-1`, `TEST_MODE=off`). Compatible with manual/CI-style setup. Re-run `make setup` only if you want to change prompts. |
| `canton/cn-quickstart/quickstart/.env` | **Keep** | Upstream Quickstart versions (`DAML_RUNTIME_VERSION`, `SPLICE_VERSION`, ports). Do not invent a new one unless upgrading Quickstart. |
| `canton/cn-quickstart/quickstart/daml/shared-commercial-agreement/**` | **Keep** | Provvypay Daml sources (repo content). |
| `canton/scripts/*.sh` | **Keep**; fix bits | Re-`chmod +x` in WSL (NTFS often drops executable bit). |
| `canton/cn-quickstart/quickstart/gradlew` | **Keep**; fix bits / LF | Must be executable + LF line endings. |
| `**/node_modules` | **Regenerate** | Windows installs often break under Linux. Delete and `npm install` in WSL. |
| `**/.gradle`, `**/build`, `frontend/dist` | **Regenerate** | Safe to delete; `make build` recreates. |
| `**/.daml/dist/*.dar` | **Regenerate** | Rebuild with `dpm` in WSL before upload. |
| Docker volumes / prior LocalNet | **Usually reset** | If Windows/Git Bash left a half-started stack: `make clean-all` once in WSL, then rebuild. |

### Current `.env.local` (keep as-is unless changing auth)

```env
OBSERVABILITY_ENABLED=false
AUTH_MODE=shared-secret
PARTY_HINT=provvypay-platform-1
TEST_MODE=off
```

To regenerate interactively (official):

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make setup
```

For this demo: Observability **off**, TEST MODE **off**, party hint can stay `provvypay-platform-1`. OAuth2 **on** is the doc default; your file uses **shared-secret** (works with Path B tokens in the runbook).

---

## 4. Clean WSL path to a working LocalNet + smoke test

Run everything below in **one WSL bash session** unless noted. Docker Desktop must be running on Windows first.

### 4.0 Shell hygiene

```bash
# Fix script + wrapper permissions (NTFS /mnt/c often strips +x)
cd /mnt/c/Users/alish/Documents/paymentlink-repo   # or ~/src/paymentlink-repo
export REPO_ROOT="$(pwd)"

chmod +x "$REPO_ROOT/canton/cn-quickstart/quickstart/gradlew"
chmod +x "$REPO_ROOT/canton/scripts/"*.sh

# If scripts fail with $'\r': command not found — convert CRLF → LF
# sudo apt install -y dos2unix
# dos2unix "$REPO_ROOT/canton/scripts/"*.sh
# dos2unix "$REPO_ROOT/canton/cn-quickstart/quickstart/gradlew"
```

### 4.1 Direnv + tooling check

```bash
cd "$REPO_ROOT/canton/cn-quickstart"
direnv allow
java -version && node --version && dpm --version && make --version
docker info
docker login   # once
```

### 4.2 Build and start LocalNet (official)

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"

# Only if .env.local is missing:
# make setup

make build
make start
make status
```

Health checks:

```bash
curl -sf http://localhost:3903/api/validator/readyz && echo "provider validator OK"
curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:3975/v2/version
```

Optional second terminal:

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make capture-logs
```

### 4.3 Auth token + JSON API URL

With **`AUTH_MODE=shared-secret`** (your `.env.local`), use the static App Provider admin token from Quickstart env after setup (see [localnet-runbook.md](./localnet-runbook.md) Path B). Example pattern:

```bash
export CANTON_JSON_API_URL=http://localhost:3975
export CANTON_AUTH_TOKEN="<token from Quickstart .env / onboarding env for App Provider admin>"

curl -fsS -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  "$CANTON_JSON_API_URL/v2/parties" | jq .
```

If you switch setup to **OAuth2**, use Keycloak client-credentials instead (runbook Path A).

### 4.4 Build and upload Shared Commercial Agreement DAR

```bash
cd "$REPO_ROOT"
./canton/scripts/build-and-upload-dar.sh
```

### 4.5 Allocate parties

```bash
cd "$REPO_ROOT"
./canton/scripts/allocate-sca-parties.sh

curl -fsS -H "Authorization: Bearer $CANTON_AUTH_TOKEN" \
  "$CANTON_JSON_API_URL/v2/parties" | jq .
```

Export the **exact** party IDs returned:

```bash
export CANTON_PLATFORM_PARTY="<Provvypay-Platform party id>"
export CANTON_VENUE_PARTY="<Venue party id>"
export CANTON_PROMOTER_PARTY="<Promoter party id>"
export CANTON_ARTIST_PARTY="<Artist party id>"
```

### 4.6 Provvypay LocalNet smoke test

```bash
export CANTON_LEDGER_MODE=localnet
export CANTON_JSON_API_URL=http://localhost:3975
# CANTON_AUTH_TOKEN and CANTON_*_PARTY already set

cd "$REPO_ROOT/src"
rm -rf node_modules   # if previously installed on Windows
npm install
npm test -- __tests__/commercial-network/localnet-smoke.test.ts --forceExit
```

**Success:** `PASS` with propose → 3× Accept → SettlementReady → projection.  
**Skipped:** env incomplete — smoke did **not** hit LocalNet.

### 4.7 Stop when done

```bash
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make stop
# destructive full reset:
# make clean-all
```

---

## 5. Copy-paste checklist (after prerequisites once)

```bash
export REPO_ROOT=/mnt/c/Users/alish/Documents/paymentlink-repo   # or ~/src/paymentlink-repo
chmod +x "$REPO_ROOT/canton/cn-quickstart/quickstart/gradlew" "$REPO_ROOT/canton/scripts/"*.sh

cd "$REPO_ROOT/canton/cn-quickstart" && direnv allow
cd "$REPO_ROOT/canton/cn-quickstart/quickstart"
make build && make start && make status

export CANTON_JSON_API_URL=http://localhost:3975
export CANTON_AUTH_TOKEN="<from Quickstart shared-secret / OAuth2 path>"

cd "$REPO_ROOT"
./canton/scripts/build-and-upload-dar.sh
./canton/scripts/allocate-sca-parties.sh
# export CANTON_PLATFORM_PARTY CANTON_VENUE_PARTY CANTON_PROMOTER_PARTY CANTON_ARTIST_PARTY

export CANTON_LEDGER_MODE=localnet
cd "$REPO_ROOT/src" && npm install
npm test -- __tests__/commercial-network/localnet-smoke.test.ts --forceExit
```

---

## 6. Windows → WSL pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| No WSL Docker integration | `docker: command not found` or cannot talk to daemon | Enable WSL integration for your distro; restart Docker Desktop + WSL (`wsl --shutdown` then reopen). |
| Docker Engine installed inside WSL **and** Desktop | Weird daemon / context errors | Remove in-distro Docker Engine; use Desktop’s CLI only. |
| Working only on `/mnt/c` | Very slow `npm` / Gradle; flaky file watches | Prefer clone under `~/…` (Linux FS). |
| CRLF line endings | `$'\r': command not found`, broken `gradlew` | `dos2unix` on scripts; Quickstart already forces `gradlew` → LF via `.gitattributes`. |
| Lost executable bit on NTFS | `Permission denied` on `./gradlew` / scripts | `chmod +x` every WSL session (or move repo to `~/`). |
| Git Bash leftovers | Half-up containers, wrong mounts | From WSL: `make clean-all` then `make build && make start`. |
| `configureProfiles` hang | Interactive Gradle waiting on stdin | Keep/hand-write `.env.local` (you already have it); avoid `--quiet` piping issues. |
| Ports bound on Windows | `3975` / `3903` conflict | Stop old Git Bash LocalNet / other stacks before WSL `make start`. |
| Smoke test skipped | Forgot exports in that shell | Re-export `CANTON_LEDGER_MODE`, token, four parties; re-run. |
| Mixed Node installs | Wrong Node under Direnv vs system | Prefer Direnv flake Node 20; `which node` should be under nix. |
| Low Docker RAM | Unhealthy Canton/Splice containers | Raise Desktop memory; keep Observability **off**. |

---

## 7. Alignment with official Quickstart

Stay on this path:

1. WSL 2 + Docker Desktop  
2. Nix + Direnv at `cn-quickstart`  
3. `cd quickstart` → `make setup` (or keep `.env.local`) → `make build` → `make start`  
4. Provvypay-only additions after LocalNet is up: DAR script → parties → `CANTON_LEDGER_MODE=localnet` smoke test  

Avoid: native Windows Make, inventing a PowerShell compose stack, or pointing the React UI at Ledger contract IDs.

For token troubleshooting, party ID format, and recovery, continue in [localnet-runbook.md](./localnet-runbook.md).

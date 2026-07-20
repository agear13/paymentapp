#!/usr/bin/env bash
# Checkpoint 1 — bring up Quickstart LocalNet (deployment only).
# On native Windows, Chocolatey Make often runs recipes via cmd.exe, which
# breaks ./gradlew. This script runs Gradle under bash, then uses Make only
# for docker compose targets when SHELL can be forced — otherwise expands
# the official compose invocation from the Makefile profiles.
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot}"
export PATH="$JAVA_HOME/bin:/c/Program Files/Git/bin:$PATH"
export npm_config_script_shell="/c/Program Files/Git/bin/bash.exe"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
QS="$REPO_ROOT/canton/cn-quickstart/quickstart"
cd "$QS"

echo "==> Checkpoint 1: Quickstart LocalNet bring-up"
echo "cwd=$QS"
java -version
docker info >/dev/null
echo "docker: OK"

if [[ ! -f .env.local ]]; then
  echo "ERROR: .env.local missing"
  exit 1
fi
if ! grep -qE '^PARTY_HINT=.+' .env.local; then
  echo "ERROR: PARTY_HINT not set in .env.local"
  exit 1
fi
echo "env.local: PARTY_HINT present"

# Load profile vars the same way Make does
set -a
# shellcheck disable=SC1091
source .env
# shellcheck disable=SC1091
source .env.local
set +a
export IMAGE_TAG="${SPLICE_VERSION}"

MODULES_DIR="${MODULES_DIR:-$QS/docker/modules}"
LOCALNET_DIR="${LOCALNET_DIR:-$MODULES_DIR/localnet}"

echo "==> build-frontend"
(
  cd frontend
  npm install
  npm run build
)

echo "==> build-backend (bash ./gradlew)"
./gradlew :backend:build --no-daemon

echo "==> build-daml (bash ./gradlew)"
./gradlew :daml:build distTar --no-daemon

echo "==> docker compose build + up (official Quickstart profiles)"
COMPOSE=(
  docker compose
  -f compose.yaml
  -f "${LOCALNET_DIR}/compose.yaml"
  -f "${LOCALNET_DIR}/resource-constraints.yaml"
  -f "${MODULES_DIR}/splice-onboarding/compose.yaml"
  -f "${MODULES_DIR}/splice-onboarding/resource-constraints.yaml"
  -f "${MODULES_DIR}/pqs/compose.yaml"
  -f "${MODULES_DIR}/pqs/resource-constraints.yaml"
  --env-file .env
  --env-file .env.local
  --env-file "${LOCALNET_DIR}/compose.env"
  --env-file "${LOCALNET_DIR}/env/common.env"
  --env-file "${MODULES_DIR}/pqs/compose.env"
  --profile app-provider
  --profile app-user
  --profile sv
  --profile swagger-ui
  --profile pqs-app-provider
)

if [[ "${AUTH_MODE:-}" == "oauth2" ]]; then
  COMPOSE+=(
    -f "${MODULES_DIR}/keycloak/compose.yaml"
    -f "${MODULES_DIR}/keycloak/resource-constraints.yaml"
    --env-file "${MODULES_DIR}/keycloak/compose.env"
    --profile keycloak
  )
fi

echo "==> compose build"
"${COMPOSE[@]}" build

echo "==> compose up -d"
"${COMPOSE[@]}" up -d --no-recreate

echo "==> compose ps"
"${COMPOSE[@]}" ps

echo "==> Health probes (wait up to ~3 min for ledger)"
set +e
for i in $(seq 1 36); do
  if curl -sf http://localhost:3903/api/validator/readyz >/dev/null 2>&1; then
    echo " validator ready: OK (attempt $i)"
    break
  fi
  echo " waiting for validator... ($i)"
  sleep 5
done
curl -sf http://localhost:3903/api/validator/readyz && echo " validator ready: OK" || echo " validator ready: FAIL"
code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3975/v2/version)
echo " JSON API /v2/version HTTP ${code:-000}"
curl -sf -o /dev/null -w " swagger :9090 HTTP %{http_code}\n" http://localhost:9090/ || echo " swagger probe: FAIL"
curl -sf -o /dev/null -w " app UI :3000 HTTP %{http_code}\n" http://app-provider.localhost:3000/ || echo " app UI probe: FAIL"
set -e

echo "==> Container summary"
docker ps --format "table {{.Names}}\t{{.Status}}"

echo "==> Checkpoint 1 script finished"

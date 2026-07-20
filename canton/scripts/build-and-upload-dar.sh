#!/usr/bin/env bash
# Build Provvypay Shared Commercial Agreement DAR and upload to LocalNet App Provider.
# Requires: dpm (Daml SDK), curl, jq, running Quickstart LocalNet (make start).
#
# Usage (from repo root):
#   export CANTON_AUTH_TOKEN=...
#   ./canton/scripts/build-and-upload-dar.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DAML_PKG="$ROOT/canton/cn-quickstart/quickstart/daml/shared-commercial-agreement"
JSON_API="${CANTON_JSON_API_URL:-http://localhost:3975}"
TOKEN="${CANTON_AUTH_TOKEN:?Set CANTON_AUTH_TOKEN (see docs/hackcanton-localnet.md)}"

echo "==> Building DAR in $DAML_PKG"
cd "$DAML_PKG"
dpm build

DAR="$(ls -1 .daml/dist/provvypay-shared-commercial-agreement-*.dar | head -n1)"
echo "==> Uploading $DAR to $JSON_API"
curl -fsS -X POST "$JSON_API/v2/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$DAR"

echo
echo "==> Packages (filter):"
curl -fsS -H "Authorization: Bearer $TOKEN" "$JSON_API/v2/packages" | jq .
echo "Done."

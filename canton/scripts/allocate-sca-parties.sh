#!/usr/bin/env bash
# Allocate (or resolve) Platform / Venue / Promoter / Artist parties on LocalNet.
#
# For HackCanton we typically host all parties on the App Provider participant
# (port 3975) for a single-validator demo. Production would split validators.
#
# Usage:
#   export CANTON_AUTH_TOKEN=...
#   ./canton/scripts/allocate-sca-parties.sh

set -euo pipefail

JSON_API="${CANTON_JSON_API_URL:-http://localhost:3975}"
TOKEN="${CANTON_AUTH_TOKEN:?Set CANTON_AUTH_TOKEN}"

allocate() {
  local hint="$1"
  echo "Allocating party hint=$hint" >&2
  curl -fsS -X POST "$JSON_API/v2/parties/external/allocate" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"partyIdHint\":\"$hint\",\"displayName\":\"$hint\",\"identityProviderId\":\"\",\"localMetadata\":{\"annotations\":{}}}" \
    || curl -fsS -X POST "$JSON_API/v2/parties" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"partyIdHint\":\"$hint\",\"displayName\":\"$hint\"}"
}

echo "==> Listing existing parties"
curl -fsS -H "Authorization: Bearer $TOKEN" "$JSON_API/v2/parties" | jq .

echo "==> Ensure SCA demo parties (idempotent best-effort)"
for hint in Provvypay-Platform Venue Promoter Artist; do
  allocate "$hint" || true
done

echo "==> Parties after allocation"
curl -fsS -H "Authorization: Bearer $TOKEN" "$JSON_API/v2/parties" | jq -r '.partyDetails[]?.party // .[]?.party // .'
echo
echo "Export resolved party ids as:"
echo "  CANTON_PLATFORM_PARTY=..."
echo "  CANTON_VENUE_PARTY=..."
echo "  CANTON_PROMOTER_PARTY=..."
echo "  CANTON_ARTIST_PARTY=..."

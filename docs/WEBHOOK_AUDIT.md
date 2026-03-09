# Webhook audit (Stripe)

Every Stripe webhook delivery is persisted in `webhook_events` **before** business processing (write-ahead). This enables dead-letter inspection, replay, and observability without calling the Stripe API.

## Table: `webhook_events`

- **provider** – `STRIPE` (enum; extensible for future providers).
- **provider_event_id** – Stripe `event.id` (e.g. `evt_xxx`). Unique per provider.
- **event_type** – Stripe `event.type` (e.g. `payment_intent.succeeded`).
- **status** – `RECEIVED` → `PROCESSING` → `PROCESSED` | `IGNORED` | `DUPLICATE` | `ERROR`.
- **attempt_count** – Incremented each time the event is processed (including replay).
- **raw_body** – Exact request body as received; used for replay.
- **parsed_event** – Parsed Stripe event JSON (optional, for convenience).
- **last_error** / **last_error_at** – Set when status is `ERROR`.

Indexes support:

- Lookup by `(provider, provider_event_id)` (unique).
- Queries by `(provider, status, received_at)`.
- Queries by `payment_link_id`, `organization_id`, `stripe_payment_intent_id`, `stripe_refund_id`.

## Querying failures (dead-letter)

Events that ended in error or that you want to retry:

```sql
-- All Stripe events that ended in ERROR
SELECT id, provider_event_id, event_type, attempt_count, last_error, last_error_at, received_at
FROM webhook_events
WHERE provider = 'STRIPE' AND status = 'ERROR'
ORDER BY received_at DESC;

-- By payment link (e.g. for support)
SELECT id, provider_event_id, event_type, status, attempt_count, last_error
FROM webhook_events
WHERE payment_link_id = '<uuid>'
ORDER BY received_at DESC;

-- Recent errors (last 24h)
SELECT id, provider_event_id, event_type, last_error
FROM webhook_events
WHERE provider = 'STRIPE' AND status = 'ERROR' AND last_error_at > NOW() - INTERVAL '24 hours';
```

## Replay

Replay reprocesses a stored event using the same business logic as the webhook POST, **without** creating a new `webhook_events` row. It increments `attempt_count` and sets the final status (e.g. `PROCESSED` or `ERROR`).

### API (internal)

- **Endpoint:** `POST /api/internal/webhooks/stripe/replay`
- **Auth:** Header `X-Internal-Admin-Token` must match `INTERNAL_ADMIN_TOKEN` env.
- **Body:** `{ "provider_event_id": "evt_xxxx" }`
- **Response:** `{ ok, status, attempt_count, last_error }`

Example:

```bash
curl -X POST https://your-app/api/internal/webhooks/stripe/replay \
  -H "Content-Type: application/json" \
  -H "X-Internal-Admin-Token: $INTERNAL_ADMIN_TOKEN" \
  -d '{"provider_event_id":"evt_xxxx"}'
```

### Script

Run replay from the repo (no API auth; uses DB directly):

```bash
npx tsx src/scripts/replay-stripe-webhook.ts evt_xxxx
```

## Flow summary

1. **POST /api/stripe/webhook**  
   Verify signature → **record** in `webhook_events` (if duplicate `provider_event_id`, return 200 and skip handlers) → mark **PROCESSING** → run handlers → mark **PROCESSED** or **IGNORED** (or **ERROR** on throw; then return 500 so Stripe can retry).

2. **Replay**  
   Load row by `provider_event_id` → mark **PROCESSING** (increment `attempt_count`) → run same handlers → mark **PROCESSED** / **IGNORED** / **ERROR**.

Business semantics and idempotency (e.g. `payment_events.correlation_id`, ledger idempotency keys) are unchanged; the audit layer only adds persistence and status tracking.

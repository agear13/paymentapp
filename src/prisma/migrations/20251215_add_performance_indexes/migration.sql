-- Sprint 19: Performance Optimization - Database Indexes
-- Purpose: Add missing indexes aligned to current schema

-- ============================================================================
-- FX SNAPSHOTS INDEXES
-- ============================================================================

-- Fetch snapshots for a link + snapshot type + currency pair
CREATE INDEX IF NOT EXISTS idx_fx_snapshots_link_type_pair
ON fx_snapshots(payment_link_id, snapshot_type, base_currency, quote_currency);

-- Time-series queries by currency pair
CREATE INDEX IF NOT EXISTS idx_fx_snapshots_pair_captured
ON fx_snapshots(base_currency, quote_currency, captured_at DESC);

-- Filter by snapshot type over time
CREATE INDEX IF NOT EXISTS idx_fx_snapshots_type_captured
ON fx_snapshots(snapshot_type, captured_at DESC);

-- ============================================================================
-- LEDGER ENTRIES INDEXES
-- ============================================================================

-- Ledger queries by account over time
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_created
ON ledger_entries(ledger_account_id, created_at DESC);

-- Ledger queries by payment link over time
CREATE INDEX IF NOT EXISTS idx_ledger_entries_link_created
ON ledger_entries(payment_link_id, created_at DESC);

-- ============================================================================
-- PAYMENT EVENTS INDEXES
-- ============================================================================

-- event_type analytics
CREATE INDEX IF NOT EXISTS idx_payment_events_type_created
ON payment_events(event_type, created_at DESC);

-- payment_method analytics (nullable)
CREATE INDEX IF NOT EXISTS idx_payment_events_method_created
ON payment_events(payment_method, created_at DESC)
WHERE payment_method IS NOT NULL;

-- NOTE: payment_events already has (payment_link_id, created_at) index.

-- ============================================================================
-- PAYMENT LINKS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payment_links_currency_created
ON payment_links(currency, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_links_status_expires
ON payment_links(status, expires_at)
WHERE status = 'OPEN' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_links_invoice_ref
ON payment_links(invoice_reference)
WHERE invoice_reference IS NOT NULL;

-- ============================================================================
-- XERO SYNCS INDEXES
-- ============================================================================

-- NOTE: xero_syncs already has (status, next_retry_at) index.
-- Add an index for a payment link’s sync history timeline.
CREATE INDEX IF NOT EXISTS idx_xero_syncs_link_created
ON xero_syncs(payment_link_id, created_at DESC);

-- ============================================================================
-- AUDIT LOGS (leave as-is if your schema has these columns; otherwise remove)
-- ============================================================================
-- If you have audit_logs with these columns, keep. If not, delete this section.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org
ON audit_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
ON audit_logs(user_id);
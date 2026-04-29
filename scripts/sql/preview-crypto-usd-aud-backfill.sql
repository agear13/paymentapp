-- Preview: crypto payment links that look like "rail USD" but merchant reports in AUD.
-- Use for psql / DBA review. Does NOT modify data.
-- Align detection rules with: scripts/backfill-crypto-invoice-currency-aud.ts

WITH latest_ms AS (
  SELECT DISTINCT ON (organization_id)
    organization_id,
    upper(trim(default_currency::text)) AS default_ccy
  FROM merchant_settings
  ORDER BY organization_id, created_at DESC
),
base AS (
  SELECT
    pl.id,
    pl.organization_id,
    pl.short_code,
    pl.status::text AS status,
    pl.payment_method::text AS payment_method,
    pl.currency,
    pl.invoice_currency,
    pl.created_at,
    ms.default_ccy,
    EXISTS (
      SELECT 1 FROM payment_events pe
      WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
    ) AS has_payment_confirmed,
    EXISTS (
      SELECT 1 FROM ledger_entries le WHERE le.payment_link_id = pl.id
    ) AS has_ledger,
    EXISTS (
      SELECT 1 FROM xero_syncs x
      WHERE x.payment_link_id = pl.id
        AND x.sync_type::text = 'INVOICE'
        AND x.status::text = 'SUCCESS'
    ) AS xero_invoice_success
  FROM payment_links pl
  INNER JOIN latest_ms ms ON ms.organization_id = pl.organization_id
  WHERE pl.payment_method IN ('HEDERA', 'CRYPTO')
    AND ms.default_ccy = 'AUD'
    AND pl.currency = 'USD'
    AND pl.invoice_currency = 'USD'
)
SELECT
  *,
  CASE
    WHEN has_payment_confirmed OR has_ledger OR xero_invoice_success THEN 'MANUAL_REVIEW'
    WHEN status IN ('DRAFT', 'OPEN', 'EXPIRED', 'CANCELED') THEN 'AUTO_SAFE_CANDIDATE'
    ELSE 'MANUAL_REVIEW'
  END AS suggested_tier
FROM base
ORDER BY organization_id, created_at;

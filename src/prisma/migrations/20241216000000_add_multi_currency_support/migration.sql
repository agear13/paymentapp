-- Sprint 25: Multi-Currency Enhancement
-- Add multi-currency configuration and support

-- 1. Create currency_configs table for organization-level currency settings
CREATE TABLE IF NOT EXISTS currency_configs (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    currency_code CHAR(3) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    display_priority INTEGER DEFAULT 0,
    custom_symbol VARCHAR(10),
    custom_decimal_places INTEGER,
    xero_clearing_account_id VARCHAR(255),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, currency_code)
);

CREATE INDEX idx_currency_configs_org_enabled ON currency_configs(organization_id, is_enabled);
CREATE INDEX idx_currency_configs_default ON currency_configs(organization_id, is_default) WHERE is_default = true;

-- 2. Create fx_rate_history table for tracking exchange rate changes
CREATE TABLE IF NOT EXISTS fx_rate_history (
    id UUID PRIMARY KEY,
    base_currency CHAR(3) NOT NULL,
    quote_currency CHAR(3) NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_fx_rate_history_pair ON fx_rate_history(base_currency, quote_currency, recorded_at DESC);
CREATE INDEX idx_fx_rate_history_recorded ON fx_rate_history(recorded_at DESC);

-- 3. Create fx_rate_overrides table for custom rate management
CREATE TABLE IF NOT EXISTS fx_rate_overrides (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    base_currency CHAR(3) NOT NULL,
    quote_currency CHAR(3) NOT NULL,
    override_rate DECIMAL(18, 8) NOT NULL,
    effective_from TIMESTAMPTZ(6) NOT NULL,
    effective_until TIMESTAMPTZ(6),
    reason TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, base_currency, quote_currency, effective_from)
);

CREATE INDEX idx_fx_rate_overrides_org ON fx_rate_overrides(organization_id);
CREATE INDEX idx_fx_rate_overrides_active ON fx_rate_overrides(organization_id, effective_from, effective_until) 
    WHERE effective_until IS NULL OR effective_until > NOW();

-- 4. Add multi-currency fields to merchant_settings
ALTER TABLE merchant_settings
    ADD COLUMN IF NOT EXISTS enabled_currencies TEXT[] DEFAULT ARRAY['USD', 'AUD'],
    ADD COLUMN IF NOT EXISTS show_symbols_in_ui BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_codes_in_ui BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_refresh_rates BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS rate_refresh_interval_minutes INTEGER DEFAULT 5;

-- 5. Add currency preference to payment_links
ALTER TABLE payment_links
    ADD COLUMN IF NOT EXISTS customer_selected_currency CHAR(3),
    ADD COLUMN IF NOT EXISTS conversion_rate_at_creation DECIMAL(18, 8),
    ADD COLUMN IF NOT EXISTS base_amount DECIMAL(18, 2),
    ADD COLUMN IF NOT EXISTS base_currency CHAR(3);

-- 6. Create currency_display_preferences table for UI customization
CREATE TABLE IF NOT EXISTS currency_display_preferences (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    currency_code CHAR(3) NOT NULL,
    display_format VARCHAR(50) DEFAULT 'symbol_amount_code', -- e.g., '$100.00 USD'
    thousand_separator VARCHAR(5) DEFAULT ',',
    decimal_separator VARCHAR(5) DEFAULT '.',
    symbol_position VARCHAR(10) DEFAULT 'before', -- 'before' or 'after'
    space_after_symbol BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, currency_code)
);

CREATE INDEX idx_currency_display_prefs_org ON currency_display_preferences(organization_id);

-- 7. Create multi_currency_invoices table for future invoice support
CREATE TABLE IF NOT EXISTS multi_currency_invoices (
    id UUID PRIMARY KEY,
    payment_link_id UUID NOT NULL REFERENCES payment_links(id) ON DELETE CASCADE,
    invoice_currency CHAR(3) NOT NULL,
    line_items JSONB NOT NULL, -- Array of {description, amount, currency, convertedAmount}
    subtotal DECIMAL(18, 2) NOT NULL,
    tax_amount DECIMAL(18, 2) DEFAULT 0,
    total_amount DECIMAL(18, 2) NOT NULL,
    conversion_rates JSONB, -- Map of currency pairs to rates used
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_multi_currency_invoices_payment_link ON multi_currency_invoices(payment_link_id);

-- 8. Add comments for documentation
COMMENT ON TABLE currency_configs IS 'Organization-level currency configuration and enablement';
COMMENT ON TABLE fx_rate_history IS 'Historical exchange rate data for all currency pairs';
COMMENT ON TABLE fx_rate_overrides IS 'Custom exchange rate overrides set by organizations';
COMMENT ON TABLE currency_display_preferences IS 'UI display preferences for currency formatting';
COMMENT ON TABLE multi_currency_invoices IS 'Multi-currency invoice line items and totals';

COMMENT ON COLUMN payment_links.customer_selected_currency IS 'Currency selected by customer during payment (may differ from base)';
COMMENT ON COLUMN payment_links.conversion_rate_at_creation IS 'FX rate snapshot when payment link was created';
COMMENT ON COLUMN payment_links.base_amount IS 'Original amount in base currency before conversion';
COMMENT ON COLUMN payment_links.base_currency IS 'Base currency of the payment link';








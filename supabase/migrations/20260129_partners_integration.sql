-- Partners Module Integration for HuntPay
-- This connects the scavenger hunt conversions to the Partners/Revenue Share system

-- Partners table (if not already exists)
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT UNIQUE, -- Maps to sponsor_id from HuntPay
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('Affiliate', 'Partner', 'Contributor')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Pending', 'Inactive')),
  revenue_share_rate DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
  payout_method TEXT NOT NULL DEFAULT 'Bank Transfer' CHECK (payout_method IN ('Bank Transfer', 'Crypto Wallet', 'PayPal', 'Wire')),
  total_earnings DECIMAL(12, 2) NOT NULL DEFAULT 0,
  pending_earnings DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid_out DECIMAL(12, 2) NOT NULL DEFAULT 0,
  next_payout_date DATE,
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partner ledger entries table
CREATE TABLE IF NOT EXISTS partner_ledger_entries (
  id TEXT PRIMARY KEY, -- Format: "huntpay-{conversion_id}"
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL, -- e.g., "HuntPay: abc12345"
  source_type TEXT NOT NULL CHECK (source_type IN ('Merchant', 'Program')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Payment Link', 'Rewards', 'Invoice', 'Other')),
  gross_amount DECIMAL(12, 2) NOT NULL,
  allocation_rate DECIMAL(5, 2) NOT NULL,
  earnings_amount DECIMAL(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Scheduled')),
  payout_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partner attributed entities (merchants/programs linked to partners)
CREATE TABLE IF NOT EXISTS partner_attributed_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('Merchant', 'Program')),
  attribution_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Churned', 'Pending')),
  gross_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  earnings_allocated DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(partner_id, entity_name, entity_type)
);

-- Partner payouts table
CREATE TABLE IF NOT EXISTS partner_payouts (
  id TEXT PRIMARY KEY, -- Format: "payout-{timestamp}"
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Processing', 'Completed', 'Failed')),
  scheduled_date DATE,
  completed_date DATE,
  reference_id TEXT NOT NULL,
  ledger_entry_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for partner tables
CREATE INDEX IF NOT EXISTS idx_partners_external_id ON partners(external_id);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_ledger_partner_id ON partner_ledger_entries(partner_id);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON partner_ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON partner_ledger_entries(date);
CREATE INDEX IF NOT EXISTS idx_attributed_partner_id ON partner_attributed_entities(partner_id);
CREATE INDEX IF NOT EXISTS idx_payouts_partner_id ON partner_payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON partner_payouts(status);

-- Function to increment partner earnings when conversion is approved
CREATE OR REPLACE FUNCTION increment_partner_earnings(
  p_partner_id UUID,
  p_earnings_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE partners
  SET 
    total_earnings = total_earnings + p_earnings_amount,
    pending_earnings = pending_earnings + p_earnings_amount,
    updated_at = NOW()
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql;

-- Function to move earnings from pending to paid_out
CREATE OR REPLACE FUNCTION move_partner_earnings_to_paid(
  p_partner_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE partners
  SET 
    pending_earnings = GREATEST(0, pending_earnings - p_amount),
    paid_out = paid_out + p_amount,
    updated_at = NOW()
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update partners.updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ledger_entries_updated_at
  BEFORE UPDATE ON partner_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attributed_entities_updated_at
  BEFORE UPDATE ON partner_attributed_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON partner_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

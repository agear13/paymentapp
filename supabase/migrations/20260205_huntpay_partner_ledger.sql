-- HuntPay Partner Ledger Integration
-- Separate partner earnings ledger (not tied to payment_links accounting)

-- Partner programs (e.g., "HuntPay", "Referral Network", etc.)
CREATE TABLE partner_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partner entities (sponsors, hunts, venues as attributed sources)
CREATE TABLE partner_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('sponsor', 'hunt', 'stop')),
  entity_ref_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, entity_type, entity_ref_id)
);

-- Partner ledger entries (earnings records)
CREATE TABLE partner_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES partner_entities(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'huntpay',
  source_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'reversed')),
  gross_amount NUMERIC(12, 2),
  earnings_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, source_ref)
);

-- Partner payout runs (batches of payments)
CREATE TABLE partner_payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_partner_entities_program ON partner_entities(program_id);
CREATE INDEX idx_partner_entities_type_ref ON partner_entities(entity_type, entity_ref_id);
CREATE INDEX idx_partner_ledger_program ON partner_ledger_entries(program_id);
CREATE INDEX idx_partner_ledger_status ON partner_ledger_entries(status);
CREATE INDEX idx_partner_ledger_source ON partner_ledger_entries(source, source_ref);
CREATE INDEX idx_partner_payout_program ON partner_payout_runs(program_id);

-- Insert HuntPay program
INSERT INTO partner_programs (slug, name)
VALUES ('huntpay', 'HuntPay')
ON CONFLICT (slug) DO NOTHING;

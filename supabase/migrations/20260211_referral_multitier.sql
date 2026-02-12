-- Multi-Tier Referral Revenue Share
-- Tier 1: BD Partner → Consultant (upstream)
-- Tier 2: Consultant → Client Advocate (downstream)
-- Only payment_completed conversions generate payouts

-- 1. Add BD_PARTNER role to referral_participants
ALTER TABLE referral_participants
  DROP CONSTRAINT IF EXISTS referral_participants_role_check;
ALTER TABLE referral_participants
  ADD CONSTRAINT referral_participants_role_check
  CHECK (role IN ('BD_PARTNER', 'CONSULTANT', 'CLIENT_ADVOCATE'));

-- 2. Add partner_entities support for 'participant' type
ALTER TABLE partner_entities
  DROP CONSTRAINT IF EXISTS partner_entities_entity_type_check;
ALTER TABLE partner_entities
  ADD CONSTRAINT partner_entities_entity_type_check
  CHECK (entity_type IN ('sponsor', 'hunt', 'stop', 'participant'));

-- 3. Referral → Partner entity mapping
CREATE TABLE IF NOT EXISTS referral_partner_entity_map (
  referral_participant_id UUID PRIMARY KEY REFERENCES referral_participants(id) ON DELETE CASCADE,
  partner_entity_id UUID NOT NULL UNIQUE REFERENCES partner_entities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_partner_entity_map_ref ON referral_partner_entity_map(referral_participant_id);
CREATE INDEX IF NOT EXISTS idx_referral_partner_entity_map_partner ON referral_partner_entity_map(partner_entity_id);

-- 4. BD Partner → Consultant referral (acquisition)
CREATE TABLE IF NOT EXISTS referral_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  parent_participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_participant_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_referrals_parent ON referral_referrals(parent_participant_id);
CREATE INDEX IF NOT EXISTS idx_referral_referrals_program ON referral_referrals(program_id);

-- 5. Consultant ↔ Client Advocate agreement
CREATE TABLE IF NOT EXISTS referral_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  consultant_participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  advocate_participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, consultant_participant_id, advocate_participant_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_agreements_consultant ON referral_agreements(consultant_participant_id);
CREATE INDEX IF NOT EXISTS idx_referral_agreements_advocate ON referral_agreements(advocate_participant_id);

-- 6. User → Participant association (auth)
CREATE TABLE IF NOT EXISTS referral_user_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_user_participants_user ON referral_user_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_user_participants_participant ON referral_user_participants(participant_id);

-- 7. Payment rules (2-tier: UPSTREAM=BD, DOWNSTREAM=advocate)
CREATE TABLE IF NOT EXISTS referral_payment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('UPSTREAM', 'DOWNSTREAM')),
  payout_type TEXT NOT NULL CHECK (payout_type IN ('percent', 'fixed')),
  value NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_by_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, scope)
);
CREATE INDEX IF NOT EXISTS idx_referral_payment_rules_program ON referral_payment_rules(program_id);

-- 8. Adjust partner_ledger_entries uniqueness for multi-beneficiary
ALTER TABLE partner_ledger_entries
  DROP CONSTRAINT IF EXISTS partner_ledger_entries_source_source_ref_key;
ALTER TABLE partner_ledger_entries
  ADD CONSTRAINT partner_ledger_entries_source_source_ref_entity_key
  UNIQUE(source, source_ref, entity_id);

-- Note: entity_id can be NULL (legacy huntpay). For referral, we always set entity_id.
-- PostgreSQL treats NULL != NULL in unique, so (source, source_ref, NULL) rows are distinct.
-- For referral we use (source, source_ref, entity_id) with entity_id set.

-- 9. Seed: BD Partner, Consultant referred by BD, Advocate with agreement
DO $$
DECLARE
  v_program_id UUID;
  v_bd_id UUID;
  v_consultant_id UUID;
  v_advocate_id UUID;
  v_partner_program_id UUID;
  v_bd_entity_id UUID;
  v_consultant_entity_id UUID;
  v_advocate_entity_id UUID;
BEGIN
  SELECT id INTO v_program_id FROM referral_programs WHERE slug = 'consultant-referral' ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_partner_program_id FROM partner_programs WHERE slug = 'consultant-referral' ORDER BY created_at ASC LIMIT 1;

  IF v_program_id IS NOT NULL AND v_partner_program_id IS NOT NULL THEN
    -- Create BD Partner participant
    INSERT INTO referral_participants (program_id, role, name, email, referral_code, status) VALUES
      (v_program_id, 'BD_PARTNER', 'Demo BD Partner', 'bd@example.com', 'DEMO-BD', 'active')
    ON CONFLICT (referral_code) DO NOTHING;

    SELECT id INTO v_bd_id FROM referral_participants WHERE referral_code = 'DEMO-BD' ORDER BY created_at ASC LIMIT 1;
    SELECT id INTO v_consultant_id FROM referral_participants WHERE referral_code = 'DEMO-CONSULTANT' ORDER BY created_at ASC LIMIT 1;
    SELECT id INTO v_advocate_id FROM referral_participants WHERE referral_code = 'DEMO-ADVOCATE' ORDER BY created_at ASC LIMIT 1;

    -- Create partner_entities for each participant
    IF v_bd_id IS NOT NULL THEN
      INSERT INTO partner_entities (program_id, entity_type, entity_ref_id, name)
      VALUES (v_partner_program_id, 'participant', v_bd_id, 'Demo BD Partner')
      ON CONFLICT (program_id, entity_type, entity_ref_id) DO NOTHING;
      SELECT id INTO v_bd_entity_id FROM partner_entities WHERE program_id = v_partner_program_id AND entity_type = 'participant' AND entity_ref_id = v_bd_id ORDER BY created_at ASC LIMIT 1;
      IF v_bd_entity_id IS NOT NULL THEN
        INSERT INTO referral_partner_entity_map (referral_participant_id, partner_entity_id) VALUES (v_bd_id, v_bd_entity_id)
        ON CONFLICT (referral_participant_id) DO NOTHING;
      END IF;
    END IF;

    IF v_consultant_id IS NOT NULL THEN
      INSERT INTO partner_entities (program_id, entity_type, entity_ref_id, name)
      VALUES (v_partner_program_id, 'participant', v_consultant_id, 'Demo Consultant')
      ON CONFLICT (program_id, entity_type, entity_ref_id) DO NOTHING;
      SELECT id INTO v_consultant_entity_id FROM partner_entities WHERE program_id = v_partner_program_id AND entity_type = 'participant' AND entity_ref_id = v_consultant_id ORDER BY created_at ASC LIMIT 1;
      IF v_consultant_entity_id IS NOT NULL THEN
        INSERT INTO referral_partner_entity_map (referral_participant_id, partner_entity_id) VALUES (v_consultant_id, v_consultant_entity_id)
        ON CONFLICT (referral_participant_id) DO NOTHING;
      END IF;
    END IF;

    IF v_advocate_id IS NOT NULL THEN
      INSERT INTO partner_entities (program_id, entity_type, entity_ref_id, name)
      VALUES (v_partner_program_id, 'participant', v_advocate_id, 'Demo Advocate')
      ON CONFLICT (program_id, entity_type, entity_ref_id) DO NOTHING;
      SELECT id INTO v_advocate_entity_id FROM partner_entities WHERE program_id = v_partner_program_id AND entity_type = 'participant' AND entity_ref_id = v_advocate_id ORDER BY created_at ASC LIMIT 1;
      IF v_advocate_entity_id IS NOT NULL THEN
        INSERT INTO referral_partner_entity_map (referral_participant_id, partner_entity_id) VALUES (v_advocate_id, v_advocate_entity_id)
        ON CONFLICT (referral_participant_id) DO NOTHING;
      END IF;
    END IF;

    -- Consultant referred by BD Partner
    IF v_bd_id IS NOT NULL AND v_consultant_id IS NOT NULL THEN
      INSERT INTO referral_referrals (child_participant_id, parent_participant_id, program_id)
      VALUES (v_consultant_id, v_bd_id, v_program_id)
      ON CONFLICT (child_participant_id) DO NOTHING;
    END IF;

    -- Consultant ↔ Advocate agreement
    IF v_consultant_id IS NOT NULL AND v_advocate_id IS NOT NULL THEN
      INSERT INTO referral_agreements (program_id, consultant_participant_id, advocate_participant_id, status)
      VALUES (v_program_id, v_consultant_id, v_advocate_id, 'active')
      ON CONFLICT (program_id, consultant_participant_id, advocate_participant_id) DO NOTHING;
    END IF;

    -- Default payment rules (demo values, editable in UI)
    INSERT INTO referral_payment_rules (program_id, scope, payout_type, value, currency, active) VALUES
      (v_program_id, 'UPSTREAM', 'percent', 5.00, 'USD', true),
      (v_program_id, 'DOWNSTREAM', 'percent', 10.00, 'USD', true)
    ON CONFLICT (program_id, scope) DO NOTHING;
  END IF;
END $$;

-- Ensure partner_entities has unique on (program_id, entity_type, entity_ref_id)
-- Already exists from huntpay migration

-- Add unique if partner_entities allows duplicate participant refs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_entities_program_entity_ref_key'
  ) THEN
    ALTER TABLE partner_entities ADD CONSTRAINT partner_entities_program_entity_ref_key
      UNIQUE(program_id, entity_type, entity_ref_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE referral_referrals IS 'BD Partner referred this consultant';
COMMENT ON TABLE referral_agreements IS 'Consultant-Advocate agreement for share';
COMMENT ON TABLE referral_payment_rules IS '2-tier rules: UPSTREAM (BD), DOWNSTREAM (advocate)';
COMMENT ON TABLE referral_partner_entity_map IS 'Maps referral_participants to partner_entities';
COMMENT ON TABLE referral_user_participants IS 'Links Supabase user to referral participant';

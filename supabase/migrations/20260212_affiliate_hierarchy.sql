-- 3-Level Affiliate Hierarchy: BD Partner → Consultant → Client Advocate
-- Uses parent_participant_id chain and user_id for auth binding

-- A) Add columns to referral_participants
ALTER TABLE referral_participants
  ADD COLUMN IF NOT EXISTS parent_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_commission_percent NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE referral_participants
  DROP CONSTRAINT IF EXISTS referral_participants_custom_commission_percent_check;
ALTER TABLE referral_participants
  ADD CONSTRAINT referral_participants_custom_commission_percent_check
  CHECK (custom_commission_percent >= 0 AND custom_commission_percent <= 100);

CREATE INDEX IF NOT EXISTS idx_referral_participants_parent ON referral_participants(parent_participant_id);
CREATE INDEX IF NOT EXISTS idx_referral_participants_user ON referral_participants(user_id);

-- B) Add columns to referral_programs
ALTER TABLE referral_programs
  ADD COLUMN IF NOT EXISTS owner_percent NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL;

ALTER TABLE referral_programs
  DROP CONSTRAINT IF EXISTS referral_programs_owner_percent_check;
ALTER TABLE referral_programs
  ADD CONSTRAINT referral_programs_owner_percent_check
  CHECK (owner_percent >= 0 AND owner_percent <= 100);

CREATE INDEX IF NOT EXISTS idx_referral_programs_owner ON referral_programs(owner_participant_id);

-- C) Seed DEMO-BD-PARTNER and hierarchy
DO $$
DECLARE
  v_program_id UUID;
  v_partner_program_id UUID;
  v_bd_id UUID;
  v_consultant_id UUID;
  v_advocate_id UUID;
  v_bd_entity_id UUID;
  v_consultant_entity_id UUID;
  v_advocate_entity_id UUID;
BEGIN
  SELECT id INTO v_program_id FROM referral_programs WHERE slug = 'consultant-referral' ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_partner_program_id FROM partner_programs WHERE slug = 'consultant-referral' ORDER BY created_at ASC LIMIT 1;

  IF v_program_id IS NULL OR v_partner_program_id IS NULL THEN
    RETURN;
  END IF;

  -- Create or get DEMO-BD-PARTNER (BD Partner / program owner)
  INSERT INTO referral_participants (program_id, role, name, email, referral_code, status)
  SELECT v_program_id, 'BD_PARTNER', 'Demo BD Partner', 'bd@example.com', 'DEMO-BD-PARTNER', 'active'
  WHERE NOT EXISTS (SELECT 1 FROM referral_participants WHERE referral_code = 'DEMO-BD-PARTNER');

  SELECT id INTO v_bd_id FROM referral_participants WHERE referral_code = 'DEMO-BD-PARTNER' ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_consultant_id FROM referral_participants WHERE referral_code = 'DEMO-CONSULTANT' ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_advocate_id FROM referral_participants WHERE referral_code = 'DEMO-ADVOCATE' ORDER BY created_at ASC LIMIT 1;

  -- Set program owner
  IF v_bd_id IS NOT NULL THEN
    UPDATE referral_programs SET owner_participant_id = v_bd_id, owner_percent = 5.00
    WHERE id = v_program_id AND owner_participant_id IS NULL;

    -- Create partner_entities + map for DEMO-BD-PARTNER
    INSERT INTO partner_entities (program_id, entity_type, entity_ref_id, name)
    VALUES (v_partner_program_id, 'participant', v_bd_id, 'Demo BD Partner')
    ON CONFLICT (program_id, entity_type, entity_ref_id) DO NOTHING;

    SELECT id INTO v_bd_entity_id FROM partner_entities
    WHERE program_id = v_partner_program_id AND entity_type = 'participant' AND entity_ref_id = v_bd_id
    ORDER BY created_at ASC LIMIT 1;

    IF v_bd_entity_id IS NOT NULL THEN
      INSERT INTO referral_partner_entity_map (referral_participant_id, partner_entity_id)
      VALUES (v_bd_id, v_bd_entity_id)
      ON CONFLICT (referral_participant_id) DO NOTHING;
    END IF;
  END IF;

  -- Set DEMO-CONSULTANT.parent_participant_id = DEMO-BD-PARTNER
  IF v_consultant_id IS NOT NULL AND v_bd_id IS NOT NULL THEN
    UPDATE referral_participants SET parent_participant_id = v_bd_id
    WHERE id = v_consultant_id AND parent_participant_id IS NULL;

    -- Ensure consultant has partner entity + map
    INSERT INTO partner_entities (program_id, entity_type, entity_ref_id, name)
    VALUES (v_partner_program_id, 'participant', v_consultant_id, 'Demo Consultant')
    ON CONFLICT (program_id, entity_type, entity_ref_id) DO NOTHING;

    SELECT id INTO v_consultant_entity_id FROM partner_entities
    WHERE program_id = v_partner_program_id AND entity_type = 'participant' AND entity_ref_id = v_consultant_id
    ORDER BY created_at ASC LIMIT 1;

    IF v_consultant_entity_id IS NOT NULL THEN
      INSERT INTO referral_partner_entity_map (referral_participant_id, partner_entity_id)
      VALUES (v_consultant_id, v_consultant_entity_id)
      ON CONFLICT (referral_participant_id) DO NOTHING;
    END IF;
  END IF;

  -- Set DEMO-ADVOCATE.parent_participant_id = DEMO-CONSULTANT, custom_commission_percent = 10
  IF v_advocate_id IS NOT NULL AND v_consultant_id IS NOT NULL THEN
    UPDATE referral_participants SET parent_participant_id = v_consultant_id, custom_commission_percent = 10.00
    WHERE id = v_advocate_id;

    -- Ensure advocate has partner entity + map
    INSERT INTO partner_entities (program_id, entity_type, entity_ref_id, name)
    VALUES (v_partner_program_id, 'participant', v_advocate_id, 'Demo Advocate')
    ON CONFLICT (program_id, entity_type, entity_ref_id) DO NOTHING;

    SELECT id INTO v_advocate_entity_id FROM partner_entities
    WHERE program_id = v_partner_program_id AND entity_type = 'participant' AND entity_ref_id = v_advocate_id
    ORDER BY created_at ASC LIMIT 1;

    IF v_advocate_entity_id IS NOT NULL THEN
      INSERT INTO referral_partner_entity_map (referral_participant_id, partner_entity_id)
      VALUES (v_advocate_id, v_advocate_entity_id)
      ON CONFLICT (referral_participant_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- Ensure BD_PARTNER role exists in check
ALTER TABLE referral_participants DROP CONSTRAINT IF EXISTS referral_participants_role_check;
ALTER TABLE referral_participants ADD CONSTRAINT referral_participants_role_check
  CHECK (role IN ('BD_PARTNER', 'CONSULTANT', 'CLIENT_ADVOCATE'));

COMMENT ON COLUMN referral_participants.parent_participant_id IS 'Consultant parent=BD Partner; Advocate parent=Consultant';
COMMENT ON COLUMN referral_participants.custom_commission_percent IS 'Advocate commission % (0-100) set by consultant';
COMMENT ON COLUMN referral_participants.user_id IS 'Supabase auth user for login binding';
COMMENT ON COLUMN referral_programs.owner_percent IS 'BD Partner/owner share of payment_completed';
COMMENT ON COLUMN referral_programs.owner_participant_id IS 'BD Partner participant (program owner)';

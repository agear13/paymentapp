-- Referral System Tables (Namespaced to avoid collision with HuntPay)
-- These tables are separate from HuntPay's conversions, hunts, stops, teams, etc.

-- 1. Referral Programs
CREATE TABLE IF NOT EXISTS referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  hero_image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  cta_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_programs_slug ON referral_programs(slug);
CREATE INDEX IF NOT EXISTS idx_referral_programs_status ON referral_programs(status);

-- 2. Referral Program Rules
CREATE TABLE IF NOT EXISTS referral_program_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('CONSULTANT', 'CLIENT_ADVOCATE')),
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('lead_submitted', 'booking_confirmed', 'payment_completed')),
  payout_type TEXT NOT NULL CHECK (payout_type IN ('fixed', 'percent')),
  value NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  effective_from DATE,
  effective_until DATE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, role, conversion_type, priority)
);

CREATE INDEX IF NOT EXISTS idx_referral_program_rules_program ON referral_program_rules(program_id);

-- 3. Referral Participants
CREATE TABLE IF NOT EXISTS referral_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('CONSULTANT', 'CLIENT_ADVOCATE')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  payout_method JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_participants_code ON referral_participants(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_participants_program ON referral_participants(program_id);
CREATE INDEX IF NOT EXISTS idx_referral_participants_status ON referral_participants(status);

-- 4. Referral Attributions (tracking referral link clicks)
CREATE TABLE IF NOT EXISTS referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  referral_code TEXT,
  landing_path TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_participant ON referral_attributions(participant_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_program ON referral_attributions(program_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_created ON referral_attributions(created_at DESC);

-- 5. Referral Leads (enquiry form submissions)
CREATE TABLE IF NOT EXISTS referral_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  attribution_id UUID REFERENCES referral_attributions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_leads_participant ON referral_leads(participant_id);
CREATE INDEX IF NOT EXISTS idx_referral_leads_program ON referral_leads(program_id);
CREATE INDEX IF NOT EXISTS idx_referral_leads_created ON referral_leads(created_at DESC);

-- 6. Referral Conversions (actions eligible for payout)
CREATE TABLE IF NOT EXISTS referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  attribution_id UUID REFERENCES referral_attributions(id) ON DELETE SET NULL,
  conversion_type TEXT NOT NULL,
  gross_amount NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_referral_conversions_participant ON referral_conversions(participant_id);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_program ON referral_conversions(program_id);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_status ON referral_conversions(status);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_created ON referral_conversions(created_at DESC);

-- 7. Referral Reviews (testimonials)
CREATE TABLE IF NOT EXISTS referral_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  testimonial TEXT,
  reviewer_name TEXT NOT NULL,
  photo_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'hidden', 'private')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referral_reviews_program ON referral_reviews(program_id);
CREATE INDEX IF NOT EXISTS idx_referral_reviews_status ON referral_reviews(status);
CREATE INDEX IF NOT EXISTS idx_referral_reviews_public ON referral_reviews(is_public, status) WHERE is_public = TRUE AND status = 'published';

-- 8. Referral Review Tokens (one-time links for review submission)
CREATE TABLE IF NOT EXISTS referral_review_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_review_tokens_token ON referral_review_tokens(token);
CREATE INDEX IF NOT EXISTS idx_referral_review_tokens_program ON referral_review_tokens(program_id);

-- Seed Data
INSERT INTO referral_programs (slug, name, description, status) VALUES
('consultant-referral', 'Consultant Referral Program', 'Refer businesses and earn rewards for successful conversions', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Get the program_id for seeding related data (hardened + rerunnable)
DO $$
DECLARE
  v_program_id UUID;
  v_consultant_id UUID;
  v_advocate_id UUID;
BEGIN
  -- Get program ID (LIMIT 1 prevents "more than one row")
  SELECT id
  INTO v_program_id
  FROM referral_programs
  WHERE slug = 'consultant-referral'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_program_id IS NOT NULL THEN
    -- Seed participants (rerunnable)
    INSERT INTO referral_participants (program_id, role, name, email, referral_code, status) VALUES
      (v_program_id, 'CONSULTANT', 'Demo Consultant', 'consultant@example.com', 'DEMO-CONSULTANT', 'active'),
      (v_program_id, 'CLIENT_ADVOCATE', 'Demo Advocate', 'advocate@example.com', 'DEMO-ADVOCATE', 'active')
    ON CONFLICT (referral_code) DO NOTHING;

    -- Get IDs for later use (LIMIT 1 prevents "more than one row")
    SELECT id
    INTO v_consultant_id
    FROM referral_participants
    WHERE referral_code = 'DEMO-CONSULTANT'
    ORDER BY created_at ASC
    LIMIT 1;

    SELECT id
    INTO v_advocate_id
    FROM referral_participants
    WHERE referral_code = 'DEMO-ADVOCATE'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Seed program rules (rerunnable)
    INSERT INTO referral_program_rules (program_id, role, conversion_type, payout_type, value, currency, priority) VALUES
      (v_program_id, 'CONSULTANT', 'booking_confirmed', 'fixed', 50.00, 'USD', 10),
      (v_program_id, 'CONSULTANT', 'payment_completed', 'fixed', 100.00, 'USD', 20),
      (v_program_id, 'CLIENT_ADVOCATE', 'lead_submitted', 'fixed', 20.00, 'USD', 10),
      (v_program_id, 'CLIENT_ADVOCATE', 'booking_confirmed', 'fixed', 30.00, 'USD', 20)
    ON CONFLICT (program_id, role, conversion_type, priority) DO NOTHING;

    -- Seed a demo review token (only if we have a participant id)
    IF v_consultant_id IS NOT NULL THEN
      INSERT INTO referral_review_tokens (program_id, participant_id, token, expires_at) VALUES
        (v_program_id, v_consultant_id, 'DEMO-REVIEW-TOKEN', NOW() + INTERVAL '30 days')
      ON CONFLICT (token) DO NOTHING;
    END IF;
  END IF;
END $$;

-- Create matching partner_programs entry for referral → partner ledger integration
-- CRITICAL: referral_programs and partner_programs are separate tables with different IDs
-- Mapping is done by slug: referral_programs.slug = partner_programs.slug
INSERT INTO partner_programs (slug, name)
VALUES ('consultant-referral', 'Consultant Referral Program')
ON CONFLICT (slug) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE referral_programs IS 'Referral programs separate from HuntPay system';
COMMENT ON TABLE referral_conversions IS 'Referral conversions - NOT the same as HuntPay conversions table';
COMMENT ON TABLE referral_participants IS 'Program participants with unique referral codes';

-- Verification queries:
-- SELECT slug FROM referral_programs;
-- SELECT referral_code FROM referral_participants ORDER BY referral_code;
-- SELECT token FROM referral_review_tokens;
-- SELECT slug, name FROM partner_programs ORDER BY slug;

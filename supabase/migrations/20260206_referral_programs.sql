-- Referral & Consultant Programs System
-- Enables YouTube-led distribution with consultant + client advocate referrals

-- First, update partner_entities to support 'participant' entity type
ALTER TABLE partner_entities DROP CONSTRAINT IF EXISTS partner_entities_entity_type_check;
ALTER TABLE partner_entities ADD CONSTRAINT partner_entities_entity_type_check 
  CHECK (entity_type IN ('sponsor', 'hunt', 'stop', 'participant'));

-- Programs (consultant services, product referrals, etc.)
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  hero_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  cta_config JSONB DEFAULT '[]'::jsonb, -- Array of {type: 'book_call' | 'pay_deposit' | 'whatsapp' | 'enquiry', label, url}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Program rules (payout logic per role + conversion type)
CREATE TABLE program_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('CONSULTANT', 'CLIENT_ADVOCATE')),
  conversion_type TEXT NOT NULL, -- lead_submitted, booking_confirmed, payment_completed
  payout_type TEXT NOT NULL CHECK (payout_type IN ('fixed', 'percent')),
  value NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE,
  effective_until DATE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, role, conversion_type, priority)
);

-- Participants (consultants + client advocates)
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('CONSULTANT', 'CLIENT_ADVOCATE')),
  name TEXT NOT NULL,
  email TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  payout_method JSONB, -- {type: 'bank' | 'crypto' | 'other', details: {...}}
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attributions (tracking referral link visits)
CREATE TABLE attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  landing_path TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leads (enquiry form submissions)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  attribution_id UUID REFERENCES attributions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversions (tracked revenue/booking events)
CREATE TABLE conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  attribution_id UUID REFERENCES attributions(id) ON DELETE SET NULL,
  conversion_type TEXT NOT NULL, -- lead_submitted, booking_confirmed, payment_completed
  gross_amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_json JSONB, -- {type, ref, notes, ...}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- Reviews (testimonials + ratings)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  testimonial TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  photo_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'hidden', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Review tokens (one-time links to submit reviews)
CREATE TABLE review_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_programs_slug ON programs(slug);
CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_program_rules_program ON program_rules(program_id);
CREATE INDEX idx_participants_program ON participants(program_id);
CREATE INDEX idx_participants_code ON participants(referral_code);
CREATE INDEX idx_attributions_program ON attributions(program_id);
CREATE INDEX idx_attributions_participant ON attributions(participant_id);
CREATE INDEX idx_attributions_created ON attributions(created_at);
CREATE INDEX idx_leads_program ON leads(program_id);
CREATE INDEX idx_leads_participant ON leads(participant_id);
CREATE INDEX idx_conversions_program ON conversions(program_id);
CREATE INDEX idx_conversions_participant ON conversions(participant_id);
CREATE INDEX idx_conversions_status ON conversions(status);
CREATE INDEX idx_reviews_program ON reviews(program_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_review_tokens_token ON review_tokens(token);

-- Insert seed: Consultant Referral Program
INSERT INTO programs (slug, name, description, status, cta_config)
VALUES (
  'consultant-referral',
  'Consultant Referral Program',
  'Refer clients and earn rewards for successful bookings and conversions.',
  'active',
  '[
    {"type": "enquiry", "label": "Get Started", "url": null},
    {"type": "book_call", "label": "Book a Call", "url": "https://calendly.com/example"},
    {"type": "whatsapp", "label": "WhatsApp Us", "url": "https://wa.me/1234567890"}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Insert rules for consultant role
INSERT INTO program_rules (program_id, role, conversion_type, payout_type, value, currency)
SELECT 
  id,
  'CONSULTANT',
  'booking_confirmed',
  'fixed',
  50.00,
  'USD'
FROM programs WHERE slug = 'consultant-referral'
ON CONFLICT DO NOTHING;

-- Insert rules for client advocate role
INSERT INTO program_rules (program_id, role, conversion_type, payout_type, value, currency)
SELECT 
  id,
  'CLIENT_ADVOCATE',
  'lead_submitted',
  'fixed',
  20.00,
  'USD'
FROM programs WHERE slug = 'consultant-referral'
ON CONFLICT DO NOTHING;

-- Seed example participants
INSERT INTO participants (program_id, role, name, email, referral_code)
SELECT 
  id,
  'CONSULTANT',
  'Demo Consultant',
  'consultant@example.com',
  'DEMO-CONSULTANT'
FROM programs WHERE slug = 'consultant-referral'
ON CONFLICT (referral_code) DO NOTHING;

INSERT INTO participants (program_id, role, name, email, referral_code)
SELECT 
  id,
  'CLIENT_ADVOCATE',
  'Demo Client Advocate',
  'advocate@example.com',
  'DEMO-ADVOCATE'
FROM programs WHERE slug = 'consultant-referral'
ON CONFLICT (referral_code) DO NOTHING;

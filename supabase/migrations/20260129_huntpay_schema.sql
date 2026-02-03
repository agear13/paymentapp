-- HuntPay: Web3 Scavenger Hunt + Affiliate Ledger
-- Migration for Supabase database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hunts table
CREATE TABLE hunts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stops (venues) in a hunt
CREATE TABLE stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL,
  checkin_code TEXT NOT NULL,
  gps_lat DECIMAL(10, 8),
  gps_lng DECIMAL(11, 8),
  gps_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hunt_id, order_index)
);

-- Sponsors (for affiliate tracking)
CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  payout_currency TEXT NOT NULL DEFAULT 'USD',
  payout_per_conversion DECIMAL(10, 2) NOT NULL,
  website_url TEXT,
  logo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Challenges (venue + web3 tasks)
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('venue', 'web3')),
  title TEXT NOT NULL,
  instructions_md TEXT NOT NULL,
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
  sponsor_referral_url TEXT,
  conversion_type TEXT CHECK (conversion_type IN ('wallet_signup', 'exchange_buy', 'staking', 'swap', 'other')),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  captain_email TEXT NOT NULL,
  join_token TEXT NOT NULL UNIQUE,
  team_size INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team members (optional detailed tracking)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team wallets
CREATE TABLE team_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  chain_id INT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, address, chain_id)
);

-- Team sessions (basic activity tracking)
CREATE TABLE team_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  UNIQUE(team_id)
);

-- Stop check-ins (team arrived at venue)
CREATE TABLE stop_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  checkin_code TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, stop_id)
);

-- Stop completions (all challenges done)
CREATE TABLE stop_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, stop_id)
);

-- Attribution events (clicked sponsor link)
CREATE TABLE attributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  referral_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_hash TEXT
);

-- Conversion events (proof of action submitted)
CREATE TABLE conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  conversion_type TEXT NOT NULL,
  tx_hash TEXT,
  screenshot_url TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  UNIQUE(team_id, challenge_id)
);

-- NFTs minted as souvenirs
CREATE TABLE nfts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  chain_id INT NOT NULL,
  contract_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  metadata_url TEXT,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, stop_id)
);

-- Indexes for performance
CREATE INDEX idx_stops_hunt_id ON stops(hunt_id);
CREATE INDEX idx_challenges_stop_id ON challenges(stop_id);
CREATE INDEX idx_challenges_sponsor_id ON challenges(sponsor_id);
CREATE INDEX idx_teams_hunt_id ON teams(hunt_id);
CREATE INDEX idx_teams_join_token ON teams(join_token);
CREATE INDEX idx_stop_checkins_team_id ON stop_checkins(team_id);
CREATE INDEX idx_stop_completions_team_id ON stop_completions(team_id);
CREATE INDEX idx_attributions_team_id ON attributions(team_id);
CREATE INDEX idx_attributions_sponsor_id ON attributions(sponsor_id);
CREATE INDEX idx_conversions_team_id ON conversions(team_id);
CREATE INDEX idx_conversions_sponsor_id ON conversions(sponsor_id);
CREATE INDEX idx_conversions_status ON conversions(status);
CREATE INDEX idx_nfts_team_id ON nfts(team_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_hunts_updated_at BEFORE UPDATE ON hunts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stops_updated_at BEFORE UPDATE ON stops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sponsors_updated_at BEFORE UPDATE ON sponsors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- HuntPay Seed Data
-- Sample hunt with 5 stops and sponsor challenges

-- Insert a sample hunt
INSERT INTO hunts (id, slug, name, description, start_at, end_at, status)
VALUES (
  'c7f3e8a0-1234-4567-8901-234567890abc',
  'web3-downtown-quest',
  'Web3 Downtown Quest',
  'Explore downtown hotspots and complete Web3 challenges to earn exclusive NFT souvenirs!',
  '2026-02-01 09:00:00+00',
  '2026-02-01 18:00:00+00',
  'active'
);

-- Insert sponsors
INSERT INTO sponsors (id, name, payout_currency, payout_per_conversion, website_url, notes)
VALUES 
  ('sponsor-wallet-co', 'WalletCo', 'USD', 25.00, 'https://walletco.example.com', 'Crypto wallet provider'),
  ('sponsor-exchange-x', 'ExchangeX', 'USD', 50.00, 'https://exchangex.example.com', 'Crypto exchange'),
  ('sponsor-stakepool', 'StakePool', 'USD', 30.00, 'https://stakepool.example.com', 'Staking provider');

-- Insert 5 stops
INSERT INTO stops (id, hunt_id, name, venue_name, description, order_index, checkin_code, gps_lat, gps_lng)
VALUES 
  ('stop-001', 'c7f3e8a0-1234-4567-8901-234567890abc', 'Coffee Hub', 'Downtown Brew', 'Start your quest with a coffee!', 1, 'COFFEE2026', 40.7589, -73.9851),
  ('stop-002', 'c7f3e8a0-1234-4567-8901-234567890abc', 'Tech Plaza', 'Innovation Center', 'Discover the tech hub', 2, 'TECH2026', 40.7614, -73.9776),
  ('stop-003', 'c7f3e8a0-1234-4567-8901-234567890abc', 'Art District', 'Gallery Row', 'Explore digital art', 3, 'ART2026', 40.7489, -73.9680),
  ('stop-004', 'c7f3e8a0-1234-4567-8901-234567890abc', 'Market Square', 'Merchants Plaza', 'Meet local merchants', 4, 'MARKET2026', 40.7580, -73.9855),
  ('stop-005', 'c7f3e8a0-1234-4567-8901-234567890abc', 'Finish Line', 'Victory Park', 'Complete your quest!', 5, 'FINISH2026', 40.7549, -73.9840);

-- Insert challenges for each stop (2 per stop: 1 venue, 1 web3)
INSERT INTO challenges (stop_id, type, title, instructions_md, sponsor_id, sponsor_referral_url, conversion_type, order_index)
VALUES 
  -- Stop 1 challenges
  ('stop-001', 'venue', 'Coffee Trivia', '**Find the answer:** What year was this coffee shop founded? (Hint: Check the wall art)', NULL, NULL, NULL, 1),
  ('stop-001', 'web3', 'Create Your Wallet', '**Get Started with Web3**\n\nSign up for a WalletCo account to store your crypto securely.\n\n1. Click the link below\n2. Complete signup\n3. Submit your wallet address as proof', 'sponsor-wallet-co', 'https://walletco.example.com/signup?ref=huntpay', 'wallet_signup', 2),
  
  -- Stop 2 challenges
  ('stop-002', 'venue', 'Tech Quiz', '**Innovation Challenge:** Name one blockchain protocol displayed in the lobby', NULL, NULL, NULL, 1),
  ('stop-002', 'web3', 'Make Your First Trade', '**Trade Crypto on ExchangeX**\n\nMake your first crypto trade (even $1 counts!)\n\n1. Sign up on ExchangeX\n2. Complete KYC\n3. Make a trade\n4. Submit transaction hash', 'sponsor-exchange-x', 'https://exchangex.example.com/trade?ref=huntpay', 'exchange_buy', 2),
  
  -- Stop 3 challenges
  ('stop-003', 'venue', 'Art Scavenger', '**Find the NFT:** Locate the QR code hidden in the gallery (leads to an NFT artwork)', NULL, NULL, NULL, 1),
  ('stop-003', 'web3', 'Stake Your Crypto', '**Start Earning Rewards**\n\nStake crypto with StakePool to earn passive income.\n\n1. Connect your wallet\n2. Choose a staking pool\n3. Stake any amount\n4. Submit transaction hash', 'sponsor-stakepool', 'https://stakepool.example.com/stake?ref=huntpay', 'staking', 2),
  
  -- Stop 4 challenges
  ('stop-004', 'venue', 'Merchant Hunt', '**Support Local:** Take a photo with a merchant who accepts crypto payments', NULL, NULL, NULL, 1),
  ('stop-004', 'web3', 'Swap Tokens', '**Token Swap Challenge**\n\nSwap any two tokens on ExchangeX\n\n1. Go to swap interface\n2. Select tokens to swap\n3. Complete the swap\n4. Submit transaction hash', 'sponsor-exchange-x', 'https://exchangex.example.com/swap?ref=huntpay', 'swap', 2),
  
  -- Stop 5 challenges
  ('stop-005', 'venue', 'Victory Selfie', '**Final Challenge:** Take a team photo at the Victory Park sign', NULL, NULL, NULL, 1),
  ('stop-005', 'web3', 'Share Your Journey', '**Spread the Word**\n\nShare your hunt experience on social media and tag @HuntPay\n\nSubmit a link to your post!', NULL, NULL, 'other', 2);

-- Create a sample team
INSERT INTO teams (id, hunt_id, name, captain_email, join_token, team_size)
VALUES (
  'team-sample-001',
  'c7f3e8a0-1234-4567-8901-234567890abc',
  'The Crypto Explorers',
  'captain@example.com',
  'JOIN-CRYPTO-EXPLORERS',
  4
);

-- Add a sample team wallet
INSERT INTO team_wallets (team_id, address, chain_id)
VALUES (
  'team-sample-001',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27',
  11155111  -- Sepolia testnet
);

-- Add some sample check-ins
INSERT INTO stop_checkins (team_id, stop_id, checkin_code, checked_in_at)
VALUES 
  ('team-sample-001', 'stop-001', 'COFFEE2026', NOW() - INTERVAL '2 hours'),
  ('team-sample-001', 'stop-002', 'TECH2026', NOW() - INTERVAL '1 hour');

-- Add a sample attribution (team clicked sponsor link)
INSERT INTO attributions (team_id, stop_id, challenge_id, sponsor_id, referral_url, user_agent)
SELECT 
  'team-sample-001',
  'stop-001',
  id,
  'sponsor-wallet-co',
  'https://walletco.example.com/signup?ref=huntpay',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
FROM challenges
WHERE stop_id = 'stop-001' AND type = 'web3'
LIMIT 1;

-- Add sample conversions (some pending, some approved)
INSERT INTO conversions (team_id, stop_id, challenge_id, sponsor_id, conversion_type, tx_hash, status, created_at)
SELECT 
  'team-sample-001',
  'stop-001',
  c.id,
  'sponsor-wallet-co',
  'wallet_signup',
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  'approved',
  NOW() - INTERVAL '1 hour'
FROM challenges c
WHERE c.stop_id = 'stop-001' AND c.type = 'web3'
LIMIT 1;

INSERT INTO conversions (team_id, stop_id, challenge_id, sponsor_id, conversion_type, tx_hash, status, created_at)
SELECT 
  'team-sample-001',
  'stop-002',
  c.id,
  'sponsor-exchange-x',
  'exchange_buy',
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  'pending',
  NOW() - INTERVAL '30 minutes'
FROM challenges c
WHERE c.stop_id = 'stop-002' AND c.type = 'web3' AND c.conversion_type = 'exchange_buy'
LIMIT 1;

-- Add a sample NFT mint
INSERT INTO nfts (team_id, stop_id, chain_id, contract_address, token_id, tx_hash, minted_at)
VALUES (
  'team-sample-001',
  'stop-001',
  11155111,
  '0x1234567890123456789012345678901234567890',
  '1',
  '0xnftmint1234567890abcdef1234567890abcdef1234567890abcdef123456',
  NOW() - INTERVAL '1 hour'
);

-- Create a partner from the approved conversion (simulating the integration)
INSERT INTO partners (id, external_id, name, role, status, revenue_share_rate, total_earnings, pending_earnings, joined_date)
VALUES (
  'partner-walletco-001',
  'sponsor-wallet-co',
  'WalletCo',
  'Partner',
  'Active',
  100.00,
  25.00,
  25.00,
  CURRENT_DATE
);

-- Create a ledger entry for the approved conversion
INSERT INTO partner_ledger_entries (id, partner_id, date, source, source_type, transaction_type, gross_amount, allocation_rate, earnings_amount, status, metadata)
VALUES (
  'huntpay-conv-001',
  'partner-walletco-001',
  CURRENT_DATE,
  'HuntPay: team-sam',
  'Program',
  'Rewards',
  25.00,
  100.00,
  25.00,
  'Pending',
  '{"huntpay_conversion_id": "sample-conversion-001", "team_id": "team-sample-001", "conversion_type": "wallet_signup"}'::jsonb
);

-- Create an attributed entity for the partner
INSERT INTO partner_attributed_entities (partner_id, entity_name, entity_type, attribution_date, status, gross_revenue, earnings_allocated)
VALUES (
  'partner-walletco-001',
  'Web3 Downtown Quest',
  'Program',
  CURRENT_DATE,
  'Active',
  25.00,
  25.00
);

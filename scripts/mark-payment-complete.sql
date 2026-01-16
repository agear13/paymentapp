-- Mark payment as complete for transaction 0.0.5363033@1768534284.182368814
-- Payment Link ID: 765fca01-0923-4ba8-a7c5-d4acfa1243fb

BEGIN;

-- 1. Update payment link status to PAID
UPDATE payment_links
SET 
  status = 'PAID',
  updated_at = NOW()
WHERE id = '765fca01-0923-4ba8-a7c5-d4acfa1243fb';

-- 2. Create payment event
INSERT INTO payment_events (
  id,
  payment_link_id,
  event_type,
  payment_method,
  hedera_transaction_id,
  amount_received,
  currency_received,
  metadata,
  created_at
) VALUES (
  gen_random_uuid(),
  '765fca01-0923-4ba8-a7c5-d4acfa1243fb',
  'PAYMENT_CONFIRMED',
  'HEDERA',
  '0.0.5363033@1768534284.182368814',
  (SELECT amount::text FROM payment_links WHERE id = '765fca01-0923-4ba8-a7c5-d4acfa1243fb'),
  'HBAR',
  jsonb_build_object(
    'transactionId', '0.0.5363033@1768534284.182368814',
    'tokenType', 'HBAR',
    'manuallyMarked', true,
    'markedAt', NOW()::text
  ),
  NOW()
);

-- 3. Get or create ledger accounts (if they don't exist)
-- Note: You may need to replace the organization_id with the actual one from your payment link

-- Get the organization_id
DO $$
DECLARE
  v_org_id UUID;
  v_amount NUMERIC;
  v_currency VARCHAR(3);
  v_crypto_account_id UUID;
  v_ar_account_id UUID;
BEGIN
  -- Get payment link details
  SELECT organization_id, amount, currency
  INTO v_org_id, v_amount, v_currency
  FROM payment_links
  WHERE id = '765fca01-0923-4ba8-a7c5-d4acfa1243fb';

  -- Get or create Crypto Clearing account
  INSERT INTO ledger_accounts (id, organization_id, code, name, account_type, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org_id, '1051-HBAR', 'Crypto Clearing - HBAR', 'ASSET', NOW(), NOW())
  ON CONFLICT (organization_id, code) DO NOTHING;

  SELECT id INTO v_crypto_account_id
  FROM ledger_accounts
  WHERE organization_id = v_org_id AND code = '1051-HBAR';

  -- Get or create Accounts Receivable account
  INSERT INTO ledger_accounts (id, organization_id, code, name, account_type, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org_id, '1200', 'Accounts Receivable', 'ASSET', NOW(), NOW())
  ON CONFLICT (organization_id, code) DO NOTHING;

  SELECT id INTO v_ar_account_id
  FROM ledger_accounts
  WHERE organization_id = v_org_id AND code = '1200';

  -- Create DEBIT entry for Crypto Clearing
  INSERT INTO ledger_entries (
    id,
    payment_link_id,
    ledger_account_id,
    entry_type,
    amount,
    currency,
    description,
    idempotency_key,
    created_at
  ) VALUES (
    gen_random_uuid(),
    '765fca01-0923-4ba8-a7c5-d4acfa1243fb',
    v_crypto_account_id,
    'DEBIT',
    v_amount,
    v_currency,
    'HBAR payment received - 0.0.5363033@1768534284.182368814 (manually marked)',
    'hedera-765fca01-0923-4ba8-a7c5-d4acfa1243fb-0.0.5363033@1768534284.182368814-debit',
    NOW()
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  -- Create CREDIT entry for Accounts Receivable
  INSERT INTO ledger_entries (
    id,
    payment_link_id,
    ledger_account_id,
    entry_type,
    amount,
    currency,
    description,
    idempotency_key,
    created_at
  ) VALUES (
    gen_random_uuid(),
    '765fca01-0923-4ba8-a7c5-d4acfa1243fb',
    v_ar_account_id,
    'CREDIT',
    v_amount,
    v_currency,
    'HBAR payment received - 0.0.5363033@1768534284.182368814 (manually marked)',
    'hedera-765fca01-0923-4ba8-a7c5-d4acfa1243fb-0.0.5363033@1768534284.182368814-credit',
    NOW()
  ) ON CONFLICT (idempotency_key) DO NOTHING;

END $$;

COMMIT;

-- Verify the payment was marked as paid
SELECT 
  id,
  status,
  amount,
  currency,
  description_for_customer,
  updated_at
FROM payment_links
WHERE id = '765fca01-0923-4ba8-a7c5-d4acfa1243fb';

-- Check payment events
SELECT 
  event_type,
  payment_method,
  hedera_transaction_id,
  amount_received,
  currency_received,
  created_at
FROM payment_events
WHERE payment_link_id = '765fca01-0923-4ba8-a7c5-d4acfa1243fb'
ORDER BY created_at DESC
LIMIT 5;


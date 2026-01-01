-- Check current merchant settings
SELECT 
    ms.id,
    ms.organization_id,
    o.name as org_name,
    ms.display_name,
    ms.stripe_account_id,
    ms.hedera_account_id,
    ms.hedera_enabled,
    ms.stripe_enabled
FROM merchant_settings ms
JOIN organizations o ON o.id = ms.organization_id
LIMIT 10;

-- If you want to enable test payment methods for your organization,
-- replace YOUR_ORG_ID with your actual organization ID from the query above:

-- Enable Stripe (set to your Stripe account ID if you have one, or 'test_account' for testing)
-- UPDATE merchant_settings 
-- SET 
--     stripe_account_id = 'test_account',
--     stripe_enabled = true,
--     updated_at = NOW()
-- WHERE organization_id = 'YOUR_ORG_ID';

-- Enable Hedera (set to your Hedera account ID if you have one, or '0.0.1234' for testing)
-- UPDATE merchant_settings 
-- SET 
--     hedera_account_id = '0.0.1234',
--     hedera_enabled = true,
--     updated_at = NOW()
-- WHERE organization_id = 'YOUR_ORG_ID';

-- Or create merchant settings if they don't exist:
-- INSERT INTO merchant_settings (
--     id,
--     organization_id,
--     display_name,
--     stripe_account_id,
--     stripe_enabled,
--     hedera_account_id,
--     hedera_enabled,
--     created_at,
--     updated_at
-- )
-- VALUES (
--     gen_random_uuid(),
--     'YOUR_ORG_ID',
--     'My Business',
--     'test_stripe',
--     true,
--     '0.0.1234',
--     true,
--     NOW(),
--     NOW()
-- )
-- ON CONFLICT (organization_id) DO UPDATE SET
--     stripe_account_id = EXCLUDED.stripe_account_id,
--     stripe_enabled = EXCLUDED.stripe_enabled,
--     hedera_account_id = EXCLUDED.hedera_account_id,
--     hedera_enabled = EXCLUDED.hedera_enabled,
--     updated_at = NOW();


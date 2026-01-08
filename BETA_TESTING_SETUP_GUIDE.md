# Beta Testing Setup Guide for Provvypay

**Purpose:** Enable beta testers to create accounts, make payments, and test full platform functionality in a safe sandbox environment.

**Last Updated:** January 7, 2026

---

## 📋 Table of Contents

1. [Environment Configuration](#1-environment-configuration)
2. [Beta Tester Onboarding](#2-beta-tester-onboarding)
3. [Payment Integration Testing](#3-payment-integration-testing)
4. [Data Verification](#4-data-verification)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Environment Configuration

### Option A: Separate Beta Environment (RECOMMENDED)

Create a dedicated beta environment on Vercel with sandbox credentials.

#### 1.1 Deploy Beta Branch

```bash
# Create beta branch
git checkout -b beta
git push origin beta
```

#### 1.2 Configure Beta Environment Variables on Render

Go to Render Dashboard → Your Web Service → Environment

Add these variables for **Beta Environment**:

```bash
# ============================================================================
# DATABASE (Use separate beta database)
# ============================================================================
DATABASE_URL=postgresql://[beta-database-url]

# ============================================================================
# SUPABASE AUTH (Use production or dedicated beta project)
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ============================================================================
# STRIPE (TEST MODE KEYS - CRITICAL!)
# ============================================================================
# Get from: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# ============================================================================
# HEDERA (TESTNET)
# ============================================================================
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# Token IDs for TESTNET
NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID=0.0.429274  # USDC testnet
NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID=0.0.429275  # USDT testnet
NEXT_PUBLIC_HEDERA_AUDD_TOKEN_ID=0.0.429276  # AUDD testnet (if available)

# ============================================================================
# XERO (SANDBOX/DEVELOPER APP)
# ============================================================================
# Create separate app at https://developer.xero.com
XERO_CLIENT_ID=your-beta-client-id
XERO_CLIENT_SECRET=your-beta-client-secret
XERO_REDIRECT_URI=https://your-beta-domain.vercel.app/api/xero/callback
XERO_SCOPES=accounting.transactions,accounting.contacts,offline_access

# ============================================================================
# ENCRYPTION & SECURITY
# ============================================================================
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=your-base64-encryption-key
SESSION_SECRET=your-session-secret

# ============================================================================
# APPLICATION
# ============================================================================
NEXT_PUBLIC_APP_URL=https://your-service-name.onrender.com
NODE_ENV=production

# ============================================================================
# OPTIONAL: Email notifications
# ============================================================================
RESEND_API_KEY=your-resend-api-key
```

### Option B: Shared Development Environment

If using the same environment, ensure ALL integrations use TEST/SANDBOX modes.

**⚠️ CRITICAL:** Never mix production and test credentials!

---

## 2. Beta Tester Onboarding

### Step 1: Account Creation

Your beta tester can self-register at your application URL:

**Beta tester should:**

1. Navigate to: `https://your-service-name.onrender.com/auth/login`
2. Click "Sign Up" button
3. Enter email and password
4. Check email for confirmation link (Supabase will send)
5. Click confirmation link
6. Sign in with credentials

**Alternatively, you can create account for them:**

```sql
-- In Supabase SQL Editor or Database
-- Supabase handles auth automatically via the signup flow
-- No manual SQL needed if using the signup form
```

### Step 2: Organization Setup

After login, beta tester will be redirected to onboarding:

**URL:** `/onboarding`

**Form Fields:**
- Organization Name: (e.g., "Beta Test Corp")
- Display Name: (e.g., "Beta Test Corporation")  
- Default Currency: USD (or preferred currency)

**Submit:** Creates organization and merchant settings automatically.

### Step 3: Configure Payment Methods

After onboarding, beta tester should configure integrations:

#### 3.1 Add Hedera Account ID

**Navigation:** Dashboard → Settings → Merchant

**Steps:**
1. Beta tester downloads HashPack wallet: https://www.hashpack.app/
2. **IMPORTANT:** Switch to TESTNET in HashPack settings
3. Create or import testnet account
4. Copy Hedera Account ID (format: `0.0.XXXXXX`)
5. Paste into "Hedera Account ID" field
6. Save settings

**Get Testnet HBAR:**
- Visit: https://portal.hedera.com/faucet
- Enter testnet account ID
- Request testnet HBAR (free)

**Associate Test Tokens (in HashPack):**
- USDC Testnet: `0.0.429274`
- USDT Testnet: `0.0.429275`

#### 3.2 Connect Stripe (Test Mode)

**Navigation:** Dashboard → Settings → Integrations → Stripe

**Important:** This should connect to YOUR Stripe test account, not the beta tester's.

**Two Options:**

**Option A: You provide test Stripe account access**
- Share test Stripe account login
- Beta tester connects via OAuth
- Payments go to your test account

**Option B: Configure manually in database**
```sql
-- Update merchant_settings with test Stripe account ID
UPDATE merchant_settings 
SET stripe_account_id = 'acct_test_your_test_account'
WHERE organization_id = (
  SELECT id FROM organizations WHERE name = 'Beta Test Corp'
);
```

#### 3.3 Connect Xero Sandbox

**Prerequisites:**

1. **Create Xero Demo Company** (for beta tester)
   - Go to: https://developer.xero.com/
   - Click "Try the Demo Company"
   - This creates a sandbox organization
   - Beta tester will connect to THIS, not their real Xero

2. **Ensure your app is configured for Xero Demo Company**
   - Your XERO_CLIENT_ID and XERO_CLIENT_SECRET should be from developer app
   - Redirect URI should match beta environment URL

**Connection Steps:**

**Navigation:** Dashboard → Settings → Integrations → Xero

1. Click "Connect to Xero"
2. Sign in to Xero (using demo company credentials)
3. Authorize Provvypay
4. Select "Demo Company" from tenant list
5. Verify connection shows "Connected"

---

## 3. Payment Integration Testing

### Test Scenario 1: Stripe Payment

**Create Payment Link:**

1. Dashboard → Payment Links → Create New
2. Fill details:
   - Amount: $10.00
   - Description: "Test Payment - Stripe"
   - Currency: USD
3. Save and activate

**Make Payment:**

1. Copy payment link URL
2. Open in incognito/private browser
3. Select "Stripe" payment method
4. Click "Pay" button
5. Use test card: `4242 4242 4242 4242`
6. Expiry: Any future date (e.g., 12/25)
7. CVC: Any 3 digits (e.g., 123)
8. Complete payment

**Verify:**
- ✅ Payment link status → PAID
- ✅ Shows in Payment Links table
- ✅ Appears in Ledger tab
- ✅ Appears in Transactions tab
- ✅ Xero sync status → SUCCESS (if connected)

### Test Scenario 2: Hedera Payment (HBAR)

**Create Payment Link:**

1. Dashboard → Payment Links → Create New
2. Amount: $10.00
3. Currency: USD
4. Save and activate

**Make Payment:**

1. Copy payment link URL
2. Open in browser
3. Select "Hedera" payment method
4. Select "HBAR" token
5. Connect HashPack wallet (testnet)
6. Review amount (converted to HBAR)
7. Approve transaction in HashPack
8. Wait for confirmation (~3-5 seconds)

**Verify:**
- ✅ Payment detected and confirmed
- ✅ Status → PAID
- ✅ Shows correct token (HBAR)
- ✅ Ledger entries created
- ✅ Transaction recorded
- ✅ Xero sync triggered

### Test Scenario 3: Hedera Payment (USDC)

Repeat Test Scenario 2 but select "USDC" token instead of HBAR.

**Note:** Beta tester needs USDC testnet tokens:
```bash
# Get testnet USDC from Hedera portal or faucet
# Or you can send from your testnet account
```

---

## 4. Data Verification

### 4.1 Payment Links Table

**Navigation:** Dashboard → Payment Links

**Verify displays:**
- Payment link details
- Status badges (OPEN, PAID, EXPIRED)
- Amount and currency
- Payment method used
- Creation and payment dates
- Search and filter functionality

### 4.2 Ledger Tab

**Navigation:** Dashboard → Ledger

**Verify shows:**
- Double-entry bookkeeping entries
- Debit and credit entries for each payment
- Account names and codes
- Balanced entries (debits = credits)
- Filter by date range
- Export functionality

**Expected Accounts:**
- `1200` - Accounts Receivable
- `1050` - Stripe Clearing (for Stripe payments)
- `1051` - Crypto Clearing - HBAR (for HBAR payments)
- `1052` - Crypto Clearing - USDC (for USDC payments)
- `4000` - Revenue

### 4.3 Transactions Tab

**Navigation:** Dashboard → Transactions

**Verify displays:**
- Transaction history
- Payment method icons
- Amount and currency
- Customer information (if provided)
- Transaction IDs
- Status indicators
- Export to CSV

### 4.4 Xero Sync Verification

**If Xero connected, verify:**

1. **In Provvypay:**
   - Settings → Integrations → Xero
   - Check sync status for each payment
   - Should show "SUCCESS" or specific errors

2. **In Xero Demo Company:**
   - Go to Xero demo company dashboard
   - Accounting → Invoices
   - Verify invoices created for payments
   - Check invoice amounts match
   - Verify payments recorded against invoices

---

## 5. Troubleshooting

### Issue: Beta tester can't create account

**Solutions:**
- Verify Supabase email confirmation is enabled
- Check spam folder for confirmation email
- Verify SUPABASE environment variables are correct
- Check Supabase dashboard for failed signups

### Issue: Can't connect HashPack wallet

**Solutions:**
- Verify HashPack is set to TESTNET (not mainnet)
- Check `NEXT_PUBLIC_HEDERA_NETWORK=testnet` in env vars
- Verify testnet mirror node URL is correct
- Try refreshing the page and reconnecting

### Issue: Payments not showing in ledger

**Solutions:**
- Check database for ledger accounts:
  ```sql
  SELECT * FROM ledger_accounts WHERE organization_id = 'org-id';
  ```
- Run ledger account seeding:
  ```bash
  npm run seed:ledger-accounts
  ```
- Check application logs for errors

### Issue: Xero sync failing

**Solutions:**
- Verify Xero connection status in Settings → Integrations
- Check Xero tokens haven't expired (refresh if needed)
- Verify Xero account codes match your chart of accounts
- Check Xero API rate limits
- Review sync error messages in xero_syncs table

### Issue: Stripe payments not processing

**Solutions:**
- Verify using Stripe TEST keys (start with `sk_test_`)
- Check webhook configuration in Stripe dashboard
- Verify webhook secret matches environment variable
- Test webhook endpoint manually: `/api/stripe/webhook`
- Check Stripe dashboard for webhook delivery logs

---

## 6. Monitoring Beta Testing

### Application Logs

Monitor logs in Render:

```bash
# Option 1: Render Dashboard
# Go to: Dashboard → Your Service → Logs
# Enable "Live tail" to see real-time logs

# Option 2: Render CLI (if installed)
render logs --service your-service-name --tail

# Option 3: Download logs for analysis
# Dashboard → Your Service → Logs → Download
```

### Database Queries

Monitor beta tester activity:

```sql
-- Check beta tester's organization
SELECT * FROM organizations WHERE name LIKE '%Beta%';

-- Check payment links created
SELECT 
  pl.*,
  o.name as org_name
FROM payment_links pl
JOIN organizations o ON pl.organization_id = o.id
WHERE o.name LIKE '%Beta%'
ORDER BY pl.created_at DESC;

-- Check payments made
SELECT 
  pe.*,
  pl.short_code,
  pl.amount,
  pl.currency
FROM payment_events pe
JOIN payment_links pl ON pe.payment_link_id = pl.id
JOIN organizations o ON pl.organization_id = o.id
WHERE o.name LIKE '%Beta%'
ORDER BY pe.created_at DESC;

-- Check ledger entries
SELECT 
  le.*,
  la.name as account_name,
  la.code as account_code
FROM ledger_entries le
JOIN ledger_accounts la ON le.account_id = la.id
JOIN organizations o ON la.organization_id = o.id
WHERE o.name LIKE '%Beta%'
ORDER BY le.created_at DESC;

-- Check Xero syncs
SELECT 
  xs.*,
  pl.short_code
FROM xero_syncs xs
JOIN payment_links pl ON xs.payment_link_id = pl.id
JOIN organizations o ON pl.organization_id = o.id
WHERE o.name LIKE '%Beta%'
ORDER BY xs.created_at DESC;
```

### Provide Beta Tester Feedback Form

Create a simple feedback document for the beta tester:

**Beta Testing Feedback Template:**

```markdown
# Provvypay Beta Testing Feedback

## Tester Information
- Name: [Beta Tester Name]
- Date: [Testing Date]
- Environment: [Beta URL]

## Account Setup
- [ ] Account creation worked smoothly
- [ ] Organization onboarding was clear
- [ ] Issues encountered: _____________________

## Payment Method Configuration
### Hedera Setup
- [ ] HashPack connection successful
- [ ] Testnet setup instructions were clear
- [ ] Issues: _____________________

### Stripe Setup
- [ ] Stripe payment worked as expected
- [ ] Issues: _____________________

### Xero Setup
- [ ] Xero connection process was smooth
- [ ] Demo company connection worked
- [ ] Issues: _____________________

## Payment Testing
### Test 1: Stripe Payment
- Amount tested: $________
- [ ] Payment completed successfully
- [ ] Displayed in Payment Links table
- [ ] Appeared in Ledger
- [ ] Appeared in Transactions
- [ ] Synced to Xero (if applicable)
- Issues: _____________________

### Test 2: Hedera HBAR Payment
- Amount tested: $________
- [ ] Payment completed successfully
- [ ] All data displayed correctly
- Issues: _____________________

### Test 3: Hedera USDC Payment
- Amount tested: $________
- [ ] Payment completed successfully
- [ ] All data displayed correctly
- Issues: _____________________

## User Experience
### Overall Rating: ___/10

### What worked well:
- 
- 

### What was confusing:
- 
- 

### Suggestions for improvement:
- 
- 

### Bugs/Issues encountered:
- 
- 

## Additional Comments:



---
Thank you for beta testing Provvypay!
```

---

## 7. Quick Start Checklist for You (Developer)

Before sharing with beta tester:

### Environment Setup
- [ ] Deploy beta branch to Vercel
- [ ] Configure all environment variables (test/sandbox mode)
- [ ] Verify Stripe TEST keys are configured
- [ ] Verify Hedera TESTNET is configured
- [ ] Create Xero Developer App for beta
- [ ] Set up beta database (or use separate schema)
- [ ] Run database migrations
- [ ] Test webhook endpoints are accessible

### Access Provisioning
- [ ] Share beta environment URL with tester
- [ ] Provide this documentation
- [ ] Share Xero demo company details (if managing for them)
- [ ] Provide support contact method (email/Slack)

### Monitoring Setup
- [ ] Set up error monitoring (Sentry configured?)
- [ ] Set up log aggregation access
- [ ] Prepare database access for debugging
- [ ] Create feedback collection method

### Testing Scenarios
- [ ] Document expected test scenarios
- [ ] Create test payment links if needed
- [ ] Prepare test account credentials
- [ ] Set up test Hedera tokens for transfer if needed

---

## 8. Post-Beta Testing

### Data Cleanup (Optional)

If you want to clean up beta test data:

```sql
-- Identify beta tester organization
SELECT id, name FROM organizations WHERE name LIKE '%Beta%';

-- Delete in reverse order of foreign key dependencies
DELETE FROM audit_logs WHERE organization_id = 'beta-org-id';
DELETE FROM xero_syncs WHERE payment_link_id IN (
  SELECT id FROM payment_links WHERE organization_id = 'beta-org-id'
);
DELETE FROM ledger_entries WHERE payment_link_id IN (
  SELECT id FROM payment_links WHERE organization_id = 'beta-org-id'
);
DELETE FROM fx_snapshots WHERE payment_link_id IN (
  SELECT id FROM payment_links WHERE organization_id = 'beta-org-id'
);
DELETE FROM payment_events WHERE payment_link_id IN (
  SELECT id FROM payment_links WHERE organization_id = 'beta-org-id'
);
DELETE FROM payment_links WHERE organization_id = 'beta-org-id';
DELETE FROM xero_connections WHERE organization_id = 'beta-org-id';
DELETE FROM merchant_settings WHERE organization_id = 'beta-org-id';
DELETE FROM ledger_accounts WHERE organization_id = 'beta-org-id';
DELETE FROM organizations WHERE id = 'beta-org-id';
```

---

## Summary

**The optimal approach is:**

1. ✅ **Separate Beta Environment** (Vercel preview/branch deployment)
2. ✅ **All Sandbox Credentials** (Stripe test, Hedera testnet, Xero demo)
3. ✅ **Self-Service Onboarding** (Beta tester creates own account)
4. ✅ **Guided Setup Process** (Provide this documentation)
5. ✅ **Active Monitoring** (Watch logs and database)
6. ✅ **Structured Feedback** (Use feedback template)

This approach ensures:
- ✅ Safe testing without affecting production
- ✅ Beta tester can fully explore all features
- ✅ All integrations work in sandbox mode
- ✅ You can monitor and support effectively
- ✅ Easy to clean up or transition to production

---

**Questions or Issues?**

Contact: [Your email or support channel]

---

**Document Version:** 1.0  
**Last Updated:** January 7, 2026


# Sprint 12 Deployment Checklist
## Xero Multi-Token Integration Deployment

**Date:** December 15, 2024  
**Sprint:** 12 - Xero Integration with Multi-Token Support  
**Status:** Ready for Deployment

---

## Pre-Deployment Checklist

### 1. Code Review ✅
- [ ] All 14 files created and reviewed
- [ ] TypeScript compilation successful
- [ ] No linting errors
- [ ] Tests passing
- [ ] Code follows project conventions

### 2. Database Preparation
- [ ] Backup production database
- [ ] Review migration SQL
- [ ] Test migration on staging database
- [ ] Verify migration rollback plan

### 3. Environment Variables
- [ ] Verify `XERO_CLIENT_ID` is set
- [ ] Verify `XERO_CLIENT_SECRET` is set
- [ ] Verify `XERO_REDIRECT_URI` is correct
- [ ] Verify `DATABASE_URL` is correct
- [ ] Check encryption key for token storage

### 4. Dependencies
- [ ] `xero-node` package installed
- [ ] All peer dependencies satisfied
- [ ] No version conflicts

---

## Deployment Steps

### Step 1: Database Migration

#### 1.1 Run Migration
```bash
# Connect to production database
npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

#### 1.2 Verify Migration
```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'merchant_settings' 
AND column_name LIKE 'xero_%'
ORDER BY column_name;

-- Expected: 8 columns
-- xero_audd_clearing_account_id
-- xero_fee_expense_account_id
-- xero_hbar_clearing_account_id
-- xero_receivable_account_id
-- xero_revenue_account_id
-- xero_stripe_clearing_account_id
-- xero_usdc_clearing_account_id
-- xero_usdt_clearing_account_id
```

#### 1.3 Verify Comments
```sql
-- Check column comments
SELECT 
  column_name,
  col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position) as column_comment
FROM information_schema.columns 
WHERE table_name = 'merchant_settings' 
AND column_name LIKE 'xero_%';
```

---

### Step 2: Deploy Code

#### 2.1 Build Application
```bash
# Build for production
npm run build

# Check for build errors
# Verify no TypeScript errors
# Verify no missing dependencies
```

#### 2.2 Deploy to Production
```bash
# Push to production branch
git add .
git commit -m "Sprint 12: Xero multi-token integration"
git push origin production

# Or deploy via your CI/CD pipeline
# Vercel: git push will auto-deploy
# Other: follow your deployment process
```

#### 2.3 Verify Deployment
- [ ] Application starts successfully
- [ ] No runtime errors in logs
- [ ] Health check passes
- [ ] Database connection working

---

### Step 3: Configure Xero Integration

#### 3.1 Verify Xero Connection
```typescript
// Test Xero connection still active
GET /api/xero/status?organization_id={your-org-id}

Expected Response:
{
  "connected": true,
  "tenantId": "...",
  "expiresAt": "...",
  "connectedAt": "...",
  "tenants": [...]
}
```

#### 3.2 Fetch Xero Accounts
```typescript
// Fetch chart of accounts
GET /api/xero/accounts?organization_id={your-org-id}

// Verify response includes accounts with codes:
// - 4000 (Revenue)
// - 1200 (Receivable)
// - 1050-1054 (Clearing accounts)
// - 6100 (Fees)
```

#### 3.3 Configure Account Mappings

**Navigate to:** Settings → Xero → Account Mapping

Map all 8 accounts:
- [ ] Revenue Account (e.g., 4000 Sales)
- [ ] Accounts Receivable (e.g., 1200 Trade Debtors)
- [ ] Stripe Clearing (e.g., 1050 Stripe Clearing)
- [ ] HBAR Clearing (e.g., **1051 Crypto - HBAR**)
- [ ] USDC Clearing (e.g., **1052 Crypto - USDC**)
- [ ] USDT Clearing (e.g., **1053 Crypto - USDT**)
- [ ] AUDD Clearing (e.g., **1054 Crypto - AUDD** 🇦🇺)
- [ ] Fee Expense (e.g., 6100 Bank Fees)

**Verify:**
- [ ] All fields are filled
- [ ] No duplicate crypto clearing accounts
- [ ] AUDD shows 🇦🇺 badge
- [ ] Save successful

---

### Step 4: Test Sync (Staging/Test)

#### 4.1 Test Stripe Payment Sync
```bash
# Create test Stripe payment
# Amount: $1.00 (minimize cost)
# Verify:
# - Invoice created in Xero
# - Payment recorded
# - Uses Stripe clearing account
# - Narration correct
```

#### 4.2 Test HBAR Payment Sync
```bash
# Create test HBAR payment
# Amount: Small amount in HBAR
# Verify:
# - Invoice created in Xero
# - Payment recorded
# - Uses HBAR clearing account (1051)
# - Narration includes token details
# - FX rate included
```

#### 4.3 Test USDC Payment Sync
```bash
# Create test USDC payment
# Amount: $1 USDC
# Verify:
# - Uses USDC clearing account (1052)
# - Narration correct
```

#### 4.4 Test USDT Payment Sync
```bash
# Create test USDT payment
# Amount: $1 USDT
# Verify:
# - Uses USDT clearing account (1053)
# - Narration correct
```

#### 4.5 Test AUDD Payment Sync ⭐
```bash
# Create test AUDD payment
# Amount: $1 AUD / 1 AUDD
# Verify:
# - Uses AUDD clearing account (1054)
# - Narration includes "No FX risk" note
# - Currency match detected (AUDD/AUD)
```

---

### Step 5: Monitor Production

#### 5.1 Check Logs
```bash
# Monitor application logs for:
# - Xero API errors
# - Sync failures
# - Token refresh issues
# - Database errors

# Check for:
tail -f /var/log/app/production.log | grep -i xero
```

#### 5.2 Monitor Sync Records
```sql
-- Check recent syncs
SELECT 
  pl.short_code,
  xs.status,
  xs.sync_type,
  xs.xero_invoice_id,
  xs.xero_payment_id,
  xs.error_message,
  xs.retry_count,
  xs.created_at
FROM xero_syncs xs
JOIN payment_links pl ON pl.id = xs.payment_link_id
ORDER BY xs.created_at DESC
LIMIT 20;

-- Check for failures
SELECT COUNT(*), status
FROM xero_syncs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

#### 5.3 Monitor Xero Connection
```sql
-- Check connection expiry
SELECT 
  organization_id,
  tenant_id,
  expires_at,
  connected_at,
  (expires_at > NOW()) as is_valid
FROM xero_connections;

-- Alert if expiring soon (< 1 day)
SELECT * 
FROM xero_connections 
WHERE expires_at < NOW() + INTERVAL '1 day';
```

---

### Step 6: Production Verification

#### 6.1 Verify First Real Transaction
- [ ] Real payment comes in
- [ ] Sync triggered automatically (or manually)
- [ ] Invoice created in Xero
- [ ] Payment recorded correctly
- [ ] Correct clearing account used
- [ ] Narration complete and accurate
- [ ] No errors in logs

#### 6.2 Verify in Xero
Log into Xero and check:
- [ ] Invoice appears in Sales → Invoices
- [ ] Invoice status is "PAID"
- [ ] Payment appears in Accounting → Bank Accounts
- [ ] Clearing account has correct balance
- [ ] Narration visible in transaction details
- [ ] All details match payment link

#### 6.3 Reconciliation Test
```sql
-- Compare payment link amounts with Xero
SELECT 
  pl.short_code,
  pl.amount as link_amount,
  pl.currency,
  pe.payment_method,
  (pe.metadata->>'paymentToken')::text as token,
  xs.xero_invoice_id,
  xs.xero_payment_id
FROM payment_links pl
JOIN payment_events pe ON pe.payment_link_id = pl.id
JOIN xero_syncs xs ON xs.payment_link_id = pl.id
WHERE pl.status = 'PAID'
AND xs.status = 'SUCCESS'
AND pl.created_at > NOW() - INTERVAL '7 days'
ORDER BY pl.created_at DESC;
```

---

## Post-Deployment Tasks

### Monitoring Setup
- [ ] Set up alerts for sync failures
- [ ] Set up alerts for Xero token expiry
- [ ] Set up daily reconciliation reports
- [ ] Set up error notification emails

### Documentation Updates
- [ ] Update internal documentation
- [ ] Update user guide with Xero setup steps
- [ ] Document troubleshooting procedures
- [ ] Update API documentation

### Team Training
- [ ] Train support team on Xero integration
- [ ] Document common issues and solutions
- [ ] Create runbook for Xero connection issues
- [ ] Share account mapping guidelines

---

## Rollback Plan

### If Deployment Fails

#### Option 1: Rollback Code Only
```bash
# Revert to previous version
git revert HEAD
git push origin production

# Database changes are safe to keep
# (new columns are optional, won't break old code)
```

#### Option 2: Rollback Code + Database
```bash
# Revert code
git revert HEAD
git push origin production

# Rollback migration
npx prisma migrate rollback --schema=./src/prisma/schema.prisma

# Or manually:
ALTER TABLE merchant_settings 
  DROP COLUMN IF EXISTS xero_revenue_account_id,
  DROP COLUMN IF EXISTS xero_receivable_account_id,
  DROP COLUMN IF EXISTS xero_stripe_clearing_account_id,
  DROP COLUMN IF EXISTS xero_hbar_clearing_account_id,
  DROP COLUMN IF EXISTS xero_usdc_clearing_account_id,
  DROP COLUMN IF EXISTS xero_usdt_clearing_account_id,
  DROP COLUMN IF EXISTS xero_audd_clearing_account_id,
  DROP COLUMN IF EXISTS xero_fee_expense_account_id,
  DROP COLUMN IF EXISTS updated_at;
```

---

## Success Criteria

Deployment is successful when:
- [ ] All 14 files deployed
- [ ] Database migration applied
- [ ] No runtime errors
- [ ] Xero connection active
- [ ] Account mappings configured
- [ ] Test payments synced successfully
- [ ] All 4 crypto tokens working
- [ ] Invoices appear in Xero
- [ ] Payments recorded correctly
- [ ] Correct clearing accounts used
- [ ] Narration includes all details
- [ ] AUDD shows "No FX risk" note
- [ ] No errors in logs
- [ ] Reconciliation matches

---

## Emergency Contacts

**In case of issues during deployment:**

- Database Admin: [Contact]
- DevOps Lead: [Contact]
- Xero Support: https://developer.xero.com/support
- On-Call Engineer: [Contact]

---

## Post-Deployment Checklist Summary

### Immediate (Day 1)
- [ ] Verify deployment successful
- [ ] Check all services running
- [ ] Test Xero connection
- [ ] Configure account mappings
- [ ] Sync 1 test payment per token (5 total)
- [ ] Verify in Xero
- [ ] Monitor logs

### Short Term (Week 1)
- [ ] Monitor sync success rate
- [ ] Check Xero token refresh
- [ ] Review error logs
- [ ] Reconcile payments
- [ ] Collect user feedback
- [ ] Fix any issues

### Long Term (Month 1)
- [ ] Analyze sync performance
- [ ] Review clearing account balances
- [ ] Complete reconciliation
- [ ] Optimize if needed
- [ ] Plan Phase 2 features

---

## Additional Resources

- **Sprint 12 Complete:** `SPRINT12_COMPLETE.md`
- **Quick Reference:** `SPRINT12_QUICK_REFERENCE.md`
- **Xero Setup Guide:** `XERO_SETUP_GUIDE.md`
- **Sprint 11 (Xero OAuth):** `SPRINT11_COMPLETE.md`
- **Sprint 10 (Ledger):** `SPRINT10_COMPLETE.md`

---

**Deployment Team Sign-Off**

- [ ] Developer: _________________ Date: _______
- [ ] Tech Lead: _________________ Date: _______
- [ ] QA: _______________________ Date: _______
- [ ] DevOps: ___________________ Date: _______
- [ ] Product Owner: ____________ Date: _______

---

**Sprint 12 Deployment - Ready to Go Live! 🚀**







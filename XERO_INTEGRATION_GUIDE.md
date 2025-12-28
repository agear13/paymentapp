# Xero Integration Guide

Complete guide to integrating Provvypay with your Xero accounting system.

---

## 🎯 Overview

Provvypay automatically syncs payments to Xero, creating:
- ✅ Invoices (Accounts Receivable)
- ✅ Payments against invoices
- ✅ Proper double-entry ledger entries
- ✅ Fee expense records

**AUDD Support:** Fully supports AUDD payments with dedicated clearing account (1054).

---

## 📋 Prerequisites

Before connecting:
- [ ] Active Xero account
- [ ] Xero organization set up
- [ ] Chart of accounts configured
- [ ] Bank accounts created in Xero

---

## Step 1: Connect to Xero

1. Go to **Dashboard → Settings → Integrations**
2. Find the **Xero** card
3. Click **"Connect to Xero"**
4. Log in to your Xero account
5. Select your organization
6. Click **"Authorize"**
7. You'll be redirected back to Provvypay

**Connection Status:** Check at Settings → Integrations

---

## Step 2: Configure Account Mappings

After connecting, map Provvypay accounts to your Xero chart of accounts.

### Required Mappings

#### 1. Revenue Account
**Provvypay:** Revenue (4000)  
**Xero:** Sales account (e.g., "Sales" or "Revenue")

**Purpose:** Where sales revenue is recorded

#### 2. Receivables Account
**Provvypay:** Accounts Receivable (1200)  
**Xero:** Accounts Receivable (e.g., "Accounts Receivable (USD)")

**Purpose:** Invoice amounts owed

#### 3. Stripe Clearing Account
**Provvypay:** Stripe Clearing (1050)  
**Xero:** Bank account for Stripe settlements

**Purpose:** Credit card payments via Stripe

#### 4. Hedera HBAR Clearing Account
**Provvypay:** Crypto Clearing - HBAR (1051)  
**Xero:** Bank account or crypto account for HBAR

**Purpose:** HBAR cryptocurrency payments

#### 5. Hedera USDC Clearing Account
**Provvypay:** Crypto Clearing - USDC (1052)  
**Xero:** Bank account for USDC

**Purpose:** USDC stablecoin payments

#### 6. Hedera USDT Clearing Account
**Provvypay:** Crypto Clearing - USDT (1053)  
**Xero:** Bank account for USDT

**Purpose:** USDT stablecoin payments

#### 7. Hedera AUDD Clearing Account ⭐
**Provvypay:** Crypto Clearing - AUDD (1054)  
**Xero:** Bank account for AUDD

**Purpose:** AUDD (Australian Dollar) stablecoin payments

#### 8. Fee Expense Account
**Provvypay:** Processor Fee Expense (6100)  
**Xero:** Expense account (e.g., "Bank Fees" or "Processing Fees")

**Purpose:** Payment processing fees

---

## Step 3: Understanding the Sync Flow

### When a Payment is Confirmed

**Automatically happens:**

1. **Invoice Created in Xero**
   - Contact: Customer email or "Walk-in Customer"
   - Amount: Payment amount
   - Due Date: Today
   - Reference: Payment link short code
   - Line Item: Payment description

2. **Payment Applied**
   - Against the invoice
   - Clearing account: Based on payment method
   - Amount: Full payment amount
   - Narration includes token type (e.g., "HEDERA_AUDD")

3. **Fee Recorded (if applicable)**
   - Stripe fees automatically recorded
   - Debit: Fee Expense
   - Credit: Clearing Account

---

## 📊 Example: AUDD Payment Sync

### Payment Details
- Amount: AUD $100.00
- Method: Hedera
- Token: AUDD
- Reference: ABC12345

### Xero Entries Created

**Invoice:**
```
Contact: customer@example.com
Date: 2025-12-16
Due Date: 2025-12-16
Reference: ABC12345

Line Items:
- Description: Payment for services
- Amount: AUD $100.00
- Account: Revenue (4000)
```

**Payment:**
```
Invoice: [Invoice from above]
Date: 2025-12-16
Amount: AUD $100.00
Account: Crypto Clearing - AUDD (1054)
Narration: HEDERA_AUDD payment for ABC12345
Reference: 0.0.123@1234567.890
```

---

## 🔄 Sync Queue & Retry Logic

### Automatic Retry

If sync fails, Provvypay automatically retries with exponential backoff:
- **Attempt 1:** Immediate
- **Attempt 2:** After 1 minute
- **Attempt 3:** After 5 minutes
- **Attempt 4:** After 15 minutes
- **Attempt 5:** After 1 hour
- **Attempt 6:** After 6 hours

### Manual Replay

If all retries fail:
1. Go to **Dashboard → Admin → Queue**
2. Find the failed sync
3. Click **"Replay"**
4. Optionally check "Reset retry count"
5. Click **"Confirm"**

---

## 🚨 Troubleshooting

### Common Issues

#### Issue: "Invalid Account Code"

**Cause:** Xero account mapping is incorrect

**Solution:**
1. Go to Settings → Integrations
2. Click "Configure Account Mappings"
3. Verify all accounts are mapped correctly
4. Ensure accounts exist in your Xero chart of accounts

#### Issue: "Duplicate Invoice"

**Cause:** Invoice with same reference already exists

**Solution:**
1. Check if payment was already synced
2. Archive old invoice in Xero
3. Replay sync

#### Issue: "Insufficient Permissions"

**Cause:** Xero connection doesn't have required scopes

**Solution:**
1. Disconnect from Xero
2. Reconnect with full permissions
3. Ensure you're org admin in Xero

#### Issue: "Token Expired"

**Cause:** Xero access token expired

**Solution:**
- Provvypay automatically refreshes tokens
- If issue persists, reconnect to Xero

---

## 📈 Monitoring Sync Status

### Sync Queue Dashboard

**Location:** Dashboard → Admin → Queue

**View:**
- Pending syncs
- Failed syncs
- Successful syncs
- Retry attempts
- Error messages

**Filters:**
- Status (PENDING, SUCCESS, FAILED)
- Date range
- Payment link

### Error Logs

**Location:** Dashboard → Admin → Errors

**Information:**
- Error type
- Error message
- Request payload
- Response payload
- Stack trace
- Timestamp

---

## 🎯 Best Practices

### 1. Use Dedicated Xero Accounts
Create specific bank accounts in Xero for each crypto token:
- "Stripe Clearing"
- "HBAR Clearing"
- "USDC Clearing"
- "USDT Clearing"
- "AUDD Clearing" ⭐

### 2. Regular Reconciliation
Run reconciliation reports weekly to verify:
- Expected revenue matches ledger balance
- No discrepancies
- All payments synced

**Location:** Dashboard → Reports → Reconciliation

### 3. Monitor Failed Syncs
Check sync queue daily:
- Address failed syncs promptly
- Replay as needed
- Investigate error patterns

### 4. Test Connection
After initial setup:
1. Create test payment link
2. Complete test payment
3. Verify sync to Xero
4. Check invoice and payment created

### 5. Keep Accounts Active
Don't delete or archive mapped Xero accounts while they're in use.

---

## 🔐 Security & Permissions

### Required Xero Scopes
- `accounting.transactions` - Create/read transactions
- `accounting.contacts` - Create/read contacts
- `accounting.settings` - Read account codes
- `offline_access` - Refresh tokens

### Data Privacy
- Only payment data is synced
- No customer PII beyond email
- Secure OAuth 2.0 flow
- Encrypted token storage

---

## 💰 Fee Handling

### Stripe Fees
Automatically recorded:
```
DR: Processor Fee Expense (6100)  $2.90
CR: Stripe Clearing (1050)        $2.90
```

### Hedera Fees
Network fees are typically $0.0001 USD - not material enough to record.

---

## 📊 Reporting in Xero

### Check Balances

**Clearing Account Balances:**
Go to Xero → Reports → Balance Sheet

Look for:
- Stripe Clearing (should match pending Stripe settlements)
- HBAR Clearing (should match HBAR held)
- USDC Clearing (should match USDC held)
- USDT Clearing (should match USDT held)
- AUDD Clearing (should match AUDD held) ⭐

### Reconcile Payments

**Bank Reconciliation:**
1. When you receive actual funds (bank deposit or crypto transfer)
2. Record bank deposit in Xero
3. Match against clearing account balance
4. Reduces clearing account, increases actual bank account

---

## 🆘 Support

### Getting Help

**Sync Issues:**
1. Check error logs first
2. Try manual replay
3. Verify account mappings
4. Contact support if unresolved

**Contact:**
- Email: support@provvypay.com
- Include: Payment link ID, error message, Xero org ID

**Response Time:** 
- Critical (blocking payments): 1 hour
- Non-critical: 24 hours

---

## 📚 Additional Resources

- **API Documentation:** See `API_DOCUMENTATION.md`
- **Merchant Guide:** See `MERCHANT_ONBOARDING_GUIDE.md`
- **Xero Developer Docs:** https://developer.xero.com

---

**Last Updated:** December 16, 2025  
**Version:** 1.0








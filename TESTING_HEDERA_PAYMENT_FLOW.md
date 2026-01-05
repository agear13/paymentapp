# Testing Guide: Hedera Payment End-to-End Flow

## Pre-requisites

1. ✅ Local development server running OR deployed to Render
2. ✅ PostgreSQL database accessible
3. ✅ HashPack wallet installed in browser
4. ✅ Test account with testnet HBAR/tokens
5. ✅ Merchant settings configured with Hedera account

## Test 1: Complete Payment Flow (Happy Path)

### Step 1: Create Payment Link
```
1. Go to http://localhost:3000/dashboard/payment-links
2. Click "Create Payment Link"
3. Fill in:
   - Amount: $100.00
   - Currency: USD
   - Description: "Test Payment"
   - Enable Hedera checkbox
4. Click "Create"
5. Note the short code (e.g., "abc123xy")
```

### Step 2: Open Payment Page
```
1. Go to http://localhost:3000/pay/abc123xy
2. Verify Hedera option shows
3. Click on Hedera payment option
```

### Step 3: Connect Wallet
```
1. Click "Connect HashPack"
2. Approve in HashPack extension
3. Verify account shows as connected
4. Click "Pay now" button
```

### Step 4: Select Token & Review
```
1. Wait for token amounts to load
2. Select a token (e.g., USDC)
3. Review payment details
4. Click "Continue to Instructions"
```

### Step 5: Send Payment
```
1. Follow the payment instructions shown
2. Copy merchant account ID
3. Copy exact amount
4. Open HashPack wallet
5. Send payment to merchant account
   - Amount: Exact amount shown
   - Token: Selected token
6. Confirm transaction in HashPack
7. Wait for transaction to finalize (~3-5 seconds)
```

### Step 6: Monitor Payment
```
1. Return to payment page
2. Click "I sent the payment"
3. Observe monitoring state
4. Wait for transaction detection (~3-9 seconds)
5. Verify state changes to "complete"
6. Verify redirect to success page
```

### Step 7: Verify Dashboard
```
1. Go to http://localhost:3000/dashboard/payment-links
2. Wait up to 3 seconds for polling refresh
3. Verify payment link shows "PAID" status badge
4. Click on the payment link to view details
5. Verify payment event is recorded
```

### Step 8: Verify Database
```sql
-- Check payment link status
SELECT id, status, updated_at 
FROM payment_links 
WHERE short_code = 'abc123xy';
-- Expected: status = 'PAID'

-- Check payment event
SELECT event_type, payment_method, hedera_transaction_id, 
       amount_received, currency_received, metadata
FROM payment_events 
WHERE payment_link_id = '<link-id>';
-- Expected: 1 row with PAID event and transaction details

-- Check ledger entries
SELECT entry_type, amount, currency, description, 
       la.code, la.name
FROM ledger_entries le
JOIN ledger_accounts la ON le.ledger_account_id = la.id
WHERE payment_link_id = '<link-id>';
-- Expected: 2 rows (DEBIT to crypto clearing, CREDIT to AR)
```

### Expected Results ✅
- ✅ Payment link status changes to PAID
- ✅ Payment event created with transaction ID
- ✅ 2 ledger entries created (balanced)
- ✅ Dashboard shows PAID within 3 seconds
- ✅ Frontend redirects to success page
- ✅ No errors in browser console
- ✅ No 500 errors in server logs

---

## Test 2: Idempotency (Duplicate Detection)

### Setup
```
Complete Test 1 first to have a PAID payment link
```

### Steps
```
1. Keep the success page open (or go back to payment page)
2. Open browser DevTools → Network tab
3. Manually trigger another monitor check:
   
   fetch('/api/hedera/transactions/monitor', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       paymentLinkId: '<link-id>',
       merchantAccountId: '0.0.xxxxx',
       network: 'testnet',
       tokenType: 'USDC',
       expectedAmount: 100.5
     })
   }).then(r => r.json()).then(console.log)

4. Check response
5. Check database
```

### Expected Results ✅
- ✅ Response includes `{ found: true, alreadyPaid: true, persisted: true }`
- ✅ No duplicate payment_events created
- ✅ No duplicate ledger_entries created
- ✅ Logs show "Transaction already recorded - idempotent duplicate"

---

## Test 3: Wrong Amount (Validation Failure)

### Steps
```
1. Create new payment link for $100
2. Follow steps to connect wallet and select token
3. Send LESS than required amount (e.g., only $50)
4. Click "I sent the payment"
5. Wait for full monitoring cycle (60 seconds)
```

### Expected Results ✅
- ✅ Transaction NOT detected (amount mismatch)
- ✅ Monitoring times out after max attempts
- ✅ Shows "Payment not detected yet" message
- ✅ Payment link remains OPEN (not PAID)
- ✅ No database records created

---

## Test 4: Dashboard Real-time Updates

### Setup
```
Open two browser windows:
1. Payment page (http://localhost:3000/pay/abc123xy)
2. Dashboard (http://localhost:3000/dashboard/payment-links)
```

### Steps
```
1. Position windows side-by-side
2. Start payment flow in Window 1
3. Watch dashboard in Window 2 (no refresh needed)
4. Complete payment in Window 1
5. Observe dashboard in Window 2
```

### Expected Results ✅
- ✅ Dashboard updates within 3 seconds (1 polling cycle)
- ✅ Status badge changes from OPEN to PAID
- ✅ No manual refresh needed
- ✅ Payment appears in correct status filter

---

## Test 5: Error Handling

### Test 5a: Invalid Payment Link ID
```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "not-a-uuid",
    "merchantAccountId": "0.0.123",
    "network": "testnet",
    "tokenType": "HBAR",
    "expectedAmount": 100
  }'
```

**Expected:**
```json
{
  "error": "invalid_payment_link_id",
  "message": "Payment link ID must be a valid UUID"
}
```
Status: 400

### Test 5b: Non-Existent Payment Link
```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "00000000-0000-0000-0000-000000000000",
    "merchantAccountId": "0.0.123",
    "network": "testnet",
    "tokenType": "HBAR",
    "expectedAmount": 100
  }'
```

**Expected:**
```json
{
  "error": "payment_link_not_found",
  "message": "The specified payment link does not exist"
}
```
Status: 404

### Test 5c: Network Timeout
```
1. Temporarily block access to testnet.mirrornode.hedera.com
2. Trigger payment monitoring
3. Wait for timeout
```

**Expected:**
- ✅ Returns { found: false, error: "Timeout" } after 7 seconds
- ✅ No 500 error
- ✅ Logs show "Transaction check timed out"

---

## Test 6: Ledger Account Auto-Creation

### Steps
```sql
-- Delete existing ledger accounts for test org
DELETE FROM ledger_entries WHERE ledger_account_id IN (
  SELECT id FROM ledger_accounts WHERE organization_id = '<test-org-id>'
);
DELETE FROM ledger_accounts WHERE organization_id = '<test-org-id>';

-- Now complete a payment
```

### Expected Results ✅
- ✅ Payment completes successfully
- ✅ Crypto clearing account created (e.g., "1051-USDC")
- ✅ Accounts receivable account created ("1200")
- ✅ Ledger entries use newly created accounts
- ✅ Logs show "Created crypto clearing account" and "Created accounts receivable account"

---

## Monitoring Production Logs

### Successful Payment Log Sequence
```
1. [hedera] Transaction check requested
   { paymentLinkId, merchantAccountId, tokenType, expectedAmount }

2. [hedera] Mirror node query completed
   { queryDuration, url }

3. [hedera] Transaction found and processed
   { paymentLinkId, transactionId, duration, updated }

4. [hedera] Payment persisted successfully
   { 
     paymentLinkId, 
     transactionId, 
     amount, 
     tokenType, 
     sender,
     ledgerEntries: { debit, credit }
   }

5. [hedera] Transaction found and persisted
   { paymentLinkId, transactionId, persisted: true, duration }
```

### Failed Persistence Log Sequence
```
1. [hedera] Transaction check requested
2. [hedera] Mirror node query completed
3. [hedera] Transaction found and processed
4. [hedera] Failed to update payment link with transaction
   { error, paymentLinkId, transactionId }
5. [hedera] Transaction found but not persisted
   { paymentLinkId, transactionId, updated: false }
```

---

## Common Issues & Solutions

### Issue: Frontend stuck on "monitoring"
**Check:**
- Is transaction actually sent? Check HashPack
- Is transaction finalized? Wait 5 seconds
- Are amounts exact? Check mirror node manually
- Network errors? Check browser console

### Issue: Dashboard not updating
**Check:**
- Is polling enabled? Check console for fetch requests
- Is link status OPEN? (needs active links for polling)
- Database connection? Check API endpoint
- Cache issues? Hard refresh (Ctrl+Shift+R)

### Issue: "Payment link not found" error
**Check:**
- Is payment link ID correct?
- Is payment link in database?
- Organization ID matches?

### Issue: Duplicate ledger entries
**Check:**
- Idempotency keys unique?
- Transaction ID same but different payment?
- Database constraint on idempotency_key?

---

## Performance Benchmarks

Expected timings:
- Transaction finality: 3-5 seconds
- Mirror node query: 500-2000ms
- Database persistence: 200-500ms
- Total monitor endpoint: 1-8 seconds
- Dashboard update: 0-3 seconds (next poll)
- Frontend redirect: 2 seconds after detection

---

## Rollback Plan

If issues occur in production:

1. **Disable Hedera payments:**
   ```sql
   UPDATE merchant_settings 
   SET hedera_enabled = false 
   WHERE organization_id = '<org-id>';
   ```

2. **Revert code changes:**
   - Transaction-checker back to simple persistence
   - Monitor endpoint response format
   - Frontend error handling

3. **Fix data:**
   ```sql
   -- If duplicate events created
   DELETE FROM payment_events 
   WHERE id NOT IN (
     SELECT MIN(id) 
     FROM payment_events 
     GROUP BY payment_link_id, hedera_transaction_id
   );
   ```

---

## Success Criteria

All tests must pass:
- ✅ Test 1: Complete payment flow
- ✅ Test 2: Idempotency
- ✅ Test 3: Validation failure
- ✅ Test 4: Dashboard updates
- ✅ Test 5: Error handling
- ✅ Test 6: Auto-account creation

No errors in:
- ✅ Browser console
- ✅ Server logs
- ✅ Database constraints

Performance within:
- ✅ < 8 seconds: Transaction detection
- ✅ < 3 seconds: Dashboard update
- ✅ < 500ms: Database persistence


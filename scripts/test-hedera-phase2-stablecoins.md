# Test Guide - Hedera Phase 2: Stablecoin Pre-filled Payments

## Overview
Phase 2 extends the pre-filled transaction UX to stablecoins (USDC, USDT, AUDD). Users can now pay with any supported token using the same approve/reject flow introduced in Phase 1.

## Prerequisites

### 1. Wallet Setup
- HashPack wallet installed (extension or mobile app)
- Wallet on correct network (testnet or mainnet)
- Testnet HBAR for fees (~1 HBAR)
- **Token Association Required**: Wallet must be associated with the token(s) you want to test

### 2. Token Association (Critical!)
Before testing, associate your wallet with test tokens:

**In HashPack Wallet:**
1. Open HashPack
2. Go to "Tokens" tab
3. Click "Associate Token"
4. Enter token ID:
   - USDC Testnet: `0.0.429274`
   - USDT Testnet: `0.0.429275`
   - AUDD Testnet: `0.0.4918852`
5. Confirm association (costs ~$0.0001 HBAR)

**Get Test Tokens:**
For testnet, you may need to use a faucet or token dispenser if available. Check:
- Hedera Discord for testnet token faucets
- Testnet token dispenser tools
- Or contact token providers

### 3. Merchant Configuration
- Merchant has Hedera account ID configured
- Hedera payment method enabled for payment links
- Merchant account is associated with tokens (if they haven't received them before)

### 4. Environment Setup
```bash
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Test Scenarios

### Test 1: USDC Payment (Happy Path)

#### Setup
```bash
# Create payment link for $50 AUD
POST /api/payment-links
{
  "amount": "50.00",
  "currency": "AUD",
  "description": "Test USDC Phase 2",
  "availablePaymentMethods": {
    "hedera": true,
    "stripe": false
  }
}
```

#### Steps
1. ✅ Open payment page: `http://localhost:3000/pay/{shortCode}`
2. ✅ Click "Cryptocurrency"
3. ✅ Connect HashPack wallet
4. ✅ Verify wallet connected with account ID shown
5. ✅ Click "Pay now"
6. ✅ Select **USDC** from token list
7. ✅ Verify USDC balance is shown (if you have any)
8. ✅ Click **"Pay with USDC"** button
9. ✅ Verify HashPack opens with pre-filled transaction:
    - **Token**: USDC (verify icon/name shows correctly)
    - **To**: Merchant's Hedera account
    - **Amount**: Correct USDC amount (e.g., 33.120480 USDC for $50 AUD)
    - **Memo**: `Provvypay:{paymentLinkId}`
10. ✅ Click **Approve** in HashPack
11. ✅ Verify UI shows "Monitoring for payment..." (with spinner)
12. ✅ Wait for detection (~5-60 seconds, tokens may be slower than HBAR)
13. ✅ Verify success page appears
14. ✅ Verify payment status is **PAID**
15. ✅ Verify in database:
    - `payment_links.status = 'PAID'`
    - `payment_events` created with `currency_received = 'USDC'`
    - `ledger_entries` created with correct amounts

#### Expected Console Logs
```
[HederaPaymentOption] Sending token payment request: { tokenType: 'USDC', tokenId: '0.0.429274', decimals: 6, ... }
[HederaWalletClient] sendTokenPayment called: { tokenId: '0.0.429274', tokenType: 'USDC', decimals: 6, ... }
[HederaWalletClient] Preparing token transaction: { from: '0.0.xxxxx', to: '0.0.xxxxx', tokenId: '0.0.429274', amount: '33120480', ... }
[HederaWalletClient] Token transaction built, size: N bytes
[HederaWalletClient] ✅ Token transaction submitted: 0.0.xxxxx@timestamp
[Payment Monitor] Attempt 1/20 (window: 60min)
[Payment Monitor] Transaction found! { ... }
[Payment Monitor] Payment persisted successfully
```

### Test 2: USDT Payment

Same steps as Test 1, but select **USDT** instead.

**Verify:**
- Token ID used: `0.0.429275` (testnet)
- Correct USDT amount calculated
- Memo format correct
- Transaction detected within 60 seconds
- Database shows `currency_received = 'USDT'`

### Test 3: AUDD Payment

Same steps as Test 1, but select **AUDD** instead.

**Verify:**
- Token ID used: `0.0.4918852` (testnet)
- Correct AUDD amount calculated (should be close to 1:1 with AUD)
- Memo format correct
- Transaction detected
- Database shows `currency_received = 'AUDD'`

### Test 4: Transaction Rejection

#### Steps
1. Follow Test 1 steps 1-9
2. ✅ Click **Reject** in HashPack (instead of Approve)
3. ✅ Verify UI shows "Transaction Rejected" message
4. ✅ Verify "Try Again" button appears
5. ✅ Click "Try Again"
6. ✅ Verify returns to token selection screen
7. ✅ Can retry payment flow

#### Expected Behavior
- No transaction sent to network
- Payment status remains OPEN
- User can retry immediately
- No errors in console

### Test 5: Token Not Associated Error

#### Setup
Use a wallet that is **NOT** associated with the token you're trying to pay with.

#### Steps
1. Follow Test 1 steps 1-9 (with unassociated wallet)
2. ✅ Click "Approve" in HashPack
3. ✅ Verify error message appears:
   > "Your wallet needs to be associated with USDC. Please open HashPack, go to Tokens, and associate USDC first."
4. ✅ Message duration: 8 seconds
5. ✅ UI returns to token selection
6. ✅ Console shows association error logged

#### Recovery
1. Open HashPack
2. Associate the token
3. Return to payment page
4. Retry payment
5. Should now work

### Test 6: Insufficient Balance

#### Setup
Use a wallet with insufficient token balance (but has HBAR for fees).

#### Steps
1. Follow Test 1 steps 1-9
2. ✅ Click "Approve" in HashPack
3. ✅ Verify error message:
   > "Insufficient balance. Make sure you have enough USDC and a small amount of HBAR for network fees."
4. ✅ Message duration: 6 seconds
5. ✅ UI returns to token selection

### Test 7: Insufficient HBAR for Fees

#### Setup
Wallet has tokens but **NO HBAR** for network fees.

#### Expected Behavior
- HashPack may show error before transaction is sent
- Or shows "Insufficient HBAR" in HashPack
- Error message guides user to get HBAR

### Test 8: Network Mismatch

#### Setup
```bash
# Set network to mainnet in env
NEXT_PUBLIC_HEDERA_NETWORK=mainnet
```

#### Steps
1. Create payment link
2. Open payment page
3. Connect wallet (on testnet)
4. Try to pay with USDC
5. ✅ Verify correct mainnet token ID used: `0.0.456858`
6. ✅ Transaction may fail if wallet on wrong network
7. ✅ Error message should be clear

**Note**: For production testing, use mainnet tokens and ensure wallet is on mainnet.

### Test 9: Large Amount Payment

#### Setup
Create payment link for large amount (e.g., $5000 AUD).

#### Steps
1. Follow standard payment flow
2. ✅ Verify amount conversion is correct
3. ✅ Verify no floating-point precision errors
4. ✅ Verify transaction succeeds
5. ✅ Verify exact amount recorded in database

#### Verification
- Check `toSmallestUnit()` handles large numbers correctly
- Verify BigInt conversion doesn't overflow
- Check database stores exact amount

### Test 10: Concurrent Payments

#### Setup
Open two payment links in different tabs.

#### Steps
1. Connect wallet in Tab 1
2. Connect wallet in Tab 2 (should reuse connection)
3. Start payment in Tab 1
4. While monitoring, start payment in Tab 2
5. ✅ Verify both payments process correctly
6. ✅ Verify no state conflicts
7. ✅ Each payment has unique memo

### Test 11: Monitor Timeout Handling

#### Setup
Create payment link, approve transaction, but **artificially delay** backend detection.

#### Expected Behavior
- Monitor retries for ~60 seconds (20 attempts × 3s)
- After 60 seconds, shows error message
- User can click "Retry" to re-check
- Transaction window is 60 minutes for tokens (vs 15 for HBAR)

### Test 12: Memo Matching

#### Verification
After successful payment:

```sql
-- Check memo was recorded correctly
SELECT 
  pl.id,
  pl.short_code,
  pe.raw_metadata->>'memo' as memo
FROM payment_links pl
JOIN payment_events pe ON pe.payment_link_id = pl.id
WHERE pl.id = '{paymentLinkId}';

-- Expected: memo = "Provvypay:{paymentLinkId}"
```

Should exactly match the format sent in transaction.

## Database Verification

After successful stablecoin payment:

```sql
-- 1. Payment link status
SELECT id, status, short_code, amount, currency 
FROM payment_links 
WHERE id = '{paymentLinkId}';
-- Expected: status = 'PAID'

-- 2. Payment event details
SELECT 
  id, 
  event_type, 
  payment_provider, 
  currency_received,
  amount,
  raw_metadata->>'tokenType' as token_type,
  raw_metadata->>'memo' as memo,
  raw_metadata->>'transactionId' as tx_id
FROM payment_events 
WHERE payment_link_id = '{paymentLinkId}';
-- Expected: 
--   payment_provider = 'HEDERA'
--   currency_received = 'USDC' | 'USDT' | 'AUDD'
--   token_type = 'USDC' | 'USDT' | 'AUDD'
--   memo = 'Provvypay:{paymentLinkId}'

-- 3. Ledger entries (double-entry accounting)
SELECT 
  id,
  account_name,
  debit_amount,
  credit_amount,
  currency,
  description
FROM ledger_entries 
WHERE payment_link_id = '{paymentLinkId}'
ORDER BY created_at;
-- Expected: Multiple entries for DR/CR accounts

-- 4. Verify token decimals handled correctly
SELECT 
  amount,
  raw_metadata->>'amountInSmallestUnit' as smallest_unit,
  raw_metadata->>'decimals' as decimals
FROM payment_events 
WHERE payment_link_id = '{paymentLinkId}';
-- For USDC/USDT/AUDD: decimals should be 6
-- smallest_unit should be amount * 10^6
```

## Performance Benchmarks

### Expected Timings
- Wallet initialization: < 2 seconds
- Token transaction building: < 500ms
- HashPack opening: < 1 second
- Transaction submission: < 2 seconds
- **Token transaction detection: 10-60 seconds** (slower than HBAR due to Mirror Node indexing)
- Total flow (approval to confirmation): < 90 seconds

### Comparison: Phase 1 (HBAR) vs Phase 2 (Stablecoins)
- **HBAR**: 5-30 seconds detection
- **Stablecoins**: 10-60 seconds detection (token transfers indexed slightly slower)
- Both use same UI flow and monitoring logic
- Longer time window for tokens (60min vs 15min) reduces false negatives

## Error Scenarios & Messages

### 1. Token Not Associated
**Error**: `"Your wallet needs to be associated with {TOKEN}..."`
**Cause**: Wallet hasn't associated token
**Fix**: Associate token in HashPack

### 2. Insufficient Token Balance
**Error**: `"Insufficient balance. Make sure you have enough {TOKEN}..."`
**Cause**: Not enough tokens or HBAR
**Fix**: Add tokens or HBAR to wallet

### 3. Transaction Rejected
**Error**: `"Transaction rejected. You can try again when ready."`
**Cause**: User clicked Reject
**Fix**: Click "Try Again" button

### 4. Network Mismatch
**Error**: Various HashConnect errors
**Cause**: Wallet on different network than app
**Fix**: Switch wallet network or app config

### 5. Monitor Timeout
**Error**: `"Payment not detected yet. Please check your transaction and try again."`
**Cause**: Transaction taking longer than expected
**Fix**: Click "Retry" or check Hashscan for transaction

## Browser Console Debugging

### Successful Token Payment Logs
```
[HederaPaymentOption] Sending token payment request
[HederaWalletClient] sendTokenPayment called
[HederaWalletClient] Preparing token transaction
[HederaWalletClient] Token transaction built, size: X bytes
[HederaWalletClient] ✅ Token transaction submitted: txId
[Payment Monitor] Attempt 1/20 (window: 60min)
[Payment Monitor] Attempt 2/20 (window: 60min)
...
[Payment Monitor] Transaction found!
[Payment Monitor] Payment persisted successfully
```

### Token Association Error Logs
```
[HederaWalletClient] Token association error
[HederaPaymentOption] Token transaction failed: Your wallet is not associated...
```

### Rejection Logs
```
[HederaWalletClient] User rejected token transaction
[HederaPaymentOption] Token transaction rejected by user
```

## API Endpoint Testing

### Monitor Endpoint (Token Payment)
```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "uuid-here",
    "merchantAccountId": "0.0.123456",
    "network": "testnet",
    "tokenType": "USDC",
    "expectedAmount": 33.120480,
    "memo": "Provvypay:uuid-here",
    "timeWindowMinutes": 60
  }'
```

### Expected Responses

**Not Found (yet):**
```json
{
  "found": false,
  "duration": 234
}
```

**Found and Persisted:**
```json
{
  "found": true,
  "persisted": true,
  "transactionId": "0.0.123456@1234567890.123456789",
  "amount": 33120480,
  "sender": "0.0.654321",
  "timestamp": "2026-01-06T12:34:56.789Z",
  "paymentLink": {
    "id": "uuid-here",
    "status": "PAID"
  },
  "duration": 2345
}
```

**Found but Not Persisted:**
```json
{
  "found": true,
  "persisted": false,
  "transactionId": "0.0.123456@1234567890.123456789",
  "persistError": "Error message here",
  "duration": 2345
}
```

## Hashscan Verification

After approving transaction, verify on Hashscan:

### Testnet
```
https://hashscan.io/testnet/transaction/{transactionId}
```

### Mainnet
```
https://hashscan.io/mainnet/transaction/{transactionId}
```

**Check:**
- Transaction status: SUCCESS
- Token transfers show correct amounts
- Memo matches: `Provvypay:{paymentLinkId}`
- From/To accounts correct
- Timestamp within expected window

## Test Checklist

### Phase 2 Stablecoin Features
- [ ] USDC payment works end-to-end
- [ ] USDT payment works end-to-end
- [ ] AUDD payment works end-to-end
- [ ] All token transactions pre-filled (recipient, amount, memo)
- [ ] User only approves/rejects (no manual entry)
- [ ] Token association error handled gracefully
- [ ] Insufficient balance error handled gracefully
- [ ] Transaction rejection handled gracefully
- [ ] Monitor endpoint detects token transactions
- [ ] Correct token IDs used for network (testnet/mainnet)
- [ ] Decimal precision correct (6 decimals for stablecoins)
- [ ] Memo format correct: `Provvypay:{paymentLinkId}`
- [ ] Database records correct currency_received
- [ ] Ledger entries created correctly
- [ ] No floating-point precision issues
- [ ] Error messages are user-friendly
- [ ] Retry works after errors
- [ ] Concurrent payments work
- [ ] Large amounts handled correctly
- [ ] Time window appropriate (60min for tokens)

### Backward Compatibility
- [ ] HBAR payments still work (Phase 1)
- [ ] Existing manual flow not broken
- [ ] No regressions in other payment methods

### Code Quality
- [ ] TypeScript builds without errors
- [ ] No linter warnings
- [ ] Console logs helpful but not noisy
- [ ] Error handling comprehensive
- [ ] Code follows Phase 1 patterns

## Common Issues & Solutions

### Issue: "Token not found" in HashPack
**Solution**: Verify token ID is correct for network. Check TOKEN_IDS in constants.ts.

### Issue: Transaction sent but not detected
**Solution**: 
1. Check Hashscan for transaction status
2. Verify memo matches exactly
3. Wait 1-2 minutes (Mirror Node delay)
4. Check network setting (testnet vs mainnet)

### Issue: Amount mismatch
**Solution**:
1. Verify decimals (6 for stablecoins)
2. Check toSmallestUnit() conversion
3. Backend has 0.1% tolerance for stablecoins

### Issue: HashPack doesn't show token
**Solution**: Associate token in HashPack first.

### Issue: Slow detection (>60 seconds)
**Solution**: Token transfers may take longer. Monitor endpoint uses 60-minute window. Be patient or check Hashscan.

## Success Criteria

Phase 2 is successful if:
1. ✅ Users can pay with USDC, USDT, AUDD using approve/reject flow
2. ✅ All transaction details pre-filled in HashPack
3. ✅ No manual entry required
4. ✅ Token association errors handled gracefully
5. ✅ Payments detected and confirmed automatically
6. ✅ Correct token IDs used per network
7. ✅ Decimal precision perfect (no off-by-one errors)
8. ✅ Database stores correct currency and amounts
9. ✅ Error messages clear and actionable
10. ✅ Phase 1 (HBAR) still works
11. ✅ Code clean and maintainable
12. ✅ Logging helpful for debugging

## Next Steps After Testing

1. Test on mainnet with real tokens
2. Monitor production usage patterns
3. Gather user feedback
4. Optimize detection timing if needed
5. Consider Phase 3 enhancements:
   - Automatic token association (if possible)
   - Better balance checking before transaction
   - Transaction status real-time updates
   - Receipt generation


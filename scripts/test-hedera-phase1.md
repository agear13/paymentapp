# Quick Test Script - Hedera Phase 1

## Quick Manual Test

### 1. Start Development Server
```bash
cd src
npm run dev
```

### 2. Create Test Payment Link
Via merchant dashboard or API:
```bash
POST http://localhost:3000/api/payment-links
Authorization: Bearer {your-token}

{
  "amount": "50.00",
  "currency": "AUD",
  "description": "Test HBAR Phase 1",
  "availablePaymentMethods": {
    "hedera": true,
    "stripe": false
  }
}
```

### 3. Open Payment Page
```
http://localhost:3000/pay/{shortCode}
```

### 4. Test Flow
1. ✅ Page loads without errors
2. ✅ Click "Cryptocurrency"
3. ✅ "Loading wallet..." appears briefly
4. ✅ "Connect Wallet" button appears
5. ✅ Click "Connect Wallet"
6. ✅ QR code modal appears
7. ✅ Scan QR in HashPack mobile app or use pairing string in extension
8. ✅ "Wallet Connected" appears with account ID
9. ✅ Click "Pay now"
10. ✅ Token selection appears (HBAR, USDC, USDT, AUDD)
11. ✅ Select HBAR
12. ✅ Button shows "Pay with HBAR"
13. ✅ Click "Pay with HBAR"
14. ✅ HashPack opens with pre-filled transaction:
    - To: Merchant's account (e.g., 0.0.123456)
    - Amount: Correct HBAR (e.g., 15.04661831)
    - Memo: Provvypay:{uuid}
15. ✅ Click Approve in HashPack
16. ✅ UI shows "Monitoring for payment..."
17. ✅ After ~5-30 seconds, success page appears
18. ✅ Payment status is PAID

### 5. Test Rejection
Repeat steps 1-14, then:
1. ✅ Click Reject in HashPack
2. ✅ UI shows "Transaction Rejected"
3. ✅ "Try Again" button appears
4. ✅ Can restart flow

## Browser Console Checks

### Expected Logs (Success)
```
[HederaPaymentOption] Pre-initializing HashConnect...
[HashConnect] Initializing singleton instance...
[HashConnect] ✅ Singleton initialized successfully
[HederaPaymentOption] Merchant account ID set: 0.0.123456
[HederaPaymentOption] Sending HBAR payment request: {...}
[HederaWalletClient] sendHbarPayment called: {...}
[HederaWalletClient] Preparing transaction: {...}
[HederaWalletClient] Transaction built, size: N bytes
[HederaWalletClient] Sending transaction request to HashPack...
[HederaWalletClient] ✅ Transaction submitted: 0.0.123456@1234567890.123456789
[Payment Monitor] Attempt 1/20
[Payment Monitor] Transaction found! {...}
[Payment Monitor] Payment persisted successfully
```

### Expected Logs (Rejection)
```
[HederaWalletClient] sendHbarPayment called: {...}
[HederaWalletClient] Preparing transaction: {...}
[HederaWalletClient] User rejected transaction
[HederaPaymentOption] Transaction rejected by user
```

## API Endpoint Test

### Monitor Endpoint
```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "your-uuid",
    "merchantAccountId": "0.0.123456",
    "network": "testnet",
    "tokenType": "HBAR",
    "expectedAmount": 15.04661831,
    "memo": "Provvypay:your-uuid",
    "timeWindowMinutes": 15
  }'
```

### Expected Response (Not Found)
```json
{
  "found": false,
  "duration": 234
}
```

### Expected Response (Found)
```json
{
  "found": true,
  "persisted": true,
  "transactionId": "0.0.123456@1234567890.123456789",
  "amount": 1504661831,
  "sender": "0.0.654321",
  "timestamp": "2026-01-06T12:34:56.789Z",
  "paymentLink": {
    "id": "your-uuid",
    "status": "PAID"
  },
  "duration": 2345
}
```

## Database Verification

After successful payment:
```sql
-- Check payment link status
SELECT id, status, short_code, amount, currency 
FROM payment_links 
WHERE id = 'your-uuid';
-- Expected: status = 'PAID'

-- Check payment events
SELECT id, event_type, payment_provider, amount, raw_metadata 
FROM payment_events 
WHERE payment_link_id = 'your-uuid' 
ORDER BY created_at DESC 
LIMIT 1;
-- Expected: event_type = 'PAYMENT_RECEIVED', payment_provider = 'HEDERA'

-- Check ledger entries
SELECT id, account_name, debit_amount, credit_amount, currency, description 
FROM ledger_entries 
WHERE payment_link_id = 'your-uuid' 
ORDER BY created_at;
-- Expected: Multiple entries for double-entry bookkeeping

-- Check transaction memo
SELECT raw_metadata->>'memo' as memo
FROM payment_events 
WHERE payment_link_id = 'your-uuid';
-- Expected: "Provvypay:your-uuid"
```

## Common Issues

### HashPack doesn't open
- Check browser allows popups
- Try HashPack extension vs mobile app
- Check console for errors

### Transaction not detected
- Wait 30-60 seconds (Mirror Node delay)
- Check network setting (testnet vs mainnet)
- Verify merchant account ID is correct
- Check memo format matches exactly

### Wallet won't connect
- Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` env var
- Try refreshing page
- Clear browser cache
- Check HashConnect initialization logs

### Amount mismatch
- Backend has tolerance (0.5% for HBAR)
- Check conversion: 1 HBAR = 100,000,000 tinybars
- Verify expected amount calculation

## Test Checklist

- [ ] HBAR payment with approval works end-to-end
- [ ] Transaction has correct recipient
- [ ] Transaction has correct amount
- [ ] Transaction has correct memo format
- [ ] Monitor endpoint detects transaction
- [ ] Payment status updates to PAID
- [ ] Database entries created correctly
- [ ] User rejection handled gracefully
- [ ] Retry works after rejection
- [ ] Stablecoins still use manual flow (not affected)
- [ ] Error states show helpful messages
- [ ] Console logs are informative but not noisy

## Performance Targets

- Wallet initialization: < 2 seconds
- Transaction building: < 500ms
- HashPack opening: < 1 second
- Transaction detection: 5-30 seconds (depends on Mirror Node)
- Total flow (approval to confirmation): < 60 seconds

## Success Criteria

✅ Phase 1 is successful if:
1. User can pay with HBAR using approve/reject flow
2. All transaction details are pre-filled
3. No manual entry required
4. Payment is detected and confirmed automatically
5. Error handling is clear and helpful
6. Stablecoin flow is not broken
7. Code is clean and maintainable
8. Logging is helpful for debugging


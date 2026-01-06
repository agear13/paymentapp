# Hedera Payment UX - Phase 1 Implementation

## Overview
Phase 1 of the Hedera payment UX improvement has been successfully implemented. This enables customers to pay with HBAR using a streamlined approve/reject flow instead of manually entering payment details.

## What Was Implemented

### 1. **Pre-filled Transaction Request for HBAR**
After a user pairs their HashPack wallet via HashConnect, the app now:
- Automatically builds a Hedera `TransferTransaction` with pre-filled recipient, amount, and memo
- Sends the transaction request to HashPack for user approval
- User only needs to **Approve** or **Reject** - no manual entry required

### 2. **New Utility Modules**

#### `src/lib/hedera/amount-utils.ts`
Safe conversion utilities for HBAR amounts:
- `hbarToTinybars(hbarAmount)` - Converts HBAR to tinybars (8 decimals)
- `tinybarsToHbar(tinybars)` - Converts tinybars back to HBAR
- `formatHbar(amount, decimals)` - Formats HBAR for display
- `isValidHbarAmount(amount)` - Validates HBAR amounts
- Uses string manipulation to avoid floating-point precision issues

#### `src/lib/hedera/wallet-client.ts`
Client-side wallet interaction layer:
- `connectWallet()` - Opens HashPack pairing modal
- `sendHbarPayment({ merchantAccountId, amountHbar, memo })` - Sends pre-filled HBAR transaction
- `getWalletConnectionStatus()` - Returns current wallet state
- Uses Hedera SDK (@hashgraph/sdk) to build proper transactions
- Handles user rejection gracefully

### 3. **Updated Payment Flow**

#### Enhanced State Machine
New payment states added to `hedera-payment-option.tsx`:
- `requesting_signature` - Preparing transaction
- `awaiting_approval` - Waiting for user to approve in HashPack
- `rejected` - User rejected the transaction
- Existing states: `select_token`, `monitoring`, `complete`

#### Payment Flow Logic
1. **Token Selection**: User connects wallet and selects HBAR
2. **Click "Pay with HBAR"**: Triggers pre-filled transaction flow
3. **Transaction Building**: 
   - Builds `TransferTransaction` with:
     - Sender: user's connected account
     - Receiver: merchant's Hedera account
     - Amount: expected HBAR (converted to tinybars)
     - Memo: `Provvypay:{paymentLinkId}`
4. **HashPack Approval**: User approves/rejects in their wallet
5. **Monitoring**: After approval, calls `/api/hedera/transactions/monitor` with:
   - `paymentLinkId`
   - `merchantAccountId`
   - `network` (from `CURRENT_NETWORK` constant)
   - `tokenType: "HBAR"`
   - `expectedAmount`
   - `memo: "Provvypay:{paymentLinkId}"`
   - `timeWindowMinutes: 15`
6. **Confirmation**: Backend monitors for matching transaction and updates payment status

### 4. **Deterministic Memo Format**
All HBAR transactions now use consistent memo:
```
Provvypay:{paymentLinkId}
```
This memo is:
- Set in the transaction sent to HashPack
- Passed to the monitor endpoint for matching
- Used by backend to identify and validate payments

### 5. **Network Configuration**
Respects `NEXT_PUBLIC_HEDERA_NETWORK` environment variable:
- Uses `CURRENT_NETWORK` constant from `src/lib/hedera/constants.ts`
- Defaults to `testnet` if not set
- Supports both `testnet` and `mainnet`

## Technical Details

### Dependencies Added
- `@hashgraph/sdk` - Required for building proper Hedera transactions

### Key Implementation Points

1. **Amount Precision**
   - HBAR has 8 decimals (1 HBAR = 100,000,000 tinybars)
   - Conversion uses string manipulation to avoid floating-point errors
   - BigInt used for tinybar calculations

2. **Transaction Structure**
   ```typescript
   new TransferTransaction()
     .addHbarTransfer(userAccount, -amount)  // Debit user
     .addHbarTransfer(merchantAccount, +amount)  // Credit merchant
     .setTransactionMemo(memo)
     .freeze()
   ```

3. **HashConnect v3 API**
   - Uses `sendTransaction(topic, { byteArray, metadata })`
   - Transaction frozen and converted to bytes before sending
   - Proper error handling for user rejection

4. **Error Handling**
   - User rejection detected via error message patterns
   - Clear UI feedback for different states
   - Retry available after rejection
   - Graceful fallbacks for API variations

## User Experience

### Before (Manual Flow)
1. Connect wallet
2. Select HBAR
3. View payment instructions
4. Manually open HashPack
5. Manually enter merchant account
6. Manually enter amount
7. Manually enter memo
8. Click "I've sent the payment"
9. Wait for confirmation

### After (Phase 1 - Pre-filled)
1. Connect wallet
2. Select HBAR
3. Click "Pay with HBAR"
4. **Approve in HashPack** (all details pre-filled)
5. Automatic confirmation

**Time saved**: ~60-90 seconds per payment  
**Error reduction**: No manual entry errors

## Stablecoin Support (Phase 2 - Not Implemented)

Phase 1 is **HBAR only**. Stablecoin tokens (USDC, USDT, AUDD) still use the manual payment instruction flow. 

Phase 2 will extend this UX to stablecoins using token transfer transactions.

## Testing Guide

### Prerequisites
1. HashPack wallet installed and set up
2. Testnet HBAR in wallet (get from https://portal.hedera.com/faucet)
3. Merchant configured with Hedera account in Provvypay

### Test Steps

#### 1. Create Payment Link
```bash
# Via merchant dashboard or API
POST /api/payment-links
{
  "amount": "50.00",
  "currency": "AUD",
  "description": "Test HBAR Payment",
  "availablePaymentMethods": {
    "hedera": true
  }
}
```

#### 2. Open Payment Page
```
https://your-domain/pay/{shortCode}
```

#### 3. Test HBAR Payment Flow
1. Click "Cryptocurrency" payment option
2. Verify wallet initialization completes
3. Click "Connect Wallet"
4. Scan QR code in HashPack or use pairing string
5. Verify wallet connection shows your account ID
6. Click "Pay now" button
7. Verify HBAR is available in token list
8. Select HBAR
9. Click "Pay with HBAR" button
10. **Verify HashPack opens with pre-filled transaction:**
    - Recipient: Merchant's Hedera account
    - Amount: Correct HBAR amount (e.g., 15.04661831 HBAR)
    - Memo: `Provvypay:{paymentLinkId}`
11. Click **Approve** in HashPack
12. Verify UI shows "Monitoring for payment..."
13. Wait for transaction to be detected (~5-30 seconds)
14. Verify redirect to success page
15. Verify payment status is PAID
16. Verify payment_events and ledger_entries created in database

#### 4. Test Rejection Flow
1. Repeat steps 1-10
2. Click **Reject** in HashPack
3. Verify UI shows "Transaction Rejected"
4. Verify "Try Again" button appears
5. Click "Try Again"
6. Verify flow can be restarted

#### 5. Test Error Handling
Test scenarios:
- Wallet disconnection during transaction
- Network timeout
- Insufficient HBAR balance
- Invalid merchant account

#### 6. Verify Backend Integration
Check database after successful payment:
```sql
-- Payment link should be PAID
SELECT * FROM payment_links WHERE id = '{paymentLinkId}';

-- Payment event should exist
SELECT * FROM payment_events 
WHERE payment_link_id = '{paymentLinkId}' 
ORDER BY created_at DESC LIMIT 1;

-- Ledger entries should exist
SELECT * FROM ledger_entries 
WHERE payment_link_id = '{paymentLinkId}' 
ORDER BY created_at DESC;

-- Transaction memo should match
SELECT * FROM payment_events 
WHERE payment_link_id = '{paymentLinkId}' 
AND raw_metadata::text LIKE '%Provvypay:{paymentLinkId}%';
```

#### 7. Test Monitor Endpoint
Can be tested independently:
```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "uuid-here",
    "merchantAccountId": "0.0.123456",
    "network": "testnet",
    "tokenType": "HBAR",
    "expectedAmount": 15.04661831,
    "memo": "Provvypay:uuid-here",
    "timeWindowMinutes": 15
  }'
```

Expected responses:
- `{ "found": false }` - No matching transaction yet
- `{ "found": true, "persisted": true }` - Transaction found and payment marked PAID
- `{ "found": true, "persisted": false, "persistError": "..." }` - Transaction found but persistence failed

## Configuration

### Environment Variables
```bash
# Required
NEXT_PUBLIC_HEDERA_NETWORK=testnet  # or mainnet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Optional (defaults in code)
NEXT_PUBLIC_APP_NAME=Provvypay
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_ICON=https://your-domain.com/icon.png
```

### Merchant Setup
Merchants must have:
1. Hedera account ID (e.g., `0.0.123456`)
2. Account configured in merchant settings
3. Hedera payment method enabled for payment links

## Monitoring and Logging

### Client-Side Logs
```javascript
// Transaction preparation
[HederaWalletClient] sendHbarPayment called: { merchantAccountId, amountHbar, memo }
[HederaWalletClient] Preparing transaction: { from, to, amount, memo, network }
[HederaWalletClient] Transaction built, size: N bytes
[HederaWalletClient] Sending transaction request to HashPack...

// User approval
[HederaWalletClient] ✅ Transaction submitted: transactionId

// User rejection
[HederaWalletClient] User rejected transaction

// Errors
[HederaWalletClient] ❌ Transaction failed: errorMessage
```

### Server-Side Logs
Monitor endpoint logs in `loggers.hedera`:
```
Transaction check requested: { paymentLinkId, merchantAccountId, tokenType, expectedAmount }
Transaction found and persisted: { paymentLinkId, transactionId, persisted, duration }
Transaction not found: { paymentLinkId, duration }
```

## Known Limitations

### Phase 1 Scope
- **HBAR only** - Stablecoins (USDC, USDT, AUDD) still use manual flow
- No automatic retry on network failures
- Monitor endpoint called once after approval (relies on status polling for updates)

### HashConnect Considerations
- Requires HashPack extension or mobile app
- QR code pairing flow works across devices
- Transaction must be approved within HashPack's timeout (~5 minutes)

### Browser Compatibility
- Requires modern browser with Web Crypto API
- HashConnect v3 uses WalletConnect v2 (WebSocket connections)
- Works in Chrome, Firefox, Safari, Edge

## Security Considerations

1. **Amount Validation**
   - Backend validates received amount against expected amount with tolerance
   - Tinybars conversion uses safe BigInt arithmetic
   - No floating-point precision issues

2. **Memo Matching**
   - Deterministic memo format prevents payment misattribution
   - Backend validates memo matches expected format
   - Prevents duplicate payment processing

3. **Network Isolation**
   - Testnet and mainnet strictly separated
   - Token IDs differ per network
   - Configuration enforced at constants level

4. **Client-Side Security**
   - No private keys in browser
   - HashConnect handles all signing
   - Transaction built client-side but signed in wallet

## Troubleshooting

### "HashConnect not initialized"
- Ensure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Check browser console for initialization errors
- Verify HashConnect singleton is working

### "Wallet not connected"
- User must complete pairing flow first
- Check HashPack extension is installed
- Verify pairing data exists

### "Transaction rejected by user"
- Normal flow - user declined in wallet
- Offer retry with "Try Again" button

### "Transaction ID not found in response"
- Transaction may still have succeeded
- Monitor endpoint will find it via Mirror Node
- Not critical for payment flow

### Payment not detected
- Check Mirror Node delay (~3-5 seconds)
- Verify memo matches exactly
- Check merchant account ID is correct
- Verify network setting (testnet vs mainnet)

## Future Enhancements (Phase 2+)

1. **Stablecoin Support**
   - Extend to USDC, USDT, AUDD
   - Token association checking
   - Token transfer transactions

2. **Better Transaction Status**
   - Real-time consensus status
   - Progress indicator during confirmation
   - Receipt number display

3. **Error Recovery**
   - Automatic retry on network failures
   - Transaction status polling
   - Better error messages

4. **Multi-recipient**
   - Split payments
   - Batch transactions

## Support

For issues or questions:
1. Check browser console logs
2. Check server logs in `/api/hedera/transactions/monitor`
3. Verify Hedera Mirror Node status
4. Test with Hedera testnet explorer: https://hashscan.io/testnet

## Changelog

### 2026-01-06 - Phase 1 Complete
- ✅ Created amount conversion utilities
- ✅ Created wallet client helper
- ✅ Integrated Hedera SDK for transaction building
- ✅ Updated payment flow state machine
- ✅ Implemented pre-filled HBAR transactions
- ✅ Added approve/reject handling
- ✅ Updated monitor endpoint integration
- ✅ Added comprehensive logging
- ✅ Created testing guide

### Next: Phase 2 - Stablecoin Support
- Token association detection
- Token transfer transactions
- Enhanced error handling
- Receipt generation


# Persist Error Logging Implementation

## Summary

Added detailed error logging and error message pass-through for Hedera payment persistence failures. The monitor endpoint now returns `persistError` field when DB persistence fails, allowing frontend to display the exact error.

## Changes Made

### 1. Updated `CheckTransactionResult` Interface
**File:** `src/lib/hedera/transaction-checker.ts`

Added `persistError` field to the result interface:
```typescript
export interface CheckTransactionResult {
  found: boolean;
  transactionId?: string;
  amount?: string;
  sender?: string;
  timestamp?: string;
  updated?: boolean;
  error?: string;
  persistError?: string;  // NEW: Prisma error message
}
```

### 2. Enhanced `updatePaymentLinkWithTransaction` Function
**File:** `src/lib/hedera/transaction-checker.ts`

**Changes:**
- Changed return type from `Promise<boolean>` to `Promise<{ success: boolean; error?: string }>`
- Added `network` parameter for logging context
- Wrapped Prisma transaction in dedicated try/catch block
- Added `console.error('[monitor] persist failed', {...}, err)` with all context:
  - `paymentLinkId`
  - `transactionId`
  - `sender`
  - `amount`
  - `token` (tokenType)
  - `network`
- Returns error message in result: `{ success: false, error: errorMessage }`
- Logs errors to both console and structured logger

**Error Handling:**
```typescript
try {
  await prisma.$transaction([
    // ... all Prisma operations
  ]);
  return { success: true };
} catch (err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error('[monitor] persist failed', {
    paymentLinkId,
    transactionId,
    sender,
    amount,
    token,
    network,
  }, err);
  return { success: false, error: errorMessage };
}
```

### 3. Updated `checkForTransaction` Function
**File:** `src/lib/hedera/transaction-checker.ts`

**Changes:**
- Changed variable name from `updated` to `persistResult`
- Passes `network` parameter to persistence function
- Extracts both `success` and `error` from persistence result
- Returns `persistError` in result object

**Before:**
```typescript
const updated = await updatePaymentLinkWithTransaction(
  paymentLinkId,
  match,
  tokenType
);
return { found: true, ..., updated };
```

**After:**
```typescript
const persistResult = await updatePaymentLinkWithTransaction(
  paymentLinkId,
  match,
  tokenType,
  network
);
return { 
  found: true, 
  ..., 
  updated: persistResult.success,
  persistError: persistResult.error,
};
```

### 4. Enhanced Monitor Endpoint Response
**File:** `src/app/api/hedera/transactions/monitor/route.ts`

**Changes:**
- Added `persistError` to response when transaction found
- Logs `persistError` in structured logs
- Only includes `persistError` field when it exists (conditional spread)

**Response Format:**
```json
{
  "found": true,
  "persisted": false,
  "transactionId": "0.0.123@1234567890.123",
  "amount": "100.5",
  "sender": "0.0.456",
  "timestamp": "2024-01-01T12:00:00Z",
  "paymentLink": {
    "id": "uuid",
    "status": "OPEN"
  },
  "duration": 1234,
  "persistError": "Foreign key constraint failed on the field: `ledger_account_id`"
}
```

## Console Output Example

When persistence fails, you'll see:
```
[monitor] persist failed {
  paymentLinkId: '550e8400-e29b-41d4-a716-446655440000',
  transactionId: '0.0.123456@1704123456.123456789',
  sender: '0.0.789012',
  amount: '100.5',
  token: 'USDC',
  network: 'testnet'
} PrismaClientKnownRequestError: 
Foreign key constraint failed on the field: `ledger_account_id`
    at ...stack trace...
```

## Testing

### Test Persistence Failure

1. **Simulate FK constraint failure:**
```sql
-- Delete ledger accounts to trigger FK error
DELETE FROM ledger_accounts WHERE organization_id = '<test-org-id>';
```

2. **Trigger payment:**
- Send Hedera payment
- Click "I sent the payment"
- Monitor endpoint will detect transaction but fail to persist

3. **Check response:**
```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "<uuid>",
    "merchantAccountId": "0.0.123",
    "network": "testnet",
    "tokenType": "USDC",
    "expectedAmount": 100
  }'
```

Expected response:
```json
{
  "found": true,
  "persisted": false,
  "transactionId": "0.0.123@...",
  "amount": "100.5",
  "sender": "0.0.456",
  "persistError": "Foreign key constraint failed on the field: `ledger_account_id`",
  ...
}
```

4. **Check console logs:**
```
[monitor] persist failed { ... } Error: Foreign key constraint failed...
```

### Test Success Case

1. Normal payment flow should work as before
2. Response includes `persisted: true` and NO `persistError` field
3. Console has no error logs

## Frontend Integration

The frontend can now display the exact error to the user:

```typescript
if (result.found && !result.persisted) {
  if (result.persistError) {
    toast.error(`Payment detected but couldn't be saved: ${result.persistError}`);
  } else {
    toast.error('Payment detected but couldn't be saved. Please contact support.');
  }
}
```

## Error Categories

Common `persistError` values:

1. **Foreign Key Errors:**
   - `Foreign key constraint failed on the field: 'ledger_account_id'`
   - Solution: Ensure ledger accounts exist

2. **Unique Constraint:**
   - `Unique constraint failed on the constraint: 'ledger_entries_idempotency_key_key'`
   - Solution: Transaction already processed (shouldn't happen due to idempotency check)

3. **Not Found:**
   - `Payment link not found`
   - Solution: Payment link was deleted between detection and persistence

4. **Database Connection:**
   - `Can't reach database server`
   - Solution: Check database connection, increase timeout

## Benefits

✅ **Debuggable**: Exact Prisma error visible in production
✅ **User-Friendly**: Frontend can show specific error message
✅ **Non-Breaking**: Still returns 200 status, `found: true`, `persisted: false`
✅ **Contextual**: Logs include all transaction details for debugging
✅ **Structured**: Both console.error and structured logger capture errors

## No Breaking Changes

- Existing behavior unchanged when persistence succeeds
- Only adds new `persistError` field when persistence fails
- Still returns HTTP 200 (transaction was found, just not persisted)
- `persisted: false` behavior remains the same, just now with error details

## Production Monitoring

Monitor for log lines:
```
grep "\[monitor\] persist failed" production.log
```

This will show all persistence failures with full context for debugging.


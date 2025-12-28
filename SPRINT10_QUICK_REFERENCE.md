# Sprint 10: Double-Entry Ledger - Quick Reference

## Token-to-Account Mapping (CRITICAL!)

| Token | Account Code | Account Name |
|-------|--------------|--------------|
| HBAR  | 1051 | Crypto Clearing - HBAR |
| USDC  | 1052 | Crypto Clearing - USDC |
| USDT  | 1053 | Crypto Clearing - USDT |
| AUDD  | 1054 | Crypto Clearing - AUDD |

⚠️ **CRITICAL:** Each token MUST use its own clearing account!

## Chart of Accounts

| Code | Name | Type | Purpose |
|------|------|------|---------|
| 1200 | Accounts Receivable | ASSET | Invoice amounts owed |
| 1050 | Stripe Clearing | ASSET | Stripe payments |
| 1051 | Crypto Clearing - HBAR | ASSET | HBAR payments |
| 1052 | Crypto Clearing - USDC | ASSET | USDC payments |
| 1053 | Crypto Clearing - USDT | ASSET | USDT payments |
| 1054 | Crypto Clearing - AUDD | ASSET | AUDD payments |
| 6100 | Processor Fee Expense | EXPENSE | Payment fees |
| 4000 | Revenue | REVENUE | Sales revenue |

## Quick Start

### 1. Seed Ledger Accounts

```bash
tsx src/prisma/seeds/ledger-accounts.ts <organization_id>
```

### 2. Post Stripe Payment

```typescript
import { postStripeSettlement } from '@/lib/ledger/posting-rules/stripe';

await postStripeSettlement({
  paymentLinkId: 'link-id',
  organizationId: 'org-id',
  stripePaymentIntentId: 'pi_123',
  grossAmount: '100.00',
  feeAmount: '2.90',
  currency: 'USD',
});
```

### 3. Post Hedera Payment

```typescript
import { postHederaSettlement } from '@/lib/ledger/posting-rules/hedera';

// Automatically uses correct account based on tokenType
await postHederaSettlement({
  paymentLinkId: 'link-id',
  organizationId: 'org-id',
  tokenType: 'AUDD', // Uses account 1054
  cryptoAmount: '100.000000',
  invoiceAmount: '100.00',
  invoiceCurrency: 'AUD',
  fxRate: 1.0,
  transactionId: '0.0.123@1234567.890',
});
```

### 4. Validate Balance

```typescript
import { validatePostingBalance } from '@/lib/ledger/balance-validation';

await validatePostingBalance(paymentLinkId);
```

## Common Functions

### Account Mapping

```typescript
import { getCryptoClearing AccountCode } from '@/lib/ledger/account-mapping';

// Get account for token
const account = getCryptoClearing AccountCode('AUDD'); // Returns '1054'

// Validate mapping
validateTokenAccountMapping('AUDD', '1054'); // Passes
validateTokenAccountMapping('AUDD', '1051'); // Throws error
```

### Balance Checking

```typescript
import { 
  checkLedgerBalance,
  getLedgerIntegrityReport 
} from '@/lib/ledger/balance-validation';

// Check entire ledger
const balance = await checkLedgerBalance(orgId);
console.log('Balanced:', balance.isBalanced);

// Get full report
const report = await getLedgerIntegrityReport(orgId);
console.log('Healthy:', report.isHealthy);
```

### Hedera Payment Confirmation

```typescript
import { confirmHederaPayment } from '@/lib/hedera/payment-confirmation';

await confirmHederaPayment({
  paymentLinkId: 'link-id',
  transactionId: '0.0.123@1234567.890',
  tokenType: 'AUDD',
  amountReceived: '100.000000',
  sender: '0.0.456',
});
```

## Journal Entry Patterns

### Stripe Payment

```
Entry 1 - Payment:
  DR Stripe Clearing (1050)      100.00
  CR Accounts Receivable (1200)  100.00

Entry 2 - Fee:
  DR Processor Fee Expense (6100)  2.90
  CR Stripe Clearing (1050)        2.90
```

### Hedera Payment (AUDD Example)

```
DR Crypto Clearing - AUDD (1054)  100.00
CR Accounts Receivable (1200)     100.00
```

## API Endpoints

### Ledger Accounts

```bash
# List accounts
GET /api/ledger/accounts?organizationId=<id>

# Create account
POST /api/ledger/accounts
{
  "organizationId": "org-id",
  "code": "1055",
  "name": "Custom Account",
  "accountType": "ASSET"
}

# Get single account
GET /api/ledger/accounts/:accountId

# Update account
PUT /api/ledger/accounts/:accountId
{
  "name": "Updated Name"
}

# Delete account (if no entries)
DELETE /api/ledger/accounts/:accountId
```

## Validation Rules

1. **DR must equal CR** (0.01 tolerance for rounding)
2. **Each token uses its own account** (enforced)
3. **Idempotency keys prevent duplicates**
4. **All accounts must exist before posting**
5. **Transactions are atomic** (all or nothing)

## Token Examples

### HBAR Payment
```typescript
tokenType: 'HBAR' → Account 1051
```

### USDC Payment
```typescript
tokenType: 'USDC' → Account 1052
```

### USDT Payment
```typescript
tokenType: 'USDT' → Account 1053
```

### AUDD Payment (Currency-Matched)
```typescript
tokenType: 'AUDD' → Account 1054
// Special case: AUDD/AUD = 1:1 (no FX risk)
```

## Error Handling

### Imbalanced Entries
```typescript
// Throws error if DR ≠ CR
await validatePostingBalance(paymentLinkId);
```

### Wrong Token Account
```typescript
// Throws error before posting
validateTokenAccountMapping('AUDD', '1051');
// Error: Invalid clearing account for AUDD. Expected 1054, got 1051
```

### Missing Accounts
```typescript
// Verify accounts exist
import { verifyLedgerAccounts } from '@/prisma/seeds/ledger-accounts';

const check = await verifyLedgerAccounts(orgId);
if (!check.isComplete) {
  console.log('Missing:', check.missing);
}
```

## Troubleshooting

### Find Unbalanced Links
```typescript
import { findUnbalancedPaymentLinks } from '@/lib/ledger/balance-validation';

const unbalanced = await findUnbalancedPaymentLinks(orgId);
console.log('Unbalanced payment links:', unbalanced);
```

### Check Specific Link
```typescript
import { checkPaymentLinkBalance } from '@/lib/ledger/balance-validation';

const balance = await checkPaymentLinkBalance(linkId);
if (!balance.isBalanced) {
  console.log('Variance:', balance.variance);
  console.log('Debits:', balance.totalDebits);
  console.log('Credits:', balance.totalCredits);
}
```

### Retry Ledger Posting
```typescript
import { retryLedgerPosting } from '@/lib/hedera/payment-confirmation';

await retryLedgerPosting(paymentLinkId);
```

## Testing

```bash
# Run ledger tests
npm test src/lib/ledger/__tests__/token-posting.test.ts

# Key tests:
# - Token mapping for all 4 tokens
# - Validation of correct accounts
# - AUDD specifically tested (not using HBAR account)
# - Cross-token validation
```

## File Locations

| Function | File |
|----------|------|
| Token Mapping | `src/lib/ledger/account-mapping.ts` |
| Ledger Service | `src/lib/ledger/ledger-entry-service.ts` |
| Stripe Rules | `src/lib/ledger/posting-rules/stripe.ts` |
| Hedera Rules | `src/lib/ledger/posting-rules/hedera.ts` |
| Balance Validation | `src/lib/ledger/balance-validation.ts` |
| Payment Confirmation | `src/lib/hedera/payment-confirmation.ts` |
| Account Seeding | `src/prisma/seeds/ledger-accounts.ts` |
| Tests | `src/lib/ledger/__tests__/token-posting.test.ts` |

## Integration Checklist

- [x] Stripe webhook integrated (automatic)
- [x] Hedera payment confirmation function created
- [ ] Call `confirmHederaPayment()` from transaction monitor
- [ ] Seed accounts for each organization
- [ ] Test balance validation
- [ ] Monitor for imbalances

## Best Practices

1. **Always validate balance after posting**
   ```typescript
   await postHederaSettlement(params);
   await validatePostingBalance(paymentLinkId);
   ```

2. **Use idempotency keys**
   ```typescript
   idempotencyKey: `hedera-settlement-${transactionId}`
   ```

3. **Check accounts exist before operations**
   ```typescript
   await verifyLedgerAccounts(organizationId);
   ```

4. **Log all ledger operations**
   ```typescript
   loggers.ledger.info({ paymentLinkId }, 'Posted to ledger');
   ```

5. **Handle errors gracefully**
   ```typescript
   try {
     await postToLedger();
   } catch (error) {
     loggers.ledger.error({ error }, 'Posting failed');
     // Payment still confirmed, can retry later
   }
   ```

## Resources

- Full Documentation: `SPRINT10_COMPLETE.md`
- Token Tests: `src/lib/ledger/__tests__/token-posting.test.ts`
- Example Integration: `src/app/api/stripe/webhook/route.ts`

---

**Quick Reference | Sprint 10 Complete** 🎉








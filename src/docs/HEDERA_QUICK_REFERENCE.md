# Hedera Integration - Quick Reference

**Quick guide for developers working with Hedera multi-token payments**

---

## 🚀 Quick Start

### Import Services

```typescript
// Token service
import {
  getAccountBalances,
  checkTokenAssociations,
  formatTokenAmount,
} from '@/lib/hedera/token-service';

// Transaction monitoring
import {
  monitorForPayment,
  queryTransactions,
} from '@/lib/hedera/transaction-monitor';

// Payment validation
import {
  validatePaymentAmount,
  validateTokenType,
} from '@/lib/hedera/payment-validator';

// Wallet service (client-side only)
import {
  initializeHashConnect,
  connectWallet,
  getWalletState,
} from '@/lib/hedera/wallet-service';
```

---

## 📋 Common Operations

### 1. Fetch Token Balances

```typescript
const balances = await getAccountBalances('0.0.12345');

console.log(`HBAR: ${balances.HBAR}`);    // "100.50000000"
console.log(`USDC: ${balances.USDC}`);    // "250.500000"
console.log(`USDT: ${balances.USDT}`);    // "0.000000"
```

### 2. Check Token Associations

```typescript
const associations = await checkTokenAssociations('0.0.12345');

associations.forEach((assoc) => {
  console.log(`${assoc.symbol}: ${assoc.isAssociated ? 'Yes' : 'No'}`);
  console.log(`  Balance: ${assoc.balance}`);
});
```

### 3. Calculate Payment Amounts

```typescript
// Via API endpoint
const response = await fetch('/api/hedera/payment-amounts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fiatAmount: 100,
    fiatCurrency: 'USD',
  }),
});

const { data } = await response.json();
data.paymentAmounts.forEach((amount) => {
  console.log(`${amount.tokenType}: ${amount.totalAmount}`);
  if (amount.isRecommended) {
    console.log(`  ⭐ Recommended: ${amount.recommendationReason}`);
  }
});
```

### 4. Monitor for Payment

```typescript
const result = await monitorForPayment(
  '0.0.12345',     // Merchant account
  'USDC',          // Token type
  100.01,          // Expected amount
  300000           // 5 minute timeout
);

if (result && result.isValid) {
  console.log('Payment received!');
  console.log(`Transaction ID: ${result.transactionId}`);
  console.log(`Amount: ${result.amount} ${result.tokenType}`);
} else {
  console.log('Payment not received or invalid');
}
```

### 5. Validate Payment Amount

```typescript
const validation = validatePaymentAmount(
  100.0,      // Required amount
  100.05,     // Received amount
  'USDC'      // Token type
);

if (validation.isValid) {
  console.log('✅ Payment valid');
} else if (validation.isUnderpayment) {
  console.log('❌ Underpayment detected');
  console.log(validation.message);
} else if (validation.isOverpayment) {
  console.log('⚠️ Overpayment - accepting but logging');
}
```

### 6. Initialize Wallet (Client-Side)

```typescript
// In useEffect or on mount
useEffect(() => {
  initializeHashConnect()
    .then(() => console.log('HashConnect ready'))
    .catch((error) => console.error('Init failed:', error));
}, []);

// Connect wallet
const handleConnect = async () => {
  try {
    await connectWallet();
    const state = getWalletState();
    console.log(`Connected: ${state.accountId}`);
  } catch (error) {
    console.error('Connection failed:', error);
  }
};
```

---

## 🎯 Token Constants

### Supported Tokens

```typescript
import { TOKEN_CONFIG } from '@/lib/hedera/constants';

// HBAR
TOKEN_CONFIG.HBAR.symbol        // "HBAR"
TOKEN_CONFIG.HBAR.decimals      // 8
TOKEN_CONFIG.HBAR.isStablecoin  // false

// USDC
TOKEN_CONFIG.USDC.symbol        // "USDC"
TOKEN_CONFIG.USDC.decimals      // 6
TOKEN_CONFIG.USDC.isStablecoin  // true
TOKEN_CONFIG.USDC.id            // "0.0.456858"

// USDT
TOKEN_CONFIG.USDT.symbol        // "USDT"
TOKEN_CONFIG.USDT.decimals      // 6
TOKEN_CONFIG.USDT.isStablecoin  // true
TOKEN_CONFIG.USDT.id            // "0.0.456858"
```

### Payment Tolerances

```typescript
import { PAYMENT_TOLERANCES } from '@/lib/hedera/constants';

PAYMENT_TOLERANCES.HBAR   // 0.005 (0.5%)
PAYMENT_TOLERANCES.USDC   // 0.001 (0.1%)
PAYMENT_TOLERANCES.USDT   // 0.001 (0.1%)
```

### Estimated Fees

```typescript
import { ESTIMATED_FEES } from '@/lib/hedera/constants';

ESTIMATED_FEES.HBAR   // 0.001 HBAR (~$0.00003)
ESTIMATED_FEES.USDC   // 0.01 USDC
ESTIMATED_FEES.USDT   // 0.01 USDT
```

---

## 🌐 API Endpoints

### GET /api/hedera/balances/[accountId]

```bash
curl http://localhost:3000/api/hedera/balances/0.0.12345
```

### GET /api/hedera/token-associations/[accountId]

```bash
curl http://localhost:3000/api/hedera/token-associations/0.0.12345
```

### POST /api/hedera/payment-amounts

```bash
curl -X POST http://localhost:3000/api/hedera/payment-amounts \
  -H "Content-Type: application/json" \
  -d '{"fiatAmount":100,"fiatCurrency":"USD"}'
```

### POST /api/hedera/transactions/monitor

```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "accountId":"0.0.12345",
    "tokenType":"USDC",
    "expectedAmount":100.01,
    "timeoutMs":300000
  }'
```

### GET /api/hedera/transactions/[transactionId]

```bash
curl http://localhost:3000/api/hedera/transactions/0.0.12345@1234567890.123
```

---

## 💡 Common Patterns

### Pattern 1: Complete Payment Flow

```typescript
// 1. Calculate payment amounts
const amountsRes = await fetch('/api/hedera/payment-amounts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fiatAmount: 100, fiatCurrency: 'USD' }),
});
const { data } = await amountsRes.json();

// 2. User selects token
const selectedToken = 'USDC';
const amount = data.paymentAmounts.find(a => a.tokenType === selectedToken);

// 3. Display payment instructions
// (Use PaymentInstructions component)

// 4. Monitor for payment
const payment = await monitorForPayment(
  merchantAccountId,
  selectedToken,
  parseFloat(amount.totalAmount),
  300000
);

// 5. Validate payment
if (payment && payment.isValid) {
  // Update payment link status to PAID
  // Capture FX settlement snapshot
  // Post to ledger
}
```

### Pattern 2: Wallet Balance Check

```typescript
import { getAccountBalances, hasSufficientBalance } from '@/lib/hedera/token-service';

const balances = await getAccountBalances(accountId);
const hasEnough = hasSufficientBalance(balances, 'USDC', 100.01);

if (!hasEnough) {
  console.warn('Insufficient USDC balance');
}
```

### Pattern 3: Token Amount Conversion

```typescript
import {
  toSmallestUnit,
  fromSmallestUnit,
  formatTokenAmount,
} from '@/lib/hedera/token-service';

// Convert to smallest unit (for transactions)
const tinybars = toSmallestUnit(100.5, 'HBAR');
// Returns: 10050000000n (bigint)

// Convert from smallest unit
const hbar = fromSmallestUnit(10050000000n, 'HBAR');
// Returns: 100.5

// Format for display
const formatted = formatTokenAmount(100.123456789, 'HBAR');
// Returns: "100.12345679" (8 decimals)
```

---

## 🔄 Transaction States

### Monitoring Flow

```
1. Start monitoring
   ↓
2. Poll Mirror Node (every 5s)
   ↓
3. Found transaction?
   ├─ No → Continue polling (max 60 attempts)
   └─ Yes → Parse and validate
              ↓
4. Validation
   ├─ Valid → Return success
   ├─ Underpayment → Return invalid
   └─ Overpayment → Return success (with warning)
```

### Transaction Result

```typescript
interface TransactionResult {
  success: boolean;
  transactionId: string;
  tokenType: TokenType;
  amount: string;
  timestamp: string;
  sender: string;
  memo?: string;
  isValid: boolean;
  validationError?: string;
}
```

---

## ⚡ Performance Tips

1. **Cache Balances**: Don't fetch on every render
2. **Batch Calculations**: Calculate all three tokens at once
3. **Reuse Connections**: HashConnect initializes once
4. **Monitor Efficiently**: 5s polling is optimal
5. **Handle Timeouts**: Set reasonable timeout limits

---

## 🔍 Error Handling

### Common Errors

```typescript
// Invalid account ID
if (!accountId.match(/^0\.0\.\d+$/)) {
  throw new Error('Invalid account ID format');
}

// Mirror Node API error
if (!response.ok) {
  throw new Error(`Mirror Node error: ${response.status}`);
}

// Payment timeout
if (!transaction) {
  throw new Error('Payment timeout - no transaction found');
}

// Token mismatch
const tokenCheck = validateTokenType('USDC', receivedToken);
if (!tokenCheck.isValid) {
  throw new Error(tokenCheck.message);
}
```

---

## 📊 Type Definitions

```typescript
import type {
  TokenType,
  TokenBalances,
  TokenAssociation,
  TokenPaymentAmount,
  TransactionResult,
  PaymentValidation,
  WalletState,
} from '@/lib/hedera/types';
```

---

## 🆘 Troubleshooting

### Issue: HashConnect not connecting

**Solution:**
- Check browser console for errors
- Ensure HashPack extension installed
- Try clearing browser cache
- Check network configuration (testnet vs mainnet)

### Issue: Token balances showing zero

**Solution:**
- Verify account ID format
- Check token associations
- Ensure tokens exist on the network
- Verify Mirror Node is accessible

### Issue: Transaction not detected

**Solution:**
- Check merchant account ID is correct
- Verify token type matches payment
- Ensure sufficient amount sent
- Check transaction actually submitted
- Wait full 5 minutes before timing out

### Issue: Payment validation failing

**Solution:**
- Check tolerance thresholds
- Verify token type matches expected
- Ensure amount includes fee
- Review transaction details in Mirror Node

---

## 📚 Additional Resources

- [Full Documentation](./SPRINT8_HEDERA_WALLET.md)
- [FX Pricing Engine](./SPRINT7_FX_PRICING_ENGINE.md)
- [HashConnect Docs](https://docs.hashpack.app/hashconnect)
- [Hedera Mirror Node API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api)

---

**Need help?** Check the full documentation or review the code examples above.













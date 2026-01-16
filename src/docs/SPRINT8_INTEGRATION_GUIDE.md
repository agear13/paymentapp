# Sprint 8 Integration Guide

**How to integrate the Hedera Wallet system into your payment flow**

---

## 🎯 Overview

This guide shows how to integrate the new multi-token Hedera payment system into existing payment flows. The integration supports HBAR, USDC, and USDT with automatic token recommendation and real-time monitoring.

---

## 📋 Prerequisites

1. **Environment Variables** configured in `.env.local`
2. **Merchant Hedera Account** set up in `merchant_settings` table
3. **HashPack Extension** installed for testing
4. **Token IDs** verified for your network (testnet/mainnet)

---

## 🚀 Quick Integration

### Step 1: Import the Component

```typescript
import { HederaPaymentOption } from '@/components/public/hedera-payment-option';
```

### Step 2: Add to Payment Method Selector

```typescript
<HederaPaymentOption
  isAvailable={paymentLink.availablePaymentMethods.hedera}
  isSelected={selectedMethod === 'hedera'}
  isHovered={hoveredMethod === 'hedera'}
  onSelect={() => setSelectedMethod('hedera')}
  onHoverStart={() => setHoveredMethod('hedera')}
  onHoverEnd={() => setHoveredMethod(null)}
  paymentLinkId={paymentLink.id}
  amount={paymentLink.amount}
  currency={paymentLink.currency}
/>
```

### Step 3: That's it!

The component handles the entire flow internally:
- Wallet connection
- Token selection
- Payment instructions
- Transaction monitoring
- Payment validation

---

## 🔧 Advanced Integration

### Custom Token Recommendation Logic

```typescript
// In your API endpoint or service
import { getFxService } from '@/lib/fx';
import { getAccountBalances } from '@/lib/hedera/token-service';

async function calculateWithRecommendation(
  fiatAmount: number,
  fiatCurrency: string,
  userAccountId?: string
) {
  const fxService = getFxService();
  
  // Calculate amounts for all tokens
  const tokens = ['HBAR', 'USDC', 'USDT'];
  const amounts = await Promise.all(
    tokens.map(async (token) => {
      const calc = await fxService.calculateCryptoAmount(
        fiatAmount,
        fiatCurrency,
        token
      );
      return { token, amount: calc.targetAmount };
    })
  );
  
  // Get user balances if available
  let balances = null;
  if (userAccountId) {
    balances = await getAccountBalances(userAccountId);
  }
  
  // Custom recommendation logic
  const recommended = determineRecommended(amounts, balances);
  
  return { amounts, recommended };
}
```

### Manual Transaction Monitoring

```typescript
import { monitorForPayment } from '@/lib/hedera/transaction-monitor';
import { validatePaymentAmount } from '@/lib/hedera/payment-validator';

async function monitorPayment(
  merchantAccount: string,
  tokenType: 'HBAR' | 'USDC' | 'USDT',
  expectedAmount: number
) {
  // Start monitoring
  console.log('Monitoring started...');
  
  const result = await monitorForPayment(
    merchantAccount,
    tokenType,
    expectedAmount,
    300000 // 5 minutes
  );
  
  if (!result) {
    throw new Error('Payment timeout');
  }
  
  // Validate
  const validation = validatePaymentAmount(
    expectedAmount,
    parseFloat(result.amount),
    tokenType
  );
  
  if (!validation.isValid) {
    throw new Error(validation.message);
  }
  
  return {
    transactionId: result.transactionId,
    amount: result.amount,
    sender: result.sender,
  };
}
```

### Backend Payment Processing

```typescript
// In your payment confirmation endpoint
import { getFxService } from '@/lib/fx';
import { prisma } from '@/lib/prisma';

async function processHederaPayment(
  paymentLinkId: string,
  transactionId: string,
  tokenType: 'HBAR' | 'USDC' | 'USDT',
  amount: number
) {
  // 1. Capture settlement FX snapshot
  const fxService = getFxService();
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id: paymentLinkId },
  });
  
  const snapshot = await fxService.captureSettlementSnapshot(
    paymentLinkId,
    tokenType,
    paymentLink.currency,
    tokenType
  );
  
  // 2. Update payment link status
  await prisma.paymentLink.update({
    where: { id: paymentLinkId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });
  
  // 3. Create audit event
  await prisma.paymentLinkEvent.create({
    data: {
      paymentLinkId,
      eventType: 'PAYMENT_CONFIRMED',
      metadata: {
        transactionId,
        tokenType,
        amount,
        fxRate: snapshot.rate.toString(),
        provider: snapshot.provider,
      },
    },
  });
  
  // 4. Post to ledger (Sprint 10)
  // await createLedgerEntries(...);
  
  return { success: true };
}
```

---

## 🎨 UI Customization

### Customize Wallet Button

```typescript
// Create a custom wrapper
import { WalletConnectButton } from '@/components/public/wallet-connect-button';

export function CustomWalletButton() {
  return (
    <div className="custom-container">
      <h2>Connect Your Crypto Wallet</h2>
      <WalletConnectButton />
      <p className="custom-help-text">
        We support HBAR, USDC, and USDT payments
      </p>
    </div>
  );
}
```

### Customize Token Selector

```typescript
// Pass custom props or wrap in your UI
import { TokenCardSelector } from '@/components/public/token-card-selector';

// The new TokenCardSelector uses progressive disclosure
// It shows compact cards and details appear only for selected token
<TokenCardSelector
  paymentAmounts={amounts}
  selectedToken={token}
  onTokenSelect={handleSelect}
/>
```

### Custom Payment Instructions

```typescript
import { PaymentInstructions } from '@/components/public/payment-instructions';

// Add custom content
<div>
  <PaymentInstructions
    tokenType={selectedToken}
    amount={requiredAmount}
    totalAmount={totalWithFee}
    merchantAccountId={merchantAccount}
    paymentLinkId={paymentLinkId}
    memo={customMemo}
  />
  
  {/* Add custom help */}
  <div className="custom-help">
    <h4>Need Help?</h4>
    <p>Contact support: support@example.com</p>
  </div>
</div>
```

---

## 🔄 Webhook Integration

### Listen for Payment Events

```typescript
// In your webhook handler
export async function POST(request: Request) {
  const body = await request.json();
  
  if (body.eventType === 'HEDERA_PAYMENT_RECEIVED') {
    const {
      paymentLinkId,
      transactionId,
      tokenType,
      amount,
    } = body.data;
    
    // Process payment
    await processHederaPayment(
      paymentLinkId,
      transactionId,
      tokenType,
      amount
    );
    
    // Notify customer
    await sendPaymentConfirmationEmail(paymentLinkId);
    
    return Response.json({ success: true });
  }
  
  return Response.json({ success: false });
}
```

---

## 📊 Analytics Integration

### Track Token Usage

```typescript
// Track which tokens are used most
import { analytics } from '@/lib/analytics';

function trackTokenSelection(
  tokenType: string,
  amount: number,
  isRecommended: boolean
) {
  analytics.track('Token Selected', {
    token: tokenType,
    amount,
    isRecommended,
    timestamp: new Date(),
  });
}

function trackPaymentComplete(
  tokenType: string,
  transactionId: string,
  timeToComplete: number
) {
  analytics.track('Payment Completed', {
    token: tokenType,
    transactionId,
    duration: timeToComplete,
    method: 'hedera',
  });
}
```

---

## 🧪 Testing Integration

### Test Environment Setup

```typescript
// In your test setup
import { initializeHashConnect } from '@/lib/hedera/wallet-service';

beforeAll(async () => {
  // Set test environment
  process.env.NEXT_PUBLIC_HEDERA_NETWORK = 'testnet';
  
  // Initialize HashConnect
  await initializeHashConnect();
});
```

### Mock Services for Unit Tests

```typescript
// Mock token service
jest.mock('@/lib/hedera/token-service', () => ({
  getAccountBalances: jest.fn().mockResolvedValue({
    HBAR: '100.00000000',
    USDC: '250.000000',
    USDT: '50.000000',
  }),
  checkTokenAssociations: jest.fn().mockResolvedValue([
    { symbol: 'USDC', isAssociated: true, balance: '250.000000' },
    { symbol: 'USDT', isAssociated: true, balance: '50.000000' },
  ]),
}));

// Test component
test('displays token balances', async () => {
  const { getByText } = render(<WalletConnectButton />);
  
  await waitFor(() => {
    expect(getByText(/100.0000/)).toBeInTheDocument();
    expect(getByText(/250.00/)).toBeInTheDocument();
  });
});
```

---

## 🔒 Security Best Practices

### 1. Validate All Inputs

```typescript
// Always validate account IDs
function validateAccountId(accountId: string): boolean {
  return /^0\.0\.\d+$/.test(accountId);
}

// Validate amounts
function validateAmount(amount: number, tokenType: string): boolean {
  return amount > 0 && amount < MAX_AMOUNT[tokenType];
}
```

### 2. Use Token-Specific Tolerances

```typescript
import { PAYMENT_TOLERANCES } from '@/lib/hedera/constants';

// Never use fixed tolerance
const validation = validatePaymentAmount(
  required,
  received,
  tokenType // This determines the tolerance
);
```

### 3. Verify Transaction Source

```typescript
// Check transaction came from expected sender
function verifyTransactionSource(
  transaction: TransactionResult,
  expectedSender?: string
): boolean {
  if (!expectedSender) return true;
  return transaction.sender === expectedSender;
}
```

### 4. Log All Payment Attempts

```typescript
import { log } from '@/lib/logger';

// Log every payment attempt
log.info({
  paymentLinkId,
  tokenType,
  amount,
  transactionId,
  validationResult,
}, 'Payment attempt processed');
```

---

## 🚨 Error Handling

### Handle Common Errors

```typescript
try {
  const result = await monitorForPayment(...);
} catch (error) {
  if (error.code === 'TIMEOUT') {
    // Payment not received in time
    notify.error('Payment timeout. Please try again.');
  } else if (error.code === 'INVALID_AMOUNT') {
    // Wrong amount sent
    notify.error('Incorrect amount. Please send exact amount.');
  } else if (error.code === 'WRONG_TOKEN') {
    // Wrong token sent
    notify.error(`Please send ${expectedToken}, not ${receivedToken}`);
  } else {
    // Unknown error
    notify.error('Payment processing failed. Contact support.');
    log.error({ error }, 'Payment processing error');
  }
}
```

---

## 📚 Additional Resources

- **Full Documentation:** [SPRINT8_HEDERA_WALLET.md](./SPRINT8_HEDERA_WALLET.md)
- **Quick Reference:** [HEDERA_QUICK_REFERENCE.md](./HEDERA_QUICK_REFERENCE.md)
- **FX Integration:** [SPRINT7_FX_PRICING_ENGINE.md](./SPRINT7_FX_PRICING_ENGINE.md)

---

## 💡 Tips & Tricks

1. **Preload Balances** - Fetch balances while showing token comparison
2. **Cache Calculations** - Payment amounts don't change often
3. **Progressive Enhancement** - Show basic info first, load details async
4. **Optimize Polling** - Use exponential backoff after initial attempts
5. **Clear Errors** - Always show user-friendly error messages

---

**Questions?** Review the full documentation or check the code examples above!













# HashConnect - Quick Reference

## ✅ Correct Usage Pattern

### **DO:**

```typescript
// ✅ In a React component
'use client';

import { initializeHashConnect } from '@/lib/hedera/wallet-service.client';

function MyComponent() {
  useEffect(() => {
    initializeHashConnect()
      .then(() => console.log('Ready'))
      .catch((error) => console.error('Init failed:', error));
  }, []); // Empty deps - runs once
  
  return <div>...</div>;
}
```

```typescript
// ✅ Importing wallet functions
import {
  connectWallet,
  disconnectWallet,
  getWalletState,
  subscribeToWalletState,
} from '@/lib/hedera/wallet-service.client';
```

```typescript
// ✅ Dynamic import for payment components
const HederaPaymentOption = dynamic(
  () => import('@/components/public/hedera-payment-option'),
  { ssr: false }  // Critical!
);
```

---

### **DON'T:**

```typescript
// ❌ NEVER import hashconnect directly
import { HashConnect } from 'hashconnect'; // BAD!

// ❌ NEVER create new instances
const hc = new HashConnect(); // BAD!

// ❌ NEVER import from barrel export
import { connectWallet } from '@/lib/hedera'; // BAD!

// ❌ NEVER call init in render
function MyComponent() {
  initializeHashConnect(); // BAD! No useEffect
  return <div>...</div>;
}

// ❌ NEVER use without ssr: false
import HederaPaymentOption from '@/components/public/hedera-payment-option'; // BAD!
```

---

## 🔑 Key Files

| File | Purpose | Import From This? |
|------|---------|-------------------|
| `hashconnect.client.ts` | Singleton instance | ❌ Internal only |
| `wallet-service.client.ts` | Public API | ✅ YES - Use this |
| `wallet-connect-button.tsx` | UI component | ✅ YES (dynamic) |
| `hedera-payment-option.tsx` | Payment UI | ✅ YES (dynamic) |

---

## 🛡️ Singleton Guarantees

1. **One instance per browser session**
2. **Thread-safe initialization** (promise guard)
3. **No server-side execution** (window check)
4. **Graceful re-initialization handling** (already initialized check)
5. **Automatic error recovery** (promise reset on failure)

---

## 📊 Wallet State

```typescript
interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  balances: {
    HBAR: string;
    USDC: string;
    USDT: string;
    AUDD: string;  // ✅ Now included
  };
  network: string;  // 'testnet' or 'mainnet'
  isLoading: boolean;
  error: string | null;
}
```

---

## 🔍 Console Logs (Debug)

### **Normal Flow:**
```
✅ Starting HashConnect initialization
✅ HashConnect instance created
✅ Calling hashconnect.init()
✅ Calling hashconnect.connect()
✅ HashConnect initialized successfully (singleton pattern)
```

### **Re-initialization Attempt:**
```
✅ HashConnect already initialized - reusing singleton instance
```

### **Concurrent Init:**
```
✅ HashConnect initialization in progress - waiting for existing promise
```

### **Error:**
```
❌ Failed to initialize HashConnect
{ message: "...", stack: "...", windowExists: true, alreadyPaired: false }
```

---

## ⚙️ Environment Variables

```bash
# Required
NEXT_PUBLIC_HEDERA_NETWORK=testnet

# Optional (has defaults)
NEXT_PUBLIC_APP_NAME=Provvypay
NEXT_PUBLIC_APP_URL=https://app.provvypay.com
NEXT_PUBLIC_APP_ICON=https://provvypay.com/icon.png
```

---

## 🚀 Common Operations

### **Initialize (once per app):**
```typescript
await initializeHashConnect();
```

### **Connect Wallet:**
```typescript
const { accountId, network, balances } = await connectAndFetchBalances();
```

### **Disconnect Wallet:**
```typescript
await disconnectAndClear();
```

### **Get Current State:**
```typescript
const state = getWalletState();
console.log(state.accountId, state.balances);
```

### **Subscribe to Changes:**
```typescript
const unsubscribe = subscribeToWalletState((state) => {
  console.log('Wallet state changed:', state);
});

// Later: unsubscribe()
```

### **Refresh Balances:**
```typescript
await refreshWalletBalances();
```

---

## 🐛 Troubleshooting

### **Error: "Identifier has already been declared"**
**Cause:** Multiple HashConnect instances created  
**Fix:** ✅ Already fixed with singleton pattern

### **Error: "Failed to initialize HashConnect"**
**Cause:** init() called multiple times  
**Fix:** ✅ Already fixed with promise guard

### **Error: "window is not defined"**
**Cause:** Server-side execution  
**Fix:** ✅ Already fixed with window check + dynamic imports

### **Error: "Cannot read properties of null"**
**Cause:** Calling wallet functions before init  
**Fix:** Always await `initializeHashConnect()` first

---

## 📚 Full Documentation

See `HASHCONNECT_SINGLETON_FIX.md` for complete implementation details.

---

**Last Updated:** January 2, 2026  
**Status:** ✅ Production Ready


# Hedera CAIP Format Fix - Root Cause Found!

## 🎯 Root Cause Identified

After extensive debugging, we discovered the **exact** reason for the "Signer could not find session on sign client" error:

### The Account Format Mismatch

**What we were passing to `sendTransaction()`:**
```javascript
accountToSign: '0.0.5363033'  // Plain Hedera format
```

**What HashConnect's session actually stores:**
```javascript
namespaces: {
  hedera: {
    accounts: ['hedera:testnet:0.0.5363033']  // CAIP format!
  }
}
```

### The Internal Flow

1. We call `hc.sendTransaction(topic, { metadata: { accountToSign: '0.0.5363033' } })`
2. HashConnect internally calls `getSigner()` to get the WalletConnect signer for that account
3. `getSigner()` calls `SignClientHelper.getSessionForAccount(accountId, topic)`
4. `getSessionForAccount()` searches the session's namespace accounts for a match
5. **IT FAILS** because it's comparing:
   - Looking for: `'0.0.5363033'`
   - But session has: `['hedera:testnet:0.0.5363033']`

### Evidence from Debugging

Our logs showed:
```javascript
[HederaWalletClient] 🔍 Matching session found? true  // ✅ Session exists
[HederaWalletClient] ✅ Match details: {
  topic: 'ad72915c14f0fdd4...',
  pairingTopic: '19a2776c...',
  acknowledged: true,
  namespaces: {
    hedera: {
      accounts: ['hedera:testnet:0.0.5363033']  // <-- CAIP format
    }
  }
}

// But then:
[HederaWalletClient] Return value: Promise {<rejected>: Error: Signer could not find session on sign client
```

The session **existed** and was **acknowledged**, but HashConnect couldn't find it when we passed the account in plain format!

## The Solution

Convert the account ID to **CAIP format** (Chain Agnostic Improvement Proposal) before passing to `sendTransaction`:

### Changes Made in `src/lib/hedera/wallet-client.ts`

```typescript
// Before (WRONG):
const accountToSign = pairingData.accountIds[0];  // '0.0.5363033'
const transactionRequest = {
  byteArray: transactionBytes,
  metadata: {
    accountToSign: accountToSign,  // ❌ Plain format won't match!
    returnTransaction: false,
  },
};

// After (CORRECT):
const accountToSign = pairingData.accountIds[0];  // '0.0.5363033'
// Convert to CAIP format: "hedera:<network>:<accountId>"
const accountInCaipFormat = `hedera:${CURRENT_NETWORK}:${accountToSign}`;

const transactionRequest = {
  byteArray: transactionBytes,
  metadata: {
    accountToSign: accountInCaipFormat,  // ✅ CAIP format matches session!
    returnTransaction: false,
  },
};
```

### Why CAIP Format?

CAIP (Chain Agnostic Improvement Proposal) is a standardized format for representing blockchain accounts across different chains:

**Format:** `<namespace>:<reference>:<address>`

For Hedera:
- **Namespace:** `hedera`
- **Reference:** `testnet` or `mainnet` (the network)
- **Address:** `0.0.XXXXX` (the account ID)

**Examples:**
- Testnet: `hedera:testnet:0.0.5363033`
- Mainnet: `hedera:mainnet:0.0.12345`

WalletConnect v2 (which HashConnect v3 is built on) uses CAIP format for all account identifiers to support multi-chain wallets.

## Technical Details

### The Internal Call Chain

```
sendTransaction(topic, request)
  └─> getSigner(topic, accountId)  
       └─> SignClientHelper.getSessionForAccount(accountId, topic)
            └─> Searches session.namespaces[chain].accounts
                └─> Compares accountId with each account in array
                    └─> ❌ FAILS if accountId is not in CAIP format
```

### Why It Wasn't Obvious

1. **Session exists**: The session topic was correct and the session was properly established
2. **Session is acknowledged**: WalletConnect handshake completed successfully
3. **Session has the account**: The account was in the session, just in CAIP format
4. **No clear error message**: "Signer could not find session" suggests topic issue, not format issue

The error message was misleading - it said "could not find session", but really it meant "could not find a signer for that account in that session".

## Verification

To verify this fix works, check that:

1. When connecting wallet, the approval event captures the session topic
2. When calling `sendTransaction()`, the account is converted to CAIP format
3. The transaction approval prompt appears in HashPack wallet
4. The transaction can be signed and submitted successfully

## Related Files

- `src/lib/hedera/wallet-client.ts` - Main fix location
- `src/lib/hashconnectClient.ts` - Session management (already correct)
- `src/lib/hedera/config.ts` - Network configuration (`CURRENT_NETWORK`)

## CAIP Resources

- [CAIP-2: Blockchain ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
- [CAIP-10: Account ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-10.md)
- [WalletConnect v2 CAIP Usage](https://docs.walletconnect.com/2.0/specs/clients/sign/namespaces)

## Next Steps

1. Wait for Render deployment to complete
2. Test the payment flow end-to-end
3. Verify HashPack receives the approval prompt
4. Confirm transaction can be signed and submitted

This should be the **final fix** that makes the Hedera payments work correctly! 🎉


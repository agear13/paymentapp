# Hedera WalletConnect Transaction Flow - Final Solution

## Problem Summary

After extensive debugging, we discovered the issue is NOT with sending the transaction request to HashPack, but with receiving the signed transaction response.

### What Works ✅
- HashConnect initialization and pairing
- WalletConnect session establishment  
- Sending transaction request to HashPack
- User sees approval prompt and can approve

### What Fails ❌
- Receiving the signed transaction bytes back from HashPack
- Error: "No matching key. proposal: XXXXX"
- The WalletConnect proposal expires/gets deleted before response arrives

## Root Cause

WalletConnect v2 proposals are short-lived. When HashPack tries to respond with the signed transaction:
1. The proposal has already been cleaned up
2. WalletConnect can't match the response to our request
3. The promise never resolves

## The Solution

**DO NOT** rely on WalletConnect to return the signed transaction. Instead:

1. **Send request** → HashPack signs it
2. **HashPack submits** the signed transaction to Hedera directly
3. **We poll** the Hedera mirror node for the transaction
4. **Verify** the transaction on-chain

OR (better approach):

Use `hedera_signAndExecuteTransaction` instead of `hedera_signTransaction`. This method tells HashPack to:
- Sign the transaction
- Submit it to Hedera
- Return the transaction ID (not the signed bytes)

## Implementation

### Option 1: hedera_signAndExecuteTransaction (RECOMMENDED)

```typescript
const wcRequest = {
  topic: sessionTopic,
  chainId: `hedera:${CURRENT_NETWORK}`,
  request: {
    method: 'hedera_signAndExecuteTransaction',  // Changed from hedera_signTransaction
    params: {
      signerAccountId: `hedera:${CURRENT_NETWORK}:${accountToSign}`,
      transactionList: transactionBytes,  // Changed from transactionBytes
    },
  },
};

const result = await signClient.request(wcRequest);
// result should contain: { transactionId: "0.0.XXXXX@1234567890.123456789" }
```

### Option 2: Poll Mirror Node After Signing

```typescript
// 1. Request signing (don't wait for response)
signClient.request(wcRequest).catch(() => {
  // Ignore - proposal might expire
});

// 2. Poll mirror node for transactions from user's account
const transactions = await pollMirrorNode({
  accountId: userAccount,
  startTime: Date.now(),
  merchantAccount: merchantAccountId,
  expectedAmount: amount,
});

// 3. Verify transaction matches our payment
if (transactions.some(tx => 
  tx.amount === expectedAmount && 
  tx.receiver === merchantAccountId
)) {
  // Payment confirmed!
}
```

## Key Learnings

1. **CAIP Format Required**: Accounts must be `hedera:testnet:0.0.XXXXX` not `0.0.XXXXX`
2. **Session Topic vs Pairing Topic**: Always use session topic for signing
3. **WalletConnect Lifecycle**: Proposals expire quickly, don't rely on them
4. **HashPack Behavior**: When user approves, HashPack submits to Hedera automatically
5. **Verification Method**: Poll mirror node instead of waiting for WalletConnect response

## Next Steps

Implement Option 1 (hedera_signAndExecuteTransaction) as it's the cleanest solution that matches how HashPack is designed to work.


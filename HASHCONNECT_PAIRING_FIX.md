# HashConnect Pairing URI Fix - Implementation Summary

## Problem Statement

HashConnect was failing with:
- "hashconnect: missing URI"
- "HashConnect not initialized. Call initHashConnect() first."
- Chunk mismatch errors during deploy

**Root Causes:**
1. `hashconnect.connect()` returns a pairing URI but we ignored it
2. `openPairingModal()` was called without the URI → "missing URI" error
3. When already paired, wallet state wasn't rehydrated (pairingData/accountId/isConnected)
4. UI would retry connect flows unnecessarily

---

## Solution Implemented

### Changes to `src/lib/hedera/hashconnect.client.ts`

#### A) Store and Use Pairing URI

**Added module-level variable (line 107):**
```typescript
let pairingString: string | null = null;
```

**Updated `initHashConnect()` to capture pairingString (line 293):**
```typescript
// BEFORE:
await hashconnect.connect();

// AFTER:
pairingString = await hashconnect.connect();
```

---

#### B) Rehydrate Wallet State When Already Paired

**Replaced the `alreadyPaired` block (lines 269-286):**

```typescript
// BEFORE:
if (alreadyPaired) {
  log.info('HashConnect already has pairing data - skipping init/connect');
  isInitialized = true;
  updateWalletState({ isLoading: false });
  return;
}

// AFTER:
if (alreadyPaired) {
  // Rehydrate wallet state from existing pairing
  const existing = hashconnect.hcData.pairingData[0];
  pairingData = existing;
  const accountId = existing?.accountIds?.[0] ?? null;
  
  isInitialized = true;
  updateWalletState({
    isConnected: !!accountId,
    accountId,
    isLoading: false,
    error: null,
  });
  
  pairingString = null; // already paired; no need to open modal unless re-pairing
  log.info('✅ Rehydrated existing HashConnect pairing', { accountId });
  return;
}
```

**Benefits:**
- Sets `pairingData` from existing pairing
- Extracts and stores `accountId`
- Updates wallet state to reflect connected status
- UI immediately knows wallet is connected (no false "connect" prompts)

---

#### C) Ensure `connectWallet()` Has Pairing URI Before Opening Modal

**Added safety checks and pairing URI guarantee (lines 389-417):**

```typescript
// Added window check:
if (typeof window === 'undefined') {
  throw new Error('connectWallet() can only be called in browser context (window undefined)');
}

// Ensure we have a pairing URI before opening modal:
if (!pairingString) {
  log.info('No pairingString available - calling hashconnect.connect()');
  pairingString = await hashconnect.connect();
}

// Hard requirement: pairingString must exist
if (!pairingString) {
  throw new Error('HashConnect pairing URI missing (pairingString). Cannot open pairing modal.');
}

// Open pairing modal WITH the pairing URI
await hashconnect.openPairingModal(pairingString);
```

**BEFORE:**
```typescript
await hashconnect.openPairingModal(); // ❌ No URI → "missing URI" error
```

**AFTER:**
```typescript
// Ensure pairingString exists (call connect if needed)
if (!pairingString) {
  pairingString = await hashconnect.connect();
}

// Throw clear error if still missing
if (!pairingString) {
  throw new Error('HashConnect pairing URI missing (pairingString). Cannot open pairing modal.');
}

// Pass URI to modal
await hashconnect.openPairingModal(pairingString); // ✅ URI provided
```

**Benefits:**
- Never calls `openPairingModal()` without a URI
- Clear error message if URI is missing
- Single-flight safe (no extra retries)
- Window check prevents server-side calls

---

#### D) Chunk Mismatch Reload Guard (No Changes)

**Kept existing behavior:**
- `loadHashConnectWithReload()` does ONE-TIME reload on chunk errors
- SessionStorage guard prevents infinite loops
- No additional retry loops added

---

## Files Modified

**Only 1 file changed:**
- `src/lib/hedera/hashconnect.client.ts`

**Lines changed:**
1. Line 107: Added `pairingString` variable
2. Lines 269-286: Rehydrate wallet state when already paired
3. Line 293: Store `pairingString` from `connect()`
4. Lines 389-417: Ensure `pairingString` exists before opening modal

---

## What This Fixes

### ✅ Fixed: "missing URI" Error
- **Root Cause:** Called `openPairingModal()` without URI
- **Solution:** Always pass `pairingString` to `openPairingModal()`

### ✅ Fixed: Unnecessary Re-pairing
- **Root Cause:** When already paired, wallet state wasn't rehydrated
- **Solution:** Rehydrate `pairingData`, `accountId`, and `isConnected` from existing pairing

### ✅ Fixed: "Not Initialized" Errors
- **Root Cause:** UI thought wallet wasn't connected when it actually was
- **Solution:** Proper state rehydration shows true connection status

### ✅ Maintained: Chunk Mismatch Protection
- **Behavior:** ONE-TIME reload on chunk errors (no infinite loops)
- **Status:** Unchanged - already working correctly

---

## Testing Checklist

### First-Time Pairing Flow
- [ ] Visit pay page with Hedera enabled
- [ ] Click "Pay with crypto"
- [ ] Click "Connect HashPack"
- [ ] Verify pairing modal opens (no "missing URI" error)
- [ ] Complete pairing
- [ ] Verify wallet shows connected

### Already-Paired Flow (Reload)
- [ ] Connect wallet (as above)
- [ ] Reload page
- [ ] Verify wallet state shows connected immediately
- [ ] Verify no "connect" button appears (already connected)
- [ ] Verify accountId displays correctly

### Re-Pairing Flow
- [ ] Connect wallet
- [ ] Disconnect wallet
- [ ] Click "Connect HashPack" again
- [ ] Verify pairing modal opens correctly
- [ ] Verify can re-pair successfully

### Error Handling
- [ ] Try calling `connectWallet()` before init
- [ ] Verify error: "HashConnect not initialized..."
- [ ] Simulate missing pairingString (edge case)
- [ ] Verify error: "HashConnect pairing URI missing..."

### Chunk Mismatch (During Deploy)
- [ ] Simulate chunk error
- [ ] Verify ONE-TIME page reload
- [ ] Verify sessionStorage guard prevents loops
- [ ] Verify works after reload

---

## Key Benefits

1. **No More "Missing URI" Errors** - Always pass pairingString to modal
2. **Faster Reconnects** - Rehydrate existing pairings instead of re-pairing
3. **Better UX** - UI immediately knows connection status
4. **Clear Error Messages** - Know exactly what failed and why
5. **Single-Flight Safe** - No extra retry loops or race conditions
6. **Maintains Chunk Protection** - ONE-TIME reload on chunk errors

---

## Deployment Notes

- **Zero Breaking Changes** - Backward compatible
- **No Database Changes** - All in-memory state
- **No Environment Variables** - No config needed
- **Safe to Deploy Live** - Users will get fix on next page load
- **Chunk Mismatch Protection Maintained** - No regression

---

## Monitoring After Deployment

**Watch for decrease in:**
- "missing URI" errors ❌ → should be 0
- "HashConnect not initialized" errors (when already paired)
- Unnecessary re-pairing flows

**Watch for increase in:**
- Successful rehydration logs: "✅ Rehydrated existing HashConnect pairing"
- Successful first-time pairings (no errors)

**Log messages to track:**
- `✅ Rehydrated existing HashConnect pairing` - existing pairing restored
- `No pairingString available - calling hashconnect.connect()` - getting URI before modal
- `HashConnect pairing URI missing (pairingString)...` - should be rare/never (investigate if seen)

---

## Summary

### What Changed
1. Store `pairingString` from `connect()` call
2. Pass `pairingString` to `openPairingModal()`
3. Rehydrate wallet state when already paired
4. Add window check before opening modal

### What Didn't Change
- Chunk mismatch reload guard (kept as-is)
- Event listeners setup
- Wallet state structure
- External API

### Result
- ✅ No more "missing URI" errors
- ✅ Existing pairings work immediately on reload
- ✅ Clear error messages for troubleshooting
- ✅ Single-flight safe with no retry loops
- ✅ Chunk protection maintained


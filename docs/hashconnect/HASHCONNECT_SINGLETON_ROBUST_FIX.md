# HashConnect Singleton & Robust Error Handling

## Problem Statement

HashConnect/HashPack wallet integration was flaky with multiple issues:
1. **"URI Missing / pairing string undefined"** - HashPack extension not fully initialized
2. **"HashConnect chunk mismatch"** - Deployment-related chunk loading errors
3. **Multiple initialization attempts** - React rerenders causing duplicate inits
4. **Poor error UX** - Generic errors without clear guidance

---

## Solution Implemented

### Step 1: Error Detection Helpers

**Created: `src/lib/walletErrors.ts`**

Two utility functions to identify specific error types:

```typescript
// Detects chunk/manifest mismatch errors
export function isChunkMismatchError(err: unknown): boolean

// Detects HashPack URI missing errors  
export function isUriMissingError(err: unknown): boolean
```

**Why:**
- Distinguishes deployment/cache issues from wallet issues
- Enables targeted error messages and retry strategies

---

### Step 2: Singleton HashConnect Client

**Created: `src/lib/hashconnectClient.ts`**

**Key Features:**
1. ✅ **Module-level singleton** - Only one HashConnect instance per browser session
2. ✅ **Client-only** - Dynamic import, no SSR issues
3. ✅ **Single-flight initialization** - Concurrent calls wait for same promise
4. ✅ **500ms delay + retry** - Handles HashPack extension initialization

**Exports:**
```typescript
// Get or initialize singleton (thread-safe)
export async function getHashconnect(): Promise<any>

// Open pairing modal with retry logic
export async function openHashpackPairingModal(): Promise<void>

// Get current pairing/status
export function getLatestPairingData(): any
export function getLatestConnectionStatus(): any
export function isWalletConnected(): boolean
```

**Initialization Flow:**
1. Check if already initialized → return immediately
2. Check if initialization in progress → wait for it
3. Otherwise, start initialization:
   - Dynamic import `hashconnect`
   - Determine network (testnet/mainnet from env)
   - Get WalletConnect project ID (required)
   - Create HashConnect instance
   - Register event listeners (ONCE)
   - Initialize and store singleton

**Pairing Modal Logic:**
1. Wait 500ms for HashPack extension to initialize
2. Try `openPairingModal()`
3. If "URI Missing" error → wait 500ms and retry ONCE
4. Otherwise throw error

---

### Step 3: Updated UI Component

**Modified: `src/components/public/wallet-connect-button.tsx`**

**Before:**
```typescript
// Used old hashconnect.client.ts with multiple init attempts
// No retry logic for URI missing
// Generic error messages
// No reload button
```

**After:**
```typescript
// Uses singleton client
// Handles specific error types with targeted messages
// Shows reload button for chunk mismatch
// Disabled during connection attempt (prevents double-click)
```

**Error Handling:**
1. **Chunk Mismatch Error:**
   - Message: "Deployment in progress. Please hard refresh (Ctrl+Shift+R)"
   - Shows "Reload Page" button
   - Prevents infinite retry loops

2. **URI Missing Error:**
   - Message: "HashPack is still initializing. Please try again in a moment."
   - Suggests waiting and retrying manually
   - Singleton client already retried once

3. **Generic Error:**
   - Shows actual error message
   - User can retry by clicking connect again

---

### Step 4: MetaMask Detection (Non-Fatal)

**Verified: No explicit MetaMask connect calls in Hedera flow**

Only one reference to `window.ethereum`:
```typescript
// Detection only - non-fatal warning
if (typeof window !== 'undefined' && window.ethereum) {
  setHasMetaMask(true); // Shows info message, doesn't call MetaMask
}
```

**This is safe** - only detects presence to show warning message, never calls `ethereum.request()`

---

## Key Improvements

### 1. True Singleton Pattern ✅
**Before:**
- Multiple initialization attempts on component rerenders
- Race conditions from concurrent calls
- Duplicate event listeners

**After:**
- Module-level singleton variables
- Single-flight initialization promise
- Only one HashConnect instance per session

### 2. Retry Logic for URI Missing ✅
**Before:**
- Failed immediately if HashPack not ready
- No retry mechanism
- Confusing error for users

**After:**
- Waits 500ms before opening modal
- Retries once with 500ms delay if URI missing
- Handles HashPack extension init delay

### 3. Better Error Messages ✅
**Before:**
```
Error: HashConnect initialization failed
```

**After:**
```
// Chunk mismatch:
"Deployment in progress. Please hard refresh (Ctrl+Shift+R)"
[Reload Page Button]

// URI missing:
"HashPack is still initializing. Please try again in a moment."

// Other:
"[Specific error message]"
```

### 4. Client-Only Enforcement ✅
**Before:**
- Potential SSR issues
- Dynamic imports not guaranteed

**After:**
- `'use client'` directive
- Window check before any HashConnect code
- Dynamic import at runtime only

### 5. Prevents Double-Click ✅
**Before:**
```typescript
<Button onClick={handleConnect}>
```

**After:**
```typescript
<Button 
  onClick={handleConnect}
  disabled={isConnecting}  // Prevents spam clicks
>
```

---

## Files Changed

### Created (2 files):
1. **`src/lib/walletErrors.ts`**
   - Error detection utilities
   - `isChunkMismatchError()`, `isUriMissingError()`

2. **`src/lib/hashconnectClient.ts`**
   - Singleton HashConnect client
   - `getHashconnect()`, `openHashpackPairingModal()`
   - Module-level singleton variables

### Modified (1 file):
3. **`src/components/public/wallet-connect-button.tsx`**
   - Uses new singleton client
   - Better error handling with specific messages
   - Reload button for chunk mismatch
   - Disabled state during connection

### Documentation:
4. **`HASHCONNECT_SINGLETON_ROBUST_FIX.md`** (this file)

---

## Environment Variables Required

The singleton client requires:

```bash
# Hedera network (defaults to testnet if not set)
NEXT_PUBLIC_HEDERA_NETWORK=testnet  # or "mainnet"

# WalletConnect project ID (REQUIRED)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id-here
```

**To get WalletConnect project ID:**
1. Go to https://cloud.walletconnect.com/
2. Create a project
3. Copy the Project ID
4. Add to `.env.local`

---

## Testing

### Test 1: Normal Connection Flow
1. Visit payment page
2. Select cryptocurrency payment option
3. Click "Connect HashPack"
4. **Expected:**
   - Brief delay (500ms)
   - HashPack modal opens
   - User completes pairing
   - Connection successful

### Test 2: URI Missing (Extension Slow)
1. Open page with HashPack extension just installed
2. Click "Connect HashPack" immediately
3. **Expected:**
   - First attempt waits 500ms
   - If URI missing, retries after 500ms
   - Usually succeeds on retry
   - If still fails, shows: "HashPack is still initializing..."

### Test 3: Chunk Mismatch (During Deployment)
1. Have page open during deployment
2. Try to connect wallet
3. **Expected:**
   - Error message: "Deployment in progress..."
   - "Reload Page" button appears
   - Click button → page reloads
   - After reload, connection works

### Test 4: Multiple Components Try to Init
1. Have multiple components call `getHashconnect()`
2. **Expected:**
   - Only ONE initialization happens
   - All components get same instance
   - No duplicate event listeners

### Test 5: Page Refresh
1. Connect wallet successfully
2. Refresh page
3. **Expected:**
   - Wallet reconnects automatically (if paired)
   - No "URI missing" errors
   - Singleton reuses existing pairing

---

## Migration Notes

### Breaking Changes: None ✅
- Existing components continue to work
- New singleton is backward compatible
- Old `hashconnect.client.ts` still exists (if needed)

### Recommended Updates:
For any other components using HashConnect:
```typescript
// OLD:
import { initHashConnect } from '@/lib/hedera/wallet-service.client';

// NEW:
import { getHashconnect, openHashpackPairingModal } from '@/lib/hashconnectClient';

// Usage:
const client = await getHashconnect(); // Gets singleton
await openHashpackPairingModal(); // Opens modal with retry
```

---

## Monitoring

After deployment, watch for:

### Should Decrease:
- ❌ "URI Missing" errors
- ❌ "Pairing string undefined" errors
- ❌ Multiple initialization attempts
- ❌ Chunk mismatch infinite loops

### Should Increase:
- ✅ Successful wallet connections
- ✅ Users completing pairing on first try
- ✅ Clear error messages (users know what to do)

### Logs to Track:
```
[HashConnect] Initializing singleton instance...
[HashConnect] ✅ Singleton initialized successfully
[HashConnect] Opening pairing modal...
[HashConnect] URI missing - retrying after delay...
[WalletConnect] Pairing modal opened successfully
[WalletConnect] Connection failed: [error details]
```

---

## Troubleshooting

### Issue: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required"
**Solution:** Add the env variable to `.env.local`

### Issue: Still seeing URI missing errors
**Possible causes:**
1. HashPack extension not installed
2. Extension disabled
3. User needs to wait longer after install

**Solution:** Message tells user to wait and retry

### Issue: Chunk mismatch errors persist
**Possible causes:**
1. Deployment still in progress
2. Browser cache issues

**Solution:**
- User clicks "Reload Page" button
- Or hard refresh (Ctrl+Shift+R)
- Our Next.js config has no-cache headers to prevent this

### Issue: Multiple initializations still happening
**Check:**
- Are you importing from `hashconnectClient.ts`?
- Or still using old `hashconnect.client.ts`?

**Solution:** Update imports to use new singleton

---

## Summary

**Problem:** Flaky HashConnect init with URI missing and chunk errors

**Root Causes:**
1. Multiple initialization attempts
2. No retry logic for HashPack extension delay
3. Poor error messages
4. No handling for deployment/cache issues

**Solution:**
1. ✅ True singleton with module-level variables
2. ✅ 500ms delay + retry for URI missing
3. ✅ Specific error detection and messages
4. ✅ Reload button for chunk mismatch
5. ✅ Client-only enforcement
6. ✅ Prevents double-click spam

**Files:**
- Created: `walletErrors.ts`, `hashconnectClient.ts`
- Modified: `wallet-connect-button.tsx`
- ~200 lines total

**Result:**
- Robust, singleton-based HashConnect integration
- Better UX with clear error messages
- Handles common failure modes gracefully
- Ready for production deployment


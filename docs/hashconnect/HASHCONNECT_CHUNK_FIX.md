# HashConnect Chunk Loading Fix - Implementation Summary

## Problem Statement

The pay page's "Pay with crypto" flow intermittently fails with:
- "Failed to load HashConnect library after 8 attempts. Loading chunk #### failed…"
- "Uncaught SyntaxError: Identifier 'n' has already been declared" inside a _next chunk
- Then "HashConnect not initialized. Call initHashConnect() first."

**Root Cause**: Chunk/manifest mismatch or corrupted chunk loads during deploy/restarts on Render. The retry loop (8 attempts) makes it worse by repeatedly fetching stale manifests.

---

## Solution Implemented

### 1. **HashConnect Dynamic Import Loader** (`src/lib/hedera/hashconnect.client.ts`)

#### Changes:
- **REMOVED**: `loadHashConnectWithRetry()` function with 8 retry attempts
- **ADDED**: `loadHashConnectWithReload()` function with ONE-TIME reload on chunk errors

#### New Behavior:
1. Try dynamic import **once**
2. If error message contains:
   - "Loading chunk"
   - "ChunkLoadError"
   - "already been declared"
   
   Then perform **ONE-TIME full page reload** using `sessionStorage` guard
3. Otherwise, throw the error immediately

#### Key Code Changes:

```typescript
const CHUNK_RELOAD_KEY = 'hashconnect_chunk_reload_attempted';

async function loadHashConnectWithReload(): Promise<typeof import('hashconnect')> {
  try {
    log.info('📦 Attempting HashConnect dynamic import (single attempt)');
    const hashconnectModule = await import('hashconnect');
    
    // Success - clear any reload flag
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    }
    
    return hashconnectModule;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Detect chunk loading errors (manifest mismatch or corrupted chunk)
    const isChunkError = 
      errorMessage.includes('Loading chunk') || 
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('already been declared');
    
    if (isChunkError) {
      log.error('❌ HashConnect chunk load error detected (manifest/chunk mismatch)', {
        error: errorMessage,
        errorType: 'CHUNK_MISMATCH',
      });
      
      // Check if we've already tried reloading
      const alreadyReloaded = typeof sessionStorage !== 'undefined' && 
        sessionStorage.getItem(CHUNK_RELOAD_KEY) === 'true';
      
      if (!alreadyReloaded && typeof sessionStorage !== 'undefined') {
        // Mark that we're about to reload (guard against loops)
        sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
        
        log.info('🔄 Performing ONE-TIME page reload to fetch fresh chunks');
        console.warn('Chunk mismatch detected - reloading page to fetch correct manifest...');
        
        // Full page reload to get fresh HTML + manifest
        window.location.reload();
        
        return new Promise(() => {});
      } else {
        // Already reloaded once - don't loop
        log.error('❌ Chunk error persists after reload - deployment may still be in progress', {
          error: errorMessage,
          errorType: 'CHUNK_MISMATCH_PERSISTENT',
        });
        throw new Error(
          'Failed to load HashConnect due to deployment in progress. Please refresh the page in a few moments.'
        );
      }
    } else {
      // Not a chunk error - genuine initialization failure
      log.error('❌ HashConnect import failed (non-chunk error)', {
        error: errorMessage,
        errorType: 'IMPORT_ERROR',
        stack: error instanceof Error ? error.stack?.substring(0, 200) : undefined,
      });
      throw error;
    }
  }
}
```

#### Logging Added:
- `CHUNK_MISMATCH`: Detected chunk error, will reload
- `CHUNK_MISMATCH_PERSISTENT`: Chunk error after reload (deployment in progress)
- `IMPORT_ERROR`: Real initialization error (non-chunk related)

---

### 2. **Single Import Location Verification**

✅ **VERIFIED**: Only `src/lib/hedera/hashconnect.client.ts` imports `hashconnect` directly.

No other files import hashconnect:
- `src/lib/hedera/wallet-service.client.ts` - imports from hashconnect.client.ts
- `src/components/public/hedera-payment-option.tsx` - imports from wallet-service.client.ts
- `src/components/public/wallet-connect-button.tsx` - imports from wallet-service.client.ts
- `src/components/public/payment-method-selector.tsx` - uses dynamic import with `ssr: false`

**No changes needed** - isolation is already correct.

---

### 3. **HederaPaymentOption Component** (`src/components/public/hedera-payment-option.tsx`)

#### Changes:
- **ADDED**: Pre-initialization of HashConnect on component mount
- **ADDED**: Button gating until initialization completes
- **ADDED**: User feedback ("Loading wallet...")
- **ADDED**: Error surfacing for initialization failures

#### New State:
```typescript
const [isInitializingHashConnect, setIsInitializingHashConnect] = useState(false);
const [hashConnectInitialized, setHashConnectInitialized] = useState(false);
const [hashConnectError, setHashConnectError] = useState<string | null>(null);
```

#### Pre-initialization Hook:
```typescript
useEffect(() => {
  if (!isAvailable) return;
  
  // Only initialize once
  if (isInitializingHashConnect || hashConnectInitialized) return;
  
  console.log('[HederaPaymentOption] Pre-initializing HashConnect...');
  setIsInitializingHashConnect(true);
  setHashConnectError(null);
  
  initHashConnect()
    .then(() => {
      console.log('[HederaPaymentOption] ✅ HashConnect pre-initialized successfully');
      setHashConnectInitialized(true);
      setHashConnectError(null);
    })
    .catch((error) => {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize wallet';
      console.error('[HederaPaymentOption] ❌ HashConnect initialization failed:', error);
      setHashConnectError(errorMsg);
      toast.error('Failed to initialize crypto wallet: ' + errorMsg);
    })
    .finally(() => {
      setIsInitializingHashConnect(false);
    });
}, [isAvailable, isInitializingHashConnect, hashConnectInitialized]);
```

#### Button Gating Logic:
```typescript
const canSelect = isAvailable && hashConnectInitialized && !hashConnectError;
const isInitializing = isInitializingHashConnect || isLoadingMerchant;

<button
  onClick={canSelect ? onSelect : undefined}
  disabled={!canSelect}
  aria-busy={isInitializing}
  // ... other props
>
```

#### User Feedback UI:
```tsx
{/* Initialization Status */}
{isInitializingHashConnect && (
  <div className="flex items-center gap-2 text-sm text-purple-600 mb-3">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span>Loading wallet...</span>
  </div>
)}

{hashConnectError && (
  <div className="flex items-start gap-2 text-sm text-red-600 mb-3">
    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
    <span>Wallet initialization failed: {hashConnectError}</span>
  </div>
)}

{/* Features - only show when ready */}
{!isInitializingHashConnect && !hashConnectError && (
  <div className="flex flex-wrap gap-3 text-xs">
    {/* ... features ... */}
  </div>
)}
```

---

## Files Modified

1. **`src/lib/hedera/hashconnect.client.ts`**
   - Lines 20-95: Replaced `loadHashConnectWithRetry()` with `loadHashConnectWithReload()`
   - Line 167: Updated function call

2. **`src/components/public/hedera-payment-option.tsx`**
   - Line 9: Added `AlertCircle` icon import
   - Line 18: Added `initHashConnect` import
   - Lines 57-60: Added HashConnect initialization state
   - Lines 62-88: Added pre-initialization useEffect hook
   - Lines 255-257: Added button gating logic
   - Lines 263-283: Updated button props (disabled, aria-busy, onClick)
   - Lines 323-336: Added initialization status UI
   - Lines 339-352: Wrapped features in conditional display

---

## Testing Checklist

### Normal Flow (No Chunk Errors)
- [ ] Visit pay page with Hedera enabled
- [ ] Verify "Loading wallet..." appears briefly
- [ ] Verify button becomes clickable after init
- [ ] Verify can connect wallet and pay

### Chunk Error Flow (Simulated Deploy)
- [ ] Clear sessionStorage
- [ ] Trigger chunk error (simulate by corrupting chunk cache)
- [ ] Verify page reloads automatically
- [ ] Verify sessionStorage key is set
- [ ] Verify works after reload

### Persistent Chunk Error (Ongoing Deploy)
- [ ] Set sessionStorage key manually
- [ ] Trigger chunk error again
- [ ] Verify error message appears
- [ ] Verify no infinite reload loop

### Init Error Flow
- [ ] Simulate non-chunk error (e.g., network failure)
- [ ] Verify error is surfaced in UI
- [ ] Verify button remains disabled
- [ ] Verify error message is user-friendly

---

## Benefits

1. **No More Retry Loops**: Single attempt prevents fetching stale manifests repeatedly
2. **Auto-Recovery**: One-time reload gets fresh HTML + chunks during deploys
3. **No Infinite Loops**: SessionStorage guard prevents reload loops
4. **Better UX**: Pre-initialization + loading feedback prevents "connect before init" race condition
5. **Clear Error Differentiation**: Logging distinguishes chunk mismatches from real errors
6. **User Awareness**: Clear feedback when wallet is loading or failed

---

## Deployment Notes

- No database changes required
- No environment variable changes required
- No dependency changes required
- Safe to deploy during active session (users will get fresh code on next page load)
- SessionStorage key is scoped per-tab, won't affect other users

---

## Monitoring

After deployment, monitor for:
1. Decrease in "Failed to load HashConnect" errors
2. Decrease in "already been declared" syntax errors
3. Increase in successful HashConnect initializations
4. User reports of "Loading wallet..." feedback

Look for these log messages:
- `CHUNK_MISMATCH` - expected during deploys
- `CHUNK_MISMATCH_PERSISTENT` - investigate if frequent
- `IMPORT_ERROR` - investigate non-chunk failures


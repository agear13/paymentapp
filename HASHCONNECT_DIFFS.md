# HashConnect Chunk Loading Fix - Exact Diffs

## File 1: `src/lib/hedera/hashconnect.client.ts`

### Diff 1: Replace retry loop with one-time reload logic (lines 20-95)

**REMOVED:**
```typescript
/**
 * Loads HashConnect with automatic retry on failure
 * Handles transient 502 errors and chunk loading failures during Render deploys
 * 
 * Render Basic plan has no minInstances support, so the app may be cold-starting.
 * This can take 30-60 seconds during deployments. We use exponential backoff
 * with up to 8 retries to wait out the deployment window.
 */
async function loadHashConnectWithRetry(
  maxRetries = 8
): Promise<typeof import('hashconnect')> {
  let lastError: Error | null = null;

  // Exponential backoff delays (in milliseconds)
  const delays = [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // User-friendly message (only show on first attempt or every few attempts)
      if (attempt === 1) {
        console.log('Connecting to Hedera network...');
      } else if (attempt % 2 === 0) {
        console.log('Still connecting to Hedera network...');
      }
      
      const hashconnectModule = await import('hashconnect');
      
      if (attempt > 1) {
        console.log('✓ Connected to Hedera network');
      }
      
      return hashconnectModule;
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Detect chunk loading errors (indicate deploy in progress)
      const isChunkError = errorMessage.includes('Loading chunk') || 
                          errorMessage.includes('missing:') ||
                          errorMessage.includes('ChunkLoadError');

      // Log technical details to console for debugging
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `HashConnect load attempt ${attempt}/${maxRetries} failed:`,
          errorMessage,
          isChunkError ? '(chunk loading error - deploy may be in progress)' : ''
        );
      }

      // Don't delay after last attempt
      if (attempt < maxRetries) {
        // Use exponential backoff delay for this attempt
        const baseDelay = delays[attempt - 1] || delays[delays.length - 1];
        
        // Add jitter (±20%) to prevent thundering herd
        const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
        const delayMs = Math.round(baseDelay + jitter);
        
        // For chunk errors, use longer delays (multiply by 1.5)
        const finalDelay = isChunkError ? Math.round(delayMs * 1.5) : delayMs;

        if (process.env.NODE_ENV === 'development') {
          console.log(`Retrying in ${(finalDelay / 1000).toFixed(1)}s...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }
  }

  throw new Error(
    `Failed to load HashConnect library after ${maxRetries} attempts. ${
      lastError ? `Last error: ${lastError.message}` : ''
    }`
  );
}
```

**ADDED:**
```typescript
/**
 * Session storage key to track if we've already reloaded due to chunk error
 * Prevents infinite reload loops
 */
const CHUNK_RELOAD_KEY = 'hashconnect_chunk_reload_attempted';

/**
 * Loads HashConnect with ONE attempt.
 * On chunk load errors (manifest mismatch during deploy), performs ONE-TIME page reload.
 * 
 * Rationale: Retry loops make chunk mismatches worse by repeatedly fetching stale manifests.
 * A single page reload gets fresh HTML with correct chunk references.
 */
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
      errorMessage.includes('already been declared'); // SyntaxError from duplicate chunk loads
    
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
        
        // Never reaches here, but return promise for TypeScript
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

### Diff 2: Update function call (line 167)

**CHANGED FROM:**
```typescript
    // Dynamic import from npm package (NOT CDN) with retry logic
    const hashconnectModule = await loadHashConnectWithRetry();
```

**CHANGED TO:**
```typescript
    // Dynamic import from npm package (NOT CDN) - single attempt with reload on chunk error
    const hashconnectModule = await loadHashConnectWithReload();
```

---

## File 2: `src/components/public/hedera-payment-option.tsx`

### Diff 1: Add AlertCircle icon import (line 9)

**CHANGED FROM:**
```typescript
import { Wallet, Check, Zap, Loader2 } from 'lucide-react';
```

**CHANGED TO:**
```typescript
import { Wallet, Check, Zap, Loader2, AlertCircle } from 'lucide-react';
```

### Diff 2: Add initHashConnect import (line 18)

**CHANGED FROM:**
```typescript
import { getWalletState } from '@/lib/hedera/wallet-service.client';
```

**CHANGED TO:**
```typescript
import { getWalletState, initHashConnect } from '@/lib/hedera/wallet-service.client';
```

### Diff 3: Add HashConnect initialization state (after line 55)

**ADDED:**
```typescript
  
  // HashConnect initialization state
  const [isInitializingHashConnect, setIsInitializingHashConnect] = useState(false);
  const [hashConnectInitialized, setHashConnectInitialized] = useState(false);
  const [hashConnectError, setHashConnectError] = useState<string | null>(null);
```

### Diff 4: Add pre-initialization hook (before merchant settings useEffect)

**ADDED (before line 57 / after state declarations):**
```typescript
  // Pre-initialize HashConnect when component mounts (if available)
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

### Diff 5: Add button gating logic (before return statement)

**ADDED (just before the return statement around line 222):**
```typescript
  // Determine if the payment option can be selected
  const canSelect = isAvailable && hashConnectInitialized && !hashConnectError;
  const isInitializing = isInitializingHashConnect || isLoadingMerchant;
```

### Diff 6: Update button props (line ~224)

**CHANGED FROM:**
```typescript
      <button
        type="button"
        onClick={isAvailable ? onSelect : undefined}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        disabled={!isAvailable}
        className={cn(
          'w-full text-left transition-all rounded-lg border-2 p-4',
          'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
          {
            'border-purple-600 bg-purple-50 shadow-md': isSelected,
            'border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm': !isSelected && isAvailable,
            'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed': !isAvailable,
          }
        )}
        role="radio"
        aria-checked={isSelected}
        aria-disabled={!isAvailable}
        aria-label="Pay with HBAR, USDC, USDT, or AUDD via Hedera"
        tabIndex={isAvailable ? 0 : -1}
      >
```

**CHANGED TO:**
```typescript
      <button
        type="button"
        onClick={canSelect ? onSelect : undefined}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        disabled={!canSelect}
        className={cn(
          'w-full text-left transition-all rounded-lg border-2 p-4',
          'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
          {
            'border-purple-600 bg-purple-50 shadow-md': isSelected,
            'border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm': !isSelected && canSelect,
            'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed': !canSelect,
          }
        )}
        role="radio"
        aria-checked={isSelected}
        aria-disabled={!canSelect}
        aria-label="Pay with HBAR, USDC, USDT, or AUDD via Hedera"
        aria-busy={isInitializing}
        tabIndex={canSelect ? 0 : -1}
      >
```

### Diff 7: Add initialization status UI (after payment description, before features)

**CHANGED FROM:**
```typescript
            <p className="text-sm text-slate-600 mb-3">
              Pay with HBAR, USDC, USDT, or AUDD on the Hedera network
            </p>

            {/* Features */}
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Zap className="w-3.5 h-3.5" />
                <span>Low fees (~$0.0001)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>3-5 second finality</span>
              </div>
            </div>
```

**CHANGED TO:**
```typescript
            <p className="text-sm text-slate-600 mb-3">
              Pay with HBAR, USDC, USDT, or AUDD on the Hedera network
            </p>

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
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Low fees (~$0.0001)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span>3-5 second finality</span>
                </div>
              </div>
            )}
```

---

## Summary

### Files Changed: 2
1. `src/lib/hedera/hashconnect.client.ts`
2. `src/components/public/hedera-payment-option.tsx`

### No Changes Needed
- ✅ Only `hashconnect.client.ts` imports hashconnect directly (verified)
- ✅ All other files properly use the client module

### Key Improvements
1. **Removed 8-attempt retry loop** → Single attempt with ONE-TIME reload on chunk errors
2. **Added sessionStorage guard** → Prevents infinite reload loops
3. **Added pre-initialization** → HashConnect loads when component mounts
4. **Added button gating** → Can't click until init completes
5. **Added user feedback** → "Loading wallet..." and error messages
6. **Added logging differentiation** → CHUNK_MISMATCH vs IMPORT_ERROR


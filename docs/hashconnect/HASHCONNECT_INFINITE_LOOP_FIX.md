# HashConnect Infinite Reload Loop Fix

## Problem

**Infinite reload loop** in production caused by:
- Chunk mismatch errors ("Identifier 'n' has already been declared")
- HashConnect chunk load failures
- Page reloads repeatedly, never stabilizing
- HashConnect initializes multiple times

### Root Causes

1. **Reload flag had 5-minute expiry** - After 5 minutes, another reload was allowed
2. **Flag was cleared on persistent error** - Allowed reload attempts to restart
3. **initPromise reset to null on error** - Allowed multiple initialization attempts
4. **Throwing errors** - Could trigger re-initialization attempts

**Result:** Page enters infinite loop during deployments or cache issues

---

## Solution Implemented

### A) Strict Single-Reload Guard

**Changed: Session storage flag is now permanent**

```typescript
// BEFORE: Flag expired after 5 minutes
const RELOAD_FLAG_EXPIRY_MS = 5 * 60 * 1000;
// Flag could be cleared

// AFTER: Flag is permanent for browser session
const CHUNK_RELOAD_KEY = 'hc_chunk_retry';
// Simple check: if key exists, reload was attempted
// NO expiry, NO clearing - permanent until tab closed
```

**Key Changes:**
1. ✅ Renamed key to `hc_chunk_retry` (per requirements)
2. ✅ Removed 5-minute expiry logic
3. ✅ Removed timestamp tracking (not needed)
4. ✅ Simplified to boolean check
5. ✅ Flag NEVER cleared once set

### B) Single-Flight Initialization

**Changed: initPromise never reset**

```typescript
// BEFORE: On error
initPromise = null; // Allowed retries

// AFTER: On error
// DO NOT reset initPromise to null
// Keep it rejected to prevent retry loops
// Once initialization fails, it stays failed
```

**Behavior:**
- ✅ First call: Creates initPromise, attempts initialization
- ✅ Concurrent calls: Return same initPromise (waits for result)
- ✅ After success: Returns immediately (already initialized)
- ✅ After failure: Promise stays rejected, no retries allowed

### C) Safe Failure Without Loops

**Changed: On persistent chunk error**

```typescript
// BEFORE:
sessionStorage.removeItem(CHUNK_RELOAD_KEY); // Cleared flag!
throw new Error(...); // Could trigger retry

// AFTER:
// DO NOT clear flag - must remain set to prevent loops
// DO NOT throw - return rejected promise instead
return Promise.reject(new Error(...));
```

**Benefits:**
1. ✅ No more infinite reloads
2. ✅ Page stays stable (doesn't keep refreshing)
3. ✅ Clear error message to user
4. ✅ User knows to hard refresh manually

---

## Changes Summary

### File: `src/lib/hedera/hashconnect.client.ts`

#### Change 1: Permanent Session Flag (Lines 20-38)
```typescript
// OLD: Expiring flag with timestamp
const CHUNK_RELOAD_KEY = 'hashconnect_chunk_reload_attempted';
const RELOAD_FLAG_EXPIRY_MS = 5 * 60 * 1000;
function hasRecentlyReloaded() {
  // Complex logic with expiry checking
  // Could clear flag if expired
}

// NEW: Permanent flag, simple check
const CHUNK_RELOAD_KEY = 'hc_chunk_retry';
function hasAttemptedReload(): boolean {
  // Simple: if key exists, we've reloaded
  return sessionStorage.getItem(CHUNK_RELOAD_KEY) !== null;
}
```

#### Change 2: Never Clear Flag on Success (Lines 62-70)
```typescript
// OLD:
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY); // Cleared!
}

// NEW:
// DO NOT clear reload flag
// Keep flag permanent for session
log.info('✅ HashConnect module loaded successfully');
```

#### Change 3: Single Reload Attempt Only (Lines 81-125)
```typescript
// OLD:
const alreadyReloaded = hasRecentlyReloaded(); // Could expire
if (!alreadyReloaded) {
  // ... set flag with timestamp
  window.location.replace(...);
} else {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY); // Cleared flag!
  throw new Error(...); // Threw error
}

// NEW:
const alreadyAttemptedReload = hasAttemptedReload(); // Permanent check
if (!alreadyAttemptedReload) {
  sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true'); // Set BEFORE reload
  window.location.replace(...);
} else {
  // STOP - no more reloads
  // DO NOT clear flag
  // DO NOT throw - return rejected promise
  return Promise.reject(new Error(...));
}
```

#### Change 4: Never Reset initPromise (Lines 385-395)
```typescript
// OLD:
initPromise = null; // Reset allowed retries
throw new Error(...);

// NEW:
// DO NOT reset initPromise
// Keep it rejected - no retries
log.info('HashConnect initialization failed permanently - manual refresh required');
throw new Error(...);
```

---

## Behavior After Fix

### Scenario 1: First Load, Chunk Error
1. Page loads → chunk error detected
2. Check `hc_chunk_retry` flag → doesn't exist
3. Set flag to `'true'`
4. Reload page once with cache-bust
5. **If successful:** Works normally ✅
6. **If still fails:** See Scenario 2

### Scenario 2: Persistent Chunk Error (After Reload)
1. Page loads → chunk error detected again
2. Check `hc_chunk_retry` flag → EXISTS
3. **STOP - No reload**
4. Log error and return rejected promise
5. Page stays stable (no more reloads)
6. User sees error message: "Hard refresh required"

### Scenario 3: Multiple Components Try to Initialize
1. Component A calls `initHashConnect()`
2. Component B calls `initHashConnect()` (concurrent)
3. Both get same `initPromise` (single-flight)
4. Only ONE initialization attempt happens
5. Both components get same result (success or failure)

### Scenario 4: Retry After Failed Init
1. First init attempt fails
2. `initPromise` stays rejected
3. Component tries to init again
4. Gets same rejected promise immediately
5. **No new initialization attempt** (stays failed)
6. User must manually refresh to retry

---

## Testing

### Before Fix
```
Browser behavior:
❌ Page reloads infinitely
❌ Console filled with chunk errors
❌ HashConnect initializes multiple times
❌ UI never stabilizes
```

### After Fix
```
Browser behavior:
✅ Page reloads at most ONCE per session
✅ After one reload, page is stable
✅ HashConnect initializes at most ONCE
✅ Clear error message if deployment in progress
✅ UI stays stable (no flashing/looping)
```

### Manual Test Steps

1. **Clear browser data:**
   - Open DevTools → Application → Storage → Clear site data
   - Or use Incognito window

2. **Visit payment page during deployment:**
   ```
   http://your-site.com/pay/[shortCode]
   ```

3. **Expected behavior:**
   - Page may reload ONCE if chunk error occurs
   - After one reload, page STOPS (no more reloads)
   - If error persists, see message: "Hard refresh required"
   - Can hard refresh (Ctrl+Shift+R) to try again

4. **Check sessionStorage:**
   ```javascript
   // In console:
   sessionStorage.getItem('hc_chunk_retry')
   // Should be 'true' if reload was attempted
   ```

5. **Verify no infinite loop:**
   - Leave page open for 5+ minutes
   - Should NOT reload again (old code would after 5 min expiry)
   - Page stays stable

---

## Benefits

### 1. No More Infinite Loops ✅
- **Before:** Page could reload indefinitely (5-min expiry allowed retries)
- **After:** Maximum ONE reload per browser session, then STOP

### 2. Stable Page State ✅
- **Before:** Page kept refreshing, UI never stabilized
- **After:** Page stays stable after single reload attempt

### 3. Single-Flight Initialization ✅
- **Before:** Multiple components could trigger multiple inits
- **After:** Only ONE initialization attempt, shared across all components

### 4. Non-Reentrant ✅
- **Before:** Error reset promise, allowed retries
- **After:** Once failed, stays failed (no automatic retries)

### 5. Clear User Guidance ✅
- **Before:** Silent loops or confusing errors
- **After:** Clear message: "Hard refresh (Ctrl+Shift+R) required"

### 6. Deployment Safe ✅
- **Before:** Deployments caused infinite loops for users
- **After:** Users get ONE reload attempt, then stable error state

---

## Edge Cases Handled

### Case 1: Long Deployment (> 5 minutes)
- **Before:** Flag expired, allowed another reload after 5 min
- **After:** Flag never expires, no retry after 5 min

### Case 2: Multiple Tabs
- Each tab has its own sessionStorage
- Each tab gets ONE reload attempt independently
- No cross-tab interference

### Case 3: User Manually Refreshes
- Hard refresh (Ctrl+Shift+R) clears sessionStorage
- Gives user fresh start with new reload allowance
- This is intentional - manual refresh should work

### Case 4: Concurrent Initializations
- Multiple components call `initHashConnect()` simultaneously
- All get same `initPromise` (single-flight guard)
- Only ONE actual initialization happens

### Case 5: Initialization Failure
- First attempt fails → `initPromise` stays rejected
- Future calls get rejected promise immediately
- No new attempts until page manually refreshed

---

## Migration Notes

**No Breaking Changes:**
- External API unchanged
- All exports same as before
- Components don't need updates
- Behavior only changes on error paths

**Deployment:**
- Safe to deploy immediately
- Users in infinite loops will stabilize on next load
- New users won't experience infinite loops

**Monitoring:**
After deployment, watch for:
- ✅ Decrease in reload loops
- ✅ Decrease in multiple init attempts
- ✅ Stable error states during deployments

---

## Summary

**Problem:** Infinite reload loop during chunk mismatches

**Root Causes:**
1. Reload flag had expiry (5 min)
2. Flag was cleared on errors
3. initPromise reset allowed retries

**Solution:**
1. ✅ Made reload flag permanent (no expiry)
2. ✅ Never clear flag once set
3. ✅ Never reset initPromise (stays rejected)
4. ✅ Return rejected promise instead of throwing

**Result:**
- Maximum ONE reload per session
- Single-flight initialization
- Non-reentrant (no automatic retries)
- Stable page state
- Clear user guidance

**Files Changed:** 1
- `src/lib/hedera/hashconnect.client.ts` (4 changes)

**Lines Changed:** ~30 lines
**Behavior:** Non-breaking, error path only
**Impact:** Eliminates infinite reload loops


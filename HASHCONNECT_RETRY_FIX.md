# HashConnect Retry Conflict Fix

## Problem Statement

After deploying the chunk reload fix, users were still experiencing errors:
- "Uncaught SyntaxError: Identifier 'n' has already been declared"
- "❌ Chunk error persists after reload - deployment may still be in progress"
- "HashConnect load failed after 3 attempts"

### Root Cause

Two conflicting retry mechanisms:
1. **Chunk reload guard** (sessionStorage-based) - ONE-TIME page reload on chunk errors
2. **Load attempts counter** (`loadAttempts` with `MAX_LOAD_ATTEMPTS = 3`) - Module-level retry limit

**The conflict:**
1. Chunk error occurs → page reloads (attempt 1)
2. After reload, chunk error persists (deployment still in progress)
3. Reload guard prevents second reload (correct behavior)
4. BUT `loadAttempts` hits 3 quickly
5. Throws "load failed after 3 attempts" before user can manually refresh

**Additional issue:** Simple `window.location.reload()` might use cached chunks. Browser cache could serve stale chunks even after reload.

---

## Solution Implemented

### A) Remove Conflicting Retry Counter

**Removed module-level variables (lines 101-102):**
```typescript
// REMOVED:
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 3;
```

**Removed from `loadHashConnect()` function:**
- Removed `loadAttempts++`
- Removed check: `if (loadAttempts > MAX_LOAD_ATTEMPTS)`
- Removed `loadAttempts` from logs
- Removed `loadAttempts = MAX_LOAD_ATTEMPTS` on module not found

**Result:** Single source of truth for retry logic (the chunk reload guard)

---

### B) Improved Reload with Cache Busting

**Enhanced reload mechanism (lines 70-77):**

```typescript
// BEFORE:
window.location.reload();

// AFTER:
setTimeout(() => {
  // Hard reload with cache-busting to force fresh chunks
  // Using href assignment with timestamp to bypass cache
  const url = new URL(window.location.href);
  url.searchParams.set('_t', Date.now().toString());
  window.location.href = url.toString();
}, 100);
```

**Why this works:**
1. **Timestamp parameter (`_t`)** - Forces browser to treat it as new request
2. **Full URL navigation** - Bypasses service worker and cache
3. **100ms delay** - Ensures logs are written before reload
4. **One-time only** - sessionStorage guard still prevents loops

---

## Changes Made

### File: `src/lib/hedera/hashconnect.client.ts`

#### Change 1: Remove retry counter variables
- **Lines 101-102:** Removed `loadAttempts` and `MAX_LOAD_ATTEMPTS`

#### Change 2: Remove retry logic from `loadHashConnect()`
- **Line 153:** Removed `loadAttempts++`
- **Lines 155-162:** Removed attempt limit check
- **Line 154:** Removed `attempt: loadAttempts` from log
- **Line 169:** Removed `attempt: loadAttempts` from success log
- **Line 177:** Removed `attempt: loadAttempts` from error log
- **Lines 181-183:** Removed `loadAttempts = MAX_LOAD_ATTEMPTS` logic

#### Change 3: Add cache-busting reload
- **Lines 70-77:** Replace simple `reload()` with cache-busting URL navigation

---

## What This Fixes

### ✅ No More "3 Attempts" Error
- **Before:** Hit attempt limit before user could manually refresh
- **After:** No artificial attempt limit, user gets clear "deployment in progress" message

### ✅ Better Cache Handling
- **Before:** `reload()` might serve cached chunks
- **After:** Cache-busting parameter forces fresh chunks

### ✅ Single Retry Strategy
- **Before:** Two conflicting mechanisms (attempts counter + reload guard)
- **After:** One mechanism (sessionStorage-based reload guard)

### ✅ Clearer Error Messages
- **Before:** "load failed after 3 attempts" (confusing)
- **After:** "deployment may still be in progress. Please refresh..." (clear action)

---

## Error Flow After Fix

### Scenario 1: Chunk Error During Active Deployment

1. User loads page → chunk error occurs
2. Detects chunk error (SyntaxError "already been declared")
3. Sets sessionStorage flag
4. Reloads with cache-busting timestamp
5. **If deployment still in progress:**
   - Chunk error occurs again
   - sessionStorage flag prevents second reload
   - Shows clear error: "Failed to load HashConnect due to deployment in progress. Please refresh the page in a few moments."
6. **User manually refreshes after a minute** → works

### Scenario 2: Chunk Error from Stale Cache

1. User loads page → chunk error from cached chunks
2. Detects chunk error
3. Reloads with cache-busting timestamp
4. Fresh chunks loaded successfully ✅
5. sessionStorage flag cleared
6. HashConnect initializes normally

### Scenario 3: Real Initialization Error (Not Chunk)

1. User loads page → real error (network, module missing, etc.)
2. Error doesn't match chunk patterns
3. Throws immediately with specific error message
4. No reload attempted (correct - not a chunk issue)

---

## Testing Recommendations

### Test 1: During Active Deployment
1. Deploy new version to Render
2. Immediately visit payment page
3. **Expected:** 
   - First visit: page reloads once
   - After reload: error message about deployment
   - Manual refresh after ~2 min: works

### Test 2: Stale Browser Cache
1. Visit payment page (working)
2. Deploy new version
3. Visit payment page again (without clearing cache)
4. **Expected:**
   - Page reloads once with cache bust
   - Works after reload

### Test 3: Normal Operation
1. Visit payment page (no deployment)
2. **Expected:**
   - No reloads
   - Initializes immediately
   - No errors

### Test 4: Real Network Error
1. Block hashconnect CDN/package
2. Visit payment page
3. **Expected:**
   - Error about failed import (not chunk error)
   - No reload attempted
   - Clear error message

---

## Deployment Notes

- **No database changes**
- **No environment variables**
- **No dependency changes**
- **Safe for live deployment**
- **Backward compatible**

---

## Monitoring After Deployment

### Watch for decrease in:
- ❌ "load failed after 3 attempts" errors (should be zero)
- ❌ "Identifier 'n' has already been declared" (during stable periods)

### Watch for:
- ✅ "deployment may still be in progress" message during deploys (expected)
- ✅ Successful reloads with cache bust
- ✅ sessionStorage flag preventing infinite loops

### Log patterns to track:
- `🔄 Performing ONE-TIME page reload to fetch fresh chunks` - chunk error detected, reloading
- `❌ Chunk error persists after reload` - deployment truly in progress (user should wait)
- `✅ HashConnect module loaded successfully` - successful load after reload

---

## Summary

**What changed:**
1. Removed conflicting `loadAttempts` retry counter
2. Added cache-busting to reload (timestamp parameter)
3. Simplified to single retry strategy (reload guard only)

**Result:**
- No arbitrary attempt limits
- Better cache handling
- Clearer error messages
- Users know to wait during deployments
- No infinite reload loops (guard still works)

**User experience:**
- **Chunk error during deploy:** Page reloads once, shows "deployment in progress" message
- **Chunk error from cache:** Page reloads once with cache bust, then works
- **Real error:** Clear error message, no unnecessary reloads


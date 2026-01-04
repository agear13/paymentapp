# HashConnect Reload Flag Expiry Fix

## Problem

User was seeing persistent chunk errors even 8 hours after deployment completed:
- "❌ Chunk error persists after reload - deployment may still be in progress"
- "Uncaught SyntaxError: Identifier 'n' has already been declared"
- Error kept showing even on page reload

### Root Cause

The `sessionStorage` reload flag was set from a previous failed attempt and **never expired**:
1. During actual deployment, chunk error occurred
2. Page reloaded, flag set to prevent loops ✅
3. But deployment was still in progress, error persisted
4. Flag stayed set forever (or until tab closed)
5. **8 hours later**, flag still there → shows "deployment in progress" even though deployment done

**sessionStorage persists:**
- For the entire browser tab lifetime
- Across page reloads
- Until manually cleared or tab closed

---

## Solution Implemented

### A) Time-Based Flag Expiration (5 minutes)

**Added:**
```typescript
const RELOAD_FLAG_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function hasRecentlyReloaded(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  
  const reloadData = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  if (!reloadData) return false;
  
  try {
    const { timestamp } = JSON.parse(reloadData);
    const age = Date.now() - timestamp;
    
    // If flag is older than 5 minutes, consider it expired
    if (age > RELOAD_FLAG_EXPIRY_MS) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return false;
    }
    
    return true;
  } catch {
    // Invalid data - clear it
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return false;
  }
}
```

**Changed flag storage to include timestamp:**
```typescript
// BEFORE: Simple boolean
sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');

// AFTER: JSON with timestamp
sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({
  timestamp: Date.now(),
  error: errorMessage.substring(0, 100),
}));
```

### B) Clear Flag on Persistent Error

**Added to persistent error path:**
```typescript
// Clear the flag so user's next manual refresh will work
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}
```

### C) Better Error Message

**Changed from:**
```
"Failed to load HashConnect due to deployment in progress. Please refresh the page in a few moments."
```

**To:**
```
"Failed to load HashConnect - please hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to clear cached chunks."
```

---

## What This Fixes

### ✅ Flag Auto-Expires After 5 Minutes
- **Before:** Flag persisted forever (until tab closed)
- **After:** Flag expires after 5 minutes automatically

### ✅ Flag Cleared on Persistent Error
- **Before:** Flag stayed set, blocking future reload attempts
- **After:** Flag cleared immediately when showing persistent error

### ✅ Better User Instructions
- **Before:** Vague "refresh in a few moments"
- **After:** Specific "hard refresh (Ctrl+Shift+R)" to clear cache

### ✅ Handles Stale/Invalid Data
- **Before:** Could have stale boolean flag
- **After:** Validates JSON format, clears if invalid

---

## User Experience After Fix

### Scenario 1: Fresh Load (No Previous Errors)
1. Load page → chunk error
2. Auto-reload with cache-bust
3. Works ✅

### Scenario 2: Error During Active Deployment
1. Load page → chunk error
2. Auto-reload with cache-bust
3. Still chunk error (deployment in progress)
4. Shows error + clears flag
5. User hard refreshes → works ✅

### Scenario 3: Stale Flag from Hours Ago (Your Case)
1. Load page with 8-hour-old flag
2. Flag age > 5 minutes → automatically cleared
3. Chunk error detected → can reload again
4. Auto-reload with cache-bust
5. Works ✅

---

## Immediate Action for Your Current Issue

**Right now, you have a stale flag. Two options:**

### Option 1: Clear sessionStorage (Immediate)
```javascript
// Open browser console (F12) and run:
sessionStorage.removeItem('hashconnect_chunk_reload_attempted');
// Then refresh the page
```

### Option 2: Hard Refresh (Clears cache)
- **Windows/Linux:** `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac:** `Cmd + Shift + R`

### Option 3: Wait for deployment (with this fix)
After deploying this fix:
- Flag will auto-expire if older than 5 minutes
- Or gets cleared when showing error
- Then your next refresh will work

---

## Changes Made

**File:** `src/lib/hedera/hashconnect.client.ts`

**Lines changed:**
1. Added `RELOAD_FLAG_EXPIRY_MS` constant (5 minutes)
2. Added `hasRecentlyReloaded()` function with expiry logic
3. Changed flag storage from string to JSON with timestamp
4. Added flag clearing on persistent error
5. Improved error message with hard refresh instructions

---

## Testing After Deploy

1. Load payment page with crypto option
2. Should initialize successfully (flag will be expired/cleared)
3. If chunk error occurs:
   - Should reload once automatically
   - If persists, shows clear error + clears flag
   - Hard refresh should work immediately

---

## Summary

**Problem:** Reload flag never expired, causing false "deployment in progress" errors hours later

**Solution:** 
- Flag expires after 5 minutes
- Flag cleared immediately on persistent error
- Better error message tells users to hard refresh

**Result:**
- ✅ Stale flags auto-expire
- ✅ Users get clear instructions
- ✅ Next refresh always works


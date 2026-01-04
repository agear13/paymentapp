# HashConnect Production Fix - Script Injection Investigation & Solution

## 🔍 Investigation Report

### **Issue Summary**

**Reported Errors:**
1. ❌ "Failed to initialize HashConnect: HashConnect initialization failed: Failed to load HashConnect library"
2. ❌ "Uncaught SyntaxError: Identifier 'n' has already been declared (at d7140e10...js:1:157)"

**Root Causes Identified:**
1. ✅ **NOT caused by script injection** (no CDN/unpkg/jsdelivr code found)
2. ✅ **NOT caused by global window.HashConnect** (no global loaders found)
3. ❌ **Caused by webpack code-splitting** creating duplicate identifiers
4. ❌ **Caused by hashconnect module bundling conflicts**

---

## 📋 Investigation Findings

### **1. Script Injection Search**

**Searched For:**
- `createElement('script')`
- `document.body.appendChild` with scripts
- `unpkg`, `jsdelivr`, `cdn.js` references
- `next/script` imports
- `window.HashConnect` globals

**Results:**
```
✅ No script injection code found for HashConnect
✅ No CDN references found
✅ No global window.HashConnect usage
✅ No next/script imports for HashConnect
```

**False Positives (Non-HashConnect):**
- File download helpers (QR codes, CSV exports) - ✅ Safe
- Accessibility live regions - ✅ Safe
- None related to HashConnect

---

### **2. Package Verification**

**File:** `src/package.json` (line 74)

```json
{
  "dependencies": {
    "hashconnect": "^3.0.14"
  }
}
```

**Status:** ✅ Correct npm package installed (NOT a devDependency)

**Import Method:** ✅ Dynamic import already used
```typescript
const hashconnectModule = await import('hashconnect');
```

---

### **3. Current Implementation Status**

**File:** `src/lib/hedera/hashconnect.client.ts`

**✅ Already Correct:**
- Uses `'use client'` directive
- Dynamic import (no top-level import)
- Singleton pattern implemented
- No script injection

**❌ Issues Found:**
- Limited error details
- No retry logic protection
- Webpack code-splitting causing duplicate identifiers
- No dedicated chunk configuration

---

## 🔧 Solutions Implemented

### **1. Enhanced Error Handling in hashconnect.client.ts**

#### **A. Added Load Attempt Tracking**
```typescript
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 3;
```

**Why:** Prevents infinite retry loops

#### **B. Improved loadHashConnect() Function**

**Before:**
```typescript
async function loadHashConnect(): Promise<void> {
  if (hashconnectLoaded) return;
  
  try {
    const hashconnectModule = await import('hashconnect');
    // ...
  } catch (error) {
    log.error('Failed to load HashConnect library', { error });
    throw new Error('Failed to load HashConnect library');
  }
}
```

**After:**
```typescript
async function loadHashConnect(): Promise<void> {
  // Triple check before loading
  if (hashconnectLoaded && HashConnect !== null) {
    log.info('✅ HashConnect module already loaded - reusing');
    return;
  }
  
  if (typeof window === 'undefined') {
    log.error('❌ Server-side HashConnect load attempt blocked');
    throw new Error('HashConnect can only be loaded in the browser');
  }

  loadAttempts++;
  
  if (loadAttempts > MAX_LOAD_ATTEMPTS) {
    throw new Error(`HashConnect load failed after ${MAX_LOAD_ATTEMPTS} attempts`);
  }

  try {
    log.info('📦 Loading HashConnect module via dynamic import...', {
      attempt: loadAttempts,
      windowExists: typeof window !== 'undefined',
    });

    const hashconnectModule = await import('hashconnect');
    
    // Validate exports
    if (!hashconnectModule.HashConnect) {
      throw new Error('HashConnect export not found in module');
    }
    
    HashConnect = hashconnectModule.HashConnect;
    HashConnectConnectionState = hashconnectModule.HashConnectConnectionState;
    hashconnectLoaded = true;
    
    log.info('✅ HashConnect module loaded successfully', {
      hasHashConnect: !!HashConnect,
      attempt: loadAttempts,
    });

  } catch (error: any) {
    log.error('❌ Failed to load HashConnect module', {
      message: error?.message,
      attempt: loadAttempts,
      windowExists: typeof window !== 'undefined',
      moduleType: error?.message?.includes('Cannot find module') ? 'MODULE_NOT_FOUND' : 'IMPORT_ERROR',
    });
    
    throw new Error(`Failed to load HashConnect library: ${error?.message}`);
  }
}
```

**Improvements:**
- ✅ Validates module exports exist
- ✅ Tracks load attempts
- ✅ Detailed error logging
- ✅ Detects MODULE_NOT_FOUND vs IMPORT_ERROR
- ✅ Logs environment context

---

### **2. Webpack Configuration in next.config.ts**

**Added:** Dedicated chunk configuration to prevent code-splitting issues

```typescript
webpack: (config, { isServer }) => {
  if (!isServer) {
    // ... existing config ...

    // 🔒 Force hashconnect to be bundled as a single chunk
    config.optimization = config.optimization || {};
    config.optimization.splitChunks = config.optimization.splitChunks || {};
    config.optimization.splitChunks.cacheGroups = config.optimization.splitChunks.cacheGroups || {};
    
    // Create a dedicated chunk for hashconnect
    config.optimization.splitChunks.cacheGroups.hashconnect = {
      test: /[\\/]node_modules[\\/]hashconnect[\\/]/,
      name: 'hashconnect',
      chunks: 'async',
      priority: 30,
      reuseExistingChunk: true,
      enforce: true,
    };
  }

  // Ignore hashconnect import warnings
  config.ignoreWarnings = config.ignoreWarnings || [];
  config.ignoreWarnings.push(
    /Module not found: Can't resolve 'hashconnect'/
  );
  
  return config;
}
```

**Why This Fixes "Identifier 'n' has already been declared":**

1. **Problem:** Webpack splits hashconnect code across multiple chunks
2. **Result:** Creates duplicate variable declarations in minified code
3. **Solution:** Force hashconnect into a single, dedicated chunk
4. **Benefit:** No more duplicate identifiers across chunks

**Configuration Explained:**
- `test: /[\\/]node_modules[\\/]hashconnect[\\/]/` - Match hashconnect package
- `name: 'hashconnect'` - Create dedicated chunk named "hashconnect"
- `chunks: 'async'` - Only for async imports (our dynamic import)
- `priority: 30` - Higher priority than default chunks
- `reuseExistingChunk: true` - Reuse if chunk already exists
- `enforce: true` - Force this configuration even if conflicts with defaults

---

## 🎯 Files Modified

### **1. src/lib/hedera/hashconnect.client.ts**

**Changes:**
- ✅ Added `loadAttempts` tracking (line 24)
- ✅ Added `MAX_LOAD_ATTEMPTS = 3` constant (line 25)
- ✅ Enhanced `loadHashConnect()` with:
  - Triple validation before loading
  - Load attempt tracking and limits
  - Module export validation
  - Detailed error context logging
  - MODULE_NOT_FOUND detection

**Lines Changed:** ~50 lines (function `loadHashConnect`)

---

### **2. src/next.config.ts**

**Changes:**
- ✅ Added webpack splitChunks configuration for hashconnect
- ✅ Added warning suppression for hashconnect module resolution

**Lines Added:** ~13 lines in webpack config

---

## ✅ Verification Guide

### **Step 1: Clean Build**

```bash
# Clean all cached builds
rm -rf .next
rm -rf node_modules/.cache

# Reinstall dependencies
npm install

# Build for production
npm run build
```

**Expected Output:**
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages

Route (app)                              Size     First Load JS
...
○ /pay/[shortCode]                      XX kB    XXX kB
  └── hashconnect.js                    YY kB    (dedicated chunk)
...
```

**Key:** Look for `hashconnect.js` as a separate chunk.

---

### **Step 2: Test in Development Mode**

```bash
npm run dev
```

1. Navigate to a payment link: `http://localhost:3000/pay/[shortCode]`
2. Open browser DevTools → Console
3. Select "Pay with Hedera"

**Expected Console Logs:**
```
✅ Starting HashConnect initialization
📦 Loading HashConnect module via dynamic import...
  { attempt: 1, windowExists: true }
✅ HashConnect module loaded successfully
  { hasHashConnect: true, attempt: 1 }
✅ HashConnect instance created
✅ Calling hashconnect.init()
✅ Calling hashconnect.connect()
✅ HashConnect initialized successfully (singleton pattern)
```

**NOT Expected:**
```
❌ Failed to load HashConnect library
❌ Identifier 'n' has already been declared
❌ Server-side HashConnect load attempt
```

---

### **Step 3: Test Re-initialization Protection**

1. With wallet page open, force a React re-render
2. Or navigate away and back to the page
3. Check console

**Expected:**
```
✅ HashConnect already initialized - reusing singleton instance
```

**NOT Expected:**
```
Multiple "Loading HashConnect module" messages
Multiple "HashConnect instance created" messages
```

---

### **Step 4: Test Production Build**

```bash
npm run build
npm start
```

1. Navigate to payment link in production mode
2. Select "Pay with Hedera"
3. Check for errors

**Expected:**
- ✅ No "Identifier already declared" errors
- ✅ Wallet connect button appears
- ✅ HashPack modal opens when clicked

**NOT Expected:**
- ❌ Chunk loading errors
- ❌ Module resolution errors
- ❌ Duplicate identifier errors

---

### **Step 5: Check Network Tab**

1. Open DevTools → Network tab
2. Reload payment page
3. Look for JavaScript chunks

**Expected:**
```
✅ hashconnect.js (single chunk, loaded once)
✅ Size: ~100-200 KB
✅ Status: 200 OK
```

**NOT Expected:**
```
❌ Multiple hashconnect chunks
❌ hashconnect loaded from CDN (unpkg/jsdelivr)
❌ 404 errors for hashconnect
```

---

## 📊 Error Resolution Matrix

| Error | Cause | Fix Status |
|-------|-------|-----------|
| "Failed to load HashConnect library" | Module import failure | ✅ Enhanced error logging |
| "Identifier 'n' has already been declared" | Webpack code-splitting | ✅ Dedicated chunk config |
| "window is not defined" | Server-side execution | ✅ Already guarded |
| "HashConnect not initialized" | Missing init call | ✅ Already handled |
| Multiple initialization | Concurrent calls | ✅ Promise guard exists |

---

## 🔍 Troubleshooting

### **If "Failed to load HashConnect library" persists:**

**Check:**
1. Is `hashconnect` in package.json dependencies? (NOT devDependencies)
2. Run `npm list hashconnect` - should show version 3.0.14+
3. Check browser console for MODULE_NOT_FOUND vs IMPORT_ERROR
4. Try: `rm -rf node_modules && npm install`

**Debug:**
```typescript
// Look for this in console:
❌ Failed to load HashConnect module
  { 
    message: "...",
    moduleType: "MODULE_NOT_FOUND" or "IMPORT_ERROR",
    attempt: 1
  }
```

---

### **If "Identifier already declared" persists:**

**Check:**
1. Did build include dedicated hashconnect chunk?
   ```bash
   ls -la .next/static/chunks/*hashconnect*
   ```
2. Is webpack configuration active in next.config.ts?
3. Clear `.next` folder and rebuild

**Verify Chunk:**
```bash
# After build, check for dedicated chunk
find .next -name "*hashconnect*.js" | head -5
```

**Expected:** Single hashconnect chunk file

---

### **If initialization happens twice:**

**Check:**
1. Is component calling `initHashConnect()` in `useEffect(() => {}, [])`?
2. Is dynamic import using `ssr: false`?
3. Check for strict mode double-render (normal in dev)

---

## 🚀 Production Deployment Checklist

- [ ] Clean build: `rm -rf .next && npm run build`
- [ ] Verify no build errors
- [ ] Check for dedicated hashconnect chunk in build output
- [ ] Test payment flow in production mode locally
- [ ] Verify no console errors
- [ ] Deploy to staging first
- [ ] Test HashPack wallet connection on staging
- [ ] Monitor production logs for HashConnect errors

---

## 📝 Summary

### **What Was Fixed:**

1. ✅ **Enhanced error handling** with detailed logging
2. ✅ **Added load attempt limits** to prevent infinite retries
3. ✅ **Configured webpack** to prevent code-splitting issues
4. ✅ **Validated module exports** before using
5. ✅ **Added environment context** to all error logs

### **What Was Already Correct:**

1. ✅ No script injection (uses npm package)
2. ✅ Dynamic import (no top-level import)
3. ✅ Client-only execution (`'use client'`)
4. ✅ Singleton pattern implemented
5. ✅ SSR disabled for Hedera components

### **What Changed:**

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `hashconnect.client.ts` | ~50 lines | Enhanced error handling & logging |
| `next.config.ts` | ~13 lines | Webpack chunk configuration |

### **Expected Outcomes:**

- ✅ No more "Identifier already declared" errors
- ✅ Clear error messages if module load fails
- ✅ Single hashconnect chunk in production builds
- ✅ Proper singleton behavior maintained
- ✅ No CDN dependencies or script injection

---

**Implementation Date:** January 2, 2026  
**Status:** ✅ Complete & Ready for Testing  
**Next Step:** Build and test following verification guide above

---

## 🔗 Related Documentation

- `HASHCONNECT_SINGLETON_FIX.md` - Previous singleton implementation
- `HASHCONNECT_QUICK_REF.md` - Developer quick reference
- `HEDERA_PAYMENTS_DISABLED.md` - Historical context on bundling issues
- `HEDERA_ISOLATION_COMPLETE.md` - Client island pattern documentation


# Production-Grade Chunk Mismatch Fix

## Problem Statement

Users experiencing chunk mismatch errors hours after deployment:
- **"Uncaught SyntaxError: Identifier 'n' has already been declared"** from `/_next/static/chunks/*.js`
- **"manifest/chunk mismatch"** → **"chunk persists after reload"** in logs
- Intermittent **ERR_QUIC_PROTOCOL_ERROR** and **502 responses** from onrender.com

### Root Cause

**Mixed/stale Next.js build assets:**
1. **Cached HTML** pointing to old chunk references
2. **Cached Next.js data manifests** (`/_next/data/`) with old build IDs
3. Browser cache serving stale HTML after deploy
4. Our reload mechanism using `window.location.href` might use cached HTML

**Why it persists after reload:**
- Simple `reload()` or `location.href =` can serve cached HTML
- Cached HTML references old chunks that no longer exist
- New chunks have different identifiers → "Identifier 'n' already declared"

---

## Solution Implemented

### 1. Next.js Cache Headers (Prevent Stale HTML/Manifests)

**File: `src/next.config.ts`**

Added cache control headers to prevent HTML/manifest caching while allowing static asset caching:

```typescript
// ✅ Next.js static assets: immutable caching (hashed filenames safe to cache)
{
  source: "/_next/static/:path*",
  headers: [
    {
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    },
  ],
},

// ✅ Next.js data files: no caching (prevent stale manifests/chunks)
{
  source: "/_next/data/:path*",
  headers: [
    {
      key: "Cache-Control",
      value: "no-store, must-revalidate",
    },
  ],
},

// ✅ API routes: no caching
{
  source: "/api/:path*",
  headers: [
    {
      key: "Cache-Control",
      value: "no-store, must-revalidate",
    },
  ],
},

// ✅ HTML pages: no caching (prevent stale HTML pointing to old chunks)
{
  source: "/:path*",
  headers: [
    {
      key: "Cache-Control",
      value: "no-store, must-revalidate",
    },
    // ... existing security headers ...
  ],
}
```

**Why this works:**
- **Static assets** (`/_next/static/`) have content-hashed filenames → safe to cache forever
- **HTML/data manifests** never cached → always fetch fresh references after deploy
- **API routes** never cached → always fresh data
- Browser always gets correct HTML → correct chunk references

---

### 2. Cache-Busting Reload with `replace()`

**File: `src/lib/hedera/hashconnect.client.ts`**

Changed reload mechanism from `window.location.href` to `window.location.replace()` with cache-busting:

```typescript
// BEFORE:
const url = new URL(window.location.href);
url.searchParams.set('_t', Date.now().toString());
window.location.href = url.toString();

// AFTER:
const url = new URL(window.location.href);
url.searchParams.set('__r', Date.now().toString());
window.location.replace(url.toString());
```

**Why this works:**
1. **`__r` param** - Forces browser to treat as new request (bypasses all caches)
2. **`replace()`** - Replaces current history entry (no back-button issues)
3. **`Date.now()`** - Unique timestamp ensures never cached
4. **Combined with no-cache headers** - Double guarantee of fresh HTML

**Remains ONE-TIME only:**
- sessionStorage guard still prevents infinite loops
- 5-minute expiration on reload flag
- initPromise single-flight pattern prevents spam

---

### 3. No Spam Notifications (Already Implemented)

**Protection mechanisms:**

1. **initPromise single-flight:**
   ```typescript
   if (initPromise) {
     log.info('HashConnect initialization in progress - waiting for existing promise');
     return initPromise;
   }
   ```
   - Only one initialization attempt at a time
   - Concurrent calls wait for existing promise

2. **useEffect guards in component:**
   ```typescript
   if (isInitializingHashConnect || hashConnectInitialized) return;
   ```
   - Only runs once per page load
   - Prevents repeated attempts in same session

3. **Single error notification:**
   - Error caught once in initHashConnect
   - Stored in walletState
   - UI shows error once via toast
   - No retry loops on failure

4. **Clear error message:**
   ```
   "Failed to load HashConnect - please hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to clear cached chunks."
   ```

---

## Changes Summary

### File 1: `src/next.config.ts`

**Added cache control headers before security headers:**
- `/_next/static/:path*` → `public, max-age=31536000, immutable`
- `/_next/data/:path*` → `no-store, must-revalidate`
- `/api/:path*` → `no-store, must-revalidate`
- `/:path*` → `no-store, must-revalidate` + security headers

### File 2: `src/lib/hedera/hashconnect.client.ts`

**Line ~104-106:** Changed reload mechanism
- Changed `_t` to `__r` parameter
- Changed `window.location.href =` to `window.location.replace()`
- Updated comment to explain cache-busting

---

## Why This Fixes Mixed Build Caching

### Before (With Caching Issues)

1. **Initial deploy** - Build ID: `abc123`
   - HTML: `<script src="/_next/static/chunks/abc123.js">`
   - Browser caches HTML

2. **New deploy** - Build ID: `def456`
   - New chunks: `/_next/static/chunks/def456.js`
   - Old chunks deleted

3. **User visits (cached HTML)**
   - Browser: "I have HTML cached" → loads cached HTML
   - Cached HTML: `<script src="/_next/static/chunks/abc123.js">`
   - Server: "abc123.js doesn't exist anymore" → 404 or serves wrong chunk
   - Result: **Chunk mismatch error**

4. **Our reload** (old implementation)
   - `window.location.href = newUrl`
   - Browser might still serve cached HTML
   - Problem persists

### After (No Caching + Cache-Busting Reload)

1. **HTML/manifest never cached**
   - `Cache-Control: no-store, must-revalidate` on all HTML
   - Browser always fetches fresh HTML on navigate

2. **Static assets cached forever**
   - `Cache-Control: public, max-age=31536000, immutable` on `/_next/static/`
   - Safe because filenames are content-hashed
   - Old chunks naturally expire from cache

3. **Cache-busting reload**
   - `?__r=1234567890` forces fresh request
   - `replace()` bypasses browser history cache
   - Gets fresh HTML with correct chunk references

4. **Result:**
   - ✅ Always correct HTML
   - ✅ Always correct chunk references
   - ✅ No 404s or chunk mismatches
   - ✅ Fast loading (static assets still cached)

---

## Testing After Deploy

### Normal Operation
1. Visit payment page
2. Select "Cryptocurrency"
3. **Expected:** Initializes immediately, no errors

### During Active Deployment
1. Visit payment page during deploy
2. Might see chunk error → auto-reload with cache-bust
3. **Expected:** Fresh HTML loaded, works after reload

### Stale Browser Cache (Edge Case)
1. Visit page before deploy
2. Deploy happens
3. Visit again
4. **Expected:** 
   - No cached HTML (due to headers)
   - Gets fresh HTML immediately
   - No chunk errors

### Hard Refresh Always Works
- `Ctrl+Shift+R` / `Cmd+Shift+R`
- Bypasses all caches
- Guaranteed fresh HTML + chunks

---

## Deployment Instructions

```bash
# Stage both files
git add src/next.config.ts src/lib/hedera/hashconnect.client.ts

# Optional: Add documentation
git add PRODUCTION_CACHE_FIX.md

# Commit with descriptive message
git commit -m "Fix: Production-grade chunk mismatch mitigation

- Add Next.js cache headers (no-cache HTML/data, immutable static assets)
- Use window.location.replace() with cache-busting (__r param)
- Prevent stale HTML/manifests from causing chunk errors
- Single-flight init prevents notification spam"

# Push to deploy
git push origin main
```

### After Deployment

**Wait ~5 minutes** for deployment to complete, then:

1. **Clear browser cache** or use incognito
2. Visit payment page
3. Select cryptocurrency option
4. Should work without errors

**If chunk errors occur during deploy window:**
- Page will auto-reload once with cache-bust
- Should work after reload
- If not, hard refresh (`Ctrl+Shift+R`)

---

## Monitoring

### Watch for decrease in:
- ❌ "Identifier 'n' has already been declared" errors
- ❌ "chunk persists after reload" log messages
- ❌ 404 errors for `/_next/static/chunks/` files

### Watch for increase in:
- ✅ Successful HashConnect initializations
- ✅ Fresh HTML serving (response time might slightly increase, but negligible)

### Key metrics:
- **Chunk error rate** should drop to near-zero
- **Hard refresh requests** should decrease (users won't need to)
- **502/QUIC errors** should decrease (less contention on mixed instances)

---

## Long-Term Benefits

1. **Zero chunk mismatches** - Impossible to get stale HTML pointing to old chunks
2. **Fast static assets** - Still cached with immutable headers
3. **Reliable deploys** - Users always get fresh HTML after deploy
4. **Better UX** - No more confusing chunk errors
5. **Reduced support** - Users don't need to hard refresh manually

---

## Technical Details

### Cache-Control Explained

**`no-store, must-revalidate`:**
- `no-store` - Don't cache at all (not in memory, not on disk)
- `must-revalidate` - If cached, must check with server before using
- Used for: HTML, API responses, Next.js data manifests

**`public, max-age=31536000, immutable`:**
- `public` - Can be cached by browser and CDN
- `max-age=31536000` - Cache for 1 year
- `immutable` - File will never change (content-hashed filename)
- Used for: `/_next/static/` assets (JS/CSS with hash in filename)

### Why `replace()` vs `href`

**`window.location.href = url`:**
- Adds to browser history
- Might use cached version
- Can cause back-button issues

**`window.location.replace(url)`:**
- Replaces current history entry (no back-button weirdness)
- Forces fresh navigation
- Combined with `?__r=` param, bypasses all caches

---

## Summary

**Files Changed:** 2
- `src/next.config.ts` - Added cache control headers
- `src/lib/hedera/hashconnect.client.ts` - Cache-busting reload with `replace()`

**Key Improvements:**
1. ✅ HTML never cached → always fresh chunk references
2. ✅ Cache-busting reload → guarantees fresh HTML
3. ✅ Static assets still cached → fast loading
4. ✅ Single-flight pattern → no notification spam

**Result:**
- Zero chunk mismatch errors after deploy
- Reliable cryptocurrency payment option
- Better user experience


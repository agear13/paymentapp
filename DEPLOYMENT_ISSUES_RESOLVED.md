# Deployment Issues - Diagnosis & Fixes

## Issues Found

### Issue 1: Missing `/auth/signup` Route ❌
**Error**: `GET https://provvypay-api.onrender.com/auth/signup 404`

**Root Cause**: Your app doesn't have a signup page. Signup is handled on the `/auth/login` page, but something is trying to navigate to `/auth/signup`.

**Fix Applied**: ✅ Created `src/app/auth/signup/page.tsx` that redirects to `/auth/login`

### Issue 2: Wrong Domain for Routes ❌
**Error**: `GET https://provvypay-api.onrender.com/payment-links?_rsc=a0eu7 404`

**Root Cause**: Your Next.js app is trying to fetch pages from your API domain instead of serving them internally.

**Fix Needed**: Update production environment variable on Render

## Fixes to Apply

### ✅ Fix 1: Signup Redirect (Already Done)
I've created `src/app/auth/signup/page.tsx` that redirects users to `/auth/login` where signup actually happens.

**Action**: Commit and deploy this new file.

### 🔧 Fix 2: Environment Variables on Render

**Go to Render Dashboard:**

1. Open your **Frontend Service** (the Next.js app)
2. Click "Environment" tab
3. Find or add these variables:

```bash
# THIS IS THE CRITICAL FIX - Must point to your FRONTEND, not API
NEXT_PUBLIC_APP_URL=https://your-nextjs-app.onrender.com

# NOT this (wrong):
# NEXT_PUBLIC_APP_URL=https://provvypay-api.onrender.com
```

**What this fixes:**
- Routes will be fetched from correct domain
- Payment links page will load correctly
- Auth flows will work

### 🚀 Fix 3: Deploy Both Changes

```bash
# Commit the new signup redirect page
git add src/app/auth/signup/page.tsx
git commit -m "Add signup redirect to fix 404"
git push
```

Render will auto-deploy, or trigger manual deploy.

## Why This Happened

1. **Missing Signup Page**: Common architectural choice to combine login/signup, but need redirect for direct navigation
2. **Wrong Domain**: Production `NEXT_PUBLIC_APP_URL` was set to API domain instead of frontend domain

## Testing After Deploy

### 1. Test Signup Redirect
Visit: `https://your-app.onrender.com/auth/signup`
- Should redirect to `/auth/login`
- Should NOT show 404

### 2. Test Payment Links
1. Log in with your email: `alishajayne13@gmail.com`
2. Navigate to Payment Links
3. Table should show your existing payment links
4. Should NOT be empty

### 3. Check Browser Console
Open DevTools → Console
- Should be NO red errors
- Should NOT see requests to `provvypay-api.onrender.com` for page routes

### 4. Check Network Tab
Open DevTools → Network tab
- Refresh payment links page
- Look for `/api/payment-links` request
- Should be to YOUR app domain, not API domain
- Should return 200 with data

## Environment Variable Checklist

Your **Frontend Service** on Render should have:

```bash
# App URL (CRITICAL - must be your frontend URL)
NEXT_PUBLIC_APP_URL=https://your-nextjs-app.onrender.com

# Supabase (for auth & database)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...

# Database
DATABASE_URL=postgresql://...

# Stripe (if using)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Other vars as needed...
```

## What URLs Should Point Where

| Environment Variable | Should Point To | Example |
|---------------------|----------------|---------|
| `NEXT_PUBLIC_APP_URL` | Your Next.js app | `https://provvypay.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project | `https://xxxxx.supabase.co` |
| `DATABASE_URL` | Your database | `postgresql://...` |

**DO NOT** set `NEXT_PUBLIC_APP_URL` to:
- ❌ `https://provvypay-api.onrender.com` (API domain)
- ❌ `http://localhost:3000` (local dev)
- ❌ Wrong/missing value

## Understanding Your Architecture

Based on your codebase, you have:

1. **One Next.js App** that includes:
   - Frontend pages (`/auth/login`, `/dashboard`, etc.)
   - API routes (`/api/payment-links`, `/api/user/organization`, etc.)
   - All served from ONE domain

2. **Possibly a Separate API** at `provvypay-api.onrender.com`
   - But your Next.js app should NOT fetch its own pages from there
   - Only use that domain if you have separate backend services

## If Payment Links Still Empty After Fix

If environment variables are correct but table is still empty:

### Check 1: Organization ID
```javascript
// In browser console:
localStorage.getItem('provvypay.organizationId')
```
Should return a UUID. If `null`, log out and back in.

### Check 2: API Call
```javascript
// In browser console (replace ORG_ID):
fetch('/api/payment-links?organizationId=YOUR_ORG_ID')
  .then(r => r.json())
  .then(d => console.log(d))
```
Should return your payment links data.

### Check 3: Database
Your payment links ARE in the database. This is a frontend loading issue.

## Deployment Steps Summary

1. ✅ **Signup redirect created** - Already done
2. 🔧 **Fix environment variables** - Update on Render
3. 🚀 **Deploy changes** - Commit, push, or manual deploy
4. ⏱️ **Wait** - Deploy takes ~5 minutes
5. ✅ **Test** - Visit site, check console, test payment links

## Common Questions

**Q: Will this affect my existing data?**
A: No. Your payment links data is safe in the database. This only fixes how the frontend loads it.

**Q: Why did this happen now?**
A: The Platform Preview module didn't cause this. This was a pre-existing deployment configuration issue that surfaced when testing.

**Q: Do I need two domains?**
A: Only if you have a separate backend service. Based on your Next.js structure, everything should be on one domain.

**Q: Can I test locally first?**
A: Yes! The signup redirect works locally. Just navigate to `http://localhost:3000/auth/signup` and it will redirect to login.

## Success Criteria

After applying both fixes:
- ✅ No 404 errors in console
- ✅ `/auth/signup` redirects to `/auth/login`
- ✅ Payment links table loads with your data
- ✅ All routes fetch from correct domain
- ✅ No requests to `provvypay-api.onrender.com` for page routes

## Still Having Issues?

Provide:
1. Screenshot of Render environment variables (hide sensitive values)
2. Your frontend service URL
3. Screenshot of browser console errors (if any)
4. Does `/auth/login` work correctly?
5. Can you see your email in the sidebar when logged in?

---

**Next Actions:**
1. Commit the new `signup/page.tsx` file
2. Update `NEXT_PUBLIC_APP_URL` on Render
3. Deploy and wait
4. Test with your account

This should completely resolve both 404 errors! 🎉


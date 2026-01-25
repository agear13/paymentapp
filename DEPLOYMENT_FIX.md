# Deployment 404 Fix - Render Configuration

## Problem

Your Next.js app is trying to fetch pages from `provvypay-api.onrender.com` which returns 404 because:
- That domain is for your backend API
- Next.js pages should be served from your Next.js deployment URL

## Root Cause

**Environment variable misconfiguration**: `NEXT_PUBLIC_APP_URL` is probably set to the API domain instead of the frontend domain.

## Solution

### Step 1: Check Your Render Services

You likely have TWO services on Render:
1. **Frontend (Next.js app)** - e.g., `provvypay-frontend.onrender.com` or `app.provvypay.com`
2. **Backend API** - `provvypay-api.onrender.com`

### Step 2: Fix Environment Variables

Go to your **Next.js Frontend service** on Render:

1. Click on your frontend service
2. Go to "Environment" tab
3. Find `NEXT_PUBLIC_APP_URL`
4. It should be set to your **FRONTEND** URL, not the API URL

#### ❌ Wrong Configuration:
```bash
NEXT_PUBLIC_APP_URL=https://provvypay-api.onrender.com
```

#### ✅ Correct Configuration:
```bash
# If using Render's default domain:
NEXT_PUBLIC_APP_URL=https://provvypay-frontend.onrender.com

# OR if using custom domain:
NEXT_PUBLIC_APP_URL=https://app.provvypay.com
```

### Step 3: Set API URL (if needed)

If your app needs to call a separate backend API, you should have a DIFFERENT environment variable for that:

```bash
# Frontend URL (where Next.js is hosted)
NEXT_PUBLIC_APP_URL=https://your-nextjs-app.onrender.com

# Backend API URL (if you have a separate backend)
NEXT_PUBLIC_API_URL=https://provvypay-api.onrender.com
# OR
API_BASE_URL=https://provvypay-api.onrender.com
```

### Step 4: Verify Other Critical Env Vars

Make sure these are also set correctly in your **frontend service**:

```bash
# Supabase (for auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (connection from frontend server)
DATABASE_URL=postgresql://user:password@host:port/database

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Hedera
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=...
NEXT_PUBLIC_HEDERA_NETWORK=mainnet
```

### Step 5: Redeploy

After fixing environment variables:
1. Save changes
2. Render will auto-redeploy
3. Wait for deployment to complete (~5 minutes)
4. Test again

## Understanding the Architecture

### Next.js App Structure

Your Next.js app includes BOTH:
- **Frontend pages** (`/auth/signup`, `/payment-links`) - served by Next.js
- **API routes** (`/api/payment-links`, `/api/user/organization`) - also served by Next.js

**All of these should be on the SAME domain** (your Next.js deployment).

### When You Need Separate API Domain

You only need `provvypay-api.onrender.com` if you have a SEPARATE backend service (Express, FastAPI, etc.) that's NOT part of Next.js.

Based on your project structure, your API routes are INSIDE Next.js (`src/app/api/`), so everything should be on ONE domain.

## Common Render Deployment Mistakes

### Mistake 1: Wrong Service Type
- ✅ **Correct**: "Web Service" for Next.js
- ❌ **Wrong**: "Static Site" (doesn't support API routes)

### Mistake 2: Wrong Build Command
```bash
# ✅ Correct (based on your package.json):
npm run build

# ❌ Wrong:
next build
npm run start
```

### Mistake 3: Wrong Start Command
```bash
# ✅ Correct:
npm run start

# ❌ Wrong:
next start
node server.js
```

### Mistake 4: Wrong Root Directory
```bash
# ✅ Correct (your repo structure):
Root Directory: src

# ❌ Wrong:
Root Directory: . (root)
```

## Render Configuration Checklist

Go to your **frontend service** settings and verify:

### General Tab
- [ ] **Name**: Something like `provvypay-frontend` (not api)
- [ ] **Environment**: `Node`
- [ ] **Region**: Your preferred region
- [ ] **Branch**: `main` or `master`
- [ ] **Root Directory**: `src`

### Build & Deploy Tab
- [ ] **Build Command**: `npm run build`
- [ ] **Start Command**: `npm run start`
- [ ] **Auto-Deploy**: `Yes` (optional)

### Environment Tab
Critical variables:
- [ ] `NEXT_PUBLIC_APP_URL` = YOUR FRONTEND URL (not API URL)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Your Supabase anon key
- [ ] `DATABASE_URL` = Your database connection string
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase service role key
- [ ] `NODE_ENV` = `production`

Optional (if using):
- [ ] `STRIPE_SECRET_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `HEDERA_ACCOUNT_ID`
- [ ] `HEDERA_PRIVATE_KEY`
- [ ] etc.

## Testing After Deploy

### 1. Check Environment in Browser Console

Visit your deployed app and open console, then type:
```javascript
console.log(window.location.origin)
// Should be your frontend URL, not API URL
```

### 2. Check API Routes

Try hitting an API route directly:
```
https://your-frontend-app.onrender.com/api/health
```

Should return a response, not 404.

### 3. Check Page Routes

Try navigating to:
```
https://your-frontend-app.onrender.com/auth/login
https://your-frontend-app.onrender.com/dashboard
```

Should load pages, not 404.

## Still Getting 404s?

### Debug Steps:

1. **Check Render Logs**
   - Go to Render dashboard
   - Click your frontend service
   - Click "Logs" tab
   - Look for errors during build/deploy

2. **Check Build Logs**
   - Look for "Build failed" or compilation errors
   - Ensure all dependencies installed
   - Check for missing environment variables

3. **Check Runtime Logs**
   - After deploy completes
   - Visit your site
   - Watch logs in real-time
   - Look for errors when pages load

4. **Verify Route Files Exist**
   ```
   src/app/auth/login/page.tsx         ✅ Should exist
   src/app/auth/signup/page.tsx        ❓ Check if this exists
   src/app/(dashboard)/dashboard/payment-links/page.tsx  ✅ Should exist
   ```

## If You Have Separate Frontend & Backend

If you intentionally have TWO services:

### Frontend Service (Next.js)
```bash
NEXT_PUBLIC_APP_URL=https://app.provvypay.com
NEXT_PUBLIC_API_URL=https://api.provvypay.com
```

### Backend Service (Express/etc)
```bash
# No NEXT_PUBLIC_ vars needed here
DATABASE_URL=...
# Other backend-only vars
```

Then update your Next.js code to use `NEXT_PUBLIC_API_URL` for backend API calls.

## Quick Diagnosis

Run this in your browser console on the deployed site:

```javascript
// 1. Check where the app thinks it's hosted
console.log('App URL:', window.location.origin);

// 2. Try fetching a page route
fetch('/api/health')
  .then(r => r.json())
  .then(d => console.log('API works:', d))
  .catch(e => console.error('API failed:', e));

// 3. Check env var (if exposed)
console.log('Public vars:', Object.keys(window).filter(k => k.startsWith('NEXT_PUBLIC')));
```

If you see requests going to `provvypay-api.onrender.com` in Network tab, your `NEXT_PUBLIC_APP_URL` is wrong.

## Need More Help?

Please provide:
1. Your **frontend service URL** on Render
2. Your **backend/API service URL** (if separate)
3. Screenshot of your Render Environment variables (hide sensitive values)
4. Do you have ONE service or TWO services on Render?
5. What is your `NEXT_PUBLIC_APP_URL` set to?

---

**TL;DR**: 
1. Go to your Render frontend service
2. Environment tab
3. Set `NEXT_PUBLIC_APP_URL` to your **frontend URL**, not API URL
4. Redeploy
5. Wait 5 minutes
6. Test again


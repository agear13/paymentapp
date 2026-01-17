# 🚨 Fix Payment Issue - Action Required NOW

## What's Wrong

1. **Chunks loading from wrong domain** - Fixed in code ✅
2. **Render backend failing** - Missing environment variables ⚠️

## Fix Steps (Do This Now)

### Step 1: Set Environment Variables on Render (5 minutes)

1. Go to https://dashboard.render.com
2. Click on your `provvypay-api` service
3. Go to **Environment** tab
4. Add these MINIMUM required variables:

```bash
# Critical - Set this to your actual domain!
NEXT_PUBLIC_APP_URL=https://provvypay-api.onrender.com

# Supabase (get from your Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe (your test or live keys)
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... or pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Hedera
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# Security - Generate these!
ENCRYPTION_KEY=your-32-character-random-string-here
```

**Generate encryption key:**
```powershell
# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

5. Click **"Save Changes"**

### Step 2: Redeploy (2 minutes)

1. In Render dashboard → `provvypay-api` service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Wait for deployment to complete (watch logs)

### Step 3: Verify (1 minute)

Check if backend is running:
```bash
curl https://provvypay-api.onrender.com/api/health
```

Should return: `{"status":"ok"}`

### Step 4: Test Payment (1 minute)

1. Clear browser cache (Ctrl+Shift+Delete)
2. Refresh your payment page
3. Try making a payment again
4. Check console for errors

---

## Expected Behavior After Fix

✅ No more "Loading chunk 9254 failed" errors
✅ No more "Invalid environment variables" in Render logs
✅ Backend stays running (doesn't crash loop)
✅ Payments go through successfully
✅ Monitoring detects payments

---

## Still Not Working?

### If you see "Invalid environment variables" in logs:

Check the logs carefully - they should tell you which variable is missing. Common culprits:
- `NEXT_PUBLIC_SUPABASE_URL` - Make sure it ends with `.supabase.co`
- `ENCRYPTION_KEY` - Must be at least 32 characters
- `STRIPE_WEBHOOK_SECRET` - Must start with `whsec_`

### If chunks still load from wrong domain:

1. Make sure `NEXT_PUBLIC_APP_URL` is set correctly
2. Trigger a full rebuild (not just redeploy)
3. Clear ALL browser data for the domain
4. Try in incognito/private window

### If backend keeps crashing:

1. Check Render logs for specific error
2. Run validation script locally:
   ```bash
   node scripts/validate-render-env.js
   ```
3. Compare your local .env with Render environment variables

---

## Quick Links

- 📄 [Full Deployment Guide](./RENDER_DEPLOYMENT_URGENT_FIX.md)
- 📄 [All Environment Variables](./RENDER_ENV_VARIABLES.md)
- 📄 [Production Setup](./PRODUCTION_SETUP_GUIDE.md)

---

## Questions?

Common issues and solutions:

**Q: Where do I find my Supabase keys?**
A: Supabase Dashboard → Settings → API → Project URL and anon/service keys

**Q: Should I use test or live Stripe keys?**
A: Use test keys (`sk_test_`) for testing, live keys (`sk_live_`) for production

**Q: What if I don't have a STRIPE_WEBHOOK_SECRET?**
A: Go to Stripe Dashboard → Developers → Webhooks → Add endpoint → Copy signing secret

**Q: How do I know which domain to use for NEXT_PUBLIC_APP_URL?**
A: Use the domain where your users access the payment links (where the Next.js app is hosted)

---

**Last Updated**: 2026-01-17 by AI Assistant
**Estimated Time to Fix**: 10-15 minutes


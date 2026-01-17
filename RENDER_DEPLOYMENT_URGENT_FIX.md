# 🚨 URGENT: Render Deployment Fix

## Problem
Your Render deployment is failing because of missing environment variables, causing your backend to crash repeatedly.

## Solution Steps

### Step 1: Fix Environment Variables on Render

Go to your Render dashboard → `provvypay-api` service → Environment tab and add these **REQUIRED** variables:

#### 1. Application URLs
```bash
NEXT_PUBLIC_APP_URL=https://provvypay-api.onrender.com
```
**⚠️ Important**: If your frontend is on a different domain, use that domain instead!

#### 2. Database (should already be set from blueprint)
```bash
DATABASE_URL=[automatically set from database connection]
DIRECT_URL=[optional - for connection pooling]
```

#### 3. Supabase (REQUIRED)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 4. Stripe (REQUIRED)
```bash
STRIPE_SECRET_KEY=sk_test_xxx_or_sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx_or_pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

#### 5. Hedera (REQUIRED)
```bash
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com
NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID=0.0.429274
NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID=0.0.429275
NEXT_PUBLIC_HEDERA_AUDD_TOKEN_ID=0.0.5130576
```

#### 6. Security (REQUIRED)
```bash
ENCRYPTION_KEY=[generate a 32-character random string]
SESSION_SECRET=[generate a random string]
```

Generate encryption keys:
```bash
# On Windows PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# On Mac/Linux:
openssl rand -base64 32
```

#### 7. Optional (but recommended)
```bash
# WalletConnect (for Hedera wallet connections)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id

# Redis (for caching)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Email (for notifications)
RESEND_API_KEY=re_xxx

# Xero (for accounting sync)
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret
XERO_REDIRECT_URI=https://provvypay-api.onrender.com/api/xero/callback
```

#### 8. Feature Flags
```bash
ENABLE_HEDERA_PAYMENTS=true
ENABLE_HEDERA_STABLECOINS=true
ENABLE_XERO_SYNC=true
ENABLE_BETA_OPS=false
```

### Step 2: Trigger Redeploy

After adding all environment variables:
1. Click "Save Changes"
2. Go to "Manual Deploy" → "Deploy latest commit"
3. Watch the logs for successful startup

### Step 3: Verify Deployment

Once deployed, check:
```bash
curl https://provvypay-api.onrender.com/api/health
```

Should return: `{"status":"ok"}`

---

## Quick Checklist

- [ ] All REQUIRED environment variables set on Render
- [ ] `NEXT_PUBLIC_APP_URL` points to correct domain
- [ ] Encryption keys generated and set
- [ ] Supabase credentials configured
- [ ] Stripe keys configured (test or live)
- [ ] Hedera network and token IDs set
- [ ] Service redeployed successfully
- [ ] Health check endpoint returns 200 OK
- [ ] No "Invalid environment variables" in logs

---

## If You're Using a Separate Frontend Domain

If your frontend is hosted on a different domain (e.g., `provvypay.com`), you need to:

1. Set `NEXT_PUBLIC_APP_URL` to your frontend domain
2. Ensure CORS is configured to allow requests from frontend to API
3. Update any hardcoded URLs in your frontend code

---

## Common Issues

### "Invalid environment variables" keeps appearing
- One or more required variables is missing
- Check the logs carefully - they should tell you which variable is invalid
- Use `render logs` command or check logs in dashboard

### Chunks still loading from wrong domain
- Clear browser cache completely (Ctrl+Shift+Delete)
- Rebuild the app after setting `NEXT_PUBLIC_APP_URL`
- Verify the variable is set at **build time** (NEXT_PUBLIC_ vars are baked into the build)

### Database connection fails
- Ensure `DATABASE_URL` is set from the database connection string
- Check if database is in the same region as the service
- Verify database user has correct permissions

---

## Testing After Fix

1. Open your payment link in browser
2. Open DevTools Console
3. Try to make a payment
4. Check that chunks load from correct domain
5. Verify payment monitoring works

---

## Need More Help?

Check these files:
- `src/lib/config/env.ts` - See all required environment variables
- `RENDER_ENV_VARIABLES.md` - Full list of variables
- `PRODUCTION_SETUP_GUIDE.md` - Complete production setup

---

**Last Updated**: 2026-01-17


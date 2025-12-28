# 🔐 Render Environment Variables Configuration

**Phase 1 Deployment: Web Service Only**  
Worker and cron services will be added in Phase 2

---

## 📋 How to Use This File

### Step 1: Create Environment Group in Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to **Environment Groups**
3. Click **New Environment Group**
4. Name it: `provvypay-production`

### Step 2: Add All Variables Below

Copy each variable below and add it to your `provvypay-production` environment group.

### Step 3: Replace Placeholder Values

Replace all `CHANGE_ME` values with your actual credentials.

---

## 🚨 CRITICAL CONFIGURATION
**These MUST be set correctly or system will fail**

```bash
NODE_ENV=production
HEDERA_NETWORK=mainnet
XERO_AUDD_CLEARING_ACCOUNT=1054
PAYMENT_TOLERANCE_AUDD=0.1
```

---

## 💾 DATABASE CONFIGURATION
**Render provides DATABASE_URL automatically from the database service**

```bash
# This is automatically provided by Render from your database service
# No need to manually set it - Render connects it via the render.yaml config
DATABASE_URL=<Render will provide this>

# Connection pool settings
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
DATABASE_POOL_IDLE_TIMEOUT=30000
```

---

## 🌐 APPLICATION URLS

```bash
NEXT_PUBLIC_APP_URL=https://provvypay-api.onrender.com
NEXT_PUBLIC_API_URL=https://provvypay-api.onrender.com
NEXT_PUBLIC_PAYMENT_URL=https://provvypay-api.onrender.com
```

**Note:** Update these URLs after Render assigns your actual domain.

---

## 🔐 AUTHENTICATION & SECURITY (Supabase)
**Get from: Supabase Dashboard → Settings → API**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_service_role_key_here
SUPABASE_JWT_SECRET=your-super-secret-jwt-token
```

---

## 🔑 SESSION & ENCRYPTION
**Generate secure keys with:**

```bash
# Run this command TWICE (once for each key)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then add:

```bash
SESSION_SECRET=<paste first generated key here>
ENCRYPTION_KEY=<paste second generated key here>
SESSION_COOKIE_NAME=provvypay_session
SESSION_MAX_AGE=86400000
```

---

## 💳 STRIPE INTEGRATION (LIVE MODE ONLY!)
**Get from: Stripe Dashboard → Developers → API keys**

⚠️ **CRITICAL:** Switch to **LIVE MODE** in Stripe dashboard first!

```bash
STRIPE_PUBLISHABLE_KEY=pk_live_CHANGE_ME
STRIPE_SECRET_KEY=sk_live_CHANGE_ME
STRIPE_WEBHOOK_SECRET=whsec_CHANGE_ME
```

**To get webhook secret:**
1. Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://provvypay-api.onrender.com/api/stripe/webhook`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`
5. Copy the webhook signing secret

---

## ⚡ HEDERA INTEGRATION (MAINNET ONLY!)
**Create mainnet account at: hedera.com or via Hashpack wallet**

⚠️ **NEVER expose private keys in logs or version control!**

```bash
HEDERA_NETWORK=mainnet
HEDERA_MIRROR_NODE_URL=https://mainnet-public.mirrornode.hedera.com
HEDERA_ACCOUNT_ID=0.0.CHANGE_ME
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420CHANGE_ME
```

### AUDD Token Configuration
**🚨 CRITICAL: Do NOT change these IDs**

```bash
HEDERA_AUDD_TOKEN_ID=0.0.456858
HEDERA_AUDD_ACCOUNT_ID=0.0.1054
```

### Other Token IDs

```bash
HEDERA_USDC_TOKEN_ID=0.0.456858
HEDERA_USDT_TOKEN_ID=0.0.123456
HEDERA_HBAR_TOKEN_ID=HBAR
```

---

## 📊 XERO INTEGRATION
**Create production OAuth app at: developer.xero.com**

```bash
XERO_CLIENT_ID=CHANGE_ME
XERO_CLIENT_SECRET=CHANGE_ME
XERO_REDIRECT_URI=https://provvypay-api.onrender.com/api/xero/callback
XERO_SCOPES=accounting.transactions,accounting.contacts,offline_access
```

### Xero Account Codes
**🚨 CRITICAL: Match your Xero chart of accounts**

```bash
XERO_REVENUE_ACCOUNT=200
XERO_AR_ACCOUNT=610
XERO_STRIPE_CLEARING_ACCOUNT=1200
XERO_HBAR_CLEARING_ACCOUNT=1210
XERO_USDC_CLEARING_ACCOUNT=1211
XERO_USDT_CLEARING_ACCOUNT=1212
XERO_AUDD_CLEARING_ACCOUNT=1054
XERO_FEE_EXPENSE_ACCOUNT=400
```

---

## 💱 FX RATE PROVIDERS

### Primary: CoinGecko (Recommended)

```bash
COINGECKO_API_KEY=CHANGE_ME
COINGECKO_API_URL=https://api.coingecko.com/api/v3
COINGECKO_RATE_LIMIT=50
```

### Secondary: CoinMarketCap (Optional)

```bash
COINMARKETCAP_API_KEY=optional_change_me
COINMARKETCAP_API_URL=https://pro-api.coinmarketcap.com/v1
```

### FX Cache Configuration

```bash
FX_CACHE_TTL=300000
FX_FALLBACK_ENABLED=true
FX_RATE_STALE_THRESHOLD=3600000
```

---

## 📧 EMAIL SERVICE
**Choose ONE provider**

### Option A: SendGrid (Recommended)

```bash
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@provvypay.com
EMAIL_FROM_NAME=Provvypay
SENDGRID_API_KEY=SG.CHANGE_ME
```

### Option B: Resend

```bash
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@provvypay.com
EMAIL_FROM_NAME=Provvypay
RESEND_API_KEY=re_CHANGE_ME
```

### Option C: SMTP

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@provvypay.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASSWORD=your_password
```

---

## 📊 MONITORING & ERROR TRACKING

### Sentry Configuration

```bash
SENTRY_DSN=https://CHANGE_ME@sentry.io/CHANGE_ME
SENTRY_ORG=your_org
SENTRY_PROJECT=provvypay-production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ENVIRONMENT=production
```

### Logging

```bash
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DESTINATION=stdout
```

### Metrics

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
```

---

## 🔒 API SECURITY & RATE LIMITING

```bash
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW_MS=900000
API_CORS_ORIGIN=https://provvypay-api.onrender.com
```

---

## 💰 PAYMENT TOLERANCES
**Percentage tolerance for payment amounts (to account for FX fluctuations)**

```bash
PAYMENT_TOLERANCE_STRIPE=0.5
PAYMENT_TOLERANCE_HBAR=1.0
PAYMENT_TOLERANCE_USDC=0.5
PAYMENT_TOLERANCE_USDT=0.5
PAYMENT_TOLERANCE_AUDD=0.1
```

---

## 💾 BACKUP CONFIGURATION

```bash
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"
BACKUP_RETENTION_DAYS=30
```

### AWS S3 (Optional)

```bash
# AWS_ACCESS_KEY_ID=CHANGE_ME
# AWS_SECRET_ACCESS_KEY=CHANGE_ME
# AWS_REGION=us-west-2
# AWS_BACKUP_BUCKET=provvypay-backups
```

---

## 🎛️ FEATURE FLAGS

```bash
ENABLE_HEDERA_PAYMENTS=true
ENABLE_STRIPE_PAYMENTS=true
ENABLE_XERO_SYNC=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_METRICS=true
```

---

## ⚙️ WORKER & CRON (Phase 2 - Currently Disabled)
**Will be used when worker and cron services are enabled**

```bash
# Uncomment these when Phase 2 is deployed
# WORKER_CONCURRENCY=5
# CRON_FX_SCHEDULE="0 * * * *"
# CRON_RECONCILE_SCHEDULE="0 2 * * *"
```

---

## 🔧 NEXT.JS BUILD CONFIGURATION

```bash
NEXT_TELEMETRY_DISABLED=1
```

---

## ✅ PRE-DEPLOYMENT CHECKLIST

Before deploying, verify:

- [ ] **All "CHANGE_ME" values replaced** with actual credentials
- [ ] **SESSION_SECRET** generated (32+ hex characters)
- [ ] **ENCRYPTION_KEY** generated (32+ hex characters)
- [ ] **Stripe keys** are LIVE mode (`pk_live_`, `sk_live_`, NOT test keys)
- [ ] **Hedera network** is `mainnet` (NOT testnet)
- [ ] **XERO_AUDD_CLEARING_ACCOUNT** is exactly `1054`
- [ ] **HEDERA_AUDD_TOKEN_ID** is exactly `0.0.456858`
- [ ] **HEDERA_AUDD_ACCOUNT_ID** is exactly `0.0.1054`
- [ ] **Stripe webhook** created and secret obtained
- [ ] **Xero OAuth app** created (production)
- [ ] **CoinGecko API key** obtained
- [ ] **Email service** configured (SendGrid/Resend)
- [ ] **Sentry project** created
- [ ] **All URLs** updated with actual Render domain

---

## 🚀 DEPLOYMENT STEPS

### 1. Add Variables to Render

1. Go to Render Dashboard → Environment Groups
2. Select `provvypay-production`
3. Add each variable above (click "Add Environment Variable")
4. Save the group

### 2. Deploy via Blueprint

```bash
# Push render.yaml to GitHub
git add render.yaml
git commit -m "Add Render deployment config"
git push origin main

# In Render Dashboard:
# New + → Blueprint → Connect repository → Apply
```

### 3. Run Database Migration

After deployment completes:

```bash
# Shell into web service in Render dashboard
npx prisma migrate deploy
npx prisma migrate status  # Verify
```

### 4. Verify Deployment

```bash
# Test health endpoint
curl https://provvypay-api.onrender.com/api/health

# Check logs in Render Dashboard
# Verify web service is running
```

---

## 🆘 TROUBLESHOOTING

### Common Issues

**Database Connection Failed**
- Verify `DATABASE_URL` is set (Render provides this automatically)
- Check database service is running
- Verify connection pool settings

**Stripe Webhook Not Working**
- Check webhook URL matches exactly
- Verify webhook secret is correct
- Test with Stripe CLI: `stripe listen --forward-to https://your-url/api/stripe/webhook`

**Hedera Connection Failing**
- Verify account has HBAR balance
- Check network is `mainnet`
- Ensure private key format is correct
- Verify tokens are associated with your account

**Xero Sync Failing**
- Check OAuth redirect URI matches exactly
- Verify scopes include required permissions
- Test OAuth flow manually
- Check account codes exist in Xero

---

## 📚 Additional Resources

- **Full Setup Guide:** `PRODUCTION_SETUP_GUIDE.md`
- **Deployment Guide:** `DEPLOYMENT_GUIDE.md`
- **Render Config:** `render.yaml`
- **API Documentation:** `API_DOCUMENTATION.md`

---

**Last Updated:** December 28, 2025  
**Deployment:** Phase 1 - Web Service Only  
**Next Phase:** Add Worker & Cron Services

---

## 🎉 Ready to Deploy!

Once all variables are added to the Render environment group:

1. Push `render.yaml` to GitHub
2. Connect repository in Render
3. Deploy via Blueprint
4. Run migrations
5. Test endpoints
6. Monitor logs

**Good luck with your deployment! 🚀**


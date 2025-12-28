# 🚀 Production Environment Quick Start

**For experienced teams who want to get up and running in 15 minutes**

---

## Prerequisites

✅ Production domain configured  
✅ PostgreSQL database ready  
✅ Stripe live keys  
✅ Hedera mainnet account  
✅ Xero production OAuth app  
✅ CoinGecko API key  

---

## Quick Setup (15 minutes)

### 1. Generate Secure Keys (1 minute)

```bash
cd src
npm run generate-keys
```

Copy the output keys.

### 2. Configure Environment (5 minutes)

Create `.env.production` in the project root (not in `src/`):

```bash
# CRITICAL - Must be exactly these values
NODE_ENV=production
HEDERA_NETWORK=mainnet
STRIPE_SECRET_KEY=sk_live_your_key_here
XERO_AUDD_CLEARING_ACCOUNT=1054
PAYMENT_TOLERANCE_AUDD=0.1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/provvypay_production

# Auth (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Security (use generated keys from step 1)
SESSION_SECRET=your_generated_session_secret
ENCRYPTION_KEY=your_generated_encryption_key

# Stripe (LIVE keys only!)
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Hedera (Mainnet!)
HEDERA_NETWORK=mainnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT
HEDERA_PRIVATE_KEY=your_private_key
HEDERA_AUDD_TOKEN_ID=0.0.456858
HEDERA_AUDD_ACCOUNT_ID=0.0.1054

# Xero
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=https://app.provvypay.com/api/xero/callback
XERO_AUDD_CLEARING_ACCOUNT=1054

# FX
COINGECKO_API_KEY=your_key

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx

# URLs
NEXT_PUBLIC_APP_URL=https://app.provvypay.com
```

### 3. Validate Configuration (2 minutes)

```bash
npm run validate-env
```

Fix any errors before proceeding.

### 4. Database Setup (3 minutes)

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npm run db:migrate:production
# OR if the above doesn't work:
npx prisma migrate deploy
```

### 5. Build & Test (3 minutes)

```bash
# Build
npm run build

# Start
npm run start

# In another terminal, test health
npm run health-check
```

### 6. Deploy (1 minute)

**Render (Recommended):**
```bash
# 1. Push render.yaml to GitHub
git add render.yaml
git commit -m "Add Render deployment config"
git push origin main

# 2. Render Dashboard → New + → Blueprint → Connect repo
# 3. Shell into web service → npx prisma migrate deploy
```

**Or Docker:**
```bash
docker build -t provvypay:latest .
docker push your-registry/provvypay:latest
```

**Or PM2:**
```bash
pm2 start npm --name provvypay -- start
pm2 save
```

---

## Critical Verification

After deployment, verify these immediately:

```bash
# 1. Health check
curl https://api.provvypay.com/api/health

# 2. Create test payment link (via UI or API)
# 3. Process small test payment
# 4. Verify ledger entries
# 5. Check Xero sync worked
# 6. Confirm AUDD account is 1054
```

---

## ⚠️ Critical Configuration Checklist

Before going live, double-check:

- [ ] `HEDERA_NETWORK=mainnet` (NOT testnet)
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_` (NOT sk_test_)
- [ ] `XERO_AUDD_CLEARING_ACCOUNT=1054` (MUST be 1054)
- [ ] `PAYMENT_TOLERANCE_AUDD=0.1` (0.1%, not 1%)
- [ ] All URLs use `https://`
- [ ] Webhook endpoints configured in Stripe dashboard
- [ ] Hedera tokens are associated with your account
- [ ] Database backups are automated

---

## Emergency Rollback

If something goes wrong:

```bash
# Vercel
vercel rollback

# Docker
docker stop provvypay
docker start provvypay-previous

# PM2
pm2 restart provvypay
```

---

## Get Help

- **Full Guide:** See `PRODUCTION_SETUP_GUIDE.md`
- **Checklist:** See `PRODUCTION_SETUP_CHECKLIST.md`
- **Operations:** See `OPERATIONS_RUNBOOK.md`
- **Rollback:** See `ROLLBACK_PROCEDURES.md`

---

## Common Issues

### Validation Fails

```bash
# Check which variables are missing
grep "❌" .env.production

# Regenerate keys
npm run generate-keys
```

### Database Connection Fails

```bash
# Test connection
npx prisma db push --preview-feature

# Check DATABASE_URL has ?schema=public
```

### Stripe Webhook Not Working

1. Check webhook secret matches Stripe dashboard
2. Verify URL is `https://api.provvypay.com/api/stripe/webhook`
3. Test with: `stripe listen --forward-to [url]`

### Hedera Transaction Fails

1. Check account has HBAR balance
2. Verify `HEDERA_NETWORK=mainnet`
3. Ensure tokens are associated
4. Test account ID format: `0.0.xxxxx`

---

**Setup Time:** ~15 minutes  
**Ready for production:** ✅

For detailed explanations, see `PRODUCTION_SETUP_GUIDE.md`






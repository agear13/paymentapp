# 🚀 Provvypay Production Environment Setup Guide

**Version:** 1.0  
**Last Updated:** December 20, 2025  
**Estimated Setup Time:** 2-4 hours

---

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] Production domain configured (app.provvypay.com, api.provvypay.com, pay.provvypay.com)
- [ ] PostgreSQL database provisioned (Supabase recommended)
- [ ] Stripe account in live mode
- [ ] Hedera mainnet account with HBAR funded
- [ ] Xero developer account with production OAuth app
- [ ] CoinGecko API key (or alternative FX provider)
- [ ] Sentry account for error tracking
- [ ] Email service account (SendGrid/Resend)
- [ ] AWS account for backups (optional)

---

## 🎯 Quick Start (15 minutes)

For those who want to get up and running quickly:

```bash
# 1. Copy environment template
cp .env.production.template .env.production

# 2. Generate secure keys
npm run generate-keys

# 3. Fill in required values (see Minimum Configuration below)
nano .env.production

# 4. Validate configuration
npm run validate-env

# 5. Run database migrations
npm run db:migrate:production

# 6. Start production server
npm run start
```

---

## 📝 Step-by-Step Setup

### Step 1: Environment File Setup (10 minutes)

#### 1.1 Create Production Environment File

```bash
# Copy the template
cp .env.production.template .env.production

# Secure the file (Unix/Mac)
chmod 600 .env.production
```

#### 1.2 Generate Secure Keys

You need to generate several secure random keys:

```bash
# Generate SESSION_SECRET (32 characters)
openssl rand -hex 32

# Generate ENCRYPTION_KEY (32 characters)
openssl rand -hex 32

# Store these in .env.production
```

Or use Node.js:

```javascript
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 2: Database Configuration (20 minutes)

#### 2.1 Provision PostgreSQL Database

**Option A: Supabase (Recommended)**

1. Go to [supabase.com](https://supabase.com)
2. Create new project: "provvypay-production"
3. Copy the connection string from Settings → Database
4. Add to `.env.production`:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public
```

**Option B: Direct PostgreSQL**

1. Provision PostgreSQL 14+ instance
2. Create database: `provvypay_production`
3. Configure connection string:

```bash
DATABASE_URL=postgresql://username:password@host:5432/provvypay_production?schema=public
```

#### 2.2 Configure Connection Pool

```bash
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
DATABASE_POOL_IDLE_TIMEOUT=30000
```

Adjust based on your expected load:
- **Small:** MIN=5, MAX=20
- **Medium:** MIN=10, MAX=50
- **Large:** MIN=20, MAX=100

#### 2.3 Run Database Migrations

```bash
# Install Prisma CLI
npm install -g prisma

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify migration
npx prisma migrate status
```

#### 2.4 Set Up Database Backups

```bash
# Configure automated backups
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"  # 2 AM daily
BACKUP_RETENTION_DAYS=30
```

---

### Step 3: Authentication Setup (15 minutes)

#### 3.1 Supabase Configuration

1. Go to your Supabase project
2. Navigate to Settings → API
3. Copy the values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=your-super-secret-jwt-token
```

#### 3.2 Session Configuration

```bash
SESSION_SECRET=[YOUR_GENERATED_32_CHAR_SECRET]
SESSION_COOKIE_NAME=provvypay_session
SESSION_MAX_AGE=86400000  # 24 hours
```

#### 3.3 API Security

```bash
API_RATE_LIMIT_MAX=100  # requests per window
API_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
API_CORS_ORIGIN=https://app.provvypay.com
```

---

### Step 4: Stripe Integration (20 minutes)

#### 4.1 Get Live API Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to **Live mode** (toggle in top right)
3. Go to Developers → API keys
4. Copy your keys:

```bash
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

⚠️ **IMPORTANT:** Never use test keys (pk_test_/sk_test_) in production!

#### 4.2 Configure Webhook

1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://api.provvypay.com/api/stripe/webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
5. Copy webhook signing secret:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### 4.3 Test Webhook

```bash
# Install Stripe CLI
stripe login

# Test webhook locally first
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger payment_intent.succeeded
```

---

### Step 5: Hedera Integration (25 minutes)

#### 5.1 Create Mainnet Account

If you don't have a Hedera mainnet account:

1. Go to [hedera.com](https://hedera.com) or use Hashpack wallet
2. Create mainnet account
3. Fund with HBAR (minimum 10 HBAR recommended)
4. Note your Account ID and Private Key

#### 5.2 Configure Hedera

```bash
HEDERA_NETWORK=mainnet
HEDERA_MIRROR_NODE_URL=https://mainnet-public.mirrornode.hedera.com

# Your merchant receiving account
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=302e020100300506032b6570042204201234...
```

⚠️ **SECURITY:** Never commit private keys to version control!

#### 5.3 Configure Token IDs

```bash
# AUDD Stablecoin
HEDERA_AUDD_TOKEN_ID=0.0.456858
HEDERA_AUDD_ACCOUNT_ID=0.0.1054

# Other tokens (get current IDs from Hedera)
HEDERA_USDC_TOKEN_ID=0.0.456858
HEDERA_USDT_TOKEN_ID=0.0.123456
```

#### 5.4 Associate Tokens

Before receiving tokens, you must associate them with your account:

```bash
# Use Hashpack or Hedera SDK to associate tokens
# This is required before first receipt

# Required associations:
# - USDC (0.0.456858)
# - USDT (if using)
# - AUDD (0.0.456858)
```

#### 5.5 Test Connection

```bash
npm run test:hedera-connection
```

---

### Step 6: Xero Integration (20 minutes)

#### 6.1 Create Production OAuth App

1. Go to [Xero Developer Portal](https://developer.xero.com)
2. Create new app: "Provvypay Production"
3. Set redirect URI: `https://app.provvypay.com/api/xero/callback`
4. Copy credentials:

```bash
XERO_CLIENT_ID=YOUR_CLIENT_ID
XERO_CLIENT_SECRET=YOUR_CLIENT_SECRET
XERO_REDIRECT_URI=https://app.provvypay.com/api/xero/callback
```

#### 6.2 Configure Scopes

```bash
XERO_SCOPES=accounting.transactions,accounting.contacts,offline_access
```

#### 6.3 Configure Account Codes

Match these to your Xero chart of accounts:

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

#### 6.4 Test Connection

```bash
npm run test:xero-connection
```

---

### Step 7: FX Rate Providers (15 minutes)

#### 7.1 CoinGecko (Primary)

1. Sign up at [coingecko.com](https://www.coingecko.com/en/api/pricing)
2. Get API key (Pro plan recommended)
3. Configure:

```bash
COINGECKO_API_KEY=YOUR_API_KEY
COINGECKO_API_URL=https://api.coingecko.com/api/v3
COINGECKO_RATE_LIMIT=50
```

#### 7.2 CoinMarketCap (Secondary - Optional)

```bash
COINMARKETCAP_API_KEY=YOUR_API_KEY
COINMARKETCAP_API_URL=https://pro-api.coinmarketcap.com/v1
```

#### 7.3 Configure Fallback

```bash
FX_CACHE_TTL=300000  # 5 minutes
FX_FALLBACK_ENABLED=true
FX_RATE_STALE_THRESHOLD=3600000  # 1 hour
```

---

### Step 8: Email Service (10 minutes)

#### Option A: SendGrid (Recommended)

```bash
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@provvypay.com
EMAIL_FROM_NAME=Provvypay
SENDGRID_API_KEY=SG.your_api_key
```

#### Option B: Resend

```bash
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@provvypay.com
RESEND_API_KEY=re_your_api_key
```

#### Option C: SMTP

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASSWORD=your_password
```

---

### Step 9: Monitoring & Error Tracking (15 minutes)

#### 9.1 Sentry Setup

1. Create account at [sentry.io](https://sentry.io)
2. Create project: "provvypay-production"
3. Copy DSN:

```bash
SENTRY_DSN=https://abc123@sentry.io/123456
SENTRY_ORG=your_org
SENTRY_PROJECT=provvypay-production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ENVIRONMENT=production
```

#### 9.2 Configure Logging

```bash
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DESTINATION=stdout
```

#### 9.3 Enable Metrics

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
```

---

### Step 10: Security Configuration (10 minutes)

#### 10.1 Encryption

```bash
ENCRYPTION_KEY=[YOUR_GENERATED_32_CHAR_KEY]
```

#### 10.2 HTTPS Enforcement

Ensure your hosting platform enforces HTTPS:
- Vercel: Automatic
- AWS/DigitalOcean: Configure in load balancer
- Custom: Set up SSL certificates

#### 10.3 CORS Configuration

```bash
API_CORS_ORIGIN=https://app.provvypay.com
```

---

### Step 11: Payment Tolerances (5 minutes)

Configure payment tolerance percentages:

```bash
PAYMENT_TOLERANCE_STRIPE=0.5  # 0.5% for card payments
PAYMENT_TOLERANCE_HBAR=1.0    # 1% for HBAR (more volatile)
PAYMENT_TOLERANCE_USDC=0.5    # 0.5% for stablecoins
PAYMENT_TOLERANCE_USDT=0.5    # 0.5% for stablecoins
PAYMENT_TOLERANCE_AUDD=0.1    # 0.1% for AUDD (tightest)
```

---

### Step 12: Validation & Testing (20 minutes)

#### 12.1 Validate Environment

```bash
npm run validate-env
```

This script checks:
- ✅ All required variables are set
- ✅ Database connection works
- ✅ Stripe keys are valid
- ✅ Hedera connection works
- ✅ Xero OAuth is configured
- ✅ FX providers respond
- ✅ Email service works

#### 12.2 Run Health Checks

```bash
npm run health-check
```

Expected output:
```json
{
  "status": "healthy",
  "database": "ok",
  "stripe": "ok",
  "hedera": "ok",
  "xero": "ok",
  "fx": "ok",
  "email": "ok"
}
```

#### 12.3 Test Payment Flow

```bash
# Create test payment link
npm run test:create-payment-link

# Process test payment
npm run test:process-payment

# Verify in database
npm run test:verify-ledger
```

---

## 🔐 Security Checklist

Before going live, verify:

- [ ] All secrets are in `.env.production` (not committed to git)
- [ ] `.env.production` has 600 permissions (Unix/Mac)
- [ ] Using HTTPS for all domains
- [ ] Stripe webhook signature verification enabled
- [ ] Hedera private key is never logged
- [ ] Database uses SSL connection
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] Session secrets are random and strong
- [ ] Sentry error tracking is active
- [ ] Backup automation is configured

---

## 🚀 Deployment

## Step 12: Deploy to Production

### Recommended: Render

Provvypay requires long-running processes, background workers, and cron jobs. Render provides these natively.

**Quick Setup (30 minutes):**

1. **Create `render.yaml`** in project root (see `render.yaml` template in repo)

2. **Create Environment Group** in Render Dashboard:
   - Name: `provvypay-production`
   - Add all variables from `.env.production`

3. **Deploy via Blueprint:**
   ```bash
   # Push render.yaml to GitHub
   git add render.yaml
   git commit -m "Add Render deployment config"
   git push origin main
   
   # In Render Dashboard:
   # New + → Blueprint → Connect repository → Apply
   ```

4. **Run Database Migration:**
   ```bash
   # After deployment, shell into web service
   npx prisma migrate deploy
   npx prisma migrate status  # Verify
   ```

5. **Verify Deployment:**
   ```bash
   # Test health endpoint
   curl https://provvypay-api.onrender.com/api/health
   
   # Check logs in Render Dashboard
   # Verify all 3 services are running (web, worker, cron)
   ```

**Critical Environment Variables:**
- `HEDERA_NETWORK=mainnet` (NOT testnet)
- `STRIPE_SECRET_KEY=sk_live_...` (NOT sk_test_)
- `XERO_AUDD_CLEARING_ACCOUNT=1054` (MUST be 1054)

**Service Architecture:**
- **Web Service:** API server, handles requests/webhooks
- **Worker Service:** Background jobs (Xero sync, retries)
- **Cron Jobs:** FX rates (hourly), reconciliation (daily)
- **Database:** Native Postgres

**Rollback:** Dashboard → Service → Deploys tab → Previous deploy → Redeploy

---

### Alternative: Docker or PM2
For self-hosted deployments:

**Docker:**
```bash
# Build image
docker build -t provvypay:latest .

# Run container
docker run -d \
  --env-file .env.production \
  -p 3000:3000 \
  provvypay:latest
```

**PM2 (Node.js):**
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name provvypay -- start

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

---

## 📊 Post-Deployment Verification

### 1. Health Check

```bash
curl https://api.provvypay.com/api/health
```

### 2. Create Test Organization

```bash
curl -X POST https://api.provvypay.com/api/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","email":"test@example.com"}'
```

### 3. Create Test Payment Link

```bash
curl -X POST https://api.provvypay.com/api/payment-links \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD",
    "description": "Test payment"
  }'
```

### 4. Monitor Logs

```bash
# View application logs
pm2 logs provvypay

# Or check Sentry dashboard
```

---

## 🆘 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma db push --preview-feature

# Check connection pool
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

### Stripe Webhook Not Working

1. Check webhook URL in Stripe dashboard
2. Verify webhook secret matches
3. Test with Stripe CLI:
```bash
stripe listen --forward-to https://api.provvypay.com/api/stripe/webhook
```

### Hedera Connection Failing

1. Verify account has HBAR balance
2. Check network is set to "mainnet"
3. Ensure private key format is correct
4. Verify tokens are associated

### Xero Sync Failing

1. Check OAuth redirect URI matches exactly
2. Verify scopes include required permissions
3. Test OAuth flow manually
4. Check account codes exist in Xero

---

## 📈 Monitoring & Alerts

### Set Up Alerts

Configure these critical alerts:

1. **Database Down** - P0
2. **Stripe Webhook Failures** - P1
3. **Hedera Network Issues** - P1
4. **Payment Processing Errors** - P2
5. **High Error Rate** (>1%) - P2

### Dashboards

Create dashboards for:
- Payment volume (hourly/daily)
- Success rates by payment method
- Average processing time
- Error rates by type
- Currency conversion tracking

---

## 🔄 Maintenance Windows

Schedule regular maintenance:

- **Database backups:** Daily at 2 AM
- **Log rotation:** Weekly
- **Dependency updates:** Monthly
- **Security patches:** As needed

---

## 📞 Support Contacts

- **Technical Issues:** tech@provvypay.com
- **Stripe Support:** https://support.stripe.com
- **Hedera Support:** https://hedera.com/support
- **Xero Support:** https://developer.xero.com/support

---

## ✅ Production Readiness Checklist

Use this final checklist before going live:

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] Backups automated and tested
- [ ] All integrations tested (Stripe, Hedera, Xero)
- [ ] Health checks passing
- [ ] Monitoring and alerts configured
- [ ] Error tracking active (Sentry)
- [ ] SSL certificates valid
- [ ] Domain DNS configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] CORS properly set
- [ ] Test payments processed successfully
- [ ] Ledger entries verified
- [ ] Xero sync working
- [ ] Email notifications working
- [ ] Documentation reviewed
- [ ] Team trained on operations
- [ ] Rollback procedure tested
- [ ] Legal compliance verified
- [ ] PCI compliance confirmed

---

**🎉 Congratulations! Your production environment is ready!**

For ongoing operations, see: `OPERATIONS_RUNBOOK.md`  
For emergencies, see: `ROLLBACK_PROCEDURES.md`  
For monitoring, see: `MONITORING_ALERTS_GUIDE.md`

---

**Last Updated:** December 20, 2025  
**Version:** 1.0  
**Maintained by:** Provvypay Platform Team






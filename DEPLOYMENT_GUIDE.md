# Provvypay Deployment Guide

**Version:** 1.0  
**Last Updated:** December 16, 2025  
**Platform:** Vercel (Recommended)  
**Alternative:** Self-hosted Node.js

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Database Setup](#database-setup)
5. [External Services Configuration](#external-services-configuration)
6. [Post-Deployment Tasks](#post-deployment-tasks)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

---

## ✅ Prerequisites

### Required Accounts
- [ ] **Vercel Account** (or hosting platform)
- [ ] **Supabase Account** (PostgreSQL database)
- [ ] **Stripe Account** (payment processing)
- [ ] **Xero Developer Account** (accounting integration)
- [ ] **Upstash Account** (Redis caching)
- [ ] **Resend Account** (email notifications)
- [ ] **Sentry Account** (error tracking)
- [ ] **GitHub Account** (source code repository)

### Required CLI Tools
```bash
# Node.js 18+ (LTS recommended)
node --version  # Should be v18.x or higher

# npm or pnpm
npm --version

# Vercel CLI (optional, for local development)
npm install -g vercel

# Prisma CLI (included in project)
npx prisma --version
```

---

## 🔧 Environment Setup

### 1. Environment Variables

Create the following environment variables in your hosting platform (Vercel):

#### **Database (Supabase)**
```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
```
> **Note:** `DATABASE_URL` uses connection pooling, `DIRECT_URL` for migrations.

#### **Supabase Auth**
```bash
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"
```

#### **Stripe**
```bash
STRIPE_SECRET_KEY="sk_live_[YOUR_KEY]"
STRIPE_PUBLISHABLE_KEY="pk_live_[YOUR_KEY]"
STRIPE_WEBHOOK_SECRET="whsec_[YOUR_SECRET]"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_[YOUR_KEY]"
```

#### **Hedera**
```bash
NEXT_PUBLIC_HEDERA_NETWORK="mainnet"
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL="https://mainnet-public.mirrornode.hedera.com"
NEXT_PUBLIC_HEDERA_MERCHANT_ACCOUNT_ID="0.0.XXXXXX"
```

#### **Xero**
```bash
XERO_CLIENT_ID="[YOUR_CLIENT_ID]"
XERO_CLIENT_SECRET="[YOUR_CLIENT_SECRET]"
XERO_REDIRECT_URI="https://[YOUR_DOMAIN]/api/xero/callback"
```

#### **Redis (Upstash)**
```bash
UPSTASH_REDIS_REST_URL="https://[YOUR_ENDPOINT].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[YOUR_TOKEN]"
```

#### **Email (Resend)**
```bash
RESEND_API_KEY="re_[YOUR_KEY]"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

#### **Monitoring (Sentry)**
```bash
SENTRY_DSN="https://[KEY]@[ORG].ingest.sentry.io/[PROJECT]"
SENTRY_AUTH_TOKEN="[AUTH_TOKEN]"
NEXT_PUBLIC_SENTRY_DSN="https://[KEY]@[ORG].ingest.sentry.io/[PROJECT]"
```

#### **Encryption**
```bash
ENCRYPTION_KEY="[32-byte-hex-string]"
```
> **Generate with:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### **CoinGecko (Optional)**
```bash
COINGECKO_API_KEY="[YOUR_KEY]"  # Optional, for higher rate limits
```

#### **Application**
```bash
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"
```

---

## 🚀 Vercel Deployment

### Option 1: Deploy from GitHub (Recommended)

1. **Push Code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/provvypay.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Vercel auto-detects Next.js configuration

3. **Configure Environment Variables**
   - In Vercel dashboard → Project Settings → Environment Variables
   - Add all variables from the [Environment Setup](#environment-setup) section
   - Set environment: Production

4. **Configure Build Settings** (Auto-detected)
   ```yaml
   Framework Preset: Next.js
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   Development Command: npm run dev
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build (typically 2-3 minutes)
   - Vercel provides a production URL: `https://[project-name].vercel.app`

### Option 2: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Follow prompts to configure project
```

---

## 🗄️ Database Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region (closest to your users)
4. Save database password securely

### 2. Run Migrations

```bash
# Set DATABASE_URL in .env.local
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Run Prisma migrations
npm run db:migrate:deploy

# Verify migration
npm run db:studio
```

### 3. Seed Default Data

```bash
# Seed default ledger accounts and sample data (dev only)
npm run db:seed
```

### 4. Database Indexes (Performance)

Prisma migrations include all necessary indexes. Verify with:

```sql
-- Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

### 5. Enable Connection Pooling

Supabase provides PgBouncer connection pooling. Use the pooled connection string:

```bash
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
```

---

## 🔌 External Services Configuration

### 1. Stripe Setup

#### Create Webhook Endpoint
1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Add endpoint: `https://[YOUR_DOMAIN]/api/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

#### Test Webhook (Local Development)
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
npm run stripe:listen
```

### 2. Xero Setup

#### Register Application
1. Go to [Xero Developer Portal](https://developer.xero.com)
2. Create new app (OAuth 2.0)
3. Configure redirect URI: `https://[YOUR_DOMAIN]/api/xero/callback`
4. Copy Client ID and Secret
5. Add scopes: `accounting.transactions`, `accounting.contacts`

### 3. Resend Email Setup

#### Configure Domain
1. Go to [Resend Dashboard](https://resend.com)
2. Add your domain
3. Add DNS records (SPF, DKIM)
4. Verify domain
5. Create API key

#### Configure Webhook (Optional)
For email event tracking:
1. Add webhook: `https://[YOUR_DOMAIN]/api/webhooks/resend`
2. Select events: `email.delivered`, `email.bounced`, `email.opened`

### 4. Hedera Setup

#### Mainnet Configuration
- **Network:** `mainnet`
- **Mirror Node:** `https://mainnet-public.mirrornode.hedera.com`
- **Token IDs:**
  - USDC: `0.0.456858`
  - USDT: `0.0.456858` *(verify current mainnet ID)*
  - AUDD: `0.0.XXXXXX` *(configure your AUDD token ID)*

> **Note:** HBAR is native (no token ID required)

### 5. Redis (Upstash) Setup

1. Create database at [upstash.com](https://upstash.com)
2. Choose region (same as your app)
3. Copy REST URL and Token
4. Test connection:
   ```bash
   curl -X GET [UPSTASH_REDIS_REST_URL]/ping \
     -H "Authorization: Bearer [TOKEN]"
   # Expected: {"result":"PONG"}
   ```

---

## ✅ Post-Deployment Tasks

### 1. Verify Deployment

```bash
# Health check
curl https://[YOUR_DOMAIN]/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-12-16T...",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### 2. Create First Organization

1. Navigate to `https://[YOUR_DOMAIN]`
2. Sign up with Supabase Auth
3. Create organization
4. Configure merchant settings:
   - Display name
   - Default currency
   - Stripe account ID
   - Hedera account ID (0.0.xxxxx)

### 3. Connect Xero (Optional)

1. Go to Settings → Integrations
2. Click "Connect Xero"
3. Authorize application
4. Configure account mappings

### 4. Test Payment Flow

#### Test Stripe Payment
1. Create payment link
2. Set amount: $10.00 USD
3. Copy payment URL
4. Use Stripe test card: `4242 4242 4242 4242`
5. Verify payment recorded in dashboard

#### Test Hedera Payment (Testnet)
1. Set `NEXT_PUBLIC_HEDERA_NETWORK="testnet"`
2. Create payment link
3. Use HashPack testnet wallet
4. Send HBAR to merchant account
5. Verify payment detected

### 5. Configure Domain (Custom Domain)

#### Add Custom Domain in Vercel
1. Vercel Dashboard → Project → Settings → Domains
2. Add domain: `app.yourdomain.com`
3. Add DNS records:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```
4. Wait for DNS propagation (5-30 minutes)
5. Vercel auto-provisions SSL certificate

---

## 📊 Monitoring Setup

### 1. Sentry Configuration

Already configured via environment variables. Verify:

1. Trigger test error: `https://[YOUR_DOMAIN]/api/test-sentry`
2. Check Sentry dashboard for error report

### 2. Vercel Analytics

Automatically enabled for all Vercel deployments:
- Dashboard → Analytics
- View page views, TTFB, Core Web Vitals

### 3. Custom Monitoring

Health check endpoint: `GET /api/health`

Set up external uptime monitoring:
- **Recommended:** UptimeRobot, Pingdom, or StatusCake
- **Interval:** 5 minutes
- **Alert on:** HTTP status ≠ 200

### 4. Database Monitoring

Supabase provides built-in monitoring:
- Dashboard → Database → Performance
- Monitor active connections, query performance

### 5. Log Aggregation

Vercel Logs:
```bash
# Install Vercel CLI
vercel logs [PROJECT_NAME] --follow
```

Structured logs (Pino):
- All logs include: timestamp, level, context
- Filter by level: `error`, `warn`, `info`, `debug`

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Build Failures

**Error:** `Type error: Cannot find module 'X'`
```bash
# Solution: Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

**Error:** `Prisma Client not generated`
```bash
# Solution: Generate Prisma Client
npx prisma generate
npm run build
```

#### 2. Database Connection Issues

**Error:** `Can't reach database server`
```bash
# Verify connection string
echo $DATABASE_URL

# Test connection
npx prisma db pull

# Check Supabase dashboard for database status
```

**Error:** `Connection pool timeout`
```bash
# Solution: Use connection pooling URL
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
```

#### 3. Webhook Failures

**Stripe Webhook Error:** `Webhook signature verification failed`
```bash
# Solution: Verify webhook secret
# 1. Check Stripe dashboard for correct secret
# 2. Update STRIPE_WEBHOOK_SECRET in Vercel
# 3. Redeploy
```

**Resend Webhook Error:** `Unauthorized`
```bash
# Solution: Configure webhook secret in Resend dashboard
```

#### 4. Xero OAuth Issues

**Error:** `invalid_grant`
```bash
# Solution: Token expired, reconnect
# 1. User goes to Settings → Integrations
# 2. Click "Reconnect Xero"
# 3. Re-authorize
```

#### 5. Redis Connection Issues

**Error:** `Redis connection failed`
```bash
# Verify credentials
curl -X GET $UPSTASH_REDIS_REST_URL/ping \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"

# Check Upstash dashboard for database status
```

#### 6. Payment Not Detected (Hedera)

**Issue:** Payment sent but not detected

**Solutions:**
1. Verify merchant account ID is correct
2. Check Hedera Mirror Node status
3. Verify token ID matches (USDC, USDT, AUDD)
4. Check transaction on [HashScan](https://hashscan.io)
5. Manual reconciliation: Admin Panel → Orphan Detection

---

## ⏪ Rollback Procedures

### Vercel Rollback

#### Option 1: Dashboard Rollback
1. Vercel Dashboard → Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

#### Option 2: Git Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard [COMMIT_HASH]
git push origin main --force
```

### Database Rollback

**CRITICAL:** Always backup before migrations!

```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Rollback migration (last migration only)
npx prisma migrate resolve --rolled-back [MIGRATION_NAME]

# Restore from backup (if needed)
psql $DATABASE_URL < backup_20251216_120000.sql
```

### Environment Variable Rollback

1. Vercel Dashboard → Settings → Environment Variables
2. Click variable → "View History"
3. Restore previous value

---

## 🔄 CI/CD Pipeline

### Automatic Deployment Workflow

```
Developer pushes to branch
  ↓
GitHub triggers Vercel webhook
  ↓
Vercel builds project
  ↓
Run type checking (tsc --noEmit)
  ↓
Run linting (next lint)
  ↓
Run tests (npm test)
  ↓
Build Next.js app (next build)
  ↓
Deploy to preview URL (branch deployments)
  ↓
Merge to main → Deploy to production
  ↓
Run smoke tests
  ↓
Monitor deployment health
```

### Custom Build Command (Advanced)

Add to `package.json`:
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

---

## 🔐 Security Checklist

### Pre-Production Checklist
- [ ] All environment variables set in Vercel (not committed to Git)
- [ ] `NODE_ENV=production`
- [ ] Stripe live keys configured (not test keys)
- [ ] Xero OAuth redirect URI matches production domain
- [ ] Database has SSL enabled (Supabase default)
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (Upstash Redis)
- [ ] Webhook signature verification enabled
- [ ] Sentry error tracking active
- [ ] Encryption key is 32 bytes (64 hex chars)
- [ ] No test/debug endpoints exposed

### Post-Production Checklist
- [ ] Test Stripe webhook delivery
- [ ] Test Xero OAuth flow
- [ ] Test email delivery (Resend)
- [ ] Monitor error rates (Sentry)
- [ ] Verify SSL certificate auto-renewal
- [ ] Set up uptime monitoring
- [ ] Configure alerting rules
- [ ] Test backup and restore procedures

---

## 📈 Scaling Considerations

### Current Setup (Vercel Free/Pro)
- **Serverless Functions:** Auto-scaling
- **Database:** Supabase Free (2GB) / Pro (8GB+)
- **Redis:** Upstash (10K commands/day free)

### When to Scale

#### Database Scaling
- **Indicator:** > 80% connection pool usage
- **Action:** Upgrade Supabase plan (more connections)

#### Redis Scaling
- **Indicator:** Cache hit rate < 70%
- **Action:** Upgrade Upstash plan (more memory)

#### Application Scaling
- **Indicator:** TTFB > 1s consistently
- **Action:** 
  1. Enable Vercel Edge Network
  2. Optimize database queries
  3. Increase cache TTL

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks

**Weekly:**
- [ ] Review error logs (Sentry)
- [ ] Check failed Xero syncs (Admin Panel)
- [ ] Monitor database growth
- [ ] Review uptime reports

**Monthly:**
- [ ] Update dependencies (`npm outdated`)
- [ ] Review and rotate API keys
- [ ] Database backup verification
- [ ] Performance audit

**Quarterly:**
- [ ] Security audit
- [ ] Dependency vulnerability scan
- [ ] Load testing
- [ ] Disaster recovery drill

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Xero API](https://developer.xero.com/documentation)

---

## 📖 Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Local Development Setup](./LOCAL_DEV_SETUP.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

---

**Last Updated:** December 16, 2025  
**Maintained By:** Provvypay Engineering Team  
**Questions?** Contact: engineering@provvypay.com








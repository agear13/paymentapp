# ✅ Production Environment Setup Checklist

Use this checklist to track your production setup progress.

**Setup Start Date:** _______________  
**Completed By:** _______________  
**Go-Live Date:** _______________

---

## Phase 1: Pre-Setup (30 minutes)

- [ ] Review PRODUCTION_SETUP_GUIDE.md
- [ ] Ensure all prerequisite accounts are created
- [ ] Gather all API keys and credentials
- [ ] Set up production domains (DNS configured)
- [ ] Provision production database
- [ ] Create backup storage (S3 bucket or equivalent)

---

## Phase 2: Environment Configuration (60 minutes)

### 2.1 Create Environment File
- [ ] Copy `.env.production.template` to `.env.production`
- [ ] Set file permissions (600 on Unix/Mac)
- [ ] Generate secure keys: `npm run generate-keys`

### 2.2 Application Settings
- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_APP_URL` (https://app.provvypay.com)
- [ ] `NEXT_PUBLIC_API_URL` (https://api.provvypay.com)
- [ ] `NEXT_PUBLIC_PAYMENT_URL` (https://pay.provvypay.com)

### 2.3 Database Configuration
- [ ] `DATABASE_URL` (PostgreSQL connection string with SSL)
- [ ] `DATABASE_POOL_MIN=10`
- [ ] `DATABASE_POOL_MAX=50`
- [ ] Test connection: `npx prisma db push --preview-feature`

### 2.4 Authentication & Security
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SUPABASE_JWT_SECRET`
- [ ] `SESSION_SECRET` (32+ chars, from generate-keys)
- [ ] `ENCRYPTION_KEY` (32+ chars, from generate-keys)
- [ ] `API_RATE_LIMIT_MAX=100`
- [ ] `API_CORS_ORIGIN` (production domain)

### 2.5 Stripe Integration
- [ ] Switch Stripe dashboard to **LIVE MODE**
- [ ] `STRIPE_PUBLISHABLE_KEY` (pk_live_...)
- [ ] `STRIPE_SECRET_KEY` (sk_live_...)
- [ ] Create webhook endpoint in Stripe dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` (whsec_...)
- [ ] Test webhook: `stripe listen --forward-to [url]`

### 2.6 Hedera Integration
- [ ] Create/fund Hedera mainnet account
- [ ] `HEDERA_NETWORK=mainnet`
- [ ] `HEDERA_ACCOUNT_ID` (0.0.xxxxx)
- [ ] `HEDERA_PRIVATE_KEY`
- [ ] `HEDERA_AUDD_TOKEN_ID=0.0.456858`
- [ ] `HEDERA_AUDD_ACCOUNT_ID=0.0.1054`
- [ ] Associate USDC token with account
- [ ] Associate AUDD token with account
- [ ] Test transaction on mainnet

### 2.7 Xero Integration
- [ ] Create production OAuth app in Xero
- [ ] `XERO_CLIENT_ID`
- [ ] `XERO_CLIENT_SECRET`
- [ ] `XERO_REDIRECT_URI` (must match exactly)
- [ ] Verify account codes match Xero chart of accounts:
  - [ ] `XERO_REVENUE_ACCOUNT=200`
  - [ ] `XERO_AR_ACCOUNT=610`
  - [ ] `XERO_AUDD_CLEARING_ACCOUNT=1054` ⚠️ **CRITICAL**
  - [ ] Other clearing accounts (1200, 1210, 1211, 1212)
- [ ] Test OAuth flow

### 2.8 FX Rate Providers
- [ ] `COINGECKO_API_KEY` (Pro plan recommended)
- [ ] `COINMARKETCAP_API_KEY` (optional backup)
- [ ] `FX_CACHE_TTL=300000` (5 minutes)
- [ ] `FX_FALLBACK_ENABLED=true`
- [ ] Test rate fetching

### 2.9 Email Service
- [ ] Choose provider (SendGrid/Resend/SMTP)
- [ ] `EMAIL_FROM=noreply@provvypay.com`
- [ ] `SENDGRID_API_KEY` or `RESEND_API_KEY` or SMTP config
- [ ] Send test email

### 2.10 Monitoring & Logging
- [ ] Create Sentry project
- [ ] `SENTRY_DSN`
- [ ] `SENTRY_ENVIRONMENT=production`
- [ ] `LOG_LEVEL=info`
- [ ] Test error tracking

### 2.11 Payment Tolerances
- [ ] `PAYMENT_TOLERANCE_AUDD=0.1` ⚠️ **CRITICAL**
- [ ] `PAYMENT_TOLERANCE_STRIPE=0.5`
- [ ] `PAYMENT_TOLERANCE_HBAR=1.0`
- [ ] `PAYMENT_TOLERANCE_USDC=0.5`
- [ ] `PAYMENT_TOLERANCE_USDT=0.5`

---

## Phase 3: Validation & Testing (45 minutes)

### 3.1 Environment Validation
- [ ] Run: `npm run validate-env`
- [ ] Fix any errors reported
- [ ] Fix any critical warnings
- [ ] Review and acknowledge warnings

### 3.2 Database Setup
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Verify migration status: `npx prisma migrate status`
- [ ] Test database connection

### 3.3 Build Application
- [ ] Run: `npm run build`
- [ ] Verify build completes without errors
- [ ] Check build output size

### 3.4 Health Checks
- [ ] Start application: `npm run start`
- [ ] Test: `curl http://localhost:3000/api/health`
- [ ] Verify all services healthy:
  - [ ] Database
  - [ ] Stripe
  - [ ] Hedera
  - [ ] Xero
  - [ ] FX providers
  - [ ] Email

### 3.5 Integration Tests
- [ ] Create test organization
- [ ] Create test payment link
- [ ] Process test Stripe payment
- [ ] Process test Hedera payment (small amount)
- [ ] Verify ledger entries created
- [ ] Verify Xero sync works
- [ ] Check AUDD account is 1054
- [ ] Verify FX rates are captured
- [ ] Test webhook replay protection
- [ ] Test email notifications

---

## Phase 4: Deployment (Variable)

### 4.1 Pre-Deployment
- [ ] Review PRODUCTION_DEPLOYMENT_CHECKLIST.md
- [ ] All tests passing
- [ ] All integrations verified
- [ ] Monitoring configured
- [ ] Backup system tested
- [ ] Rollback procedure tested

### 4.2 Deployment Method
Choose one:

**Option A: Vercel**
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Login: `vercel login`
- [ ] Add all environment variables
- [ ] Deploy: `vercel --prod`
- [ ] Verify deployment

**Option B: Docker**
- [ ] Build image: `docker build -t provvypay:latest .`
- [ ] Test locally
- [ ] Push to registry
- [ ] Deploy to production server
- [ ] Verify container running

**Option C: PM2**
- [ ] Install PM2: `npm install -g pm2`
- [ ] Start: `pm2 start npm --name provvypay -- start`
- [ ] Save: `pm2 save`
- [ ] Setup startup: `pm2 startup`

### 4.3 Post-Deployment
- [ ] Verify health endpoint: https://api.provvypay.com/api/health
- [ ] Test payment page loads
- [ ] Create real payment link
- [ ] Monitor logs for errors
- [ ] Check Sentry for issues

---

## Phase 5: Monitoring & Alerts (30 minutes)

### 5.1 Configure Alerts
- [ ] Database down (P0)
- [ ] Stripe webhook failures (P1)
- [ ] Hedera network issues (P1)
- [ ] Payment processing errors (P2)
- [ ] High error rate >1% (P2)
- [ ] Xero sync failures (P2)
- [ ] FX provider failures (P3)
- [ ] High latency >2s (P3)

### 5.2 Set Up Dashboards
- [ ] Payment volume dashboard
- [ ] Success rates by payment method
- [ ] Error rate tracking
- [ ] Response time metrics
- [ ] Currency conversion tracking

### 5.3 Backup Verification
- [ ] Automated backup running
- [ ] Test backup restore procedure
- [ ] Verify backup retention policy
- [ ] Document restore process

---

## Phase 6: Documentation (15 minutes)

- [ ] Update team wiki with production URLs
- [ ] Document environment access procedures
- [ ] Share emergency contacts
- [ ] Create on-call schedule
- [ ] Document escalation procedures
- [ ] Review OPERATIONS_RUNBOOK.md with team

---

## Phase 7: Legal & Compliance (External Timeline)

- [ ] PCI DSS compliance verified
- [ ] GDPR requirements met
- [ ] CCPA compliance checked
- [ ] Terms of Service reviewed
- [ ] Privacy Policy reviewed
- [ ] Legal sign-off obtained

---

## Phase 8: Go-Live Preparation (30 minutes)

### 8.1 Final Checks
- [ ] All above items completed
- [ ] Test payment flows one more time
- [ ] Verify all monitoring active
- [ ] Check backup systems
- [ ] Review rollback procedure
- [ ] Team briefed on operations

### 8.2 Launch Communication
- [ ] Notify stakeholders of go-live
- [ ] Share status page (if applicable)
- [ ] Prepare support team
- [ ] Set up incident response
- [ ] Document known issues (if any)

### 8.3 Go-Live
- [ ] Switch traffic to production
- [ ] Monitor closely for first 24 hours
- [ ] Watch error rates
- [ ] Check payment success rates
- [ ] Verify all integrations working
- [ ] Be ready to rollback if needed

---

## Phase 9: Post-Launch (First 48 hours)

- [ ] Monitor error rates (target: <0.1%)
- [ ] Check payment success rates (target: >99%)
- [ ] Verify all Xero syncs working
- [ ] Review Sentry errors
- [ ] Check database performance
- [ ] Verify backup completed
- [ ] Gather user feedback
- [ ] Document any issues
- [ ] Create follow-up tasks

---

## Quick Commands Reference

```bash
# Generate secure keys
npm run generate-keys

# Validate environment
npm run validate-env

# Run database migrations
npx prisma migrate deploy

# Build for production
npm run build

# Start production server
npm run start

# Health check
curl https://api.provvypay.com/api/health

# View logs (PM2)
pm2 logs provvypay

# Restart application (PM2)
pm2 restart provvypay
```

---

## Critical Configuration Values

**MUST BE CORRECT:**

1. `HEDERA_NETWORK=mainnet` (NOT testnet!)
2. `STRIPE_SECRET_KEY=sk_live_...` (NOT sk_test_!)
3. `XERO_AUDD_CLEARING_ACCOUNT=1054` (MUST be 1054!)
4. `PAYMENT_TOLERANCE_AUDD=0.1` (0.1%, not 1%!)
5. All URLs must start with `https://`
6. `NODE_ENV=production`

---

## Emergency Contacts

**Stripe Issues:**
- Support: https://support.stripe.com
- Phone: _______________

**Hedera Issues:**
- Support: https://hedera.com/support
- Discord: _______________

**Xero Issues:**
- Support: https://developer.xero.com/support
- Phone: _______________

**Infrastructure:**
- Hosting Provider: _______________
- Database Provider: _______________
- On-Call Engineer: _______________

---

## Sign-Off

**Setup Completed By:** _______________  
**Date:** _______________  
**Verified By:** _______________  
**Date:** _______________  

**Production Go-Live Approved:** ☐ Yes ☐ No  
**Approved By:** _______________  
**Date:** _______________  

---

## Notes

_Use this space to document any issues, deviations, or special configurations:_

```

```

---

**Last Updated:** December 20, 2025  
**Version:** 1.0  
**Maintained by:** Provvypay Platform Team






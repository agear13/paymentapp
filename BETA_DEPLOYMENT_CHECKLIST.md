# Beta Testing Deployment Checklist

Use this checklist to ensure your beta environment is properly configured before inviting testers.

---

## Pre-Deployment

### 1. Code Preparation
- [ ] Create `beta` branch from `main`
- [ ] Ensure all features are working in development
- [ ] Run tests: `npm run test`
- [ ] Run linting: `npm run lint`
- [ ] Build succeeds: `npm run build`

### 2. Database Setup
- [ ] Create separate beta database (or separate schema)
- [ ] Run migrations: `npm run db:migrate`
- [ ] Verify database connection
- [ ] (Optional) Seed initial data: `npm run db:seed`

### 3. Environment Configuration
- [ ] Copy `beta-env-template.txt` to prepare variables
- [ ] Generate encryption keys (see template for command)
- [ ] Configure Supabase (production or separate beta project)
- [ ] Get Stripe TEST keys (must start with `sk_test_`)
- [ ] Verify Hedera is set to TESTNET
- [ ] Create Xero developer app
- [ ] Configure all required environment variables

---

## Stripe Setup (TEST MODE)

- [ ] Log in to Stripe Dashboard
- [ ] Switch to **Test Mode** (toggle in top-left)
- [ ] Go to Developers → API keys
- [ ] Copy **Publishable key** (starts with `pk_test_`)
- [ ] Copy **Secret key** (starts with `sk_test_`)
- [ ] Save to environment variables

### Webhook Configuration

**For deployed beta environment:**
- [ ] Go to Developers → Webhooks
- [ ] Click "Add endpoint"
- [ ] URL: `https://your-service-name.onrender.com/api/stripe/webhook`
- [ ] Events to select:
  - [ ] `checkout.session.completed`
  - [ ] `checkout.session.expired`
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
- [ ] Click "Add endpoint"
- [ ] Copy "Signing secret" (starts with `whsec_`)
- [ ] Add to `STRIPE_WEBHOOK_SECRET` environment variable

**For local testing (optional):**
```bash
# Install Stripe CLI
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the webhook secret shown
```

---

## Hedera Setup (TESTNET)

- [ ] Verify `NEXT_PUBLIC_HEDERA_NETWORK=testnet`
- [ ] Verify mirror node URL: `https://testnet.mirrornode.hedera.com`
- [ ] Configure testnet token IDs:
  - [ ] USDC: `0.0.429274`
  - [ ] USDT: `0.0.429275`
  - [ ] AUDD: `0.0.429276` (if available)

### Optional: Create Test Account for Receiving
- [ ] Create HashPack wallet
- [ ] Switch to testnet
- [ ] Get testnet HBAR from faucet: https://portal.hedera.com/faucet
- [ ] Associate testnet tokens (USDC, USDT)
- [ ] Add account ID to environment variables (optional)

---

## Xero Setup (DEVELOPER APP)

- [ ] Go to https://developer.xero.com/
- [ ] Sign in or create account
- [ ] Click "My Apps" → "New app"
- [ ] App details:
  - [ ] Name: "Provvypay Beta" (or similar)
  - [ ] Company URL: Your website
  - [ ] OAuth redirect URI: `https://your-beta-domain.vercel.app/api/xero/callback`
- [ ] Click "Create app"
- [ ] Copy Client ID
- [ ] Click "Generate a secret" → Copy Client Secret
- [ ] Add both to environment variables

### Create Demo Company (for testing)
- [ ] In Xero Developer Portal, click "Try the Demo Company"
- [ ] Create or access demo organization
- [ ] Note credentials for beta testers

---

## Render Deployment

### 1. Create New Web Service
- [ ] Log in to Render Dashboard
- [ ] Click "New +" → "Web Service"
- [ ] Connect your repository (if not already connected)
- [ ] Select the `beta` branch

### 2. Configure Build Settings
- [ ] Name: `provvypay-beta` (or your preferred name)
- [ ] Environment: `Node`
- [ ] Region: Choose closest to your users
- [ ] Branch: `beta`
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm start`
- [ ] Instance Type: Choose appropriate tier (Free/Starter/Standard)

### 3. Add Environment Variables
- [ ] In the Environment section, click "Add Environment Variable"
- [ ] Add all variables from `beta-env-template.txt` one by one
- [ ] OR use "Add from .env" to bulk import
- [ ] Double-check each value
- [ ] **CRITICAL CHECKS:**
  - [ ] `STRIPE_SECRET_KEY` starts with `sk_test_`
  - [ ] `NEXT_PUBLIC_HEDERA_NETWORK` is `testnet`
  - [ ] `DATABASE_URL` points to beta database
  - [ ] `NEXT_PUBLIC_APP_URL` matches deployment URL (will be `https://your-service-name.onrender.com`)

### 4. Deploy
- [ ] Click "Create Web Service"
- [ ] Wait for initial deployment to complete (~5-10 minutes)
- [ ] Note the deployment URL: `https://your-service-name.onrender.com`
- [ ] Monitor build logs for any errors

### 5. Configure Custom Domain (Optional)
- [ ] Go to your service → Settings → Custom Domain
- [ ] Add custom domain: `beta.yourdomain.com`
- [ ] Configure DNS CNAME record as instructed
- [ ] Wait for SSL certificate provisioning (~15 minutes)

### 6. Configure Auto-Deploy (Recommended)
- [ ] In Settings → Build & Deploy
- [ ] Enable "Auto-Deploy" for the `beta` branch
- [ ] This will automatically redeploy on git pushes

---

## Post-Deployment Verification

### 1. Health Checks
- [ ] Visit deployment URL
- [ ] Homepage loads correctly
- [ ] No console errors (check browser dev tools)
- [ ] Check for any build warnings

### 2. Authentication Test
- [ ] Try to access `/dashboard` (should redirect to login)
- [ ] Visit `/auth/login`
- [ ] Sign up with test email
- [ ] Check email for verification
- [ ] Verify email and sign in
- [ ] Redirects to dashboard or onboarding

### 3. Database Connectivity
- [ ] Create organization via onboarding
- [ ] Check database for created organization
- [ ] Verify merchant settings created

### 4. Payment Integration Tests

**Stripe:**
- [ ] Create payment link
- [ ] Open payment page
- [ ] Stripe option appears
- [ ] Click "Pay" → redirects to Stripe
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Payment completes successfully
- [ ] Webhook received (check Vercel logs)
- [ ] Payment link status → PAID
- [ ] Ledger entries created

**Hedera:**
- [ ] Install HashPack (testnet mode)
- [ ] Get testnet HBAR from faucet
- [ ] Create payment link
- [ ] Open payment page
- [ ] Connect HashPack
- [ ] Send HBAR payment
- [ ] Payment detected within 10 seconds
- [ ] Status → PAID
- [ ] Transaction recorded

**Xero:**
- [ ] Connect Xero in Settings → Integrations
- [ ] Select demo company
- [ ] Connection shows "Connected"
- [ ] Make a test payment
- [ ] Check Xero sync status → SUCCESS
- [ ] Verify in Xero demo company: invoice + payment created

### 5. Monitoring Setup
- [ ] Access Render logs: Dashboard → Your Service → Logs
- [ ] Set up log alerts in Render (Settings → Notifications)
- [ ] Set up Sentry (if configured)
- [ ] Test error reporting (trigger test error)
- [ ] Set up uptime monitoring (optional - UptimeRobot, etc.)

---

## Beta Tester Onboarding Preparation

### 1. Documentation
- [ ] Review `BETA_TESTER_QUICK_START.md`
- [ ] Customize with your specific URLs and contact info
- [ ] Add any additional instructions specific to your setup

### 2. Test Data (Optional)
- [ ] Run beta user setup script:
  ```bash
  npx tsx scripts/setup-beta-user.ts --email beta@example.com --name "Beta Tester" --with-links
  ```
- [ ] Or manually create test organization
- [ ] Create sample payment links

### 3. Communication
- [ ] Prepare welcome email
- [ ] Include beta environment URL
- [ ] Attach or link to beta tester documentation
- [ ] Provide support contact information
- [ ] Set expectations (testing period, feedback format)

### 4. Support Readiness
- [ ] Set up communication channel (email, Slack, etc.)
- [ ] Prepare FAQ document
- [ ] Test your own access to logs and database
- [ ] Have troubleshooting guide ready

---

## Invite Beta Tester

### Email Template

```
Subject: Welcome to Provvypay Beta Testing!

Hi [Beta Tester Name],

Thank you for agreeing to help test Provvypay! Your feedback will be invaluable.

🌐 Beta Environment URL:
https://your-beta-domain.vercel.app

📚 Quick Start Guide:
[Attach or link to BETA_TESTER_QUICK_START.md]

🔧 What You'll Be Testing:
- Account creation and onboarding
- Payment link creation
- Stripe test payments (no real money!)
- Hedera crypto payments (testnet only)
- Xero integration (demo company)
- Transaction and ledger displays

⏱️ Time Commitment:
Approximately 1-2 hours for initial testing

📝 Feedback:
Please report any issues, confusing UI elements, or suggestions to:
[Your email or feedback form]

🆘 Need Help?
Contact me at [your email] or [your phone/Slack]

Key Resources:
- Testnet HBAR Faucet: https://portal.hedera.com/faucet
- HashPack Wallet: https://www.hashpack.app/
- Xero Developer Portal: https://developer.xero.com/

Test Cards (Stripe):
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)

Thank you for your help! 🙏

Best regards,
[Your Name]
```

---

## During Beta Testing

### Monitor These:

- [ ] Check Render logs regularly (Dashboard → Service → Logs)
- [ ] Monitor error rates (Sentry if configured)
- [ ] Watch database for activity
- [ ] Track payment completion rates
- [ ] Note any failed webhooks
- [ ] Check Xero sync success rates

**Accessing Render Logs:**
- Dashboard → Your Service → Logs → Enable "Live tail"
- Or use Render CLI: `render logs --service your-service-name --tail`

### Be Ready to Help With:

- [ ] HashPack testnet setup issues
- [ ] Getting testnet HBAR from faucet
- [ ] Xero demo company access
- [ ] Any UI confusion
- [ ] Payment not detecting
- [ ] Data not appearing correctly

---

## Post-Beta Testing

### Collect Feedback
- [ ] Request completed feedback form/survey
- [ ] Schedule debrief call/meeting
- [ ] Document all reported issues
- [ ] Prioritize bugs vs. enhancements

### Cleanup (Optional)
- [ ] Delete test data if desired
- [ ] Keep beta environment running for future testing
- [ ] Or tear down and recreate for next round

### Apply Learnings
- [ ] Fix critical bugs before production
- [ ] Improve documentation based on feedback
- [ ] Update UI based on confusion points
- [ ] Refine onboarding flow if needed

---

## Final Checks Before Production

After successful beta testing:

- [ ] All critical bugs fixed
- [ ] Documentation updated
- [ ] Onboarding flow refined
- [ ] Error handling improved
- [ ] Performance optimized based on feedback
- [ ] Switch to production integrations:
  - [ ] Stripe LIVE keys
  - [ ] Hedera MAINNET
  - [ ] Xero production OAuth app
  - [ ] Production database
- [ ] Run full security audit
- [ ] Load testing (if needed)
- [ ] Final deployment checklist completed

---

**Good luck with your beta testing! 🚀**


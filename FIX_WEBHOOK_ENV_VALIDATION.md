# 🚨 FIX: Webhook Environment Validation Error

**Current Issue:** Webhook returns 500 error with "Environment validation failed"

**Root Cause:** One or more required environment variables are missing or invalid in Render

---

## 🎯 **Required Environment Variables**

These MUST be set in Render for the webhook to work:

### **Core (Required)**
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://provvypay-api.onrender.com
```

### **Database (Required)**
```bash
DATABASE_URL=postgresql://...
```

### **Supabase Auth (Required)**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

### **Stripe LIVE Mode (Required)**
```bash
STRIPE_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  ← MUST be from LIVE mode webhook
```

### **Hedera Mainnet (Required)**
```bash
NEXT_PUBLIC_HEDERA_NETWORK=mainnet
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com
```

### **Security (Required)**
```bash
ENCRYPTION_KEY=<base64-encoded-32-byte-key>
```

---

## ✅ **How to Fix**

### **Step 1: Check Current Variables in Render**

1. Go to **Render Dashboard** → Your Service → **Environment**
2. Scroll through ALL variables
3. Check for:
   - ❌ Variables that are NOT set
   - ❌ Variables with "placeholder" or "example.com"
   - ❌ Empty values
   - ❌ Invalid URLs (must start with https://)

### **Step 2: Most Likely Missing/Invalid**

Based on the error, check these specifically:

#### **1. ENCRYPTION_KEY**
**Problem:** Might be missing or too short

**Check:**
```bash
# In Render, find ENCRYPTION_KEY
# Should be 32+ characters, base64 encoded
```

**Fix:**
```bash
# Generate a new one:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Copy output and set in Render:
ENCRYPTION_KEY=<paste-generated-key>
```

#### **2. STRIPE_WEBHOOK_SECRET**
**Problem:** Might be test mode secret but using live payments

**Check:**
- You're making LIVE payments (livemode: true)
- But webhook secret might be from TEST mode

**Fix:**
1. Go to https://dashboard.stripe.com/webhooks (LIVE mode, not test)
2. Click your webhook endpoint
3. Click "Reveal" under Signing secret
4. Copy the secret (starts with `whsec_`)
5. Update in Render: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

#### **3. NEXT_PUBLIC_APP_URL**
**Problem:** Might not be a valid URL

**Fix:**
```bash
NEXT_PUBLIC_APP_URL=https://provvypay-api.onrender.com
# Make sure it:
# - Starts with https://
# - No trailing slash
# - Matches your actual Render URL
```

#### **4. NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL**
**Problem:** Might not be a valid URL

**Fix:**
```bash
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com
# Must be a valid URL with https://
```

### **Step 3: Run Diagnostic**

In Render Shell or locally:

```bash
node scripts/check-missing-env-vars.js
```

This will tell you EXACTLY which variables are missing or invalid!

### **Step 4: Fix and Redeploy**

1. Fix all missing/invalid variables in Render
2. Click "Save Changes"
3. Wait for redeployment (2-3 minutes)
4. Check logs for successful startup (no validation errors)
5. Try making another payment

---

## 🔍 **How to Find Which Variable is Invalid**

Since Render logs don't show the details, run this in **Render Shell**:

```bash
# Go to Render Dashboard → Your Service → Shell
# Then run:

node -e "
const z = require('zod');

const required = [
  'NODE_ENV',
  'NEXT_PUBLIC_APP_URL',
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_HEDERA_NETWORK',
  'NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL',
  'ENCRYPTION_KEY'
];

console.log('Checking required environment variables...\n');

required.forEach(v => {
  const val = process.env[v];
  if (!val || val.trim() === '') {
    console.log('❌ MISSING:', v);
  } else if (val.includes('placeholder')) {
    console.log('⚠️  PLACEHOLDER:', v);
  } else if (v.includes('URL') && !val.startsWith('http')) {
    console.log('❌ INVALID URL:', v);
  } else {
    console.log('✅', v, ':', val.substring(0, 20) + '...');
  }
});
"
```

This will show you EXACTLY which variable is the problem!

---

## 🚨 **Common Issues**

### **Issue 1: Using Test Webhook Secret with Live Payments**

**Symptoms:**
- Payments show `"livemode": true` in Stripe
- But webhook has test mode secret

**Fix:**
- Get LIVE mode webhook secret from Stripe
- Update `STRIPE_WEBHOOK_SECRET` in Render

### **Issue 2: ENCRYPTION_KEY Missing**

**Symptoms:**
- "Environment validation failed"
- ENCRYPTION_KEY not set in Render

**Fix:**
```bash
# Generate:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to Render:
ENCRYPTION_KEY=<generated-value>
```

### **Issue 3: Invalid URL Format**

**Symptoms:**
- "Invalid environment variables"
- URL doesn't start with https://

**Fix:**
- Ensure ALL URLs start with `https://`
- No trailing slashes
- Valid domain names

---

## 📋 **Quick Checklist**

Before webhook will work, verify:

- [ ] `ENCRYPTION_KEY` is set and 32+ characters
- [ ] `STRIPE_WEBHOOK_SECRET` is from LIVE mode (if using live payments)
- [ ] `NEXT_PUBLIC_APP_URL` is valid URL starting with https://
- [ ] `NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL` is valid URL
- [ ] All Supabase keys are set (3 variables)
- [ ] All Stripe keys are set (3 variables)
- [ ] `DATABASE_URL` is set
- [ ] No variables have "placeholder" or "example" values
- [ ] Saved changes and redeployed

---

## 🆘 **Still Not Working?**

Run the diagnostic in Render Shell and paste the output here:

```bash
node scripts/check-missing-env-vars.js
```

This will show EXACTLY which variables need to be fixed!

---

## ⚡ **After Fixing**

1. All environment variables set correctly ✅
2. Redeploy completes successfully ✅
3. Make a test payment
4. Webhook should work! ✅
5. Invoice updates to PAID ✅


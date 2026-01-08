# 🎯 Beta Testing Setup - Quick Reference

**For:** Provvypay Beta Testing on Render  
**Platform:** Render (NOT Vercel)

---

## 📚 Documentation Files

Start here → **[BETA_TESTING_INDEX.md](./BETA_TESTING_INDEX.md)**

### All Documents:

1. **BETA_TESTING_INDEX.md** - Navigation hub (START HERE)
2. **BETA_TESTING_OVERVIEW.md** - Complete overview
3. **BETA_DEPLOYMENT_CHECKLIST.md** - Step-by-step deployment
4. **BETA_TESTING_SETUP_GUIDE.md** - Technical reference
5. **BETA_TESTER_QUICK_START.md** - For your beta tester
6. **RENDER_SPECIFIC_NOTES.md** - Render platform specifics ⭐
7. **beta-env-template.txt** - Environment variables
8. **scripts/setup-beta-user.ts** - Automation script

---

## ⚡ Quick Start (30 Second Version)

```bash
# 1. Read the overview
open BETA_TESTING_INDEX.md

# 2. Since you're on Render, also read:
open RENDER_SPECIFIC_NOTES.md

# 3. Follow the deployment checklist
open BETA_DEPLOYMENT_CHECKLIST.md

# 4. When ready, run setup script
npx tsx scripts/setup-beta-user.ts \
  --email beta@example.com \
  --name "Beta Tester" \
  --with-links

# 5. Give your tester the quick start guide
# (Customize BETA_TESTER_QUICK_START.md first!)
```

---

## 🎯 Key Points for Render Deployment

### Your Platform: Render (Not Vercel)

**Important differences:**
- ✅ Deploy to: Render Dashboard → New Web Service
- ✅ URL format: `https://your-service-name.onrender.com`
- ✅ Environment vars: Service → Environment tab
- ✅ Logs: Dashboard → Service → Logs
- ✅ Auto-deploy: Settings → Build & Deploy

**See RENDER_SPECIFIC_NOTES.md for complete Render instructions**

---

## 🔧 Environment Configuration

### Required Environment Variables

Copy from `beta-env-template.txt` and update:

**Critical for Render:**
```bash
NEXT_PUBLIC_APP_URL=https://your-service-name.onrender.com
XERO_REDIRECT_URI=https://your-service-name.onrender.com/api/xero/callback
```

**Stripe Webhook:**
```bash
# Update in Stripe Dashboard:
https://your-service-name.onrender.com/api/stripe/webhook
```

---

## ✅ Pre-Flight Checklist

Before starting:

- [ ] Read BETA_TESTING_INDEX.md
- [ ] Read RENDER_SPECIFIC_NOTES.md (Render-specific)
- [ ] Have Render account ready
- [ ] Have Stripe test keys
- [ ] Have Xero developer app
- [ ] Have 2-3 hours for setup

---

## 🚀 Deployment Steps (High Level)

1. **Create beta branch**
   ```bash
   git checkout -b beta
   git push origin beta
   ```

2. **Deploy on Render**
   - Dashboard → New Web Service
   - Select `beta` branch
   - Configure build/start commands
   - Add environment variables

3. **Configure webhooks**
   - Update Stripe webhook URL
   - Update Xero redirect URI

4. **Prepare beta user**
   ```bash
   npx tsx scripts/setup-beta-user.ts --email beta@example.com --name "Beta"
   ```

5. **Invite beta tester**
   - Customize BETA_TESTER_QUICK_START.md
   - Send to beta tester

**Full details:** BETA_DEPLOYMENT_CHECKLIST.md

---

## 📊 What Gets Tested

✅ Account creation & login  
✅ Organization onboarding  
✅ Stripe payments (test mode)  
✅ Hedera payments (testnet)  
✅ Xero integration (demo company)  
✅ Payment links table  
✅ Ledger entries  
✅ Transaction history  
✅ Data exports  

**All in safe sandbox environment - no real money!**

---

## 🐛 Troubleshooting

**Issue: Can't find Render-specific instructions**
→ Read: RENDER_SPECIFIC_NOTES.md

**Issue: Deployment fails**
→ Check Render logs: Dashboard → Service → Logs

**Issue: Webhooks not working**
→ Verify URLs point to Render (not Vercel)

**Issue: Environment variables not loading**
→ Redeploy after adding variables

**Full troubleshooting:** BETA_TESTING_SETUP_GUIDE.md Section 5

---

## 📞 Support

**Documentation:**
- Start: BETA_TESTING_INDEX.md
- Render specifics: RENDER_SPECIFIC_NOTES.md
- Full guide: BETA_TESTING_SETUP_GUIDE.md

**Render Support:**
- Docs: https://render.com/docs
- Community: https://community.render.com/

---

## 🎉 Ready to Start?

1. Open **BETA_TESTING_INDEX.md**
2. Read **RENDER_SPECIFIC_NOTES.md**
3. Follow **BETA_DEPLOYMENT_CHECKLIST.md**

**Good luck! 🚀**

---

**Note:** All documentation has been updated for Render deployment. Ignore any remaining "Vercel" references - they should say "Render" instead.


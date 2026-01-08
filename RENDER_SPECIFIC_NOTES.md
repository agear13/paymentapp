# Render-Specific Setup Notes for Beta Testing

Since you're deploying on **Render** (not Vercel), here are the specific differences and instructions:

---

## 🚀 Deploying Beta Environment on Render

### Creating a New Web Service for Beta

1. **Go to Render Dashboard:** https://dashboard.render.com/
2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your repository (if not already connected)
   - **Select the `beta` branch** (create this branch first)
   
3. **Configure Service:**
   ```
   Name: provvypay-beta
   Environment: Node
   Region: [Choose your region]
   Branch: beta
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

4. **Choose Instance Type:**
   - Free tier: For testing only (spins down after inactivity)
   - Starter ($7/month): Recommended for beta testing
   - Standard: For production-like testing

---

## 🔧 Environment Variables on Render

### How to Add Environment Variables

**Method 1: Individual Variables (Recommended for first time)**
1. Go to your service → Environment
2. Click "Add Environment Variable"
3. Enter Key and Value
4. Click "Save Changes"
5. Repeat for each variable

**Method 2: Bulk Import from File**
1. Go to your service → Environment
2. Click "Add from .env"
3. Paste the contents of your `.env` file
4. Click "Save"

**Important:** Render automatically redeploys when you save environment variables.

### Your Beta Environment URL

After deployment, your app will be available at:
```
https://your-service-name.onrender.com
```

Example:
```
https://provvypay-beta.onrender.com
```

---

## 🔗 Webhook Configuration for Render

### Stripe Webhooks

Update your Stripe webhook endpoint:
```
https://your-service-name.onrender.com/api/stripe/webhook
```

Steps:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-service-name.onrender.com/api/stripe/webhook`
4. Select events: `checkout.session.completed`, `payment_intent.succeeded`, etc.
5. Copy the webhook signing secret
6. Add to Render environment variables as `STRIPE_WEBHOOK_SECRET`

### Xero OAuth Redirect URI

Update your Xero app redirect URI:
```
https://your-service-name.onrender.com/api/xero/callback
```

Steps:
1. Go to Xero Developer Portal
2. Edit your app
3. Set OAuth 2.0 redirect URI: `https://your-service-name.onrender.com/api/xero/callback`
4. Save changes

---

## 📊 Monitoring & Logs on Render

### Viewing Logs

**Real-time logs:**
1. Go to your service in Render Dashboard
2. Click "Logs" tab
3. Toggle "Live tail" to see real-time logs
4. Use search to filter logs

**Download logs:**
1. In Logs tab
2. Click "Download" to save logs locally

**Using Render CLI (Optional):**
```bash
# Install Render CLI
npm install -g render

# Login
render login

# View logs
render logs --service your-service-name --tail

# View logs for specific time range
render logs --service your-service-name --since 1h
```

### Setting Up Log Alerts

1. Go to service → Settings → Notifications
2. Add notification methods (email, Slack, Discord)
3. Configure alert conditions:
   - Failed deploys
   - Service crashes
   - Health check failures

---

## 🔄 Auto-Deploy Configuration

Render supports auto-deploy from GitHub/GitLab:

1. Go to service → Settings → Build & Deploy
2. **Auto-Deploy:** ON (recommended for beta branch)
3. This means every push to `beta` branch will trigger a deployment

**To manually deploy:**
- Go to your service → Manual Deploy → "Deploy latest commit"

---

## 💾 Database Configuration

If using a separate beta database:

### Option 1: Create New PostgreSQL Database on Render

1. Click "New +" → "PostgreSQL"
2. Name: `provvypay-beta-db`
3. Choose instance type
4. After creation, copy the "Internal Database URL"
5. Add to your web service as `DATABASE_URL`

**Benefit:** Internal URL is faster (no external network)

### Option 2: Use Existing Database with Separate Schema

Keep same database but use different schema:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=beta
```

---

## 🌐 Custom Domain Setup on Render

If you want `beta.yourdomain.com`:

1. Go to service → Settings → Custom Domain
2. Click "Add Custom Domain"
3. Enter: `beta.yourdomain.com`
4. Render will provide a CNAME record
5. Add CNAME record to your DNS:
   ```
   Type: CNAME
   Name: beta
   Value: [provided by Render]
   ```
6. Wait for DNS propagation (~15 minutes)
7. SSL certificate will be automatically provisioned

---

## ⚡ Performance & Scaling on Render

### Free Tier Considerations

**If using free tier:**
- ⚠️ Services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds to wake up
- Not recommended for actual beta testing
- Good for quick verification only

**Recommendation for beta testing:**
- Use **Starter plan** ($7/month minimum)
- Stays always active
- Better performance
- Can handle multiple beta testers

### Health Checks

Render automatically pings your service. If it fails:
1. Service is restarted automatically
2. You receive a notification (if configured)

Configure health check path:
- Settings → Health & Alerts → Health Check Path: `/api/health`

Make sure you have a health endpoint at `/api/health`

---

## 🔒 Environment-Specific Settings

Update these environment variables for Render:

```bash
# Set to your Render URL
NEXT_PUBLIC_APP_URL=https://your-service-name.onrender.com

# Render uses NODE_ENV=production by default
NODE_ENV=production

# If using Render PostgreSQL
DATABASE_URL=[provided by Render]
DIRECT_URL=[provided by Render]
```

---

## 🐛 Troubleshooting Render-Specific Issues

### Issue: Build Fails

**Check:**
1. Build logs in Render Dashboard → Your Service → Logs
2. Verify Node version compatibility
3. Check if all dependencies are in `package.json`
4. Verify build command: `npm install && npm run build`

**Force clean build:**
- Manual Deploy → "Clear build cache & deploy"

### Issue: Service Crashes on Start

**Check:**
1. Runtime logs in Render Dashboard
2. Verify start command: `npm start`
3. Check if port binding is correct (Render provides `PORT` env var automatically)
4. Verify all required environment variables are set

### Issue: Environment Variables Not Working

**Check:**
1. Variables are saved (check Environment tab)
2. Service was redeployed after adding variables
3. No typos in variable names
4. Values don't have extra quotes or spaces

**Force redeploy:**
- Manual Deploy → "Deploy latest commit"

### Issue: Webhooks Not Receiving Events

**Check:**
1. Webhook URL is correct: `https://your-service-name.onrender.com/api/webhook`
2. Service is running (not spun down)
3. Check Render logs for incoming requests
4. Test webhook manually with curl

### Issue: Database Connection Issues

**Check:**
1. DATABASE_URL is correct
2. If using Render PostgreSQL, use internal URL
3. Connection pooling settings
4. Prisma client is generated: `npx prisma generate`

---

## 📦 Render vs Vercel Differences

| Feature | Render | Vercel |
|---------|--------|--------|
| **Deployment** | Git push → Full server rebuild | Serverless functions |
| **Environment Variables** | Service → Environment tab | Project Settings → Environment |
| **Logs** | Dashboard → Logs tab | CLI or Dashboard |
| **Custom Domain** | CNAME record | A/CNAME records |
| **Auto-deploy** | Branch-based | Branch-based |
| **Cold starts** | Free tier only | Every serverless function |
| **Pricing** | Flat monthly rate | Usage-based |
| **Database** | Native PostgreSQL | External only |

---

## ✅ Render-Specific Checklist

Before inviting beta tester:

**Deployment**
- [ ] Beta branch deployed on Render
- [ ] Service is running (not free tier or paid plan)
- [ ] All environment variables configured
- [ ] Build completed successfully
- [ ] Service accessible at `https://your-service-name.onrender.com`

**Webhooks**
- [ ] Stripe webhook points to Render URL
- [ ] Xero redirect URI points to Render URL
- [ ] Webhook secrets configured in environment

**Monitoring**
- [ ] Can access logs in Render Dashboard
- [ ] Notifications configured (optional)
- [ ] Health checks passing

**Database**
- [ ] Beta database created (or separate schema)
- [ ] DATABASE_URL configured
- [ ] Migrations run successfully
- [ ] Can connect from Render service

---

## 🚀 Quick Deploy Commands

```bash
# 1. Create and push beta branch
git checkout -b beta
git push origin beta

# 2. Render will auto-deploy (if auto-deploy is on)
# Or manually deploy in Dashboard

# 3. Run migrations (if needed)
# SSH into Render shell or use a one-off job
npx prisma migrate deploy

# 4. Seed beta user (use Render shell or run locally)
npx tsx scripts/setup-beta-user.ts \
  --email beta@example.com \
  --name "Beta Tester"
```

### Using Render Shell

To run commands on your Render service:

1. Go to service → Shell tab
2. Click "Launch Shell"
3. Run commands directly on the server:
   ```bash
   npm run db:migrate
   npx tsx scripts/setup-beta-user.ts --email beta@example.com --name "Beta"
   ```

---

## 📞 Render Support

- **Documentation:** https://render.com/docs
- **Status Page:** https://status.render.com/
- **Community Forum:** https://community.render.com/
- **Support:** Dashboard → Help → Contact Support

---

## 🎯 Summary: Key Differences for Your Setup

Since you're on Render (not Vercel):

1. ✅ **Use Render Dashboard** for all configuration (not Vercel)
2. ✅ **Service URL format:** `https://service-name.onrender.com`
3. ✅ **Environment variables:** Add in Service → Environment tab
4. ✅ **Logs:** View in Dashboard → Service → Logs
5. ✅ **Webhooks:** Update to point to Render URL
6. ✅ **Auto-deploy:** Configure in Settings → Build & Deploy
7. ✅ **Database:** Can use Render PostgreSQL (native integration)
8. ✅ **Shell access:** Available in Dashboard → Shell tab

All the beta testing documentation I created still applies - just replace "Vercel" with "Render" and follow these Render-specific instructions!

---

**Ready to deploy on Render? Follow the main BETA_DEPLOYMENT_CHECKLIST.md and use these notes for Render-specific steps!**


# Render Deployment 500 Error - Troubleshooting

## Error Fixed: JSX Syntax Error ✅
The build error has been fixed (missing `</div>` tag).

## Current Issue: 500 Internal Server Error on Dashboard

The dashboard is now building successfully but getting a runtime error. Here's how to diagnose and fix it:

## Step 1: Check Render Logs 🔍

1. Go to your Render dashboard
2. Click on your service
3. Click on "Logs" tab
4. Look for error messages when you access `/dashboard`
5. The logs will show the actual error (not the generic 500 message)

**What to look for:**
- Database connection errors
- Prisma errors
- Missing environment variables
- Authentication errors

## Step 2: Verify Environment Variables ✅

Make sure these are set in Render:

### Required Variables:
```bash
DATABASE_URL=postgresql://...  # Your Neon/PostgreSQL connection string
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Optional but Recommended:
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.onrender.com
```

**How to check:**
1. Go to Render dashboard → Your service
2. Click "Environment" tab
3. Verify all variables are set

## Step 3: Check Database Connection 🗄️

The most common issue is database connectivity. Verify:

### A. Database URL Format
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

### B. Neon Database Settings
If using Neon:
1. Go to Neon dashboard
2. Get connection string (Pooled connection recommended)
3. Make sure it includes `?sslmode=require`

### C. Test Database from Render
In Render console, run:
```bash
npm run prisma:studio
# or
npx prisma db push --preview-feature
```

## Step 4: Verify Prisma Setup ✅

Check that Prisma is properly set up on Render:

### Build Logs Should Show:
```
✔ Generated Prisma Client (v6.19.1)
Prisma schema loaded from prisma/schema.prisma
No pending migrations to apply.
```

### If Migrations Failed:
Add to Render build command:
```bash
npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
```

## Step 5: Common Fixes 🔧

### Fix 1: Database Connection Pool
Add to your `DATABASE_URL`:
```
?connection_limit=10&pool_timeout=10
```

### Fix 2: Prisma Client Not Generated
In `package.json`, ensure:
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

### Fix 3: Organization Table Empty
The error might be because there are no organizations in the database.

**Solution A - Create Default Organization:**
Run this SQL in your Neon dashboard:
```sql
INSERT INTO organizations (id, clerk_org_id, name, created_at)
VALUES (
  gen_random_uuid(),
  'default_org',
  'Default Organization',
  NOW()
);
```

**Solution B - Use the Onboarding Flow:**
1. Navigate to `/onboarding` directly
2. Complete the organization setup
3. Then try accessing `/dashboard`

### Fix 4: Add Fallback for No Organization
I've already added this in the code, but verify the changes deployed:

```typescript
// Dashboard will now:
// 1. Try to get organization
// 2. If none exists, redirect to /onboarding
// 3. If error occurs, show error state with zeros
```

## Step 6: Manual Deployment Verification 🚀

After deploying the fixes, test in this order:

1. **Test Authentication:**
   ```
   https://your-app.onrender.com/auth/login
   ```
   - Can you log in?
   - Do you see any errors in browser console?

2. **Test Onboarding:**
   ```
   https://your-app.onrender.com/onboarding
   ```
   - Can you access this page?
   - Try creating an organization
   - Does it save successfully?

3. **Test Dashboard:**
   ```
   https://your-app.onrender.com/dashboard
   ```
   - After creating organization, try dashboard
   - Should now load without 500 error

## Step 7: Check Render Service Settings ⚙️

1. **Health Check Path:**
   - Set to: `/api/health` (if you have one) or leave empty
   
2. **Auto-Deploy:**
   - Should be: ON (deploys on git push)

3. **Instance Type:**
   - Free tier should work
   - Consider upgrading if experiencing timeouts

## Debugging Commands 🐛

If you have shell access on Render:

```bash
# Check if database is accessible
npx prisma db pull

# Check Prisma client
npx prisma generate

# Check environment variables (be careful not to log sensitive data)
env | grep DATABASE

# Check Node version
node --version

# Check if organizations table has data
# (You'd need to connect to DB directly for this)
```

## Expected Server Logs (Good) ✅

When dashboard loads successfully, you should see:
```
Dashboard loaded for organization: xxx-xxx-xxx
Fetched 5 payment links
Total revenue: $1,234.56
```

## Expected Server Logs (Bad) ❌

If you see these, here's what they mean:

### "Error fetching user organization"
- **Cause:** Database connection issue or Prisma error
- **Fix:** Check DATABASE_URL and Prisma setup

### "No organization found"
- **Cause:** No organization in database
- **Fix:** Complete onboarding or add default organization

### "Unauthorized"
- **Cause:** Supabase auth not working
- **Fix:** Check Supabase environment variables

### "prisma is not defined"
- **Cause:** Prisma client not generated
- **Fix:** Run `npx prisma generate` in build script

## Quick Fix: Use Development Values

As a temporary measure to test deployment, you can modify the dashboard to always show default values:

**Temporary Fix (Not Recommended for Production):**
In `dashboard/page.tsx`, comment out the stats fetch and use hardcoded values.

## Next Steps After Fixing 📋

Once dashboard loads:
1. ✅ Create an organization via onboarding
2. ✅ Set up merchant settings (Stripe/Hedera)
3. ✅ Create a test payment link
4. ✅ Test the payment flow
5. ✅ Verify all features work

## Need More Help? 🆘

If still getting 500 errors after all these steps:

1. **Share Render Logs:**
   - Copy the actual error message from Render logs
   - Look for stack traces
   - Share the specific line that's failing

2. **Check Specific Error:**
   - Browser console will show error digest
   - Render logs will show full error message
   - This will tell us exactly what's failing

3. **Test Locally:**
   - Set `DATABASE_URL` to your Render/Neon database
   - Run `npm run dev` locally
   - See if you get the same error
   - This helps isolate if it's deployment-specific

## Summary

**Fixes Applied:**
- ✅ Added try-catch to `getDashboardStats()`
- ✅ Added try-catch to `getUserOrganization()`
- ✅ Dashboard shows fallback values on error
- ✅ Error page displays if dashboard fails to load
- ✅ All errors are logged to console

**Most Likely Causes:**
1. 🔴 No organization exists in database → Create via onboarding
2. 🔴 Database connection issue → Check DATABASE_URL
3. 🟡 Prisma client not generated → Check build logs
4. 🟡 Supabase auth issue → Check environment variables

After deployment, check Render logs for the specific error message!


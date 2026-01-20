# Xero Automatic Sync - Testing Guide

## ✅ Setup Complete

Your automatic Xero syncing is now configured!

- **CRON_SECRET**: Set in Render
- **Cron Service**: cron-job.org
- **Frequency**: Every 5 minutes (or 1 minute if you chose that)
- **Endpoint**: `POST /api/xero/queue/process`

---

## 🧪 How to Test

### Test 1: Make a Payment
1. Create a payment link in your app
2. Complete a payment (Stripe or Hedera)
3. Payment status changes to **PAID**
4. Sync is automatically **queued** (happens immediately)

### Test 2: Wait for Cron Job
- Wait 5 minutes (or 1 minute depending on your schedule)
- Cron job will run automatically
- Check the results below

### Test 3: Verify Sync Happened

#### In Your App:
1. Go to **Settings → Integrations**
2. Scroll to **"Xero Sync Queue"** section
3. You should see:
   - ✅ Recent successful syncs
   - 📊 Sync statistics
   - 🕐 Last processed time

#### In Xero:
1. Log into your Xero account
2. Go to **Business → Invoices** (or **Sales → Invoices**)
3. Look for new invoice with number like: `PL-{payment_link_id}`
4. Should show status: **PAID**

#### In cron-job.org Dashboard:
1. Go to your cron job
2. Click on it to see **Execution History**
3. Look for:
   - ✅ **200 OK** responses (success)
   - Response body showing: `{"success":true,"stats":{...}}`

---

## 📊 Monitor Your Syncs

### View Queue Status
**Endpoint**: `GET /api/xero/queue/process-now`

**In Browser**: https://provvypay-api.onrender.com/api/xero/queue/process-now

Returns:
```json
{
  "status": "ready",
  "pendingCount": 0,
  "recentSyncs": [...]
}
```

### Manual Trigger (for testing)
If you want to test immediately without waiting:

1. Go to **Settings → Integrations**
2. Click **"Process Queue"** button
3. Watch syncs complete in real-time

---

## 🔍 Troubleshooting

### Issue: No syncs happening
**Check:**
1. Is Xero connected? (Settings → Integrations → Xero status)
2. Are there pending syncs? (Check queue status above)
3. Is cron job enabled? (Check cron-job.org dashboard)
4. Check Render logs for errors

### Issue: Syncs failing
**Check:**
1. Xero connection still valid? (OAuth tokens expire)
2. Account mappings configured? (Settings → Xero Account Mappings)
3. Check error messages in Xero Sync Queue UI

### Issue: Cron job returns 401 Unauthorized
**Problem**: CRON_SECRET mismatch
**Solution**: 
1. Verify secret in Render environment variables
2. Verify same secret in cron-job.org header
3. Make sure format is: `Bearer {secret}` (with space after "Bearer")

---

## 📈 What Happens During Sync

Every 5 minutes (or 1 minute), the cron job:

1. **Calls**: `POST /api/xero/queue/process`
2. **Processes**: Up to 10 pending syncs
3. **For each sync**:
   - Creates invoice in Xero
   - Records payment
   - Marks invoice as PAID
   - Updates sync status to SUCCESS or FAILED
4. **Returns**: Statistics (processed, succeeded, failed)

**Retry Logic**: Failed syncs automatically retry:
- After 5 minutes
- After 15 minutes
- After 1 hour
- After 4 hours
- After 24 hours
- After 5 failures: Marked as FAILED (stop retrying)

---

## 🎯 Production Recommendations

For production, consider:

1. **Increase frequency to every 1 minute** for faster syncs
2. **Set up Render native cron job** (more reliable)
3. **Enable email notifications** in cron-job.org
4. **Monitor sync success rates** in your app
5. **Set up alerts** for failed syncs

---

## 📝 Useful Commands

### Check Recent Syncs (SQL)
```sql
SELECT 
  id,
  payment_link_id,
  status,
  created_at,
  synced_at,
  error_message
FROM xero_syncs
ORDER BY created_at DESC
LIMIT 20;
```

### Count Syncs by Status
```sql
SELECT 
  status,
  COUNT(*) as count
FROM xero_syncs
GROUP BY status;
```

---

## 🔐 Security Notes

- ✅ **CRON_SECRET** protects the endpoint from unauthorized access
- ✅ **Manual endpoint** (`/process-now`) requires user authentication
- ✅ **Xero OAuth tokens** stored securely in database
- ⚠️ **Never commit** CRON_SECRET to git
- ⚠️ **Never share** CRON_SECRET publicly

---

## ✅ Setup Checklist

- [ ] CRON_SECRET added to Render
- [ ] Render deployment completed
- [ ] Cron job created on cron-job.org
- [ ] Cron job enabled
- [ ] Test payment made
- [ ] Waited 5 minutes
- [ ] Verified sync in app
- [ ] Verified invoice in Xero
- [ ] Checked cron-job.org execution history

---

## 🆘 Need Help?

1. Check **Settings → Integrations** for real-time sync status
2. Check **Render logs** for backend errors
3. Check **cron-job.org execution log** for cron failures
4. Review `XERO_SYNC_SETUP.md` for detailed documentation

---

**Date**: 2026-01-19  
**Status**: ✅ Automatic Sync Configured  
**Frequency**: Every 5 minutes (configurable)


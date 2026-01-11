# Xero Sync Setup Guide

## Overview
When a payment is marked as **PAID** (via Stripe, Hedera, or other methods), it's automatically **queued** to sync to Xero. However, the sync queue needs to be **processed** to actually create invoices and record payments in Xero.

## How It Works

```
Payment Completed → Queue Sync → Process Queue → Create Invoice → Record Payment in Xero
                      ↓                ↓
                  (Automatic)      (Needs Setup)
```

### Current Status
- ✅ **Queue Creation**: Automatic (happens when payment is confirmed)
- ⚠️ **Queue Processing**: Manual (needs setup)

---

## Quick Start: Test Now

### 1. Make a Payment
1. Create a payment link
2. Complete a payment (Stripe, Hedera, etc.)
3. Payment status changes to **PAID**
4. Sync is automatically **queued**

### 2. Process the Queue Manually
1. Go to **Settings** → **Integrations**
2. Scroll to the **"Xero Sync Queue"** section
3. Click **"Process Queue"** button
4. Watch the syncs complete!

### 3. Verify in Xero
1. Open your Xero account
2. Go to **Invoices** or **Sales**
3. You should see the new invoice and payment recorded

---

## Automatic Processing (Production Setup)

For production, you want syncs to happen automatically without manual intervention. On Render, you have two options:

### Option 1: Render Cron Job (Recommended) ⭐

Render supports cron jobs natively. Set up a cron job to call the processing endpoint every minute.

#### Step 1: Create a Cron Secret
```bash
# Generate a secure random secret
openssl rand -base64 32
# Or use: https://generate-secret.vercel.app/32
```

#### Step 2: Add Environment Variable in Render
1. Go to your Render dashboard
2. Select your web service
3. Go to **"Environment"** tab
4. Add:
   ```
   CRON_SECRET=your_generated_secret_here
   ```
5. Save changes (Render will redeploy)

#### Step 3: Create a Render Cron Job
1. In Render dashboard, click **"New +"** → **"Cron Job"**
2. Configure:
   - **Name**: `xero-sync-processor`
   - **Environment**: Same as your web service
   - **Command**: 
     ```bash
     curl -X POST https://your-app-url.onrender.com/api/xero/queue/process \
       -H "Authorization: Bearer $CRON_SECRET"
     ```
   - **Schedule**: `*/1 * * * *` (every minute)
   - Or use: `*/5 * * * *` (every 5 minutes) for less frequent processing
3. Click **"Create Cron Job"**

#### Step 4: Test the Cron Job
- Render will run the cron job on schedule
- Check **Logs** in the Cron Job dashboard
- You should see successful processing messages

---

### Option 2: External Cron Service

If you prefer an external service, use a free cron service like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [UptimeRobot](https://uptimerobot.com) (monitors can trigger webhooks)

#### Setup with cron-job.org:
1. Sign up at https://cron-job.org
2. Create a new cron job:
   - **URL**: `https://your-app-url.onrender.com/api/xero/queue/process`
   - **Schedule**: Every 1 minute (or 5 minutes)
   - **Request Method**: POST
   - **Headers**: 
     ```
     Authorization: Bearer your_cron_secret_here
     ```
3. Enable the job
4. Monitor executions in the dashboard

---

### Option 3: Manual Trigger (Development/Testing)

For development or low-volume usage, use the manual trigger:

1. Go to **Settings** → **Integrations**
2. Click **"Process Queue"** whenever you need to sync
3. Or bookmark this endpoint: `https://your-app-url.onrender.com/api/xero/queue/process-now`
4. POST to it after making payments

---

## API Endpoints

### Automatic Processing (Cron)
```bash
POST /api/xero/queue/process
Headers:
  Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "processed": 5,
    "succeeded": 5,
    "failed": 0,
    "skipped": 0
  }
}
```

### Manual Processing (Authenticated Users)
```bash
POST /api/xero/queue/process-now
# Requires user to be logged in
```

### Check Queue Status
```bash
GET /api/xero/queue/process-now
# Returns pending count and recent syncs
```

---

## Monitoring & Troubleshooting

### Check Queue Status
1. Go to **Settings** → **Integrations**
2. View the **"Xero Sync Queue"** section
3. See:
   - Number of pending syncs
   - Recent sync history
   - Success/failure status

### Common Issues

#### Issue: Syncs Stay "Pending"
**Cause**: Queue processor not running
**Solution**: 
- Set up automatic processing (see above)
- Or manually click "Process Queue"

#### Issue: Syncs Fail with "Xero not connected"
**Cause**: Xero integration not set up
**Solution**:
1. Go to **Settings** → **Integrations**
2. Click **"Connect to Xero"**
3. Authorize your Xero organization

#### Issue: Syncs Fail with "Account mapping not configured"
**Cause**: Xero account codes not mapped
**Solution**:
1. Go to **Settings** → **Xero Account Mappings**
2. Map your Xero accounts for:
   - Revenue (e.g., "200 - Sales")
   - Receivables (e.g., "110 - Accounts Receivable")
   - Clearing accounts for each payment method

#### Issue: Duplicate invoices in Xero
**Cause**: Sync processed multiple times
**Solution**: 
- The system has idempotency checks, but if duplicates occur:
- Manually delete duplicates in Xero
- Check if cron job is running multiple times

---

## What Gets Synced to Xero?

When a payment is synced, the system:

1. **Creates an Invoice** in Xero:
   - Invoice number: `PL-{payment_link_id}`
   - Line item: Payment link description
   - Amount: Payment amount
   - Currency: Payment currency
   - Due date: Payment date (paid immediately)

2. **Records the Payment**:
   - Payment amount
   - Payment date
   - Reference: Transaction ID (Stripe, Hedera, etc.)
   - Marks invoice as PAID

3. **Handles Multi-Currency**:
   - If payment currency ≠ Xero base currency:
   - Uses FX rate from payment time
   - Records correct exchange gain/loss

---

## Advanced Configuration

### Change Processing Frequency
Edit your cron job schedule:
- Every minute: `*/1 * * * *`
- Every 5 minutes: `*/5 * * * *`
- Every 15 minutes: `*/15 * * * *`
- Every hour: `0 * * * *`

### Batch Size
Add query parameter to process more syncs at once:
```bash
POST /api/xero/queue/process?batchSize=20
```
Default is 10, max is 100.

### Retry Logic
Failed syncs automatically retry:
- Retry 1: After 5 minutes
- Retry 2: After 15 minutes  
- Retry 3: After 1 hour
- Retry 4: After 4 hours
- Retry 5: After 24 hours

After 5 failures, sync is marked as **FAILED** and stops retrying.

### Manual Replay
To retry a failed sync:
```bash
POST /api/xero/sync/replay
Body: { "syncId": "uuid-here", "resetRetryCount": true }
```

---

## Security Notes

- **CRON_SECRET**: Keep this secret! Anyone with it can trigger sync processing
- **Manual Endpoint**: Requires user authentication (Supabase session)
- **Rate Limiting**: Consider adding rate limits for production

---

## Next Steps

1. ✅ Test manual sync now (go to Settings → Integrations)
2. ⚠️ Set up automatic processing (choose Option 1, 2, or 3 above)
3. ✅ Monitor syncs regularly
4. ✅ Configure account mappings if needed

---

## Questions?

- Check the **Xero Sync Queue** UI for real-time status
- Review the `xero_syncs` table in your database
- Check Render logs for error messages
- See `XERO_QUICK_REFERENCE.md` for more details

---

**Date**: 2026-01-11  
**Status**: ✅ Manual Trigger Ready, ⚠️ Auto-Processing Needs Setup


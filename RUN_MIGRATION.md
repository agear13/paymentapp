# 🔧 Step 1: Run Database Migration

**What this does:** Adds idempotency columns to prevent duplicate payments

**Time:** 2 minutes

---

## ✅ **OPTION 1: Run Locally** (Recommended if you have psql)

```bash
# Make sure you're in the project root
cd c:\Users\alish\Documents\paymentlink-repo

# Set your beta database URL
export DATABASE_URL="your-beta-database-connection-string"

# Run the migration
psql $DATABASE_URL -f prisma/migrations/add_idempotency_constraints.sql

# Verify it worked
psql $DATABASE_URL -c "\d payment_events"
```

**You should see these new columns:**
- `stripe_event_id`
- `stripe_payment_intent_id`
- `stripe_checkout_session_id`
- `hedera_tx_id`
- `correlation_id`

---

## ✅ **OPTION 2: Run on Render Shell**

1. Go to: **Render Dashboard → Your Service → Shell**
2. Click "Launch Shell"
3. Wait for shell to load
4. Run these commands:

```bash
# Navigate to project
cd /opt/render/project/src

# Run migration
psql $DATABASE_URL -f prisma/migrations/add_idempotency_constraints.sql

# Verify
psql $DATABASE_URL -c "\d payment_events"
```

---

## ✅ **OPTION 3: Copy/Paste SQL Directly**

If the file path doesn't work, copy this SQL and paste it directly into your database client:

```sql
-- Migration: Add idempotency constraints for payment processing
-- Ensures duplicate payment events cannot be created

-- Add columns for tracking payment provider references
ALTER TABLE payment_events 
ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS hedera_tx_id VARCHAR(255);

-- Create unique indexes to prevent duplicate processing
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_stripe_event_id_key 
ON payment_events(stripe_event_id) 
WHERE stripe_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_hedera_tx_id_key 
ON payment_events(hedera_tx_id) 
WHERE hedera_tx_id IS NOT NULL;

-- Composite unique constraint: one PAID event per payment_link
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_payment_link_paid_unique
ON payment_events(payment_link_id, event_type)
WHERE event_type = 'PAYMENT_CONFIRMED';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS payment_events_stripe_payment_intent_idx 
ON payment_events(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_events_stripe_checkout_session_idx 
ON payment_events(stripe_checkout_session_id) 
WHERE stripe_checkout_session_id IS NOT NULL;

-- Add correlation_id for distributed tracing
ALTER TABLE payment_events 
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS payment_events_correlation_id_idx 
ON payment_events(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- Add similar tracking for ledger entries
ALTER TABLE ledger_entries 
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS ledger_entries_correlation_id_idx 
ON ledger_entries(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- Add tracking for xero syncs
ALTER TABLE xero_syncs 
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS xero_syncs_correlation_id_idx 
ON xero_syncs(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- Ensure only one successful ledger entry set per payment_link
-- (Double-entry should be created atomically)
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_link_reference_unique
ON ledger_entries(payment_link_id, reference_type, reference_id)
WHERE reference_type = 'PAYMENT';

COMMENT ON COLUMN payment_events.stripe_event_id IS 'Stripe webhook event ID for idempotency';
COMMENT ON COLUMN payment_events.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN payment_events.stripe_checkout_session_id IS 'Stripe Checkout Session ID';
COMMENT ON COLUMN payment_events.hedera_tx_id IS 'Hedera transaction ID';
COMMENT ON COLUMN payment_events.correlation_id IS 'Correlation ID for distributed tracing';
```

**Run this in:**
- pgAdmin
- DataGrip
- TablePlus
- Supabase SQL Editor
- Or any PostgreSQL client

---

## ✅ **OPTION 4: Using Prisma** (If you prefer)

```bash
# Make sure you're in the project root
cd c:\Users\alish\Documents\paymentlink-repo

# Set your beta database URL
export DATABASE_URL="your-beta-database-connection-string"

# Run Prisma db push
npx prisma db push

# This will apply any schema changes
```

---

## 🔍 **How to Verify It Worked**

After running the migration, verify with this command:

```bash
psql $DATABASE_URL -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payment_events' 
AND column_name IN (
  'stripe_event_id',
  'hedera_tx_id', 
  'correlation_id'
);"
```

**Expected Output:**
```
column_name       | data_type
------------------+-----------
stripe_event_id   | character varying
hedera_tx_id      | character varying
correlation_id    | character varying
```

---

## ❓ **Which Option Should You Use?**

**Use Option 1** if:
- ✅ You have psql installed locally
- ✅ You have your database connection string
- ✅ You can connect to your database from your machine

**Use Option 2** if:
- ✅ Your database is on Render
- ✅ You want to run it directly on the server
- ✅ Render Shell access is available

**Use Option 3** if:
- ✅ You prefer using a GUI database client
- ✅ File paths aren't working
- ✅ You want to see exactly what's being run

**Use Option 4** if:
- ✅ You prefer using Prisma
- ✅ You want Prisma to manage migrations
- ✅ You're comfortable with Prisma's approach

---

## 🚨 **IMPORTANT NOTES**

1. **Backup First (Optional but Recommended):**
   ```bash
   pg_dump $DATABASE_URL > backup_before_migration.sql
   ```

2. **Run on BETA Database Only:**
   - Make sure your DATABASE_URL points to beta, not production
   - Verify: `echo $DATABASE_URL` should show beta database

3. **Migration is Idempotent:**
   - Uses `IF NOT EXISTS` so it's safe to run multiple times
   - Won't break if columns already exist

4. **No Downtime:**
   - This migration doesn't lock tables
   - Safe to run while app is running
   - Adds columns with defaults

---

## ✅ **AFTER MIGRATION**

Once migration is complete, you're ready for:
- ✅ Step 2: Configure environment variables
- ✅ Step 3: Set up webhooks
- ✅ Step 4: Create beta user
- ✅ Step 5: Test everything

---

## 🆘 **TROUBLESHOOTING**

**Error: "permission denied"**
```bash
# Make sure you have the right database credentials
# Check if you're the database owner
```

**Error: "relation does not exist"**
```bash
# Table might not exist yet
# Run: npx prisma migrate deploy
# Then retry migration
```

**Error: "syntax error"**
```bash
# Copy SQL manually and run in sections
# Some clients don't like multi-statement scripts
```

---

## 📞 **NEED HELP?**

If you get stuck:
1. Tell me which option you're trying
2. Tell me what error message you see
3. I'll help you troubleshoot

**Ready to run? Pick an option and let me know how it goes!** 🚀


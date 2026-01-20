# 🚨 URGENT: Apply Database Migration

**Issue:** Webhook failing with "Unknown argument `stripe_event_id`"

**Root Cause:** The `payment_events` table is missing required columns

---

## ✅ **Solution: Add Missing Columns**

The webhook code expects these columns in `payment_events`:
- `stripe_event_id` - For webhook idempotency
- `correlation_id` - For distributed tracing

**These columns don't exist in your database!**

---

## 🔧 **How to Apply the Migration**

### **Option 1: Using Render PostgreSQL Web Interface**

1. Go to **Render Dashboard** → Your PostgreSQL Database
2. Click **"Connect"** → **"External Connection"**
3. Copy the connection URL
4. Use a PostgreSQL client (pgAdmin, DBeaver, or psql) to connect
5. Run this SQL:

```sql
-- Add missing columns to payment_events table
ALTER TABLE payment_events 
ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS payment_events_stripe_event_id_idx ON payment_events(stripe_event_id);
```

### **Option 2: Using Render Shell + psql**

1. Go to **Render Dashboard** → Your PostgreSQL Database
2. Click **"Connect"** → Copy the **"PSQL Command"**
3. In your local terminal, run the psql command
4. Paste the SQL above

### **Option 3: Using Supabase SQL Editor** (if using Supabase)

1. Go to **Supabase Dashboard** → SQL Editor
2. Create new query
3. Paste the SQL above
4. Click **"Run"**

---

## ✅ **Verification**

After running the migration, verify it worked:

```sql
-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payment_events'
  AND column_name IN ('stripe_event_id', 'correlation_id');
```

Should return:
```
column_name      | data_type
-----------------+-------------------
stripe_event_id  | character varying
correlation_id   | character varying
```

---

## 🧪 **After Migration - Test Webhook**

1. **Wait for columns to be added** (instant)
2. **Restart Render app** (or just wait for next request)
3. **Make a test payment** with card `4242 4242 4242 4242`
4. **Check Stripe webhook** - should return **200 OK** ✅
5. **Check invoice** - should update to **PAID** ✅

---

## 📋 **Schema Update**

I've also updated `src/prisma/schema.prisma` to include these columns:

```prisma
model payment_events {
  id                       String           @id @default(uuid()) @db.Uuid
  payment_link_id          String           @db.Uuid
  event_type               PaymentEventType
  payment_method           PaymentMethod?
  stripe_payment_intent_id String?          @db.VarChar(255)
  stripe_event_id          String?          @db.VarChar(255)  // ← ADDED
  hedera_transaction_id    String?          @db.VarChar(255)
  amount_received          Decimal?         @db.Decimal(18, 8)
  currency_received        String?          @db.VarChar(10)
  correlation_id           String?          @db.VarChar(255)  // ← ADDED
  metadata                 Json?
  created_at               DateTime         @default(now()) @db.Timestamptz(6)
  payment_links            payment_links    @relation(fields: [payment_link_id], references: [id], onDelete: Cascade)

  @@index([payment_link_id, created_at])
  @@index([stripe_event_id])  // ← ADDED
}
```

---

## 🚨 **This is Blocking Webhooks!**

**Until you add these columns, ALL webhooks will fail with 500 error.**

The webhook flow is:
1. ✅ Stripe sends webhook
2. ✅ Webhook reaches your app
3. ❌ Code tries to check `stripe_event_id` (doesn't exist)
4. ❌ Prisma throws validation error
5. ❌ Returns 500 to Stripe
6. ❌ Invoice doesn't update

**After adding columns:**
1. ✅ Stripe sends webhook
2. ✅ Webhook reaches your app
3. ✅ Code checks `stripe_event_id` (exists!)
4. ✅ Processes payment successfully
5. ✅ Returns 200 to Stripe
6. ✅ Invoice updates to PAID!

---

## ⏱️ **Quick Summary**

**Run this SQL on your database:**

```sql
ALTER TABLE payment_events 
ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS payment_events_stripe_event_id_idx ON payment_events(stripe_event_id);
```

**Then test a payment - it will work!** ✅

---

## 🆘 **Need Help?**

If you're not sure how to access your database:

1. **Using Render:** Dashboard → PostgreSQL → Connect → External Connection
2. **Using Supabase:** Dashboard → SQL Editor → Run query
3. **Using Neon/Other:** Find connection URL in dashboard → Use psql or GUI client

**The migration is safe:**
- Uses `IF NOT EXISTS` (won't fail if already run)
- Just adds columns (doesn't modify data)
- Nullable columns (won't break existing rows)
- Instant execution (no downtime)


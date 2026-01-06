# Prisma Production Recovery Playbook

This document provides exact commands to recover from common Prisma migration issues in production (Render).

## Common Issues

### Issue 1: "Relation already exists" (P3009/P3018)

**Symptoms:**
- `prisma migrate deploy` fails with error: `relation "notifications" already exists`
- `_prisma_migrations` table shows a failed migration with `applied_steps_count=0` and `finished_at=NULL`
- Tables were created by an earlier migration but Prisma migration history is out of sync

**Root Cause:**
- A migration attempted to run but failed/was interrupted after creating database objects
- OR: Tables were created by a differently-named migration (e.g., `add_notifications` vs `20260105000001_add_notifications`)
- Prisma marked the migration as "started" but not "finished"

---

## Recovery Steps

### Step 1: Verify Database State

Connect to production database via Render shell:

```bash
# On Render shell
psql "$DATABASE_URL"
```

Then run these queries to confirm state:

```sql
-- Check migration history
SELECT migration_name, finished_at, applied_steps_count 
FROM _prisma_migrations 
ORDER BY started_at DESC 
LIMIT 10;

-- Check if notifications tables exist
SELECT to_regclass('public.notifications');
SELECT to_regclass('public.email_logs');
SELECT to_regclass('public.notification_preferences');

-- Check if NotificationType enum exists
SELECT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'NotificationType'
);

-- Check if EmailStatus enum exists
SELECT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'EmailStatus'
);
```

**Expected Results:**
- If tables exist (`to_regclass` returns a valid OID, not NULL)
- AND migration shows `applied_steps_count=0` or `finished_at=NULL`
- THEN the migration needs to be marked as resolved

Exit psql: `\q`

---

### Step 2: Resolve Failed Migration

**IMPORTANT: Choose the correct resolution strategy**

#### Strategy A: Tables Already Exist (Most Common)

Use `--rolled-back` when:
- ✅ Tables were created by a previous migration with a different name
- ✅ All database objects already exist and match the schema
- ✅ The failed migration tried to recreate existing objects

```bash
# Mark the failed migration as rolled back (won't attempt to rerun)
npx prisma migrate resolve --rolled-back 20260105000001_add_notifications
```

**Why `--rolled-back`?**
- Tells Prisma: "This migration's changes are NOT in the database"
- Prisma will NOT attempt to rerun it
- Use this when tables exist from a different migration

#### Strategy B: Migration Partially Applied

Use `--applied` when:
- ✅ The migration DID create the tables successfully
- ✅ Only the migration record wasn't updated
- ✅ You've verified ALL objects from the migration exist

```bash
# Mark the migration as successfully applied
npx prisma migrate resolve --applied 20260105000001_add_notifications
```

**Why `--applied`?**
- Tells Prisma: "This migration's changes ARE in the database"
- Updates `_prisma_migrations` to mark it as complete
- Prisma won't attempt to rerun it

#### Strategy C: Migration Is Idempotent (Safest)

If the migration SQL uses:
- `CREATE TABLE IF NOT EXISTS ...`
- `CREATE INDEX IF NOT EXISTS ...`
- `DO $$ BEGIN ... CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

Then you can safely let `migrate deploy` rerun it:

```bash
# Just deploy - idempotent migrations will skip existing objects
npx prisma migrate deploy
```

---

### Step 3: Deploy Remaining Migrations

After resolving, deploy all pending migrations:

```bash
npx prisma migrate deploy
```

**Expected output:**
```
Applying migration `20260105000003_add_uuid_defaults_payment_core`
Database up to date
```

---

### Step 4: Regenerate Prisma Client

```bash
npx prisma generate
```

---

### Step 5: Restart Application

```bash
# On Render: trigger a new deployment or restart the service
# The application will use the updated Prisma Client
```

---

## Verification

After recovery, verify:

```bash
# Check migration status
npx prisma migrate status

# Should show: "Database schema is in sync with migrations"
```

Test a payment flow to ensure persistence works.

---

## Prevention

### Local Development Best Practices

```bash
# Always generate client after schema changes
npx prisma generate

# Create migrations with descriptive names
npx prisma migrate dev --name descriptive_name

# Before deploying, check migration status locally
npx prisma migrate status
```

### Production Deployment

Ensure `package.json` has:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

This ensures:
1. Client is always generated after dependency installation
2. Migrations run before building the app
3. Build uses the latest schema

---

## Troubleshooting

### "Migration cannot be rolled back"

If you see:
```
Migration cannot be rolled back because it was already applied
```

This means the migration finished successfully. Check if a newer migration is failing.

### "Database schema is not in sync"

Run:
```bash
npx prisma migrate status
```

Look for:
- Unapplied migrations
- Failed migrations
- Schema drift

### "Argument `id` is missing" Errors

This indicates:
1. Prisma Client is out of sync with schema → Run `npx prisma generate`
2. Database columns missing UUID defaults → Apply UUID defaults migration
3. Schema has `@default(uuid())` but DB column doesn't have `DEFAULT gen_random_uuid()`

Fix:
```bash
# Regenerate client
npx prisma generate

# Deploy UUID defaults migration
npx prisma migrate deploy
```

---

## Emergency Contacts

If recovery fails:
1. Check Render logs for detailed error messages
2. Verify database credentials are correct
3. Ensure database is accessible (no connection limits)
4. Consider rolling back to last known good deployment

---

## Appendix: Manual Migration Record Fix (Last Resort)

⚠️ **DANGEROUS - Only if above steps fail**

```sql
-- Connect to database
psql "$DATABASE_URL"

-- Update failed migration record manually
UPDATE _prisma_migrations
SET 
  finished_at = NOW(),
  applied_steps_count = 1,
  logs = 'Manually resolved - tables already existed'
WHERE migration_name = '20260105000001_add_notifications'
  AND finished_at IS NULL;

-- Verify update
SELECT * FROM _prisma_migrations 
WHERE migration_name = '20260105000001_add_notifications';

\q
```

Then run `npx prisma migrate deploy` to apply remaining migrations.


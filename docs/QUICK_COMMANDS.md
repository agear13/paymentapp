# Quick Command Reference

## Local Development

```bash
# Navigate to src directory
cd src

# Check migration status
npx prisma migrate status

# Apply all pending migrations
npx prisma migrate deploy

# Regenerate Prisma Client (critical after migrations)
npx prisma generate

# Verify everything is in sync
npx prisma migrate status
# Should show: "Database schema is in sync with migrations"
```

---

## Production Recovery (Render Shell)

### If migration failed with "relation already exists"

```bash
# Option 1: Mark failed migration as rolled back (recommended if tables exist from different migration)
npx prisma migrate resolve --rolled-back 20260105000001_add_notifications
npx prisma migrate deploy
npx prisma generate

# Option 2: Just deploy (safe because migrations are idempotent)
npx prisma migrate deploy
npx prisma generate
```

### Verify Production State

```bash
# Check migration status
npx prisma migrate status

# Check what migrations are in database
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;"

# Check if tables exist
psql "$DATABASE_URL" -c "SELECT to_regclass('public.notifications');"
psql "$DATABASE_URL" -c "SELECT to_regclass('public.payment_links');"

# Check if UUID defaults are set
psql "$DATABASE_URL" -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'payment_links' AND column_name = 'id';"
```

---

## Git Workflow

```bash
# Stage changes
git add src/prisma/migrations/
git add src/lib/hedera/transaction-checker.ts
git add docs/

# Commit
git commit -m "fix: resolve Prisma migration conflicts and UUID default issues

- Rename notifications migration to match production (add_notifications)
- Make notifications migration fully idempotent
- Add UUID defaults migration for payment core tables
- Add instrumentation logging to transaction-checker
- Add production recovery documentation"

# Push to trigger Render deployment
git push origin main
```

---

## Monitoring After Deployment

```bash
# Watch Render logs for:
# ✅ "Applying migration `add_notifications`" (should succeed or skip if exists)
# ✅ "Applying migration `20260105000003_add_uuid_defaults_payment_core`"
# ✅ "Database up to date"
# ✅ Build completes successfully

# Test payment flow and watch for:
# ✅ "INSTRUMENTATION: Prisma payloads before transaction"
# ✅ "Payment persisted successfully"
# ❌ NO "Argument `id` is missing" errors
```

---

## Emergency Rollback

```bash
# If deployment fails completely
git revert HEAD
git push origin main

# If migration is partially applied
# See docs/PRISMA_PRODUCTION_RECOVERY.md for detailed recovery steps
```

---

## One-Line Checkers

```bash
# Is Prisma Client in sync?
npx prisma generate && echo "✅ Client generated"

# Are migrations up to date?
npx prisma migrate status | grep "in sync" && echo "✅ Migrations in sync"

# Can I connect to database?
psql "$DATABASE_URL" -c "SELECT 1;" && echo "✅ Database connected"
```


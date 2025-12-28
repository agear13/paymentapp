# Database Setup Guide for AUDD Migration

## Current Situation

Your PostgreSQL is **running** on port 5432, but your `.env` uses a Prisma Accelerate connection that needs a proxy on ports 51213/51214.

## Solution: Switch to Direct PostgreSQL Connection

### Step 1: Update `.env` File

Open: `src/.env`

**Find this line:**
```env
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."
```

**Replace with:**
```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE?schema=public"
```

### Step 2: Fill in Your PostgreSQL Credentials

Replace:
- `USERNAME` → Your PostgreSQL username (usually `postgres`)
- `PASSWORD` → Your PostgreSQL password
- `DATABASE` → Your database name (e.g., `paymentlink`, `postgres`, or `template1`)

**Examples:**
```env
# Example 1: Using default postgres database
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/postgres?schema=public"

# Example 2: Using dedicated paymentlink database
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/paymentlink?schema=public"
```

### Step 3: Test Connection

```bash
cd src
npx prisma db pull --schema=prisma/schema.prisma
```

If successful, you'll see:
```
✔ Introspected 1 model and wrote it into prisma/schema.prisma
```

### Step 4: Run AUDD Migration

```bash
npx prisma migrate dev --name add_audd_token --schema=prisma/schema.prisma
```

## Troubleshooting

### Error: "Password authentication failed"

Your password is incorrect. Try:
1. Check pgAdmin for saved password
2. Reset password via pgAdmin
3. Use PostgreSQL command line: `psql -U postgres`

### Error: "database does not exist"

Create the database first:

```bash
# Option 1: Use pgAdmin to create database

# Option 2: Use psql command line
psql -U postgres -c "CREATE DATABASE paymentlink;"
```

### Error: "Connection refused"

PostgreSQL service not running:

```powershell
# Check service status
Get-Service postgresql-x64-*

# Start if stopped
Start-Service postgresql-x64-17
```

### Can't Find Password?

**Option 1:** Use the default `postgres` database:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/postgres?schema=public"
```

**Option 2:** Reset PostgreSQL password:
1. Open pgAdmin
2. Right-click on PostgreSQL server
3. Properties → Connection → Change password

## Alternative: Keep Using Prisma Accelerate

If you want to keep using Prisma Accelerate, you need to:

1. **Start the Prisma proxy:**
   ```bash
   npx prisma studio
   ```
   This will start the local proxy on ports 51213/51214

2. **Then run migration in another terminal:**
   ```bash
   npx prisma migrate dev --name add_audd_token
   ```

## After Migration Success

You should see:
```
✔ Generated Prisma Client (v7.1.0)

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20251208XXXXXX_add_audd_token/
    └─ migration.sql

✔ Generated Prisma Client (v7.1.0)
```

Then test AUDD:
```bash
# Start your dev server
npm run dev

# Test AUDD rate
curl "http://localhost:3000/api/fx/rates?base=AUDD&quote=AUD"
```

---

## Quick Reference

**Your PostgreSQL Services:**
- postgresql-x64-16 ✅ Running
- postgresql-x64-17 ✅ Running

**Default Port:** 5432

**Next Command:**
```bash
cd src
npx prisma migrate dev --name add_audd_token --schema=prisma/schema.prisma
```

---

*Once you update the DATABASE_URL, the migration will complete and AUDD will be 100% operational!*













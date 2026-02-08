# Quick Start: Referral System

Get the referral/consultant program system up and running in 5 minutes.

## Prerequisites

- Supabase project created
- Environment variables set (see below)
- Database migration ready to run

## Step 1: Set Environment Variables

Add these to `.env.local` (development) or production environment:

```bash
# Supabase connection (should already have these)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # From Supabase dashboard → Settings → API

# Admin access (comma-separated emails)
ADMIN_EMAILS=your-email@example.com,admin@example.com

# Optional: Prisma (unchanged, for payment links)
DATABASE_URL=postgresql://...
```

**Where to find `SUPABASE_SERVICE_ROLE_KEY`**:
1. Go to your Supabase dashboard
2. Settings → API
3. Copy the "service_role" key (keep it secret!)

## Step 2: Run Migration

### Option A: Via Supabase CLI (Recommended)
```bash
cd c:\Users\alish\Documents\paymentlink-repo
supabase db push
```

### Option B: Via Supabase Dashboard SQL Editor
1. Go to SQL Editor in Supabase dashboard
2. Open `supabase/migrations/20260207_referral_system.sql` in your code editor
3. Copy **entire contents** of the file
4. Paste into SQL Editor
5. Click **"Run"**
6. Migration is **rerunnable** - safe to run multiple times

### Verify Seed Data

Run these verification queries in SQL Editor (included at bottom of migration file):

```sql
-- Should return: consultant-referral
SELECT slug FROM referral_programs;

-- Should return: DEMO-ADVOCATE, DEMO-CONSULTANT
SELECT referral_code FROM referral_participants ORDER BY referral_code;

-- Should return: DEMO-REVIEW-TOKEN
SELECT token FROM referral_review_tokens;
```

Or run the aggregate query:

```sql
SELECT 'Programs' as type, COUNT(*) as count FROM referral_programs
UNION ALL
SELECT 'Participants', COUNT(*) FROM referral_participants
UNION ALL
SELECT 'Rules', COUNT(*) FROM referral_program_rules
UNION ALL
SELECT 'Review Tokens', COUNT(*) FROM referral_review_tokens;
```

Expected results:
- Programs: 1
- Participants: 2
- Rules: 4
- Review Tokens: 1

**Note**: Migration is hardened with `LIMIT 1` to prevent "more than one row" errors and is fully rerunnable.

## Step 3: Start Development Server

```bash
cd src
npm run dev
```

Visit: `http://localhost:3000`

## Step 4: Test Public Pages

### Test Referral Landing Page
```bash
# Open in browser
http://localhost:3000/r/DEMO-CONSULTANT
```

**Expected**:
- ✅ Page loads (not 404)
- ✅ Shows "Consultant Referral Program" info
- ✅ Has a lead submission form
- ✅ Has testimonials section

**Submit the form** with test data:
- Name: Test User
- Email: test@example.com
- Message: Testing the referral system

**Expected after submission**:
- ✅ Success message shown
- ✅ Check database: `referral_leads` has new row
- ✅ Check database: `referral_conversions` has new row (auto-approved)
- ✅ Check database: `partner_ledger_entries` has new row (source: 'referral')

### Test Review Page
```bash
# Open in browser
http://localhost:3000/review/DEMO-REVIEW-TOKEN
```

**Expected**:
- ✅ Page loads (not 404)
- ✅ Shows "Share Your Experience" form
- ✅ Has star rating selector
- ✅ Has testimonial textarea

**Submit a 5-star review**:
- Rating: 5 stars
- Review: "Excellent service, highly recommend!"
- Name: Happy Client

**Expected after submission**:
- ✅ Success message shown
- ✅ Referral code displayed for sharing (if rating >= 4)
- ✅ Check database: `referral_reviews` has new row
- ✅ Check database: `referral_review_tokens.used_at` is set

## Step 5: Test Admin Dashboard

### Login as Admin
1. Visit: `http://localhost:3000/auth/login`
2. Login with an email listed in `ADMIN_EMAILS`

### View Conversions
Visit: `http://localhost:3000/dashboard/programs/conversions`

**Expected**:
- ✅ Shows stats (pending/approved/rejected)
- ✅ Shows table of conversions
- ✅ Has "Approve" and "Reject" buttons

### Approve a Conversion
1. Find a pending conversion
2. Click "Approve"
3. Wait for success message

**Check Results**:
```sql
-- Conversion should be approved
SELECT status, approved_at, approved_by 
FROM referral_conversions 
WHERE id = '<conversion-id>';

-- Ledger entry should exist
SELECT * FROM partner_ledger_entries 
WHERE source = 'referral' 
AND source_ref = '<conversion-id>';
```

### View Partner Ledger
Visit: `http://localhost:3000/dashboard/partners/ledger`

**Expected**:
- ✅ Shows entries from both systems:
  - Entries with `source: 'huntpay'` (if HuntPay has been used)
  - Entries with `source: 'referral'` (from approved conversions)

### View Partner Dashboard
Visit: `http://localhost:3000/dashboard/partners/dashboard`

**Expected**:
- ✅ Total Earnings card reflects sum of all ledger entries
- ✅ Pending Earnings shows entries with `status: 'pending'`
- ✅ Paid Out shows entries with `status: 'paid'`
- ✅ Chart shows earnings trend

## Step 6: Generate Shareable Links

### For Consultants
```
Base URL: https://your-domain.com/r/[REFERRAL-CODE]

Example:
- https://your-domain.com/r/DEMO-CONSULTANT
- https://your-domain.com/r/DEMO-ADVOCATE
```

### For Reviews
```
Base URL: https://your-domain.com/review/[TOKEN]

Generate tokens via admin dashboard or SQL:
INSERT INTO referral_review_tokens (program_id, participant_id, token, expires_at)
VALUES (
  '<program-id>',
  '<participant-id>',
  'UNIQUE-TOKEN-' || gen_random_uuid()::text,
  NOW() + INTERVAL '30 days'
);
```

## Troubleshooting

### "Configuration Error" on public pages
- **Cause**: Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Fix**: Set environment variables and restart dev server

### "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY"
- **Cause**: Admin routes need service role key
- **Fix**: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`

### "Forbidden: Admin access required"
- **Cause**: Your email not in `ADMIN_EMAILS`
- **Fix**: Add your email to `ADMIN_EMAILS` environment variable

### Public pages return 404
- **Cause**: Middleware blocking public routes
- **Fix**: Verify `src/middleware.ts` matcher is `/dashboard/:path*` only

### "Conversion not found" when approving
- **Cause**: Trying to approve HuntPay conversion in referral system
- **Fix**: Use correct admin panel for each system:
  - HuntPay: `/dashboard/huntpay/admin`
  - Referral: `/dashboard/programs/conversions`

### Ledger entry not created after approval
- **Cause**: Missing `referral_program_rules` for participant role + conversion type
- **Fix**: Add rule in database:
  ```sql
  INSERT INTO referral_program_rules (
    program_id, role, conversion_type, payout_type, value, currency, priority
  ) VALUES (
    '<program-id>', 'CONSULTANT', 'booking_confirmed', 'fixed', 50.00, 'USD', 10
  );
  ```

## Demo Data Quick Reference

| Type | Code/Token | URL |
|------|-----------|-----|
| Consultant Referral | `DEMO-CONSULTANT` | `/r/DEMO-CONSULTANT` |
| Advocate Referral | `DEMO-ADVOCATE` | `/r/DEMO-ADVOCATE` |
| Review Link | `DEMO-REVIEW-TOKEN` | `/review/DEMO-REVIEW-TOKEN` |

## Complete Test Checklist

- [ ] Environment variables set
- [ ] Migration run successfully
- [ ] Seed data verified in database
- [ ] `/r/DEMO-CONSULTANT` loads
- [ ] Lead form submits successfully
- [ ] `/review/DEMO-REVIEW-TOKEN` loads
- [ ] Review form submits successfully
- [ ] Admin login works
- [ ] `/dashboard/programs/conversions` shows conversions
- [ ] Approve conversion creates ledger entry
- [ ] `/dashboard/partners/ledger` shows new entry
- [ ] `/dashboard/partners/dashboard` shows correct totals

## Production Deployment

1. **Set environment variables** in production (Render/Vercel/etc.)
2. **Run migration** on production Supabase
3. **Deploy application**
4. **Test public URLs** work without auth
5. **Test admin panel** requires login + ADMIN_EMAILS check
6. **Monitor logs** for any errors

## Support

If you encounter issues:

1. Check `REFERRAL_TABLE_NAMESPACE.md` - Table naming guide
2. Check `SUPABASE_DUAL_CLIENTS.md` - Client usage patterns
3. Check browser console for client errors
4. Check server logs for API errors
5. Check Supabase logs for database errors

## Useful SQL Queries

### View all referral data
```sql
-- Programs
SELECT * FROM referral_programs;

-- Participants with codes
SELECT name, role, referral_code, status FROM referral_participants;

-- Recent conversions
SELECT 
  c.id,
  p.name as participant,
  c.conversion_type,
  c.status,
  c.created_at
FROM referral_conversions c
JOIN referral_participants p ON c.participant_id = p.id
ORDER BY c.created_at DESC
LIMIT 10;

-- Ledger entries from referrals
SELECT * FROM partner_ledger_entries 
WHERE source = 'referral'
ORDER BY created_at DESC;
```

### Generate new participant
```sql
INSERT INTO referral_participants (
  program_id,
  role,
  name,
  email,
  referral_code,
  status
) VALUES (
  (SELECT id FROM referral_programs WHERE slug = 'consultant-referral'),
  'CONSULTANT',
  'John Smith',
  'john@example.com',
  'JOHN-SMITH-2024',
  'active'
);
```

### Generate review token
```sql
INSERT INTO referral_review_tokens (
  program_id,
  participant_id,
  token,
  expires_at
) VALUES (
  (SELECT id FROM referral_programs WHERE slug = 'consultant-referral'),
  (SELECT id FROM referral_participants WHERE email = 'john@example.com'),
  'JOHN-REVIEW-' || substring(gen_random_uuid()::text, 1, 8),
  NOW() + INTERVAL '30 days'
);
```

---

**Ready to start?** Run the migration and visit `/r/DEMO-CONSULTANT`! 🚀

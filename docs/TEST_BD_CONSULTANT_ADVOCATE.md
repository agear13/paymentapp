# Test: BD Partner → Consultant → Client Advocate (3-Level)

This document describes the exact steps to verify the 3-level affiliate hierarchy.

## Prerequisites

- Supabase migration `20260212_affiliate_hierarchy.sql` applied
- `ADMIN_EMAILS` env var set with your email
- Logged-in user with admin access

## Step 1: Bind admin user to DEMO-BD-PARTNER

```bash
# Replace <YOUR_EMAIL> with your admin email
# Use curl or Postman - must be authenticated (session cookie)

curl -X POST https://your-app.com/api/referrals/participants/bind-self \
  -H "Content-Type: application/json" \
  -d '{"programSlug":"consultant-referral","referralCodeToBind":"DEMO-BD-PARTNER"}' \
  --cookie "sb-...=..."  # Your Supabase session cookie
```

Or from browser console (on your app, logged in):

```javascript
fetch('/api/referrals/participants/bind-self', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    programSlug: 'consultant-referral',
    referralCodeToBind: 'DEMO-BD-PARTNER'
  })
}).then(r => r.json()).then(console.log);
```

Expected: `{ success: true, message: "Bound to DEMO-BD-PARTNER", ... }`

## Step 2: Bind user to DEMO-CONSULTANT

Use a different browser/profile or the same user (for testing you can bind same user to both):

```javascript
fetch('/api/referrals/participants/bind-self', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    programSlug: 'consultant-referral',
    referralCodeToBind: 'DEMO-CONSULTANT'
  })
}).then(r => r.json()).then(console.log);
```

Expected: `{ success: true, message: "Bound to DEMO-CONSULTANT", ... }`

## Step 3: Generate advocate link as consultant

1. Log in as the user bound to DEMO-CONSULTANT
2. Navigate to `/dashboard/consultant`
3. In "Create Client Advocate Link" section:
   - Client name: (optional) e.g. "Acme Corp"
   - Advocate percent: `10`
4. Click "Generate advocate link"

Expected: A link like `/r/ADV-XXXXXX` appears. Copy the full URL (e.g. `https://your-app.com/r/ADV-ABC123`).

## Step 4: Visit advocate link and submit lead

1. Open the advocate link in a new incognito/private window (or different browser)
2. Fill out the lead form (name, email, etc.) and submit

Expected: `referral_conversions` row created with `conversion_type='lead_submitted'`, `participant_id` = advocate's id. No ledger entries.

## Step 5: Admin mark-paid with gross=100 USD

1. Log in as admin
2. Go to `/dashboard/programs/conversions`
3. Find the lead_submitted conversion from step 4
4. Click "Mark Paid"
5. Enter gross amount: `100`, currency: `USD`
6. Submit

Expected: Conversion updated to `payment_completed`, `gross_amount=100`, `status='approved'`. Ledger entries created.

## Step 6: Verify partner_ledger_entries (3 rows)

```sql
-- Replace <CONVERSION_UUID> with the conversion id from step 4/5
SELECT
  ple.id,
  pe.name,
  ple.earnings_amount,
  ple.currency,
  ple.description
FROM partner_ledger_entries ple
LEFT JOIN partner_entities pe ON pe.id = ple.entity_id
WHERE ple.source = 'referral'
  AND ple.source_ref = '<CONVERSION_UUID>'
ORDER BY ple.earnings_amount DESC;
```

Expected:
| name           | earnings_amount | currency |
|----------------|-----------------|----------|
| Demo BD Partner | 5.00           | USD      |
| Demo Advocate   | 10.00          | USD      |
| Demo Consultant | 85.00          | USD      |

- BD partner: 5% of 100 = 5
- Advocate: 10% of 100 = 10 (custom_commission_percent from DEMO-ADVOCATE)
- Consultant: remainder = 85

## Step 7: Verify idempotency (replay ledger)

1. On the conversions page, click "Replay Ledger" for the same payment_completed conversion
2. Or: `POST /api/referrals/conversions/<CONVERSION_UUID>/replay-ledger`

Expected: `{ success: true, created: 0, skipped: 3 }` — no duplicates, all 3 entries already exist.

## Troubleshooting

- **"owner_participant_id must be set"**: Run migration and ensure `referral_programs.owner_participant_id` is set for `consultant-referral`
- **"Bind your account first"**: Call bind-self before accessing `/dashboard/consultant`
- **No ledger entries**: Ensure conversion has `participant_id` pointing to advocate (for advocate link) or consultant (for consultant link). Advocate must have `parent_participant_id` = consultant.

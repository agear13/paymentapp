# Consultant Referral & Revenue Share System

## Overview

A complete referral and revenue-sharing system designed for YouTube-led distribution and consultant networks. This system enables:

1. **Consultants** to refer clients and earn commissions on bookings/conversions
2. **Client Advocates** (happy customers) to leave reviews and optionally refer others for rewards
3. **Automated ledger tracking** that feeds into the existing Partners UI

## Core Concepts

### Programs
Programs define the referral structure, including:
- Offer/service description
- Hero imagery and branding
- Call-to-action buttons (enquiry, booking, WhatsApp, etc.)
- Role-based payout rules

### Participants
Two types of participants:
- **CONSULTANT**: Professional channel partners who actively promote services
- **CLIENT_ADVOCATE**: Happy clients who can refer others after leaving a positive review

Each participant receives:
- Unique referral code (e.g., `DEMO-CONSULTANT`)
- Shareable referral link (e.g., `/r/DEMO-CONSULTANT`)
- Automatic earnings tracking

### Conversion Types
The system tracks three conversion types:

1. **`lead_submitted`** - Auto-approved when someone fills out the enquiry form
2. **`booking_confirmed`** - Requires manual admin approval
3. **`payment_completed`** - Auto-approved when linked to a payment

### Ledger Integration
When conversions are approved, the system:
1. Applies program rules to calculate earnings
2. Creates an idempotent ledger entry in `partner_ledger_entries`
3. Updates the Partners Dashboard totals automatically
4. Associates earnings with the specific participant

## User Flows

### Flow 1: Consultant Referral

```
1. Admin creates participant (CONSULTANT role) → Gets referral code "JOHN-SMITH"
2. Consultant shares link: yoursite.com/r/JOHN-SMITH
3. Prospect visits link → Attribution logged
4. Prospect fills enquiry form → Lead conversion created (auto-approved)
5. Admin marks booking as confirmed → Booking conversion created (manual approval)
6. On approval → Ledger entry created for consultant's earnings
7. Earnings appear in Partners → Dashboard and Ledger
```

### Flow 2: Client Advocate Review Loop

```
1. Admin generates review token for completed customer
2. Customer visits /review/[token]
3. Customer rates experience (1-5 stars) and writes testimonial
4. If rating ≥ 4:
   - Review marked as publishable (pending moderation)
   - Customer shown "Share your link and earn rewards" CTA
   - Customer becomes CLIENT_ADVOCATE and can refer others
5. If rating ≤ 3:
   - Review marked as private feedback only
   - Not published, used for internal improvement
```

## Database Schema

### New Tables

```sql
-- Programs
programs (
  id, name, slug, description, hero_image_url, status, 
  cta_config (JSON), created_at, updated_at
)

-- Rules per program + role + conversion type
program_rules (
  id, program_id, role, conversion_type, payout_type, 
  value, currency, effective_from, effective_until, priority
)

-- Participants (consultants + advocates)
participants (
  id, program_id, role, name, email, referral_code (unique),
  payout_method (JSON), status, created_at
)

-- Attribution tracking
attributions (
  id, program_id, participant_id, referral_code, 
  landing_path, user_agent, ip_hash, created_at
)

-- Lead submissions
leads (
  id, program_id, participant_id, attribution_id,
  name, email, phone, message, created_at
)

-- Conversion events
conversions (
  id, program_id, participant_id, attribution_id,
  conversion_type, gross_amount, currency, status,
  proof_json, created_at, approved_at, approved_by
)

-- Reviews & testimonials
reviews (
  id, program_id, participant_id, rating, testimonial,
  reviewer_name, photo_url, is_public, status,
  created_at, published_at
)

-- One-time review links
review_tokens (
  id, program_id, participant_id, token (unique),
  expires_at, used_at, created_at
)
```

### Integration with Partner Ledger

The system uses existing tables from the Partners module:
- `partner_programs` - Program slugs for ledger grouping
- `partner_entities` - Participants as attributed entities (type: 'participant')
- `partner_ledger_entries` - Earnings records with idempotency (source: 'referral')
- `partner_payout_runs` - Batch payout processing

## API Endpoints

### Public Endpoints

```
POST /api/referrals/track-attribution
Body: { referralCode, landingPath }
Returns: { attributionId }

POST /api/referrals/submit-lead
Body: { referralCode, name, email, phone, message, attributionId }
Returns: { leadId, conversionId }

POST /api/referrals/submit-review
Body: { token, rating, testimonial, reviewerName, photoUrl, consent }
Returns: { reviewId, canShare, shareData }
```

### Admin Endpoints

```
POST /api/referrals/conversions/[id]/approve
Returns: { success, message }

POST /api/referrals/conversions/[id]/reject
Body: { reason }
Returns: { success, message }
```

## Dashboard Routes

```
/dashboard/programs/manage        - Program overview and management
/dashboard/programs/participants  - Participant list with referral codes
/dashboard/programs/conversions   - Approve/reject conversion events
/dashboard/programs/reviews       - Moderate and publish reviews
```

## Public Routes

```
/r/[code]         - Referral landing page with program info, social proof, and lead form
/review/[token]   - Review submission form (one-time use, expiring link)
```

## Setup Instructions

### 1. Run Migrations

```bash
# Apply the referral programs schema
# This should happen automatically via Supabase migrations
# File: supabase/migrations/20260206_referral_programs.sql
```

### 2. Create Your First Program

The seed data creates a demo program: "Consultant Referral Program" with:
- CONSULTANT rule: $50 per `booking_confirmed`
- CLIENT_ADVOCATE rule: $20 per `lead_submitted`
- Two demo participants with codes `DEMO-CONSULTANT` and `DEMO-ADVOCATE`

### 3. Test the Flow

1. Visit `/r/DEMO-CONSULTANT` to see the referral landing page
2. Submit an enquiry → Creates lead + auto-approved conversion
3. Go to `/dashboard/programs/conversions` → Approve a booking
4. Check `/dashboard/partners/ledger` → See the ledger entry
5. Check `/dashboard/partners/dashboard` → See updated totals

### 4. Generate Review Tokens

Currently manual via SQL:

```sql
INSERT INTO review_tokens (program_id, participant_id, token, expires_at)
VALUES (
  (SELECT id FROM programs WHERE slug = 'consultant-referral'),
  (SELECT id FROM participants WHERE referral_code = 'DEMO-ADVOCATE'),
  'review-token-123',
  NOW() + INTERVAL '30 days'
);
```

Then share: `yoursite.com/review/review-token-123`

## YouTube Funnel Use Case

### Scenario
A consultant publishes a YouTube video demonstrating your service and includes their referral link in the description.

### Implementation

1. **Create consultant participant**:
   ```
   Name: John Smith
   Role: CONSULTANT
   Code: JOHN-SMITH-YT
   ```

2. **Consultant includes in video description**:
   ```
   🔗 Book a free consultation: yoursite.com/r/JOHN-SMITH-YT
   ```

3. **Tracking & Attribution**:
   - Viewer clicks link → Attribution logged with referral code
   - Viewer fills enquiry → Lead conversion created (auto-approved, $0 payout)
   - Viewer books call → Booking conversion created (pending admin approval)
   - Admin approves → $50 ledger entry created for John
   - Earnings show in John's Partners Dashboard

4. **Client Advocate Loop**:
   - After successful project, admin sends review token
   - Happy client (rating 5) submits review
   - Client unlocks referral link and earns $20 per lead they refer
   - Reviews appear on John's landing page as social proof

## Payout Rules

### Rule Priority
When multiple rules match, the system uses the highest priority rule. Rules can have effective dates:

```sql
INSERT INTO program_rules (
  program_id, role, conversion_type, payout_type, value, 
  effective_from, effective_until, priority
)
VALUES (
  program_id,
  'CONSULTANT',
  'booking_confirmed',
  'fixed',
  50.00,
  '2026-01-01',
  '2026-03-31',  -- Q1 promotion
  10  -- Higher priority
);
```

### Payout Types
- **fixed**: Flat amount per conversion (e.g., $50 per booking)
- **percent**: Percentage of gross_amount (e.g., 10% of payment)

## Idempotency

The system ensures no duplicate earnings:

1. **Conversion uniqueness**: Each conversion has a unique ID
2. **Ledger constraint**: `partner_ledger_entries` has `UNIQUE(source, source_ref)` where:
   - `source = 'referral'`
   - `source_ref = conversion.id`
3. **Approval attempts**: Multiple approval attempts return "already approved" error

## Security Considerations

### Admin Protection
- All admin endpoints require authenticated user AND admin allowlist verification
- Admin authorization via `ADMIN_EMAILS` environment variable (comma-separated)
- See `ADMIN_CONFIGURATION.md` for complete setup guide

### Token Security
- Review tokens are UUIDs with expiration dates
- Tokens can only be used once
- IP hashing for attribution (not storing raw IPs)

### Referral Code Validation
- Codes must exist and be active
- Participants can be deactivated without deletion (status: 'inactive')

## Future Enhancements

### Planned Features
- [ ] Photo upload for reviews
- [ ] Automated review token generation (email integration)
- [ ] Program creation UI (currently manual SQL)
- [ ] Participant invitation flow
- [ ] WhatsApp integration for leads
- [ ] Bulk payout processing
- [ ] Custom referral code editing
- [ ] Analytics dashboard per participant
- [ ] Tiered commission structures

### Integration Opportunities
- [ ] Connect `payment_completed` conversions to existing payment_link events
- [ ] Xero sync for payout accounting
- [ ] Email notifications for conversions
- [ ] Slack/Discord webhooks for new leads
- [ ] CSV export for payouts

## Troubleshooting

### Conversions not creating ledger entries
1. Check conversion status is 'approved'
2. Verify matching rule exists in `program_rules`
3. Check console logs for errors
4. Ensure `partner_entities` allows 'participant' type

### Referral link not working
1. Verify participant status is 'active'
2. Check program status is 'active'
3. Confirm referral code matches exactly (case-sensitive)

### Reviews not appearing on landing page
1. Reviews must be status = 'published'
2. Reviews must have is_public = true
3. Only reviews for the program will show

## Maintenance

### Database Cleanup
```sql
-- Delete expired, unused review tokens (older than 90 days)
DELETE FROM review_tokens 
WHERE expires_at < NOW() - INTERVAL '90 days' 
AND used_at IS NULL;

-- Archive old attributions (older than 1 year)
DELETE FROM attributions 
WHERE created_at < NOW() - INTERVAL '1 year';
```

### Monitoring Queries
```sql
-- Pending conversions requiring approval
SELECT COUNT(*) FROM conversions WHERE status = 'pending';

-- Top performers
SELECT 
  p.name, 
  p.role,
  COUNT(c.id) as conversions,
  SUM(c.gross_amount) as total_value
FROM participants p
LEFT JOIN conversions c ON c.participant_id = p.id AND c.status = 'approved'
GROUP BY p.id, p.name, p.role
ORDER BY conversions DESC
LIMIT 10;
```

## Support

For questions or issues, refer to:
- Main Partners Module: `PARTNERS_MODULE_SUMMARY.md`
- HuntPay Integration: `HUNTPAY_LEDGER.md`
- Deployment: `DEPLOYMENT_FIX.md`

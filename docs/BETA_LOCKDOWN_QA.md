# Beta Lockdown QA Checklist

This document describes the beta lockdown feature gating system and how to test it.

## Overview

During beta testing, only the admin account (`alishajayne13@gmail.com`) can access:
- Revenue Share / Affiliate App UI
- Full Platform Preview / Commerce Intelligence UI

All other accounts only see the Payment Link App.

## Configuration

### Environment Variable

```env
BETA_LOCKDOWN_MODE=true   # Enable beta lockdown (default)
BETA_LOCKDOWN_MODE=false  # Disable beta lockdown (show all features to everyone)
```

### Admin Emails

Hardcoded in `src/lib/auth/admin.ts`:
```typescript
export const BETA_ADMIN_EMAILS = ['alishajayne13@gmail.com'] as const;
```

## Protected Features

### UI (Navigation Sidebar)

Non-admin users will NOT see:
- **Revenue Share** section (Partners, Programs)
- **Platform Preview** section (Overview, Connections, Inventory, Unified Ledger)

### Protected Routes

Non-admin users are redirected to `/dashboard` if they try to access:
- `/dashboard/partners/*`
- `/dashboard/programs/*`
- `/dashboard/consultant`
- `/dashboard/platform-preview/*`

### Protected APIs (return 403)

- `/api/referral-links` (GET, POST)
- `/api/commissions/obligations` (GET)
- `/api/commissions/ledger-entries` (GET)
- `/api/payouts` (GET)
- `/api/payouts/[id]/mark-paid` (POST)
- `/api/payouts/[id]/mark-failed` (POST)
- `/api/payout-methods` (GET, POST)
- `/api/payout-batches` (GET)
- `/api/payout-batches/create` (POST)
- `/api/payout-batches/[id]` (GET)
- `/api/payout-batches/[id]/submit` (POST)
- `/api/payout-batches/[id]/export` (GET)
- `/api/payout-batches/[id]/hedera/prepare` (POST)
- `/api/payout-batches/[id]/hedera/confirm` (POST)

## QA Test Checklist

### Admin User Tests (alishajayne13@gmail.com)

- [ ] Sign in as admin
- [ ] Verify sidebar shows all sections:
  - [ ] Main (Dashboard, Invoices, Reports, Ledger, Transactions, Admin Operations)
  - [ ] Revenue Share (Partners, Programs)
  - [ ] Platform Preview (Overview, Connections, Inventory, Unified Ledger)
  - [ ] Configuration (Settings)
- [ ] Navigate to `/dashboard/partners/dashboard` - should work
- [ ] Navigate to `/dashboard/platform-preview/overview` - should work
- [ ] Call `/api/referral-links?organizationId=...` - should return data
- [ ] Call `/api/payouts?organizationId=...` - should return data

### Non-Admin User Tests (any other email)

- [ ] Sign in as non-admin user
- [ ] Verify sidebar shows ONLY:
  - [ ] Main (Dashboard, Invoices, Reports, Ledger, Transactions, Admin Operations)
  - [ ] Configuration (Settings)
- [ ] Revenue Share section should NOT appear
- [ ] Platform Preview section should NOT appear
- [ ] Navigate directly to `/dashboard/partners/dashboard` - should redirect to `/dashboard`
- [ ] Navigate directly to `/dashboard/platform-preview/overview` - should redirect to `/dashboard`
- [ ] Call `/api/referral-links?organizationId=...` - should return 403
- [ ] Call `/api/payouts?organizationId=...` - should return 403

### Payment Link App Tests (both users)

- [ ] Create invoice/payment link - should work
- [ ] View payment links list - should work
- [ ] Process payment (Stripe/Hedera) - should work
- [ ] View transactions - should work
- [ ] View reports - should work
- [ ] Xero sync (if enabled) - should work
- [ ] Wise payments (if enabled) - should work

## Disabling Beta Lockdown

To show all features to everyone (e.g., for demos or after beta):

1. Set `BETA_LOCKDOWN_MODE=false` in environment
2. Restart the application

## Files Changed

### Core Auth
- `src/lib/auth/admin.ts` - Added `BETA_ADMIN_EMAILS`, `isBetaAdminEmail()`, `requireBetaAdminOrThrow()`, `checkBetaAdminAuth()`
- `src/lib/auth/session.ts` - Added `getCurrentUserEmail()`
- `src/lib/config/env.ts` - Added `BETA_LOCKDOWN_MODE` flag and `features.betaLockdown`

### UI
- `src/components/dashboard/app-sidebar.tsx` - Conditionally render Revenue Share and Platform Preview sections

### Route Protection
- `src/middleware.ts` - Added beta lockdown route protection for restricted dashboard routes

### API Protection
- `src/app/api/referral-links/route.ts`
- `src/app/api/commissions/obligations/route.ts`
- `src/app/api/commissions/ledger-entries/route.ts`
- `src/app/api/payouts/route.ts`
- `src/app/api/payouts/[id]/mark-paid/route.ts`
- `src/app/api/payouts/[id]/mark-failed/route.ts`
- `src/app/api/payout-methods/route.ts`
- `src/app/api/payout-batches/route.ts`
- `src/app/api/payout-batches/create/route.ts`
- `src/app/api/payout-batches/[id]/route.ts`
- `src/app/api/payout-batches/[id]/submit/route.ts`
- `src/app/api/payout-batches/[id]/export/route.ts`
- `src/app/api/payout-batches/[id]/hedera/prepare/route.ts`
- `src/app/api/payout-batches/[id]/hedera/confirm/route.ts`

# Sprint 12 Quick Reference - Xero Multi-Token Integration

## Overview
Xero accounting integration with support for **4 separate crypto clearing accounts**.

---

## Account Mapping (Critical Setup)

### Required Xero Accounts (8 total)

| Purpose | Field Name | Typical Code | Xero Type |
|---------|-----------|--------------|-----------|
| Sales Revenue | `xero_revenue_account_id` | 4000 | REVENUE |
| Accounts Receivable | `xero_receivable_account_id` | 1200 | CURRENT |
| Stripe Clearing | `xero_stripe_clearing_account_id` | 1050 | BANK/CURRENT |
| **HBAR Clearing** | `xero_hbar_clearing_account_id` | **1051** | BANK/CURRENT |
| **USDC Clearing** | `xero_usdc_clearing_account_id` | **1052** | BANK/CURRENT |
| **USDT Clearing** | `xero_usdt_clearing_account_id` | **1053** | BANK/CURRENT |
| **AUDD Clearing 🇦🇺** | `xero_audd_clearing_account_id` | **1054** | BANK/CURRENT |
| Fee Expense | `xero_fee_expense_account_id` | 6100 | EXPENSE |

**⚠️ CRITICAL:** Each crypto token MUST have its own separate Xero clearing account!

---

## API Quick Reference

### 1. Fetch Xero Accounts
```typescript
GET /api/xero/accounts?organization_id={uuid}

// Filter by type
GET /api/xero/accounts?organization_id={uuid}&type=REVENUE

// Search
GET /api/xero/accounts?organization_id={uuid}&search=crypto
```

### 2. Get Current Mappings
```typescript
GET /api/settings/xero-mappings?organization_id={uuid}
```

### 3. Save Account Mappings
```typescript
PUT /api/settings/xero-mappings

Body: {
  organizationId: "uuid",
  xero_revenue_account_id: "...",
  xero_receivable_account_id: "...",
  xero_stripe_clearing_account_id: "...",
  xero_hbar_clearing_account_id: "...",      // ⭐ Account 1051
  xero_usdc_clearing_account_id: "...",      // ⭐ Account 1052
  xero_usdt_clearing_account_id: "...",      // ⭐ Account 1053
  xero_audd_clearing_account_id: "...",      // ⭐ Account 1054
  xero_fee_expense_account_id: "..."
}
```

---

## Code Usage

### Sync Payment to Xero
```typescript
import { syncPaymentToXero } from '@/lib/xero';

const result = await syncPaymentToXero({
  paymentLinkId: 'link-123',
  organizationId: 'org-456',
});

if (result.success) {
  console.log('Synced:', result.invoiceNumber);
  console.log('Payment ID:', result.paymentId);
  console.log('Narration:', result.narration);
} else {
  console.error('Sync failed:', result.error);
}
```

### Create Invoice Only
```typescript
import { createXeroInvoice } from '@/lib/xero';

const invoice = await createXeroInvoice({
  paymentLinkId: 'link-123',
  organizationId: 'org-456',
  amount: '100.00',
  currency: 'USD',
  description: 'Payment for services',
  customerEmail: 'customer@example.com',
  invoiceReference: 'INV-001',
});
```

### Record Payment Only
```typescript
import { recordXeroPayment } from '@/lib/xero';

const payment = await recordXeroPayment({
  paymentLinkId: 'link-123',
  organizationId: 'org-456',
  invoiceId: 'xero-invoice-id',
  amount: '100.00',
  currency: 'USD',
  paymentDate: new Date(),
  paymentMethod: 'HEDERA',
  paymentToken: 'AUDD', // or HBAR, USDC, USDT
  transactionId: '0.0.123@456.789',
  fxRate: 1.0,
  cryptoAmount: '100.000000',
});
```

---

## Payment Token to Clearing Account Map

```typescript
// Automatic mapping in payment-service.ts:
STRIPE → xero_stripe_clearing_account_id
HBAR   → xero_hbar_clearing_account_id  (Account 1051)
USDC   → xero_usdc_clearing_account_id  (Account 1052)
USDT   → xero_usdt_clearing_account_id  (Account 1053)
AUDD   → xero_audd_clearing_account_id  (Account 1054) 🇦🇺
```

---

## Payment Narration Examples

### Stripe Payment
```
Payment via STRIPE
Transaction: pi_123456789
Amount: 100.00 USD
```

### HBAR Payment
```
Payment via HEDERA_HBAR
Transaction: 0.0.123@456.789
Token: HBAR
FX Rate: 0.05000000 HBAR/USD @ 2024-12-15T10:30:00Z
Amount: 2000.00000000 HBAR = 100.00 USD
```

### AUDD Payment (Currency Matched)
```
Payment via HEDERA_AUDD
Transaction: 0.0.123@456.789
Token: AUDD
FX Rate: 1.00000000 AUDD/AUD @ 2024-12-15T10:30:00Z
Amount: 100.000000 AUDD = 100.00 AUD
✓ No FX risk - Currency matched payment 🇦🇺
```

---

## UI Component Usage

### Account Mapping Component
```typescript
import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';

<XeroAccountMapping organizationId={orgId} />
```

**Features:**
- Fetches Xero accounts automatically
- 8 separate mapping fields
- AUDD badge: "🇦🇺 AUD Stablecoin"
- Validation (all fields required, no duplicates)
- Auto-suggest defaults
- Mapping summary
- Reset to defaults
- Refresh accounts

---

## Database Queries

### Check Account Mappings
```sql
SELECT 
  xero_revenue_account_id,
  xero_receivable_account_id,
  xero_stripe_clearing_account_id,
  xero_hbar_clearing_account_id,
  xero_usdc_clearing_account_id,
  xero_usdt_clearing_account_id,
  xero_audd_clearing_account_id,
  xero_fee_expense_account_id
FROM merchant_settings 
WHERE organization_id = 'your-org-id';
```

### Check Sync Status
```sql
SELECT 
  status,
  xero_invoice_id,
  xero_payment_id,
  error_message,
  retry_count,
  created_at
FROM xero_syncs 
WHERE payment_link_id = 'your-payment-link-id'
ORDER BY created_at DESC;
```

---

## Validation Rules

### Account Mapping Validation
1. ✅ All 8 fields must be filled
2. ✅ No duplicate crypto clearing accounts
3. ✅ Each token must map to different Xero account

### Payment Sync Validation
1. ✅ Payment link status must be PAID
2. ✅ Payment event must exist
3. ✅ Xero connection must be active
4. ✅ Account mappings must be configured
5. ✅ Transaction ID must exist

---

## Common Errors & Solutions

### "No active Xero connection found"
```typescript
// Solution: Check connection status
const status = await getConnectionStatus(organizationId);
if (!status.connected) {
  // Redirect to Xero connection page
}
```

### "Clearing account not mapped for AUDD"
```typescript
// Solution: Configure account mappings
// Go to Settings → Xero → Account Mapping
// Map all 8 accounts including AUDD (Account 1054)
```

### "Payment link is not paid"
```typescript
// Solution: Only sync PAID payment links
if (paymentLink.status !== 'PAID') {
  throw new Error('Payment link must be PAID before syncing');
}
```

---

## File Locations

### Services
```
src/lib/xero/
├── accounts-service.ts       # Fetch Xero accounts
├── invoice-service.ts        # Create invoices
├── payment-service.ts        # Record payments (multi-token)
├── sync-orchestration.ts     # Orchestrate syncs
└── index.ts                  # Exports
```

### API Routes
```
src/app/api/
├── xero/accounts/route.ts              # Xero accounts API
└── settings/xero-mappings/route.ts     # Mappings API
```

### Components
```
src/components/dashboard/settings/
└── xero-account-mapping.tsx  # Account mapping UI
```

### Tests
```
src/lib/xero/__tests__/
└── multi-token-payment.test.ts  # Multi-token tests
```

---

## Testing Checklist

### Account Mapping
- [ ] Fetch accounts from Xero
- [ ] Map all 8 accounts
- [ ] Verify AUDD has 🇦🇺 badge
- [ ] Test validation (missing fields)
- [ ] Test validation (duplicates)
- [ ] Save mappings
- [ ] Refresh accounts

### Payment Sync
- [ ] Sync Stripe payment
- [ ] Sync HBAR payment (verify Account 1051)
- [ ] Sync USDC payment (verify Account 1052)
- [ ] Sync USDT payment (verify Account 1053)
- [ ] Sync AUDD payment (verify Account 1054)
- [ ] Verify narration in Xero
- [ ] Check AUDD/AUD shows "No FX risk" note
- [ ] Test retry failed sync

---

## CRITICAL REMINDERS

### ⚠️ 4 Separate Crypto Accounts Required
**NEVER** map multiple tokens to the same Xero account!
- HBAR → Account 1051
- USDC → Account 1052
- USDT → Account 1053
- AUDD → Account 1054

### ⚠️ AUDD Special Handling
- Dedicated clearing account (1054)
- Special badge in UI
- Currency-match detection (AUDD/AUD)
- "No FX risk" note when matched

### ⚠️ Token-Specific Narration
Every payment MUST include:
- Payment method
- Token type
- Transaction ID
- FX rate (for crypto)
- Crypto amount
- Fiat amount

---

## Quick Commands

### Run Migration
```bash
npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

### Regenerate Prisma Client
```bash
npx prisma generate --schema=./src/prisma/schema.prisma
```

### Run Tests
```bash
npm test src/lib/xero/__tests__/multi-token-payment.test.ts
```

---

## Support & References

- **Sprint 12 Complete:** `SPRINT12_COMPLETE.md`
- **Sprint 11 (Xero OAuth):** `SPRINT11_COMPLETE.md`
- **Sprint 10 (Ledger):** `SPRINT10_COMPLETE.md`
- **Xero Setup Guide:** `XERO_SETUP_GUIDE.md`
- **Xero API Docs:** https://developer.xero.com/documentation/

---

**Sprint 12: Multi-Token Xero Integration - Ready for Production! 🚀**







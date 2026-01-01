# Timing Instrumentation & Expired Page - Changes Summary

**Date:** December 31, 2025  
**Issues Fixed:**
- A) Added timing instrumentation to diagnose slow GET /api/payment-links/[id]/status
- B) Created missing /pay/[shortCode]/expired page (was returning 404)

---

## 🎯 Issue A: Timing Instrumentation Added

### File: `src/app/api/payment-links/[id]/status/route.ts`

**Problem:** GET endpoint sometimes takes 32-36 seconds, need to identify slow step.

**Solution:** Added lightweight timing logs at each major step using existing `loggers.api.info()`.

### Timing Points Added:

1. **Start of handler** (line 152)
   ```typescript
   const startTime = Date.now();
   ```

2. **After rate limit** (lines 157-158)
   ```typescript
   const afterRateLimit = Date.now();
   loggers.api.info({ duration: afterRateLimit - startTime }, '[Status GET] After rate limit');
   ```

3. **After await params** (lines 170-171)
   ```typescript
   const afterParams = Date.now();
   loggers.api.info({ paymentLinkId: id, duration: afterParams - afterRateLimit }, '[Status GET] After await params');
   ```

4. **Before/After prisma.payment_links.findUnique** (lines 174, 199-204)
   ```typescript
   const beforeFindUnique = Date.now();
   const paymentLink = await prisma.payment_links.findUnique({ ... });
   const afterFindUnique = Date.now();
   loggers.api.info({ 
     paymentLinkId: id, 
     duration: afterFindUnique - beforeFindUnique,
     found: !!paymentLink 
   }, '[Status GET] After payment_links.findUnique');
   ```

5. **Before/After auto-expire transaction** (lines 219, 236-240) - Only if link is expired
   ```typescript
   const beforeTransaction = Date.now();
   await prisma.$transaction([ ... ]);
   const afterTransaction = Date.now();
   loggers.api.info({ 
     paymentLinkId: id, 
     duration: afterTransaction - beforeTransaction 
   }, '[Status GET] After auto-expire transaction');
   ```

6. **Before response build** (line 248)
   ```typescript
   const beforeResponseBuild = Date.now();
   ```

7. **Before return - TOTAL TIME** (lines 266-272)
   ```typescript
   const beforeReturn = Date.now();
   const totalDuration = beforeReturn - startTime;
   loggers.api.info({ 
     paymentLinkId: id,
     responseBuildDuration: beforeReturn - beforeResponseBuild,
     totalDuration 
   }, '[Status GET] Before return - TOTAL TIME');
   ```

### Example Log Output:

When you call the endpoint, you'll see logs like:

```json
{"level":"info","duration":15,"msg":"[Status GET] After rate limit"}
{"level":"info","paymentLinkId":"abc-123","duration":2,"msg":"[Status GET] After await params"}
{"level":"info","paymentLinkId":"abc-123","duration":31500,"found":true,"msg":"[Status GET] After payment_links.findUnique"}
{"level":"info","paymentLinkId":"abc-123","duration":1200,"msg":"[Status GET] After auto-expire transaction"}
{"level":"info","paymentLinkId":"abc-123","responseBuildDuration":5,"totalDuration":32722,"msg":"[Status GET] Before return - TOTAL TIME"}
```

### What to Look For:

- **If `findUnique` duration is high (>30s):** Database connection issue or slow query
- **If `auto-expire transaction` is high:** Transaction lock or slow write
- **If `totalDuration` is high but individual steps are fast:** Network latency or middleware
- **If rate limit is high:** Rate limit check is slow

### No Behavior Changes:

- ✅ Same JSON response shape
- ✅ Same error handling
- ✅ Same status codes
- ✅ Only added logging

---

## 🎯 Issue B: Created Missing Expired Page

### File: `src/app/(public)/pay/[shortCode]/expired/page.tsx` (NEW)

**Problem:** App navigates to `/pay/[shortCode]/expired` but page doesn't exist (404).

**Solution:** Created expired page following same pattern as canceled page.

### Page Contents:

```typescript
/**
 * Payment Link Expired Page
 * Displayed when payment link has expired
 */

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PaymentExpiredPage() {
  const params = useParams();
  const shortCode = params.shortCode as string;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <Card className="p-8 max-w-lg w-full">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Expired Icon */}
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
            <Clock className="w-12 h-12 text-amber-600" />
          </div>

          {/* Expired Message */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Payment Link Expired
            </h1>
            <p className="text-slate-600">
              This payment link has passed its expiration date and is no longer accepting payments.
            </p>
          </div>

          {/* Information */}
          <div className="w-full bg-slate-50 rounded-lg p-6 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm text-slate-700 mb-2">
                  <strong>What happens next?</strong>
                </p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>This link can no longer be used for payment</li>
                  <li>Contact the merchant for a new payment link</li>
                  <li>The merchant can create a fresh link for you</li>
                  <li>No charges were made to your account</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href={`/pay/${shortCode}`}>
                View Link Details
              </Link>
            </Button>
          </div>

          {/* Help Text */}
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Need help?</strong> Please contact the merchant who sent you this 
              payment link to request a new one with an updated expiration date.
            </p>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-500 mt-4">
            Payment Link: <span className="font-mono">{shortCode}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
```

### Features:

- ✅ Reads `shortCode` from params and displays it
- ✅ Uses existing UI components (Button, Card from shadcn/ui)
- ✅ Matches design pattern of canceled/success pages
- ✅ Two CTAs: "Go Home" (/) and "View Link Details" (/pay/[shortCode])
- ✅ Clear explanation of what happened
- ✅ Helpful information about next steps
- ✅ Next.js 15 App Router compatible

### Navigation Flow:

**Where it's called from:**

1. **`src/components/public/payment-status-monitor.tsx`** (lines 92-95)
   ```typescript
   else if (newStatus.currentStatus === 'EXPIRED') {
     setTimeout(() => {
       router.push(`/pay/${shortCode}/expired`);
     }, 2000);
   }
   ```

2. **On timeout** (lines 102-107)
   ```typescript
   onTimeout: () => {
     // Redirect to expired page on timeout
     setTimeout(() => {
       router.push(`/pay/${shortCode}/expired`);
     }, 3000);
   },
   ```

### UX Note Added:

Added comment in `payment-status-monitor.tsx` (lines 87-88):
```typescript
// NOTE: Alternative UX could show expired state inline on /pay/[shortCode]
// instead of navigating away. Current pattern follows same flow as success/canceled.
```

**Rationale:** Current pattern is consistent with success/canceled pages. All final states navigate to dedicated pages. Could be refactored later to show inline, but would require changes to main payment page logic.

---

## 📁 Files Changed

| File | Type | Changes |
|------|------|---------|
| `src/app/api/payment-links/[id]/status/route.ts` | Modified | Added 7 timing log points in GET handler |
| `src/app/(public)/pay/[shortCode]/expired/page.tsx` | Created | New expired page with UI |
| `src/components/public/payment-status-monitor.tsx` | Modified | Added UX comment about alternative approach |
| `TIMING_AND_EXPIRED_PAGE_CHANGES.md` | Created | This summary document |

---

## 🧪 Testing

### Test Timing Logs:

1. **Start server:**
   ```bash
   cd src
   npm run start
   ```

2. **Call the endpoint:**
   ```bash
   curl http://localhost:3000/api/payment-links/[PAYMENT_LINK_ID]/status
   ```

3. **Check server logs:**
   Look for `[Status GET]` messages with timing data:
   ```
   [Status GET] After rate limit
   [Status GET] After await params
   [Status GET] After payment_links.findUnique
   [Status GET] After auto-expire transaction (if expired)
   [Status GET] Before return - TOTAL TIME
   ```

4. **Identify slow step:**
   - If `findUnique` takes >30s → Database issue
   - If `auto-expire transaction` takes >5s → Transaction lock
   - If total is high but steps are fast → Network/middleware

### Test Expired Page:

1. **Direct navigation:**
   ```
   http://localhost:3000/pay/SkD0OB06/expired
   ```

2. **Should show:**
   - ✅ Expired icon (clock)
   - ✅ "Payment Link Expired" heading
   - ✅ Short code displayed at bottom
   - ✅ Two buttons: "Go Home" and "View Link Details"
   - ✅ Help text about contacting merchant

3. **Test buttons:**
   - "Go Home" → Should navigate to `/`
   - "View Link Details" → Should navigate to `/pay/SkD0OB06`

4. **Test via status monitor:**
   - Create/find an expired payment link
   - Open in browser
   - Wait for status monitor to detect EXPIRED
   - Should auto-redirect to `/pay/[shortCode]/expired` after 2 seconds

---

## 🎓 Key Points

### Timing Instrumentation:

1. **Minimal overhead:** Only Date.now() calls and logging
2. **Safe for production:** Uses existing logger, no behavior changes
3. **Comprehensive coverage:** Every major async operation is timed
4. **Easy to analyze:** Clear labels and duration in milliseconds
5. **Includes context:** Payment link ID included in all logs

### Expired Page:

1. **Follows existing patterns:** Matches canceled/success page design
2. **Uses existing components:** Button, Card from UI library
3. **Clear messaging:** User knows what happened and what to do
4. **Consistent UX:** Same navigation pattern as other final states
5. **Next.js 15 compatible:** Uses App Router conventions

---

## 🔍 Debugging Slow Requests

When you see a slow request (32-36 seconds), check the logs:

### Scenario 1: Slow Database Query
```json
{"duration":31500,"msg":"[Status GET] After payment_links.findUnique"}
```
**Likely cause:** Database connection issue, query timeout, or connection pooling
**Fix:** Check database connection, connection pool settings, query optimization

### Scenario 2: Slow Transaction
```json
{"duration":30000,"msg":"[Status GET] After auto-expire transaction"}
```
**Likely cause:** Transaction lock, slow write, or database contention
**Fix:** Check for locks, optimize transaction, consider async processing

### Scenario 3: Slow Rate Limit
```json
{"duration":25000,"msg":"[Status GET] After rate limit"}
```
**Likely cause:** Rate limit check hitting slow external service
**Fix:** Optimize rate limit implementation, use in-memory cache

### Scenario 4: Network Latency
```json
{"totalDuration":32000,"msg":"[Status GET] Before return - TOTAL TIME"}
```
But individual steps are all <100ms
**Likely cause:** Network latency, middleware overhead, or proxy
**Fix:** Check network configuration, reduce middleware, optimize hosting

---

## ✅ Summary

**Issue A - Timing Instrumentation:** ✅ COMPLETE
- Added 7 timing checkpoints
- Uses existing logger
- No behavior changes
- Ready to diagnose slow requests

**Issue B - Expired Page:** ✅ COMPLETE
- Created `/pay/[shortCode]/expired/page.tsx`
- Matches existing design patterns
- Uses existing UI components
- No more 404 errors

**Both changes are minimal, safe, and ready for dev/production!** 🚀


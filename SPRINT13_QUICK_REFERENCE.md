# Sprint 13: Xero Queue & Retry - Quick Reference

## 🚀 What Was Built

### Core Services
1. **Queue Service** (`src/lib/xero/queue-service.ts`)
   - Automatic queue insertion
   - Retry calculation with exponential backoff
   - Error categorization
   - Statistics and monitoring

2. **Queue Processor** (`src/lib/xero/queue-processor.ts`)
   - Batch processing
   - Automatic retry execution
   - Manual replay support

### API Endpoints

#### Process Queue (Cron)
```bash
POST /api/xero/queue/process
Authorization: Bearer <CRON_SECRET>
```

#### Manual Replay
```bash
POST /api/xero/sync/replay?organization_id=xxx
{
  "syncId": "uuid",
  "resetRetryCount": true
}
```

#### Get Statistics
```bash
GET /api/xero/sync/stats?organization_id=xxx
```

#### Get Failed Syncs
```bash
GET /api/xero/sync/failed?organization_id=xxx&limit=50
```

#### Get Sync Status
```bash
GET /api/xero/sync/status?payment_link_id=xxx&organization_id=xxx
```

## 📋 Retry Schedule

| Attempt | Delay      | Time Since First Failure |
|---------|------------|--------------------------|
| 1       | 1 minute   | 1 minute                 |
| 2       | 5 minutes  | 6 minutes                |
| 3       | 15 minutes | 21 minutes               |
| 4       | 1 hour     | 1 hour 21 minutes        |
| 5       | 6 hours    | 7 hours 21 minutes       |
| After 5 | FAILED (permanent) |                          |

## 🔍 Error Types

| Error Type     | Retryable? | Examples                             |
|----------------|------------|--------------------------------------|
| PERMANENT      | ❌ No      | validation, not found, unauthorized  |
| RATE_LIMIT     | ✅ Yes     | 429, too many requests               |
| NETWORK        | ✅ Yes     | timeout, ECONNREFUSED, 503/504       |
| API_ERROR      | ✅ Yes     | Xero API errors, token expired, 500  |
| UNKNOWN        | ✅ Yes     | Default: retry to be safe            |

## 🔄 Automatic Queue Flow

```
Payment Confirmed
        ↓
  Post to Ledger
        ↓
  Queue Xero Sync (Sprint 13)
        ↓
  Status: PENDING
        ↓
  Cron Job (Every Minute)
        ↓
  Process Queue
        ↓
   Success? → SUCCESS ✅
        ↓
   Failure? → Calculate Next Retry
        ↓
  Status: RETRYING (with next_retry_at)
        ↓
  Wait for Retry Time
        ↓
  Process Again
        ↓
  Repeat up to 5 times
        ↓
  After 5 failures → FAILED ❌
```

## 📊 Database Fields

### xero_syncs table
```typescript
{
  status: 'PENDING' | 'RETRYING' | 'SUCCESS' | 'FAILED',
  retry_count: 0-5,
  next_retry_at: Date | null,
  error_message: string | null,
  request_payload: {
    paymentLinkId,
    organizationId,
    queuedAt,
    priority
  },
  response_payload: {
    // On success:
    success: true,
    invoiceId,
    invoiceNumber,
    paymentId,
    narration
    
    // On failure:
    success: false,
    error,
    errorType,
    retryable,
    retryCount
  }
}
```

## 🛠️ Usage Examples

### Queue a Sync (Automatic)
```typescript
import { queueXeroSync } from '@/lib/xero/queue-service';

await queueXeroSync({
  paymentLinkId: 'uuid',
  organizationId: 'uuid',
  priority: 0, // Optional
});
```

### Process Queue (Cron)
```typescript
import { processQueue } from '@/lib/xero/queue-processor';

const stats = await processQueue(10); // batch size
console.log(stats);
// {
//   processed: 10,
//   succeeded: 8,
//   failed: 2,
//   skipped: 0,
//   errors: [...]
// }
```

### Manual Replay
```typescript
import { processSyncById } from '@/lib/xero/queue-processor';

const result = await processSyncById('sync-uuid');
if (result.success) {
  console.log('Sync succeeded!');
} else {
  console.error('Sync failed:', result.error);
}
```

### Get Statistics
```typescript
import { getSyncStatistics } from '@/lib/xero/queue-service';

const stats = await getSyncStatistics('org-uuid');
// {
//   total: 100,
//   pending: 5,
//   retrying: 2,
//   success: 85,
//   failed: 8,
//   successRate: 85.0,
//   failureRate: 8.0
// }
```

## 📁 File Structure

```
src/
├── lib/
│   └── xero/
│       ├── queue-service.ts          # Queue management
│       ├── queue-processor.ts        # Queue processing
│       └── index.ts                  # Exports
├── app/
│   └── api/
│       └── xero/
│           ├── queue/
│           │   └── process/
│           │       └── route.ts      # Cron endpoint
│           └── sync/
│               ├── replay/
│               │   └── route.ts      # Manual replay
│               ├── stats/
│               │   └── route.ts      # Statistics
│               ├── failed/
│               │   └── route.ts      # Failed syncs
│               └── status/
│                   └── route.ts      # Sync status
└── vercel.json                       # Cron config
```

## ⚙️ Environment Variables

```env
# Required for cron job security
CRON_SECRET=your_random_secret_here
```

Generate a secret:
```bash
openssl rand -hex 32
```

## 🎯 Integration Points

### Stripe Webhooks
- `handlePaymentIntentSucceeded()` → queues sync
- `handleCheckoutSessionCompleted()` → queues sync

### Hedera Payments
- `confirmHederaPayment()` → queues sync

### Ledger System
- Queues sync **after** successful ledger posting
- Ensures data integrity

## 🚨 Monitoring

### Key Metrics
- Success Rate: `success / total * 100`
- Failure Rate: `failed / total * 100`
- Queue Backlog: Count of PENDING/RETRYING
- Average Retry Count

### Recommended Alerts
- ⚠️ Failure rate > 10% in last hour
- ⚠️ Queue backlog > 100 items
- ⚠️ No syncs processed in 5+ minutes
- ⚠️ Any sync with retry_count > 3

## ✅ Success Criteria Met

- ✅ Automatic queue on payment confirmation
- ✅ Exponential backoff (1min → 6hr)
- ✅ Max 5 retries enforced
- ✅ Error categorization (retryable vs permanent)
- ✅ Manual replay API
- ✅ Statistics endpoint
- ✅ Failed syncs query
- ✅ Sync status tracking
- ✅ Cron job configured
- ✅ Non-blocking error handling

## 🔜 Next Sprint

**Sprint 14: Admin Operations Panel**
- Build UI for failed syncs dashboard
- Add manual replay button
- Create sync statistics charts
- Display queue health metrics








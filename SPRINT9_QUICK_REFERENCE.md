# Sprint 9: Payment Status Polling - Quick Reference

## Overview

Sprint 9 implements real-time payment status polling and background job infrastructure for automatic payment link lifecycle management.

## Key Features

### 1. Status Polling Hook

```typescript
import { usePaymentStatusPolling } from '@/hooks/use-payment-status-polling';

const { status, isLoading, hasTimedOut, refetch } = usePaymentStatusPolling({
  paymentLinkId: 'payment-link-id',
  initialInterval: 3000,        // Poll every 3 seconds
  timeout: 900000,               // 15 minute timeout
  onStatusChange: (status) => {
    console.log('Status changed:', status.currentStatus);
  },
  onTimeout: () => {
    router.push('/expired');
  },
});
```

### 2. Status Monitor Component

```typescript
import { PaymentStatusMonitor } from '@/components/public/payment-status-monitor';

<PaymentStatusMonitor
  paymentLinkId={paymentLink.id}
  shortCode={shortCode}
  initialStatus={paymentLink.status}
  onStatusChange={(status) => console.log(status)}
/>
```

### 3. Status API Endpoint

```bash
# Get current payment status
GET /api/payment-links/{id}/status

# Response
{
  "data": {
    "id": "payment-link-id",
    "shortCode": "ABC12345",
    "currentStatus": "OPEN",
    "statusMessage": "Awaiting payment",
    "lastEventType": "CREATED",
    "lastEventTimestamp": "2025-12-14T10:00:00Z",
    "paymentMethod": null,
    "transactionInfo": null,
    "expiresAt": "2025-12-15T10:00:00Z",
    "isExpired": false,
    "updatedAt": "2025-12-14T10:00:00Z"
  }
}
```

### 4. Background Jobs

#### Expired Links Job

```bash
# Run manually (secured with cron secret)
POST /api/jobs/expired-links
Headers: x-cron-secret: your-secret-here

# Get job status
GET /api/jobs/expired-links
Headers: x-cron-secret: your-secret-here
```

**Schedule:** Every 5 minutes  
**Purpose:** Transition expired OPEN links to EXPIRED status

#### Stuck Payments Checker

```bash
# Run manually
POST /api/jobs/stuck-payments
Headers: x-cron-secret: your-secret-here

# Get job status
GET /api/jobs/stuck-payments
Headers: x-cron-secret: your-secret-here
```

**Schedule:** Every 15 minutes  
**Purpose:** Detect and log payment links stuck in OPEN state

## Configuration

### Environment Variables

```bash
# .env.local
CRON_SECRET=your-secure-random-secret
```

Generate secret:
```bash
openssl rand -base64 32
```

### Vercel Cron (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/jobs/expired-links",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/jobs/stuck-payments",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

## Usage Examples

### Example 1: Add Polling to Payment Page

```typescript
'use client';

import { usePaymentStatusPolling } from '@/hooks/use-payment-status-polling';
import { PaymentStatusMonitor } from '@/components/public/payment-status-monitor';

export default function PaymentPage({ paymentLinkId, shortCode }) {
  const { status, hasTimedOut } = usePaymentStatusPolling({
    paymentLinkId,
    onTimeout: () => {
      router.push(`/pay/${shortCode}/expired`);
    },
  });

  return (
    <>
      {/* Your payment UI */}
      <PaymentStatusMonitor
        paymentLinkId={paymentLinkId}
        shortCode={shortCode}
      />
    </>
  );
}
```

### Example 2: Manual Status Check

```typescript
const checkStatus = async (paymentLinkId: string) => {
  const response = await fetch(`/api/payment-links/${paymentLinkId}/status`);
  const { data } = await response.json();
  
  console.log('Current status:', data.currentStatus);
  console.log('Last event:', data.lastEventType);
  
  if (data.transactionInfo) {
    console.log('Transaction ID:', data.transactionInfo.transactionId);
  }
};
```

### Example 3: Trigger Background Job Manually

```typescript
const runExpiredLinksJob = async () => {
  const response = await fetch('/api/jobs/expired-links', {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET!,
    },
  });
  
  const result = await response.json();
  console.log('Job result:', result);
};
```

## Polling Behavior

### Intervals
- **Default:** 3 seconds
- **On Error:** Exponential backoff (6s, 12s, 24s, 30s max)
- **On Success:** Reset to 3 seconds

### Termination Conditions
- Status becomes PAID → Stop polling
- Status becomes EXPIRED → Stop polling
- Status becomes CANCELED → Stop polling
- Timeout reached (15 minutes) → Stop polling

### Timeout Handling
- After 15 minutes, polling stops
- `onTimeout` callback triggered
- User redirected to expired page
- Alert displayed before redirect

## Status Flow

```
DRAFT → OPEN → PAID
         ↓      ↓
      EXPIRED   Success Page
         ↓
    Expired Page

DRAFT → OPEN → CANCELED
         ↓      ↓
      Manual   Canceled Page
```

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Polling | 300 requests | 15 minutes |
| API | 100 requests | 15 minutes |
| Public | 30 requests | 1 minute |

## Job Scheduler Functions

```typescript
import { executeJob, getJobHistory, getJobStats } from '@/lib/jobs/job-scheduler';

// Execute a job
const execution = await executeJob(
  {
    name: 'my-job',
    description: 'My background job',
    enabled: true,
  },
  async () => {
    // Job logic here
    return { success: true, duration: 1000 };
  }
);

// Get job history
const history = getJobHistory('expired-links', 10);

// Get job statistics
const stats = getJobStats('expired-links');
console.log('Success rate:', stats.successRate);
console.log('Avg duration:', stats.averageDuration);
```

## Monitoring

### Check Job Status

```bash
curl -X GET https://your-domain.com/api/jobs/expired-links \
  -H "x-cron-secret: your-secret"

# Response
{
  "jobName": "expired-links",
  "stats": {
    "totalExecutions": 100,
    "successCount": 98,
    "failureCount": 2,
    "averageDuration": 450,
    "successRate": 98,
    "lastExecution": {
      "startTime": "2025-12-14T10:00:00Z",
      "endTime": "2025-12-14T10:00:01Z",
      "success": true
    }
  },
  "recentExecutions": [...]
}
```

### View Logs

```typescript
// Check logs for expired links job
loggers.jobs.info('Expired links job completed');

// Check for stuck payments warnings
loggers.jobs.warn('Found stuck payment links', { count: 5 });
```

## Troubleshooting

### Polling Not Working

1. Check browser console for errors
2. Verify payment link ID is correct
3. Check rate limiting (429 errors)
4. Verify API endpoint is accessible

### Jobs Not Running

1. Check `CRON_SECRET` environment variable
2. Verify Vercel cron configuration
3. Check job execution logs
4. Test manual job trigger with curl

### Status Not Updating

1. Check if link is in final state (PAID, EXPIRED, CANCELED)
2. Verify database connection
3. Check for errors in job logs
4. Manually check payment_events table

## Performance Tips

1. **Use polling only when needed** - Enable only after payment starts
2. **Terminate on final states** - Polling stops automatically
3. **Monitor rate limits** - Stay within polling limits
4. **Optimize job schedules** - Balance frequency vs. load

## Security Checklist

- [x] Cron secret configured
- [x] Secret stored in environment variables
- [x] Jobs secured with header verification
- [x] Rate limiting configured
- [x] No sensitive data in logs
- [x] Audit logging for status changes

## Common Patterns

### Pattern 1: Polling with Auto-Redirect

```typescript
usePaymentStatusPolling({
  paymentLinkId,
  onStatusChange: (status) => {
    if (status.currentStatus === 'PAID') {
      router.push(`/pay/${shortCode}/success`);
    }
  },
});
```

### Pattern 2: Conditional Polling

```typescript
const [enablePolling, setEnablePolling] = useState(false);

usePaymentStatusPolling({
  paymentLinkId,
  enabled: enablePolling,
});

// Enable when payment starts
const handlePaymentStart = () => {
  setEnablePolling(true);
};
```

### Pattern 3: Manual Refresh

```typescript
const { refetch, isLoading } = usePaymentStatusPolling({
  paymentLinkId,
});

<Button onClick={refetch} disabled={isLoading}>
  {isLoading ? 'Refreshing...' : 'Refresh Status'}
</Button>
```

## Files Reference

| File | Purpose |
|------|---------|
| `hooks/use-payment-status-polling.ts` | Polling hook |
| `components/public/payment-status-monitor.tsx` | Status UI component |
| `app/api/payment-links/[id]/status/route.ts` | Status API |
| `lib/jobs/expired-links-job.ts` | Expired links job |
| `lib/jobs/job-scheduler.ts` | Job infrastructure |
| `app/api/jobs/expired-links/route.ts` | Expired links API |
| `app/api/jobs/stuck-payments/route.ts` | Stuck payments API |

## Additional Resources

- Full documentation: `SPRINT9_COMPLETE.md`
- Prisma schema: `prisma/schema.prisma`
- Logger configuration: `src/lib/logger.ts`
- Rate limiting: `src/lib/rate-limit.ts`

---

**Sprint 9 Complete!** 🎉  
For questions or issues, refer to the full documentation in `SPRINT9_COMPLETE.md`.







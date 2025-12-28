# Sprint 9: Deployment Checklist

## Pre-Deployment

### Code Review
- [x] All files created and tested locally
- [x] TypeScript compilation successful
- [x] No linting errors
- [x] All imports resolved correctly

### Configuration Files
- [x] `vercel.json` created with cron configuration
- [x] Cron jobs scheduled (5 min, 15 min)
- [x] Rate limiter updated with polling limits

### Documentation
- [x] `SPRINT9_COMPLETE.md` - Full documentation
- [x] `SPRINT9_QUICK_REFERENCE.md` - Quick reference
- [x] `SPRINT9_SUMMARY.md` - Sprint summary
- [x] `SPRINT9_DEPLOYMENT_CHECKLIST.md` - This checklist
- [x] `todo.md` updated with Sprint 9 completion

## Environment Variables

### Required Variables
- [ ] `CRON_SECRET` - Generate with: `openssl rand -base64 32`

### Vercel Setup
```bash
# Local .env.local
CRON_SECRET=your-local-secret-here

# Vercel Production
vercel env add CRON_SECRET production
# Paste your generated secret

# Vercel Preview
vercel env add CRON_SECRET preview
# Paste your generated secret
```

## Deployment Steps

### 1. Pre-Deployment Testing
- [ ] Test status polling hook locally
- [ ] Test status monitor component
- [ ] Test expired links job manually
- [ ] Test stuck payments checker manually
- [ ] Verify all imports work

### 2. Commit Changes
```bash
git add .
git commit -m "Sprint 9: Payment Status Polling & Updates - Complete"
git push origin main
```

### 3. Deploy to Vercel
```bash
# Deploy to production
vercel --prod

# Or push to main branch for auto-deploy
git push origin main
```

### 4. Configure Environment Variables
- [ ] Add `CRON_SECRET` to Vercel environment variables
- [ ] Verify all other environment variables are present
- [ ] Redeploy if variables were added after deployment

### 5. Verify Cron Jobs
- [ ] Check Vercel dashboard for cron jobs
- [ ] Verify `/api/jobs/expired-links` is listed
- [ ] Verify `/api/jobs/stuck-payments` is listed
- [ ] Check cron schedule is correct (5 min, 15 min)

## Post-Deployment Verification

### Status Polling
- [ ] Create a test payment link
- [ ] Open public pay page
- [ ] Select a payment method
- [ ] Verify status monitor appears
- [ ] Check browser console for polling logs
- [ ] Verify polling interval is 3 seconds
- [ ] Check Network tab for API calls

### Timeout Handling
- [ ] Create test payment link
- [ ] Open pay page and wait 15 minutes
- [ ] Verify timeout alert appears
- [ ] Verify auto-redirect to expired page
- [ ] Check that polling stops

### Background Jobs

#### Test Expired Links Job
```bash
# Manual trigger (use production domain)
curl -X POST https://your-domain.vercel.app/api/jobs/expired-links \
  -H "x-cron-secret: your-production-secret"

# Expected response
{
  "success": true,
  "execution": {
    "jobName": "expired-links",
    "duration": 450,
    "result": {
      "processedCount": 0,
      "expiredCount": 0,
      "errorCount": 0
    }
  }
}
```

- [ ] Manual trigger successful
- [ ] Response includes execution details
- [ ] Check Vercel logs for job execution
- [ ] Verify cron runs automatically after 5 minutes

#### Test Stuck Payments Checker
```bash
# Manual trigger
curl -X POST https://your-domain.vercel.app/api/jobs/stuck-payments \
  -H "x-cron-secret: your-production-secret"
```

- [ ] Manual trigger successful
- [ ] Response includes stuck payment count
- [ ] Check Vercel logs for warnings
- [ ] Verify cron runs automatically after 15 minutes

### Database Verification
- [ ] Create payment link with past expiry date
- [ ] Trigger expired links job
- [ ] Verify status changed to EXPIRED in database
- [ ] Verify EXPIRED event created
- [ ] Verify audit log entry created

### Error Handling
- [ ] Test polling with invalid payment link ID
- [ ] Verify error message displayed
- [ ] Test retry button works
- [ ] Test rate limit (make 300+ requests)
- [ ] Verify 429 response on rate limit

### API Endpoints
- [ ] `GET /api/payment-links/[id]/status` - Returns status
- [ ] `POST /api/jobs/expired-links` - Executes job
- [ ] `GET /api/jobs/expired-links` - Returns job status
- [ ] `POST /api/jobs/stuck-payments` - Executes job
- [ ] `GET /api/jobs/stuck-payments` - Returns job status

### UI/UX
- [ ] Status monitor displays correctly
- [ ] Animations smooth on desktop
- [ ] Animations smooth on mobile
- [ ] Monitor responsive on small screens
- [ ] Transaction details display correctly
- [ ] Auto-redirect works for PAID status
- [ ] Auto-redirect works for EXPIRED status
- [ ] Auto-redirect works for CANCELED status

## Monitoring Setup

### Vercel Logs
- [ ] Enable log drains (if available)
- [ ] Configure log retention
- [ ] Set up log alerts for errors

### Cron Job Monitoring
- [ ] Check Vercel cron logs regularly
- [ ] Monitor job success rate
- [ ] Set up alerts for job failures

### Application Monitoring
- [ ] Monitor polling API response times
- [ ] Track rate limit hits
- [ ] Monitor job execution duration
- [ ] Track database query performance

## Performance Verification

### Polling Performance
- [ ] Response time < 200ms
- [ ] No memory leaks with long polling
- [ ] CPU usage reasonable
- [ ] Network requests optimized

### Background Job Performance
- [ ] Expired links job < 5 seconds
- [ ] Stuck payments checker < 3 seconds
- [ ] No database bottlenecks
- [ ] Efficient query execution

### Rate Limiting
- [ ] Polling limit (300/15min) enforced
- [ ] API limit (100/15min) enforced
- [ ] Public limit (30/1min) enforced
- [ ] Headers include rate limit info

## Security Verification

### Cron Security
- [ ] `CRON_SECRET` required for job endpoints
- [ ] Jobs return 401 without secret
- [ ] Secret not exposed in logs
- [ ] Secret not in client code

### API Security
- [ ] Rate limiting active
- [ ] No sensitive data in responses
- [ ] Proper error messages (no stack traces)
- [ ] CORS configured correctly

### Data Privacy
- [ ] No PII in logs
- [ ] Transaction IDs truncated in UI
- [ ] Audit logs secure
- [ ] Database queries parameterized

## Documentation Verification

### Code Documentation
- [ ] All functions have JSDoc comments
- [ ] Type definitions complete
- [ ] Usage examples provided
- [ ] Error cases documented

### User Documentation
- [ ] Quick reference guide complete
- [ ] Configuration steps clear
- [ ] Troubleshooting guide helpful
- [ ] Examples work as written

## Rollback Plan

### If Issues Occur
1. Identify the issue
2. Check Vercel logs
3. Disable cron jobs if needed
4. Revert to previous deployment
5. Fix issue locally
6. Re-deploy

### Quick Rollback
```bash
# Revert to previous deployment
vercel rollback

# Or use specific deployment
vercel rollback [deployment-url]
```

## Known Limitations

- [ ] Job history in-memory (lost on restart)
- [ ] No job replay for failures
- [ ] No alerting for job failures
- [ ] Fixed 15-minute timeout

## Future Improvements

- [ ] Persistent job history in database
- [ ] Automated alerting for failures
- [ ] Job replay capability
- [ ] Configurable timeout per merchant
- [ ] WebSocket support for real-time updates
- [ ] Admin dashboard for job monitoring

## Sign-Off

### Development
- [x] All features implemented
- [x] Local testing complete
- [x] Code reviewed
- [x] Documentation complete

### Deployment
- [ ] Environment variables configured
- [ ] Deployed to production
- [ ] Cron jobs verified
- [ ] Post-deployment tests passed

### Monitoring
- [ ] Logs configured
- [ ] Alerts set up
- [ ] Performance verified
- [ ] Security verified

## Final Checklist

- [x] Sprint 9 code complete
- [x] Documentation written
- [ ] Environment variables set
- [ ] Deployed to production
- [ ] Cron jobs running
- [ ] Monitoring active
- [ ] Team notified

## Support Contacts

### For Issues
- Check `SPRINT9_COMPLETE.md` for troubleshooting
- Review `SPRINT9_QUICK_REFERENCE.md` for usage
- Check Vercel logs for errors
- Review database for data issues

### Emergency Rollback
```bash
# Disable cron jobs temporarily
# Comment out crons in vercel.json and redeploy

# Or use Vercel dashboard to disable crons
```

---

**Sprint 9 Deployment Checklist**  
**Created:** December 14, 2025  
**Status:** Ready for deployment







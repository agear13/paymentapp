# Sprint 11 Deployment Checklist

Complete checklist for deploying the Xero authentication integration.

## Pre-Deployment Setup

### 1. Xero Developer Account Setup

- [ ] **Create Xero Developer Account**
  - Go to https://developer.xero.com/
  - Sign up or log in with Xero credentials

- [ ] **Create Application**
  - Click "My Apps" → "New app"
  - Choose "Web App" type
  - Fill in application details:
    - App name: Provvypay
    - Company URL: Your website
    - OAuth 2.0 redirect URI: `http://localhost:3000/api/xero/callback` (dev)

- [ ] **Copy Credentials**
  - Copy Client ID
  - Generate and copy Client Secret
  - **IMPORTANT**: Save these securely - you won't see the secret again!

### 2. Generate Encryption Key

- [ ] **Generate Key**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

- [ ] **Save Securely**
  - Store in password manager
  - Never commit to version control
  - Generate separate keys for dev/staging/prod

### 3. Configure Environment Variables

- [ ] **Create/Update `.env.local`**
  ```bash
  # Xero OAuth Credentials
  XERO_CLIENT_ID=your-client-id-here
  XERO_CLIENT_SECRET=your-client-secret-here
  XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback
  
  # Encryption Key
  XERO_ENCRYPTION_KEY=your-generated-key-here
  
  # Application URL
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

- [ ] **Verify All Variables Set**
  ```bash
  npx tsx -e "
  const required = ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_REDIRECT_URI', 'XERO_ENCRYPTION_KEY', 'NEXT_PUBLIC_APP_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) { console.error('Missing:', missing); process.exit(1); }
  console.log('✅ All variables set!');
  "
  ```

## Local Testing

### 4. Code Verification

- [x] **Linting Passes**
  ```bash
  npm run lint
  ```
  ✅ Completed - No errors

- [x] **TypeScript Compiles**
  ```bash
  npx tsc --noEmit
  ```
  ✅ Completed - No errors

- [ ] **Development Server Starts**
  ```bash
  npm run dev
  ```

### 5. Manual Testing

- [ ] **Navigate to Integrations**
  - Go to http://localhost:3000/dashboard/settings/integrations
  - Verify Xero card displays

- [ ] **Test Connection Flow**
  - Click "Connect to Xero"
  - Verify redirect to Xero
  - Authorize the connection
  - Verify redirect back to app
  - Check for success message
  - Verify "Connected" badge appears

- [ ] **Test Tenant Selection**
  - If multiple Xero orgs, test tenant dropdown
  - Select different organization
  - Verify success message
  - Refresh page
  - Verify selection persists

- [ ] **Test Status Display**
  - Check connection date displays
  - Check expiry date displays
  - Verify tenant name shows

- [ ] **Test Disconnection**
  - Click "Disconnect"
  - Confirm in dialog
  - Verify "Not Connected" status
  - Check database record deleted

- [ ] **Test Reconnection**
  - Click "Connect to Xero" again
  - Verify can reconnect successfully

### 6. Database Verification

- [ ] **Check Connection Record**
  ```bash
  npm run db:studio
  ```
  - Open `xero_connections` table
  - Verify record exists after connection
  - Verify tokens are encrypted (long base64 strings)
  - Verify tenant_id is set
  - Verify expires_at is in future

### 7. Error Scenario Testing

- [ ] **Test Cancel Authorization**
  - Start connection flow
  - Cancel on Xero page
  - Verify error message displays
  - Verify graceful handling

- [ ] **Test Invalid Organization**
  - Try accessing API with invalid org ID
  - Verify 400 error returned

- [ ] **Test Network Failure**
  - Disconnect network during token refresh
  - Verify graceful error handling

## Production Deployment

### 8. Production Xero App Setup

- [ ] **Create Production App**
  - Create separate Xero app for production
  - Use production redirect URI
  - Copy production credentials

- [ ] **Configure Production Redirect**
  - Set to: `https://yourdomain.com/api/xero/callback`
  - Verify HTTPS is used
  - Verify domain is correct

### 9. Production Environment Variables

- [ ] **Set in Hosting Platform**
  (Vercel, Netlify, AWS, etc.)
  
  ```bash
  XERO_CLIENT_ID=production-client-id
  XERO_CLIENT_SECRET=production-client-secret
  XERO_REDIRECT_URI=https://yourdomain.com/api/xero/callback
  XERO_ENCRYPTION_KEY=production-encryption-key  # Different from dev!
  NEXT_PUBLIC_APP_URL=https://yourdomain.com
  ```

- [ ] **Verify Variables Set**
  - Check hosting platform dashboard
  - Verify all 5 variables present
  - Verify no typos in variable names

### 10. Production Testing

- [ ] **Test OAuth Flow**
  - Connect to Xero in production
  - Verify SSL certificate valid
  - Verify redirect works
  - Check success message

- [ ] **Test Token Refresh**
  - Wait 55+ minutes or manually adjust expires_at
  - Make API call
  - Verify token auto-refreshes
  - Check database for new expiry time

- [ ] **Test Error Handling**
  - Try various error scenarios
  - Verify user-friendly error messages
  - Check logs for proper error tracking

## Security Verification

### 11. Security Checklist

- [ ] **Credentials Protected**
  - ✅ No secrets in code
  - ✅ Environment variables only
  - ✅ Different keys per environment
  - [ ] Secrets stored in secure vault

- [ ] **Token Security**
  - ✅ Tokens encrypted at rest
  - ✅ AES-256-GCM encryption
  - ✅ No tokens in logs
  - ✅ Auto-refresh enabled
  - [ ] Monitoring for refresh failures

- [ ] **Network Security**
  - [ ] HTTPS enforced in production
  - [ ] SSL certificates valid
  - [ ] Redirect URIs use HTTPS
  - [ ] CORS configured properly

- [ ] **OAuth Security**
  - ✅ State parameter used
  - ✅ CSRF protection
  - ✅ Proper scopes
  - [ ] Rate limiting enabled

## Monitoring & Alerts

### 12. Set Up Monitoring

- [ ] **Error Tracking**
  - Verify Sentry captures Xero errors
  - Test error reporting
  - Set up alerts for critical errors

- [ ] **Token Refresh Monitoring**
  - Add logging for token refreshes
  - Set up alerts for refresh failures
  - Monitor refresh success rate

- [ ] **Connection Health**
  - Track connection/disconnection events
  - Monitor active connections
  - Alert on unusual patterns

## Documentation

### 13. User Documentation

- [ ] **Create User Guide**
  - How to connect Xero
  - Troubleshooting common issues
  - FAQ section

- [ ] **Video Tutorial** (optional)
  - Screen recording of connection flow
  - Publish to help center

### 14. Support Team Training

- [ ] **Train Support Staff**
  - Connection troubleshooting
  - Common error messages
  - When to escalate

- [ ] **Create Runbook**
  - Connection issues
  - Token refresh failures
  - Database issues

## Post-Deployment

### 15. Initial Monitoring

- [ ] **Monitor First Connections**
  - Watch first 10 user connections
  - Check for errors
  - Verify token refresh works

- [ ] **Check Logs**
  - Review application logs
  - Look for Xero-related errors
  - Verify no sensitive data logged

- [ ] **Database Health**
  - Check connection records
  - Verify encryption working
  - Monitor database performance

### 16. Performance Baseline

- [ ] **Measure Performance**
  - OAuth flow completion time
  - API response times
  - Token refresh duration

- [ ] **Set Alerts**
  - Alert on slow responses
  - Alert on high error rates
  - Alert on connection failures

## Rollback Plan

### In Case of Issues

- [ ] **Prepare Rollback**
  - Document rollback steps
  - Keep previous deployment ready
  - Test rollback procedure

- [ ] **Emergency Contacts**
  - Xero support contact info
  - Internal escalation path
  - On-call schedule

## Success Metrics

### Track These Metrics

- [ ] **Connection Success Rate**
  - Target: >95%
  - Alert if <90%

- [ ] **Token Refresh Success Rate**
  - Target: >99%
  - Alert if <95%

- [ ] **Average Connection Time**
  - Target: <30 seconds
  - Alert if >60 seconds

- [ ] **User Satisfaction**
  - Track support tickets
  - Monitor user feedback
  - Survey users after connection

## Sign-Off

### Before Going Live

- [ ] **Technical Lead Approval**
  - Code reviewed
  - Tests passed
  - Security verified

- [ ] **Product Owner Approval**
  - Meets requirements
  - User experience validated
  - Documentation complete

- [ ] **Security Team Approval**
  - Security audit passed
  - Encryption verified
  - Compliance confirmed

## Quick Reference

### Environment Variables
```bash
XERO_CLIENT_ID          # From Xero Developer Portal
XERO_CLIENT_SECRET      # From Xero Developer Portal
XERO_REDIRECT_URI       # Must match Xero app config
XERO_ENCRYPTION_KEY     # Generated with crypto.randomBytes(32)
NEXT_PUBLIC_APP_URL     # Your application URL
```

### Key Files
- `src/lib/xero/` - Core services
- `src/app/api/xero/` - API endpoints
- `src/components/dashboard/settings/xero-connection.tsx` - UI component

### Documentation
- `SPRINT11_COMPLETE.md` - Technical details
- `XERO_SETUP_GUIDE.md` - Setup instructions
- `XERO_QUICK_REFERENCE.md` - Developer reference
- `SPRINT11_SUMMARY.md` - Sprint summary

### Support Resources
- Xero Developer Portal: https://developer.xero.com/
- Xero API Docs: https://developer.xero.com/documentation/
- Xero API Status: https://status.developer.xero.com/

---

## Final Checklist

Before marking deployment complete:

- [ ] All pre-deployment setup complete
- [ ] Local testing passed
- [ ] Production configuration done
- [ ] Security verified
- [ ] Monitoring set up
- [ ] Documentation complete
- [ ] Team trained
- [ ] Sign-offs obtained

**Status**: Ready for deployment after environment configuration  
**Blockers**: None  
**Next Step**: Configure Xero developer account and set environment variables

---

**Deployment Guide Version**: 1.0  
**Last Updated**: December 14, 2025  
**Prepared by**: AI Assistant  
**Sprint**: 11 - Xero Authentication







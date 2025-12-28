# Sprint 2 Testing Guide

## Quick Start

### 1. Start the Development Server

```bash
cd src
npm run dev
```

The app will be available at `http://localhost:3000`

### 2. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed the database
npm run db:seed
```

## Manual Testing Checklist

### Authentication Flow

1. **Access Protected Route**
   - Navigate to `http://localhost:3000/dashboard`
   - Should redirect to `/auth/login` (if not authenticated)

2. **Login** (TODO: Implement Supabase auth)
   - For now, authentication checks will fail
   - Need to implement Supabase auth flow first

### Onboarding Flow

1. **Navigate to Onboarding**
   - Go to `http://localhost:3000/onboarding`
   - Should see "Welcome to Provvypay" page

2. **Fill Out Form**
   - Organization Name: "Test Corp"
   - Display Name: "Test Corporation"
   - Default Currency: "USD"
   - Click "Complete Setup"

3. **Verify Success**
   - Should see success toast
   - Should redirect to `/dashboard`
   - Check database for new organization and merchant settings

### Dashboard Navigation

1. **Sidebar Navigation**
   - Click each main nav item:
     - Dashboard
     - Payment Links
     - Ledger
     - Transactions
   - Verify active state highlighting
   - Verify page content loads

2. **Settings Navigation**
   - Expand Settings menu
   - Click each settings item:
     - Organization
     - Merchant
     - Team
     - Integrations
   - Verify active state highlighting
   - Verify page content loads

3. **Mobile Navigation**
   - Resize browser to mobile width
   - Click hamburger menu
   - Verify sidebar opens/closes
   - Test navigation on mobile

4. **Breadcrumb Navigation**
   - Navigate to `/dashboard/settings/merchant`
   - Verify breadcrumbs show: Dashboard > Settings > Merchant
   - Click breadcrumb links
   - Verify navigation works

### Organization Management

1. **View Organization Settings**
   - Navigate to `/dashboard/settings/organization`
   - Verify page loads
   - Verify form displays

2. **Update Organization Name**
   - Change organization name to "Updated Corp"
   - Click "Save Changes"
   - Verify loading state
   - Verify success toast
   - Verify name updates

3. **Organization Switcher**
   - Click organization switcher in header
   - Verify dropdown opens
   - Verify organizations list (mock data for now)
   - Click different organization
   - Verify selection updates

### Merchant Settings

1. **View Merchant Settings**
   - Navigate to `/dashboard/settings/merchant`
   - Verify page loads
   - Verify form displays

2. **Update Display Name**
   - Change display name to "Updated Business"
   - Click "Save Changes"
   - Verify success toast

3. **Update Currency**
   - Change currency to "EUR"
   - Click "Save Changes"
   - Verify success toast

4. **Add Stripe Account ID**
   - Enter: "acct_1234567890"
   - Click "Save Changes"
   - Verify success toast

5. **Test Stripe Validation**
   - Enter invalid ID: "invalid"
   - Verify error message: "Stripe account ID must start with 'acct_'"

6. **Add Hedera Account ID**
   - Enter: "0.0.12345"
   - Click "Save Changes"
   - Verify success toast

7. **Test Hedera Validation**
   - Enter invalid ID: "invalid"
   - Verify error message: "Hedera account ID must be in format 0.0.xxxxx"

### Form Validation

1. **Test Required Fields**
   - Leave organization name empty
   - Try to submit
   - Verify error message

2. **Test Field Length**
   - Enter single character in organization name
   - Verify error: "Organization name must be at least 2 characters"

3. **Test Real-time Validation**
   - Start typing in a field
   - Verify validation runs on blur
   - Verify error messages appear/disappear

### API Testing

#### Organizations API

1. **List Organizations**
```bash
curl http://localhost:3000/api/organizations
```

2. **Create Organization**
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Corp",
    "clerkOrgId": "org_test123"
  }'
```

3. **Get Organization**
```bash
curl http://localhost:3000/api/organizations/{id}
```

4. **Update Organization**
```bash
curl -X PATCH http://localhost:3000/api/organizations/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Corp"
  }'
```

5. **Delete Organization**
```bash
curl -X DELETE http://localhost:3000/api/organizations/{id}
```

#### Merchant Settings API

1. **List Settings**
```bash
curl "http://localhost:3000/api/merchant-settings?organizationId={orgId}"
```

2. **Create Settings**
```bash
curl -X POST http://localhost:3000/api/merchant-settings \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "{orgId}",
    "displayName": "Test Business",
    "defaultCurrency": "USD",
    "stripeAccountId": "acct_1234567890",
    "hederaAccountId": "0.0.12345"
  }'
```

3. **Get Settings**
```bash
curl http://localhost:3000/api/merchant-settings/{id}
```

4. **Update Settings**
```bash
curl -X PATCH http://localhost:3000/api/merchant-settings/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Updated Business",
    "defaultCurrency": "EUR"
  }'
```

5. **Delete Settings**
```bash
curl -X DELETE http://localhost:3000/api/merchant-settings/{id}
```

### Responsive Design Testing

1. **Desktop (1920x1080)**
   - Verify sidebar is expanded by default
   - Verify all content is visible
   - Verify no horizontal scroll

2. **Tablet (768x1024)**
   - Verify sidebar collapses to icons
   - Verify content adapts
   - Verify touch targets are adequate

3. **Mobile (375x667)**
   - Verify sidebar is hidden
   - Verify hamburger menu appears
   - Verify mobile navigation works
   - Verify forms are usable

### Browser Testing

Test in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Accessibility Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify focus indicators
   - Verify keyboard shortcuts work

2. **Screen Reader**
   - Test with screen reader (NVDA, JAWS, VoiceOver)
   - Verify labels are read correctly
   - Verify error messages are announced

3. **Color Contrast**
   - Verify text is readable
   - Verify color contrast meets WCAG AA

## Database Verification

### Check Organizations

```sql
SELECT * FROM organizations;
```

### Check Merchant Settings

```sql
SELECT * FROM merchant_settings;
```

### Check Relationships

```sql
SELECT 
  o.name as organization_name,
  ms.display_name,
  ms.default_currency,
  ms.stripe_account_id,
  ms.hedera_account_id
FROM organizations o
LEFT JOIN merchant_settings ms ON ms.organization_id = o.id;
```

## Performance Testing

1. **Page Load Times**
   - Dashboard: < 1s
   - Settings pages: < 1s
   - Form submissions: < 2s

2. **API Response Times**
   - GET requests: < 200ms
   - POST/PATCH requests: < 500ms
   - DELETE requests: < 300ms

## Error Scenarios

### Test Error Handling

1. **Network Error**
   - Disconnect network
   - Try to submit form
   - Verify error message

2. **Invalid Data**
   - Submit invalid Stripe ID
   - Verify validation error
   - Verify form doesn't submit

3. **Duplicate Organization**
   - Try to create org with existing clerkOrgId
   - Verify 409 error
   - Verify error message

4. **Not Found**
   - Request non-existent organization
   - Verify 404 error
   - Verify error message

## Known Issues

### Current Limitations

1. **Authentication**
   - Supabase auth not fully integrated
   - Mock user data in some places
   - Need to implement proper session management

2. **Organization Switcher**
   - Uses mock data
   - Need to fetch real organizations from API
   - Need to implement organization switching

3. **Permissions**
   - Permission checks marked as TODO
   - Need to implement role-based access control
   - Need to check organization membership

4. **Team Management**
   - UI only, no backend
   - Need to implement team member API
   - Need to implement invite flow

## Next Steps

1. Implement Supabase authentication
2. Connect organization switcher to API
3. Add permission checks
4. Implement team member management
5. Add unit tests
6. Add integration tests
7. Add E2E tests

## Test Results Template

```
Date: _______________
Tester: _______________

[ ] Onboarding flow works
[ ] Dashboard navigation works
[ ] Organization settings work
[ ] Merchant settings work
[ ] Form validation works
[ ] API endpoints work
[ ] Responsive design works
[ ] Browser compatibility verified
[ ] Accessibility verified
[ ] Performance acceptable

Issues Found:
1. _______________________________
2. _______________________________
3. _______________________________

Notes:
_____________________________________
_____________________________________
_____________________________________
```

---

**Testing Status:** Ready for manual testing  
**Automated Tests:** TODO (Sprint 4+)  
**Coverage Goal:** 80%+














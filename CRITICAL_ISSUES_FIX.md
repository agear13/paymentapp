# Critical Issues Fix Plan

## Issues Identified

### 1. ❌ Dashboard Page - Hardcoded Data
**File:** `src/app/(dashboard)/dashboard/page.tsx`
**Problem:** Shows hardcoded "$0.00", "0", and "0%" for all metrics
**Status:** Needs database queries to show real data

### 2. ❌ Dashboard Quick Action Buttons - No Handlers
**File:** `src/app/(dashboard)/dashboard/page.tsx` (lines 77-89)
**Problem:** Buttons are just divs with no onClick handlers  
**Status:** Need to add navigation functionality

### 3. ❌ Reports Page - Requires Organization Setup
**File:** `src/app/(dashboard)/dashboard/reports/page.tsx`
**Problem:** Redirects to `/onboarding` if no `organizationId` query param
**Status:** Need to auto-fetch organization or create context

### 4. ❌ Onboarding "Skip for now" Button
**File:** `src/components/onboarding/onboarding-form.tsx` (line 171-173)
**Problem:** Button exists but disabled and has no onClick handler
**Status:** Need to add skip functionality

### 5. ❌ Notifications Page - Missing Organization ID
**File:** `src/components/dashboard/notifications/preferences-client.tsx`
**Problem:** API requires `organizationId` query param which isn't being passed
**Status:** Need to pass organizationId to API calls

### 6. ✅ Integrations Page - Xero Connection
**File:** `src/app/(dashboard)/dashboard/settings/integrations/page.tsx`
**Problem:** User said Xero connection doesn't show, but it DOES (line 86-103)
**Status:** This is actually working - Xero connection IS displayed

### 7. ❓ Merchant Settings - Not Saving
**File:** `src/components/dashboard/settings/merchant-settings-form.tsx`
**Problem:** Need to check the form component implementation
**Status:** Need to investigate form submission

### 8. ❌ Sidebar Menu Visibility
**Problem:** Sidebar menus are not very visible when opened
**Status:** Need to check CSS/styling

## Root Cause Analysis

Most issues stem from a common pattern:
- **Missing Organization Context**: Many pages/components expect an `organizationId` but there's no global context providing it
- **No Organization Fetching Logic**: Pages redirect to onboarding instead of fetching the first/default organization
- **Stub Implementations**: Several pages show placeholder/hardcoded data instead of querying the database

## Solution Strategy

### Phase 1: Organization Context (Critical)
1. Create a global organization context or auto-fetch logic
2. Update all pages to use this context
3. Stop redirecting to onboarding when organization exists

### Phase 2: Dashboard Data (High Priority)
1. Add database queries for Total Revenue
2. Add query for Active Links count
3. Add query for Completed Payments
4. Calculate Success Rate
5. Add Recent Activity feed
6. Make Quick Action buttons functional

### Phase 3: Page Fixes (Medium Priority)
1. Fix Notifications page to pass organizationId
2. Fix Reports page to use organization context
3. Add Skip functionality to onboarding
4. Fix sidebar visibility

### Phase 4: Form Fixes (Lower Priority)
1. Investigate and fix Merchant Settings form
2. Verify all forms are saving correctly

## Implementation Priority

1. **CRITICAL** - Organization Auto-Fetch
2. **HIGH** - Dashboard Real Data
3. **HIGH** - Dashboard Quick Actions
4. **MEDIUM** - Skip Onboarding Button
5. **MEDIUM** - Notifications Page Organization ID
6. **MEDIUM** - Reports Page Organization ID
7. **LOW** - Sidebar Visibility
8. **LOW** - Merchant Settings Investigation


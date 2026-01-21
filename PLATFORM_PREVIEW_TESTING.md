# Platform Preview Module - Testing Guide

## Quick Start Testing

### Prerequisites
- Ensure the development server is running
- You must be logged in to access dashboard routes
- Navigate to any dashboard page to access the sidebar

### Testing Checklist

#### 1. Sidebar Navigation
- [ ] "Platform Preview" section appears in sidebar
- [ ] Section can be expanded/collapsed
- [ ] Contains 4 menu items:
  - [ ] Overview
  - [ ] Connections
  - [ ] Inventory
  - [ ] Unified Ledger
- [ ] Active page is highlighted correctly
- [ ] Navigation works on all screen sizes

#### 2. Overview Page (`/dashboard/platform-preview/overview`)
- [ ] Page loads without errors
- [ ] "Preview" badge visible in header
- [ ] All 6 KPI cards display:
  - [ ] Gross Sales: $487,250.00
  - [ ] Net Receipts: $462,180.50
  - [ ] Pending Settlements: $18,450.00
  - [ ] Fees Paid: $6,619.50
  - [ ] Inventory Risk: 7
  - [ ] Open Orders: 34
- [ ] Sales trend chart renders (30-day area chart)
- [ ] Channel breakdown pie chart renders (4 channels)
- [ ] "What Needs Attention" panel shows 4 items:
  - [ ] Low Stock Alert (warning)
  - [ ] Inventory Drift (error)
  - [ ] Payout Delays (warning)
  - [ ] Fee Anomaly (info)
- [ ] CTA cards at bottom:
  - [ ] "Payment Links" button links to `/dashboard/payment-links`
  - [ ] "Partners Dashboard" button links to `/dashboard/partners/dashboard`

**Expected Visuals**:
- Clean grid layout
- Blue/primary color scheme
- Attention items with colored icons
- Charts with tooltips on hover

#### 3. Connections Page (`/dashboard/platform-preview/connections`)
- [ ] Page loads without errors
- [ ] "Preview" badge visible
- [ ] 6 connection cards display:
  - [ ] POS (In-store) - Connected (green)
  - [ ] Grab - Connected (green)
  - [ ] Stripe / Online - Connected (green)
  - [ ] Xero - Needs Attention (yellow)
  - [ ] Partners / Revenue Share - Connected (green)
  - [ ] Shopify - Coming Soon (blue)
- [ ] Each card shows:
  - [ ] Status badge with icon
  - [ ] Last sync time (relative)
  - [ ] Data feed chips
  - [ ] Toggle switch (disabled)
  - [ ] "Manage" button
- [ ] Click "Manage" button opens dialog
- [ ] Dialog shows:
  - [ ] Connection status
  - [ ] Data feeds list
  - [ ] Mapping status
  - [ ] Health metrics
  - [ ] What you get section
  - [ ] Disabled action buttons
- [ ] Hover over toggle shows "Coming soon" tooltip
- [ ] Info banner at bottom explains preview

**Test Interactions**:
- Click each "Manage" button
- Hover over disabled toggles
- Check responsive layout (resize browser)

#### 4. Inventory Page (`/dashboard/platform-preview/inventory`)
- [ ] Page loads without errors
- [ ] "Preview" badge visible
- [ ] Blue mapping info banner at top
- [ ] Click "Map Items (Preview)" opens dialog
- [ ] Inventory table shows 8 SKUs:
  - [ ] Milk 2L (Low - red, 1.3 days)
  - [ ] White Bread (OK, 4.3 days)
  - [ ] Eggs (OK, 3.7 days)
  - [ ] Coffee Beans (Drift - orange)
  - [ ] Rice 5kg (OK, 12.7 days)
  - [ ] Cooking Oil (OK, 4.2 days)
  - [ ] Sugar 1kg (Low - red, 2.4 days)
  - [ ] Pasta (OK, 7.7 days)
- [ ] Days of cover color-coded:
  - [ ] Red for < 3 days
  - [ ] Yellow for < 5 days
  - [ ] Normal for 5+ days
- [ ] Click any row opens side drawer
- [ ] Drawer shows:
  - [ ] 4 quick stat cards
  - [ ] Reorder suggestion
  - [ ] Inventory timeline (if available)
- [ ] Timeline events show:
  - [ ] Icons for event types
  - [ ] Positive/negative qty deltas
  - [ ] Color coding (green/red)
  - [ ] Timestamps and notes

**Test Interactions**:
- Click "Map Items" button
- Click different SKU rows
- Check timeline for "Milk 2L"
- Check timeline for "Coffee Beans 250g"
- Check timeline for "Sugar 1kg"

#### 5. Unified Ledger Page (`/dashboard/platform-preview/ledger`)
- [ ] Page loads without errors
- [ ] "Preview" badge visible
- [ ] Blue info banner explaining unified event stream
- [ ] Ledger table shows 10+ entries:
  - [ ] Payment Received (green badges)
  - [ ] Payout Settled (blue badges)
  - [ ] Refund (yellow badges)
  - [ ] Fee (red badges)
  - [ ] Inventory Adjustment (purple badges)
- [ ] Each row shows:
  - [ ] Timestamp (formatted)
  - [ ] Event type badge (colored)
  - [ ] Source system badge (colored)
  - [ ] Reference ID (monospaced)
  - [ ] Amount (green/red, formatted with $)
  - [ ] Related entity
- [ ] Click any row opens detail dialog
- [ ] Dialog shows:
  - [ ] Event icon and title
  - [ ] Full timestamp
  - [ ] Event type and source badges
  - [ ] Reference ID and currency
  - [ ] Large amount display (if applicable)
  - [ ] Related entity info
  - [ ] Event context explanation
  - [ ] Disabled "Related Links" buttons

**Test Interactions**:
- Click different event types
- Check amount formatting (positive/negative)
- Verify monospaced reference IDs
- Read event context descriptions

### Visual Regression Testing

#### Colors & Badges
- [ ] Primary color consistent with app
- [ ] Status badges use correct colors:
  - Connected/OK = green
  - Warning/Low = yellow
  - Error/Drift = orange/red
  - Info/Coming Soon = blue
- [ ] Amount colors: positive = green, negative = red

#### Typography
- [ ] Headers use correct font weights
- [ ] Body text is readable
- [ ] Monospaced fonts for IDs/codes
- [ ] Consistent font sizes with existing pages

#### Layout & Spacing
- [ ] Consistent card padding
- [ ] Grid layouts responsive
- [ ] Tables not overflowing
- [ ] Buttons properly aligned
- [ ] Badges properly sized

#### Interactive States
- [ ] Hover states work
- [ ] Disabled elements visually distinct
- [ ] Tooltips appear on hover
- [ ] Dialogs/drawers animate smoothly
- [ ] Click targets adequate size

### Responsive Testing

#### Desktop (1920px)
- [ ] All grids show 3-6 columns
- [ ] Charts use full width
- [ ] Tables show all columns
- [ ] Sidebar fully expanded

#### Tablet (768px)
- [ ] Grids collapse to 2 columns
- [ ] Charts remain readable
- [ ] Tables scroll horizontally
- [ ] Sidebar can collapse

#### Mobile (375px)
- [ ] Cards stack vertically
- [ ] Charts scale down
- [ ] Tables scroll with fixed headers
- [ ] Sidebar overlay works
- [ ] Drawers use full screen

### Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, if on Mac)

### Performance Checks
- [ ] Pages load in < 2 seconds
- [ ] No console errors
- [ ] No console warnings
- [ ] Charts render smoothly
- [ ] Interactions feel snappy

### Accessibility Checks
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Color contrast adequate
- [ ] Alt text on icons (via aria-hidden or role)
- [ ] Screen reader friendly (test with reader if available)

## Common Issues & Solutions

### Issue: Charts not rendering
**Solution**: Check if recharts is installed: `npm install recharts`

### Issue: Icons not showing
**Solution**: Verify lucide-react is installed: `npm install lucide-react`

### Issue: 404 on navigation
**Solution**: Ensure all page.tsx files are in correct directories under `src/app/(dashboard)/dashboard/platform-preview/`

### Issue: Sidebar not showing Platform Preview
**Solution**: Clear browser cache and reload

### Issue: Linter errors
**Solution**: Run `npm run lint` and fix any TypeScript errors

### Issue: Styling broken
**Solution**: Ensure Tailwind CSS is properly configured and rebuild

## Testing Notes

### Mock Data Characteristics
- **Realistic**: All data mimics real-world scenarios
- **Consistent**: Related data points align across pages
- **Timestamp-aware**: Uses actual date/time calculations
- **Diverse**: Covers various states (OK, Warning, Error, etc.)

### What to Look For
1. **Visual Consistency**: Matches existing dashboard style
2. **Clear Messaging**: "Preview" badges visible everywhere
3. **Helpful Copy**: Tooltips and descriptions explain functionality
4. **Disabled State**: All non-functional features clearly disabled
5. **Professional Tone**: No flashy animations or unprofessional copy

### What NOT to Test
- Backend functionality (none exists)
- Data mutations (not implemented)
- Real-time updates (static data)
- Authentication beyond existing dashboard
- Export/download features (not implemented)

## Deployment Testing

### Pre-Deployment
- [ ] All linter checks pass
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] All pages accessible in production build

### Post-Deployment
- [ ] All routes return 200 status
- [ ] No JavaScript errors in console
- [ ] Assets load correctly
- [ ] Navigation works end-to-end

## Success Criteria

✅ All 4 pages load without errors
✅ Navigation works seamlessly
✅ All interactive elements respond
✅ Mock data displays correctly
✅ Visual design consistent
✅ Responsive on all screen sizes
✅ No accessibility blockers
✅ Professional and polished appearance
✅ "Preview" nature clearly communicated
✅ Fast loading times

## Reporting Issues

If you find any issues:

1. **Note the page**: Which route/page?
2. **Describe the issue**: What's wrong?
3. **Steps to reproduce**: How to trigger it?
4. **Expected behavior**: What should happen?
5. **Screenshots**: If visual issue
6. **Console errors**: Copy any error messages
7. **Browser/device**: What were you using?

---

**Ready for Testing**: ✅ Yes
**Estimated Test Time**: 30-45 minutes for full checklist
**Critical Paths**: Navigation, Overview page, Connections page
**Nice to Have**: Full responsive testing, accessibility audit


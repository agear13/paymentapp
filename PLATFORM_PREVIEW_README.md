# Platform Preview Module - Quick Reference

## 🎯 What Is This?

A **UI-only preview module** that demonstrates Provvypay's vision for a unified commerce intelligence platform. It shows how the platform connects:
- Payment processing (money IN)
- Partner payouts (money OUT)
- Multi-channel sales (POS, Grab, Online, Invoices)
- Inventory management
- Unified audit trail

**Status**: ✅ Complete and ready for demo
**Type**: UI-only (no backend, no APIs, mock data)
**Purpose**: Investor/merchant visualization and concept validation

---

## 🗂️ File Structure

```
src/
├── app/(dashboard)/dashboard/platform-preview/
│   ├── overview/page.tsx          # Main dashboard with KPIs & charts
│   ├── connections/page.tsx       # Integration management hub
│   ├── inventory/page.tsx         # SKU-level inventory tracking
│   └── ledger/page.tsx           # Unified event audit trail
├── components/dashboard/
│   └── app-sidebar.tsx           # Updated with Platform Preview section
└── lib/data/
    └── mock-platform-preview.ts  # All mock data (470 lines)
```

---

## 📍 Routes

| Route | Purpose | Key Features |
|-------|---------|--------------|
| `/dashboard/platform-preview/overview` | Unified dashboard | 6 KPIs, 2 charts, attention panel, CTAs |
| `/dashboard/platform-preview/connections` | Integration hub | 6 connection cards, manage dialogs, status tracking |
| `/dashboard/platform-preview/inventory` | Stock management | 8 SKUs, velocity tracking, timeline events |
| `/dashboard/platform-preview/ledger` | Audit trail | 10+ events, source tracking, detail dialogs |

---

## 🚀 Quick Start

### View the Module
1. Start dev server: `npm run dev`
2. Log in to dashboard
3. Look for "Platform Preview" in sidebar
4. Click "Overview" to start

### Demo the Module
Follow: `PLATFORM_PREVIEW_DEMO_SCRIPT.md` (8-10 minute walkthrough)

### Test the Module
Follow: `PLATFORM_PREVIEW_TESTING.md` (comprehensive checklist)

---

## 📊 Mock Data Summary

- **Overview Metrics**: Gross sales ($487K), fees ($6.6K), inventory risk (7), etc.
- **Channel Breakdown**: 4 channels (POS, Grab, Online, Invoices)
- **Connections**: 6 integrations (POS, Grab, Stripe, Xero, Partners, Shopify)
- **Inventory SKUs**: 8 items with velocity, days of cover, reorder suggestions
- **Timeline Events**: 3 SKUs with full event history
- **Ledger Rows**: 10+ events (payments, fees, payouts, adjustments)
- **Sales Chart**: 30 days of gross/net data

All data is **static**, **realistic**, and **internally consistent**.

---

## 🎨 UI Components Used

From `shadcn/ui`:
- Card, CardHeader, CardTitle, CardContent, CardDescription
- Badge (with variants)
- Button
- Table, TableHeader, TableBody, TableRow, TableCell
- Dialog, DialogTrigger, DialogContent, DialogHeader
- Sheet, SheetContent, SheetHeader (for inventory drawer)
- Switch (disabled in preview)
- Tooltip, TooltipProvider (for "coming soon" messages)

From `recharts`:
- AreaChart (sales trend)
- PieChart (channel breakdown)
- ChartContainer, ChartTooltip

From `lucide-react`:
- 20+ icons for various states and actions

---

## 💡 Key Design Decisions

### ✅ What We Did
- **Preview badges** on every page
- **Disabled controls** with tooltips explaining "coming soon"
- **Calm, professional tone** (no crypto jargon)
- **Accountant-friendly** copy and visuals
- **Consistent styling** with existing dashboard
- **Realistic mock data** with proper timestamps
- **Color-coded states** (status, amounts, severity)
- **Interactive details** (click rows for drawers/dialogs)

### ❌ What We Didn't Do
- No backend integration
- No API calls or webhooks
- No data fetching (useEffect patterns)
- No authentication beyond existing dashboard
- No functional toggles or configuration
- No simulation buttons (unlike Partners module)
- No tests (out of scope for preview)

---

## 🎯 User Journeys

### Investor View
1. **Overview**: "Wow, it's more than payment links"
2. **Connections**: "I see the platform integration strategy"
3. **Inventory**: "This solves a real operational problem"
4. **Ledger**: "Complete audit trail = compliance advantage"

### Merchant View
1. **Overview**: "All my channels in one place!"
2. **Connections**: "I can connect my POS and Grab easily"
3. **Inventory**: "Finally, accurate stock levels across channels"
4. **Ledger**: "My accountant will love this"

### Partner/Affiliate View
1. **Overview**: "I see how my payouts fit into the bigger platform"
2. **Connections**: "Partners module connects to everything"
3. **Ledger**: "Full transparency on revenue share allocations"

---

## 📈 What This Demonstrates

### Business Value
- ✅ **Unified view** across fragmented systems
- ✅ **Proactive alerts** (low stock, drift, delays)
- ✅ **Cost transparency** (fees across all channels)
- ✅ **Operational intelligence** (velocity, days of cover)
- ✅ **Audit compliance** (complete event trail)

### Technical Capability
- ✅ **Multi-system integration** architecture
- ✅ **Real-time data ingestion** (simulated)
- ✅ **Event-driven inventory** (economic events → stock levels)
- ✅ **Cross-system reconciliation** (unified ledger)
- ✅ **Scalable data model** (can add more connections)

### Platform Thinking
- ✅ Payment Links = **Money In** (already working)
- ✅ Partners = **Money Out** (already working)
- ✅ Platform Preview = **Plumbing Layer** (this module)
- ✅ Future: Add more channels, more intelligence, more automation

---

## 🔧 Maintenance & Updates

### To Add New Connection
1. Add to `connections` array in `mock-platform-preview.ts`
2. Specify: name, category, status, feeds, helper text
3. UI automatically renders the card

### To Add New SKU
1. Add to `inventorySkus` array
2. Optionally add timeline events to `skuTimelineEvents`
3. Table automatically shows new row

### To Add New Ledger Event
1. Add to `unifiedLedgerRows` array
2. Specify: timestamp, type, source, reference, amount
3. Table automatically shows new entry

### To Add New Page
1. Create `src/app/(dashboard)/dashboard/platform-preview/newpage/page.tsx`
2. Add route to `platformPreviewItems` in `app-sidebar.tsx`
3. Import any needed mock data

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `PLATFORM_PREVIEW_MODULE.md` | Complete implementation summary (technical) |
| `PLATFORM_PREVIEW_TESTING.md` | Comprehensive testing checklist (QA) |
| `PLATFORM_PREVIEW_DEMO_SCRIPT.md` | 8-10 minute demo walkthrough (sales) |
| `PLATFORM_PREVIEW_README.md` | Quick reference (this file) |

---

## 🚨 Important Notes

### For Developers
- **No backend**: Don't try to add API calls
- **Static data**: Keep it synchronous
- **Linter clean**: No errors, minimal warnings
- **Type safe**: All TypeScript interfaces defined
- **Responsive**: Test on mobile/tablet/desktop

### For Designers
- **Preview badges**: Must be visible on every page
- **Disabled states**: Use tooltips to explain
- **Color coding**: Consistent with existing dashboard
- **Icons**: Use lucide-react, not custom SVGs
- **Spacing**: Match existing Card/Table patterns

### For Product/Sales
- **Set expectations**: This is preview-only
- **Show vision**: One platform to rule them all
- **Connect dots**: Payment Links + Partners + Platform
- **Be honest**: "Coming soon" means not built yet
- **Gather feedback**: What resonates? What confuses?

---

## ✅ Success Metrics

### Implementation Complete
- ✅ All 4 routes created and rendering
- ✅ Sidebar navigation added
- ✅ Mock data file created (470 lines)
- ✅ No linter errors
- ✅ Responsive design
- ✅ Accessible (keyboard navigation, focus states)
- ✅ Documentation complete

### Demo Ready
- ✅ All pages load < 2 seconds
- ✅ No console errors
- ✅ Charts render smoothly
- ✅ Dialogs/drawers work
- ✅ Professional appearance
- ✅ Clear "preview" labeling

---

## 🎬 Next Steps

### Short Term (Demo/Testing)
1. Practice demo script (2-3 run-throughs)
2. Test on different browsers/devices
3. Get feedback from stakeholders
4. Iterate on copy/visuals if needed

### Medium Term (If Moving to Production)
1. Design real API contracts
2. Build backend integrations (POS, Grab, Stripe, Xero)
3. Implement event streaming architecture
4. Add configuration UI (mapping, schedules, rules)
5. Build reconciliation engine
6. Add real-time updates

### Long Term (Platform Vision)
1. Add more connection types
2. Build ML for inventory forecasting
3. Automate reordering
4. Add custom alerting rules
5. Build white-label capability
6. Open API for third-party developers

---

## 📞 Support

**Questions about the module?**
- Check: `PLATFORM_PREVIEW_MODULE.md` for technical details
- Check: `PLATFORM_PREVIEW_TESTING.md` for testing guidance
- Check: `PLATFORM_PREVIEW_DEMO_SCRIPT.md` for demo talking points

**Found a bug?**
1. Check if it's a known limitation (no backend = expected)
2. Verify linter errors: `npm run lint`
3. Check console for JavaScript errors
4. Document and report with screenshots

**Want to extend?**
- Mock data is in `src/lib/data/mock-platform-preview.ts`
- Pages are in `src/app/(dashboard)/dashboard/platform-preview/`
- Follow existing patterns for consistency

---

**Last Updated**: January 21, 2026
**Module Version**: 1.0.0 (Initial Release)
**Status**: ✅ Complete and Demo-Ready


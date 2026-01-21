# Platform Preview Module - Demo Script

## Demo Overview
**Duration**: 8-10 minutes
**Audience**: Investors, Partners, Enterprise Merchants
**Goal**: Show how Provvypay unifies payments, orders, inventory, and channels into one platform

---

## Demo Script

### Introduction (30 seconds)

> "Today I want to show you the Platform Preview module - a conceptual view of how Provvypay goes beyond simple payment links to become a unified commerce intelligence platform. This preview demonstrates the 'plumbing layer' that connects multiple sales channels, payment processors, inventory systems, and accounting software into a single source of truth."

**Show**: Dashboard home page, point to sidebar

---

### Part 1: Overview - Unified Commerce Intelligence (2 minutes)

**Navigate to**: `/dashboard/platform-preview/overview`

> "The Overview page gives you a bird's-eye view of your entire business across all channels."

#### Point out KPI Cards:
- **Gross Sales** ($487K): "This aggregates sales from POS, Grab, online orders, and invoices"
- **Net Receipts** ($462K): "After deducting all fees from different platforms"
- **Pending Settlements** ($18K): "Money that's in flight across different processors"
- **Fees Paid** ($6.6K): "Total fees across Grab marketplace, Stripe, and other channels"
- **Inventory Risk** (7 SKUs): "Items that need attention - low stock or drift"
- **Open Orders** (34): "Active orders across all channels"

#### Point out Charts:
- **Sales Trend**: "30-day view of gross vs net - helps you understand fee impact over time"
- **Channel Breakdown**: "See which channels drive the most revenue"
  - POS leads at 59%
  - Grab at 26%
  - Online at 14%
  - Invoices at 2%

#### Point out Attention Panel:
> "The system proactively surfaces what needs your attention:"
- "Milk 2L will run out in 1.3 days based on current velocity"
- "4 SKUs have inventory drift - suggesting a stocktake"
- "2 payouts delayed due to bank verification"
- "Grab fees unusually high this week - worth investigating"

#### Point out CTA Cards:
> "You can jump directly to money-in (Payment Links) or money-out (Partners & Payouts) from here."

---

### Part 2: Connections - Data Integration Hub (2-3 minutes)

**Navigate to**: `/dashboard/platform-preview/connections`

> "Connections shows how Provvypay ingests data from multiple systems to create that unified view."

#### Walk through Connection Cards:

1. **POS (In-store)** - Connected
   > "Point-of-sale system syncing in real-time. We ingest orders, payments, and inventory movements."
   - Click **Manage** button
   - Show: "Last synced 5 minutes ago, pulling Orders, Payments, and Inventory feeds"
   - Close dialog

2. **Grab** - Connected
   > "Marketplace integration capturing orders, fees, and settlement data."
   - Point out data feeds: Orders, Fees, Payouts

3. **Stripe / Online** - Connected
   > "Online payment processing with automatic fee reconciliation."

4. **Xero** - Needs Attention
   > "Accounting integration - this one shows a 'needs attention' status because sync hasn't run in 2 days."
   - Click **Manage**
   - Show: "Mapping status, health metrics, and what you get from the integration"

5. **Partners / Revenue Share** - Connected
   > "This connects to the Partners module you saw earlier - tracking revenue share payouts."

6. **Shopify** - Coming Soon
   > "E-commerce platform support is on the roadmap."

#### Highlight Toggle Switches:
> "In the live platform, you'll be able to enable/disable feeds with these toggles. For now, they're preview-only."
- Hover over toggle to show "Coming soon" tooltip

#### Point out Info Banner:
> "This preview shows the concept - toggle switches and configuration will be functional at launch."

---

### Part 3: Inventory - SKU-Level Intelligence (2-3 minutes)

**Navigate to**: `/dashboard/platform-preview/inventory`

> "Rather than just a static inventory count, Provvypay derives inventory intelligence from economic events across all your channels."

#### Point out Mapping Banner:
> "The more systems you connect and map, the more accurate your inventory becomes."
- Click **Map Items (Preview)**
- Explain: "Provvypay matches items across POS, marketplaces, and accounting using SKU codes, names, and barcodes."
- Close dialog

#### Walk through Inventory Table:

1. **Milk 2L** (Low, 1.3 days cover)
   > "This is flagged as low stock. Based on velocity of 36.5 units/day, you have 1.3 days before stockout."
   - Click row to open detail drawer
   - Show timeline: "Here's the economic history - deliveries, POS sales, Grab orders, waste."
   - Point out: "100 units delivered yesterday, but we're burning through them fast."
   - Close drawer

2. **Coffee Beans 250g** (Drift detected)
   > "This one has drift - meaning the system detected a discrepancy. A stocktake correction happened 8 hours ago."
   - Click row
   - Show: "The timeline shows a -8 adjustment during stocktake."

3. **Sugar 1kg** (Low, 2.4 days cover)
   > "Another low-stock item with reorder suggestion."

4. **Rice 5kg** (OK, 12.7 days cover)
   > "This one is healthy - plenty of cover."

#### Highlight Key Concepts:
- **Velocity-based**: Not just counts, but burn rate
- **Days of Cover**: When will you run out?
- **Multi-channel**: Aggregates sales from all sources
- **Drift Detection**: Catches discrepancies early

---

### Part 4: Unified Ledger - Complete Audit Trail (2 minutes)

**Navigate to**: `/dashboard/platform-preview/ledger`

> "The Unified Ledger creates a single chronological audit trail of every economic event across all your systems."

#### Point out Info Banner:
> "This is powerful for accounting reconciliation and compliance - every payment, fee, payout, refund, and inventory adjustment in one place."

#### Walk through Event Types:

1. **Payment Received** (green) - from Stripe
   > "Customer payment: $248.50"
   - Click row to open details
   - Show: "Event context explains what happened, source system, reference ID"
   - Point out: "Links to related order (would be functional in live version)"
   - Close dialog

2. **Fee** (red) - from Grab
   > "Marketplace fee deduction: -$28.45"

3. **Payout Settled** (blue) - from Provvypay
   > "Partner revenue share distribution: -$450"

4. **Inventory Adjustment** (purple) - from POS
   > "Stocktake correction on Coffee Beans"
   - Click row
   - Show: "This ties back to the drift we saw in Inventory"

5. **Refund** (yellow) - from Stripe
   > "Customer refund: -$42"

#### Highlight Source System Badges:
> "Each event shows which system it came from - POS, Grab, Stripe, Xero, or Provvypay itself."

#### Emphasize Value:
- **Single source of truth** for accountants
- **Complete audit trail** for compliance
- **Cross-system visibility** for operations
- **Reconciliation** becomes automatic

---

### Conclusion & Key Takeaways (1 minute)

> "So to recap, Platform Preview demonstrates how Provvypay becomes more than just payment links:"

1. **Overview**: Unified KPIs and alerts across all channels
2. **Connections**: Data integration hub pulling from multiple systems
3. **Inventory**: Intelligent, velocity-based stock management
4. **Ledger**: Complete audit trail for compliance and accounting

> "This is a UI-only preview showing the vision. The infrastructure pieces - real integrations, data pipelines, reconciliation engines - are the next phase. But this demonstrates the value proposition: one platform to see everything, understand everything, and make better decisions."

**Final Note**:
> "Notice the 'Preview' badges throughout - we're being transparent that this is conceptual. But the underlying architecture to support this already exists in the payment links and partners modules you've seen."

---

## Demo Tips

### Do's:
✅ **Emphasize the vision**: "One platform for everything"
✅ **Show the connections**: How data flows between systems
✅ **Point out intelligence**: Velocity-based inventory, drift detection, attention items
✅ **Highlight existing work**: "Payment links are live, Partners is built, this connects them"
✅ **Be honest**: "This is preview-only, but shows the roadmap"

### Don'ts:
❌ **Don't try to click disabled buttons**: They won't work
❌ **Don't promise timelines**: "Coming soon" is enough
❌ **Don't dive too deep into tech**: Keep it business-focused
❌ **Don't compare to competitors**: Focus on your unique approach
❌ **Don't oversell**: The "Preview" badges are there for a reason

---

## Audience-Specific Variations

### For Investors:
- Emphasize **platform** vs point solution
- Show **data moat** from integrations
- Highlight **multiple revenue streams** (payments + platform fees)
- Point out **network effects** (more connections = more value)

### For Enterprise Merchants:
- Focus on **operational efficiency**
- Show **cost savings** from unified view
- Emphasize **time savings** (no manual reconciliation)
- Highlight **better decision making** with real-time data

### For Partners/Affiliates:
- Show how **Partners module connects** to platform
- Emphasize **transparency** in revenue share
- Point out **audit trail** in Unified Ledger
- Explain **attribution** accuracy

### For Accountants:
- Deep dive **Unified Ledger**
- Show **reconciliation** benefits
- Emphasize **audit trail** and compliance
- Highlight **source system tracking**

---

## Q&A Preparation

**Q: When will this be available?**
> "We're showing this as a preview to validate the concept. The payment links and partners modules are already functional. Platform integrations would be next phase, but we want to ensure product-market fit first."

**Q: How much will it cost?**
> "Pricing isn't finalized, but the model would likely be usage-based - percentage of transaction volume or per-connection fees. The value is in reducing operational overhead and improving margins."

**Q: What systems do you integrate with?**
> "We've shown POS, Grab, Stripe, and Xero as examples. The architecture is designed to support any system with an API. Priorities would be driven by merchant demand."

**Q: How is this different from [competitor]?**
> "Rather than compare, I'd say our approach is bottom-up: start with payment links that work today, add partner payouts that work today, then build the platform layer. Most competitors build top-down and have complex onboarding."

**Q: What about data security?**
> "All connections use OAuth where possible, encrypted at rest and in transit, SOC 2 compliant. We only pull data merchants authorize, and they can revoke access anytime."

**Q: Can I try it now?**
> "The payment links and partners modules are available for testing. Platform preview is UI-only for now, but we can discuss pilot programs for early adopters."

---

## Demo Environment Checklist

Before demoing, verify:
- [ ] Development server running
- [ ] Logged into dashboard
- [ ] All 4 pages load without errors
- [ ] Charts rendering correctly
- [ ] Dialogs/drawers open smoothly
- [ ] No console errors visible
- [ ] Browser zoom at 100%
- [ ] Adequate screen resolution (1920x1080+)

---

**Demo Readiness**: ✅ Ready to present
**Recommended Practice Runs**: 2-3 times
**Suggested Demo Length**: 8-10 minutes (shorter for time-constrained audiences)


# Provvypay Design System

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** ✅ Implemented

---

## Design North Star

Create a payment platform that SMB owners trust instantly: clean fintech-grade clarity meets operational calm, using vivid blue (#5170ff) as the reliable heartbeat throughout every workflow—from creating invoices to reconciling multi-rail payments—while simplifying crypto complexity into simple "wallet payments."

---

## 🎨 Brand Colors

### Primary Brand Color
```css
--primary: #5170ff          /* Vivid Blue - Main brand color */
--primary-hover: #3d5ce0    /* Hover state */
--primary-active: #2948cc   /* Active/pressed state */
--primary-light: rgba(81, 112, 255, 0.1)   /* Subtle backgrounds */
```

**Usage:**
- Primary CTAs (Create Invoice, Submit, etc.)
- Active navigation states
- Links and interactive elements
- Focus rings
- Selected states
- Progress indicators

### Neutral Colors
```css
--background: #ffffff       /* Page background */
--foreground: #000000       /* Primary text */
--muted: #a8a8a8           /* Secondary text */
--border: #e5e5e5          /* Dividers, borders */
--input-border: #d4d4d4    /* Input borders */
```

### Status Colors (Fintech-specific)
```css
--status-success: #16a34a   /* PAID, SETTLED, Success */
--status-warning: #f59e0b   /* PENDING, PROCESSING, CLEARING */
--status-info: #5170ff      /* OPEN, INFO, Active */
--status-error: #dc2626     /* EXPIRED, CANCELED, Error */
--status-neutral: #6b7280   /* DRAFT, Inactive */
```

### Crypto Token Colors
```css
--token-stripe: #635BFF     /* Stripe Purple */
--token-hbar: #82A4F8       /* HBAR Blue */
--token-usdc: #2775CA       /* USDC Dark Blue */
--token-usdt: #26A17B       /* USDT Green */
--token-audd: #00843D       /* AUDD Australian Green */
```

---

## 📝 Typography

### Font Family
```css
font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             'Helvetica Neue', Arial, sans-serif;
```

### Type Scale
| Element | Size | Line Height | Weight | Usage |
|---------|------|-------------|--------|-------|
| **H1** | 36px (2.25rem) | 40px (2.5rem) | 700 (Bold) | Page titles |
| **H2** | 30px (1.875rem) | 36px (2.25rem) | 600 (Semibold) | Section titles |
| **H3** | 24px (1.5rem) | 32px (2rem) | 600 (Semibold) | Card titles |
| **H4** | 20px (1.25rem) | 28px (1.75rem) | 600 (Semibold) | Subsections |
| **Body** | 16px (1rem) | 24px (1.5rem) | 400 (Normal) | Default text |
| **Body Small** | 14px (0.875rem) | 20px (1.25rem) | 400 (Normal) | Secondary text |
| **Caption** | 12px (0.75rem) | 16px (1rem) | 400 (Normal) | Timestamps, hints |

### Font Weights
- **Normal:** 400
- **Medium:** 500  
- **Semibold:** 600
- **Bold:** 700

---

## 📏 Spacing Scale

Consistent spacing using 4px base unit:

```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-6: 24px
--space-8: 32px
--space-12: 48px
--space-16: 64px
```

**Common Patterns:**
- Card padding: `24px` (space-6)
- Section gaps: `32px` (space-8)
- Element gaps: `16px` (space-4)
- Tight spacing: `8px` (space-2)

---

## 🔘 Components

### Buttons

#### Primary Button
```tsx
<Button>Create Invoice</Button>
```
- Background: `#5170ff`
- Text: White
- Hover: `#3d5ce0`
- Active: `#2948cc`
- Height: 40px
- Padding: 16px horizontal
- Border radius: 8px
- Shadow: Small

#### Secondary Button
```tsx
<Button variant="secondary">Cancel</Button>
```
- Background: `#f5f5f5`
- Border: `#e5e5e5`
- Text: `#171717`
- Hover: Slightly darker background

#### Outline Button
```tsx
<Button variant="outline">Export</Button>
```
- Background: Transparent
- Border: `#d4d4d4`
- Hover: Light gray background
- Hover border: `#5170ff` with 50% opacity

#### Destructive Button
```tsx
<Button variant="destructive">Delete</Button>
```
- Background: `#dc2626`
- Text: White
- For dangerous actions only

#### Button Sizes
```tsx
<Button size="sm">Small</Button>    // 36px height
<Button size="default">Default</Button>  // 40px height
<Button size="lg">Large</Button>    // 44px height
```

---

### Badges

Used for status indicators and labels.

#### Status Variants
```tsx
<StatusBadge status="PAID" />      // Green - Success
<StatusBadge status="OPEN" />      // Blue - Info
<StatusBadge status="PENDING" />   // Amber - Warning
<StatusBadge status="EXPIRED" />   // Red - Error
<StatusBadge status="DRAFT" />     // Gray - Neutral
```

#### Badge Colors
| Status | Background | Text | Border |
|--------|-----------|------|--------|
| **PAID** | `#dcfce7` (green-50) | `#15803d` (green-700) | `#bbf7d0` (green-200) |
| **OPEN** | `#dbeafe` (blue-50) | `#5170ff` | `rgba(81,112,255,0.2)` |
| **PENDING** | `#fef3c7` (amber-50) | `#b45309` (amber-700) | `#fde68a` (amber-200) |
| **EXPIRED** | `#fee2e2` (red-50) | `#b91c1c` (red-700) | `#fecaca` (red-200) |
| **DRAFT** | `#f9fafb` (gray-50) | `#374151` (gray-700) | `#e5e7eb` (gray-200) |

---

### Inputs

#### Text Input
```tsx
<Input placeholder="Enter amount..." />
```
- Height: 40px
- Border: `#d4d4d4`
- Border radius: 8px
- Padding: 12px
- Focus: Blue border + ring

#### Focus State
- Border color: `#5170ff`
- Ring: `rgba(81, 112, 255, 0.2)` at 3px width

#### Error State
- Border color: `#dc2626`
- Ring: `rgba(220, 38, 38, 0.2)`

---

### Cards

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

- Border radius: 12px
- Border: `#e5e5e5`
- Background: White
- Shadow: Small (`0 1px 3px rgba(0,0,0,0.1)`)
- Padding: 24px

---

### Tables

#### Header
- Background: `#f9fafb` (gray-50/50)
- Font weight: 600 (Semibold)
- Height: 44px
- Padding: 12px

#### Rows
- Hover: `rgba(249, 250, 251, 0.5)`
- Selected: `rgba(81, 112, 255, 0.05)`
- Border: `#e5e5e5`
- Padding: 12px

#### Currency Columns
- Text alignment: Right
- Font: Monospace (tabular numbers)
- Class: `.currency`

---

### Navigation (Sidebar)

#### Active State
- Background: `rgba(81, 112, 255, 0.1)` (10% primary)
- Text color: `#5170ff`
- Icon color: `#5170ff`
- Font weight: 600 (Semibold)

#### Hover State
- Background: `#f5f5f5`

#### Default State
- Text color: `#262626`

---

## 🎭 States & Interactions

### Focus Rings
All interactive elements should have visible focus states:
```css
focus-visible:ring-[3px] 
focus-visible:ring-primary/20 
focus-visible:border-primary
```

### Hover States
- Buttons: Darken by 10-15%
- Cards: Subtle lift with shadow increase
- Links: Color change to hover variant
- Rows: Light background tint

### Active/Pressed States
- Buttons: Darken by 20-25%
- Visual feedback via scale or color

### Disabled States
- Opacity: 50%
- Cursor: `not-allowed`
- Pointer events: none

---

## ✅ Empty States

Use friendly, actionable empty states:

```tsx
<div className="flex flex-col items-center justify-center py-12">
  <div className="mb-4 p-3 bg-gray-50 rounded-full">
    <Icon className="w-8 h-8 text-muted" />
  </div>
  <p className="text-sm font-medium mb-1">No items yet</p>
  <p className="text-xs text-muted-foreground mb-4">
    Get started by creating your first item
  </p>
  <Button>Create Item</Button>
</div>
```

---

## 🔐 Trust Cues (Fintech-specific)

### Last Updated Timestamps
Show data freshness:
```tsx
<div className="trust-indicator">
  <Clock className="w-3.5 h-3.5" />
  <span>Last updated: {timestamp}</span>
</div>
```

### Settlement Timing
For payment statuses, show expected timing:
```
- Paid: "Settled immediately"
- Pending: "Clearing, expected in 2-3 business days"
- Processing: "Verifying payment..."
```

### Fee Display
Always show fees clearly:
```
Amount: $100.00
Fee: $2.50 (2.5%)
Total: $102.50
```

### Audit Trail Visibility
- Show who created/modified records
- Display timestamps for all state changes
- Link to detailed transaction logs

---

## 🌐 Responsive Design

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Mobile Considerations
- Touch targets: Minimum 44px × 44px
- Simplified navigation
- Stack layouts vertically
- Larger buttons
- Bottom sheets for modals

---

## ♿ Accessibility (WCAG 2.1 AA)

### Color Contrast
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: Clear focus states

### Keyboard Navigation
- All actions accessible via keyboard
- Logical tab order
- Visible focus indicators

### Screen Readers
- Semantic HTML
- ARIA labels where needed
- Status announcements

---

## 🚀 Crypto/Web3 UX Guidelines

### Progressive Disclosure
- Hide technical details by default
- Use simple terms: "Wallet payments" not "EVM transactions"
- Collapsible advanced settings

### Status Terminology
```
❌ Don't say: "Transaction hash confirmed on-chain"
✅ Do say: "Payment confirmed"
```

### Error Messages
```
❌ Don't say: "RPC endpoint failed"
✅ Do say: "Connection issue. Please try again."
```

### Warnings (Non-alarming)
```
⚠️ "Wallet payments settle within 1-2 minutes. 
    Network fees apply (~$0.10)."
```

---

## 📦 Component Library Location

All components are in `src/components/ui/`:
- `button.tsx` - Button variants
- `badge.tsx` - Badge component
- `status-badge.tsx` - Smart status badges
- `input.tsx` - Form inputs
- `card.tsx` - Card layouts
- `table.tsx` - Data tables
- `sidebar.tsx` - Navigation sidebar

---

## 🎯 Quick Reference

### Common Patterns

**Create CTA (Primary Action):**
```tsx
<Button size="lg">
  <Plus className="w-5 h-5" />
  Create Invoice
</Button>
```

**Status Display:**
```tsx
<StatusBadge status="PAID" />
```

**Empty State:**
```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><Icon /></EmptyMedia>
    <EmptyTitle>No items</EmptyTitle>
    <EmptyDescription>Get started by creating one</EmptyDescription>
  </EmptyHeader>
  <Button>Create Item</Button>
</Empty>
```

**Trust Indicator:**
```tsx
<div className="trust-indicator">
  <Clock className="w-3.5 h-3.5" />
  <span>Updated 2 min ago</span>
</div>
```

---

## 📝 Implementation Checklist

When building new features:

- [ ] Use brand color `#5170ff` for primary actions
- [ ] Include proper status badges
- [ ] Add empty states with CTAs
- [ ] Show last updated timestamps
- [ ] Use consistent spacing (4px scale)
- [ ] Ensure focus states are visible
- [ ] Add hover states to interactive elements
- [ ] Use StatusBadge for payment statuses
- [ ] Right-align currency amounts
- [ ] Include loading states
- [ ] Test keyboard navigation
- [ ] Check color contrast (WCAG AA)

---

## 🔄 Changelog

**v1.0 (January 2026)**
- Initial design system implementation
- Brand color system with #5170ff primary
- Typography scale with Inter font
- Component specifications
- Status badge variants
- Trust cue patterns
- Fintech-specific guidelines

---

**Questions or suggestions?** Contact the design team or open an issue in the repository.


# Design System Quick Start Guide

**For Developers** | **5 min read**

This guide shows you how to apply Provvypay's design system to new features and pages.

---

## 🎨 Brand Color: #5170ff

Our primary brand color is **Vivid Blue #5170ff**. Use it for:
- Primary CTAs
- Active navigation states
- Links
- Focus rings
- Selected items

---

## 🚀 Quick Wins

### 1. Use Primary Buttons for Main Actions

```tsx
// ✅ DO
<Button>Create Invoice</Button>
<Button>Save Changes</Button>
<Button>Submit Payment</Button>

// ❌ DON'T
<Button variant="outline">Create Invoice</Button>  // Not prominent enough
```

### 2. Use StatusBadge for Payment States

```tsx
import { StatusBadge } from '@/components/ui/status-badge'

// ✅ DO
<StatusBadge status="PAID" />
<StatusBadge status="PENDING" />
<StatusBadge status="OPEN" />

// ❌ DON'T
<Badge>PAID</Badge>  // Inconsistent styling
<span className="text-green-500">PAID</span>  // Not reusable
```

### 3. Add Empty States with CTAs

```tsx
// ✅ DO
{items.length === 0 ? (
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
) : (
  <ItemsList items={items} />
)}

// ❌ DON'T
{items.length === 0 && <p>No items</p>}  // Not helpful
```

### 4. Add "Last Updated" Trust Indicators

```tsx
// ✅ DO
<div className="trust-indicator">
  <Clock className="w-3.5 h-3.5" />
  <span>Last updated: {formatTime(timestamp)}</span>
</div>

// Use at bottom of dashboards, reports, ledger pages
```

### 5. Right-Align Currency in Tables

```tsx
// ✅ DO
<TableCell className="currency">
  ${amount.toFixed(2)}
</TableCell>

// Or manually:
<TableCell className="text-right font-mono tabular-nums">
  ${amount.toFixed(2)}
</TableCell>
```

---

## 📋 Common Patterns

### Page Header with Primary CTA

```tsx
<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-3xl font-bold tracking-tight">Page Title</h1>
    <p className="text-muted-foreground mt-1">
      Page description
    </p>
  </div>
  <Button>
    <Plus className="w-4 h-4" />
    Create New
  </Button>
</div>
```

### KPI Card with Icon

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
      Metric Name
    </CardTitle>
    <div className="p-2 bg-primary/10 rounded-lg">
      <Icon className="w-4 h-4 text-primary" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">{value}</div>
    <p className="text-xs text-muted-foreground mt-1">Description</p>
  </CardContent>
</Card>
```

### Status Badge in Table Row

```tsx
<TableRow>
  <TableCell>{id}</TableCell>
  <TableCell>
    <StatusBadge status={status} />
  </TableCell>
  <TableCell className="currency">${amount}</TableCell>
</TableRow>
```

### Form with Grouped Fields

```tsx
<form className="space-y-6">
  {/* Group 1 */}
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Basic Information</h3>
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label>First Name</Label>
        <Input {...register("firstName")} />
      </div>
      <div>
        <Label>Last Name</Label>
        <Input {...register("lastName")} />
      </div>
    </div>
  </div>
  
  {/* Group 2 */}
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Payment Details</h3>
    <div className="space-y-4">
      <div>
        <Label>Amount</Label>
        <Input type="number" {...register("amount")} />
        <p className="text-xs text-muted-foreground mt-1">
          Helper text here
        </p>
      </div>
    </div>
  </div>
  
  <Button type="submit">Submit</Button>
</form>
```

---

## 🎨 Color Usage

### Primary Actions
```tsx
<Button>Primary Action</Button>
<Link className="text-primary hover:text-[rgb(61,92,224)]">Link</Link>
```

### Status Colors
```tsx
// Success (PAID, SETTLED)
<Badge variant="success">Paid</Badge>

// Info (OPEN, Active)
<Badge variant="info">Open</Badge>
<StatusBadge status="OPEN" />

// Warning (PENDING, PROCESSING)
<Badge variant="warning">Pending</Badge>

// Error (EXPIRED, CANCELED)
<Badge variant="destructive">Expired</Badge>
```

---

## ♿ Accessibility Checklist

When building new UI:

- [ ] All buttons have descriptive text or aria-label
- [ ] Focus states are visible (automatic with our components)
- [ ] Color is not the only indicator (use icons + text)
- [ ] Keyboard navigation works (test with Tab key)
- [ ] Forms have proper labels
- [ ] Error messages are clear and actionable

---

## 📱 Responsive Design

Use Tailwind breakpoints:

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {/* Mobile: 1 column, Tablet: 2 columns, Desktop: 4 columns */}
</div>

<Button className="w-full md:w-auto">
  {/* Full width on mobile, auto on desktop */}
</Button>
```

---

## 🚫 Common Mistakes to Avoid

### ❌ Don't Use Random Colors
```tsx
// ❌ BAD
<Button className="bg-blue-500">Click</Button>
<span className="text-green-600">Success</span>

// ✅ GOOD
<Button>Click</Button>  // Uses brand color automatically
<Badge variant="success">Success</Badge>
```

### ❌ Don't Create Custom Status Badges
```tsx
// ❌ BAD
<span className="px-2 py-1 bg-green-100 text-green-800 rounded">
  PAID
</span>

// ✅ GOOD
<StatusBadge status="PAID" />
```

### ❌ Don't Use Inline Styles for Colors
```tsx
// ❌ BAD
<div style={{ color: '#5170ff' }}>Text</div>

// ✅ GOOD
<div className="text-primary">Text</div>
```

### ❌ Don't Left-Align Currency
```tsx
// ❌ BAD
<TableCell>${amount}</TableCell>

// ✅ GOOD
<TableCell className="currency">${amount}</TableCell>
```

---

## 🔧 Developer Tools

### Using CSS Variables

Our design system uses CSS custom properties:

```css
/* Colors */
var(--primary)       /* #5170ff */
var(--foreground)    /* #000000 */
var(--muted)         /* #a8a8a8 */
var(--border)        /* #e5e5e5 */

/* Spacing */
var(--space-4)       /* 16px */
var(--space-6)       /* 24px */
var(--space-8)       /* 32px */

/* Typography */
var(--font-h1-size)  /* 36px */
var(--font-h2-size)  /* 30px */
```

### Using Tailwind Classes

Prefer Tailwind classes for consistency:

```tsx
<div className="text-primary">       {/* Brand blue */}
<div className="text-muted-foreground"> {/* Secondary text */}
<div className="space-y-4">          {/* 16px gaps */}
<div className="space-y-6">          {/* 24px gaps */}
<div className="space-y-8">          {/* 32px gaps */}
```

---

## 📚 Full Reference

For complete documentation, see:
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** - Complete design system specification
- **[UX_DESIGN_IMPLEMENTATION_SUMMARY.md](./UX_DESIGN_IMPLEMENTATION_SUMMARY.md)** - What changed and why

---

## 🆘 Need Help?

1. Check `DESIGN_SYSTEM.md` for detailed specs
2. Look at existing components in `src/components/ui/`
3. Review dashboard page for pattern examples: `src/app/(dashboard)/dashboard/page.tsx`
4. Ask the team in #design-system channel

---

**Remember:** Consistency > creativity. Follow the system for a cohesive user experience!


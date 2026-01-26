# Provvypay Branding - Visual Guide

**Quick reference for the new branded experience**

---

## 🏠 Landing Page (/)

### URL: `https://provvypay-api.onrender.com/`

```
┌─────────────────────────────────────────────────────────────┐
│  [Provvypay Logo]              [Sign in] [Get Started]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✓ Trusted by modern businesses                             │
│                                                              │
│  Unified payments for                    ┌──────────────┐   │
│  modern commerce                         │ Payment Link │   │
│                                          │ #1234        │   │
│  Accept payments via Stripe and crypto   │              │   │
│  wallets. Automatic reconciliation...    │ ✓ Paid       │   │
│                                          │ $4.50        │   │
│  [Start for Free →] [Sign In]           │ Synced ✓     │   │
│                                          └──────────────┘   │
│  ⚡ Instant Setup • 🔒 Bank-Grade Security                  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Everything you need to get paid                            │
│                                                              │
│  ┌───────────────┐ ┌───────────────┐ ┌──────────────────┐  │
│  │ ⚡ Multi-Rail │ │ 🧮 Auto Recon │ │ 📊 Real-Time     │  │
│  │ Payments      │ │ ciliation     │ │ Reporting        │  │
│  │               │ │               │ │                  │  │
│  │ Stripe + crypto│ │ Xero sync    │ │ Track revenue   │  │
│  └───────────────┘ └───────────────┘ └──────────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Ready to simplify your payments?                           │
│  [Get Started Free →]                                       │
├─────────────────────────────────────────────────────────────┤
│  [Logo]        Product    Company    Support                │
│  Payment       Links      Privacy    Sign In                │
│  Platform      Invoices   Terms      Sign Up                │
│                                                              │
│  © 2026 Provvypay. All rights reserved.                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Login Page (/auth/login)

### URL: `https://provvypay-api.onrender.com/auth/login`

```
Desktop View (Split-Screen):
┌─────────────────────────────────────────────────────────────┐
│ LEFT SIDE (Branding)         │  RIGHT SIDE (Form)           │
├──────────────────────────────┼──────────────────────────────┤
│ [Provvypay Logo]             │                              │
│                              │    Sign in                    │
│                              │    Enter your credentials     │
│ Welcome to Provvypay         │                              │
│ The unified payment platform │    Email address             │
│ built for modern businesses  │    [____________]            │
│                              │                              │
│ ⚡ Instant Payments          │    Password   Forgot?        │
│ Accept via Stripe and crypto │    [____________]            │
│                              │                              │
│ 🧮 Automated Reconciliation  │                              │
│ Xero sync with zero manual   │    [Sign in (button)]        │
│                              │                              │
│ 🔒 Bank-Grade Security       │    Don't have an account?    │
│ PCI-compliant with MFA       │    Sign up                   │
│                              │                              │
│ © 2026 Provvypay             │    ℹ️ Development Mode       │
│ Privacy | Terms              │                              │
└──────────────────────────────┴──────────────────────────────┘

Mobile View (Stacked):
┌─────────────────────────────┐
│   [Provvypay Logo]          │
│                             │
│   Sign in                   │
│   Enter your credentials    │
│                             │
│   Email address             │
│   [____________________]    │
│                             │
│   Password   Forgot?        │
│   [____________________]    │
│                             │
│   [Sign in (button)]        │
│                             │
│   Don't have an account?    │
│   Sign up                   │
│                             │
│   ℹ️ Development Mode       │
└─────────────────────────────┘
```

---

## 📊 Dashboard Sidebar

### After Login

```
┌────────────────────┐
│ [Icon] Provvypay   │  ← Logo icon
│ Payment Platform   │
├────────────────────┤
│ Main               │
│ • Dashboard        │
│ • Invoices [BLUE]  │  ← Active state (blue)
│ • Reports          │
│ • Ledger           │
│ • Transactions     │
├────────────────────┤
│ Revenue Share      │
│ > Partners         │
│ > Programs         │
├────────────────────┤
│ Platform Preview   │
│ > Overview         │
│ > Connections      │
├────────────────────┤
│ Configuration      │
│ > Settings         │
│   - Organization   │
│   - Merchant       │
│   - Team           │
└────────────────────┘
```

---

## 🎨 Logo Usage

### Full Logo (`provvypay-logo.svg`)
```
┌──────────────────────────────┐
│  [Waves]  Provvypay          │
│            ^blue   ^black    │
└──────────────────────────────┘

Use for:
- Landing page header
- Login page branding
- Footer
- Email templates
```

### Icon Only (`provvypay-icon.svg`)
```
┌────────┐
│ [Waves]│ Circular wave/fingerprint pattern
│        │ All in brand blue (#5170ff)
└────────┘

Use for:
- Sidebar navigation
- Favicon
- Mobile app icon
- Small spaces
```

---

## 🎨 Color Usage

### Brand Primary
```
█████ #5170ff (Vivid Blue)
████  #3d5ce0 (Hover)
███   #2948cc (Active)
```

### Status Colors
```
████ #16a34a (Success/Paid)
████ #5170ff (Info/Open)
████ #f59e0b (Warning/Pending)
████ #dc2626 (Error/Expired)
```

---

## 📱 Responsive Breakpoints

| Screen | Layout |
|--------|--------|
| **Mobile** (<768px) | Single column, stacked |
| **Tablet** (768px-1024px) | 2 columns |
| **Desktop** (>1024px) | Full layout, split-screen login |

---

## ✨ Key Visual Elements

### Hero Section
- Large heading (5xl-6xl font)
- Brand color accent on key words
- Dual CTAs (primary + outline)
- Trust badges below

### Feature Cards
- Icon in brand color background (10% opacity)
- Bold heading
- Description text
- White background, subtle shadow

### Login Form
- Large inputs (h-11)
- Blue focus rings
- Loading spinner animation
- Error messages with icons

### Navigation
- Logo left
- CTAs right
- Sticky header with blur backdrop

---

## 🎯 User Journey

```
Visitor
   ↓
Landing Page (/)
   ↓
[Get Started] → Signup
   OR
[Sign In] → Login
   ↓
Dashboard
   ↓
Logo in sidebar (consistent branding)
```

---

## 📐 Spacing Scale

```
--space-4:  16px  (button padding, form gaps)
--space-6:  24px  (card padding, section gaps)
--space-8:  32px  (large section spacing)
--space-12: 48px  (hero section spacing)
--space-20: 80px  (section vertical padding)
```

---

## 🔤 Typography

```
Hero Headline:    text-5xl lg:text-6xl font-bold
Section Titles:   text-3xl lg:text-4xl font-bold
Card Titles:      text-xl font-semibold
Body Text:        text-base (16px)
Muted Text:       text-sm text-muted-foreground
```

---

## ✅ Quality Checklist

Visual consistency:
- [x] Logo appears on all auth pages
- [x] Logo appears in dashboard sidebar
- [x] Brand color used for all primary CTAs
- [x] Consistent spacing throughout
- [x] Responsive on all screen sizes
- [x] High contrast (WCAG AA)
- [x] Focus states visible
- [x] Loading states animated
- [x] Error states clear

---

## 🚀 Live URLs

After deployment:
- **Landing:** https://provvypay-api.onrender.com/
- **Login:** https://provvypay-api.onrender.com/auth/login
- **Dashboard:** https://provvypay-api.onrender.com/dashboard (after login)

---

**Visual Guide Complete!** 🎨

All branding is consistent with the design system and ready for deployment.


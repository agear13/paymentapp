# Provvypay Brand Guide

**Document type:** Design system audit (codebase extraction)  
**Application:** Provvypay — Agreement Intelligence Platform  
**Audit date:** June 15, 2026  
**Source of truth:** `src/app/globals.css`, `src/components/ui/*`, marketing/auth/dashboard surfaces

---

## Executive Summary

Provvypay implements a **token-driven design system** built on **shadcn/ui (New York style)**, **Tailwind CSS v4**, and **CSS custom properties** centralized in `src/app/globals.css`. The product has evolved from an earlier **vivid blue (#5170FF)** fintech identity toward a newer **Agreement Intelligence purple (#7C5CFF)** palette, but both generations coexist in code, assets, and documentation.

The system is **functional and largely consistent in the authenticated dashboard**, where semantic tokens (`primary`, `muted`, `border`, etc.) drive buttons, forms, navigation, and cards. **Inconsistencies appear** in: logo SVG colors vs. CSS tokens, landing-page hover colors, empty-state components using raw Tailwind blue/gray, legal pages using a separate gray scale, undefined chart color tokens, and fonts (Geist loaded but Inter applied).

**Recommended priority for a branding/design team:**
1. Canonicalize primary brand purple and retire legacy blue (#5170FF, #3D5CE0, rgb(61,92,224)).
2. Update logo SVG assets to match `#7C5CFF` / `#6A4BFF` / `#9B7CFF`.
3. Add missing design tokens (`--chart-1` through `--chart-5`, `--primary-hover` in Tailwind theme).
4. Unify typography (choose Inter **or** Geist; apply consistently).
5. Add favicon / app icon assets under `src/app/`.

---

## 1. Color Palette

### Design token architecture

Colors are stored as **space-separated RGB triplets** in CSS variables (e.g. `--primary: 124 92 255`) and consumed via:

| Consumption pattern | Example |
|---|---|
| CSS `rgb()` | `rgb(var(--primary))` |
| Tailwind semantic class | `bg-primary`, `text-muted-foreground` |
| Tailwind `@theme inline` mapping | `--color-primary: rgb(var(--primary))` |
| Direct rgba in utilities | `rgba(124, 92, 255, 0.15)` |

Dark mode is supported via `@media (prefers-color-scheme: dark)` and `.dark` class overrides.

---

### Complete color palette table

#### Primary & brand

| Token | Hex | RGB | Tailwind class | Primary usage |
|---|---|---|---|---|
| `--primary` | `#7C5CFF` | `124, 92, 255` | `bg-primary`, `text-primary`, `border-primary`, `ring-primary` | Primary buttons, links, active nav, progress bars, focus rings, chart series |
| `--primary-foreground` | `#FFFFFF` | `255, 255, 255` | `text-primary-foreground` | Text on primary surfaces |
| `--primary-hover` | `#6A4BFF` | `106, 75, 255` | `hover:bg-[rgb(var(--primary-hover))]` | Button/link hover (Button component, auth links) |
| `--primary-active` | `#5A3EE6` | `90, 62, 230` | `active:bg-[rgb(var(--primary-active))]` | Button pressed state |
| `--ring` | `#7C5CFF` | `124, 92, 255` | `ring-ring`, `focus-visible:ring-primary/20` | Focus outlines on inputs, buttons, badges |
| **Legacy blue (SVG/docs)** | `#5170FF` | `81, 112, 255` | — | `public/provvypay-logo.svg`, `public/provvypay-icon.svg`, `BRANDING_VISUAL_GUIDE.md` |
| **Legacy hover (hardcoded)** | `#3D5CE0` | `61, 92, 224` | — | Landing page CTAs, default Badge hover |
| **Accent purple (gradient)** | `#9B7CFF` | `155, 124, 255` | — | Login feature icons, intelligence gradient text, report card top bar |

#### Intelligence & agreement surfaces

| Token | Hex | RGB | Tailwind class | Primary usage |
|---|---|---|---|---|
| `--intelligence-bg` | `#0F1027` | `15, 16, 39` | `bg-intelligence-bg` | Login split-screen left panel |
| `--intelligence-surface` | `#171937` | `23, 25, 55` | `bg-intelligence-surface` | Dark intelligence panels (reserved) |
| `--intelligence-border` | `#7C5CFF` | `124, 92, 255` | — (used with alpha) | `.surface-intelligence`, agreement card borders |
| `--agreement-card` | `#FFFFFF` | `255, 255, 255` | — | Agreement card backgrounds |

#### Backgrounds & surfaces

| Token | Hex (light) | Hex (dark) | Tailwind class | Primary usage |
|---|---|---|---|---|
| `--background` | `#FFFFFF` | `#0A0A0A` | `bg-background` | Page body, dialog content |
| `--foreground` | `#0F1027` | `#EDEDED` | `text-foreground` | Primary body text |
| `--card` | `#FFFFFF` | `#171717` | `bg-card` | Card component |
| `--card-foreground` | `#0F1027` | `#EDEDED` | `text-card-foreground` | Card text |
| `--popover` | `#FFFFFF` | `#171717` | `bg-popover` | Dropdowns, tooltips, Sonner toasts |
| `--popover-foreground` | `#0F1027` | `#EDEDED` | `text-popover-foreground` | Popover text |
| `--sidebar` | `#FAFAFC` | `#171717` | `bg-sidebar` | Dashboard sidebar background |
| `--sidebar-foreground` | `#0F1027` | `#FAFAFA` | `text-sidebar-foreground` | Sidebar text |
| `--sidebar-accent` | `#F5F3FF` | `#262626` | `bg-sidebar-accent` | Sidebar hover/active backgrounds |
| `--sidebar-accent-foreground` | `#0F1027` | `#FAFAFA` | `text-sidebar-accent-foreground` | Sidebar hover text |
| Dashboard main area | — | — | `bg-muted/30` | `dashboard-layout-client.tsx` main content |

#### Secondary, muted & accent

| Token | Hex (light) | Tailwind class | Primary usage |
|---|---|---|---|
| `--secondary` | `#F5F5F5` | `bg-secondary` | Secondary buttons |
| `--secondary-foreground` | `#171717` | `text-secondary-foreground` | Secondary button text |
| `--muted` | `#F3F4F6` | `bg-muted` | Tabs list, table footer, subtle fills |
| `--muted-foreground` | `#667085` | `text-muted-foreground` | Descriptions, captions, placeholders |
| `--accent` | `#F5F5F5` | `bg-accent` | Ghost button hover, outline hover |
| `--accent-foreground` | `#171717` | `text-accent-foreground` | Accent hover text |

#### Borders & inputs

| Token | Hex (light) | Hex (dark) | Tailwind class | Primary usage |
|---|---|---|---|---|
| `--border` | `#E5E7EB` | `#262626` | `border-border` | Cards, tables, dividers |
| `--input` | `#D4D4D8` | `#404040` | `border-input` | Form field borders |

#### Status & semantic

| Token | Hex | RGB | Tailwind class | Primary usage |
|---|---|---|---|---|
| `--success` | `#1D6F42` | `29, 111, 66` | `text-success`, `bg-success` | Success token (defined; badges often use Tailwind green instead) |
| `--settlement-success` | `#DFF7E8` | `223, 247, 232` | `bg-settlement-success` | Settlement surface backgrounds |
| `--settlement-success-text` | `#1D6F42` | `29, 111, 66` | `text-settlement-success-text` | Settlement surface text |
| `--warning` | `#F59E0B` | `245, 158, 11` | `text-warning` | Warning token (Tailwind amber used in badges) |
| `--info` | `#7C5CFF` | `124, 92, 255` | `text-info` | Info token (= primary purple) |
| `--destructive` | `#DC2626` | `220, 38, 38` | `bg-destructive`, `text-destructive` | Destructive buttons, error states |

#### Status badge utility classes (`globals.css`)

| Class | Colors used | Usage |
|---|---|---|
| `.status-paid` | `green-50` / `green-700` / `green-200` | Paid payment status |
| `.status-open` | `blue-50` / `primary` / `primary/20` | Open status |
| `.status-pending` | `amber-50` / `amber-700` / `amber-200` | Pending status |
| `.status-expired`, `.status-canceled` | `red-50` / `red-700` / `red-200` | Terminal failure states |
| `.status-draft` | `gray-50` / `gray-700` / `gray-200` | Draft status |

#### Crypto / payment rail tokens (reports)

| Token | Hex | Usage |
|---|---|---|
| `--token-stripe` | `#635BFF` | Stripe brand color in reports |
| `--token-hbar` | `#82A4F8` | Hedera (HBAR) |
| `--token-usdc` | `#2775CA` | USDC |
| `--token-usdt` | `#26A17B` | USDT |
| `--token-audd` | `#00843D` | AUDD |

> **Note:** Token colors are defined in CSS but not yet mapped to Tailwind `@theme` classes.

#### Chart colors (referenced but undefined)

| Token | Status | Referenced in |
|---|---|---|
| `--chart-1` | ❌ Not defined | — |
| `--chart-2` | ❌ Not defined | Platform preview overview, Agreement Analyzer analytics |
| `--chart-3` | ❌ Not defined | Platform preview pie charts |
| `--chart-4` | ❌ Not defined | Platform preview pie charts |

Charts referencing `hsl(var(--chart-2))` will render incorrectly until tokens are added.

---

### Gradients

| Name | CSS / class | Colors | Usage |
|---|---|---|---|
| Intelligence surface | `.surface-intelligence` | `from rgba(124,92,255,0.06) via white to rgba(124,92,255,0.03)` | Agreement Intelligence panels |
| Intelligence text | `.text-intelligence-gradient` | `#7C5CFF → #9B7CFF` | Gradient headline text |
| Logo mark container | `ProvvypayLogoMark` | `#7C5CFF → #6A4BFF` | Auth/onboarding logo box |
| Login form panel | `bg-gradient-to-b` | `rgba(124,92,255,0.03) → background` | Login right panel |
| Onboarding layout | `bg-gradient-to-b` | `rgba(124,92,255,0.04) via background to background` | Onboarding pages |
| Landing hero glow | `bg-gradient-to-r` | `from-primary/10 to-transparent` + blur | Landing page hero |
| Landing page bg | `bg-gradient-to-b` | `from-background to-muted/30` | Public landing page |
| Shimmer loading | `.animate-shimmer` | Purple alpha sweep | Loading skeleton animation |
| Email (payment failed) | inline CSS | `#EF4444 → #DC2626` | Transactional email template |

---

### Shadows & radius

| Token | Value | Usage |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | — |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Elevated surfaces, dialogs |
| `--radius-sm` | `6px` | — |
| `--radius-md` / `--radius` | `8px` | Buttons, inputs (default) |
| `--radius-lg` | `12px` | — |
| `--radius-xl` | `16px` | Cards (`rounded-xl`), intelligence surfaces |

Button primary shadow: `shadow-sm shadow-[rgba(124,92,255,0.2)]`  
Elevated intelligence card: `shadow-lg shadow-[rgba(124,92,255,0.08)]`

---

## 2. Typography

### Font families

| Role | Declared stack | Actually applied | Source |
|---|---|---|---|
| **Primary (body)** | Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif | ✅ Yes — `body` in `globals.css` | `globals.css` |
| **Tailwind sans** | Same Inter stack | Via `--font-sans` in `@theme inline` | `globals.css` |
| **Geist Sans** | Loaded via `next/font/google` | ⚠️ CSS variable `--font-geist-sans` on `<body>` but **not used** in font-family | `src/app/layout.tsx` |
| **Geist Mono** | Loaded via `next/font/google` | ⚠️ Variable only; mono used via Tailwind `font-mono` | `src/app/layout.tsx` |
| **Monospace** | ui-monospace, SF Mono, Cascadia Code, Roboto Mono | `.currency` utility (tabular nums) | `globals.css` |

**Logo SVG embedded font:** Inter (in `provvypay-logo.svg` text elements)

---

### Typography scale (CSS custom properties)

| Role | Size | Line height | Weight | Letter spacing | CSS variable |
|---|---|---|---|---|---|
| **H1** | 36px (2.25rem) | 40px (2.5rem) | 700 | -0.02em | `--font-h1-size`, `--font-h1-line` |
| **H2** | 30px (1.875rem) | 36px (2.25rem) | 600 | -0.01em | `--font-h2-size`, `--font-h2-line` |
| **H3** | 24px (1.5rem) | 32px (2rem) | 600 | default | `--font-h3-size`, `--font-h3-line` |
| **H4** | 20px (1.25rem) | 28px (1.75rem) | 600 | default | `--font-h4-size`, `--font-h4-line` |
| **H5 / H6** | — | — | — | — | ❌ Not defined in base styles |
| **Body** | 16px (1rem) | 24px (1.5rem) | 400 (default) | default | `--font-body-size`, `--font-body-line` |
| **Body small** | 14px (0.875rem) | 20px (1.25rem) | — | — | `--font-body-sm-size`, `--font-body-sm-line` |
| **Caption** | 12px (0.75rem) | 16px (1rem) | — | — | `--font-caption-size`, `--font-caption-line` |

---

### Common Tailwind typography patterns (in-app)

| Pattern | Classes | Context |
|---|---|---|
| Landing hero | `text-5xl lg:text-6xl font-bold tracking-tight leading-tight` | Public landing H1 (overrides base H1 size) |
| Page titles | `text-3xl font-bold tracking-tight` | Dashboard section headers |
| Card titles | `leading-none font-semibold` | `CardTitle` component |
| Card descriptions | `text-sm text-muted-foreground` | `CardDescription` |
| Dialog titles | `text-lg leading-none font-semibold` | Modal headers |
| Button text | `text-sm font-medium` (default), `text-xs` (sm), `text-base` (lg) | Button component |
| Badge text | `text-xs font-medium` | Badge, StatusBadge |
| Table headers | `text-sm font-semibold` | TableHead |
| Table body | `text-sm` | Table |
| Sidebar brand | `text-sm font-semibold` + `text-xs text-muted-foreground` | App sidebar header |
| KPI values | `text-2xl font-bold` | Dashboard metric cards |
| Section labels | `text-[11px] font-semibold uppercase tracking-[0.2em]` | Onboarding step labels |
| Trust/meta | `text-xs text-muted-foreground` | `.trust-indicator` utility |

### Font weights in use

| Weight | Tailwind | Usage |
|---|---|---|
| 400 | `font-normal` | Body default |
| 500 | `font-medium` | Labels, buttons, nav items, table headers |
| 600 | `font-semibold` | H2–H4, card titles, CTAs, active nav |
| 700 | `font-bold` | H1, KPI values, logo wordmark, landing headlines |

---

## 3. Logo & Branding Assets

### Provvypay-owned assets

| Asset | Path | Variant | Colors | Used in |
|---|---|---|---|---|
| Full horizontal logo | `public/provvypay-logo.svg` | Wordmark + wave icon | Icon & "Provvy": `#5170FF`; "pay": `#1A1A1A` | Documented for landing/footer/email; **not currently imported in React components** |
| Icon only | `public/provvypay-icon.svg` | Fingerprint/wave pattern | `#5170FF` strokes | `ProvvypayLogoMark`, login watermark background |
| Icon duplicate | `src/public/provvypay-icon.svg` | Same as above | `#5170FF` | ⚠️ Duplicate path — potential confusion |
| Merchant uploads | `public/uploads/logos/` | Per-merchant custom logos | Variable | Customer-facing payment pages via `MerchantBranding` |

### Logo component: `ProvvypayLogoMark`

**File:** `src/components/provvypay/provvypay-logo-mark.tsx`

| Prop | Values | Behavior |
|---|---|---|
| `size` | `sm` (32px box), `md` (40px), `lg` (48px) | Icon box + wordmark scale |
| `showWordmark` | boolean (default `true`) | Shows "Provvypay" bold wordmark |
| `href` | string (default `/`) | Wraps in Next.js Link |

Visual treatment:
- Icon container: `rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#6A4BFF]`
- SVG icon: inverted white (`brightness-0 invert`)
- Wordmark: `font-bold tracking-tight`

**Used in:** Login page, onboarding form, onboarding visual header

### Logo variants in practice (not file-based)

| Surface | Implementation | Notes |
|---|---|---|
| Public landing nav | Letter **"P"** in `bg-primary` rounded square | Does not use SVG logo |
| Dashboard sidebar | Letter **"P"** in `bg-primary rounded-lg` | Docs say icon SVG; code uses lettermark |
| Pilot sidebars | Letter **"R"** or **"P"** | White-label pilot workspaces |
| Legal pages | Text-only "Provvypay" | `text-2xl font-bold text-gray-900` — no logo asset |

### Favicon & app icons

| Asset | Status | Notes |
|---|---|---|
| `src/app/icon.png` / `favicon.ico` | ❌ Not present | No Next.js App Router icon files found |
| `NEXT_PUBLIC_APP_ICON` | Env variable | Defaults to `https://provvypay.com/icon.png` for Hedera wallet metadata |
| Browser tab icon | ⚠️ Missing in repo | Relies on external hosted icon or platform default |

### Brand imagery

| Reference | Location | Purpose |
|---|---|---|
| Login watermark | `bg-[url('/provvypay-icon.svg')]` at 4% opacity | Subtle brand texture on auth left panel |
| Hero transformation visual | Inline JSX in landing page | Product storytelling (conversation → agreement → settlement) |
| Agreement Intelligence report | Gradient top bar, score rings | Onboarding/reporting visuals |

---

## 4. UI Design System

**Foundation:** shadcn/ui components in `src/components/ui/`  
**Style preset:** New York (`components.json`)  
**Icon library:** Lucide React  
**CVA:** class-variance-authority for variant management

---

### Buttons (`src/components/ui/button.tsx`)

| Variant | Styling | Use case |
|---|---|---|
| `default` | `bg-primary text-primary-foreground`, purple hover/active, purple shadow | Primary actions |
| `destructive` | `bg-destructive text-white` | Delete, irreversible actions |
| `outline` | `border-input bg-background`, hover accent + `border-primary/50` | Secondary actions |
| `secondary` | `bg-secondary border-border` | Tertiary actions |
| `ghost` | Transparent, hover `bg-accent` | Icon buttons, toolbar |
| `link` | `text-primary underline-offset-4` | Inline text actions |

| Size | Height | Text |
|---|---|---|
| `default` | 40px (`h-10`) | `text-sm` |
| `sm` | 36px (`h-9`) | `text-xs` |
| `lg` | 44px (`h-11`) | `text-base` |
| `icon` / `icon-sm` / `icon-lg` | 40 / 36 / 44px square | — |

Focus: `ring-[3px] ring-primary/20 border-primary`  
Invalid: `ring-destructive/20 border-destructive`

---

### Cards (`src/components/ui/card.tsx`)

```
bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm
```

| Sub-component | Key classes |
|---|---|
| `CardHeader` | Grid layout, `px-6`, optional bottom border |
| `CardTitle` | `leading-none font-semibold` |
| `CardDescription` | `text-muted-foreground text-sm` |
| `CardContent` | `px-6` |
| `CardFooter` | `flex items-center px-6` |

**Operational surface variants** (`src/lib/design/operational-surfaces.ts`):

| Variant | Purpose |
|---|---|
| `opSurfaceBase` | Standard bordered panel |
| `opSurfaceRaised` | Slightly elevated card |
| `opSurfaceInset` | Nested/muted inset |
| `opSurfaceIntelligence` | Purple gradient intelligence accent |
| `opSurfaceSettlement` | Green settlement accent |
| `opSurfaceMetric` | KPI/metric cards |
| `opSurfaceCritical` | Red-tinted alert surface |
| `opSurfaceAction` | Amber-tinted action required |

---

### Form fields

| Component | Key styling |
|---|---|
| **Input** | `h-10 rounded-md border-input text-sm`, focus `border-primary ring-primary/20 ring-[3px]`, invalid destructive ring |
| **Textarea** | Same border/focus pattern, `min-h-16`, `shadow-xs` |
| **Select trigger** | `h-9 rounded-md border-input text-sm`, focus `ring-ring/50` |
| **Label** | `text-sm font-medium leading-none` |
| **Checkbox / Radio / Switch** | shadcn defaults with `ring-primary` focus patterns |

Selection highlight on inputs: `selection:bg-primary selection:text-primary-foreground`

---

### Tables (`src/components/ui/table.tsx`)

| Element | Styling |
|---|---|
| Container | `overflow-x-auto` wrapper |
| Table | `w-full caption-bottom text-sm` |
| Header row | `[&_tr]:border-b` |
| Header cell | `h-11 px-3 font-semibold text-sm bg-gray-50/50` |
| Body row | `border-b hover:bg-gray-50/50 data-[state=selected]:bg-primary/5` |
| Body cell | `px-3 py-3 align-middle whitespace-nowrap` |
| Footer | `bg-muted/50 border-t font-medium` |

---

### Modals & overlays

| Component | Overlay | Content |
|---|---|---|
| **Dialog** | `bg-black/50` | `bg-background rounded-lg border p-6 shadow-lg max-w-lg`, zoom/fade animation |
| **Sheet** | `bg-black/50` | Slide from edge, `bg-background shadow-lg border` |
| **Alert Dialog** | Same family as Dialog | Confirmation flows |
| **Drawer** | Mobile bottom sheet variant | Public payment flows |

Dialog title: `text-lg font-semibold`  
Dialog description: `text-muted-foreground text-sm`

---

### Navigation

| Surface | Active state | Inactive state |
|---|---|---|
| **Sidebar menu button** | `bg-primary/10 font-semibold text-primary`, icon `text-primary` | `hover:bg-sidebar-accent` |
| **Sidebar header** | Logo tile `bg-primary text-primary-foreground` | — |
| **App header** | `h-16 border-b bg-background sticky` | Breadcrumb + org switcher |
| **Tabs** | Active: `bg-background shadow-sm`; list: `bg-muted rounded-lg` | Muted foreground text |
| **Agreement Analyzer nav** | `bg-primary text-primary-foreground rounded-md px-3 py-2` | `text-muted-foreground hover:bg-muted` |

Dashboard main content: `max-w-6xl space-y-6` on `bg-muted/30` canvas.

---

### Badges & tags

**Badge variants** (`src/components/ui/badge.tsx`):

| Variant | Colors |
|---|---|
| `default` | Primary fill; hover `rgb(61,92,224)` ⚠️ legacy |
| `secondary` | Secondary bg + border |
| `destructive` | Red-50/red-700 (light), red-950/red-400 (dark) |
| `success` | Green-50/green-700 |
| `warning` | Amber-50/amber-700 |
| `info` | Blue-50/blue-700 |
| `outline` | Foreground + border |

**StatusBadge** (`src/components/ui/status-badge.tsx`): Maps payment statuses (PAID, OPEN, PENDING, etc.) to Badge variants with inline SVG icons.

Shape: `rounded-full border px-2.5 py-0.5 text-xs font-medium`

---

### Alerts & toasts

| Component | Variants |
|---|---|
| **Alert** | `default` (card bg), `destructive` (destructive text) |
| **Sonner Toaster** | Maps to `--popover`, `--border`, `--radius`; Lucide icons for success/info/warning/error |

Operational attention surfaces use `opSurfaceCritical` (red) and `opSurfaceAction` (amber).

---

### Dashboard widgets

| Pattern | Structure | Typography |
|---|---|---|
| **KPI grid** | `Card` → `CardHeader` (title `text-sm font-medium`) → `CardContent` (`text-2xl font-bold`) | Standard shadcn card |
| **Charts** | `ChartContainer` + Recharts inside `Card` | Axis ticks: `fill-muted-foreground` |
| **Progress** | Track `bg-primary/20`, indicator `bg-primary`, `h-2 rounded-full` | Used in readiness/risk cards |
| **Empty states** | `EmptyState` component OR `operator-empty-state` with operational tokens | Mixed — see inconsistencies |
| **Command center hero** | `opSurfaceIntelligence`, gradient accents | Operational home dashboard |

---

## 5. Recommended Design Tokens

Consolidated token set for a design team to adopt as the single source of truth:

```css
/* Brand — canonical Agreement Intelligence palette */
--brand-primary:        124 92 255;   /* #7C5CFF */
--brand-primary-hover:  106 75 255;   /* #6A4BFF */
--brand-primary-active:  90 62 230;   /* #5A3EE6 */
--brand-primary-light:  155 124 255;  /* #9B7CFF — gradients, accents */
--brand-primary-muted:  245 243 255;  /* #F5F3FF — sidebar accent */

/* Intelligence dark surfaces */
--brand-intelligence-bg:       15 16 39;   /* #0F1027 */
--brand-intelligence-surface:  23 25 55;   /* #171937 */

/* Settlement */
--brand-settlement-bg:   223 247 232;  /* #DFF7E8 */
--brand-settlement-text:  29 111 66;   /* #1D6F42 */

/* Semantic status (align badge + token usage) */
--status-success:  29 111 66;   /* #1D6F42 */
--status-warning: 245 158  11;  /* #F59E0B */
--status-error:  220  38  38;   /* #DC2626 */
--status-info:   124  92 255;   /* = primary */

/* Charts — ADD THESE (currently missing) */
--chart-1: 124 92 255;   /* primary purple */
--chart-2:  29 111 66;   /* settlement green */
--chart-3: 245 158  11;   /* warning amber */
--chart-4:  99  91 255;   /* stripe purple */
--chart-5: 130 164 248;   /* hbar blue */

/* Typography */
--font-family-sans: 'Inter', system-ui, sans-serif;
--font-family-mono: ui-monospace, 'SF Mono', monospace;

/* Radius scale */
--radius-button: 8px;
--radius-card: 12px;
--radius-badge: 9999px;
```

---

## 6. Inconsistencies & Cleanup Opportunities

### Critical

| Issue | Details | Affected surfaces |
|---|---|---|
| **Dual primary brand colors** | CSS tokens use purple `#7C5CFF`; SVG logos use blue `#5170FF` | All logo assets vs. UI |
| **Legacy hover color** | `rgb(61, 92, 224)` = `#3D5CE0` hardcoded on landing CTAs and Badge default hover | Landing page, Badge component |
| **Missing chart tokens** | `--chart-2`, `--chart-3`, `--chart-4` referenced but undefined | Platform preview, Agreement Analyzer |
| **No favicon in repo** | App Router icon files absent | Browser tabs, PWA, wallet connect |

### Typography

| Issue | Details |
|---|---|
| Geist loaded, Inter applied | `next/font` Geist variables on body unused; `@theme --font-sans` points to Inter |
| H5/H6 undefined | No base styles; ad-hoc Tailwind used |
| Landing H1 overrides | `text-5xl/6xl` exceeds tokenized `--font-h1-size` (36px) |

### Component drift

| Issue | Details |
|---|---|
| Empty states use raw blue/gray | `EmptyState.tsx` uses `bg-blue-600`, `text-gray-900` instead of design tokens |
| Legal layout separate palette | `bg-gray-50`, `text-gray-900` — not using semantic tokens |
| Sidebar logo vs. docs | Documentation references SVG icon; code uses letter "P" |
| Status color dual systems | CSS `--success` vs. Tailwind `green-50/700` in Badge and `.status-*` utilities |
| Accessibility focus color | `accessibility.css` uses `blue.500` / `blue-600`, not `--primary` |
| Agreement analyzer cards | Some use raw `slate-*` palette instead of semantic tokens |
| Email templates | Inline hex colors (`#667eea`, `#ef4444`) unrelated to app tokens |

### Asset hygiene

| Issue | Recommendation |
|---|---|
| Duplicate icon at `src/public/provvypay-icon.svg` | Remove or consolidate with `public/` |
| `BRANDING_VISUAL_GUIDE.md` outdated | References `#5170ff` and old sidebar icon integration |
| `provvypay-logo.svg` unused in code | Wire into landing/footer or mark as export-only asset |

---

## 7. File Reference Index

| Category | Primary files |
|---|---|
| Design tokens | `src/app/globals.css` |
| shadcn config | `src/components.json` |
| UI primitives | `src/components/ui/*` |
| Operational surfaces | `src/lib/design/operational-surfaces.ts`, `src/lib/design/operational-spacing.ts` |
| Logo component | `src/components/provvypay/provvypay-logo-mark.tsx` |
| Logo assets | `public/provvypay-logo.svg`, `public/provvypay-icon.svg` |
| Root layout / fonts | `src/app/layout.tsx` |
| Marketing | `src/components/marketing/public-landing-page.tsx` |
| Auth branding | `src/app/auth/login/login-page-client.tsx` |
| Dashboard shell | `src/components/dashboard/app-sidebar.tsx`, `dashboard-layout-client.tsx`, `app-header.tsx` |
| Status display | `src/components/ui/status-badge.tsx`, `src/components/ui/badge.tsx` |
| Accessibility | `src/styles/accessibility.css` |
| Legacy brand docs | `BRANDING_VISUAL_GUIDE.md`, `BRANDING_IMPLEMENTATION_SUMMARY.md` |

---

## 8. Spacing Scale

Defined in `globals.css`:

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-12` | 48px |
| `--space-16` | 64px |

Operational spacing helpers in `src/lib/design/operational-spacing.ts` (`opSpace.sectionY`, `opSpace.pageY`, etc.) provide composable Tailwind class strings for dashboard rhythm.

---

*This document was generated from a static codebase audit. For live preview, run the application and inspect computed styles in browser DevTools against the tokens above.*

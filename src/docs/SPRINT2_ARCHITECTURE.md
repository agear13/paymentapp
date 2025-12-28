# Sprint 2 Architecture Overview

## Application Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Root Layout                             │
│  - Font configuration (Geist Sans, Geist Mono)              │
│  - Global styles                                             │
│  - Toast notifications (Sonner)                              │
│  - Metadata (title, description)                             │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼────────┐
│  (onboarding)  │                    │   (dashboard)    │
│     Layout     │                    │     Layout       │
│                │                    │                  │
│ - Auth check   │                    │ - Auth required  │
│ - Centered UI  │                    │ - Sidebar        │
└───────┬────────┘                    │ - Header         │
        │                             │ - Main content   │
        │                             └────────┬─────────┘
        │                                      │
┌───────▼────────┐                    ┌────────▼─────────────────────┐
│  /onboarding   │                    │      Dashboard Routes        │
│                │                    │                              │
│ OnboardingForm │                    │ /dashboard                   │
│ - Org name     │                    │ /dashboard/payment-links     │
│ - Display name │                    │ /dashboard/ledger            │
│ - Currency     │                    │ /dashboard/transactions      │
│                │                    │ /dashboard/settings/*        │
└────────────────┘                    └──────────────────────────────┘
```

## Component Hierarchy

```
Dashboard Layout
│
├── SidebarProvider
│   │
│   ├── AppSidebar
│   │   ├── SidebarHeader
│   │   │   └── Logo & Brand
│   │   │
│   │   ├── SidebarContent
│   │   │   ├── Main Navigation
│   │   │   │   ├── Dashboard
│   │   │   │   ├── Payment Links
│   │   │   │   ├── Ledger
│   │   │   │   └── Transactions
│   │   │   │
│   │   │   └── Settings (Collapsible)
│   │   │       ├── Organization
│   │   │       ├── Merchant
│   │   │       ├── Team
│   │   │       └── Integrations
│   │   │
│   │   └── SidebarFooter
│   │       └── User Profile
│   │
│   └── Main Content Area
│       │
│       ├── AppHeader
│       │   ├── Mobile Menu Toggle
│       │   ├── BreadcrumbNav
│       │   └── OrganizationSwitcher
│       │
│       └── Page Content
│           └── {children}
```

## Data Flow

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ 1. User action (form submit, button click)
       │
       ▼
┌──────────────────┐
│  React Component │
│                  │
│  - Form handling │
│  - State mgmt    │
│  - Validation    │
└──────┬───────────┘
       │
       │ 2. API request (fetch)
       │
       ▼
┌──────────────────┐
│   API Route      │
│                  │
│  - Auth check    │
│  - Validation    │
│  - Business logic│
└──────┬───────────┘
       │
       │ 3. Database query
       │
       ▼
┌──────────────────┐
│  Prisma Client   │
│                  │
│  - Type-safe ORM │
│  - Query builder │
└──────┬───────────┘
       │
       │ 4. Database operation
       │
       ▼
┌──────────────────┐
│   PostgreSQL     │
│                  │
│  - Organizations │
│  - Settings      │
│  - Payment Links │
└──────┬───────────┘
       │
       │ 5. Response
       │
       ▼
┌──────────────────┐
│  API Response    │
│                  │
│  - Success/Error │
│  - Data payload  │
└──────┬───────────┘
       │
       │ 6. UI update
       │
       ▼
┌──────────────────┐
│  React Component │
│                  │
│  - Toast notify  │
│  - State update  │
│  - Redirect      │
└──────────────────┘
```

## API Architecture

```
┌─────────────────────────────────────────────┐
│              API Middleware                  │
│                                              │
│  - Authentication (getCurrentUser)           │
│  - Request validation (Zod)                  │
│  - Error handling                            │
│  - Logging (Pino)                            │
│  - Rate limiting                             │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼──────────────┐   ┌────────▼──────────────┐
│  Organizations   │   │  Merchant Settings    │
│                  │   │                       │
│  GET    /        │   │  GET    /             │
│  POST   /        │   │  POST   /             │
│  GET    /:id     │   │  GET    /:id          │
│  PATCH  /:id     │   │  PATCH  /:id          │
│  DELETE /:id     │   │  DELETE /:id          │
└──────────────────┘   └───────────────────────┘
```

## Form Flow

```
┌─────────────────────────────────────────────────┐
│              User Interaction                    │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│           React Hook Form                        │
│                                                  │
│  - Field registration                            │
│  - Change tracking                               │
│  - Dirty state                                   │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│           Zod Validation                         │
│                                                  │
│  - Schema definition                             │
│  - Type inference                                │
│  - Error messages                                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│           Form Submit Handler                    │
│                                                  │
│  - Loading state                                 │
│  - API call                                      │
│  - Error handling                                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│           UI Feedback                            │
│                                                  │
│  - Toast notification                            │
│  - Redirect (on success)                         │
│  - Error display (on failure)                    │
└─────────────────────────────────────────────────┘
```

## Navigation Flow

```
User lands on dashboard
        │
        ├─→ No auth? → Redirect to /auth/login
        │
        └─→ Authenticated
                │
                ├─→ Has organization? → Dashboard
                │
                └─→ No organization? → /onboarding
                        │
                        └─→ Complete setup → Dashboard
```

## State Management

```
┌─────────────────────────────────────────────────┐
│              Server State                        │
│                                                  │
│  - User session (Supabase)                       │
│  - Organizations (PostgreSQL)                    │
│  - Merchant settings (PostgreSQL)                │
│  - Payment links (PostgreSQL)                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Client State                        │
│                                                  │
│  - Form state (React Hook Form)                  │
│  - UI state (React useState)                     │
│  - Sidebar state (SidebarProvider)               │
│  - Toast notifications (Sonner)                  │
└─────────────────────────────────────────────────┘
```

## File Organization

```
src/
├── app/
│   ├── (dashboard)/                    # Protected routes
│   │   ├── layout.tsx                  # Dashboard shell
│   │   └── dashboard/
│   │       ├── page.tsx                # Main dashboard
│   │       ├── payment-links/
│   │       ├── ledger/
│   │       ├── transactions/
│   │       └── settings/
│   │           ├── organization/
│   │           ├── merchant/
│   │           ├── team/
│   │           └── integrations/
│   │
│   ├── (onboarding)/                   # Onboarding flow
│   │   └── onboarding/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   │
│   ├── api/                            # API routes
│   │   ├── organizations/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── merchant-settings/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   │
│   └── layout.tsx                      # Root layout
│
├── components/
│   ├── dashboard/                      # Dashboard components
│   │   ├── app-sidebar.tsx
│   │   ├── app-header.tsx
│   │   ├── organization-switcher.tsx
│   │   ├── breadcrumb-nav.tsx
│   │   └── settings/
│   │       ├── organization-settings-form.tsx
│   │       └── merchant-settings-form.tsx
│   │
│   ├── onboarding/                     # Onboarding components
│   │   └── onboarding-form.tsx
│   │
│   └── ui/                             # Shadcn components
│
└── lib/
    ├── auth/                           # Authentication
    ├── api/                            # API utilities
    ├── validations/                    # Zod schemas
    ├── prisma.ts                       # Database client
    ├── logger.ts                       # Logging
    └── utils.ts                        # Utilities
```

## Security Layers

```
┌─────────────────────────────────────────────────┐
│         1. Route Protection                      │
│  - Layout-level auth checks                      │
│  - Redirect unauthenticated users                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         2. API Authentication                    │
│  - getCurrentUser() validation                   │
│  - 401 responses for unauth requests             │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         3. Input Validation                      │
│  - Zod schema validation                         │
│  - Type checking                                 │
│  - Sanitization                                  │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         4. Authorization (TODO)                  │
│  - Organization membership                       │
│  - Role-based permissions                        │
│  - Resource access control                       │
└─────────────────────────────────────────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────┐
│              Frontend                            │
│                                                  │
│  - Next.js 15 (App Router)                       │
│  - React 19                                      │
│  - TypeScript                                    │
│  - Tailwind CSS                                  │
│  - Shadcn/ui                                     │
│  - React Hook Form                               │
│  - Zod                                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Backend                             │
│                                                  │
│  - Next.js API Routes                            │
│  - Prisma ORM                                    │
│  - PostgreSQL                                    │
│  - Supabase Auth                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Infrastructure                      │
│                                                  │
│  - Vercel (Hosting)                              │
│  - Supabase (Database + Auth)                    │
│  - Sentry (Error tracking)                       │
│  - Pino (Logging)                                │
└─────────────────────────────────────────────────┘
```

---

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Type safety throughout
- ✅ Scalable structure
- ✅ Easy to extend
- ✅ Maintainable codebase














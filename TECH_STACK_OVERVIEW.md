# 🛠️ Tech Stack Overview - Provvypay

**Complete technical architecture and technology stack**

---

## 📋 Table of Contents

1. [Programming Languages](#programming-languages)
2. [Frontend Stack](#frontend-stack)
3. [Backend Stack](#backend-stack)
4. [Database & ORM](#database--orm)
5. [Authentication & Security](#authentication--security)
6. [Payment Integrations](#payment-integrations)
7. [Infrastructure & DevOps](#infrastructure--devops)
8. [Third-Party Services](#third-party-services)
9. [Development Tools](#development-tools)
10. [Testing](#testing)

---

## 📝 Programming Languages

### Primary Languages

| Language | Version | Usage | Percentage |
|----------|---------|-------|------------|
| **TypeScript** | 5.9.3 | Primary language for all application code | ~95% |
| **SQL** | PostgreSQL 14+ | Database schema, migrations, queries | ~3% |
| **CSS** | CSS3 | Styling (via Tailwind CSS) | ~1% |
| **JavaScript** | ES2022+ | Build scripts, configuration | ~1% |

### Language Breakdown by Layer

- **Frontend:** 100% TypeScript (.tsx, .ts)
- **Backend:** 100% TypeScript (.ts)
- **API Routes:** 100% TypeScript (.ts)
- **Database:** SQL (Prisma migrations)
- **Styling:** Tailwind CSS (utility-first CSS)
- **Configuration:** TypeScript (.ts) and JavaScript (.js, .mjs)

---

## 🎨 Frontend Stack

### Core Framework
- **Next.js:** 15.5.7
  - App Router (not Pages Router)
  - Server Components
  - Client Components
  - API Routes
  - Middleware

### UI Library
- **React:** 19.1.0
  - React Server Components
  - React Client Components
  - Hooks (useState, useEffect, etc.)

### Styling & Design System
- **Tailwind CSS:** 4.x
  - Utility-first CSS framework
  - JIT (Just-In-Time) compiler
  - Custom design tokens
  - Responsive design utilities

- **Shadcn/ui Component Library**
  - Built on Radix UI primitives
  - Fully customizable components
  - Accessible by default
  - Components used:
    - Accordion, Alert Dialog, Avatar, Button
    - Card, Checkbox, Dialog, Dropdown Menu
    - Form, Input, Label, Popover
    - Select, Separator, Sheet, Table
    - Tabs, Toast/Sonner, Tooltip
    - And 40+ more...

### Form Management & Validation
- **React Hook Form:** 7.68.0
  - Form state management
  - Performance optimization
  - Built-in validation

- **Zod:** 4.1.13
  - TypeScript-first schema validation
  - Runtime type checking
  - Form validation schemas
  - API request/response validation

### State Management
- React built-in state (useState, useContext)
- Server state via React Server Components
- No external state management library (Redux, Zustand, etc.)

### Data Visualization
- **Recharts:** 2.15.4
  - Chart components for analytics dashboard
  - Line charts, bar charts, area charts
  - Responsive charts

### Icons
- **Lucide React:** 0.555.0
  - Modern icon library
  - Tree-shakeable
  - TypeScript support

### Other UI Libraries
- **date-fns:** 4.1.0 - Date manipulation
- **react-day-picker:** 9.11.3 - Date picker component
- **sonner:** 2.0.7 - Toast notifications
- **vaul:** 1.1.2 - Drawer component
- **qrcode:** 1.5.4 - QR code generation
- **embla-carousel-react:** 8.6.0 - Carousel component
- **cmdk:** 1.1.1 - Command menu component
- **next-themes:** 0.4.6 - Dark mode support

---

## ⚙️ Backend Stack

### Runtime & Framework
- **Node.js:** 20.x LTS
- **Next.js API Routes:** 15.5.7
  - RESTful API endpoints
  - Full-stack framework
  - No separate Express.js server
  - Serverless-ready architecture

### API Architecture
- **RESTful API Design**
  - HTTP methods: GET, POST, PUT, PATCH, DELETE
  - JSON request/response format
  - Standardized error responses
  - CORS support

### Core Libraries
- **Prisma Client:** 6.1.0
  - Type-safe database access
  - Auto-generated types
  - Query builder

- **Zod:** 4.1.13
  - Request validation
  - Response validation
  - Environment variable validation

### Business Logic
- Payment orchestration
- Transaction processing
- Multi-currency conversion
- FX rate management
- Ledger accounting
- Webhook handling

---

## 🗄️ Database & ORM

### Database
- **PostgreSQL:** 14+ (recommended 15+)
- **Provider Options:**
  - Supabase PostgreSQL (recommended)
  - Render PostgreSQL
  - Self-hosted PostgreSQL

### ORM
- **Prisma:** 6.1.0
  - Schema definition in `schema.prisma`
  - Type-safe client generation
  - Migration system
  - Database introspection
  - Connection pooling

### Schema Highlights
- **Core Models:** 20+ tables
  - `organizations` - Multi-tenant organization data
  - `user_organizations` - User-to-org relationships
  - `merchant_settings` - Merchant configuration
  - `payment_links` - Payment link records
  - `payment_events` - Payment lifecycle events
  - `ledger_entries` - Double-entry bookkeeping
  - `ledger_accounts` - Chart of accounts
  - `xero_connections` - Xero OAuth tokens
  - `xero_syncs` - Xero sync job tracking
  - `notifications` - In-app notifications
  - `email_logs` - Email delivery tracking
  - `fx_snapshots` - Foreign exchange rate snapshots
  - `fx_rate_history` - Historical FX rates
  - `currency_configs` - Multi-currency configuration
  - `audit_logs` - Audit trail

### Data Types
- UUID primary keys
- TIMESTAMPTZ for dates
- DECIMAL for monetary values
- JSON/JSONB for flexible data
- Enums for status fields

---

## 🔐 Authentication & Security

### Authentication Provider
- **Supabase Auth:** 2.86.2
  - JWT-based authentication
  - Email/password authentication
  - OAuth providers (Google, GitHub)
  - Row Level Security (RLS) ready
  - Session management

**Note:** The database schema contains a `clerk_org_id` field, but this is **legacy naming only**. The application uses **Supabase Auth exclusively**, not Clerk.

### Session Management
- Cookie-based sessions
- Server-side validation
- Secure HTTP-only cookies
- CSRF protection

### Access Control
- **Organization-based access control**
  - Multi-tenant architecture
  - Role-based permissions (OWNER, ADMIN, MEMBER)
  - Resource-level authorization

### Security Features
- **Encryption:** AES-256 encryption for sensitive data
- **Rate Limiting:** Upstash Redis-based rate limiting
- **CORS:** Configurable CORS headers
- **Security Headers:**
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security
  - Content-Security-Policy
  - Referrer-Policy

---

## 💳 Payment Integrations

### Stripe Integration
- **stripe:** 17.7.0
- **Features:**
  - Payment Intents API
  - Webhook handling
  - Customer management
  - Subscription support (ready)
  - Payment link creation
  - Refund handling

### Hedera Integration
- **@hashgraph/sdk:** 2.78.0
- **hashconnect:** 3.0.14
- **Features:**
  - HBAR payments
  - Stablecoin payments (USDC, USDT, AUDD)
  - Mirror Node REST API integration
  - Transaction monitoring
  - Wallet integration (WalletConnect)
  - Multi-token support

### Supported Payment Methods
- Credit/Debit Cards (via Stripe)
- HBAR (Hedera native token)
- USDC (Hedera stablecoin)
- USDT (Hedera stablecoin)
- AUDD (Hedera stablecoin - Australian Dollar)

---

## 🏗️ Infrastructure & DevOps

### Cloud Platform
- **Render.com**
  - Web service hosting
  - Managed PostgreSQL database
  - Auto-deploy from GitHub
  - Environment variable management
  - Health checks
  - Auto-scaling

### Hosting Architecture
- **Service Type:** Serverless + Container hybrid
- **Region:** Oregon (configurable)
- **Plan:** Starter tier (upgradable)
- **Auto-deploy:** Enabled on `main` branch
- **Health Check:** `/api/health` endpoint

### Deployment Configuration
- **File:** `render.yaml` (Blueprint)
- **Services:**
  - Web service (Next.js app)
  - PostgreSQL database
  - Worker service (disabled in Phase 1)
  - Cron jobs (disabled in Phase 1)

### Storage
- **Current:** Local filesystem
  - Logo uploads: `public/uploads/logos/`
  - Not suitable for multi-instance deployments

- **Recommended:** AWS S3 + CloudFront CDN
  - Not currently implemented
  - Documentation provided for migration

### CI/CD Pipeline
- **Render Auto-Deploy**
  - Triggered on push to `main` branch
  - Automatic build and deployment
  - No GitHub Actions configured

- **Build Process:**
  1. Install dependencies (`npm ci --legacy-peer-deps`)
  2. Generate Prisma client (`npx prisma generate`)
  3. Run database migrations (`npx prisma migrate deploy`)
  4. Build Next.js app (`npm run build`)
  5. Health check verification
  6. Deploy to production

### Environment Management
- **Render Environment Groups**
  - Production environment
  - Development environment
  - Environment variable encryption
  - Secret management

---

## 🔌 Third-Party Services

### Accounting Integration
- **Xero:** xero-node 13.3.0
  - OAuth 2.0 authentication
  - Invoice creation/sync
  - Payment recording
  - Contact management
  - Chart of accounts mapping
  - Automated reconciliation

### Email Service
- **Resend:** 6.6.0
  - Transactional emails
  - Email templates
  - Delivery tracking
  - Webhook support

### Error Tracking & Monitoring
- **Sentry:** @sentry/nextjs 10.29.0
  - Error tracking
  - Performance monitoring
  - Release tracking
  - User feedback
  - Source map support
  - Integrations:
    - Client-side (`sentry.client.config.ts`)
    - Server-side (`sentry.server.config.ts`)
    - Edge runtime (`sentry.edge.config.ts`)

### Logging
- **Pino:** 10.1.0
  - Structured logging (JSON format)
  - High-performance logging
  - Pretty printing in development
  - Production-optimized
  - Domain-specific loggers:
    - auth, payment, ledger, xero
    - api, webhook, database, cache
    - fx, hedera

- **pino-pretty:** 13.1.3 (dev only)

### Caching & Rate Limiting
- **Upstash Redis:** @upstash/redis 1.35.7
  - Serverless Redis
  - REST API
  - Rate limiting
  - Session caching
  - FX rate caching

- **Upstash Rate Limit:** @upstash/ratelimit 2.0.7
  - API rate limiting
  - Per-user limits
  - Per-IP limits
  - Sliding window algorithm

---

## 🛠️ Development Tools

### Code Quality
- **ESLint:** 9.x
  - Code linting
  - Style enforcement
  - Next.js rules
  - TypeScript rules
  - Configuration: `eslint.config.mjs`

- **TypeScript:** 5.9.3
  - Type checking
  - IntelliSense support
  - Build-time type safety

### Build Tools
- **Next.js Compiler:** Built-in (Turbopack in dev)
- **PostCSS:** 4.x (Tailwind processing)
- **SWC:** Next.js built-in compiler

### Development Server
- **Next.js Dev Server:** Hot reload, Fast Refresh
- **Turbopack:** Development bundler (faster than Webpack)

### Database Tools
- **Prisma Studio:** Interactive database GUI
- **Prisma Migrate:** Schema migration tool
- **Prisma CLI:** Database management

### Package Management
- **npm:** Package manager
- **Legacy peer deps:** Enabled for compatibility

---

## 🧪 Testing

### Testing Framework
- **Jest:** 29.7.0
  - Unit testing
  - Integration testing
  - Test coverage reporting
  - Configuration: `jest.config.js`

- **jest-environment-jsdom:** 29.7.0
  - Browser environment simulation

### React Testing
- **React Testing Library:** 16.3.1
  - Component testing
  - User interaction testing
  - Accessibility testing

- **@testing-library/jest-dom:** 6.1.5
  - Custom Jest matchers

### Test Coverage
- **Current Status:** 329 tests, 317 passing (96%)
- **Test Types:**
  - Unit tests
  - Integration tests
  - Edge case tests
  - Performance tests
  - Load tests
  - Quality gate tests

### Test Categories
- **Acceptance Tests:** Payment flow validation
- **Edge Cases:** Integration failures, payment edge cases
- **Integration Tests:** AUDD payment flow
- **Load Tests:** Load testing scenarios
- **Multi-Currency Tests:** Currency conversion
- **Performance Tests:** Cache benchmarks, FX batch benchmarks, pagination

---

## 📦 Key Dependencies Summary

### Production Dependencies (Top 20)
```
@hashgraph/sdk: 2.78.0
@hookform/resolvers: 5.2.2
@prisma/client: 6.1.0
@radix-ui/* (40+ packages)
@sentry/nextjs: 10.29.0
@supabase/supabase-js: 2.86.2
@upstash/redis: 1.35.7
date-fns: 4.1.0
hashconnect: 3.0.14
lucide-react: 0.555.0
next: 15.5.7
pino: 10.1.0
prisma: 6.1.0
qrcode: 1.5.4
react: 19.1.0
react-hook-form: 7.68.0
recharts: 2.15.4
resend: 6.6.0
stripe: 17.7.0
xero-node: 13.3.0
zod: 4.1.13
```

### Dev Dependencies
```
@types/node: 20.x
@types/react: 19.x
eslint: 9.x
jest: 29.7.0
typescript: 5.9.3
tsx: 4.21.0
```

---

## 🔄 Architecture Pattern

### Architectural Style
- **Monolithic Full-Stack Application**
  - Frontend and backend in single codebase
  - Next.js App Router architecture
  - Server and Client Components
  - API Routes for backend logic

### Design Patterns
- **Multi-Tenant Architecture**
  - Organization-based data isolation
  - Shared database with tenant filtering
  - Row-level security ready

- **Event-Driven Architecture**
  - Webhook processing
  - Payment event tracking
  - Audit logging

- **Double-Entry Ledger Accounting**
  - Debit/credit entries
  - Chart of accounts
  - Balance reconciliation

### Code Organization
```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Dashboard routes (protected)
│   ├── (public)/          # Public routes (payment pages)
│   ├── (legal)/           # Legal pages
│   ├── (onboarding)/      # Onboarding flow
│   ├── api/               # API Routes (67 endpoints)
│   └── auth/              # Authentication pages
├── components/            # React components
│   ├── ui/                # Shadcn/ui components (67 files)
│   ├── dashboard/         # Dashboard components
│   ├── payment-links/     # Payment link components
│   └── public/            # Public-facing components
├── lib/                   # Business logic & utilities
│   ├── auth/              # Authentication logic
│   ├── currency/          # Currency handling
│   ├── fx/                # Foreign exchange
│   ├── hedera/            # Hedera blockchain
│   ├── ledger/            # Ledger accounting
│   ├── stripe/            # Stripe integration
│   ├── xero/              # Xero integration
│   └── validations/       # Zod schemas
├── hooks/                 # React hooks
├── prisma/                # Database schema & migrations
└── types/                 # TypeScript type definitions
```

---

## 🌐 Browser Support

### Target Browsers
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

### Progressive Enhancement
- Core functionality works without JavaScript
- Enhanced features with JavaScript enabled
- Responsive design (mobile-first)

---

## 📊 Performance Optimizations

### Frontend
- React Server Components (RSC)
- Automatic code splitting
- Image optimization (Next.js Image)
- Font optimization (next/font)
- Lazy loading components
- Memoization (React.memo, useMemo)

### Backend
- Database connection pooling
- Redis caching (FX rates, sessions)
- Query optimization (Prisma)
- Indexed database queries
- Batch processing

### Deployment
- Edge runtime for auth middleware
- CDN for static assets (via Render)
- Gzip/Brotli compression
- HTTP/2 support

---

## 🔒 Compliance & Security

### Data Protection
- Encrypted sensitive data (AES-256)
- Secure credential storage
- PII handling guidelines
- GDPR considerations

### Payment Security
- PCI DSS Level 1 compliant (via Stripe)
- No card data storage
- Tokenization (Stripe tokens)
- Secure webhook verification

### Audit Trail
- Comprehensive audit logging
- User action tracking
- Payment event tracking
- Change history

---

## 📝 Documentation

### Developer Documentation
- API Documentation (`API_DOCUMENTATION.md`)
- Architecture Documentation (`ARCHITECTURE.md`)
- Database Schema (`DATABASE_SCHEMA.md`)
- Setup Guides (multiple sprint docs)
- Quick Reference Guides (domain-specific)

### User Documentation
- Beta Tester Guide (`BETA_TESTER_GUIDE.md`)
- Merchant Onboarding Guide
- Legal Documentation (Terms, Privacy, Security)

---

## 🚀 Version History

- **Next.js:** 15.5.7 (Latest stable)
- **React:** 19.1.0 (Latest stable)
- **TypeScript:** 5.9.3
- **Node.js:** 20.x LTS

**Last Updated:** January 2026

---

## 📞 Support & Resources

### Official Documentation
- Next.js: https://nextjs.org/docs
- React: https://react.dev
- Prisma: https://prisma.io/docs
- Stripe: https://stripe.com/docs
- Hedera: https://docs.hedera.com

### Internal Resources
- Codebase: See `ARCHITECTURE.md`
- API Docs: See `API_DOCUMENTATION.md`
- Setup: See `LOCAL_DEV_SETUP.md`
- Deployment: See `DEPLOYMENT_GUIDE.md`

---

**Note:** This document reflects the current state of the tech stack as of January 2026. For the most up-to-date information, refer to `package.json` and the codebase.


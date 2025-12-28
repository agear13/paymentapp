# Provvypay Architecture Overview

**Version:** 1.0  
**Last Updated:** December 16, 2025  
**Status:** Production

---

## 🏗️ System Architecture

Provvypay is a modern payment link platform built with Next.js 15, supporting both traditional (Stripe) and cryptocurrency (Hedera) payment methods, with automated accounting through Xero integration.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (React 19, TypeScript, Tailwind CSS)         │
│  - Merchant Dashboard                                           │
│  - Public Payment Pages                                         │
│  - Admin Operations Panel                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (Server-Side)                              │
│  - Payment Links API                                            │
│  - Webhook Handlers                                             │
│  - Integration APIs                                             │
│  - Admin APIs                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       BUSINESS LOGIC LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  Services & Utilities                                           │
│  - Payment Service                                              │
│  - FX Snapshot Service                                          │
│  - Ledger Service                                               │
│  - Xero Sync Service                                            │
│  - Notification Service                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Prisma ORM → PostgreSQL (Supabase)                            │
│  Redis Cache (Upstash)                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                        │
├─────────────────────────────────────────────────────────────────┤
│  - Stripe (Card Payments)                                       │
│  - Hedera Hashgraph (Crypto Payments: HBAR, USDC, USDT, AUDD) │
│  - Xero (Accounting Sync)                                       │
│  - CoinGecko (FX Rates)                                         │
│  - Hedera Mirror Node (Tx Monitoring, FX Fallback)            │
│  - Resend (Email Notifications)                                │
│  - Sentry (Error Tracking)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Technology Stack

### Frontend
- **Framework:** Next.js 15.5.7 (App Router)
- **React:** 19.1.0
- **TypeScript:** 5.x
- **Styling:** Tailwind CSS 4.x
- **UI Components:** Radix UI, shadcn/ui
- **State Management:** React hooks, Server components
- **Charts:** Recharts 2.15.4
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js (via Next.js API Routes)
- **API Framework:** Next.js API Routes
- **Validation:** Zod 4.1.13
- **Authentication:** Supabase Auth

### Database & ORM
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma 6.1.0
- **Caching:** Redis (Upstash)
- **Connection Pooling:** Prisma connection pooling

### Payment Integrations
- **Stripe:** stripe 17.7.0 (Card payments, Checkout)
- **Hedera:** hashconnect 3.0.14 (Wallet connection)
- **Hedera Mirror Node:** REST API (Transaction monitoring)

### Accounting Integration
- **Xero:** xero-node 13.3.0 (OAuth 2.0, API sync)

### Monitoring & Observability
- **Error Tracking:** Sentry (@sentry/nextjs 10.29.0)
- **Logging:** Pino (structured logging)
- **Performance:** Custom metrics + Vercel Analytics

### Testing
- **Unit Tests:** Jest 29.7.0
- **Testing Library:** @testing-library/react 14.1.2
- **Coverage:** Jest coverage reports

### DevOps
- **Hosting:** Vercel (Edge Network)
- **CI/CD:** Vercel Git integration
- **Environment:** Environment variables via Vercel

---

## 🔄 Data Flow

### Payment Link Creation Flow

```
1. Merchant creates payment link
   ↓
2. Validate input (Zod schemas)
   ↓
3. Generate short code (8 chars, unique)
   ↓
4. Capture FX snapshots (HBAR, USDC, USDT, AUDD rates)
   ↓
5. Save to database (Prisma)
   ↓
6. Generate QR code
   ↓
7. Return link to merchant
```

### Stripe Payment Flow

```
1. Customer opens payment link
   ↓
2. Selects Stripe payment method
   ↓
3. Redirects to Stripe Checkout
   ↓
4. Customer completes payment
   ↓
5. Stripe sends webhook (payment_intent.succeeded)
   ↓
6. Verify webhook signature
   ↓
7. Update payment link status → PAID
   ↓
8. Create payment event record
   ↓
9. Post ledger entries (DR Stripe Clearing, CR AR)
   ↓
10. Queue Xero sync (invoice + payment)
   ↓
11. Send notification (email + in-app)
   ↓
12. Update dashboard
```

### Hedera Payment Flow

```
1. Customer opens payment link
   ↓
2. Selects Hedera payment method + token (HBAR/USDC/USDT/AUDD)
   ↓
3. Connects wallet (HashConnect)
   ↓
4. Displays required amount (from FX snapshot)
   ↓
5. Customer sends transaction
   ↓
6. Monitor Hedera Mirror Node (polling)
   ↓
7. Detect incoming transaction
   ↓
8. Validate amount (within tolerance)
   ↓
9. Validate token type matches selection
   ↓
10. Update payment link status → PAID
   ↓
11. Create payment event record
   ↓
12. Post ledger entries (DR Crypto Clearing, CR AR)
   ↓
13. Queue Xero sync (invoice + payment)
   ↓
14. Send notification (email + in-app)
   ↓
15. Update dashboard
```

### Xero Sync Flow

```
1. Payment confirmed
   ↓
2. Create sync record (status: PENDING)
   ↓
3. Queue processor picks up record
   ↓
4. Create invoice in Xero
   ↓
5. Record payment in Xero
   ↓
6. Update sync status → SUCCESS
   ↓
7. If error: Retry with exponential backoff
   ↓
8. After 5 retries: Status → FAILED, Alert merchant
```

---

## 🏛️ Core Modules

### 1. Payment Link Module
**Location:** `src/app/api/payment-links/`, `src/lib/payment-link/`

**Responsibilities:**
- Payment link CRUD operations
- Short code generation
- QR code generation
- Status management (state machine)
- Expiry handling

**Key Files:**
- `route.ts` - API endpoint
- `payment-link-service.ts` - Business logic
- `short-code-generator.ts` - Short code utility
- `state-machine.ts` - Status transitions

### 2. FX Snapshot Module
**Location:** `src/lib/fx/`

**Responsibilities:**
- Fetch cryptocurrency rates (HBAR, USDC, USDT, AUDD)
- Capture creation-time snapshots
- Capture settlement-time snapshots
- Provider fallback (CoinGecko → Mirror Node)
- Rate caching

**Key Files:**
- `fx-snapshot-service.ts` - Snapshot orchestration
- `rate-providers.ts` - CoinGecko integration
- `hedera-mirror-rate-provider.ts` - Fallback provider
- `rate-calculations.ts` - Amount calculations

### 3. Ledger Module
**Location:** `src/lib/ledger/`

**Responsibilities:**
- Double-entry bookkeeping
- Account management
- Ledger entry creation
- Balance validation
- Audit trail

**Key Files:**
- `ledger-service.ts` - Ledger operations
- `account-seeder.ts` - Default accounts
- `balance-validator.ts` - Balance checks

**Chart of Accounts:**
- 1050: Stripe Clearing (Asset)
- 1051: Crypto Clearing - HBAR (Asset)
- 1052: Crypto Clearing - USDC (Asset)
- 1053: Crypto Clearing - USDT (Asset)
- 1054: Crypto Clearing - AUDD (Asset)
- 1200: Accounts Receivable (Asset)
- 4000: Revenue (Revenue)
- 6100: Processor Fee Expense (Expense)

### 4. Xero Integration Module
**Location:** `src/lib/xero/`

**Responsibilities:**
- OAuth 2.0 authentication
- Token management (refresh)
- Invoice creation
- Payment recording
- Account mapping
- Sync queue management
- Retry logic

**Key Files:**
- `xero-client.ts` - OAuth client
- `xero-sync-service.ts` - Sync orchestration
- `xero-invoice-service.ts` - Invoice creation
- `xero-payment-service.ts` - Payment recording
- `queue-processor.ts` - Retry queue

### 5. Payment Processing Module
**Location:** `src/lib/payments/`

**Responsibilities:**
- Stripe integration
- Hedera transaction monitoring
- Payment validation
- Multi-token support (HBAR, USDC, USDT, AUDD)
- Webhook processing

**Key Files:**
- `stripe-client.ts` - Stripe SDK wrapper
- `hedera-monitor.ts` - Transaction monitoring
- `hedera-token-service.ts` - Token balance, validation
- `payment-validator.ts` - Amount/token validation

### 6. Notification Module
**Location:** `src/lib/notifications/`

**Responsibilities:**
- Email sending (Resend)
- In-app notifications
- Notification preferences
- Email template rendering
- Delivery tracking

**Key Files:**
- `notification-service.ts` - Notification orchestration
- `email-service.ts` - Email sending
- `templates/` - Email templates

### 7. Reporting Module
**Location:** `src/app/api/reports/`, `src/lib/reports/`

**Responsibilities:**
- Revenue analytics
- Payment method breakdown
- Token distribution reports
- CSV export
- Date filtering

**Key Files:**
- `revenue/route.ts` - Revenue API
- `token-breakdown/route.ts` - Token breakdown API
- `report-service.ts` - Report generation

---

## 🔒 Security Architecture

### Authentication
- **Provider:** Supabase Auth
- **Method:** JWT tokens
- **Storage:** HTTP-only cookies
- **Middleware:** Route protection

### Authorization
- **Model:** Organization-based access control
- **Implementation:** Middleware checks
- **Database:** Row-level filtering by organization_id

### Data Encryption
- **At Rest:** PostgreSQL encryption (Supabase)
- **In Transit:** TLS/HTTPS
- **Sensitive Fields:** Xero tokens (AES-256-GCM)
- **Key Management:** Environment variables

### API Security
- **Rate Limiting:** Upstash Redis (sliding window)
- **CSRF Protection:** Next.js built-in
- **Webhook Validation:** Signature verification
- **Input Validation:** Zod schemas

### PCI Compliance
- **Strategy:** Never store card data
- **Implementation:** Stripe Checkout (redirect)
- **Certification:** Stripe SAQ-A compliance

---

## 📊 Database Architecture

### Schema Design Principles
1. **Normalization:** 3NF for data integrity
2. **Cascade Deletes:** Organization deletion cascades
3. **Audit Trail:** Comprehensive audit_logs table
4. **Indexes:** Strategic indexes for performance
5. **Constraints:** Foreign keys, unique constraints

### Key Relationships
```
organizations (1) ←→ (many) payment_links
organizations (1) ←→ (1) merchant_settings
organizations (1) ←→ (1) xero_connections
payment_links (1) ←→ (many) payment_events
payment_links (1) ←→ (many) fx_snapshots (4 tokens x 2 types = 8 records)
payment_links (1) ←→ (many) ledger_entries
payment_links (1) ←→ (many) xero_syncs
```

### Performance Optimizations
- Composite indexes on frequently queried columns
- Cursor-based pagination for large datasets
- Selective field loading (Prisma select)
- Redis caching for FX rates and reports
- Connection pooling

---

## 🚀 Deployment Architecture

### Hosting
- **Platform:** Vercel
- **Regions:** Edge Network (global)
- **Compute:** Serverless functions
- **Static:** CDN for static assets

### Environment Strategy
- **Development:** Local + Supabase dev instance
- **Staging:** Vercel preview deployments
- **Production:** Vercel production deployment

### CI/CD Pipeline
```
1. Git push to branch
   ↓
2. Vercel builds preview
   ↓
3. Run type checking (tsc)
   ↓
4. Run linting (ESLint)
   ↓
5. Run tests (Jest)
   ↓
6. Deploy to preview URL
   ↓
7. Merge to main → Production deployment
```

### Monitoring
- **Errors:** Sentry (real-time alerts)
- **Logs:** Pino structured logs → Vercel logs
- **Performance:** Custom /api/health endpoint
- **Uptime:** External monitoring service

---

## 🔄 State Management

### Payment Link State Machine

```
DRAFT → OPEN → PAID
         ↓      ↑
         ↓      (rare: manual correction)
      EXPIRED
         ↓
      CANCELED
```

**State Transitions:**
- `DRAFT → OPEN`: Manual activation by merchant
- `OPEN → PAID`: Payment confirmed
- `OPEN → EXPIRED`: Expiry timestamp reached
- `OPEN → CANCELED`: Manual cancellation
- `EXPIRED/CANCELED`: Terminal states (no transitions)

### Xero Sync State Machine

```
PENDING → SUCCESS
   ↓
   ↓ (on error)
   ↓
RETRYING → SUCCESS
   ↓
   ↓ (after 5 retries)
   ↓
FAILED
```

**Retry Schedule:**
1. 1 minute
2. 5 minutes
3. 15 minutes
4. 1 hour
5. 6 hours

---

## 🧪 Testing Strategy

### Unit Tests
- **Framework:** Jest
- **Coverage Target:** 80%+
- **Location:** `src/__tests__/`
- **Focus:** Business logic, utilities, services

### Integration Tests
- **Location:** `src/__tests__/integration/`
- **Focus:** API endpoints, database operations
- **Mocking:** Prisma, external APIs

### E2E Tests
- **Status:** Planned (Sprint 20)
- **Tool:** Playwright or Cypress
- **Focus:** Critical user flows

### Test Data
- **Factories:** Test data factories
- **Mocking:** Mock Prisma, Mock Stripe, Mock Hedera

---

## 📈 Scalability Considerations

### Current Capacity
- **Serverless:** Auto-scaling via Vercel
- **Database:** Supabase (scales with plan)
- **Cache:** Redis (Upstash scales automatically)

### Bottlenecks & Mitigations
1. **Database Queries:**
   - Mitigation: Indexes, cursor pagination, selective loading
2. **FX Rate API:**
   - Mitigation: Caching, fallback provider
3. **Webhook Processing:**
   - Mitigation: Idempotency, retry queue
4. **Xero API Rate Limits:**
   - Mitigation: Queue with backoff, rate limit tracking

### Future Enhancements
- [ ] Materialized views for reporting
- [ ] Read replicas for heavy queries
- [ ] Message queue (SQS/RabbitMQ) for async processing
- [ ] GraphQL layer for flexible queries

---

## 🔧 Configuration Management

### Environment Variables

**Required:**
```bash
# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Hedera
NEXT_PUBLIC_HEDERA_NETWORK=mainnet
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://mainnet-public.mirrornode.hedera.com

# Xero
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=https://.../api/xero/callback

# Redis
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Email
RESEND_API_KEY=...

# Encryption
ENCRYPTION_KEY=... (32-byte hex)

# Monitoring
SENTRY_DSN=...
```

**Optional:**
```bash
# CoinGecko API (optional, higher rate limits with API key)
COINGECKO_API_KEY=...

# Feature Flags
NEXT_PUBLIC_ENABLE_HEDERA_PAYMENTS=true
NEXT_PUBLIC_ENABLE_XERO_SYNC=true
```

---

## 📚 Key Design Patterns

### 1. Service Layer Pattern
All business logic encapsulated in service classes:
- `PaymentLinkService`
- `FxSnapshotService`
- `LedgerService`
- `XeroSyncService`

### 2. Repository Pattern
Prisma acts as repository layer, abstracted via service layer.

### 3. Factory Pattern
Test data factories for consistent test data generation.

### 4. Strategy Pattern
FX rate providers (CoinGecko, Mirror Node) implement common interface.

### 5. State Machine Pattern
Payment link lifecycle managed via explicit state transitions.

### 6. Queue Pattern
Xero sync queue with exponential backoff retry logic.

---

## 🎯 Performance Targets

### Response Times
- **API Endpoints:** < 200ms (p95)
- **Pay Page TTFB:** < 600ms (p95)
- **Dashboard Load:** < 1s (p95)

### Availability
- **Target:** 99.5% uptime
- **Monitoring:** Health checks every 5 minutes

### Database
- **Query Time:** < 100ms (p95)
- **Connection Pool:** Max 100 connections

### Cache Hit Rates
- **FX Rates:** > 90%
- **API Responses:** > 70%

---

## 📞 External API Dependencies

| Service | Purpose | SLA | Fallback |
|---------|---------|-----|----------|
| Stripe | Payment processing | 99.99% | None (critical) |
| Hedera | Crypto payments | 99.9% | None (critical) |
| Xero | Accounting sync | 99.5% | Queue + retry |
| CoinGecko | FX rates | 95% | Mirror Node |
| Hedera Mirror Node | Tx monitoring, FX fallback | 99% | Manual reconciliation |
| Resend | Email delivery | 99.5% | Queue for retry |

---

## 🔮 Future Architecture Considerations

### Phase 2 Enhancements
- [ ] Microservices architecture (payment service, sync service)
- [ ] Event-driven architecture (Kafka/EventBridge)
- [ ] Advanced caching (Redis Cluster)
- [ ] Real-time updates (WebSockets)
- [ ] GraphQL API layer
- [ ] Multi-region deployment

### Phase 3 Scaling
- [ ] Kubernetes deployment
- [ ] Database sharding
- [ ] Read replicas
- [ ] CDN optimization
- [ ] Advanced monitoring (Datadog/New Relic)

---

## 📖 Related Documentation

- [Database Schema Documentation](./DATABASE_SCHEMA.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Local Development Setup](./LOCAL_DEV_SETUP.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Code Style Guide](./CODE_STYLE_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)

---

**Last Updated:** December 16, 2025  
**Maintained By:** Provvypay Engineering Team








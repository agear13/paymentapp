# Provvypay Database Schema Documentation

**Version:** 1.0  
**Last Updated:** December 16, 2025  
**Database:** PostgreSQL 15+ (Supabase)  
**ORM:** Prisma 6.1.0

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Table Definitions](#table-definitions)
4. [Enums](#enums)
5. [Indexes](#indexes)
6. [Constraints](#constraints)
7. [Data Types](#data-types)
8. [Migration Strategy](#migration-strategy)

---

## 🎯 Overview

The Provvypay database follows a **normalized relational model (3NF)** with clear separation of concerns:

- **Core Entities:** Organizations, Payment Links, Merchant Settings
- **Payment Processing:** Payment Events, FX Snapshots
- **Accounting:** Ledger Accounts, Ledger Entries
- **Integrations:** Xero Connections, Xero Syncs
- **Notifications:** Notifications, Email Logs, Preferences
- **Audit:** Audit Logs (append-only)

**Design Principles:**
- Multi-tenant architecture (organization-based)
- Cascade deletes for data consistency
- Comprehensive audit trail
- Optimized indexes for performance
- Strong referential integrity

---

## 🔗 Entity Relationship Diagram

```
┌─────────────────────┐
│   organizations     │
│  (id, clerk_org_id) │
└──────────┬──────────┘
           │ 1
           │
           ├──────────────┐
           │ n            │ 1
           │              │
┌──────────▼─────────┐   │   ┌─────────────────────────┐
│   payment_links    │   │   │  merchant_settings      │
│ (id, short_code)   │◄──┘   │ (id, stripe_account_id) │
└──────────┬─────────┘       └─────────────────────────┘
           │ 1                           │ 1
           │                             │
   ┌───────┼──────────────┬─────────────┼────────────────┐
   │ n     │ n            │ n           │ n              │
   │       │              │             │                │
┌──▼──────────┐   ┌───────▼───────┐   ┌▼──────────────┐  ┌──────────────────┐
│fx_snapshots │   │payment_events │   │xero_syncs     │  │xero_connections  │
│(HBAR,USDC,  │   │(CREATED,PAID, │   │(PENDING,      │  │(access_token,    │
│ USDT,AUDD)  │   │ FAILED, etc.) │   │ SUCCESS, etc.)│  │ refresh_token)   │
└─────────────┘   └───────────────┘   └───────────────┘  └──────────────────┘
           │ n
           │
┌──────────▼──────────┐
│  ledger_entries     │
│  (DR/CR, amount)    │
└──────────┬──────────┘
           │ n
           │
           │ 1
┌──────────▼──────────┐
│  ledger_accounts    │
│  (code, type)       │
└─────────────────────┘
```

---

## 📊 Table Definitions

### 1. `organizations`

**Purpose:** Multi-tenant root entity. All data scoped to organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `clerk_org_id` | VARCHAR(255) | No | External auth provider ID (Supabase) |
| `name` | VARCHAR(255) | No | Organization display name |
| `created_at` | TIMESTAMPTZ | No | Creation timestamp |

**Relationships:**
- Has many `payment_links`
- Has one `merchant_settings`
- Has one `xero_connections`
- Has many `ledger_accounts`
- Has many `audit_logs`
- Has many `notifications`
- Has many `notification_preferences`

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `clerk_org_id`

---

### 2. `merchant_settings`

**Purpose:** Per-organization payment configuration and Xero account mappings.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `organization_id` | UUID | No | Foreign key → organizations |
| `display_name` | VARCHAR(255) | No | Merchant display name |
| `default_currency` | CHAR(3) | No | ISO 4217 code (e.g., USD, AUD) |
| `stripe_account_id` | VARCHAR(255) | Yes | Stripe account ID |
| `hedera_account_id` | VARCHAR(50) | Yes | Hedera account (0.0.xxxxx) |
| `xero_revenue_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `xero_receivable_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `xero_stripe_clearing_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `xero_hbar_clearing_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `xero_usdc_clearing_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `xero_usdt_clearing_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `xero_audd_clearing_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `xero_fee_expense_account_id` | VARCHAR(255) | Yes | Xero account mapping |
| `created_at` | TIMESTAMPTZ | No | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | Last update timestamp |

**Relationships:**
- Belongs to `organizations` (CASCADE DELETE)

**Critical Features:**
- **4 separate crypto clearing accounts** for HBAR, USDC, USDT, AUDD
- Allows token-specific accounting in Xero
- All Xero mappings are optional (nullable)

---

### 3. `payment_links`

**Purpose:** Core payment link entity with lifecycle management.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `organization_id` | UUID | No | Foreign key → organizations |
| `short_code` | VARCHAR(8) | No | Unique URL-safe code |
| `status` | ENUM | No | PaymentLinkStatus (default: DRAFT) |
| `amount` | DECIMAL(18,2) | No | Invoice amount |
| `currency` | CHAR(3) | No | ISO 4217 code |
| `description` | TEXT | No | Invoice description |
| `invoice_reference` | VARCHAR(255) | Yes | Optional invoice reference |
| `customer_email` | VARCHAR(255) | Yes | Optional customer email |
| `customer_phone` | VARCHAR(50) | Yes | Optional customer phone |
| `expires_at` | TIMESTAMPTZ | Yes | Optional expiry timestamp |
| `created_at` | TIMESTAMPTZ | No | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | Last update timestamp |

**Relationships:**
- Belongs to `organizations` (CASCADE DELETE)
- Has many `payment_events` (CASCADE DELETE)
- Has many `fx_snapshots` (CASCADE DELETE)
- Has many `ledger_entries` (CASCADE DELETE)
- Has many `xero_syncs` (CASCADE DELETE)

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `short_code`
- INDEX on `(organization_id, status)`

**Business Rules:**
- Short code: 8 characters, URL-safe, unique
- Amount: 2 decimal precision
- Currency: ISO 4217 3-letter code
- Status follows state machine: DRAFT → OPEN → PAID/EXPIRED/CANCELED

---

### 4. `payment_events`

**Purpose:** Event log for payment link lifecycle.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `payment_link_id` | UUID | No | Foreign key → payment_links |
| `event_type` | ENUM | No | PaymentEventType |
| `payment_method` | ENUM | Yes | PaymentMethod (STRIPE, HEDERA) |
| `stripe_payment_intent_id` | VARCHAR(255) | Yes | Stripe PI ID |
| `hedera_transaction_id` | VARCHAR(255) | Yes | Hedera transaction ID |
| `amount_received` | DECIMAL(18,8) | Yes | Actual amount received |
| `currency_received` | CHAR(3) | Yes | Currency received |
| `metadata` | JSONB | Yes | Additional event data |
| `created_at` | TIMESTAMPTZ | No | Event timestamp |

**Relationships:**
- Belongs to `payment_links` (CASCADE DELETE)

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `(payment_link_id, created_at DESC)`

**Event Types:**
- `CREATED`, `OPENED`, `PAYMENT_INITIATED`, `PAYMENT_CONFIRMED`, `PAYMENT_FAILED`, `EXPIRED`, `CANCELED`

---

### 5. `fx_snapshots`

**Purpose:** Capture cryptocurrency exchange rates at creation and settlement.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `payment_link_id` | UUID | No | Foreign key → payment_links |
| `snapshot_type` | ENUM | No | CREATION or SETTLEMENT |
| `token_type` | ENUM | Yes | HBAR, USDC, USDT, AUDD |
| `base_currency` | CHAR(3) | No | Crypto token (HBAR, USDC, etc.) |
| `quote_currency` | CHAR(3) | No | Fiat currency (USD, AUD, etc.) |
| `rate` | DECIMAL(18,8) | No | Exchange rate (8 decimals) |
| `provider` | VARCHAR(100) | No | Rate source (CoinGecko, Mirror Node) |
| `captured_at` | TIMESTAMPTZ | No | Capture timestamp |

**Relationships:**
- Belongs to `payment_links` (CASCADE DELETE)

**Business Rules:**
- **FOUR snapshots per type:** 1 for each token (HBAR, USDC, USDT, AUDD)
- Creation snapshot: Captured when link created
- Settlement snapshot: Captured when payment confirmed
- Rate precision: 8 decimal places

**Example Data:**
```sql
-- For a single payment link with USD invoice:
-- CREATION snapshots (4 records):
(CREATION, HBAR, 'HBAR', 'USD', 0.12345678, 'CoinGecko', '2025-12-16T10:00:00Z')
(CREATION, USDC, 'USDC', 'USD', 0.99980000, 'CoinGecko', '2025-12-16T10:00:00Z')
(CREATION, USDT, 'USDT', 'USD', 1.00010000, 'CoinGecko', '2025-12-16T10:00:00Z')
(CREATION, AUDD, 'AUDD', 'USD', 0.67890000, 'CoinGecko', '2025-12-16T10:00:00Z')

-- SETTLEMENT snapshots (4 records, captured when payment received):
(SETTLEMENT, HBAR, 'HBAR', 'USD', 0.12456789, 'CoinGecko', '2025-12-16T12:30:00Z')
(SETTLEMENT, USDC, 'USDC', 'USD', 0.99990000, 'CoinGecko', '2025-12-16T12:30:00Z')
(SETTLEMENT, USDT, 'USDT', 'USD', 1.00020000, 'CoinGecko', '2025-12-16T12:30:00Z')
(SETTLEMENT, AUDD, 'AUDD', 'USD', 0.67900000, 'CoinGecko', '2025-12-16T12:30:00Z')
```

---

### 6. `ledger_accounts`

**Purpose:** Chart of accounts for double-entry bookkeeping.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `organization_id` | UUID | No | Foreign key → organizations |
| `code` | VARCHAR(50) | No | Account code (e.g., 1050) |
| `name` | VARCHAR(255) | No | Account name |
| `account_type` | ENUM | No | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| `xero_account_id` | VARCHAR(255) | Yes | Mapped Xero account ID |
| `created_at` | TIMESTAMPTZ | No | Creation timestamp |

**Relationships:**
- Belongs to `organizations` (CASCADE DELETE)
- Has many `ledger_entries`

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `(organization_id, code)`

**Default Chart of Accounts:**
```
1050 - Stripe Clearing (ASSET)
1051 - Crypto Clearing - HBAR (ASSET)
1052 - Crypto Clearing - USDC (ASSET)
1053 - Crypto Clearing - USDT (ASSET)
1054 - Crypto Clearing - AUDD (ASSET)
1200 - Accounts Receivable (ASSET)
4000 - Revenue (REVENUE)
6100 - Processor Fee Expense (EXPENSE)
```

---

### 7. `ledger_entries`

**Purpose:** Double-entry ledger transactions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `payment_link_id` | UUID | No | Foreign key → payment_links |
| `ledger_account_id` | UUID | No | Foreign key → ledger_accounts |
| `entry_type` | ENUM | No | DEBIT or CREDIT |
| `amount` | DECIMAL(18,8) | No | Entry amount (8 decimals) |
| `currency` | CHAR(3) | No | Entry currency |
| `description` | TEXT | No | Entry description |
| `idempotency_key` | VARCHAR(255) | No | Unique key for deduplication |
| `created_at` | TIMESTAMPTZ | No | Entry timestamp |

**Relationships:**
- Belongs to `payment_links` (CASCADE DELETE)
- Belongs to `ledger_accounts`

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `idempotency_key`

**Business Rules:**
- Every transaction must balance (sum of DR = sum of CR)
- Idempotency key prevents duplicate postings
- Amount precision: 8 decimal places (supports crypto)

**Example Posting (HBAR Payment):**
```sql
-- DR: Crypto Clearing - HBAR (1051)
-- CR: Accounts Receivable (1200)
INSERT INTO ledger_entries VALUES
  (uuid1, link_id, account_1051, 'DEBIT', 100.00, 'USD', 'HBAR payment...', key1, NOW()),
  (uuid2, link_id, account_1200, 'CREDIT', 100.00, 'USD', 'HBAR payment...', key1, NOW());
```

---

### 8. `xero_connections`

**Purpose:** OAuth 2.0 tokens for Xero integration.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `organization_id` | UUID | No | Foreign key → organizations (UNIQUE) |
| `tenant_id` | VARCHAR(255) | No | Xero tenant ID |
| `access_token` | TEXT | No | Encrypted OAuth access token |
| `refresh_token` | TEXT | No | Encrypted OAuth refresh token |
| `expires_at` | TIMESTAMPTZ | No | Token expiry timestamp |
| `connected_at` | TIMESTAMPTZ | No | Initial connection timestamp |

**Relationships:**
- Belongs to `organizations` (CASCADE DELETE, ONE-TO-ONE)

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `organization_id`

**Security:**
- Tokens encrypted at rest (AES-256-GCM)
- Automatic token refresh before expiry

---

### 9. `xero_syncs`

**Purpose:** Xero sync queue with retry logic.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `payment_link_id` | UUID | No | Foreign key → payment_links |
| `sync_type` | ENUM | No | INVOICE or PAYMENT |
| `status` | ENUM | No | PENDING, SUCCESS, FAILED, RETRYING |
| `xero_invoice_id` | VARCHAR(255) | Yes | Xero invoice ID |
| `xero_payment_id` | VARCHAR(255) | Yes | Xero payment ID |
| `request_payload` | JSONB | No | Full request sent to Xero |
| `response_payload` | JSONB | Yes | Full response from Xero |
| `error_message` | TEXT | Yes | Error details if failed |
| `retry_count` | INTEGER | No | Number of retry attempts (default: 0) |
| `next_retry_at` | TIMESTAMPTZ | Yes | Next scheduled retry time |
| `created_at` | TIMESTAMPTZ | No | Sync creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | Last update timestamp |

**Relationships:**
- Belongs to `payment_links` (CASCADE DELETE)

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `(status, next_retry_at)` -- for queue processing

**Retry Schedule:**
1. 1 minute
2. 5 minutes
3. 15 minutes
4. 1 hour
5. 6 hours
6. FAILED (no more retries)

---

### 10. `notifications`

**Purpose:** In-app and email notifications.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `organization_id` | UUID | No | Foreign key → organizations |
| `user_email` | VARCHAR(255) | Yes | Target user email |
| `type` | ENUM | No | NotificationType |
| `title` | VARCHAR(255) | No | Notification title |
| `message` | TEXT | No | Notification message |
| `data` | JSONB | Yes | Additional structured data |
| `read` | BOOLEAN | No | Read status (default: false) |
| `email_sent` | BOOLEAN | No | Email sent flag (default: false) |
| `email_sent_at` | TIMESTAMPTZ | Yes | Email sent timestamp |
| `created_at` | TIMESTAMPTZ | No | Creation timestamp |

**Relationships:**
- Belongs to `organizations` (CASCADE DELETE)
- Has many `email_logs`

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `(organization_id, created_at DESC)`
- INDEX on `(user_email, created_at DESC)`
- INDEX on `read`
- INDEX on `type`

**Notification Types:**
```
PAYMENT_CONFIRMED, PAYMENT_FAILED, PAYMENT_EXPIRED, 
XERO_SYNC_FAILED, RECONCILIATION_ISSUE, SECURITY_ALERT,
WEEKLY_SUMMARY, SYSTEM_ALERT
```

---

### 11. `email_logs`

**Purpose:** Email delivery tracking and bounce handling.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `notification_id` | UUID | Yes | Foreign key → notifications (nullable) |
| `to_email` | VARCHAR(255) | No | Recipient email |
| `from_email` | VARCHAR(255) | No | Sender email |
| `subject` | VARCHAR(500) | No | Email subject |
| `template_name` | VARCHAR(100) | No | Template used |
| `template_data` | JSONB | Yes | Template variables |
| `status` | ENUM | No | EmailStatus (default: PENDING) |
| `provider_id` | VARCHAR(255) | Yes | Resend message ID |
| `provider_response` | JSONB | Yes | Full provider response |
| `error_message` | TEXT | Yes | Error details if failed |
| `opened_at` | TIMESTAMPTZ | Yes | Email opened timestamp |
| `clicked_at` | TIMESTAMPTZ | Yes | Link clicked timestamp |
| `bounced_at` | TIMESTAMPTZ | Yes | Bounce timestamp |
| `created_at` | TIMESTAMPTZ | No | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | Last update timestamp |

**Relationships:**
- Belongs to `notifications` (SET NULL on delete)

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `(status, created_at DESC)`
- INDEX on `to_email`
- INDEX on `notification_id`

**Email Status:**
```
PENDING → SENT → DELIVERED → OPENED → CLICKED
                       ↓
                   BOUNCED / FAILED
```

---

### 12. `notification_preferences`

**Purpose:** User-specific notification preferences.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `organization_id` | UUID | No | Foreign key → organizations |
| `user_email` | VARCHAR(255) | No | User email |
| `payment_confirmed_email` | BOOLEAN | No | Default: true |
| `payment_failed_email` | BOOLEAN | No | Default: true |
| `xero_sync_failed_email` | BOOLEAN | No | Default: true |
| `reconciliation_issue_email` | BOOLEAN | No | Default: true |
| `weekly_summary_email` | BOOLEAN | No | Default: true |
| `security_alert_email` | BOOLEAN | No | Default: true |
| `payment_confirmed_inapp` | BOOLEAN | No | Default: true |
| `payment_failed_inapp` | BOOLEAN | No | Default: true |
| `xero_sync_failed_inapp` | BOOLEAN | No | Default: true |
| `created_at` | TIMESTAMPTZ | No | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | Last update timestamp |

**Relationships:**
- Belongs to `organizations` (CASCADE DELETE)

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `(organization_id, user_email)`
- INDEX on `(organization_id, user_email)`

---

### 13. `audit_logs`

**Purpose:** Comprehensive audit trail (append-only).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `organization_id` | UUID | Yes | Foreign key → organizations (nullable) |
| `user_id` | VARCHAR(255) | Yes | User identifier |
| `entity_type` | VARCHAR(100) | No | Entity type (e.g., PaymentLink) |
| `entity_id` | UUID | No | Entity ID |
| `action` | VARCHAR(50) | No | Action performed (CREATE, UPDATE, DELETE) |
| `old_values` | JSONB | Yes | State before change |
| `new_values` | JSONB | Yes | State after change |
| `ip_address` | VARCHAR(45) | Yes | Client IP address |
| `user_agent` | TEXT | Yes | Client user agent |
| `created_at` | TIMESTAMPTZ | No | Action timestamp |

**Relationships:**
- Belongs to `organizations` (nullable, for system actions)

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `(created_at DESC)`
- INDEX on `(entity_type, entity_id)`
- INDEX on `organization_id`
- INDEX on `user_id`

**Business Rules:**
- APPEND-ONLY table (no updates or deletes)
- Tracks all mutations to core entities
- Retains old/new state for compliance

---

## 🔤 Enums

### `FxSnapshotType`
```sql
CREATE TYPE FxSnapshotType AS ENUM ('CREATION', 'SETTLEMENT');
```

### `LedgerAccountType`
```sql
CREATE TYPE LedgerAccountType AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
```

### `LedgerEntryType`
```sql
CREATE TYPE LedgerEntryType AS ENUM ('DEBIT', 'CREDIT');
```

### `PaymentEventType`
```sql
CREATE TYPE PaymentEventType AS ENUM (
  'CREATED', 'OPENED', 'PAYMENT_INITIATED', 
  'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELED'
);
```

### `PaymentLinkStatus`
```sql
CREATE TYPE PaymentLinkStatus AS ENUM ('DRAFT', 'OPEN', 'PAID', 'EXPIRED', 'CANCELED');
```

### `PaymentMethod`
```sql
CREATE TYPE PaymentMethod AS ENUM ('STRIPE', 'HEDERA');
```

### `PaymentToken`
```sql
CREATE TYPE PaymentToken AS ENUM ('HBAR', 'USDC', 'USDT', 'AUDD');
```

### `XeroSyncStatus`
```sql
CREATE TYPE XeroSyncStatus AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');
```

### `XeroSyncType`
```sql
CREATE TYPE XeroSyncType AS ENUM ('INVOICE', 'PAYMENT');
```

### `NotificationType`
```sql
CREATE TYPE NotificationType AS ENUM (
  'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED',
  'XERO_SYNC_FAILED', 'RECONCILIATION_ISSUE', 'SECURITY_ALERT',
  'WEEKLY_SUMMARY', 'SYSTEM_ALERT'
);
```

### `EmailStatus`
```sql
CREATE TYPE EmailStatus AS ENUM (
  'PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED'
);
```

---

## 🔍 Indexes

### Performance-Critical Indexes

```sql
-- payment_links: Fast lookup by organization and status
CREATE INDEX idx_payment_links_org_status ON payment_links(organization_id, status);

-- payment_links: Unique short code lookup
CREATE UNIQUE INDEX idx_payment_links_short_code ON payment_links(short_code);

-- payment_events: Fast timeline retrieval
CREATE INDEX idx_payment_events_link_created ON payment_events(payment_link_id, created_at DESC);

-- xero_syncs: Queue processing
CREATE INDEX idx_xero_syncs_queue ON xero_syncs(status, next_retry_at);

-- audit_logs: Recent activity queries
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- notifications: User notifications
CREATE INDEX idx_notifications_org_created ON notifications(organization_id, created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications(user_email, created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- email_logs: Delivery tracking
CREATE INDEX idx_email_logs_status_created ON email_logs(status, created_at DESC);
CREATE INDEX idx_email_logs_to_email ON email_logs(to_email);
```

---

## 🔒 Constraints

### Foreign Key Constraints with Cascade

```sql
-- All organization-scoped tables CASCADE DELETE
ALTER TABLE merchant_settings ADD CONSTRAINT fk_org 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE payment_links ADD CONSTRAINT fk_org 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE ledger_accounts ADD CONSTRAINT fk_org 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Payment link children CASCADE DELETE
ALTER TABLE payment_events ADD CONSTRAINT fk_link 
  FOREIGN KEY (payment_link_id) REFERENCES payment_links(id) ON DELETE CASCADE;

ALTER TABLE fx_snapshots ADD CONSTRAINT fk_link 
  FOREIGN KEY (payment_link_id) REFERENCES payment_links(id) ON DELETE CASCADE;

ALTER TABLE ledger_entries ADD CONSTRAINT fk_link 
  FOREIGN KEY (payment_link_id) REFERENCES payment_links(id) ON DELETE CASCADE;

ALTER TABLE xero_syncs ADD CONSTRAINT fk_link 
  FOREIGN KEY (payment_link_id) REFERENCES payment_links(id) ON DELETE CASCADE;
```

### Unique Constraints

```sql
-- organizations: Unique external ID
ALTER TABLE organizations ADD CONSTRAINT uq_clerk_org_id UNIQUE (clerk_org_id);

-- payment_links: Unique short code
ALTER TABLE payment_links ADD CONSTRAINT uq_short_code UNIQUE (short_code);

-- ledger_accounts: Unique code per organization
ALTER TABLE ledger_accounts ADD CONSTRAINT uq_org_code UNIQUE (organization_id, code);

-- ledger_entries: Unique idempotency key
ALTER TABLE ledger_entries ADD CONSTRAINT uq_idempotency_key UNIQUE (idempotency_key);

-- xero_connections: One connection per organization
ALTER TABLE xero_connections ADD CONSTRAINT uq_org_connection UNIQUE (organization_id);

-- notification_preferences: One preference set per user per org
ALTER TABLE notification_preferences ADD CONSTRAINT uq_org_user 
  UNIQUE (organization_id, user_email);
```

---

## 📏 Data Types

### Common Patterns

- **UUIDs:** All primary keys (PostgreSQL UUID type)
- **Timestamps:** `TIMESTAMPTZ` (timezone-aware)
- **Currencies:** `CHAR(3)` (ISO 4217 codes)
- **Amounts:** 
  - Fiat: `DECIMAL(18,2)` (2 decimal places)
  - Crypto: `DECIMAL(18,8)` (8 decimal places)
- **Emails:** `VARCHAR(255)`
- **Descriptions:** `TEXT` (unlimited)
- **Metadata:** `JSONB` (binary JSON, indexed)

---

## 🔄 Migration Strategy

### Prisma Migrations

```bash
# Create a new migration
npm run db:migrate

# Deploy migrations to production
npm run db:migrate:deploy

# Reset database (dev only)
npm run db:reset

# Open Prisma Studio
npm run db:studio
```

### Migration Files Location
```
src/prisma/migrations/
  ├── 20241201_init/
  ├── 20241205_add_audd_token/
  ├── 20241210_add_notifications/
  └── ...migration.sql
```

### Best Practices
1. **Never delete migrations** - They are the source of truth
2. **Test migrations** on staging before production
3. **Backwards compatibility** - Always consider rollback scenarios
4. **Data migrations** - Use `prisma migrate dev --create-only` for data changes
5. **Index creation** - Use `CREATE INDEX CONCURRENTLY` for production (not in Prisma, use raw SQL)

---

## 🔮 Future Schema Enhancements

### Planned for Sprint 24+
- [ ] Add `refunds` table for refund tracking
- [ ] Add `disputes` table for payment disputes
- [ ] Add `webhooks_log` table for webhook audit trail
- [ ] Add `api_keys` table for merchant API access
- [ ] Add `rate_limits` table for per-merchant limits
- [ ] Implement table partitioning for `audit_logs` (by month)
- [ ] Add materialized views for reporting aggregates

---

## 📖 Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Local Development Setup](./LOCAL_DEV_SETUP.md)
- [API Documentation](./API_DOCUMENTATION.md)

---

**Database Version:** 1.0  
**Last Schema Change:** December 16, 2025  
**Maintained By:** Provvypay Engineering Team








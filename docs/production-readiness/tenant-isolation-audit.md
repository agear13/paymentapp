# Tenant Isolation & Authorization Audit — Provvypay

**Audit date:** 2026-05-20  
**Method:** Architecture review + targeted route sampling (~174 API routes). Full per-route penetration test **not** executed — items without direct verification marked **UNKNOWN**.

**Auth primitives:**

- `requireAuth` / `getCurrentUser` — session
- `getOrganizationForAuthenticatedUser` — primary org for user
- `hasOrganizationAccess`, `checkUserPermission` — membership + RBAC
- `checkBetaLockdown`, `checkAdminAuth` — launch/admin gates
- `assertProjectOwnedByUser` — project-scoped resources
- Webhooks — signature / `CRON_SECRET` / internal bearer

---

## Cross-Tenant Access Questions

| # | Question | Verdict | Evidence / Notes |
|---|----------|---------|------------------|
| 1 | Can merchant A access merchant B **general org data**? | **PASS** (typical routes) | `organizations/[id]` checks `user_organizations` membership |
| 2 | Can merchant A access merchant B **invoices / payment links**? | **PASS** (sampled) | Payment link routes filter by org or link ownership; public pay uses `shortCode` only |
| 3 | Can merchant A access merchant B **payments / ledger**? | **PARTIAL → FAIL** on debug | Ledger APIs use org + permissions; **xero/debug leaks cross-tenant** |
| 4 | Can merchant A access merchant B **agreements** (pilot deals)? | **UNKNOWN** | Pilot snapshot is **user-scoped** (`getPilotSnapshotForUser`); multi-user same org behavior unclear |
| 5 | Can merchant A access merchant B **allocations** (funding)? | **PASS** (sampled) | `assertProjectOwnedByUser` on funding-sources routes |
| 6 | Can merchant A access merchant B **uploaded files**? | **PASS** (expected) | Upload requires auth; public attachment via shortCode only for that link |
| 7 | Can merchant A access merchant B **reports**? | **PASS** (sampled) | Report APIs tied to authenticated org context |
| 8 | Are **all** queries organization-scoped? | **FAIL** | Known exceptions below |

---

## FAIL Findings

### F-01: Xero debug endpoint returns global data

| Field | Value |
|-------|-------|
| Route | `GET /api/xero/debug` |
| File | `src/app/api/xero/debug/route.ts` |
| Issue | Any authenticated user can read **last 50 `xero_syncs` globally** and **last 50 PAID payment_links globally**, including other orgs' `organization_id` |
| Verdict | **FAIL** |
| Risk | **CRITICAL** — cross-tenant payment link metadata exposure |
| Remediation | Delete route, or restrict to `checkAdminAuth` + filter `where: { payment_links: { organization_id: org.id } }` |

### F-02: Payout batch create accepts `organizationId` in body

| Field | Value |
|-------|-------|
| Route | `POST /api/payout-batches/create` |
| File | `src/app/api/payout-batches/create/route.ts` |
| Issue | Client supplies `organizationId`; authorization is `checkUserPermission(user.id, organizationId, 'manage_ledger')` — **PASS if permission check is reliable** |
| Verdict | **PASS** (with caveat) | If permission matrix bug exists, cross-org batch creation possible |
| Remediation | Also assert `organizationId === (await getOrganizationForAuthenticatedUser(user.id))?.id` unless multi-org UX is intentional |

### F-03: Deal network pilot snapshot — user scope vs org scope

| Field | Value |
|-------|-------|
| Routes | `/api/deal-network-pilot/snapshot`, obligations |
| Issue | Data keyed to **user id** in pilot layer; two users in same org may see different deal sets |
| Verdict | **UNKNOWN** (product) / **FAIL** (strict multi-tenant) | For true B2B org tenancy, all org members should share pilot project graph |
| Remediation | Add `organization_id` to pilot deals and filter all queries by org membership |

### F-04: Middleware admin gating is UX-only

| Field | Value |
|-------|-------|
| File | `src/middleware.ts` (documented) |
| Issue | JWT email extraction for beta paths is **not** authorization |
| Verdict | **PASS** if APIs enforce; **FAIL** if any API trusts middleware alone |
| Remediation | Automated test: restricted path APIs return 403 for non-admin |

---

## PASS Findings (Sampled)

| Route / Area | Controls |
|--------------|----------|
| `GET /api/organizations/[id]` | Membership check before read/update |
| `GET /api/commissions/attribution-earnings` | `requireAuth` + org + `view_payment_links` |
| `GET /api/projects/.../funding-sources` | `requireAuth` + `assertProjectOwnedByUser` |
| `POST /api/stripe/webhook` | Signature verification + `webhook_events` dedupe |
| `GET /api/internal/system-integrity` | `CRON_SECRET` or `checkAdminAuth` |
| `GET /api/admin/commission-propagation-trace` | Admin auth |
| `GET /api/public/pay/[shortCode]` | Public by design; no auth; scoped to short code |
| `POST /api/test/refund-atomicity` | **403 in production** |

---

## UNKNOWN (Requires Full Route Matrix Test)

The following categories were **not** exhaustively verified route-by-route:

- All **Huntpay** admin/conversion routes
- All **referral** public conversion approve/mark-paid paths
- **Hedera** transaction lookup by ID
- **Copilot** session/tools
- **GDPR** export/delete scope
- **v2/payment-links** parity with v1 authorization
- **Metrics** `/api/metrics` — admin gating assumed from `SECURITY_AND_SCALE.md`

**Recommendation:** Generate automated auth matrix test: for each `route.ts`, assert 401 without session and 403 when accessing other org fixture IDs.

---

## Webhook & Job Authorization

| Endpoint | Auth mechanism | Verdict |
|----------|----------------|---------|
| `/api/stripe/webhook` | Stripe signature | **PASS** |
| `/api/webhooks/wise` | `WISE_WEBHOOK_SECRET` | **PASS** (if secret set in prod) |
| `/api/webhooks/resend` | Svix secret; fail-closed in prod if missing | **PASS** |
| `/api/jobs/*` | `X-Cron-Secret` / `CRON_SECRET` | **PASS** (503 if secret unset) |
| `/api/internal/webhooks/stripe/replay` | Internal token (hardened per SECURITY_AND_SCALE) | **PASS** (verify token rotation) |

---

## Role & Permission Enforcement

Permissions defined in `checkUserPermission` — used on financial surfaces (`manage_ledger`, `view_payment_links`, etc.).

| Concern | Status |
|---------|--------|
| OWNER/ADMIN for org PATCH | **PASS** |
| Beta settlement features | Gated by `BETA_LOCKDOWN_MODE` + beta admin email list |
| Attribution view | Decoupled: `canViewAttributionCommissions` + `view_payment_links` |
| Platform preview / partners UI | Middleware prefix restriction + server checks required |

---

## Storage Isolation

| Store | Isolation |
|-------|-----------|
| R2 | Keys should include org/link id — **UNKNOWN** without key naming audit |
| Legacy Supabase storage | Service role server-side — path must not be guessable cross-tenant |
| Public pay attachment API | Must validate link ownership via shortCode — **PASS** if implementation matches payment link lookup |

---

## Remediation Priority (Tenant)

1. **P0:** Remove or fix `/api/xero/debug` (CRITICAL).
2. **P0:** Auth matrix CI for all `/api/**/route.ts`.
3. **P1:** Align deal network pilot to `organization_id` scoping.
4. **P1:** Bind payout batch `organizationId` to session org unless multi-org is product-intentional.
5. **P2:** R2 key prefix audit + attachment access logs.

---

## Summary Table

| Verdict | Count (sampled audit) |
|---------|---------------------|
| PASS | Majority of financial/dashboard APIs (pattern-based) |
| FAIL | 1 confirmed (xero/debug); 1 model (pilot org scope) |
| UNKNOWN | Huntpay, full API matrix, storage keys |

**Launch recommendation:** Do **not** treat tenant isolation as certified until F-01 is fixed and auth matrix tests exist.

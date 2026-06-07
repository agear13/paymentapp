# Terminology Migration Map

**Phase 5 — Agreement Intelligence Platform**  
Complete mapping from legacy/competing terms to canonical language.  
**Scope:** User-facing copy only unless marked [internal].

---

## Primary Object

| From | To | Context | Phase 5 status |
|---|---|---|---|
| Project | **Agreement** | Nav, headers, empty states, dialogs, breadcrumbs, toasts | ✅ Applied |
| Deal | **Agreement** | Deal network UI, pilot modals | ✅ Applied (operator UI) |
| Commercial arrangement | **Agreement** | Descriptive copy | ✅ Applied |
| Settlement workflow | **Agreement** (workflow is part of agreement) | Onboarding, settings | ✅ Applied |
| Revenue share (as object) | **Agreement** (type: Revenue share) | Program descriptions | Documented |
| Affiliate program | **Agreement** (type: Affiliate) | Referral UI | Documented |
| Referral program | **Agreement** (type: Referral) | Referral UI | Documented |
| Event settlement | **Agreement** (type: Event) | Templates | Documented |

---

## People

| From | To | Context | Phase 5 status |
|---|---|---|---|
| Payee | **Participant** | Placeholders, forms | ✅ Applied |
| Recipient | **Client** or **Payer contact** | Invoice resend copy | ✅ Applied |
| Revenue recipient | **Participant** | Settings, earnings | ✅ Applied |
| Partner (generic) | **Participant** or role label | When meaning agreement party | Partial — partner retained for referral admin routes |
| Consultant / Advocate / BD | **Participant** | Legacy programs page | Documented — future phase |
| Operator payout confirmation | **Settlement confirmation** | Design language | ✅ Applied |

---

## Money Out (Settlement)

| From | To | Context | Phase 5 status |
|---|---|---|---|
| Payout (nav section) | **Settlement** | Sidebar, hub titles | ✅ Applied |
| Payout release | **Settlement release** | Nav, empty states | ✅ Applied |
| Release batch | **Settlement batch** | CTAs, toasts | ✅ Applied |
| Payout queue | **Settlement queue** | Dashboard widgets | ✅ Applied |
| Payout coordination | **Settlement coordination** | Agreement detail, hubs | ✅ Applied |
| Payout readiness | **Settlement readiness** | Widgets, phases | ✅ Applied |
| Safe to release | **Settlement ready** | Hero, design-language | ✅ Applied |
| Release not ready | **Settlement not ready** | Blocked states | ✅ Applied |
| Payout obligation | **Obligation** | Empty states (when section is obligations) | ✅ Applied |
| Disbursement | **Settlement** | Agreement payout tab | ✅ Applied |
| Payout lines | **Obligation lines** | Obligations table section | Documented |
| Mark payout as paid | **Settlement completed** | Success toasts | ✅ Applied |

---

## Money In (Funding)

| From | To | Context | Phase 5 status |
|---|---|---|---|
| Payments (nav section) | **Funding** | Sidebar hub | ✅ Applied |
| Transactions (nav) | **Funding activity** | Nav, breadcrumbs | ✅ Applied |
| Payment activity | **Funding activity** | Hub descriptions | ✅ Applied |
| Recent transactions | **Recent settlement activity** | Activity sections (where settlement-focused) | ✅ Applied |
| Payment status | **Settlement readiness** | Widgets (where readiness) | ✅ Applied |
| No transactions yet | **No funding activity yet** | Empty states | ✅ Applied |
| Payment Confirmed (notification pref) | **Funding confirmed** | Preferences UI | ✅ Applied |
| Customer payment | **Funding** or **Revenue received** | Operator explanatory copy | Partial |

**Keep as-is (appropriate):**

| Term | Context |
|---|---|
| Invoice | Customer-facing collection instrument |
| Payment | Payer checkout flows, rail errors |
| Transaction | Ledger, exports, accounting |

---

## Collection / Infrastructure

| From | To | Context | Phase 5 status |
|---|---|---|---|
| Payment Platform | **Agreement Intelligence Platform** | Sidebar subtitle | ✅ Applied |
| Payment setup | **Settlement infrastructure** | Onboarding (already) | — |
| Payment configuration | **Collection & settlement infrastructure** | Guardrails, settings | ✅ Applied |
| Payment link (operator UI) | **Invoice** | Tables, dialogs, toasts, empty states | ✅ Applied |
| Create Payment Link | **Create invoice** | CTAs, EmptyState | ✅ Applied |
| Cancel Payment Link | **Cancel invoice** | Dialogs | ✅ Applied |
| Connected payment methods | **Collection & settlement infrastructure** | Reports strip | ✅ Applied |

**Keep as-is:** Payment link [internal], `payment_links` table, API routes.

---

## Workspace & Navigation

| From | To | Context | Phase 5 status |
|---|---|---|---|
| Home | **Dashboard** | Nav, breadcrumbs | ✅ Applied |
| Projects | **Agreements** | Nav, breadcrumbs | ✅ Applied |
| Reports | **Reporting** | Nav | ✅ Applied |
| Payouts | **Settlement** | Nav | ✅ Applied |
| Participant earnings | **Earnings & readiness** | Settlement sub-nav | ✅ Applied |
| All projects | **All agreements** | Filters, links | ✅ Applied |
| Project overview | **Agreement overview** | Context header | ✅ Applied |
| Project coordination | **Agreement coordination** | Context header | ✅ Applied |
| Project sections | **Agreement sections** | Tab nav aria-label | ✅ Applied |
| Commercial roles (tab) | **Commercial terms** | Agreement tabs | ✅ Applied |
| Payouts (tab) | **Settlement readiness** | Agreement tabs | ✅ Applied |
| Funding sources (tab) | **Funding** | Agreement tabs | ✅ Applied |

---

## Empty States

| From | To | File area |
|---|---|---|
| No payment links yet | No invoices yet | `EmptyState.tsx` |
| Create your first payment link… | Create your first invoice to fund agreement obligations | `EmptyState.tsx` |
| No transactions yet | No funding activity yet | `EmptyState.tsx` |
| Create your first project | Create your first agreement | `projects-workspace-index.tsx` |
| No payout obligations in this project yet | No obligations in this agreement yet | `design-language.ts` |
| No payout releases yet | No settlement releases yet | `design-language.ts` |
| Review payout readiness | Review settlement readiness | `design-language.ts` |
| No payments have been received yet | No coordinated funding yet | Reports cards |
| No invoices found. Create your first invoice… | No invoices yet. Create one to fund an agreement | Tables |

---

## Success Messages

| From | To | Context |
|---|---|---|
| Project created | **Agreement created** | Toasts |
| Project updated | **Agreement updated** | Toasts |
| Project created from conversation | **Agreement created from conversation** | AI extractor |
| Could not save project | **Could not save agreement** | Error toasts |
| Release batch created | **Settlement batch created** | Payouts workspace |
| Participant released | **Settlement initiated** | Release button |

---

## Dialog & Form Labels

| From | To | Context |
|---|---|---|
| Create project | **Create agreement** | Modals, buttons |
| Edit project | **Edit agreement** | Modals |
| Project Name | **Agreement name** | Forms |
| Create project manually | **Create agreement manually** | Empty state CTA |
| Loading projects… | **Loading agreements…** | Index page |
| Project not found | **Agreement not found** | Shell, views |
| Untitled project | **Untitled agreement** | Display name fallback |

---

## Dashboard & Phases

| From | To | Source |
|---|---|---|
| Workspace coordination | **Agreement coordination** | Home hero |
| Coordinating payouts | **Coordinating obligations** | Workspace phase |
| Preparing payout release | **Preparing settlement** | Workspace phase |
| Setting up project | **Setting up agreement** | Agreement phase |
| Payout obligations pending | **Obligations pending** | Agreement phase |
| Payouts can be coordinated safely… | **Settlement can proceed safely…** | Confidence headlines |
| Finish setup before releasing payouts | **Finish setup before settlement** | Confidence headlines |
| Payment distribution | **Funding by collection method** | Reports widget |

---

## Reporting

| From | To | Notes |
|---|---|---|
| Reports (nav) | **Reporting** | Label only |
| Payout obligations (export) | **Obligations** | Export label |
| Settlement report | Keep | Already canonical |

---

## Intentionally Unchanged

| Term | Reason |
|---|---|
| Invoice | Customer collection instrument — correct layer |
| Payment / Payment Successful | Payer-facing checkout |
| Transaction | Ledger and accounting exports |
| Ledger / Reconciliation | Finance operator vocabulary |
| Stripe / Wise / Hedera | Rail names |
| Commission | Attribution-specific admin routes (narrow scope) |
| projectId, dealId [internal] | No schema change in Phase 5 |
| /dashboard/projects [route] | No route change in Phase 5 |

---

## Migration Priority

1. **P0 — Category clarity:** Agreement replaces Project/Deal in all operator creation flows  
2. **P1 — Navigation:** Sidebar, breadcrumbs, hub titles  
3. **P2 — Settlement language:** Payouts → Settlement in nav and readiness widgets  
4. **P3 — Funding language:** Transactions → Funding activity; payment link → invoice  
5. **P4 — Legacy surfaces:** Programs/partners admin copy, email templates (future)

---

*Cross-reference: [CANONICAL_DOMAIN_MODEL.md](./CANONICAL_DOMAIN_MODEL.md), [AGREEMENT_INTELLIGENCE_BRIEFING_SPEC.md](./AGREEMENT_INTELLIGENCE_BRIEFING_SPEC.md), [AGREEMENT_INTELLIGENCE_PLATFORM_AUDIT.md](./AGREEMENT_INTELLIGENCE_PLATFORM_AUDIT.md)*

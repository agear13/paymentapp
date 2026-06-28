# Provvypay Production Release Readiness QA Matrix

Status: Not Tested  
Scope: operator-facing workflows across authentication, onboarding, agreements, participants, funding, payment links, payouts, accounting, referrals, reporting, admin operations, and Agreement Analyzer.  
Source: read-only route/API/component/test audit. No runtime workflows were executed while producing this document.

## Release Readiness Score

**Estimated readiness: 62%**

Rationale:

- Strong unit and integration coverage exists for commercial lifecycle, supplier onboarding, accounting profiles, payment status policy, settlement integrity, Xero OAuth state, referral attribution, Agreement Analyzer, security guards, and refund webhook handling.
- Authenticated end-to-end coverage is thin. Most Playwright coverage validates auth gates, shell rendering, and public/payment guardrails rather than full production happy paths.
- Several critical workflows depend on shared pilot APIs and targeted mutations that need browser-level validation with real session/database state.
- Xero, Stripe, Wise, Hedera, Resend, and storage flows require sandbox/manual verification before production.

## Master QA Matrix

| Feature Area | User Story | Entry Route | Button / Action | API(s) Called | Database Tables Affected | External Integrations | Expected State Transition | Expected UI Changes | Success Criteria | Failure Scenarios | Recovery / Retry Behaviour | Automated Test Coverage | Manual QA Required | Production Risk | QA Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Authentication | Operator signs up or logs in | `/auth/login` | Sign in / Sign up | `/api/auth/login`, `/api/auth/signup`, `/api/auth/confirm-login` | users/session/audit tables | Clerk/Supabase auth, email as configured | Anonymous -> authenticated dashboard session | Dashboard shell loads; invalid credentials show error | Valid user reaches `/dashboard`; session persists on refresh | Wrong password, unverified email, suspicious login, expired session | Retry login; resend verification; confirm login | Partial | Yes | Critical | Not Tested |
| Authentication | Operator resets password | `/auth/reset-password` | Send reset / Update password | `/api/auth/reset-password` | auth user/session state | Auth email provider | Password reset requested -> completed | Success/error state shown | User can log in with new password | Invalid token, expired token, weak password | Request new reset link | Partial | Yes | High | Not Tested |
| Authentication | Operator verifies email | `/auth/verify-email` | Resend verification / Change email | `/api/auth/resend-verification`, `/api/auth/change-email` | auth user profile/audit | Email provider | Unverified -> verification email sent or email changed | Toast/message confirms action | Email link arrives; changed email persisted | Rate limit, invalid email, provider failure | Retry resend/change email | Partial | Yes | High | Not Tested |
| Workspace Onboarding | Operator bootstraps workspace | `/onboarding` | Continue / Complete setup | `/api/onboarding/bootstrap-workspace`, `/api/onboarding`, `/api/onboarding/analytics` | organizations, merchant_settings, onboarding state | Analytics | Draft onboarding -> workspace created | Next onboarding step unlocks | Org/workspace exists and dashboard can load | Missing org, validation failure, partial mutation | Resume onboarding; mutation resilience should preserve progress | Partial | Yes | Critical | Not Tested |
| Workspace Onboarding | Operator creates first project during onboarding | `/onboarding` | Create project / Import agreement | `/api/onboarding/bootstrap-project`, `/api/onboarding/participants`, `/api/ai-extractor/extract` | deal_network_pilot_deals, deal_network_pilot_participants, onboarding state | Anthropic for extraction | No project -> project + participants seeded | Agreement appears in `/dashboard/projects` | Project and participants persist after refresh | AI extraction failure, duplicate participants, snapshot sync failure | Retry import; manual project creation fallback | Partial | Yes | Critical | Not Tested |
| Billing | Operator selects/changes plan | `/dashboard/settings/billing`, onboarding | Upgrade / Manage subscription | `/api/billing/create-checkout-session`, `/api/billing/create-portal-session`, `/api/onboarding/complete-after-billing` | organizations/subscription, entitlement state | Stripe Checkout, Stripe Portal | Free/trial -> selected plan / active subscription | Redirect to Stripe; entitlement UI updates after return | Plan shown correctly and gated features update | Checkout cancelled, webhook delay, entitlement mismatch | Retry checkout; refresh billing summary | Partial | Yes | High | Not Tested |
| Project Creation | Operator creates an agreement/project | `/dashboard/projects` | Create agreement | `/api/deal-network-pilot/snapshot` with `workspace_import_replace` | deal_network_pilot_deals, deal_network_pilot_participants | None | No project/list -> new project persisted | New project card appears; route opens project | Project persists after reload and has correct summary | Snapshot rejected, duplicate ID, stale local data | Retry creation; refresh project list | Partial | Yes | Critical | Not Tested |
| Project Creation | Operator creates project from conversation | `/dashboard/projects`, `/dashboard/projects/[projectId]/participants` | Create from conversation / Save extraction | `/api/ai-extractor/extract`, `/api/deal-network-pilot/snapshot`, `/api/deal-network-pilot/obligations/refresh` | deal_network_pilot_deals, participants, obligations | Anthropic | Conversation -> project/participants/obligations | Review modal saves; project/participants visible | Extracted parties/compensation persist and obligations refresh | Extraction failure, duplicate parties, stale full snapshot risk | Retry extraction; manual review/edit before save | Partial | Yes | High | Not Tested |
| Project Editing | Operator edits project metadata | `/dashboard/projects`, legacy pilot surfaces | Save changes | Existing project modal/snapshot paths | deal_network_pilot_deals | None | Existing project metadata updated | Project card/header updates | Changes persist after reload | Frozen Rabbit Hole path may be local-only; snapshot restrictions | Use new Projects path where available; refresh | No | Yes | High | Not Tested |
| Commercial Roles | Operator adds planned role | `/dashboard/projects/[projectId]/commercial-roles` | Add commercial role | `PATCH /api/deal-network-pilot/deals/[dealId]/commercial-roles` | deal_network_pilot_deals.deal_payload | None | No role -> planned commercial role | Role appears with planned badge | Role persists after refresh and does not alter participants | Project not found, stale role list overwrite | Refresh and retry | Yes | Yes | Medium | Not Tested |
| Commercial Roles | Operator assigns participant to role | `/dashboard/projects/[projectId]/commercial-roles` | Assign / Save assignment | Same PATCH endpoint | deal_network_pilot_deals.deal_payload | None | Role PLANNED -> ASSIGNED | Participant name appears in role row | Assignment persists and agreement workflow unchanged | Missing participant, concurrent role edit | Refresh roles and retry | Yes | Yes | Medium | Not Tested |
| Participant Management | Operator adds participant | `/dashboard/projects/[projectId]/participants` | Add team member | `POST /api/deal-network-pilot/participants` | deal_network_pilot_participants | None | No row -> participant DRAFT | Participant row/card appears; CTA Configure Earnings | New participant persists after reload | Duplicate ID, project not found, optimistic add rollback | Error toast; row removed or refreshed | Partial | Yes | Critical | Not Tested |
| Participant Management | Operator edits participant details | `/dashboard/projects/[projectId]/participants` | Edit participant / Save | `PATCH /api/deal-network-pilot/participants/[participantId]` | deal_network_pilot_participants.participant_payload | None | Participant details updated, lifecycle unchanged unless relevant fields | Name/email/role update everywhere | Only target participant changes | Invalid email, concurrent update, stale UI | Refresh participant list and retry | Partial | Yes | High | Not Tested |
| Participant Management | Operator removes participant | `/dashboard/projects/[projectId]/participants` | Remove participant | Current UI/state path; verify actual endpoint before release | deal_network_pilot_participants or local state depending surface | None | Participant removed from project | Row disappears; KPIs update | Removal persists after reload | Local-only removal, orphan obligations | Refresh; verify DB row removed | No | Yes | High | Not Tested |
| Participant Earnings | Operator configures fixed/revenue/referral earnings | `/dashboard/projects/[projectId]/participants` | Configure Earnings / Save | `PATCH /api/deal-network-pilot/participants/[participantId]` | deal_network_pilot_participants, obligations via refresh/sync | None | DRAFT -> EARNINGS_CONFIGURED | CTA becomes Send Agreement; obligations can generate | Compensation persists and workflow advances once | Invalid amounts, missing role, stale compensation profile | Dialog validation; retry after refresh | Yes | Yes | Critical | Not Tested |
| Agreement Generation | Operator prepares agreement after earnings | `/dashboard/projects/[projectId]/participants` | Send Agreement | `PATCH /api/deal-network-pilot/participants/[participantId]` | deal_network_pilot_participants.participant_payload | Email client/mailto optional | EARNINGS_CONFIGURED -> AGREEMENT_SENT/SHARED | Badge Waiting for Acceptance; share dialog shown | Shared timestamps and URL persist | Approval workflows entitlement missing, link missing | Upgrade prompt; regenerate/share again | Partial | Yes | Critical | Not Tested |
| Agreement Sharing | Operator shares agreement through copy/email/WhatsApp/QR/native | `/dashboard/projects/[projectId]/participants` | Copy / Email / WhatsApp / QR / Native share | Same participant PATCH; `/api/qr?data=` for QR | participant_payload share fields | Mail client, WhatsApp, Web Share, QR | Agreement share recorded exactly once | All surfaces show Waiting for Acceptance | Every share mechanism persists shared lifecycle | Browser API unavailable, clipboard failure, QR failure | Fallback copy/email; retry share | Partial | Yes | High | Not Tested |
| Agreement Approval | Participant accepts shared agreement | `/deal-invites/[token]` or project agreement panel | Approve Agreement | `POST /api/deal-network-pilot/invites/[token]/approve` | deal_network_pilot_participants, participant payload, draft invoice fields | Referral issuance where applicable | AGREEMENT_SENT -> AGREEMENT_ACCEPTED | Operator sees Request Payout Details | Approval persists; no regression to Configure Earnings | Invalid/expired token, already approved, missing draft invoice | Reopen link; operator resend/share | Yes | Yes | Critical | Not Tested |
| Supplier Onboarding Request | Operator requests payout details | `/dashboard/projects/[projectId]/participants` | Request Payout Details | `POST /api/deal-network-pilot/participants/[participantId]/payment-request/generate` | payment setup token storage, participant_payload | Resend email optional | AGREEMENT_ACCEPTED -> PAYMENT_INFO_PENDING | CTA Waiting for Participant; portal link shown | Token works; email sends when requested | Participant not approved, email missing, token generation failure | Copy link manually; retry generate | Partial | Yes | Critical | Not Tested |
| Supplier Onboarding | Supplier submits payment/tax details | `/payment-setup/[token]`, dashboard onboard page | Submit payment setup | `POST /api/payment-setup/[token]/upload`, `POST /api/payment-setup/[token]/submit`, or `POST /api/deal-network-pilot/participants/[id]/supplier-onboarding` | payment setup tables, participant_payload.supplierOnboarding | File upload/storage if documents | PAYMENT_INFO_PENDING -> PAYMENT_INFO_SUBMITTED/OPERATOR_REVIEW | Operator sees Verify Payout Details | Bank/ABN/GST data visible in review | Invalid token, upload failure, incomplete declaration | Resume link; resend token | Partial | Yes | Critical | Not Tested |
| Supplier Verification | Operator approves supplier details | `/dashboard/projects/[projectId]/participants/[participantId]/review` | Verify / Approve | `POST /api/deal-network-pilot/participants/[id]/supplier-onboarding/approve` | participant_payload supplierOnboarding, audit/events | Notification dispatch | SUBMITTED -> APPROVED, payoutVerificationConfirmed true | CTA moves toward Xero export | Approval metadata stored; review checks pass/warn | Missing submission, validation warning, unauthorized | Request changes/reject; retry approve | Yes | Yes | Critical | Not Tested |
| Supplier Verification | Operator rejects or requests changes | Review page | Reject / Request changes | `POST .../reject`, `POST .../request-changes` | participant_payload supplierOnboarding, payment setup token | Resend email | SUBMITTED -> REJECTED or IN_PROGRESS | Supplier action required shown | New token sent and old approval revoked | Email failure, missing reason, repeated rejection | Resend link; retry request changes | Partial | Yes | High | Not Tested |
| Supplier Bill Export | Operator pushes supplier bill to Xero | Review page, funding accounting section | Push Supplier Bill to Xero | `POST /api/deal-network-pilot/participants/[id]/xero-export` | participant_payload xero fields, supplier onboarding events, xero sync data | Xero API, notification | APPROVED -> XERO_INVOICE / SETTLEMENT_READY | Exported badge; Ready for Settlement | Xero bill/contact IDs stored; no duplicate export | Xero disconnected, duplicate export, no draft invoice, 502 from Xero | Reconnect Xero; retry once idempotency confirmed | Partial | Yes | Critical | Not Tested |
| Obligations | Operator views obligation lines | `/dashboard/projects/[projectId]/obligations`, `/dashboard/payouts/obligations` | Refresh / filters | `GET /api/deal-network-pilot/obligations`, `POST /api/deal-network-pilot/obligations/refresh` where exposed | deal_network_pilot_obligations or derived obligation tables | None | Earnings/funding -> obligation statuses update | Rows show funded/ready/paid labels | Amounts match compensation and funding | Missing rows, stale derived rows, status mapping mismatch | Manual refresh; rebuild obligations | Partial | Yes | High | Not Tested |
| Funding | Operator adds forecast/manual funding source | `/dashboard/projects/[projectId]/funding` | Add funding source | `POST /api/projects/[projectId]/funding-sources` | project_funding_sources, audit/sync | None | No source -> forecast/source row | Treasury summary updates | Source persists and affects funding summary | Invalid amount/date/currency | Edit/delete and recreate | Partial | Yes | High | Not Tested |
| Funding | Operator edits/removes funding source | Funding tab | Save / Delete | `PATCH` or `DELETE /api/projects/[projectId]/funding-sources/[sourceId]` | project_funding_sources | None | Source updated/removed | Summary recalculates | Forecast/funding totals correct after refresh | Stale source, unauthorized, linked event mismatch | Refresh and retry | Partial | Yes | Medium | Not Tested |
| Funding | Operator links invoice to project | Funding tab / payment links | Link invoice / Create payment request | `/dashboard/payment-links?action=create&projectId=...`, `POST /api/deal-network-pilot/deals/[dealId]/attach-invoice` where wired | payment_links.pilot_deal_id, payment_events | Stripe/Wise/Hedera depending invoice | Invoice becomes project funding evidence | Funding moves toward ready | Payment events have project ID and obligations fund | Known gap: projectId may not become pilotDealId from Payment Links page | Use attach invoice path; manual DB verification | No | Yes | Critical | Not Tested |
| Payment Links | Operator creates invoice/payment link | `/dashboard/payment-links` | Create Payment Link | `POST /api/payment-links`, optional `POST /api/payment-links/upload-attachment` | payment_links, payment_events, attachments | Storage, Wise context optional | Draft/open link created | Link appears in table and success panel | Public URL works; values/currency correct | Validation error, upload failure, org missing | Retry create; remove attachment | Partial | Yes | Critical | Not Tested |
| Payment Links | Operator edits invoice | Payment links table/detail | Edit / Save | `PATCH /api/payment-links/[id]` | payment_links | None | Editable link fields changed | Table/detail update | Paid/settled links protected from invalid edits | Link expired/paid/cancelled, validation failure | Duplicate/create new link | Yes | Yes | High | Not Tested |
| Payment Links | Operator sends/resends invoice | Payment links table/detail | Send / Resend | `POST /api/payment-links/[id]/send`, `POST /api/payment-links/[id]/resend` | payment_links send metadata, email events if stored | Resend | Email queued/sent | Toast success; recipient history updated | Customer receives correct URL | Invalid email, email provider failure | Copy link manually; retry send | Partial | Yes | High | Not Tested |
| Payment Links | Operator cancels/deletes invoice | Payment links table | Cancel / Delete | `DELETE /api/payment-links/[id]`, `POST /api/payment-links/[id]/delete` | payment_links, attachment metadata | Storage delete for attachments | Open -> CANCELED or deleted | Row status changes or disappears | Public link unusable; paid links not wrongly deleted | Already paid, CSRF/auth failure, storage delete failure | Refresh; use cancel instead of delete | Partial | Yes | High | Not Tested |
| Stripe Payments | Customer pays card invoice | Public payment page | Customer checkout/pay | Stripe payment intent/checkout APIs, `POST /api/stripe/webhook` | payment_links, payment_events, ledger_entries, xero_syncs | Stripe, Xero queue | OPEN -> PAID; PAYMENT_CONFIRMED event | Operator table shows paid; funding/obligations update | Ledger entries balanced; no duplicate events | Webhook retry, duplicate event, failed card, FX mismatch | Stripe retry/idempotency; reconciliation job | Partial | Yes | Critical | Not Tested |
| Wise Payments | Customer pays via Wise/manual bank rail | Public payment page / operator settings | Customer instructions / operator review | Wise-related public routes, manual confirmation review | payment_links, payment_events, merchant_settings | Wise | Pending -> review/paid based on confirmation | Manual bank panel shows submission | Valid proof can be marked valid and settle | Wrong Wise profile, unsupported currency, stale status | Flag investigate; retry sync | Partial | Yes | High | Not Tested |
| Hedera Payments | Customer/operator uses Hedera payment rail | Public payment / payout settlement | Confirm payment / Execute Hedera payout | Hedera verify/monitor routes, payout batch Hedera prepare/confirm | payment_events, payout_batches, payouts, ledger_entries | Hedera wallet/mirror node | Pending -> paid or payout batch -> paid | Transaction hash/status visible | Mirror verification confirms amount/account | Wallet failure, mirror lag, wrong amount | Retry monitor/confirm after delay | Partial | Yes | High | Not Tested |
| Manual Payment Confirmation | Operator reviews manual bank proof | `/dashboard/payment-links` | Acknowledge / Flag / Mark valid | `POST /api/payment-links/manual-bank-confirmations/[id]/review` | manual confirmations, payment_links, payment_events, ledger_entries | None/Xero queue on valid | Submitted -> acknowledged/review/paid | Pending panel row updates/disappears | Mark valid settles link and creates ledger evidence | Fraudulent proof, duplicate mark, CSRF | Flag investigate; refresh and retry | Yes | Yes | High | Not Tested |
| Crypto Confirmation | Operator reviews crypto proof | `/dashboard/payment-links` | Acknowledge / Flag / Mark valid | `POST /api/payment-links/crypto-confirmations/[id]/review` | crypto confirmations, payment_links, payment_events, ledger_entries | Crypto explorer/Hedera where applicable | Submitted -> acknowledged/review/paid | Pending crypto panel updates | Mark valid settles via assisted review | Wrong tx hash, unsupported network, duplicate | Verify explorer; flag investigate | Yes | Yes | High | Not Tested |
| Refunds | Stripe refund webhook processes reversal | Webhook-only, no operator UI | Processor refund event | `POST /api/stripe/webhook` | payment_events, ledger_entries, payment_links | Stripe | Paid -> partially/fully refunded; REFUND_CONFIRMED | Dashboard reflects refunded state where surfaced | Refund idempotent by refund ID; ledger reversed | charge.refunded duplicate, non-succeeded refund, missing PI | Stripe webhook retry; reconciliation | Yes | Yes | Critical | Not Tested |
| Settlement | Operator creates release batch | `/dashboard/payouts/settlements`, participant release button | Create release batch / Release Settlement | `POST /api/payout-batches/create` | payout_batches, payouts, obligation links | None | Eligible obligations -> batch/payouts created | Batch appears; participant may move toward Paid | Only eligible funded/approved payouts included | Ineligible obligations, missing org, beta gate | Resolve blockers; retry create | Partial | Yes | Critical | Not Tested |
| Payout Release | Operator submits payout batch | `/dashboard/payouts/settlements/[id]` | Submit batch | `POST /api/payout-batches/[id]/submit` | payout_batches, payouts | None | DRAFT -> SUBMITTED | Batch status updates, actions change | Batch locked/submitted without duplicate payouts | Already submitted, empty batch, permission gate | Refresh; create new batch if needed | Partial | Yes | High | Not Tested |
| Payout Release | Operator marks payout paid/failed | Settlement detail | Mark paid / Mark failed | `POST /api/payouts/[id]/mark-paid`, `POST /api/payouts/[id]/mark-failed` | payouts, obligation lines/items, participant payload where linked | None/manual external transfer | Pending -> PAID or FAILED | Row badge updates; totals recalc | Paid evidence/external ref stored | Missing ref/reason, already paid, partial DB update | Retry after refresh; mark failed if transfer failed | Partial | Yes | Critical | Not Tested |
| Payout Release | Operator executes Hedera batch | Settlement detail | Execute Hedera / Sign / Confirm | `POST /api/payout-batches/[id]/hedera/prepare`, `POST /api/payout-batches/[id]/hedera/confirm` | payout_batches, payouts, payment_events/ledger as applicable | Hedera wallet/mirror | Ready -> on-chain submitted/paid | Hash/status visible; payouts paid | Correct recipients/amounts signed and verified | Wallet rejection, mirror timeout, partial transfer | Retry confirm/monitor; manual reconciliation | Partial | Yes | Critical | Not Tested |
| Xero Connection | Operator connects/disconnects Xero | `/dashboard/settings/integrations` | Connect / Disconnect / Reconnect | OAuth routes, `POST /api/xero/disconnect` | xero_connections, accounting mappings/sync state | Xero OAuth | Disconnected -> connected or connected -> disconnected | Health card updates | Tokens, tenant, scopes valid; older incomplete tokens reauth | Missing tenant, expired token, revoked auth | Reconnect Xero | Yes | Yes | Critical | Not Tested |
| Xero Tenant | Operator selects organization | Integrations | Select tenant | `POST /api/xero/tenant` | xero_connections | Xero | Tenant updated | Selected org shown | Exports use selected tenant | Invalid tenant, Xero API failure | Reload tenants/reconnect | Partial | Yes | High | Not Tested |
| Xero Invoice/Payment Sync | Operator processes/backfills queue | Integrations / admin queue | Process now / Backfill / Replay | `POST /api/xero/queue/process-now`, `/backfill`, `/api/xero/sync/replay` | xero_syncs, payment_links, xero IDs | Xero | Pending/failed sync -> processed/synced | Queue counts decrease; errors visible | Xero receives invoice/payment exactly once | Rate limit, validation error, duplicate sync | Replay failed sync; reconnect Xero | Partial | Yes | Critical | Not Tested |
| Accounting Mappings | Accountant saves mappings | Integrations advanced settings | Save mappings / Reset / Fetch accounts | `PUT /api/settings/xero-mappings`, `GET /api/xero/accounts` | xero_account_mappings/accounting config | Xero | Mapping config updated | Health moves Healthy/Recommendation/Attention | Existing custom mappings not overwritten | Missing accounts, invalid account ID, Xero disconnected | Reload accounts; save again | Yes | Yes | High | Not Tested |
| Reporting | Operator views ledger/transactions/reports | `/dashboard/transactions`, reports routes | Filter/export/download | Reports APIs, Prisma reads | payment_events, ledger_entries | None | Read-only | Correct rows/totals/filter output | Totals match payment/ledger events | Auth failure, stale FX, pagination issues | Refresh/export again | Partial | Yes | Medium | Not Tested |
| Notifications | Operator reads notifications/preferences | Header/settings notifications | Mark read / Save preferences | `POST /api/notifications/[id]/read`, `PUT /api/notifications/preferences` | notifications, notification_preferences | Email/in-app notification systems | Unread -> read; prefs updated | Badge count decreases; toggles persist | Preferences persist after reload | Missing org, invalid preference, notification race | Retry save/read | Partial | Yes | Medium | Not Tested |
| Programs | Operator manages referral program participants/conversions | `/dashboard/programs/*` | Approve/reject/replay/mark paid conversions | Supabase reads; `/api/referrals/conversions/[id]/*` | referral_conversions, referral ledger tables | Supabase, ledger | Pending -> approved/rejected/paid | Tables update; ledger replay idempotent | Commission state correct | Duplicate ledger, stale Supabase data | Replay ledger; refresh | Partial | Yes | Medium | Not Tested |
| Referrals | Operator creates/refreshed referral links | `/dashboard/partners/referral-links`, `/dashboard/referrals` | Create link / Copy / Refresh | `POST /api/referral-links`, org referral APIs | referral_links, split rules | None | No link -> active link | Link visible and copyable | Public `/r/{code}` resolves and tracks | Duplicate code, missing org/service | Regenerate/create again | Yes | Yes | Medium | Not Tested |
| Partner Payout Methods | Partner/operator adds payout method | `/dashboard/partners/payout-methods` | Add method | `POST /api/payout-methods` | payout_methods | PayPal/Wise/Hedera identifiers only | No method -> saved method | Method appears/selectable | Validation and default status correct | Invalid account format, duplicate method | Edit/add another method | Partial | Yes | Medium | Not Tested |
| Marketing Labs | Operator imports/uses marketing assets/reports | Marketing Labs pages | Upload/import/generate where exposed | Marketing job/import routes if mounted | marketing assets/jobs tables or mock data | Storage/AI optional depending route | Asset/report state updated | Cards/lists update | Runtime does not rely on missing demo assets | Missing files, stale demo reports, disabled controls | Retry import; verify asset URL | Partial | Yes | Low | Not Tested |
| Agreement Analyzer | User uploads agreement for analysis | Public analyzer / dashboard analyzer | Upload agreement | `POST /api/agreement-analyzer/upload`, `/process`, `/jobs/process` | agreement analyzer leads/reports/jobs | AI provider, storage, email/Calendly webhooks | Uploaded -> processing -> report complete | Report page updates; lead appears | Structured report, score, lead attribution stored | AI failure, storage failure, stuck job | Job processor/retry/watchdog | Yes | Yes | High | Not Tested |
| Agreement Analyzer | Operator qualifies analyzer lead | `/dashboard/agreement-analyzer/leads/[leadId]` | Mark Qualified / Demo Booked / Customer | `POST /api/agreement-analyzer/admin/leads/[leadId]/lifecycle` | analyzer leads/activity | None | Lead lifecycle advances | Badge/action state updates | Stage persists and analytics reflect it | Unauthorized admin, invalid transition | Retry; admin permissions check | Yes | Yes | Medium | Not Tested |
| Admin Operations | Admin replays Xero sync/admin jobs | `/dashboard/admin/*` | Replay / Process / Inspect | `/api/xero/sync/replay`, jobs APIs | xero_syncs, audit/jobs tables | Xero, cron/job services | Failed -> retried/processed | Error list/status updates | Idempotent replay with clear error | Replay loops, duplicate external write | Retry after fixing root cause | Partial | Yes | High | Not Tested |
| Monitoring | Operator/admin monitors health | `/dashboard/monitoring` | Refresh / evaluate alerts | `/api/health`, `/api/monitoring/alerts` | monitoring/alerts tables | None | Read/evaluate health | Alerts/KPIs update | Production dependencies green or actionable | False positive, missing env, stale status | Refresh; inspect logs | Partial | Yes | Medium | Not Tested |
| Privacy/GDPR | Operator exports/deletes data | `/dashboard/settings/privacy` | Export / Check / Delete | `POST /api/gdpr/export`, `GET/POST /api/gdpr/delete` | users, organizations, related app data | None/email if configured | Export generated; deletion queued/performed | Download/confirmation shown | Data policy followed; financial records preserved as required | Delete blocked by obligations, export timeout | Retry; contact support/manual review | Partial | Yes | High | Not Tested |

## Top 20 Highest-Risk Workflows

1. Stripe payment confirmation and ledger/Xero side effects.
2. Supplier bill export to Xero.
3. Payout release batch creation and participant Paid convergence.
4. Hedera payout prepare/confirm.
5. Agreement approval -> payout details workflow.
6. Supplier onboarding submission and verification.
7. Payment link creation and email send.
8. Manual bank/crypto `mark_valid` assisted settlement.
9. Refund webhook reversal/idempotency.
10. Xero payment sync queue processing/replay.
11. Project invoice linking to funding/obligations.
12. Participant earnings save -> obligations generation.
13. Two-browser participant lifecycle concurrency.
14. Workspace onboarding bootstrap project/participants.
15. Billing checkout -> entitlement activation.
16. Xero OAuth reconnect/tenant selection.
17. Snapshot/import paths used by project creation/AI import.
18. Payout mark paid/failed manual operations.
19. Agreement Analyzer upload/process pipeline.
20. Organization deletion/GDPR deletion with financial records.

## Top 20 Missing or Insufficient Automated Tests

1. Authenticated end-to-end project creation in browser.
2. Authenticated Add Participant -> Configure Earnings -> Send Agreement flow.
3. Cross-browser agreement approval -> operator CTA update.
4. Request payout details -> public portal token opens.
5. Supplier portal submit -> operator review page updates.
6. Verify & Push Supplier Bill to Xero with mocked Xero success/failure.
7. Funding tab create invoice passes `projectId` through to `pilotDealId`.
8. Payment link full create/edit/send/cancel/delete browser flow.
9. Stripe checkout/webhook full settlement against a project-linked invoice.
10. Manual bank confirmation review browser flow.
11. Crypto confirmation review browser flow.
12. Release batch create -> submit -> mark paid browser flow.
13. Hedera prepare/confirm happy and wallet rejection paths.
14. Xero queue process/backfill/replay with mocked Xero API.
15. Billing checkout return activates entitlements.
16. Organization settings save/delete browser flow.
17. Services catalog add/edit/archive/restore browser flow.
18. Referral links create/copy/open browser flow.
19. Agreement Analyzer lead lifecycle browser flow.
20. GDPR export/delete browser flow with deletion blockers.

## Top 20 Production Blockers To Clear Before Launch

1. Prove project-linked invoice creation stores `pilot_deal_id` or provide an explicit attach flow.
2. Prove participant workflow is deterministic from Add Participant to Paid in a real browser.
3. Prove no normal participant action calls full snapshot persistence.
4. Prove Xero reconnect and old incomplete-token reauthorization work in sandbox.
5. Prove supplier bill export is idempotent and duplicate-safe.
6. Prove Stripe payment webhook funds project obligations exactly once.
7. Prove refund webhooks reverse ledger and payment status without duplicate writes.
8. Prove manual bank/crypto `mark_valid` cannot double-settle.
9. Prove release batch creation excludes ineligible obligations.
10. Prove payout mark-paid updates obligations and participant terminal state.
11. Prove Hedera payout confirmation handles mirror-node delay safely.
12. Prove billing entitlements update immediately enough for gated workflows.
13. Prove workspace onboarding cannot leave partial orphan project/participant state.
14. Prove email failures for invoices/payment setup are visible and retryable.
15. Prove organization deletion cannot remove required financial/audit records improperly.
16. Prove Xero queue replay cannot duplicate invoices/payments.
17. Prove Agreement Analyzer stuck jobs recover or surface operator action.
18. Prove frozen Rabbit Hole pilot still works if it remains production-visible.
19. Prove permission/CSRF enforcement on every financial mutation.
20. Prove mobile CTA visibility for participant and payout workflows.

## Recommended Manual QA Order

1. Authentication, organization, merchant settings, and billing entitlement baseline.
2. Xero connect/reconnect/tenant/mapping health in sandbox.
3. Workspace onboarding and project creation.
4. Participant golden path: add participant -> earnings -> share -> approve -> payout request -> supplier submit -> verify.
5. Xero supplier bill export from review page and funding tab.
6. Payment link create/edit/send/cancel/delete.
7. Project-linked payment link funding and obligation status update.
8. Stripe sandbox payment confirmation and Xero payment queue.
9. Manual bank and crypto confirmation review.
10. Funding sources add/edit/delete and forecast-only behavior.
11. Obligations page filters/status mapping.
12. Release batch creation from eligible obligations.
13. Payout batch submit, mark paid, mark failed.
14. Hedera payout prepare/confirm with wallet/mirror sandbox.
15. Refund webhook replay in Stripe test mode.
16. Notifications and email retry visibility.
17. Referrals/program conversion approval and ledger replay.
18. Agreement Analyzer upload/process/lead lifecycle.
19. Admin Xero sync replay/orphan diagnostics.
20. Privacy export/delete and destructive-action guardrails.

## Notes On Coverage Classification

- **Yes** means focused automated tests exist for the core domain/API policy, not necessarily full browser E2E.
- **Partial** means tests cover primitives, reducers, auth guards, or shell rendering but not the full operator workflow.
- **No** means no obvious automated coverage was found for the operator workflow during this audit.

## Release Exit Criteria

- Every `Critical` workflow in the matrix is manually executed and marked Pass.
- Every top-20 blocker is either resolved, explicitly accepted, or feature-gated off.
- Xero, Stripe, Wise/manual bank, Hedera, Resend, and storage are tested in sandbox with real credentials or approved mocks.
- Full regression suite passes: unit/integration, typecheck, build, and selected Playwright smoke flows.
- A release owner signs off on any workflow remaining `Not Tested`.

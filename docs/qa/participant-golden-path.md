# Participant Golden Path QA Checklist

Use this checklist to validate Provvypay's core commercial participant workflow in a production-like environment. The workflow must be monotonic: once a participant reaches a later business event, no UI surface may regress to an earlier stage.

Primary surfaces to verify at every step:

- Project overview / dashboard summary
- Participants page and participant table
- Approval Centre
- Participant cards
- Agreement detail / public agreement page
- Supplier onboarding portal
- Review page
- Xero export page
- Settlement / payouts surface

Canonical lifecycle sequence:

`DRAFT` -> `EARNINGS_CONFIGURED` -> `AGREEMENT_SENT` -> `AGREEMENT_ACCEPTED` -> `PAYMENT_INFO_PENDING` -> `PAYMENT_INFO_SUBMITTED` -> `XERO_INVOICE` -> `SETTLEMENT_READY` -> `PAID`

## 1. Add Participant

User action:
- From the project participants page, add a participant with name, role, and contact details.

Expected API call:
- Snapshot/participant persistence via the project participant save flow.
- If editing an existing participant: `PATCH /api/deal-network-pilot/participants/{participantId}`.

Expected database changes:
- Participant row exists in `deal_network_pilot_participants`.
- `participant_payload` contains participant identity fields such as `name`, `email`, `role`, `inviteToken`, and initial commercial fields.
- No compensation profile is required yet.

Expected lifecycle stage:
- `DRAFT`.

Expected primary CTA:
- `Configure Earnings`.

Expected badge:
- `Configure Earnings`.

Expected dashboard changes:
- Participant count increases.
- Setup/progress summary shows participant requires earnings configuration.
- No payout, supplier onboarding, Xero, or settlement readiness should be counted.

Expected participant table changes:
- New row appears without refresh.
- Commercial column shows `Configure Earnings`.
- Next Action shows `Configure Earnings`.
- Earnings column should not imply configured compensation unless a persisted compensation profile exists.

Expected Approval Centre changes:
- Participant card appears with `Configure Earnings`.
- No `Send Agreement`, `View Agreement`, or payout CTA should be visible yet.

Expected notifications:
- Success toast or equivalent confirmation that participant was added.
- No supplier onboarding or Xero notifications.

Expected Xero side effects:
- None.

## 2. Configure Earnings

User action:
- Open earnings configuration for the participant.
- Save fixed, percentage, formula, or exempt compensation terms as appropriate.

Expected API call:
- `PATCH /api/deal-network-pilot/participants/{participantId}` with `compensationProfile`.

Expected database changes:
- `participant_payload.compensationProfile` is persisted.
- `compensationProfile.configured` is true for payable participants.
- Legacy scalar fields such as `commissionKind` and `commissionValue` may be repaired or synchronized where supported.
- No agreement acceptance, payment setup, supplier onboarding, Xero export, or settlement fields should be marked complete.

Expected lifecycle stage:
- `EARNINGS_CONFIGURED`.
- Product copy may describe this as Ready to Share / Agreement Ready.

Expected primary CTA:
- `Send Agreement`.

Expected badge:
- `Agreement Ready`.

Expected dashboard changes:
- Earnings configured count increases.
- Workspace summary moves the participant from setup blocked to ready to send.

Expected participant table changes:
- Earnings column shows the saved amount/model.
- Commercial column shows `Agreement Ready`.
- Next Action changes immediately to `Send Agreement` without page refresh.

Expected Approval Centre changes:
- Participant card shows `Agreement Ready`.
- Primary CTA is `Send Agreement`.

Expected notifications:
- Success toast such as compensation structure saved.
- No supplier onboarding notification yet.

Expected Xero side effects:
- None.

## 3. Send Agreement

User action:
- Send/share the agreement using email, copy link, WhatsApp, QR, or native share.

Expected API call:
- The agreement share action must persist through the same participant/server mutation path used by the project participant workflow.
- The UI must not treat local link generation alone as agreement sent.

Expected database changes:
- Participant payload records a real share event, such as `agreementSharedAt` or `inviteSentAt`.
- `agreementUrl` and/or `inviteToken` remains available for the public agreement page.
- `inviteStatus` alone is not sufficient to count as sent.

Expected lifecycle stage:
- `AGREEMENT_SENT`.

Expected primary CTA:
- `Waiting for Acceptance`.

Expected badge:
- `Waiting for Acceptance`.

Expected dashboard changes:
- Approval/acceptance summary shows one participant awaiting acceptance.
- No supplier onboarding required count until the agreement is accepted.

Expected participant table changes:
- Agreement column indicates sent/pending.
- Commercial column shows `Waiting for Acceptance`.
- Next Action shows `Waiting for Acceptance` as a non-progressing/waiting state.

Expected Approval Centre changes:
- Participant card shows `Waiting for Acceptance`.
- No duplicate `Send Agreement`, `Resend`, or `View Agreement` primary action should replace the canonical waiting state.

Expected notifications:
- Share success toast or copy/share confirmation.
- If email is used, email send success/failure should be visible.

Expected Xero side effects:
- None.

## 4. Accept Agreement

User action:
- In a separate browser/session, open the participant agreement link and accept the agreement.

Expected API call:
- `POST /api/deal-network-pilot/invites/{token}/approve`.

Expected database changes:
- Participant payload records acceptance, such as `approvalStatus: "Approved"` and `approvedAt`.
- Agreement lifecycle/approval data marks the agreement accepted.
- Missing email must not block acceptance when the participant used a shared link.
- No payment setup token is required until payout details are requested.

Expected lifecycle stage:
- `AGREEMENT_ACCEPTED`.

Expected primary CTA:
- `Request Payout Details`.

Expected badge:
- `Agreement Accepted`.

Expected dashboard changes:
- Accepted/approved agreement count increases.
- Supplier onboarding required should appear.
- The dashboard must not regress the participant to earnings setup.

Expected participant table changes:
- Agreement column shows accepted.
- Commercial column shows `Agreement Accepted`.
- Next Action changes to `Request Payout Details`.
- If identity or compensation data is incomplete, show an integrity warning alongside the current stage, not `Configure Earnings`.

Expected Approval Centre changes:
- Participant card shows `Agreement Accepted`.
- Primary CTA is `Request Payout Details`.
- It must not show only `View Agreement`.

Expected notifications:
- Agreement accepted confirmation on the public flow.
- Operator surfaces should update after cache invalidation/operational sync.

Expected Xero side effects:
- None.

## 5. Request Payout Details

User action:
- Operator clicks `Request Payout Details`.
- If prompted, share the generated supplier onboarding portal URL or send the email.

Expected API call:
- `POST /api/deal-network-pilot/participants/{participantId}/payment-request/generate`.
- Request body may include `{ "sendEmail": true }` when emailing the request.

Expected database changes:
- `participant_payload.paymentSetup.paymentRequestGeneratedAt` is set.
- A payment setup token and expiry are generated.
- Supplier onboarding state is created or moved to invited/pending, such as `supplierOnboarding.lifecycle: "INVITED"` and/or `payoutOnboardingPhase: "INVITED"`.
- Portal URL can be generated from the token.

Expected lifecycle stage:
- `PAYMENT_INFO_PENDING`.

Expected primary CTA:
- `Waiting for Participant`.

Expected badge:
- `Waiting for Participant`.

Expected dashboard changes:
- Supplier onboarding required count moves from request needed to waiting for participant.
- Workspace summary shows the operator is waiting on supplier submission.

Expected participant table changes:
- Commercial column shows `Waiting for Participant`.
- Next Action shows `Waiting for Participant`.
- No `Request Payout Details` button remains for the same participant unless generation failed.

Expected Approval Centre changes:
- Participant card shows `Waiting for Participant`.
- Primary action is a waiting badge/state, not another request button.

Expected notifications:
- Success toast such as payment request ready to share or payment request emailed.
- If email is sent, email success/failure should be explicit.

Expected Xero side effects:
- None.

## 6. Submit Payout Details

User action:
- Participant opens `/payment-setup/{token}` and submits payout, tax, ABN, GST, and declaration details.

Expected API call:
- `POST /api/payment-setup/{token}/submit`.
- Supporting upload calls may use `POST /api/payment-setup/{token}/upload` when documents are attached.

Expected database changes:
- Supplier onboarding submission is persisted.
- `supplierOnboarding.lifecycle` moves to `SUBMITTED`.
- Submission payload includes payout destination, tax/ABN/GST details, declaration acceptance, and `submittedAt`.
- Payment setup token should not be reused to create duplicate active submissions.

Expected lifecycle stage:
- `PAYMENT_INFO_SUBMITTED`.

Expected primary CTA:
- `Verify Payout Details`.

Expected badge:
- `Verify Payout Details`.

Expected dashboard changes:
- Supplier onboarding waiting count decreases.
- Verification required count increases.
- Operator surfaces update without manual refresh where operational sync is available.

Expected participant table changes:
- Commercial column shows `Verify Payout Details`.
- Next Action shows `Verify Payout Details`.

Expected Approval Centre changes:
- Participant card shows `Verify Payout Details`.
- Primary CTA routes to the operator review page.

Expected notifications:
- Participant sees submission success.
- Operator may see dashboard/review counts update.

Expected Xero side effects:
- None.

## 7. Verify Payout Details

User action:
- Operator opens the participant review page and verifies payout details.
- If the product uses the combined workflow, use the single primary action `Verify & Push Supplier Bill to Xero`; otherwise verify first and ensure the next canonical stage appears.

Expected API call:
- Verification: `POST /api/deal-network-pilot/participants/{participantId}/supplier-onboarding/approve`.
- If combined with export, Xero export follows with `POST /api/deal-network-pilot/participants/{participantId}/xero-export`.

Expected database changes:
- `supplierOnboarding.lifecycle` moves to `APPROVED`.
- `payoutVerificationConfirmed` is set true.
- Review/audit timestamps are persisted where available.
- No settlement fields should be marked paid.

Expected lifecycle stage:
- `XERO_INVOICE` after verification if Xero export has not happened.
- If the UI chains verification and export successfully in one action, it may advance directly to `SETTLEMENT_READY`.

Expected primary CTA:
- If verification only: `Push Supplier Bill to Xero`.
- If combined verify/export succeeds: `Release Settlement`.

Expected badge:
- If verification only: `Ready for Xero`.
- If combined verify/export succeeds: `Ready for Settlement`.

Expected dashboard changes:
- Verification required count decreases.
- Xero-ready count increases unless export is chained immediately.

Expected participant table changes:
- No duplicate primary actions such as separate `Approve` and `Push to Xero`.
- Next Action reflects exactly one canonical action.

Expected Approval Centre changes:
- Card shows either `Ready for Xero` with `Push Supplier Bill to Xero`, or `Ready for Settlement` if chained export completed.

Expected notifications:
- Verification success toast.
- If changes are requested or rejected, participant should leave the happy path and display the appropriate remediation state.

Expected Xero side effects:
- None for verification-only.
- If chained, see step 8.

## 8. Push Supplier Bill to Xero

User action:
- Operator clicks `Push Supplier Bill to Xero`.

Expected API call:
- `POST /api/deal-network-pilot/participants/{participantId}/xero-export`.

Expected database changes:
- Supplier bill export metadata is persisted in `participant_payload.paymentSetup`.
- Expected fields include `xeroExportedAt`, `xeroSyncStatus: "synced"` or equivalent success metadata.
- Xero invoice/bill identifiers should be stored where the export service returns them.
- Participant should not be marked paid.

Expected lifecycle stage:
- `SETTLEMENT_READY`.

Expected primary CTA:
- `Release Settlement`.

Expected badge:
- `Ready for Settlement`.

Expected dashboard changes:
- Xero-ready count decreases.
- Settlement-ready/release-ready count increases.
- Accounting/Xero status should show successful supplier bill creation.

Expected participant table changes:
- Commercial column shows `Ready for Settlement`.
- Next Action shows `Release Settlement`.
- No `Push Supplier Bill to Xero` action remains after successful export.

Expected Approval Centre changes:
- Card shows `Ready for Settlement`.
- Primary CTA is `Release Settlement`.

Expected notifications:
- Xero export success.
- If Xero is disconnected, expired, missing tenant, or mapping readiness blocks export, show a blocking Xero/accounting error and keep the participant at `Ready for Xero`.

Expected Xero side effects:
- Supplier bill is created in Xero for the participant obligation.
- Export must be idempotent: retry should not create duplicate supplier bills.

## 9. Release Settlement

User action:
- Operator releases the participant settlement/payout.

Expected API call:
- Settlement release flow may create a payout batch with `POST /api/payout-batches/create`.
- Marking a payout paid uses `POST /api/payouts/{id}/mark-paid`.

Expected database changes:
- Payout/release records are created or updated.
- Participant settlement fields are updated, such as `payoutSettlementStatus: "Paid"` and `payoutPaidAt`.
- Release batch/payment ledger state reflects the payout.

Expected lifecycle stage:
- `PAID`.

Expected primary CTA:
- `Paid`.

Expected badge:
- `Paid`.

Expected dashboard changes:
- Release-ready count decreases.
- Paid/settled count increases.
- Cashflow and settlement summaries reflect completed payout.

Expected participant table changes:
- Commercial column shows `Paid`.
- Next Action shows `Paid` or no actionable CTA.
- No earlier actions are visible.

Expected Approval Centre changes:
- Card shows `Paid`.
- No previous workflow action remains visible.

Expected notifications:
- Settlement released / payout marked paid confirmation.
- Any payment provider failure should be explicit and should not mark the participant paid.

Expected Xero side effects:
- No new supplier bill should be created.
- If payment reconciliation or ledger sync exists, it should reference the already-created supplier bill rather than duplicating it.

## 10. Paid

User action:
- Operator verifies the completed participant state across all surfaces.

Expected API call:
- No action API call should be required for a paid participant.
- Read/refresh calls may load the project snapshot and operational summaries.

Expected database changes:
- No additional writes during passive verification.
- Terminal paid fields remain stable.

Expected lifecycle stage:
- `PAID`.

Expected primary CTA:
- `Paid`.

Expected badge:
- `Paid`.

Expected dashboard changes:
- Participant is counted as completed/settled.
- No outstanding onboarding, Xero, or settlement action is shown for this participant.

Expected participant table changes:
- Commercial column remains `Paid`.
- Next Action remains `Paid` or non-actionable.
- Earnings, agreement, and payout details remain visible for auditability.

Expected Approval Centre changes:
- Participant card remains terminal.
- No `Configure Earnings`, `Send Agreement`, `Request Payout Details`, `Verify Payout Details`, `Push Supplier Bill to Xero`, or `Release Settlement` CTA appears.

Expected notifications:
- None unless the user performs a refresh/export/audit action.

Expected Xero side effects:
- None.

## Common Failure Cases

### Participant Save Fails

Expected behaviour:
- Show an error toast.
- Do not leave optimistic participant data permanently visible if the server rejected the write.
- Dashboard counts and table rows remain consistent with persisted state.

### Earnings Save Fails

Expected behaviour:
- Participant remains `DRAFT`.
- Primary CTA remains `Configure Earnings`.
- The previous compensation display is restored if optimistic UI was used.
- No agreement can be sent from the canonical workflow.

### Agreement Link Generated But Not Persisted As Shared

Expected behaviour:
- Participant must not advance to `AGREEMENT_SENT`.
- Primary CTA remains `Send Agreement`.
- QA should treat a share UI that does not persist `agreementSharedAt` or `inviteSentAt` as a blocker.

### Agreement Accepted With Missing Email

Expected behaviour:
- Participant advances to `AGREEMENT_ACCEPTED`.
- Primary CTA is `Request Payout Details`.
- Missing email is shown as an integrity warning only.
- Participant must never regress to `DRAFT` or `Configure Earnings`.

### Agreement Accepted With Missing Compensation Profile

Expected behaviour:
- Participant stays in the operational phase at `AGREEMENT_ACCEPTED` or later.
- Show warning: compensation profile missing / review before settlement.
- Do not hide `Request Payout Details`.

### Payment Request Generation Fails

Expected behaviour:
- Participant remains `AGREEMENT_ACCEPTED`.
- Primary CTA remains `Request Payout Details`.
- No invalid token or portal URL is shown.
- Email failure should not be reported as supplier onboarding completed.

### Payment Setup Token Expired Or Invalid

Expected behaviour:
- Supplier portal shows a clear expired/invalid token message.
- Operator can regenerate or resend the request.
- Participant remains `PAYMENT_INFO_PENDING` until a valid submission is persisted.

### Supplier Submission Validation Fails

Expected behaviour:
- Participant remains `PAYMENT_INFO_PENDING`.
- Portal identifies missing/invalid payout, ABN, GST, or declaration fields.
- Operator surfaces do not show `Verify Payout Details` until submission is persisted.

### Operator Requests Changes

Expected behaviour:
- Supplier onboarding state leaves the happy path and clearly indicates changes requested.
- Participant should not progress to `XERO_INVOICE`.
- The supplier receives or can access remediation instructions.

### Verification Fails

Expected behaviour:
- Participant remains `PAYMENT_INFO_SUBMITTED` or an explicit rejected/changes-required state.
- No Xero export is attempted unless verification succeeds.
- Primary CTA remains review/remediation oriented.

### Xero Disconnected Or OAuth Expired

Expected behaviour:
- Participant remains `XERO_INVOICE`.
- Primary CTA may still indicate Xero action, but export attempt must show a blocking Xero/accounting error.
- No supplier bill is marked exported locally.
- Xero reconnection/reauthorization path is visible.

### Missing Accounting Mapping Required For Export

Expected behaviour:
- Participant remains `XERO_INVOICE`.
- Accounting health shows attention required.
- Optional mapping recommendations must not block unrelated workflow steps.
- No supplier bill is created in Xero.

### Xero Export Partially Fails

Expected behaviour:
- Local state must not advance to `SETTLEMENT_READY` unless Xero confirms supplier bill creation or the export is safely recoverable/idempotent.
- Retry must not create duplicate supplier bills.
- Error state is visible on export/accounting surfaces.

### Settlement Release Fails

Expected behaviour:
- Participant remains `SETTLEMENT_READY`.
- Primary CTA remains `Release Settlement`.
- No `payoutPaidAt` or terminal paid status is persisted.
- Operator sees the provider/payment failure reason.

### Paid Participant Reopened By Stale Data

Expected behaviour:
- `PAID` remains terminal unless an explicit administrative reversal exists.
- No stale dashboard, table, or Approval Centre surface may show earlier actions.
- Refreshing the page should not change the paid state.

## Final Acceptance Criteria

- Every surface shows the same lifecycle stage, badge, and primary CTA for the same participant.
- Each user action causes the expected API call and database mutation.
- Cache invalidation / operational sync updates operator surfaces without manual refresh where supported.
- No accepted participant can render `DRAFT` or `Configure Earnings`.
- No participant has more than one competing primary workflow action.
- Xero side effects occur only during supplier bill export and are idempotent.
- Settlement completion updates the participant lifecycle to `PAID`.

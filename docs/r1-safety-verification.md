# R1 Safety Verification

Post-design scan for workflows that depend on manual-settlement bypassing `confirmPayment`.

## Search: `manual-settlement` / `orchestrateFundingAfterManual`

| Location | Impact |
|----------|--------|
| `payment-links/page.tsx` | UI only — expects `success`; **OK** |
| `payment-link-detail-dialog.tsx` | UI only — **OK** |
| `manual-settlement/route.ts` | **Changed** to confirmPayment |
| `bridge-invoice-settlement.server.ts` | `orchestrateFundingAfterManualInvoiceSettlement` retained but no longer called from route; funding via `orchestrateFundingAfterInvoiceSettlement` |
| `payment-link-status-api-policy.ts` | Error copy references manual-settlement — still valid |
| Docs / remediation plans | Informational only |

## Reports & admin

- Revenue/report routes filter `status: 'PAID'` — unchanged semantics, stronger data quality.
- `integrity-checks.ts` `PAID_WITHOUT_PAYMENT_CONFIRMED` — improves for new manual marks.
- No admin script found that POSTs manual-settlement.

## Reconciliation scripts

- `stripe-reconciliation`, `repair-stripe-payment`, `reconcile-stripe-payments` use `confirmPayment` — **unaffected**.

## Support / reopen workflow

- Reopen still uses direct `OPEN` transition when no external evidence — **unchanged**.
- Legacy invoices marked PAID without PAYMENT_CONFIRMED can still be reopened.

## Risk: confirmPayment failure

- Operator sees error toast (API 400) — invoice stays OPEN until settlement succeeds.
- **Preferred** vs silent financial divergence.

## Risk: Wise clearing used for manual ledger

- Journal description references Wise transfer id pattern `manual-manual-settlement:{id}`.
- Operational reporting should treat as off-rail operator settlement (documented in design).

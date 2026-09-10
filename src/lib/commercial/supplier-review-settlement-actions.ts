/**
 * Operator review CTAs for payout-detail verification vs optional Xero export.
 *
 * Approval is a commercial decision. Xero export is an accounting projection
 * and must never be bundled into the verify action.
 */

export type XeroExportConnectionStatus = {
  connected?: boolean;
  stale?: boolean;
  reauthorizationRequired?: boolean;
} | null | undefined;

export function isXeroExportActionable(status: XeroExportConnectionStatus): boolean {
  return (
    status?.connected === true &&
    status.stale !== true &&
    status.reauthorizationRequired !== true
  );
}

export const VERIFY_SUPPLIER_DETAILS_LABEL = 'Verify supplier details';
export const PUSH_SUPPLIER_BILL_TO_XERO_LABEL = 'Push Supplier Bill to Xero';
export const XERO_EXPORT_SKIPPED_COPY =
  'Xero not connected — accounting export will be skipped.';

export type SupplierReviewSettlementActions = {
  showVerifyAction: boolean;
  verifyLabel: string;
  showPushToXeroAction: boolean;
  pushToXeroLabel: string;
  showXeroSkippedCopy: boolean;
  xeroSkippedCopy: string;
};

export function deriveSupplierReviewSettlementActions(input: {
  lifecycle: string;
  xeroConnected: boolean | null;
  xeroStale?: boolean;
  xeroReauthorizationRequired?: boolean;
}): SupplierReviewSettlementActions {
  const submitted = input.lifecycle === 'SUBMITTED';
  const approved = input.lifecycle === 'APPROVED';
  const xeroKnown = input.xeroConnected !== null;
  const actionable = isXeroExportActionable({
    connected: input.xeroConnected === true,
    stale: input.xeroStale,
    reauthorizationRequired: input.xeroReauthorizationRequired,
  });

  return {
    showVerifyAction: submitted,
    verifyLabel: VERIFY_SUPPLIER_DETAILS_LABEL,
    showPushToXeroAction: approved && actionable,
    pushToXeroLabel: PUSH_SUPPLIER_BILL_TO_XERO_LABEL,
    showXeroSkippedCopy: approved && xeroKnown && !actionable,
    xeroSkippedCopy: XERO_EXPORT_SKIPPED_COPY,
  };
}

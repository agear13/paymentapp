import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { isPaymentRequestSent } from '@/lib/commercial/participant-lifecycle-primitives';
import { effectiveOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { participantWorkspacePathFromParticipant } from '@/lib/projects/participant-entitlement';
import { buildReferralQrApiPath } from '@/lib/referrals/referral-share-url';
import type {
  WorkflowCoordinationAgreementStatus,
  WorkflowCoordinationCompensationKind,
  WorkflowCoordinationNextActionKind,
  WorkflowCoordinationPayoutStatus,
  WorkflowCoordinationReferralStatus,
  WorkflowCoordinationTaxStatus,
  WorkflowOperationalReferralSummary,
} from '@/lib/workflows/agreement-intelligence/types';

export const AGREEMENT_INTELLIGENCE_SLUG = 'agreement-intelligence';

export type ParticipantCoordinationAction =
  | 'request_approval'
  | 'request_payout_details'
  | 'approve_payout_details'
  | 'flag_payout_details'
  | 'activate_referral';

export type CoordinationCatalogItem = {
  id: string;
  name: string;
};

export type ParticipantCoordinationView = {
  agreementStatus: WorkflowCoordinationAgreementStatus;
  payoutSetupStatus: WorkflowCoordinationPayoutStatus;
  taxInformationStatus: WorkflowCoordinationTaxStatus;
  referralStatus: WorkflowCoordinationReferralStatus;
  compensationKind: WorkflowCoordinationCompensationKind;
  compensationLabel: string | null;
  nextActionKind: WorkflowCoordinationNextActionKind;
  nextActionLabel: string | null;
  missingPayoutFields: string[];
  referral: WorkflowOperationalReferralSummary | null;
  eligibleServiceIds: string[];
  workspaceUrl: string | null;
  payoutReview: {
    preferredMethod: string | null;
    abn: string | null;
    gst: string | null;
    submittedAt: string | null;
  } | null;
};

function isFlaggedOnboarding(participant: DemoParticipant): boolean {
  const events = participant.supplierOnboarding?.events ?? [];
  const lastChange = [...events]
    .reverse()
    .find((event) => event.type === 'SUPPLIER_ONBOARDING_CHANGES_REQUESTED');
  if (!lastChange) return false;
  const submittedAt = participant.supplierOnboarding?.submission?.submittedAt;
  if (!submittedAt) return participant.supplierOnboarding?.lifecycle === 'IN_PROGRESS';
  return new Date(lastChange.timestamp).getTime() >= new Date(submittedAt).getTime();
}

export function compensationKindOf(
  participant: DemoParticipant
): WorkflowCoordinationCompensationKind {
  const type = participant.compensationProfile?.compensationType;
  if (type === 'FIXED_FEE') return 'fixed';
  if (type === 'COMMISSION' || type === 'HYBRID') return 'commission';
  if (type === 'REVENUE_SHARE') return 'revenue_share';
  if (participant.commissionKind === 'pct_deal_value' && (participant.commissionValue ?? 0) > 0) {
    return 'revenue_share';
  }
  if (participant.commissionKind === 'fixed_amount' && (participant.commissionValue ?? 0) > 0) {
    return 'fixed';
  }
  return null;
}

export function compensationLabelOf(participant: DemoParticipant): string | null {
  const profile = participant.compensationProfile;
  if (profile?.compensationType === 'REVENUE_SHARE' && (profile.percentage ?? 0) > 0) {
    return `${profile.percentage}% revenue share`;
  }
  if (profile?.compensationType === 'COMMISSION' && (profile.percentage ?? 0) > 0) {
    return `${profile.percentage}% commission`;
  }
  if (profile?.compensationType === 'FIXED_FEE' && (profile.fixedAmount ?? 0) > 0) {
    return `$${profile.fixedAmount.toLocaleString()} fixed payment`;
  }
  if (participant.commissionKind === 'pct_deal_value' && (participant.commissionValue ?? 0) > 0) {
    return `${participant.commissionValue}% revenue share`;
  }
  if (participant.commissionKind === 'fixed_amount' && (participant.commissionValue ?? 0) > 0) {
    return `$${Number(participant.commissionValue).toLocaleString()} fixed payment`;
  }
  return null;
}

export function listMissingPayoutFields(participant: DemoParticipant): string[] {
  const missing: string[] = [];
  const payment = participant.supplierOnboarding?.payment;
  const abn = participant.supplierOnboarding?.abn;
  const gst = participant.supplierOnboarding?.gst;

  const bank = payment?.bankDetails;
  const hasBank =
    Boolean(bank?.accountName?.trim()) &&
    Boolean(bank?.bsb?.trim()) &&
    Boolean(bank?.accountNumber?.trim());
  const hasAlternative = Boolean(payment?.alternativePaymentMethod?.trim());
  if (payment?.preference === 'alternative') {
    if (!hasAlternative) missing.push('Preferred payout method');
  } else if (!hasBank) {
    missing.push('Preferred payout method');
  }

  if (!abn?.abn?.trim() && abn?.abnNotApplicable !== true) {
    missing.push('ABN');
  }
  if (!gst?.gstStatus || gst.gstStatus === 'pending') {
    missing.push('GST information');
  }
  return missing;
}

export function agreementStatusOf(
  participant: DemoParticipant
): WorkflowCoordinationAgreementStatus {
  if (participant.approvalStatus === 'Approved') return 'approved';
  if (participant.agreementViewedAt) return 'viewed';
  if (participant.agreementSharedAt || participant.inviteSentAt) return 'requested';
  return 'not_requested';
}

export function payoutSetupStatusOf(
  participant: DemoParticipant
): WorkflowCoordinationPayoutStatus {
  if (participant.payoutVerificationConfirmed || participant.supplierOnboarding?.lifecycle === 'APPROVED') {
    return 'complete';
  }
  if (isFlaggedOnboarding(participant)) return 'flagged';
  const submitted = Boolean(participant.supplierOnboarding?.submission?.submittedAt);
  if (submitted) return 'submitted';
  if (isPaymentRequestSent(participant)) return 'requested';
  if (participant.approvalStatus === 'Approved') return 'required';
  return 'required';
}

export function taxInformationStatusOf(
  participant: DemoParticipant,
  payoutStatus: WorkflowCoordinationPayoutStatus
): WorkflowCoordinationTaxStatus {
  if (payoutStatus === 'complete') return 'complete';
  const missing = listMissingPayoutFields(participant);
  const taxMissing = missing.filter((field) => field === 'ABN' || field === 'GST information');
  if (payoutStatus === 'submitted' || payoutStatus === 'flagged') {
    return taxMissing.length > 0 ? 'incomplete' : 'complete';
  }
  return 'required';
}

export function referralEligibilityOf(
  participant: DemoParticipant,
  catalogItems: CoordinationCatalogItem[]
): {
  status: WorkflowCoordinationReferralStatus;
  destinationLabel: string | null;
} {
  const kind = compensationKindOf(participant);
  if (kind === 'fixed' || kind == null) {
    return { status: 'not_applicable', destinationLabel: null };
  }

  const selectedIds =
    participant.compensationProfile?.commissionServiceIds ??
    participant.referralCommerce?.enabledServiceIds ??
    [];
  const selectedMode = participant.compensationProfile?.commissionSourceMode === 'selected';
  if (selectedMode && selectedIds.length === 0) {
    return { status: 'service_required', destinationLabel: null };
  }

  const selectedCatalog = selectedIds.length
    ? catalogItems.filter((item) => selectedIds.includes(item.id))
    : catalogItems;

  if (selectedCatalog.length === 0) {
    return { status: 'service_required', destinationLabel: null };
  }

  const destinationLabel =
    selectedCatalog.length === 1
      ? selectedCatalog[0].name
      : `${selectedCatalog[0].name} +${selectedCatalog.length - 1} more`;

  if (participant.customerCommerceUrl?.trim() || participant.referralCode?.trim()) {
    return { status: 'active', destinationLabel };
  }

  return { status: 'ready', destinationLabel };
}

function preferredPayoutMethodLabel(participant: DemoParticipant): string | null {
  const payment = participant.supplierOnboarding?.payment;
  if (payment?.preference === 'alternative') {
    return payment.alternativePaymentMethod?.trim() || 'Alternative payout method';
  }
  if (payment?.preference === 'bank_account' || payment?.bankDetails?.accountName) {
    return 'Bank transfer';
  }
  return payment?.preference ?? null;
}

function gstLabel(participant: DemoParticipant): string | null {
  const status = participant.supplierOnboarding?.gst?.gstStatus;
  if (status === 'yes') return 'GST registered';
  if (status === 'no') return 'Not GST registered';
  if (status === 'not_applicable') return 'GST not applicable';
  if (status === 'pending') return 'GST pending';
  return null;
}

export function nextCoordinationAction(input: {
  agreementStatus: WorkflowCoordinationAgreementStatus;
  payoutSetupStatus: WorkflowCoordinationPayoutStatus;
  referralStatus: WorkflowCoordinationReferralStatus;
  operatorApprovalRequired: boolean;
}): { kind: WorkflowCoordinationNextActionKind; label: string | null } {
  if (input.operatorApprovalRequired && input.agreementStatus !== 'approved') {
    return { kind: 'request_approval', label: 'Request approval' };
  }
  if (input.payoutSetupStatus === 'required' || input.payoutSetupStatus === 'requested') {
    return {
      kind: 'request_payout_details',
      label:
        input.payoutSetupStatus === 'requested'
          ? 'Waiting for payout details'
          : 'Request payout details',
    };
  }
  if (input.payoutSetupStatus === 'submitted') {
    return { kind: 'review_payout_details', label: 'Review payout details' };
  }
  if (input.payoutSetupStatus === 'flagged') {
    return { kind: 'request_update', label: 'Request update' };
  }
  if (input.referralStatus === 'ready' || input.referralStatus === 'service_required') {
    return {
      kind: 'activate_referral',
      label: input.referralStatus === 'service_required' ? 'Service selection required' : 'Activate referral',
    };
  }
  return { kind: 'none', label: null };
}

export function buildParticipantCoordinationView(
  participant: DemoParticipant,
  input: {
    catalogItems: CoordinationCatalogItem[];
    operatorApprovalRequired: boolean;
  }
): ParticipantCoordinationView {
  const compensationKind = compensationKindOf(participant);
  const agreementStatus = agreementStatusOf(participant);
  const payoutSetupStatus =
    compensationKind == null
      ? 'not_applicable'
      : payoutSetupStatusOf(participant);
  const taxInformationStatus =
    payoutSetupStatus === 'not_applicable'
      ? 'not_applicable'
      : taxInformationStatusOf(participant, payoutSetupStatus);
  const referral = referralEligibilityOf(participant, input.catalogItems);
  const next = nextCoordinationAction({
    agreementStatus,
    payoutSetupStatus,
    referralStatus: referral.status,
    operatorApprovalRequired: input.operatorApprovalRequired,
  });
  const missingPayoutFields =
    payoutSetupStatus === 'flagged' || payoutSetupStatus === 'submitted'
      ? listMissingPayoutFields(participant)
      : [];
  const code = participant.referralCode?.trim() || null;
  const url = participant.customerCommerceUrl?.trim() || participant.inviteLink?.trim() || null;

  return {
    agreementStatus,
    payoutSetupStatus,
    taxInformationStatus,
    referralStatus: referral.status,
    compensationKind,
    compensationLabel: compensationLabelOf(participant),
    nextActionKind: next.kind,
    nextActionLabel: next.label,
    missingPayoutFields,
    referral:
      referral.status === 'not_applicable'
        ? null
        : {
            code,
            url,
            qrUrl: code ? buildReferralQrApiPath(code) : null,
            destinationLabel: referral.destinationLabel,
            commissionLabel: compensationLabelOf(participant),
          },
    eligibleServiceIds:
      participant.compensationProfile?.commissionServiceIds ??
      participant.referralCommerce?.enabledServiceIds ??
      [],
    workspaceUrl: participantWorkspacePathFromParticipant(participant),
    payoutReview:
      payoutSetupStatus === 'not_applicable'
        ? null
        : {
            preferredMethod: preferredPayoutMethodLabel(participant),
            abn: participant.supplierOnboarding?.abn?.abn?.trim() || null,
            gst: gstLabel(participant),
            submittedAt: participant.supplierOnboarding?.submission?.submittedAt ?? null,
          },
  };
}

export function workflowParticipantHref(
  participantId: string,
  slug: string = AGREEMENT_INTELLIGENCE_SLUG
): string {
  return COMMERCIAL_OS_ROUTES.workflowParticipant(slug, participantId);
}

export function emptyContractualCoordination(): {
  agreementStatus: null;
  payoutSetupStatus: 'not_applicable';
  taxInformationStatus: 'not_applicable';
  referralStatus: 'not_applicable';
  compensationKind: null;
  compensationLabel: null;
  nextActionKind: 'none';
  nextActionLabel: null;
  missingPayoutFields: [];
  referral: null;
  eligibleServiceIds: [];
  workspaceUrl: null;
  payoutReview: null;
} {
  return {
    agreementStatus: null,
    payoutSetupStatus: 'not_applicable',
    taxInformationStatus: 'not_applicable',
    referralStatus: 'not_applicable',
    compensationKind: null,
    compensationLabel: null,
    nextActionKind: 'none',
    nextActionLabel: null,
    missingPayoutFields: [],
    referral: null,
    eligibleServiceIds: [],
    workspaceUrl: null,
    payoutReview: null,
  };
}

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommissionStructureKind } from '@/lib/deal-network-demo/commission-structure';
import { COMMISSION_STRUCTURE_OPTIONS } from '@/lib/deal-network-demo/commission-structure';
import {
  defaultReferralCommerce,
  normalizeReferralCommerce,
  type ParticipantReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';
import type { OperationalParticipantRole } from '@/lib/projects/participants-for-project';
import { ROLE_TO_DEMO } from '@/lib/projects/participants-for-project';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';
import {
  formatFixedPayoutLine,
  formatRevenueShareLine,
} from '@/lib/projects/participant-compensation-copy';
import { DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';
import { draftParticipantDefaults } from '@/lib/operations/guards/hydration-guards';
import { canGenerateAttributionLink } from '@/lib/operations/truth/attribution-truth';
import { buildInviteCompensationProfile } from '@/lib/participants/participant-compensation';
import { participantWorkspacePath } from '@/lib/participant-portal/participant-portal-url';

export type ProjectParticipationModel =
  | 'fixed_payout'
  | 'revenue_share'
  | 'customer_attribution';

/** Operational participation (agreement lifecycle). */
export type ParticipationState = 'invited' | 'approved' | 'active';

export type ParticipantAttributionStatus = 'inactive' | 'active' | 'generating conversions';

export type ParticipantPayoutStatus =
  | 'no payout profile'
  | 'invited'
  | 'onboarding incomplete'
  | 'payout blocked'
  | 'payout ready'
  | 'paid';

export type BuildProjectParticipantInput = {
  name: string;
  email?: string;
  role: OperationalParticipantRole;
  project: RecentDeal;
  notes?: string;
  payoutDueDate?: string;
  participationModel: ProjectParticipationModel;
  commissionKind: CommissionStructureKind;
  commissionValue: number;
  enableCustomerAttribution: boolean;
  referralCommerce?: ParticipantReferralCommerce;
  manualPayoutMethod?: import('@/lib/participants/manual-payout-method').ManualPayoutMethod;
  sendInvite?: boolean;
};

export function isProjectWorkspaceParticipant(participant: DemoParticipant): boolean {
  return participant.workspaceSource === 'project';
}

/** Legacy invite URLs — redirect into the unified Participant Workspace. */
export function participantAgreementPath(inviteToken: string): string {
  return `/deal-invites/${encodeURIComponent(inviteToken)}`;
}

/** Canonical participant-facing workspace URL when a portal token exists. */
export function participantWorkspacePathFromParticipant(participant: DemoParticipant): string {
  const portalToken = participant.participantPortalToken?.trim();
  if (portalToken) {
    return participantWorkspacePath(portalToken);
  }
  return participantAgreementPath(participant.inviteToken);
}

export function participationModelToCommissionKind(
  model: ProjectParticipationModel
): CommissionStructureKind {
  if (model === 'fixed_payout') return 'fixed_amount';
  if (model === 'revenue_share') return 'pct_deal_value';
  return 'pct_deal_value';
}

export function buildReferralCommerceForProject(input: {
  participationModel: ProjectParticipationModel;
  enableCustomerAttribution: boolean;
  commerceCommissionPct?: number;
  enabledServiceIds?: string[];
}): ParticipantReferralCommerce | undefined {
  if (!input.enableCustomerAttribution && input.participationModel !== 'customer_attribution') {
    return undefined;
  }
  const base = defaultReferralCommerce();
  const mode =
    input.participationModel === 'customer_attribution' || input.enableCustomerAttribution
      ? 'referral_commerce'
      : 'project_revenue_share';
  return normalizeReferralCommerce({
    ...base,
    createReferralLink: true,
    commissionMode: mode,
    commerceCommissionPct: input.commerceCommissionPct ?? base.commerceCommissionPct,
    enabledServiceIds: input.enabledServiceIds ?? [],
  });
}

/**
 * On invite: agreement only — pending approval, attribution inactive, no commerce URL.
 */
function generateParticipantPortalToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `portal-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function buildProjectParticipant(input: BuildProjectParticipantInput): DemoParticipant {
  const id = `proj-p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inviteToken = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const participantPortalToken = generateParticipantPortalToken();
  const email = input.email?.trim() ?? '';
  const referralCommerce =
    input.referralCommerce ??
    buildReferralCommerceForProject({
      participationModel: input.participationModel,
      enableCustomerAttribution: input.enableCustomerAttribution,
    });

  const compensationProfile = buildInviteCompensationProfile({
    participationModel: input.participationModel,
    commissionKind: input.commissionKind,
    commissionValue: input.commissionValue,
    enableCustomerAttribution: input.enableCustomerAttribution,
    referralCommerce,
  });

  const commissionValue =
    compensationProfile?.compensationType === 'COMMISSION'
      ? (compensationProfile.percentage ?? input.commissionValue)
      : compensationProfile?.compensationType === 'REVENUE_SHARE'
        ? (compensationProfile.percentage ?? input.commissionValue)
        : compensationProfile?.compensationType === 'FIXED_FEE'
          ? (compensationProfile.fixedAmount ?? input.commissionValue)
          : input.commissionValue;

  return {
    id,
    name: input.name.trim(),
    email,
    role: ROLE_TO_DEMO[input.role],
    commissionKind: input.commissionKind,
    commissionValue,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    onboardingStatus: 'NOT_STARTED',
    inviteToken,
    participantPortalToken,
    dealId: input.project.id,
    dealName: input.project.dealName,
    roleDetails:
      input.notes?.trim() ||
      `${input.role} · ${participationModelLabel(input.participationModel)} on ${input.project.dealName}`,
    payoutDueDate: input.payoutDueDate?.trim() || undefined,
    participantNotes: input.notes?.trim() || undefined,
    referralCommerce,
    manualPayoutMethod: input.manualPayoutMethod,
    workspaceSource: 'project',
    participationModel: input.participationModel,
    attributionStatus: 'inactive',
    inviteLink: undefined,
    customerCommerceUrl: undefined,
    participantLifecycle: 'DRAFT',
    agreementLifecycle: 'NOT_CREATED',
    payoutOnboardingPhase: 'NOT_STARTED',
    ...(compensationProfile ? { compensationProfile } : {}),
    ...draftParticipantDefaults(),
  };
}

export function participationModelLabel(model: ProjectParticipationModel): string {
  switch (model) {
    case 'fixed_payout':
      return 'Fixed payout amount';
    case 'revenue_share':
      return 'Revenue share';
    case 'customer_attribution':
      return 'Customer attribution earnings';
  }
}

export function deriveParticipationState(participant: DemoParticipant): ParticipationState {
  if (participant.approvalStatus !== 'Approved') return 'invited';
  const attribution = deriveAttributionStatus(participant);
  if (attribution === 'active') return 'active';
  return 'approved';
}

export function participationStateLabel(state: ParticipationState): string {
  switch (state) {
    case 'invited':
      return 'Invited';
    case 'approved':
      return 'Approved';
    case 'active':
      return 'Active';
  }
}

export function deriveAttributionStatus(
  participant: DemoParticipant
): ParticipantAttributionStatus {
  if (!canGenerateAttributionLink(participant)) return 'inactive';
  if (participant.attributionStatus === 'generating conversions') return 'generating conversions';
  if (participant.approvalStatus !== 'Approved') return 'inactive';
  if (
    participant.attributionStatus === 'active' ||
    participant.customerCommerceUrl?.trim()
  ) {
    return 'active';
  }
  return 'inactive';
}

export function attributionStatusLabel(status: ParticipantAttributionStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'generating conversions':
      return 'Generating conversions';
    default:
      return 'Inactive';
  }
}

export function derivePayoutStatus(participant: DemoParticipant): ParticipantPayoutStatus {
  if (participant.payoutSettlementStatus === 'Paid' || participant.payoutPaidAt) return 'paid';
  if (!participant.email?.trim()) return 'no payout profile';
  if (participant.approvalStatus !== 'Approved') return 'invited';
  if (participant.payoutBlocked) return 'payout blocked';
  const onboarding = effectiveOnboardingStatus(participant);
  if (!isOnboardingComplete(onboarding)) {
    return onboarding === 'INCOMPLETE' ? 'onboarding incomplete' : 'payout blocked';
  }
  return 'payout ready';
}

export function payoutStatusLabel(status: ParticipantPayoutStatus): string {
  switch (status) {
    case 'no payout profile':
      return 'No payout profile';
    case 'invited':
      return 'Invited';
    case 'onboarding incomplete':
      return 'Onboarding incomplete';
    case 'payout blocked':
      return 'Payout blocked';
    case 'payout ready':
      return 'Payout ready';
    case 'paid':
      return 'Paid';
  }
}

export function earningsStructureSummary(
  participant: DemoParticipant,
  workspaceCurrency?: string
): string {
  const commercePct = participant.referralCommerce?.commerceCommissionPct;
  if (
    !participant?.compensationProfile?.configured &&
    participant?.commissionValue === 0 &&
    participant.referralCommerce?.commissionMode === 'referral_commerce' &&
    Number.isFinite(commercePct) &&
    (commercePct as number) > 0
  ) {
    return `${commercePct}% catalog commission`;
  }
  if (!participant?.compensationProfile?.configured && participant?.commissionValue === 0) {
    return 'Earnings not configured';
  }
  const currency = workspaceCurrency ?? DEFAULT_WORKSPACE_CURRENCY;
  if (participant.participationModel === 'fixed_payout') {
    return formatFixedPayoutLine(participant.commissionValue, currency);
  }
  if (participant.participationModel === 'revenue_share') {
    return formatRevenueShareLine(participant.commissionValue, currency);
  }
  if (participant.commissionKind === 'pct_deal_value') {
    return formatRevenueShareLine(participant.commissionValue, currency);
  }
  if (participant.commissionKind === 'fixed_amount') {
    return formatFixedPayoutLine(participant.commissionValue, currency);
  }
  const model = participant.participationModel;
  if (model) return participationModelLabel(model);
  const kind =
    COMMISSION_STRUCTURE_OPTIONS.find((o) => o.value === participant.commissionKind)?.label ??
    participant.commissionKind;
  return kind;
}

/** Strip commerce URLs from API responses until agreement is approved (project flow). */
export function sanitizeParticipantForAgreementView(
  participant: DemoParticipant
): DemoParticipant {
  if (!isProjectWorkspaceParticipant(participant)) return participant;
  if (participant.approvalStatus === 'Approved') return participant;
  return {
    ...participant,
    inviteLink: undefined,
    customerCommerceUrl: undefined,
  };
}

export function applyPostApprovalActivation(
  participant: DemoParticipant,
  commerceUrl: string
): DemoParticipant {
  return {
    ...participant,
    approvalStatus: 'Approved',
    attributionStatus: 'active',
    customerCommerceUrl: commerceUrl,
    inviteLink: commerceUrl,
  };
}

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommissionStructureKind } from '@/lib/deal-network-demo/commission-structure';
import {
  defaultReferralCommerce,
  normalizeReferralCommerce,
  shouldIssueReferralLink,
  type ParticipantReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';
import type { OperationalParticipantRole } from '@/lib/projects/participants-for-project';
import { ROLE_TO_DEMO } from '@/lib/projects/participants-for-project';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';

export type ProjectParticipationModel =
  | 'fixed_payout'
  | 'revenue_share'
  | 'customer_attribution';

export type ParticipantLifecycleStatus =
  | 'Draft participant'
  | 'Invited'
  | 'Attributable active'
  | 'Payout blocked'
  | 'Payout ready';

export type ParticipantAttributionStatus =
  | 'inactive'
  | 'active'
  | 'generating conversions';

export type ParticipantPayoutStatus =
  | 'not invited'
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
  /** When true and email present, participant is marked invited (invite link sent separately). */
  sendInvite?: boolean;
};

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

export function buildProjectParticipant(input: BuildProjectParticipantInput): DemoParticipant {
  const id = `proj-p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inviteToken = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const email = input.email?.trim() ?? '';
  const hasEmail = email.length > 0;
  const referralCommerce =
    input.referralCommerce ??
    buildReferralCommerceForProject({
      participationModel: input.participationModel,
      enableCustomerAttribution: input.enableCustomerAttribution,
    });

  const attributionActive =
    !!referralCommerce && shouldIssueReferralLink(referralCommerce);

  let lifecycle: ParticipantLifecycleStatus = 'Draft participant';
  if (attributionActive) lifecycle = 'Attributable active';
  else if (hasEmail && input.sendInvite) lifecycle = 'Invited';
  else if (hasEmail) lifecycle = 'Attributable active';

  return {
    id,
    name: input.name.trim(),
    email,
    role: ROLE_TO_DEMO[input.role],
    commissionKind: input.commissionKind,
    commissionValue: input.commissionValue,
    status: 'Pending',
    inviteStatus: hasEmail && input.sendInvite ? 'Invited' : 'Invited',
    approvalStatus: 'Approved',
    onboardingStatus: 'NOT_STARTED',
    inviteToken,
    dealId: input.project.id,
    dealName: input.project.dealName,
    roleDetails:
      input.notes?.trim() ||
      `${input.role} — ${participationModelLabel(input.participationModel)} on ${input.project.dealName}`,
    payoutDueDate: input.payoutDueDate?.trim() || undefined,
    participantNotes: input.notes?.trim() || undefined,
    referralCommerce,
    operationalLifecycle: lifecycle,
    attributionStatus: attributionActive ? 'active' : 'inactive',
  };
}

export function participationModelLabel(model: ProjectParticipationModel): string {
  switch (model) {
    case 'fixed_payout':
      return 'Fixed payout';
    case 'revenue_share':
      return 'Revenue share';
    case 'customer_attribution':
      return 'Customer attribution';
  }
}

export function deriveLifecycleStatus(participant: DemoParticipant): ParticipantLifecycleStatus {
  if (participant.operationalLifecycle) {
    return participant.operationalLifecycle;
  }
  const payout = derivePayoutStatus(participant);
  if (payout === 'payout ready') return 'Payout ready';
  if (payout === 'payout blocked' || payout === 'onboarding incomplete') return 'Payout blocked';
  if (deriveAttributionStatus(participant) === 'active') return 'Attributable active';
  if (participant.email?.trim() && participant.inviteStatus === 'Invited') return 'Invited';
  if (!participant.email?.trim()) return 'Draft participant';
  return 'Attributable active';
}

export function deriveAttributionStatus(
  participant: DemoParticipant
): ParticipantAttributionStatus {
  if (participant.attributionStatus === 'generating conversions') return 'generating conversions';
  if (participant.attributionStatus === 'active' || participant.inviteLink) return 'active';
  const commerce = participant.referralCommerce;
  if (commerce && shouldIssueReferralLink(commerce)) return 'inactive';
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
  if (!participant.email?.trim()) return 'not invited';
  if (participant.inviteStatus === 'Invited' && participant.approvalStatus !== 'Approved') {
    return 'invited';
  }
  const onboarding = effectiveOnboardingStatus(participant);
  if (!isOnboardingComplete(onboarding)) {
    return onboarding === 'INCOMPLETE' ? 'onboarding incomplete' : 'payout blocked';
  }
  if (participant.approvalStatus === 'Approved') return 'payout ready';
  return 'payout blocked';
}

export function payoutStatusLabel(status: ParticipantPayoutStatus): string {
  switch (status) {
    case 'not invited':
      return 'Not invited';
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

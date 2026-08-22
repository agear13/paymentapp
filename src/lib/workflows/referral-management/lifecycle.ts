import type { WorkflowOperationalParticipant } from '@/lib/workflows/agreement-intelligence/types';

export type ReferralPromoterLifecycleStage =
  | 'awaiting_approval'
  | 'invitation_sent'
  | 'payout_details'
  | 'ready_to_activate'
  | 'active';

export function referralPromoterLifecycleStage(
  promoter: Pick<
    WorkflowOperationalParticipant,
    'agreementStatus' | 'payoutSetupStatus' | 'referralStatus'
  >
): ReferralPromoterLifecycleStage {
  if (promoter.referralStatus === 'active') return 'active';

  if (promoter.agreementStatus !== 'approved') {
    if (promoter.agreementStatus === 'requested' || promoter.agreementStatus === 'viewed') {
      return 'invitation_sent';
    }
    return 'awaiting_approval';
  }

  const payoutPending =
    promoter.payoutSetupStatus === 'required' ||
    promoter.payoutSetupStatus === 'requested' ||
    promoter.payoutSetupStatus === 'submitted' ||
    promoter.payoutSetupStatus === 'flagged';
  if (payoutPending) return 'payout_details';

  if (promoter.referralStatus === 'ready' || promoter.referralStatus === 'service_required') {
    return 'ready_to_activate';
  }

  if (promoter.referralStatus === 'not_applicable') return 'active';
  return 'ready_to_activate';
}

export function referralPromoterLifecycleLabel(stage: ReferralPromoterLifecycleStage): string {
  switch (stage) {
    case 'active':
      return 'Active';
    case 'ready_to_activate':
      return 'Ready to activate';
    case 'payout_details':
      return 'Payout details required';
    case 'invitation_sent':
      return 'Invitation sent';
    case 'awaiting_approval':
      return 'Awaiting approval';
  }
}

export function referralPromoterNextActionCopy(
  promoter: Pick<WorkflowOperationalParticipant, 'nextActionKind' | 'nextActionLabel' | 'agreementStatus'>
): string | null {
  if (promoter.nextActionKind === 'request_approval') {
    if (promoter.agreementStatus === 'requested' || promoter.agreementStatus === 'viewed') {
      return 'Awaiting approval';
    }
    return 'Send invitation';
  }
  return promoter.nextActionLabel;
}

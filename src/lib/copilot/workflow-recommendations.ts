import type { CollectionPreferenceId } from '@/lib/onboarding/collection-preference';
import type { OnboardingUseCaseId } from '@/lib/onboarding/operator-onboarding-types';

export type CopilotWorkflowContext = {
  useCase?: OnboardingUseCaseId | null;
  collectionPreference?: CollectionPreferenceId | null;
};

export function getWorkflowRecommendation(context: CopilotWorkflowContext): string {
  switch (context.useCase) {
    case 'contractor_payouts':
      return 'Stripe + Wise is commonly used for contractor payouts and international settlement coordination.';
    case 'revenue_sharing':
      return 'Stripe is commonly used for collecting revenue while Wise or Hedera may support downstream settlement flows.';
    case 'event_settlement':
      return 'Projects with multiple payout parties often combine invoices, payment links, and staged settlement approvals.';
    case 'affiliate_payouts':
      return 'Affiliate and referral workflows typically prioritize payout tracking and reconciliation visibility.';
    case 'referral_commissions':
      return 'Referral commission workflows benefit from clear revenue collection plus obligation tracking before payout release.';
    case 'client_invoices':
      return 'Client billing workflows typically start with Stripe for collection, then coordinate downstream participant settlements.';
    default:
      return 'Connect providers when you are ready to collect revenue and coordinate payout readiness across your workspace.';
  }
}

export function getCollectionStyleNote(context: CopilotWorkflowContext): string | null {
  switch (context.collectionPreference) {
    case 'invoices':
      return 'Invoice-based collection feeds directly into your project settlement workspace for formal billing coordination.';
    case 'payment_links':
      return 'Link-based collection is suited for quick payments while still recording into the same settlement workspace.';
    case 'manual_transfers':
      return 'Manual payment tracking lets you record offline settlement without connecting a provider first.';
    case 'decide_later':
      return 'You can configure collection methods inside your workspace when operational needs become clearer.';
    default:
      return null;
  }
}

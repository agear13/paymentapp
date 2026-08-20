export const REFERRAL_MANAGEMENT_SLUG = 'referral-management';

export function referralManagementDealId(workflowId: string): string {
  return `rmwf-${workflowId}`;
}

export type ReferralPromoterRole = 'Promoter' | 'Affiliate' | 'Partner' | 'Other';

export type ReferralCompensationInput =
  | {
      kind: 'revenue_share';
      percentage: number;
      serviceId: string;
    }
  | {
      kind: 'fixed';
      amount: number;
      currency: string;
      serviceId: string;
    };

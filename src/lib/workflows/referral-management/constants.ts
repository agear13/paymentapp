export const REFERRAL_MANAGEMENT_SLUG = 'referral-management';

export function referralManagementDealId(workflowId: string): string {
  return `rmwf-${workflowId}`;
}

export type ReferralPromoterRole = 'Promoter' | 'Affiliate' | 'Partner' | 'Other';

export type ReferralCompensationInput =
  | {
      kind: 'revenue_share';
      percentage: number;
      /** @deprecated Prefer `serviceIds`. Kept so existing callers stay valid. */
      serviceId?: string;
      serviceIds?: string[];
    }
  | {
      kind: 'fixed';
      amount: number;
      currency: string;
      /** @deprecated Prefer `serviceIds`. Kept so existing callers stay valid. */
      serviceId?: string;
      serviceIds?: string[];
    };

export function compensationServiceIds(input: ReferralCompensationInput): string[] {
  const fromList = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const fromSingle = input.serviceId ? [input.serviceId] : [];
  return [...new Set([...fromList, ...fromSingle].map((id) => id.trim()).filter(Boolean))];
}

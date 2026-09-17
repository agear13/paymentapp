/**
 * Commercial Incentive Advisor — early-payment recommendation types.
 *
 * Recommendations are Provvy-proposed, never extracted terms.
 * They are not applied until a human explicitly approves.
 */

export const EARLY_PAYMENT_INCENTIVE_KIND = 'early_payment_discount' as const;
export const EARLY_PAYMENT_COMPENSATION_TYPE = 'conditional_bonus' as const;
export const EARLY_PAYMENT_ORIGIN = 'provvy_recommendation' as const;

export type EarlyPaymentIncentiveDecisionStatus = 'proposed' | 'approved' | 'dismissed';

export type DelayedPaymentTermMatch = {
  index: number;
  description: string | null;
  dueCondition: string | null;
  amount: number | null;
  currency: string | null;
  delayedDays: number;
};

export type EarlyPaymentIncentiveEconomics = {
  milestoneAmount: number | null;
  milestoneDiscountAmount: number | null;
  earlyPaymentAmount: number | null;
  daysEarlier: number;
  milestoneCount: number;
  totalIllustrativeDiscount: number | null;
  amountsReliable: boolean;
  currency: string | null;
};

export type EarlyPaymentIncentiveRecommendation = {
  kind: typeof EARLY_PAYMENT_INCENTIVE_KIND;
  origin: typeof EARLY_PAYMENT_ORIGIN;
  status: 'proposed';
  compensationType: typeof EARLY_PAYMENT_COMPENSATION_TYPE;
  policyId: string;
  standardDays: number;
  acceleratedDays: number;
  incentivePercent: number;
  sourceDueLabel: string;
  delayedTerms: DelayedPaymentTermMatch[];
  economics: EarlyPaymentIncentiveEconomics;
  trigger: string;
  label: string;
};

export type EarlyPaymentIncentiveRecord = {
  kind: typeof EARLY_PAYMENT_INCENTIVE_KIND;
  origin: typeof EARLY_PAYMENT_ORIGIN;
  status: 'approved' | 'dismissed';
  compensationType: typeof EARLY_PAYMENT_COMPENSATION_TYPE;
  policyId: string;
  standardDays: number;
  acceleratedDays: number;
  incentivePercent: number;
  sourceDueLabel: string;
  sourceAgreementId: string;
  workflowId: string;
  economics: EarlyPaymentIncentiveEconomics;
  trigger: string;
  label: string;
  decidedAt: string;
  decidedByUserId: string;
};

export type EarlyPaymentIncentiveView = {
  agreementId: string | null;
  workflowId: string | null;
  hasExtraction: boolean;
  originalDueLabels: string[];
  recommendation: EarlyPaymentIncentiveRecommendation | null;
  decision: EarlyPaymentIncentiveRecord | null;
  disclaimer: string;
};

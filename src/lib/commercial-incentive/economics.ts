import { EARLY_PAYMENT_INCENTIVE_POLICY } from '@/lib/commercial-incentive/policy';
import type { EarlyPaymentIncentiveEconomics } from '@/lib/commercial-incentive/types';

export function incentiveDiscountAmount(amount: number, percent: number): number {
  return Math.round(amount * (percent / 100) * 100) / 100;
}

export function daysEarlier(standardDays: number, acceleratedDays: number): number {
  return standardDays - acceleratedDays;
}

export function calculateEarlyPaymentEconomics(input: {
  milestoneAmounts: number[];
  currency: string | null;
  standardDays: number;
  acceleratedDays?: number;
  incentivePercent?: number;
}): EarlyPaymentIncentiveEconomics {
  const acceleratedDays = input.acceleratedDays ?? EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays;
  const incentivePercent = input.incentivePercent ?? EARLY_PAYMENT_INCENTIVE_POLICY.incentivePercent;
  const amounts = input.milestoneAmounts.filter((amount) => Number.isFinite(amount) && amount > 0);
  const amountsReliable = amounts.length > 0;
  const milestoneAmount = amountsReliable ? amounts[0] : null;
  const milestoneDiscountAmount =
    milestoneAmount == null ? null : incentiveDiscountAmount(milestoneAmount, incentivePercent);
  const earlyPaymentAmount =
    milestoneAmount == null || milestoneDiscountAmount == null
      ? null
      : Math.round((milestoneAmount - milestoneDiscountAmount) * 100) / 100;
  const totalIllustrativeDiscount = amountsReliable
    ? Math.round(
        amounts.reduce((sum, amount) => sum + incentiveDiscountAmount(amount, incentivePercent), 0) *
          100
      ) / 100
    : null;

  return {
    milestoneAmount,
    milestoneDiscountAmount,
    earlyPaymentAmount,
    daysEarlier: daysEarlier(input.standardDays, acceleratedDays),
    milestoneCount: amountsReliable ? amounts.length : 0,
    totalIllustrativeDiscount,
    amountsReliable,
    currency: input.currency,
  };
}

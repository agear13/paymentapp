import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type { ParticipantReferralCommerce } from '@/lib/referrals/referral-commerce-config';

export type ScopedServiceCommissionRow = {
  id: string;
  name: string;
  customerPrice: number;
  currency: string;
  revenueSharePct: number | null;
  estimatedEarnings: number | null;
  earningsLabel: string;
};

export function formatFixedPayoutLine(
  amount: number,
  currency = 'AUD',
  options?: { estimated?: boolean }
): string {
  const formatted = formatCurrency(amount, currency);
  return options?.estimated ? `Estimated payout: ${formatted}` : `Fixed payout: ${formatted}`;
}

export function formatRevenueShareLine(pct: number, currency?: string): string {
  const base = `${pct}% revenue share`;
  return currency ? `${base} (${currency})` : base;
}

export function formatParticipationEarningsSummary(participant: DemoParticipant): string {
  const currency = 'AUD';
  if (participant.participationModel === 'fixed_payout') {
    return formatFixedPayoutLine(participant.commissionValue, currency);
  }
  if (participant.participationModel === 'revenue_share') {
    return formatRevenueShareLine(participant.commissionValue, currency);
  }
  if (participant.commissionKind === 'fixed_amount') {
    return formatFixedPayoutLine(participant.commissionValue, currency);
  }
  if (participant.commissionKind === 'pct_deal_value') {
    return formatRevenueShareLine(participant.commissionValue, currency);
  }
  return 'Per project agreement';
}

export function buildScopedServiceCommissionRows(input: {
  services: Array<{ id: string; name: string; price: number; currency: string }>;
  commerce?: ParticipantReferralCommerce | null;
  allServicesFallback?: boolean;
}): ScopedServiceCommissionRow[] {
  const commerce = input.commerce;
  if (!commerce || commerce.commissionMode !== 'referral_commerce') {
    return [];
  }

  const pct = commerce.commerceCommissionPct ?? 10;
  const scopedIds = commerce.enabledServiceIds ?? [];
  const list =
    scopedIds.length > 0
      ? input.services.filter((s) => scopedIds.includes(s.id))
      : input.allServicesFallback !== false
        ? input.services
        : [];

  return list.map((s) => {
    const estimated = (s.price * pct) / 100;
    return {
      id: s.id,
      name: s.name,
      customerPrice: s.price,
      currency: s.currency,
      revenueSharePct: pct,
      estimatedEarnings: estimated,
      earningsLabel: formatCurrency(estimated, s.currency),
    };
  });
}

export function formatApprovalTimestamp(iso?: string | null): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

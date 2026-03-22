/**
 * Derived KPIs from demo pipeline (RecentDeal[]) — local state only.
 */

import type { DealStatus, RecentDeal } from '@/lib/data/mock-deal-network';

const PENDING_ENTITLEMENT_STATUSES: DealStatus[] = [
  'Pending',
  'Eligible',
  'In Review',
  'Approved',
];

export function computePipelineMetrics(deals: RecentDeal[]) {
  const openDeals = deals.filter(
    (d) => d.status !== 'Paid' && d.status !== 'Reversed'
  ).length;

  const commissionsPending = deals
    .filter((d) => PENDING_ENTITLEMENT_STATUSES.includes(d.status))
    .reduce((sum, d) => sum + d.commission, 0);

  const commissionsPaid = deals
    .filter((d) => d.status === 'Paid')
    .reduce((sum, d) => sum + d.commission, 0);

  return { openDeals, commissionsPending, commissionsPaid };
}

export function formatUsdCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

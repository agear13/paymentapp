/**
 * Local helpers for Commission Operations / Deal Network interactive demo only.
 * No backend — safe to replace with API-driven logic later.
 */

import type { CommissionSplit, DealStatus, FeaturedDeal, FunnelStage, RecentDeal } from '@/lib/data/mock-deal-network';

function toDefinedAmount(v: number | undefined): number | null {
  if (v == null) return null;
  if (!Number.isFinite(v) || v < 0) return null;
  return v;
}

export function getDealCommissionTotal(deal: RecentDeal): number | null {
  const intro = toDefinedAmount(deal.introducerAmount);
  const closer = toDefinedAmount(deal.closerAmount);
  const platform = toDefinedAmount(deal.platformFee);
  if (intro == null || closer == null || platform == null) return null;
  return intro + closer + platform;
}

export function getDealRolePayout(
  deal: RecentDeal,
  role: 'Introducer' | 'Closer' | 'Platform' | 'Connector' | 'Contributor'
): number | null {
  if (getDealCommissionTotal(deal) == null) return null;
  if (role === 'Introducer') return toDefinedAmount(deal.introducerAmount);
  if (role === 'Closer') return toDefinedAmount(deal.closerAmount);
  if (role === 'Platform') return toDefinedAmount(deal.platformFee);
  return 0;
}

/** Explicit commission preview for the featured/detail card. */
export function buildExplicitCommissionSplits(deal: RecentDeal): CommissionSplit[] {
  const intro = toDefinedAmount(deal.introducerAmount);
  const closer = toDefinedAmount(deal.closerAmount);
  const platform = toDefinedAmount(deal.platformFee);
  if (intro == null || closer == null || platform == null) return [];
  return [
    { role: 'Introducer', name: deal.introducer, amount: intro },
    { role: 'Closer', name: deal.closer, amount: closer },
    { role: 'Rabbit Hole / Platform', name: 'Platform', amount: platform },
  ];
}

/** Map pipeline row → featured/detail card shape (single source of truth: RecentDeal). */
export function recentDealToFeatured(deal: RecentDeal): FeaturedDeal {
  return {
    id: deal.id,
    name: deal.dealName,
    dealValue: deal.value,
    status: deal.status,
    introducer: deal.introducer,
    closer: deal.closer,
    partner: deal.partner,
    payoutTrigger: deal.payoutTrigger ?? 'Manual',
    commissionSplits: buildExplicitCommissionSplits(deal),
  };
}

/** Settlement progression for clickable badges (demo). */
const SETTLEMENT_CYCLE: DealStatus[] = ['Pending', 'Eligible', 'Approved', 'Paid'];

export function getNextSettlementStatus(current: DealStatus): DealStatus {
  if (SETTLEMENT_CYCLE.includes(current)) {
    const i = SETTLEMENT_CYCLE.indexOf(current);
    return i < SETTLEMENT_CYCLE.length - 1 ? SETTLEMENT_CYCLE[i + 1] : 'Paid';
  }
  // In Review / Reversed / unknown → start cycle at Pending
  return 'Pending';
}

/** Map deal row status to funnel bucket label (4-stage funnel). */
export function statusToFunnelLabel(status: DealStatus): string | null {
  if (status === 'Pending' || status === 'In Review') return 'Pending';
  if (status === 'Eligible') return 'Eligible';
  if (status === 'Approved') return 'Approved';
  if (status === 'Paid') return 'Paid';
  return null;
}

export function adjustFunnelCounts(
  stages: FunnelStage[],
  fromLabel: string | null,
  toLabel: string | null
): FunnelStage[] {
  if (!fromLabel && !toLabel) return stages;
  if (fromLabel === toLabel) return stages;
  return stages.map((s) => {
    let c = s.count;
    if (fromLabel && s.label === fromLabel) c -= 1;
    if (toLabel && s.label === toLabel) c += 1;
    return { ...s, count: Math.max(0, c) };
  });
}

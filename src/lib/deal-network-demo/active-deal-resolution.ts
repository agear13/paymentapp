/**
 * Deterministic active-deal selection for Deal Network / Commission Operations.
 * Keeps UI stable across hydration, invalid ids, and archived-only pipelines.
 */

import type { RecentDeal } from '@/lib/data/mock-deal-network';

const STORAGE_KEY = 'provvypay.dealNetwork.activeDealId';

export function getPreferredDealIdFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function persistPreferredDealIdToSession(dealId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (dealId.trim()) sessionStorage.setItem(STORAGE_KEY, dealId);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Pick a valid deal id to highlight and scope the "active deal" panel.
 * - Prefers a non-archived deal when the selected deal is archived.
 * - Falls back to the first open pipeline deal, then any deal.
 */
export function resolveActiveDealId(
  deals: RecentDeal[],
  preferredId: string | null | undefined
): string | null {
  if (!deals.length) return null;

  const nonArchived = deals.filter((d) => !d.archived);
  const pickFirst = (): string => nonArchived[0]?.id ?? deals[0].id;

  const trimmed = typeof preferredId === 'string' ? preferredId.trim() : '';
  if (!trimmed) return pickFirst();

  const match = deals.find((d) => d.id === trimmed);
  if (!match) return pickFirst();
  if (match.archived && nonArchived.length > 0) return nonArchived[0].id;
  return trimmed;
}

/** Deal shown in the preview — always defined when `deals.length > 0` after resolution. */
export function resolvePreviewDeal(deals: RecentDeal[], resolvedId: string | null): RecentDeal | null {
  if (!deals.length) return null;
  if (resolvedId) {
    const hit = deals.find((d) => d.id === resolvedId);
    if (hit) return hit;
  }
  return deals.find((d) => !d.archived) ?? deals[0] ?? null;
}

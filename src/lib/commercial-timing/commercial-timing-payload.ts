import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  parseAgreementCommercialTiming,
  serializeAgreementCommercialTiming,
} from '@/lib/commercial-timing/serialization';
import type { AgreementCommercialTiming } from '@/lib/commercial-timing/types';

/** Read agreement commercial timing from deal_payload. */
export function commercialTimingFromDeal(
  deal: RecentDeal | null | undefined
): AgreementCommercialTiming {
  const raw = deal?.commercialTiming;
  if (!raw) return {};
  return parseAgreementCommercialTiming(raw);
}

/** Update agreement commercial timing on a deal list (in-memory / API pattern). */
export function updateCommercialTimingInDeals(
  deals: RecentDeal[],
  projectId: string,
  timing: AgreementCommercialTiming
): RecentDeal[] {
  return deals.map((d) =>
    d.id === projectId
      ? {
          ...d,
          commercialTiming: serializeAgreementCommercialTiming(timing),
          lastUpdated: new Date().toISOString(),
        }
      : d
  );
}

/** Merge partial timing updates into existing agreement timing. */
export function mergeAgreementCommercialTiming(
  existing: AgreementCommercialTiming,
  patch: Partial<AgreementCommercialTiming>
): AgreementCommercialTiming {
  return {
    ...existing,
    ...patch,
  };
}

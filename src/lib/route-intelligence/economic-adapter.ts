import type {
  ProviderFeeObservation,
  RouteAvailabilityObservation,
  RouteFxObservation,
  RouteSettlementObservation,
  RouteSubject,
} from '@/lib/route-intelligence/types';

/**
 * Boundary for a future official economic source.
 * Adapters must not scrape the web, invent rates, or call credentialed APIs
 * unless a later phase explicitly adds that source.
 */
export type EconomicSourceReadInput = {
  route: RouteSubject;
  amount?: number | null;
  paymentType?: string | null;
  now?: Date;
};

export type EconomicSourceAdapter = {
  sourceId: string;
  sourceUrl: string;
  readFee?(input: EconomicSourceReadInput): ProviderFeeObservation | null;
  readFx?(input: EconomicSourceReadInput): RouteFxObservation | null;
  readSettlement?(input: EconomicSourceReadInput): RouteSettlementObservation | null;
  readAvailability?(input: EconomicSourceReadInput): RouteAvailabilityObservation | null;
};

export type FixtureEconomicSource = {
  sourceId: 'phase8_fixture_adapter';
  sourceUrl: 'https://example.test/route-intelligence/economic-fixture';
  fees: readonly ProviderFeeObservation[];
  fx: readonly RouteFxObservation[];
  settlements: readonly RouteSettlementObservation[];
  availability: readonly RouteAvailabilityObservation[];
};

/**
 * Test-only adapter. Returns pre-built observations; never fetches a network host.
 */
export function createFixtureEconomicAdapter(
  fixture: Omit<FixtureEconomicSource, 'sourceId' | 'sourceUrl'> &
    Partial<Pick<FixtureEconomicSource, 'sourceId' | 'sourceUrl'>>
): EconomicSourceAdapter {
  const sourceId = fixture.sourceId ?? 'phase8_fixture_adapter';
  const sourceUrl = fixture.sourceUrl ?? 'https://example.test/route-intelligence/economic-fixture';
  return {
    sourceId,
    sourceUrl,
    readFee: () => fixture.fees[0] ?? null,
    readFx: () => fixture.fx[0] ?? null,
    readSettlement: () => fixture.settlements[0] ?? null,
    readAvailability: () => fixture.availability[0] ?? null,
  };
}

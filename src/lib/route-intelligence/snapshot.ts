import {
  LANDING_PROVIDER_CATALOG_UPDATED,
} from '@/lib/journey/landing-provider-catalog';
import { PAYMENT_INTELLIGENCE_SNAPSHOT_DATE } from '@/lib/journey/payment-intelligence-feed';
import {
  getStaticCatalogOfferings,
  mapCatalogOfferings,
} from '@/lib/route-intelligence/catalog-adapter';
import { CORRIDOR_CAPABILITY_MATRIX } from '@/lib/route-intelligence/capability-matrix';
import { assertSupportedRequiresEvidence } from '@/lib/route-intelligence/coverage';
import { mapCuratedDevelopments } from '@/lib/route-intelligence/developments-adapter';
import {
  attachedObservations,
  attachWisePaymentsAvailability,
  partitionActiveIncidents,
  WISE_PAYMENTS_COMPONENT_ID,
} from '@/lib/route-intelligence/observation';
import { OFFERING_RAIL_MAPPINGS } from '@/lib/route-intelligence/offering-rail';
import { NETWORK_RAIL_CATALOGUE } from '@/lib/route-intelligence/network-rail';
import { RAIL_CAPABILITY_CATALOGUE } from '@/lib/route-intelligence/rail-capability';
import { getRouteEconomicState } from '@/lib/route-intelligence/economic-state';
import { evaluateRegulatoryRouteImpacts } from '@/lib/route-intelligence/regulatory-impact';
import { evaluateRouteEligibilities } from '@/lib/route-intelligence/route-eligibility';
import { evaluateRouteImpacts } from '@/lib/route-intelligence/route-impact';
import type {
  PublicRouteIntelligenceSnapshot,
  PublicRouteIntelligenceSnapshotInput,
} from '@/lib/route-intelligence/types';

/**
 * Catalog/static public snapshot.
 * Read-only compose — never fetches a provider status API.
 */
export function getPublicRouteIntelligenceSnapshot(
  input: PublicRouteIntelligenceSnapshotInput = {}
): PublicRouteIntelligenceSnapshot {
  const catalogOfferings = getStaticCatalogOfferings();
  for (const row of CORRIDOR_CAPABILITY_MATRIX) {
    assertSupportedRequiresEvidence(row);
  }
  const offerings = attachWisePaymentsAvailability(
    mapCatalogOfferings(catalogOfferings),
    input.wisePaymentsHealth
  );
  const now = input.now ?? new Date();
  const { paymentIncidents, otherIncidents } = partitionActiveIncidents(
    input.wiseIncidents ?? [],
    WISE_PAYMENTS_COMPONENT_ID,
    now
  );
  const hasObservations = Boolean(input.wisePaymentsHealth || input.wiseIncidents?.length);
  const routeImpacts = input.evaluateRoutes
    ? evaluateRouteImpacts(input.evaluateRoutes, {
        health: input.wisePaymentsHealth,
        incidents: input.wiseIncidents ?? [],
        now,
      })
    : [];
  const eligibilityDecisions = input.evaluateRoutes
    ? evaluateRouteEligibilities(input.evaluateRoutes, {
        health: input.wisePaymentsHealth,
        incidents: input.wiseIncidents ?? [],
        now,
      })
    : [];
  return {
    kind: hasObservations ? 'catalog_plus_observations' : 'catalog_static',
    catalogUpdated: LANDING_PROVIDER_CATALOG_UPDATED,
    intelligenceSnapshotDate: PAYMENT_INTELLIGENCE_SNAPSHOT_DATE,
    freshness: 'catalog_snapshot',
    provenance: 'curated',
    offerings,
    catalogOfferings,
    developments: mapCuratedDevelopments(),
    capabilities: CORRIDOR_CAPABILITY_MATRIX,
    observations: attachedObservations(input.wisePaymentsHealth),
    incidents: paymentIncidents,
    otherIncidents,
    routeImpacts,
    eligibilityDecisions,
    // Shadow only — ranking and eligibility do not read this field.
    feeObservations: input.feeObservations ?? [],
    networkRails: [...NETWORK_RAIL_CATALOGUE],
    railCapabilities: [...RAIL_CAPABILITY_CATALOGUE],
    offeringRailMappings: [...OFFERING_RAIL_MAPPINGS],
    regulatoryObservations: input.regulatoryObservations ?? [],
    regulatoryImpacts: input.evaluateRouteSubjects
      ? evaluateRegulatoryRouteImpacts(
          input.evaluateRouteSubjects,
          input.regulatoryObservations ?? [],
          {
            now,
            paymentType: input.regulatoryPaymentType,
            participantType: input.regulatoryParticipantType,
          }
        )
      : [],
    fxObservations: input.fxObservations ?? [],
    settlementObservations: input.settlementObservations ?? [],
    availabilityObservations: input.availabilityObservations ?? [],
    economicStates: input.evaluateRouteSubjects
      ? input.evaluateRouteSubjects.map((route) =>
          getRouteEconomicState(
            route,
            {
              feeObservations: input.feeObservations ?? [],
              fxObservations: input.fxObservations ?? [],
              settlementObservations: input.settlementObservations ?? [],
              availabilityObservations: input.availabilityObservations ?? [],
            },
            {
              now,
              amount: input.economicAmount ?? null,
              paymentType: input.regulatoryPaymentType,
            }
          )
        )
      : [],
  };
}

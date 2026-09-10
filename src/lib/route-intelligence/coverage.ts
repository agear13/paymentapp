import { evidenceIsSufficient } from '@/lib/route-intelligence/capability-evidence';
import type {
  CapabilityStatus,
  CorridorCapability,
} from '@/lib/route-intelligence/types';

export type CoverageQuery = {
  origin: string;
  destination: string;
  sourceCurrency: string | null;
  destinationCurrency: string | null;
  transactionType: string | null;
};

export type OfferingCoverage = {
  offeringId: string;
  status: CapabilityStatus;
  eligible: boolean;
  uncertainty: boolean;
  matchedCapabilityIds: string[];
};

/**
 * A declared supported/unsupported claim without evidence is unspecified.
 * This is the honesty gate: unspecified must never become supported here.
 */
export function declaredCapabilityStatus(
  status: CapabilityStatus,
  evidence: CorridorCapability['evidence'] | null | undefined
): CapabilityStatus {
  if (status === 'unspecified') return 'unspecified';
  if (!evidenceIsSufficient(evidence)) return 'unspecified';
  return status;
}

export function assertSupportedRequiresEvidence(row: CorridorCapability): void {
  if (row.status === 'supported' && !evidenceIsSufficient(row.evidence)) {
    throw new Error(`Capability ${row.id} is marked supported without evidence`);
  }
  if (row.status === 'unsupported' && !evidenceIsSufficient(row.evidence)) {
    throw new Error(`Capability ${row.id} is marked unsupported without evidence`);
  }
}

export function capabilityRowMatches(
  row: CorridorCapability,
  offeringId: string,
  query: CoverageQuery
): boolean {
  if (row.offeringId !== offeringId) return false;
  if (row.origin && row.origin !== query.origin) return false;
  if (row.destination && row.destination !== query.destination) return false;
  if (row.currencyPair.source && row.currencyPair.source !== query.sourceCurrency) return false;
  if (row.currencyPair.target) {
    if (!query.destinationCurrency) return false;
    if (row.currencyPair.target !== query.destinationCurrency) return false;
  } else if (query.destinationCurrency) {
    return false;
  }
  if (row.transactionType) {
    if (!query.transactionType) return false;
    if (row.transactionType !== query.transactionType) return false;
  }
  return true;
}

export function evaluateOfferingCoverage(
  offeringId: string,
  query: CoverageQuery,
  capabilities: readonly CorridorCapability[]
): OfferingCoverage {
  const matched = capabilities.filter((row) => capabilityRowMatches(row, offeringId, query));
  const statuses = matched.map((row) => declaredCapabilityStatus(row.status, row.evidence));

  if (statuses.includes('unsupported')) {
    return {
      offeringId,
      status: 'unsupported',
      eligible: false,
      uncertainty: false,
      matchedCapabilityIds: matched.map((row) => row.id),
    };
  }

  if (statuses.includes('supported')) {
    return {
      offeringId,
      status: 'supported',
      eligible: true,
      uncertainty: false,
      matchedCapabilityIds: matched.map((row) => row.id),
    };
  }

  return {
    offeringId,
    status: 'unspecified',
    eligible: true,
    uncertainty: true,
    matchedCapabilityIds: matched.map((row) => row.id),
  };
}

export function coverageQueryFromSearch(query: {
  originCountry: string;
  destinationCountry: string;
  currency: string;
  transactionType: string;
  destinationCurrency?: string | null;
}): CoverageQuery {
  return {
    origin: query.originCountry,
    destination: query.destinationCountry,
    sourceCurrency: query.currency,
    destinationCurrency: query.destinationCurrency ?? null,
    transactionType: query.transactionType,
  };
}

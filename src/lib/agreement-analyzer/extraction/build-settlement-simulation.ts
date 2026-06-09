import { flattenRevenueSplitItems } from '@/lib/agreement-analyzer/evaluation/semantic-matching';
import type {
  AgreementReportJson,
  AgreementSettlementSimulation,
  AgreementSettlementSimulationParticipant,
} from '@/lib/agreement-analyzer/extraction/extraction-types';

export const DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD = 10_000;

const SPLIT_PARTY_FIELDS = ['party', 'beneficiary', 'payee', 'recipient'] as const;
const SPLIT_PERCENTAGE_FIELDS = ['percentage', 'percent', 'share', 'split'] as const;
const SPLIT_FIXED_AMOUNT_FIELDS = ['fixedAmount', 'amount', 'fixed', 'flatFee', 'guarantee'] as const;
const SPLIT_BASIS_FIELDS = ['basis', 'metric', 'definition', 'netDefinition', 'description'] as const;

const UNSUPPORTED_REVENUE_SHARE_NOTE =
  'Revenue-sharing language detected but settlement rules could not be determined.';
const UNSUPPORTED_NO_SPLITS_NOTE =
  'No revenue-sharing splits were identified for settlement simulation.';

function asRecord(item: unknown): Record<string, unknown> | null {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? (item as Record<string, unknown>)
    : null;
}

function pickString(record: Record<string, unknown>, fields: readonly string[]): string {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickNumber(record: Record<string, unknown>, fields: readonly string[]): number | null {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(/[^0-9.]+/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function readRevenueSplits(source: unknown): unknown[] {
  if (!source || typeof source !== 'object' || !('revenueSplits' in source)) {
    return [];
  }
  const splits = (source as { revenueSplits?: unknown }).revenueSplits;
  return Array.isArray(splits) ? splits : [];
}

export function extractPrimaryLayerSplits(revenueSplits: unknown[]): unknown[] {
  if (revenueSplits.length === 0) {
    return [];
  }

  const firstRecord = asRecord(revenueSplits[0]);
  if (firstRecord && Array.isArray(firstRecord.splits) && firstRecord.splits.length > 0) {
    return firstRecord.splits;
  }

  const allLayered = revenueSplits.every((item) => {
    const record = asRecord(item);
    return record != null && Array.isArray(record.splits);
  });

  if (allLayered) {
    const firstLayer = asRecord(revenueSplits[0]);
    return Array.isArray(firstLayer?.splits) ? (firstLayer.splits as unknown[]) : [];
  }

  return revenueSplits;
}

type ParsedSplit = {
  party: string;
  percentage: number | null;
  fixedAmount: number | null;
  basis?: string;
};

function parseSplitItem(item: unknown): ParsedSplit | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const party = pickString(record, SPLIT_PARTY_FIELDS);
  if (!party) {
    return null;
  }

  const percentage = pickNumber(record, SPLIT_PERCENTAGE_FIELDS);
  const fixedAmount = pickNumber(record, SPLIT_FIXED_AMOUNT_FIELDS);
  const basis = pickString(record, SPLIT_BASIS_FIELDS) || pickString(record, ['trigger']);

  return {
    party,
    percentage,
    fixedAmount,
    basis: basis || undefined,
  };
}

function hasRevenueSharingSignals(reportJson: AgreementReportJson, extractionJson: unknown): boolean {
  const reportSplits = reportJson.revenueSplits.length > 0;
  const extractionSplits = readRevenueSplits(extractionJson).length > 0;
  return reportSplits || extractionSplits;
}

function buildParticipant(
  split: ParsedSplit,
  simulationRevenue: number
): AgreementSettlementSimulationParticipant | null {
  let estimatedPayout: number | null = null;

  if (split.percentage != null) {
    estimatedPayout = roundCurrency((simulationRevenue * split.percentage) / 100);
  } else if (split.fixedAmount != null) {
    estimatedPayout = roundCurrency(split.fixedAmount);
  }

  if (estimatedPayout == null) {
    return null;
  }

  return {
    party: split.party,
    percentage: split.percentage ?? undefined,
    fixedAmount: split.fixedAmount ?? undefined,
    estimatedPayout,
    basis: split.basis,
  };
}

function buildUnsupportedSimulation(
  notes: string[],
  simulationRevenue = DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD
): AgreementSettlementSimulation {
  return {
    supported: false,
    simulationRevenue,
    participants: [],
    notes,
  };
}

export function buildProvvypayInsight(
  simulation: AgreementSettlementSimulation,
  partyCount: number
): string | null {
  if (
    simulation.supported &&
    simulation.participants.some((participant) => participant.percentage != null)
  ) {
    return 'Provvypay can automate revenue allocation and settlement execution for agreements like this.';
  }

  const participantCount =
    simulation.participants.length > 0 ? simulation.participants.length : partyCount;

  if (participantCount >= 3) {
    return 'This agreement contains a multi-party settlement structure that is commonly managed using spreadsheets and manual transfers.';
  }

  if (participantCount === 2) {
    return 'This agreement could be settled automatically using Provvypay.';
  }

  return null;
}

export function buildSettlementSimulation(
  reportJson: AgreementReportJson,
  extractionJson?: unknown
): AgreementSettlementSimulation {
  const simulationRevenue = DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD;
  const sourceSplits =
    reportJson.revenueSplits.length > 0
      ? reportJson.revenueSplits
      : readRevenueSplits(extractionJson);
  const primaryLayer = extractPrimaryLayerSplits(sourceSplits);
  const flattenedLayer =
    primaryLayer.length > 0 ? flattenRevenueSplitItems(primaryLayer) : primaryLayer;

  if (flattenedLayer.length === 0) {
    return buildUnsupportedSimulation(
      hasRevenueSharingSignals(reportJson, extractionJson)
        ? [UNSUPPORTED_REVENUE_SHARE_NOTE]
        : [UNSUPPORTED_NO_SPLITS_NOTE]
    );
  }

  const participants = flattenedLayer
    .map((item) => parseSplitItem(item))
    .filter((split): split is ParsedSplit => split != null)
    .map((split) => buildParticipant(split, simulationRevenue))
    .filter((participant): participant is AgreementSettlementSimulationParticipant => participant != null);

  if (participants.length === 0) {
    return buildUnsupportedSimulation([UNSUPPORTED_REVENUE_SHARE_NOTE], simulationRevenue);
  }

  return {
    supported: true,
    simulationRevenue,
    participants,
  };
}

import type { ExtractionResult, ExtractedParty, ExtractionConfidence } from './extraction-types';

export interface ExtractionSummaryStats {
  projectCount: number;
  participantCount: number;
  fixedPayoutCount: number;
  revenueShareCount: number;
  attributionCount: number;
  oneLiner: string;
}

const CONFIDENCE_RANK: Record<ExtractionConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  absent: 0,
};

function lowestConfidence(confidences: ExtractionConfidence[]): ExtractionConfidence {
  return confidences.reduce<ExtractionConfidence>((lowest, c) =>
    CONFIDENCE_RANK[c] < CONFIDENCE_RANK[lowest] ? c : lowest,
    'high'
  );
}

/** Derive per-party confidence from its critical fields. */
export function derivePartyConfidence(party: ExtractedParty): ExtractionConfidence {
  const critical: ExtractionConfidence[] = [
    party.name.confidence,
    party.participationModel.confidence,
  ];
  if (party.participationModel.value === 'fixed_payout') {
    critical.push(party.fixedAmount.confidence);
  } else if (party.participationModel.value === 'revenue_share') {
    critical.push(party.revenueSharePct.confidence);
  }
  return lowestConfidence(critical);
}

function formatAmount(value: number, currency: string): string {
  const formatted = value.toLocaleString('en-AU', { maximumFractionDigits: 0 });
  return `${currency} ${formatted}`;
}

/** Build a human-readable summary from an ExtractionResult without an extra AI call. */
export function buildExtractionSummary(result: ExtractionResult): ExtractionSummaryStats {
  const projectCount = result.projectName.value ? 1 : 0;
  const participantCount = result.parties.length;
  const fixedPayoutCount = result.parties.filter(
    (p) => p.participationModel.value === 'fixed_payout'
  ).length;
  const revenueShareCount = result.parties.filter(
    (p) => p.participationModel.value === 'revenue_share'
  ).length;
  const attributionCount = result.parties.filter(
    (p) => p.participationModel.value === 'customer_attribution'
  ).length;

  const project = result.projectName.value;
  const counterparty = result.counterparty.value;
  const firstParty = result.parties[0]?.name.value;
  const value = result.projectValue.value;
  const currency = result.currency.value || 'AUD';

  let oneLiner = '';

  if (project && firstParty && value) {
    const subject = counterparty ?? project;
    const amount = formatAmount(value, currency);
    oneLiner = `${subject} engaged ${firstParty} for ${amount}`;
    const others = result.parties.length - 1;
    if (others === 1) oneLiner += ` and 1 other participant`;
    else if (others > 1) oneLiner += ` and ${others} other participants`;
    oneLiner += '.';
  } else if (project && participantCount > 0) {
    oneLiner = `${participantCount} participant${participantCount > 1 ? 's' : ''} found for ${project}.`;
  } else if (firstParty && value) {
    oneLiner = `${firstParty} — ${formatAmount(value, currency)}.`;
  } else if (participantCount > 0) {
    oneLiner = `${participantCount} participant${participantCount > 1 ? 's' : ''} identified. Review fields below.`;
  } else {
    oneLiner = 'No agreement details detected. Please fill in all fields manually.';
  }

  return {
    projectCount,
    participantCount,
    fixedPayoutCount,
    revenueShareCount,
    attributionCount,
    oneLiner,
  };
}
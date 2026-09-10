import type { CapabilityEvidence, CapabilitySourceType } from '@/lib/route-intelligence/types';

export function catalogEvidence(input: {
  source: string;
  sourceUrl: string;
  sourceType: CapabilitySourceType;
  notes: string;
  publishedAt?: string | null;
  asOf?: string | null;
}): CapabilityEvidence {
  const publishedAt = input.publishedAt ?? null;
  const asOf = input.asOf ?? null;
  return {
    source: input.source,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    publishedAt,
    retrievedAt: null,
    asOf,
    notes: input.notes,
    freshness: publishedAt || asOf ? 'dated' : 'unknown',
    staleAfterDays: null,
  };
}

export function evidenceIsSufficient(evidence: CapabilityEvidence | null | undefined): boolean {
  return Boolean(evidence?.source?.trim() && evidence.sourceUrl?.trim() && evidence.notes?.trim());
}

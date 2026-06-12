import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type {
  ExtractionConfidence,
  ExtractionResult,
  ExtractorEntryPoint,
  ParticipationModelOption,
  SourceType,
} from '@/lib/ai-extractor/extraction-types';
import { EXTRACTOR_VERSION, SOURCE_TYPE_LABELS } from '@/lib/ai-extractor/extraction-types';
import {
  buildExtractionSummary,
  derivePartyConfidence,
  type ExtractionSummaryStats,
} from '@/lib/ai-extractor/extraction-summary';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
import {
  describeExtractedCompensationGap,
  wasExtractedCompensationIncomplete,
} from '@/lib/ai-extractor/compensation-review-validation';
import { participationModelLabel } from '@/lib/projects/participant-entitlement';

export type {
  ConversationImportAuditPayload,
  ConversationImportAuditRecord,
  ConversationImportExtractionSummary,
  ConversationImportPartyRecord,
} from '@/lib/operations/audit/conversation-import-audit-types';

import type {
  ConversationImportAuditRecord,
  ConversationImportPartyRecord,
} from '@/lib/operations/audit/conversation-import-audit-types';

export function buildAgreementTypeLabel(stats: ExtractionSummaryStats): string {
  const parts: string[] = [];
  if (stats.fixedFeeObligationCount > 0) {
    parts.push(
      `${stats.fixedFeeObligationCount} fixed fee obligation${stats.fixedFeeObligationCount !== 1 ? 's' : ''}`
    );
  }
  if (stats.revenueShareObligationCount > 0) {
    parts.push(
      `${stats.revenueShareObligationCount} revenue share obligation${stats.revenueShareObligationCount !== 1 ? 's' : ''}`
    );
  }
  if (stats.hybridParticipantCount > 0) {
    parts.push(
      `${stats.hybridParticipantCount} hybrid participant${stats.hybridParticipantCount !== 1 ? 's' : ''}`
    );
  }
  if (stats.attributionCount > 0) {
    parts.push(
      `${stats.attributionCount} customer attribution${stats.attributionCount !== 1 ? 's' : ''}`
    );
  }
  if (parts.length === 0) return 'Participation terms pending review';
  return parts.join(', ');
}

export function buildConversationImportAuditRecord(input: {
  form: ReviewFormState;
  result: ExtractionResult;
  entryPoint: ExtractorEntryPoint;
  sourceType: SourceType;
}): ConversationImportAuditRecord {
  const importedAt = new Date().toISOString();
  const stats = buildExtractionSummary(input.result);
  const reviewedById = new Map(input.form.parties.map((p) => [p.id, p]));

  const parties: ConversationImportPartyRecord[] = [];
  for (const extracted of input.result.parties) {
    const reviewed = reviewedById.get(extracted.id);
    if (!reviewed?.name.trim()) continue;
    const participationModel: ParticipationModelOption =
      reviewed.participationModel ?? extracted.participationModel.value;
    const amountConfidence: ExtractionConfidence =
      participationModel === 'fixed_payout'
        ? extracted.fixedAmount.confidence
        : participationModel === 'revenue_share'
          ? extracted.revenueSharePct.confidence
          : extracted.participationModel.confidence;
    parties.push({
      name: reviewed.name.trim(),
      role: reviewed.role.trim() || extracted.role.value,
      email: reviewed.email.trim() || undefined,
      participationModel,
      fixedAmount: reviewed.fixedAmount,
      revenueSharePct: reviewed.revenueSharePct,
      extractedFixedAmount: extracted.fixedAmount.value,
      extractedRevenueSharePct: extracted.revenueSharePct.value,
      extractedCurrencyCode: input.form.extractedCurrencyCode ?? undefined,
      partyConfidence: derivePartyConfidence(extracted),
      nameConfidence: extracted.name.confidence,
      participationModelConfidence: extracted.participationModel.confidence,
      amountConfidence,
    });
  }

  return {
    id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    importedAt,
    extractedAt: input.result.extractedAt,
    sourceType: SOURCE_TYPE_LABELS[input.sourceType] ?? input.sourceType,
    extractorVersion: EXTRACTOR_VERSION,
    entryPoint: input.entryPoint,
    rawConversationText: input.form.rawConversationText?.trim() ?? '',
    extractionSummary: {
      oneLiner: stats.oneLiner,
      participantCount: parties.length,
      fixedFeeObligationCount: stats.fixedFeeObligationCount,
      revenueShareObligationCount: stats.revenueShareObligationCount,
      hybridParticipantCount: stats.hybridParticipantCount,
      attributionCount: stats.attributionCount,
      agreementTypeLabel: buildAgreementTypeLabel(stats),
      overallConfidence: input.result.overallConfidence,
    },
    parties,
    extractedCurrencyCode: input.form.extractedCurrencyCode ?? undefined,
    extractedProjectValue: input.result.projectValue.value,
  };
}

/** One-time migration: legacy scalar import → single history row (not used for timeline derivation). */
export function buildLegacyConversationImportRecord(
  deal: RecentDeal
): ConversationImportAuditRecord | null {
  if (!deal.importedConversation?.trim()) return null;
  return {
    id: `legacy-${deal.id}`,
    importedAt: deal.importedAt ?? deal.lastUpdated,
    extractedAt: deal.importedAt ?? deal.lastUpdated,
    sourceType: deal.sourceType ?? 'Unknown',
    extractorVersion: deal.extractorVersion ?? EXTRACTOR_VERSION,
    entryPoint: 'project_create',
    rawConversationText: deal.importedConversation,
    extractionSummary: {
      oneLiner: 'Imported from conversation (legacy record — summary not captured at import).',
      participantCount: 0,
      fixedFeeObligationCount: 0,
      revenueShareObligationCount: 0,
      hybridParticipantCount: 0,
      attributionCount: 0,
      agreementTypeLabel: 'Unknown',
      overallConfidence: 'absent',
    },
    parties: [],
  };
}

/**
 * Ensures `conversationImportHistory` is populated for legacy deals that only have
 * `importedConversation`. Does not replace or truncate existing history.
 */
export function materializeConversationImportHistoryForDeal(deal: RecentDeal): RecentDeal {
  const history = deal.conversationImportHistory ?? [];
  if (history.length > 0) return deal;
  const legacy = buildLegacyConversationImportRecord(deal);
  if (!legacy) return deal;
  return { ...deal, conversationImportHistory: [legacy] };
}

/**
 * Append-only merge when persisting deals: never drop prior import records.
 * Incoming payloads that omit history (stale client snapshot) keep stored history.
 */
export function mergeConversationImportHistoryOnDeal(
  existing: RecentDeal | null | undefined,
  incoming: RecentDeal
): RecentDeal {
  const existingDeal = existing
    ? materializeConversationImportHistoryForDeal(existing)
    : null;

  // Never materialize legacy from `importedConversation` on incoming alone — stale
  // client payloads often omit history while still carrying the latest scalar text.
  const existingHistory = existingDeal?.conversationImportHistory ?? [];
  const incomingHistory = incoming.conversationImportHistory ?? [];

  const seen = new Set(existingHistory.map((r) => r.id));
  const mergedHistory = [...existingHistory];
  for (const record of incomingHistory) {
    if (!seen.has(record.id)) {
      mergedHistory.push(record);
      seen.add(record.id);
    }
  }

  const history =
    mergedHistory.length > 0
      ? mergedHistory
      : incomingHistory.length > 0
        ? incomingHistory
        : existingHistory;

  return {
    ...incoming,
    conversationImportHistory: history.length > 0 ? history : undefined,
  };
}

export function appendConversationImportToDeal(
  deal: RecentDeal,
  record: ConversationImportAuditRecord
): RecentDeal {
  const base = materializeConversationImportHistoryForDeal(deal);
  const history = [...(base.conversationImportHistory ?? []), record];
  return {
    ...base,
    importedConversation: record.rawConversationText || base.importedConversation,
    importedAt: record.importedAt,
    sourceType: record.sourceType || base.sourceType,
    extractorVersion: record.extractorVersion || base.extractorVersion,
    conversationImportHistory: history,
  };
}

export function formatConversationImportDescription(
  record: ConversationImportAuditRecord
): string {
  const s = record.extractionSummary;
  const countLabel = `${s.participantCount} participant${s.participantCount !== 1 ? 's' : ''}`;
  return `${countLabel} · ${s.agreementTypeLabel} · imported ${new Date(record.importedAt).toLocaleString()}`;
}

export function conversationImportToAuditEntry(
  projectId: string,
  record: ConversationImportAuditRecord
): OperationalAuditEntry {
  return {
    id: `conversation-import-${record.id}`,
    type: 'conversation_imported',
    title: 'Conversation imported',
    description: formatConversationImportDescription(record),
    timestamp: record.importedAt,
    projectId,
    conversationImport: {
      importId: record.id,
      rawConversationText: record.rawConversationText,
      importedAt: record.importedAt,
      extractedAt: record.extractedAt,
      sourceType: record.sourceType,
      extractorVersion: record.extractorVersion,
      entryPoint: record.entryPoint,
      extractionSummary: record.extractionSummary,
      parties: record.parties,
    },
  };
}

export function deriveConversationImportAuditTimeline(
  deals: RecentDeal[],
  projectId?: string
): OperationalAuditEntry[] {
  const entries: OperationalAuditEntry[] = [];
  for (const deal of deals) {
    if (projectId && deal.id !== projectId) continue;
    const history = materializeConversationImportHistoryForDeal(deal).conversationImportHistory ?? [];
    for (const record of history) {
      entries.push(conversationImportToAuditEntry(deal.id, record));
    }
  }
  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function mergeConversationImportAuditTimeline(
  base: OperationalAuditEntry[],
  deals: RecentDeal[],
  projectId?: string
): OperationalAuditEntry[] {
  return mergeAuditTimeline(base, deriveConversationImportAuditTimeline(deals, projectId));
}

export function formatPartyCompensationTerms(party: ConversationImportPartyRecord): string {
  if (party.participationModel === 'hybrid') {
    const fixed =
      party.fixedAmount != null ? `$${party.fixedAmount.toLocaleString()} fixed` : 'fixed fee';
    const share =
      party.revenueSharePct != null ? `${party.revenueSharePct}% revenue share` : 'revenue share';
    return `Hybrid — ${fixed} + ${share}`;
  }
  if (party.participationModel === 'revenue_share') {
    return party.revenueSharePct != null ? `${party.revenueSharePct}% revenue share` : 'Revenue share';
  }
  if (party.participationModel === 'fixed_payout') {
    return party.fixedAmount != null ? `Fixed payout ${party.fixedAmount}` : 'Fixed payout';
  }
  if (party.participationModel === 'customer_attribution') {
    return participationModelLabel('customer_attribution');
  }
  return 'Participation terms pending review';
}

function formatConfidenceLabel(confidence: ExtractionConfidence): string {
  if (confidence === 'high') return 'High';
  if (confidence === 'medium') return 'Medium';
  if (confidence === 'low') return 'Low';
  return 'Absent';
}

export function formatPartyCompensationModelForAudit(
  party: ConversationImportPartyRecord
): string {
  if (party.participationModel === 'hybrid') return 'Hybrid Compensation';
  if (party.participationModel === 'revenue_share') return 'Revenue Share';
  if (party.participationModel === 'fixed_payout') return 'Fixed Payout';
  if (party.participationModel === 'customer_attribution') return 'Customer Attribution';
  return 'Participation terms pending review';
}

export function formatPartyExtractedValueForAudit(
  party: ConversationImportPartyRecord
): string {
  if (party.participationModel === 'hybrid') {
    const fixed = party.fixedAmount != null ? String(party.fixedAmount) : '—';
    const share = party.revenueSharePct != null ? `${party.revenueSharePct}%` : '—';
    return `${fixed} fixed + ${share} share`;
  }
  if (party.participationModel === 'revenue_share') {
    return party.revenueSharePct != null ? `${party.revenueSharePct}%` : 'Not Found';
  }
  if (party.participationModel === 'fixed_payout') {
    return party.fixedAmount != null ? String(party.fixedAmount) : 'Not Found';
  }
  return 'Attribution-based';
}

export function formatPartyAmountConfidenceForAudit(
  party: ConversationImportPartyRecord
): string {
  return formatConfidenceLabel(party.amountConfidence);
}

export function buildIncompleteExtractionCompensationAuditEntries(input: {
  projectId: string;
  result: ExtractionResult;
  importedAt?: string;
}): OperationalAuditEntry[] {
  const timestamp = input.importedAt ?? new Date().toISOString();
  const entries: OperationalAuditEntry[] = [];

  for (const original of input.result.parties) {
    if (!original.name.value.trim()) continue;
    if (!wasExtractedCompensationIncomplete(original)) continue;
    const description = describeExtractedCompensationGap(original);
    if (!description) continue;
    entries.push({
      id: `comp-extraction-incomplete-${original.id}-${timestamp}`,
      type: 'compensation_extraction_incomplete',
      title: 'Compensation terms require review',
      description,
      timestamp,
      projectId: input.projectId,
    });
  }

  return entries;
}

import type {
  ExtractedConditionalPayment,
  ExtractedParty,
  ExtractionConfidence,
  ExtractionField,
} from './extraction-types';

function field<T>(value: T, confidence: ExtractionConfidence = 'medium'): ExtractionField<T> {
  return { value, confidence };
}

function parseConditionalPaymentItem(raw: unknown): ExtractedConditionalPayment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  let trigger: string | null = null;
  let triggerConfidence: ExtractionConfidence = 'medium';
  const triggerRaw = obj.trigger;
  if (typeof triggerRaw === 'string') {
    trigger = triggerRaw.trim() || null;
  } else if (typeof triggerRaw === 'object' && triggerRaw !== null && 'value' in triggerRaw) {
    const t = triggerRaw as { value: unknown; confidence?: ExtractionConfidence };
    trigger = typeof t.value === 'string' ? t.value.trim() || null : null;
    triggerConfidence = t.confidence ?? 'medium';
  }

  let amount: number | null = null;
  let amountConfidence: ExtractionConfidence = 'medium';
  const amountRaw = obj.amount;
  if (typeof amountRaw === 'number') {
    amount = amountRaw;
  } else if (typeof amountRaw === 'object' && amountRaw !== null && 'value' in amountRaw) {
    const a = amountRaw as { value: unknown; confidence?: ExtractionConfidence };
    amount = typeof a.value === 'number' ? a.value : null;
    amountConfidence = a.confidence ?? 'medium';
  }

  if (!trigger || amount == null) return null;

  return {
    trigger: field(trigger, triggerConfidence),
    amount: field(amount, amountConfidence),
    ...(typeof obj.rawSnippet === 'string' ? { rawSnippet: obj.rawSnippet } : {}),
  };
}

export function parseConditionalPaymentsNonBlocking(raw: unknown): {
  items: ExtractedConditionalPayment[];
  droppedCount: number;
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { items: [], droppedCount: 0 };
  }

  const items: ExtractedConditionalPayment[] = [];
  let droppedCount = 0;
  for (const item of raw) {
    const parsed = parseConditionalPaymentItem(item);
    if (parsed) items.push(parsed);
    else droppedCount += 1;
  }
  return { items, droppedCount };
}

function parseBonusFromMilestoneDescription(description: string): ExtractedConditionalPayment | null {
  const isBonus = /bonus|conditional|if |attendance|exceed/i.test(description);
  if (!isBonus) return null;

  const amountMatch = description.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]!.replace(/,/g, ''));
  const triggerMatch = description.match(/if\s+(.+)$/i);
  const trigger = triggerMatch?.[1]?.trim() || description;

  return {
    trigger: field(trigger, 'medium'),
    amount: field(amount, 'medium'),
    rawSnippet: description.slice(0, 120),
  };
}

export function inferConditionalPaymentsFromParty(party: ExtractedParty): ExtractedConditionalPayment[] {
  if (party.conditionalPayments.length > 0) {
    return party.conditionalPayments;
  }

  const inferred: ExtractedConditionalPayment[] = [];
  for (const milestone of party.milestones ?? []) {
    if (milestone.category.value !== 'financial') continue;
    const description = milestone.description.value?.trim() ?? '';
    const parsed = parseBonusFromMilestoneDescription(description);
    if (parsed) inferred.push(parsed);
  }
  return inferred;
}

export function normalizePartyConditionalPayments(party: ExtractedParty): ExtractedParty {
  const conditionalPayments = inferConditionalPaymentsFromParty(party);
  return { ...party, conditionalPayments };
}

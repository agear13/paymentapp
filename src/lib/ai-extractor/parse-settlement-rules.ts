import type { ExtractedSettlementRule, ExtractionConfidence, ExtractionField } from './extraction-types';

function field<T>(value: T, confidence: ExtractionConfidence = 'medium'): ExtractionField<T> {
  return { value, confidence };
}

const HALLUCINATED_SETTLEMENT_PATTERNS = [
  /^monthly settlement$/i,
  /^net sales$/i,
  /^after processing fees$/i,
  /^on completion$/i,
  /^deliverable completion$/i,
];

export function isHallucinatedSettlementTrigger(trigger: string | null | undefined): boolean {
  if (!trigger?.trim()) return false;
  return HALLUCINATED_SETTLEMENT_PATTERNS.some((pattern) => pattern.test(trigger.trim()));
}

function parseSettlementRuleItem(raw: unknown): ExtractedSettlementRule | null {
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

  if (!trigger || isHallucinatedSettlementTrigger(trigger)) return null;

  let basis: string | null = null;
  let basisConfidence: ExtractionConfidence = 'absent';
  const basisRaw = obj.basis;
  if (typeof basisRaw === 'string') {
    basis = basisRaw.trim() || null;
    basisConfidence = 'medium';
  } else if (typeof basisRaw === 'object' && basisRaw !== null && 'value' in basisRaw) {
    const b = basisRaw as { value: unknown; confidence?: ExtractionConfidence };
    basis = typeof b.value === 'string' ? b.value.trim() || null : null;
    basisConfidence = b.confidence ?? 'absent';
  }

  return {
    trigger: field(trigger, triggerConfidence),
    basis: field(basis, basisConfidence),
    ...(typeof obj.rawSnippet === 'string' ? { rawSnippet: obj.rawSnippet } : {}),
  };
}

export function parseSettlementRulesNonBlocking(raw: unknown): {
  items: ExtractedSettlementRule[];
  droppedCount: number;
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { items: [], droppedCount: 0 };
  }

  const items: ExtractedSettlementRule[] = [];
  let droppedCount = 0;
  for (const item of raw) {
    const parsed = parseSettlementRuleItem(item);
    if (parsed) items.push(parsed);
    else droppedCount += 1;
  }
  return { items, droppedCount };
}

export function filterEvidenceBackedSettlementRules(
  rules: ExtractedSettlementRule[]
): ExtractedSettlementRule[] {
  return rules.filter(
    (rule) =>
      rule.trigger.value?.trim() &&
      !isHallucinatedSettlementTrigger(rule.trigger.value) &&
      rule.trigger.confidence !== 'absent'
  );
}

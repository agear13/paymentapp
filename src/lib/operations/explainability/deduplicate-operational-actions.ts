/**
 * Remove duplicate operational messaging across strip, hero, and attention board.
 */

import type { OperationalAction } from '@/lib/operations/explainability/types';
import type { AttentionItem } from '@/lib/operations/severity/types';

const EARNINGS_PATTERN = /configure.*(participant )?earnings|compensation|payout setup/i;
const OBLIGATIONS_PATTERN = /obligation|review obligations|view obligations/i;
const PROVIDER_PATTERN = /connect.*provider|payment provider/i;
const RELEASE_PATTERN = /release|settlement|safe to release/i;

function semanticKey(text: string): string {
  const t = text.toLowerCase();
  if (EARNINGS_PATTERN.test(t)) return 'earnings';
  if (OBLIGATIONS_PATTERN.test(t)) return 'obligations';
  if (PROVIDER_PATTERN.test(t)) return 'provider';
  if (RELEASE_PATTERN.test(t)) return 'release';
  return t.slice(0, 48);
}

export function deduplicateOperationalActions(
  actions: OperationalAction[]
): OperationalAction[] {
  const seen = new Set<string>();
  const out: OperationalAction[] = [];
  for (const a of actions) {
    const key = semanticKey(`${a.id} ${a.action} ${a.reason}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

export type DeduplicateAttentionOptions = {
  /** Primary CTA from hero/status — hide matching attention rows */
  primaryActionLabel?: string | null;
  primaryActionHref?: string | null;
  /** Max items per severity bucket on home */
  maxPerSeverity?: number;
  maxCritical?: number;
};

export function deduplicateAttentionItems(
  items: AttentionItem[],
  options: DeduplicateAttentionOptions = {}
): AttentionItem[] {
  const {
    primaryActionLabel,
    primaryActionHref,
    maxPerSeverity = 4,
    maxCritical = 3,
  } = options;

  const primaryKey = primaryActionLabel
    ? semanticKey(primaryActionLabel)
    : null;

  const seen = new Set<string>();
  const filtered: AttentionItem[] = [];

  for (const item of items) {
    const key = semanticKey(`${item.id} ${item.title} ${item.explanation} ${item.ctaLabel ?? ''}`);
    if (seen.has(key)) continue;

    if (primaryKey && item.ctaLabel && semanticKey(item.ctaLabel) === primaryKey) {
      continue;
    }
    if (
      primaryActionHref &&
      item.ctaHref === primaryActionHref &&
      primaryKey &&
      semanticKey(item.title).includes(primaryKey)
    ) {
      continue;
    }

    seen.add(key);
    filtered.push(item);
  }

  const bySeverity: Record<string, AttentionItem[]> = {
    CRITICAL: [],
    ACTION_REQUIRED: [],
    WARNING: [],
    INFORMATIONAL: [],
  };

  for (const item of filtered) {
    const bucket = bySeverity[item.severity] ?? bySeverity.INFORMATIONAL;
    const limit =
      item.severity === 'CRITICAL' ? maxCritical : maxPerSeverity;
    if (bucket.length < limit) {
      bucket.push(item);
    }
  }

  return [
    ...bySeverity.CRITICAL,
    ...bySeverity.ACTION_REQUIRED,
    ...bySeverity.WARNING,
    ...bySeverity.INFORMATIONAL,
  ];
}

/** Strip duplicate blocker lines already covered by primary action. */
export function compressOperationalBlockers(
  blockers: string[],
  primaryAction?: string | null
): string[] {
  if (!primaryAction) return blockers.slice(0, 3);
  const pk = semanticKey(primaryAction);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const b of blockers) {
    const key = semanticKey(b);
    if (key === pk) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(b);
    if (unique.length >= 3) break;
  }
  return unique;
}

import { assignCommercialTimingField } from '@/lib/commercial-timing/assign-timing-field';
import { hasAnyCommercialTimingFields } from '@/lib/commercial-timing/serialization';
import type {
  AgreementCommercialTiming,
  CommercialTimingFieldKey,
  DocumentCommercialTiming,
  CommercialTimingSource,
  ResolvedCommercialTiming,
} from '@/lib/commercial-timing/types';
import { COMMERCIAL_TIMING_FIELD_KEYS } from '@/lib/commercial-timing/types';

export type ResolveCommercialTimingInput = {
  /** Agreement-level defaults — source of truth. */
  agreementDefaults?: AgreementCommercialTiming | null;
  /** Document-level timing and overrides. */
  documentTiming?: DocumentCommercialTiming | null;
  /** Which document type is being resolved. */
  source?: CommercialTimingSource;
};

/**
 * Resolve commercial timing by merging agreement defaults with document overrides.
 *
 * Rules:
 * - Agreement defaults apply when document fields are unset.
 * - Document fields and overrides take precedence.
 * - Never fabricates values — missing fields remain unset.
 */
export function resolveCommercialTiming(
  input: ResolveCommercialTimingInput
): ResolvedCommercialTiming {
  const agreement = input.agreementDefaults ?? {};
  const document = input.documentTiming ?? null;
  const source: CommercialTimingSource = input.source ?? 'agreement';

  const inheritedFields: CommercialTimingFieldKey[] = [];
  const overriddenFields: CommercialTimingFieldKey[] = [];
  const resolved: ResolvedCommercialTiming = {
    source,
    inheritedFields,
    overriddenFields,
    hasTiming: false,
  };

  for (const key of COMMERCIAL_TIMING_FIELD_KEYS) {
    const docDirect = document?.[key];
    const docOverride = document?.overrides?.[key];
    const agreementValue = agreement[key];

    if (docDirect != null) {
      assignCommercialTimingField(resolved, key, docDirect);
      overriddenFields.push(key);
    } else if (docOverride != null) {
      assignCommercialTimingField(resolved, key, docOverride);
      overriddenFields.push(key);
    } else if (agreementValue != null) {
      assignCommercialTimingField(resolved, key, agreementValue);
      inheritedFields.push(key);
    }
  }

  resolved.hasTiming = hasAnyCommercialTimingFields(resolved);
  return resolved;
}

/** Resolve timing for a customer invoice (payment link). */
export function resolveInvoiceCommercialTiming(
  agreementDefaults: AgreementCommercialTiming | null | undefined,
  invoiceTiming: DocumentCommercialTiming | null | undefined
): ResolvedCommercialTiming {
  return resolveCommercialTiming({
    agreementDefaults,
    documentTiming: invoiceTiming,
    source: 'invoice',
  });
}

/** Resolve timing for a supplier bill. */
export function resolveBillCommercialTiming(
  agreementDefaults: AgreementCommercialTiming | null | undefined,
  billTiming: DocumentCommercialTiming | null | undefined
): ResolvedCommercialTiming {
  return resolveCommercialTiming({
    agreementDefaults,
    documentTiming: billTiming,
    source: 'bill',
  });
}

/** Resolve timing at agreement level (no document overrides). */
export function resolveAgreementCommercialTiming(
  agreementDefaults: AgreementCommercialTiming | null | undefined
): ResolvedCommercialTiming {
  return resolveCommercialTiming({
    agreementDefaults,
    documentTiming: null,
    source: 'agreement',
  });
}

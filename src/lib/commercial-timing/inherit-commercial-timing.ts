import type {
  AgreementCommercialTiming,
  CommercialTimingFields,
  DocumentCommercialTiming,
} from '@/lib/commercial-timing/types';

export type InheritCommercialTimingInput = {
  /** Agreement defaults — source of truth. */
  agreementDefaults?: AgreementCommercialTiming | null;
  /** Explicit overrides for this document (manual edit or AI extraction). */
  overrides?: Partial<CommercialTimingFields> | null;
};

/**
 * Build document-level commercial timing by inheriting agreement defaults.
 * Used when generating invoices or bills from a project.
 *
 * Unset override fields inherit from agreement defaults at resolution time.
 * Only explicitly provided override values are stored on the document.
 */
export function inheritCommercialTimingForDocument(
  input: InheritCommercialTimingInput
): DocumentCommercialTiming | null {
  const agreement = input.agreementDefaults ?? {};
  const overrides = input.overrides ?? null;

  const hasAgreement = Object.values(agreement).some((v) => v != null);
  const hasOverrides = overrides && Object.values(overrides).some((v) => v != null);

  if (!hasAgreement && !hasOverrides) return null;

  const result: DocumentCommercialTiming = {};

  if (hasOverrides) {
    result.overrides = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (value != null) {
        (result.overrides as Record<string, unknown>)[key] = value;
      }
    }
    if (Object.keys(result.overrides).length === 0) {
      delete result.overrides;
    }
  }

  return result;
}

/** Convenience alias for customer invoice generation. */
export function inheritCommercialTimingForInvoice(
  agreementDefaults: AgreementCommercialTiming | null | undefined,
  overrides?: Partial<CommercialTimingFields> | null
): DocumentCommercialTiming | null {
  return inheritCommercialTimingForDocument({ agreementDefaults, overrides });
}

/** Convenience alias for supplier bill generation. */
export function inheritCommercialTimingForBill(
  agreementDefaults: AgreementCommercialTiming | null | undefined,
  overrides?: Partial<CommercialTimingFields> | null
): DocumentCommercialTiming | null {
  return inheritCommercialTimingForDocument({ agreementDefaults, overrides });
}

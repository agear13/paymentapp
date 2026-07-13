import type {
  AgreementCommercialTiming,
  CommercialTimingFieldKey,
  CommercialTimingFields,
  DocumentCommercialTiming,
  YearMonth,
} from '@/lib/commercial-timing/types';
import { COMMERCIAL_TIMING_FIELD_KEYS } from '@/lib/commercial-timing/types';

/** Parse a YearMonth from unknown input; returns null when invalid. */
export function parseYearMonth(value: unknown): YearMonth | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const year = typeof v.year === 'number' ? v.year : Number(v.year);
  const month = typeof v.month === 'number' ? v.month : Number(v.month);
  if (!Number.isInteger(year) || year < 1900 || year > 3000) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

/** Format YearMonth as YYYY-MM for display and export hints. */
export function formatYearMonth(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`;
}

/** Parse ISO date string; returns null when invalid. Never fabricates. */
export function parseIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseTimingFields(raw: Record<string, unknown>): CommercialTimingFields {
  const result: CommercialTimingFields = {};
  const start = parseIsoDate(raw.servicePeriodStart);
  const end = parseIsoDate(raw.servicePeriodEnd);
  const payment = parseIsoDate(raw.expectedPaymentDate);
  const settlement = parseIsoDate(raw.expectedSettlementDate);
  const recognition = parseYearMonth(raw.recognitionPeriod);

  if (start) result.servicePeriodStart = start;
  if (end) result.servicePeriodEnd = end;
  if (payment) result.expectedPaymentDate = payment;
  if (settlement) result.expectedSettlementDate = settlement;
  if (recognition) result.recognitionPeriod = recognition;

  return result;
}

/** Safely parse agreement timing from deal_payload JSON. Returns empty object when absent. */
export function parseAgreementCommercialTiming(raw: unknown): AgreementCommercialTiming {
  if (!raw || typeof raw !== 'object') return {};
  return parseTimingFields(raw as Record<string, unknown>);
}

/** Safely parse document timing from payment_links.commercial_timing or bill JSON. */
export function parseDocumentCommercialTiming(raw: unknown): DocumentCommercialTiming | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const fields = parseTimingFields(obj);
  const overridesRaw = obj.overrides;
  const overrides =
    overridesRaw && typeof overridesRaw === 'object'
      ? parseTimingFields(overridesRaw as Record<string, unknown>)
      : undefined;

  const hasFields = COMMERCIAL_TIMING_FIELD_KEYS.some(
    (k) => fields[k] != null && fields[k] !== undefined
  );
  const hasOverrides =
    overrides &&
    COMMERCIAL_TIMING_FIELD_KEYS.some(
      (k) => overrides[k] != null && overrides[k] !== undefined
    );

  if (!hasFields && !hasOverrides) return null;

  return {
    ...fields,
    overrides: hasOverrides ? overrides : undefined,
  };
}

/** Serialize document timing for JSON/Prisma storage. */
export function serializeDocumentCommercialTiming(
  timing: DocumentCommercialTiming
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COMMERCIAL_TIMING_FIELD_KEYS) {
    const value = timing[key];
    if (value != null) out[key] = value;
  }
  if (timing.overrides && Object.keys(timing.overrides).length > 0) {
    const overrides: Record<string, unknown> = {};
    for (const key of COMMERCIAL_TIMING_FIELD_KEYS) {
      const value = timing.overrides[key];
      if (value != null) overrides[key] = value;
    }
    if (Object.keys(overrides).length > 0) out.overrides = overrides;
  }
  return out;
}

/** Serialize agreement timing for deal_payload storage. */
export function serializeAgreementCommercialTiming(
  timing: AgreementCommercialTiming
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COMMERCIAL_TIMING_FIELD_KEYS) {
    const value = timing[key];
    if (value != null) out[key] = value;
  }
  return out;
}

/** Check whether a timing object has any populated field. */
export function hasAnyCommercialTimingFields(
  timing: CommercialTimingFields | null | undefined
): boolean {
  if (!timing) return false;
  return COMMERCIAL_TIMING_FIELD_KEYS.some(
    (k) => timing[k] != null && timing[k] !== undefined
  );
}

/** Pick a single field value, preferring document over agreement. */
export function pickTimingField(
  key: CommercialTimingFieldKey,
  agreement: AgreementCommercialTiming | null | undefined,
  document: DocumentCommercialTiming | null | undefined
): CommercialTimingFields[CommercialTimingFieldKey] {
  const docValue = document?.[key];
  if (docValue != null) return docValue;
  const overrideValue = document?.overrides?.[key];
  if (overrideValue != null) return overrideValue;
  return agreement?.[key] ?? null;
}

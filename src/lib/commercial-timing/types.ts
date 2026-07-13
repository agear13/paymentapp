/**
 * Commercial Timing — canonical domain types.
 *
 * Commercial Timing represents when commercial activity occurs, independently
 * from when invoices are issued or payments are received.
 *
 * Source of truth: the commercial agreement (project/deal).
 * Accounting, settlement, and reporting consume this — they do not own it.
 */

/** Calendar month for revenue/cost recognition grouping. */
export type YearMonth = {
  year: number;
  /** 1–12 */
  month: number;
};

/** Core timing fields — all optional; never fabricate missing values. */
export type CommercialTimingFields = {
  /** When the commercial service or deliverable period begins. */
  servicePeriodStart?: string | null;
  /** When the commercial service or deliverable period ends. */
  servicePeriodEnd?: string | null;
  /** Month in which revenue or cost should be recognised commercially. */
  recognitionPeriod?: YearMonth | null;
  /** When customer payment is expected (commercial expectation, not invoice due date). */
  expectedPaymentDate?: string | null;
  /** When participant settlement is expected (commercial expectation). */
  expectedSettlementDate?: string | null;
};

export type CommercialTimingFieldKey = keyof CommercialTimingFields;

export const COMMERCIAL_TIMING_FIELD_KEYS: readonly CommercialTimingFieldKey[] = [
  'servicePeriodStart',
  'servicePeriodEnd',
  'recognitionPeriod',
  'expectedPaymentDate',
  'expectedSettlementDate',
] as const;

/** Where resolved timing values originated. */
export type CommercialTimingSource =
  | 'agreement'
  | 'project'
  | 'invoice'
  | 'bill'
  | 'payment_event'
  | 'obligation'
  | 'manual';

/**
 * Agreement-level commercial timing defaults.
 * Stored on deal_payload.commercialTiming — the source of truth for the agreement.
 */
export type AgreementCommercialTiming = CommercialTimingFields;

/**
 * Document-level timing attached to invoices, bills, or payment events.
 * Overrides may be partial; unset fields inherit from agreement defaults.
 */
export type DocumentCommercialTiming = CommercialTimingFields & {
  /** Explicit per-field overrides — only fields that differ from agreement defaults. */
  overrides?: Partial<CommercialTimingFields> | null;
};

/**
 * Fully resolved commercial timing with provenance metadata.
 * Output of resolveCommercialTiming().
 */
export type ResolvedCommercialTiming = CommercialTimingFields & {
  source: CommercialTimingSource;
  /** Fields inherited from agreement defaults. */
  inheritedFields: CommercialTimingFieldKey[];
  /** Fields explicitly set on the document. */
  overriddenFields: CommercialTimingFieldKey[];
  /** True when at least one timing field is populated. */
  hasTiming: boolean;
};

/** Settlement timing view — expected vs actual, without duplicating settlement workflow. */
export type SettlementTimingView = {
  expectedSettlementDate: string | null;
  actualSettlementDate: string | null;
  /** True when actual is known and on or before expected (or expected is unset). */
  onSchedule: boolean | null;
};

/** Reporting dimensions derived from commercial timing (extension point output). */
export type CommercialTimingReportingDimensions = {
  recognitionPeriod: YearMonth | null;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  expectedPaymentDate: string | null;
  expectedSettlementDate: string | null;
};

/** Forecasting input slice — commercial timing as primary forecast driver. */
export type CommercialTimingForecastInput = {
  agreementTiming: AgreementCommercialTiming | null;
  documentTiming: DocumentCommercialTiming | null;
  resolved: ResolvedCommercialTiming;
};

/**
 * Commercial Forecasting — canonical domain types.
 *
 * Forecasting derives from commercial commitments (agreements, timing, obligations,
 * settlement) — not historical accounting entries.
 *
 * Commercial agreements define the future. Accounting records the past.
 * Forecasting is the bridge between those two.
 */

import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type {
  AgreementCommercialTiming,
  ResolvedCommercialTiming,
  YearMonth,
} from '@/lib/commercial-timing/types';
import type { CommercialReconciliationStatus } from '@/lib/commercial-reconciliation/types';
import type { CustomerInvoiceLifecycleState } from '@/lib/payment-links/customer-invoice-lifecycle';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { ProjectFundingSourceDto, ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import type { PaymentLinkStatus } from '@prisma/client';
import type { PaymentRailId } from '@/lib/payments/payment-rail-registry';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';

/** Confidence derived from workflow state — never fabricated. */
export enum CommercialForecastConfidence {
  Committed = 'committed',
  Likely = 'likely',
  Expected = 'expected',
  Tentative = 'tentative',
}

export const COMMERCIAL_FORECAST_CONFIDENCE_LABELS: Record<
  CommercialForecastConfidence,
  string
> = {
  [CommercialForecastConfidence.Committed]: 'Committed',
  [CommercialForecastConfidence.Likely]: 'Likely',
  [CommercialForecastConfidence.Expected]: 'Expected',
  [CommercialForecastConfidence.Tentative]: 'Tentative',
};

/** Categories for forecast events — what happens next, not just balances. */
export enum ForecastEventCategory {
  CustomerPaymentExpected = 'customer_payment_expected',
  ServicePeriodStart = 'service_period_start',
  ServicePeriodEnd = 'service_period_end',
  RevenueRecognised = 'revenue_recognised',
  ParticipantSettlement = 'participant_settlement',
  BankPayoutClearing = 'bank_payout_clearing',
  TaxLiabilityDue = 'tax_liability_due',
  InvoiceExported = 'invoice_exported',
  ObligationDue = 'obligation_due',
  SettlementEligible = 'settlement_eligible',
}

export const FORECAST_EVENT_CATEGORY_LABELS: Record<ForecastEventCategory, string> = {
  [ForecastEventCategory.CustomerPaymentExpected]: 'Customer payment expected',
  [ForecastEventCategory.ServicePeriodStart]: 'Service period begins',
  [ForecastEventCategory.ServicePeriodEnd]: 'Service period ends',
  [ForecastEventCategory.RevenueRecognised]: 'Revenue recognised',
  [ForecastEventCategory.ParticipantSettlement]: 'Participant settlement',
  [ForecastEventCategory.BankPayoutClearing]: 'Bank payout clears',
  [ForecastEventCategory.TaxLiabilityDue]: 'Tax liability due',
  [ForecastEventCategory.InvoiceExported]: 'Invoice exported',
  [ForecastEventCategory.ObligationDue]: 'Obligation due',
  [ForecastEventCategory.SettlementEligible]: 'Settlement eligible',
};

/** A future commercial event — the primary human-facing forecast primitive. */
export type ForecastEvent = {
  id: string;
  /** ISO date (YYYY-MM-DD) when the event is expected. */
  date: string;
  category: ForecastEventCategory;
  label: string;
  description: string;
  amount: number | null;
  currency: string;
  confidence: CommercialForecastConfidence;
  /** Structured reasons for the confidence level. */
  confidenceReasons: string[];
  source:
    | 'agreement'
    | 'timing'
    | 'obligation'
    | 'invoice'
    | 'settlement'
    | 'payment'
    | 'reconciliation';
  relatedId: string | null;
  /** True when the event has already occurred. */
  occurred: boolean;
};

/** Invoice slice for forecasting — consumes invoice lifecycle, not duplicate records. */
export type InvoiceForecastInput = {
  paymentLinkId: string;
  invoiceAmount: number;
  amountPaid: number;
  linkStatus: PaymentLinkStatus;
  lifecycleState?: CustomerInvoiceLifecycleState;
  commercialTiming?: ResolvedCommercialTiming | null;
  paymentRail?: PaymentRailId | null;
  reconciliationStatus?: CommercialReconciliationStatus | null;
  exportedAt?: string | null;
  paymentConfirmedAt?: string | null;
  settlementReadyAt?: string | null;
};

/** Participant settlement slice for forecasting. */
export type SettlementForecastInput = {
  participantId: string;
  participantName: string;
  amount: number;
  currency: string;
  expectedSettlementDate?: string | null;
  settlementReady: boolean;
  agreementApproved: boolean;
};

/** Revenue forecast buckets — commercial, not accounting. */
export type RevenueForecast = {
  committedRevenue: number;
  pendingRevenue: number;
  expectedRevenue: number;
  recognisedRevenue: number;
  collectedRevenue: number;
  totalForecastRevenue: number;
  currency: string;
  /** Period breakdown when timing is available. */
  byPeriod: RevenuePeriodSlice[];
};

export type RevenuePeriodSlice = {
  period: YearMonth;
  expectedAmount: number;
  recognisedAmount: number;
  confidence: CommercialForecastConfidence;
};

/** Cost forecast — obligations and participant payouts. */
export type CostForecast = {
  participantPayouts: number;
  supplierInvoices: number;
  operationalCosts: number;
  futureObligations: number;
  totalForecastCosts: number;
  currency: string;
  byPeriod: CostPeriodSlice[];
};

export type CostPeriodSlice = {
  period: YearMonth;
  expectedAmount: number;
  confidence: CommercialForecastConfidence;
};

/** Cashflow forecast — driven by commercial commitments and timing. */
export type CashflowForecast = {
  expectedCustomerPayments: number;
  expectedParticipantSettlements: number;
  expectedBankDeposits: number;
  expectedCashBalance: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  currency: string;
  /** Time-bucketed inflows and outflows. */
  periods: CashflowPeriodSlice[];
};

export type CashflowPeriodSlice = {
  period: YearMonth;
  inflows: number;
  outflows: number;
  netCashflow: number;
  openingBalance: number;
  closingBalance: number;
};

/** Profit forecast from commercial data. */
export type ProfitForecast = {
  grossProfit: number;
  netProfit: number;
  contributionMargin: number;
  futureMargin: number;
  currency: string;
};

/** Working capital forecast. */
export type WorkingCapitalForecast = {
  accountsReceivable: number;
  accountsPayable: number;
  expectedCash: number;
  outstandingSettlement: number;
  futureCommitments: number;
  currency: string;
};

/** Risk item for future AI and reporting. */
export type CommercialForecastRisk = {
  id: string;
  category:
    | 'late_customer_payment'
    | 'outstanding_obligations'
    | 'settlement_delay'
    | 'approval_bottleneck'
    | 'revenue_concentration';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  relatedId: string | null;
};

/** Monthly timeline bar for dashboards. */
export type ForecastTimelineMonth = {
  period: YearMonth;
  label: string;
  revenue: number;
  costs: number;
  settlement: number;
  cash: number;
  /** Normalized 0–1 for bar rendering. */
  revenueBar: number;
  costsBar: number;
  settlementBar: number;
  cashBar: number;
  events: ForecastEvent[];
};

/** Input — consumes existing models; never duplicates data. */
export type CommercialForecastingInput = {
  projectId?: string | null;
  dealId?: string | null;
  agreementId?: string | null;
  currency: string;
  agreementTiming?: AgreementCommercialTiming | null;
  fundingSources: ProjectFundingSourceDto[];
  treasury: ProjectTreasurySummary | null;
  obligationRows: BriefingObligationRowInput[];
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  invoiceForecasts?: InvoiceForecastInput[];
  settlementForecasts?: SettlementForecastInput[];
  /** Reference date for future-period calculations. Defaults to today. */
  asOfDate?: string;
  /** Opening cash balance when known — optional, not required. */
  openingCashBalance?: number | null;
};

/** Full forecasting output — source of truth for dashboards, AI, and reports. */
export type CommercialForecastingResult = {
  /** Canonical dollar forecast from existing engine — not duplicated. */
  dollarForecast: CommercialForecastResult;
  revenue: RevenueForecast;
  costs: CostForecast;
  cashflow: CashflowForecast;
  profit: ProfitForecast;
  workingCapital: WorkingCapitalForecast;
  events: ForecastEvent[];
  timeline: ForecastTimelineMonth[];
  risks: CommercialForecastRisk[];
  currency: string;
  projectId: string | null;
  dealId: string | null;
  /** Overall confidence derived from workflow state. */
  overallConfidence: CommercialForecastConfidence;
  overallConfidenceReasons: string[];
};

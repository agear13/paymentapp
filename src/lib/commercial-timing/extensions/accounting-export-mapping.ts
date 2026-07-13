/**
 * Accounting export mapping hints.
 *
 * No behavioural changes to existing exports — this module documents where
 * commercial timing will map into Xero, QuickBooks, and NetSuite when
 * accounting integrations consume timing data.
 */

import type { ResolvedCommercialTiming } from '@/lib/commercial-timing/types';
import { formatYearMonth } from '@/lib/commercial-timing/serialization';

export type AccountingProviderTimingTarget = 'xero' | 'quickbooks' | 'netsuite';

export type AccountingTimingFieldMapping = {
  provvyField: keyof ResolvedCommercialTiming;
  /** Provider-specific field or concept — documentation only until export consumes timing. */
  providerField: string;
  notes: string;
};

export type AccountingTimingMappingHint = {
  provider: AccountingProviderTimingTarget;
  mappings: AccountingTimingFieldMapping[];
  /** Whether this provider export currently consumes commercial timing. */
  active: boolean;
};

const XERO_MAPPINGS: AccountingTimingFieldMapping[] = [
  {
    provvyField: 'servicePeriodStart',
    providerField: 'LineItems[].Tracking or custom field (future)',
    notes: 'Xero ACCREC/ACCPAY — service period start for revenue recognition alignment.',
  },
  {
    provvyField: 'servicePeriodEnd',
    providerField: 'LineItems[].Tracking or custom field (future)',
    notes: 'Xero ACCREC/ACCPAY — service period end for deferred revenue.',
  },
  {
    provvyField: 'recognitionPeriod',
    providerField: 'TrackingCategory or ReportingPeriod (future)',
    notes: 'Xero tracking categories can group by recognition month.',
  },
  {
    provvyField: 'expectedPaymentDate',
    providerField: 'DueDate (distinct from invoice due — future custom field)',
    notes: 'Commercial expected payment vs invoice DueDate — separate concepts.',
  },
  {
    provvyField: 'expectedSettlementDate',
    providerField: 'Bill payment schedule / manual journal date (future)',
    notes: 'Participant settlement expectation for cash flow planning.',
  },
];

const QUICKBOOKS_MAPPINGS: AccountingTimingFieldMapping[] = [
  {
    provvyField: 'servicePeriodStart',
    providerField: 'Invoice.ServiceDate or custom field (future)',
    notes: 'QuickBooks Online ServiceDate for service-based revenue.',
  },
  {
    provvyField: 'servicePeriodEnd',
    providerField: 'Custom field / Class tracking (future)',
    notes: 'End of service period for deferred revenue schedules.',
  },
  {
    provvyField: 'recognitionPeriod',
    providerField: 'Class or Location dimension (future)',
    notes: 'Group P&L by recognition period.',
  },
  {
    provvyField: 'expectedPaymentDate',
    providerField: 'SalesTerm / DueDate override (future)',
    notes: 'Commercial payment expectation separate from terms due date.',
  },
  {
    provvyField: 'expectedSettlementDate',
    providerField: 'Bill payment expected date (future)',
    notes: 'Supplier bill settlement forecast.',
  },
];

const NETSUITE_MAPPINGS: AccountingTimingFieldMapping[] = [
  {
    provvyField: 'servicePeriodStart',
    providerField: 'custbody_service_period_start (future custom field)',
    notes: 'NetSuite custom body field for rev rec module alignment.',
  },
  {
    provvyField: 'servicePeriodEnd',
    providerField: 'custbody_service_period_end (future custom field)',
    notes: 'NetSuite deferred revenue end date.',
  },
  {
    provvyField: 'recognitionPeriod',
    providerField: 'PostingPeriod or custom segment (future)',
    notes: 'NetSuite posting period for recognition-based reporting.',
  },
  {
    provvyField: 'expectedPaymentDate',
    providerField: 'duedate vs custbody_expected_payment (future)',
    notes: 'Distinguish invoice due from commercial payment expectation.',
  },
  {
    provvyField: 'expectedSettlementDate',
    providerField: 'custbody_expected_settlement (future)',
    notes: 'Vendor bill settlement forecast.',
  },
];

/** Mapping hints per accounting provider. */
export function getAccountingTimingMappingHints(
  provider: AccountingProviderTimingTarget,
  options?: { invoiceExportActive?: boolean }
): AccountingTimingMappingHint {
  const mappings =
    provider === 'xero'
      ? XERO_MAPPINGS
      : provider === 'quickbooks'
        ? QUICKBOOKS_MAPPINGS
        : NETSUITE_MAPPINGS;

  const invoiceExportActive = options?.invoiceExportActive ?? provider === 'xero';

  return {
    provider,
    mappings,
    active: invoiceExportActive,
  };
}

/** Summary of timing available for accounting export (pass-through, no export side effects). */
export function buildAccountingExportTimingContext(timing: ResolvedCommercialTiming): {
  hasTiming: boolean;
  recognitionPeriodLabel: string | null;
  servicePeriodLabel: string | null;
  expectedPaymentDate: string | null;
  expectedSettlementDate: string | null;
} {
  const recognition = timing.recognitionPeriod
    ? formatYearMonth(timing.recognitionPeriod)
    : null;

  const servicePeriod =
    timing.servicePeriodStart || timing.servicePeriodEnd
      ? `${timing.servicePeriodStart?.slice(0, 10) ?? '?'} – ${timing.servicePeriodEnd?.slice(0, 10) ?? '?'}`
      : null;

  return {
    hasTiming: timing.hasTiming,
    recognitionPeriodLabel: recognition,
    servicePeriodLabel: servicePeriod,
    expectedPaymentDate: timing.expectedPaymentDate ?? null,
    expectedSettlementDate: timing.expectedSettlementDate ?? null,
  };
}

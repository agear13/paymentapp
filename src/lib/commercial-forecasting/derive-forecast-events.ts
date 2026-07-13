/**
 * Forecast Events — what happens next, not just forecast balances.
 *
 * Events derive from commercial timing, obligations, invoices, settlement,
 * and payment rails. Humans think in events; dashboards and AI consume them.
 */

import type {
  CommercialForecastingInput,
  ForecastEvent,
  InvoiceForecastInput,
  SettlementForecastInput,
} from '@/lib/commercial-forecasting/types';
import {
  CommercialForecastConfidence,
  ForecastEventCategory,
  FORECAST_EVENT_CATEGORY_LABELS,
} from '@/lib/commercial-forecasting/types';
import {
  confidenceFromFundingSource,
  confidenceFromInvoiceLifecycle,
  confidenceFromSettlement,
} from '@/lib/commercial-forecasting/derive-forecast-confidence';
import { resolveCommercialTiming } from '@/lib/commercial-timing/resolve-commercial-timing';
import { isFundingConfirmed } from '@/lib/projects/funding-sources/funding-source-status';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import { mergeFundingSettlementExpectation } from '@/lib/commercial-timing/extensions/settlement-timing';

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isPast(date: string, asOf: string): boolean {
  return date <= asOf;
}

function eventId(prefix: string, id: string, suffix?: string): string {
  return `${prefix}:${id}${suffix ? `:${suffix}` : ''}`;
}

function buildFundingPaymentEvent(
  source: ProjectFundingSourceDto,
  asOfDate: string
): ForecastEvent | null {
  const date =
    toDateOnly(source.expectedSettlementDate) ??
    toDateOnly(source.actualSettlementDate);
  if (!date) return null;

  const { confidence, reasons } = confidenceFromFundingSource(source);
  const occurred = Boolean(source.actualSettlementDate) || isFundingConfirmed(source.status);

  return {
    id: eventId('payment', source.id),
    date,
    category: ForecastEventCategory.CustomerPaymentExpected,
    label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.CustomerPaymentExpected],
    description: `${source.name} — ${source.sourceType}`,
    amount: source.amount,
    currency: source.currency,
    confidence,
    confidenceReasons: reasons,
    source: 'payment',
    relatedId: source.id,
    occurred,
  };
}

function buildTimingEvents(
  timing: ReturnType<typeof resolveCommercialTiming>,
  currency: string,
  relatedId: string,
  asOfDate: string,
  options: { skipPaymentEvent?: boolean; skipSettlementEvent?: boolean } = {}
): ForecastEvent[] {
  const events: ForecastEvent[] = [];

  const serviceStart = toDateOnly(timing.servicePeriodStart);
  if (serviceStart) {
    events.push({
      id: eventId('service_start', relatedId),
      date: serviceStart,
      category: ForecastEventCategory.ServicePeriodStart,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.ServicePeriodStart],
      description: 'Commercial service period begins',
      amount: null,
      currency,
      confidence: CommercialForecastConfidence.Committed,
      confidenceReasons: ['Defined in commercial timing'],
      source: 'timing',
      relatedId,
      occurred: isPast(serviceStart, asOfDate),
    });
  }

  const serviceEnd = toDateOnly(timing.servicePeriodEnd);
  if (serviceEnd) {
    events.push({
      id: eventId('service_end', relatedId),
      date: serviceEnd,
      category: ForecastEventCategory.ServicePeriodEnd,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.ServicePeriodEnd],
      description: 'Commercial service period ends',
      amount: null,
      currency,
      confidence: CommercialForecastConfidence.Committed,
      confidenceReasons: ['Defined in commercial timing'],
      source: 'timing',
      relatedId,
      occurred: isPast(serviceEnd, asOfDate),
    });
  }

  if (timing.recognitionPeriod) {
    const { year, month } = timing.recognitionPeriod;
    const recognitionDate = `${year}-${String(month).padStart(2, '0')}-01`;
    events.push({
      id: eventId('recognition', relatedId),
      date: recognitionDate,
      category: ForecastEventCategory.RevenueRecognised,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.RevenueRecognised],
      description: `Revenue recognised — ${year}-${String(month).padStart(2, '0')}`,
      amount: null,
      currency,
      confidence: CommercialForecastConfidence.Expected,
      confidenceReasons: ['Recognition period from commercial timing'],
      source: 'timing',
      relatedId,
      occurred: isPast(recognitionDate, asOfDate),
    });
  }

  const paymentDate = toDateOnly(timing.expectedPaymentDate);
  if (paymentDate && !options.skipPaymentEvent) {
    events.push({
      id: eventId('expected_payment', relatedId),
      date: paymentDate,
      category: ForecastEventCategory.CustomerPaymentExpected,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.CustomerPaymentExpected],
      description: 'Customer payment expected (commercial timing)',
      amount: null,
      currency,
      confidence: CommercialForecastConfidence.Expected,
      confidenceReasons: ['Expected payment date from commercial timing'],
      source: 'timing',
      relatedId,
      occurred: isPast(paymentDate, asOfDate),
    });
  }

  const settlementDate = toDateOnly(timing.expectedSettlementDate);
  if (settlementDate && !options.skipSettlementEvent) {
    events.push({
      id: eventId('expected_settlement', relatedId),
      date: settlementDate,
      category: ForecastEventCategory.ParticipantSettlement,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.ParticipantSettlement],
      description: 'Participant settlement expected (commercial timing)',
      amount: null,
      currency,
      confidence: CommercialForecastConfidence.Expected,
      confidenceReasons: ['Expected settlement date from commercial timing'],
      source: 'timing',
      relatedId,
      occurred: isPast(settlementDate, asOfDate),
    });
  }

  return events;
}

function buildObligationEvents(
  row: BriefingObligationRowInput,
  currency: string,
  expectedSettlementDate: string | null,
  asOfDate: string
): ForecastEvent[] {
  const amount = Number(row.amount_owed) || 0;
  const date = expectedSettlementDate ?? asOfDate;
  const participantName = row.participant?.name ?? 'Participant';

  const events: ForecastEvent[] = [
    {
      id: eventId('obligation', row.id),
      date,
      category: ForecastEventCategory.ObligationDue,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.ObligationDue],
      description: `${participantName} — ${row.obligation_type}`,
      amount,
      currency: row.currency || currency,
      confidence:
        row.status === 'FUNDED' || row.status === 'READY'
          ? CommercialForecastConfidence.Likely
          : CommercialForecastConfidence.Expected,
      confidenceReasons: [`Obligation status: ${row.status}`],
      source: 'obligation',
      relatedId: row.id,
      occurred: row.status === 'SETTLED' || row.status === 'PAID',
    },
  ];

  if (row.status === 'FUNDED' || row.status === 'READY') {
    events.push({
      id: eventId('settlement', row.id),
      date,
      category: ForecastEventCategory.ParticipantSettlement,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.ParticipantSettlement],
      description: `Settlement to ${participantName}`,
      amount,
      currency: row.currency || currency,
      confidence: CommercialForecastConfidence.Likely,
      confidenceReasons: ['Obligation funded and ready for settlement'],
      source: 'settlement',
      relatedId: row.id,
      occurred: false,
    });
  }

  return events;
}

function buildInvoiceEvents(
  invoice: InvoiceForecastInput,
  currency: string,
  asOfDate: string
): ForecastEvent[] {
  const events: ForecastEvent[] = [];
  const { confidence, reasons } = confidenceFromInvoiceLifecycle(invoice);

  if (invoice.exportedAt) {
    const date = toDateOnly(invoice.exportedAt)!;
    events.push({
      id: eventId('export', invoice.paymentLinkId),
      date,
      category: ForecastEventCategory.InvoiceExported,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.InvoiceExported],
      description: 'Invoice exported to accounting',
      amount: invoice.invoiceAmount,
      currency,
      confidence: CommercialForecastConfidence.Committed,
      confidenceReasons: ['Invoice exported'],
      source: 'invoice',
      relatedId: invoice.paymentLinkId,
      occurred: true,
    });
  }

  const timing = invoice.commercialTiming;
  const paymentDate =
    toDateOnly(timing?.expectedPaymentDate) ??
    toDateOnly(invoice.paymentConfirmedAt);

  if (paymentDate && invoice.amountPaid < invoice.invoiceAmount) {
    events.push({
      id: eventId('invoice_payment', invoice.paymentLinkId),
      date: paymentDate,
      category: ForecastEventCategory.CustomerPaymentExpected,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.CustomerPaymentExpected],
      description: 'Customer payment expected for invoice',
      amount: invoice.invoiceAmount - invoice.amountPaid,
      currency,
      confidence,
      confidenceReasons: reasons,
      source: 'invoice',
      relatedId: invoice.paymentLinkId,
      occurred: invoice.linkStatus === 'PAID',
    });
  }

  if (invoice.paymentRail && invoice.paymentConfirmedAt) {
    const clearingDate = toDateOnly(invoice.paymentConfirmedAt);
    if (clearingDate) {
      const clearingOffset = new Date(clearingDate);
      clearingOffset.setDate(clearingOffset.getDate() + 3);
      const clearingDateStr = clearingOffset.toISOString().slice(0, 10);
      events.push({
        id: eventId('payout_clear', invoice.paymentLinkId),
        date: clearingDateStr,
        category: ForecastEventCategory.BankPayoutClearing,
        label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.BankPayoutClearing],
        description: `${invoice.paymentRail} payout clears`,
        amount: invoice.amountPaid,
        currency,
        confidence: CommercialForecastConfidence.Expected,
        confidenceReasons: ['Estimated clearing window after payment confirmation'],
        source: 'reconciliation',
        relatedId: invoice.paymentLinkId,
        occurred: Boolean(invoice.settlementReadyAt),
      });
    }
  }

  if (invoice.settlementReadyAt) {
    events.push({
      id: eventId('settlement_eligible', invoice.paymentLinkId),
      date: toDateOnly(invoice.settlementReadyAt)!,
      category: ForecastEventCategory.SettlementEligible,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.SettlementEligible],
      description: 'Settlement eligible after commercial reconciliation',
      amount: null,
      currency,
      confidence: CommercialForecastConfidence.Committed,
      confidenceReasons: ['Settlement workflow ready'],
      source: 'settlement',
      relatedId: invoice.paymentLinkId,
      occurred: true,
    });
  }

  return events;
}

function buildSettlementEvents(
  settlement: SettlementForecastInput,
  asOfDate: string
): ForecastEvent[] {
  const date = toDateOnly(settlement.expectedSettlementDate) ?? asOfDate;
  const { confidence, reasons } = confidenceFromSettlement(settlement);

  return [
    {
      id: eventId('participant_settlement', settlement.participantId),
      date,
      category: ForecastEventCategory.ParticipantSettlement,
      label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.ParticipantSettlement],
      description: `Settlement to ${settlement.participantName}`,
      amount: settlement.amount,
      currency: settlement.currency,
      confidence,
      confidenceReasons: reasons,
      source: 'settlement',
      relatedId: settlement.participantId,
      occurred: settlement.settlementReady,
    },
  ];
}

/** Derive all forecast events from commercial commitments. */
export function deriveForecastEvents(input: CommercialForecastingInput): ForecastEvent[] {
  const asOfDate = toDateOnly(input.asOfDate) ?? new Date().toISOString().slice(0, 10);
  const events: ForecastEvent[] = [];

  const resolvedTiming = resolveCommercialTiming({
    agreementDefaults: input.agreementTiming ?? null,
    documentTiming: null,
  });

  const settlementDate = toDateOnly(resolvedTiming.expectedSettlementDate);
  const hasFundingSources = input.fundingSources.length > 0;
  const hasObligations = input.obligationRows.length > 0;

  events.push(
    ...buildTimingEvents(
      resolvedTiming,
      input.currency,
      input.dealId ?? input.projectId ?? 'agreement',
      asOfDate,
      { skipPaymentEvent: hasFundingSources, skipSettlementEvent: hasObligations }
    )
  );

  for (const source of input.fundingSources) {
    const merged = mergeFundingSettlementExpectation(
      resolvedTiming,
      source.expectedSettlementDate
    );
    const paymentEvent = buildFundingPaymentEvent(source, asOfDate);
    if (paymentEvent) events.push(paymentEvent);

    if (merged.expectedSettlementDate && !paymentEvent) {
      const settlementDate = toDateOnly(merged.expectedSettlementDate);
      if (settlementDate) {
        events.push({
          id: eventId('funding_settlement', source.id),
          date: settlementDate,
          category: ForecastEventCategory.ParticipantSettlement,
          label: FORECAST_EVENT_CATEGORY_LABELS[ForecastEventCategory.ParticipantSettlement],
          description: `Settlement after ${source.name} payment`,
          amount: source.amount,
          currency: source.currency,
          confidence: confidenceFromFundingSource(source).confidence,
          confidenceReasons: confidenceFromFundingSource(source).reasons,
          source: 'payment',
          relatedId: source.id,
          occurred: Boolean(source.actualSettlementDate),
        });
      }
    }
  }

  for (const row of input.obligationRows) {
    events.push(...buildObligationEvents(row, input.currency, settlementDate, asOfDate));
  }

  for (const invoice of input.invoiceForecasts ?? []) {
    events.push(...buildInvoiceEvents(invoice, input.currency, asOfDate));
  }

  for (const settlement of input.settlementForecasts ?? []) {
    events.push(...buildSettlementEvents(settlement, asOfDate));
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/**
 * Request-scoped payment context for the post-approval fulfillment step.
 * Reuses the flagship AU→ID corridor and the already-extracted milestone amount.
 * Does not rank routes or invent a destination currency.
 */

import { FLAGSHIP_ADVISOR_PAYMENT } from '@/lib/advisor/payment-advisor-context';
import type { PaymentAdvisorPaymentContextInput } from '@/lib/advisor/payment-advisor-context';
import { LANDING_COUNTRIES } from '@/lib/journey/landing-route-model';
import {
  formatScheduleMoney,
  type AgreementPaymentScheduleView,
} from '@/lib/commercial-os/payment-schedule-presentation';

export function commitmentRouteContextFromSchedule(
  schedule: Pick<
    AgreementPaymentScheduleView,
    'equalMilestoneAmount' | 'next' | 'currency'
  > | null | undefined
): PaymentAdvisorPaymentContextInput {
  const amount =
    schedule?.equalMilestoneAmount ??
    schedule?.next?.amount ??
    FLAGSHIP_ADVISOR_PAYMENT.amount;

  return {
    origin: FLAGSHIP_ADVISOR_PAYMENT.origin,
    destination: FLAGSHIP_ADVISOR_PAYMENT.destination,
    amount,
    sourceCurrency: schedule?.currency?.trim() || FLAGSHIP_ADVISOR_PAYMENT.sourceCurrency,
    destinationCurrency: FLAGSHIP_ADVISOR_PAYMENT.destinationCurrency,
    priority: FLAGSHIP_ADVISOR_PAYMENT.priority,
    transactionType: 'supplier_payment',
  };
}

export function formatCommitmentCorridorLabel(
  payment: PaymentAdvisorPaymentContextInput
): string {
  const origin =
    LANDING_COUNTRIES.find((country) => country.code === payment.origin)?.name ?? payment.origin;
  const destination =
    LANDING_COUNTRIES.find((country) => country.code === payment.destination)?.name ??
    payment.destination;
  const amount = formatScheduleMoney(payment.amount, payment.sourceCurrency) ?? String(payment.amount);
  const destCurrency = payment.destinationCurrency?.trim();
  const currencies = destCurrency
    ? `${payment.sourceCurrency} → ${destCurrency}`
    : payment.sourceCurrency;

  return `${origin} → ${destination} · ${currencies} · ${amount} supplier payment`;
}

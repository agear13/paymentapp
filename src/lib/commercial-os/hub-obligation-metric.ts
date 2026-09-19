/**
 * Presentation of the Agreement Intelligence hub metric.
 *
 * `partyObligationCount` is the existing participant compensation concept
 * (fixed-fee + revenue-share). Commercial supply milestones live on the
 * payment schedule. This helper does not change either model.
 */

import type { AgreementPaymentScheduleView } from '@/lib/commercial-os/payment-schedule-presentation';

export type HubObligationMetricPresentation = {
  label: string;
  value: number;
};

export function hubObligationMetricPresentation(input: {
  partyObligationCount: number;
  paymentSchedule: Pick<AgreementPaymentScheduleView, 'milestoneCount'> | null | undefined;
}): HubObligationMetricPresentation {
  const paymentCount = input.paymentSchedule?.milestoneCount ?? 0;
  if (paymentCount > 0) {
    return {
      label: 'Payment obligations',
      value: paymentCount,
    };
  }

  return {
    label: 'Obligations identified',
    value: input.partyObligationCount,
  };
}

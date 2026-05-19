/**
 * Customer payment flow stage progression — operational, procedural, not gamified.
 */

export type PaymentFlowStage =
  | 'review_invoice'
  | 'send_payment'
  | 'confirm_payment'
  | 'awaiting_verification';

export const PAYMENT_FLOW_STAGES: Array<{
  id: PaymentFlowStage;
  order: number;
  label: string;
  shortLabel: string;
  subtext: string;
}> = [
  {
    id: 'review_invoice',
    order: 1,
    label: 'Review invoice',
    shortLabel: 'Review',
    subtext: 'Confirm the amount, reference, and payment details before sending funds.',
  },
  {
    id: 'send_payment',
    order: 2,
    label: 'Send payment',
    shortLabel: 'Send',
    subtext: 'Send payment using the details below.',
  },
  {
    id: 'confirm_payment',
    order: 3,
    label: 'Payment confirmation',
    shortLabel: 'Confirm',
    subtext: 'Submit your payment details so we can match your transaction.',
  },
];

export function stageSubtext(stage: PaymentFlowStage): string {
  if (stage === 'awaiting_verification') {
    return 'Your payment has been reported. Verification is in progress.';
  }
  return PAYMENT_FLOW_STAGES.find((s) => s.id === stage)?.subtext ?? '';
}

export function stageOrder(stage: PaymentFlowStage): number {
  if (stage === 'awaiting_verification') return 4;
  return PAYMENT_FLOW_STAGES.find((s) => s.id === stage)?.order ?? 1;
}

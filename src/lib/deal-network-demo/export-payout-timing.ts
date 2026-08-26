import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT } from '@/lib/ai-extractor/party-linked-settlement';

/** Deal-level commercial term — never inferred as a named participant's payout timing. */
export function dealLevelExportPayoutTrigger(payoutTrigger: string | undefined): string {
  return payoutTrigger?.trim() || 'Manual';
}

/**
 * Timing that the agreement (or operator) explicitly attached to this participant.
 * Does not fall back to deal.payoutTrigger / project paymentTerms.
 */
export function resolveParticipantExportPayoutTiming(participant: DemoParticipant): string {
  const payoutCondition = participant.payoutCondition?.trim();
  if (payoutCondition) return payoutCondition;

  const triggers = new Set<string>();

  for (const term of participant.extractedObligations?.compensationTerms ?? []) {
    const trigger = term.trigger?.trim();
    if (trigger) triggers.add(trigger);
  }
  for (const event of participant.extractedObligations?.settlementEvents ?? []) {
    const trigger = event.trigger?.trim() || event.condition?.trim();
    if (trigger) triggers.add(trigger);
  }
  for (const payment of participant.extractedObligations?.conditionalPayments ?? []) {
    const trigger = payment.trigger?.trim();
    if (trigger) triggers.add(trigger);
  }

  if (triggers.size > 0) return [...triggers].join('; ');

  const dueDate = participant.payoutDueDate?.trim();
  if (dueDate) return dueDate;

  return PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT;
}

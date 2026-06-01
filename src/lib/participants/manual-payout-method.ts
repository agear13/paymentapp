/**
 * Participant-level manual payout instructions — shared across attribution, referral, and payout flows.
 */

export type ManualPayoutAttachment = {
  label: string;
  url: string;
};

export type ManualPayoutMethod = {
  type: 'manual';
  label: string;
  instructions: string;
  attachments?: ManualPayoutAttachment[];
};

export function normalizeManualPayoutMethod(
  input: Partial<ManualPayoutMethod> | null | undefined
): ManualPayoutMethod | null {
  if (!input || input.type !== 'manual') return null;
  const label = input.label?.trim() ?? '';
  const instructions = input.instructions?.trim() ?? '';
  if (!label || !instructions) return null;
  const attachments = Array.isArray(input.attachments)
    ? input.attachments
        .filter(
          (a): a is ManualPayoutAttachment =>
            typeof a?.label === 'string' &&
            a.label.trim().length > 0 &&
            typeof a?.url === 'string' &&
            a.url.trim().length > 0
        )
        .map((a) => ({ label: a.label.trim(), url: a.url.trim() }))
    : [];
  return {
    type: 'manual',
    label,
    instructions,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/** Maps participant manual payout metadata onto payment link manual bank fields. */
export function manualPayoutMethodToPaymentLinkFields(
  method: ManualPayoutMethod,
  currency?: string
): {
  manual_bank_recipient_name: string;
  manual_bank_currency: string;
  manual_bank_destination_type: string;
  manual_bank_instructions: string;
} {
  const attachmentNote =
    method.attachments && method.attachments.length > 0
      ? `\n\nAttachments:\n${method.attachments.map((a) => `- ${a.label}: ${a.url}`).join('\n')}`
      : '';
  return {
    manual_bank_recipient_name: method.label,
    manual_bank_currency: (currency ?? 'USD').toUpperCase().slice(0, 3),
    manual_bank_destination_type: 'manual',
    manual_bank_instructions: `${method.instructions}${attachmentNote}`.trim(),
  };
}

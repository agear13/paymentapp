/** Operator-facing copy — merchant-realistic, non-custodial payout semantics. */

export const OPERATOR_PAYOUT_DISCLAIMER =
  'Provvypay does not currently facilitate regulated payout onboarding or KYC collection. Operators are responsible for collecting required payout and tax information according to local regulations before making payouts.';

export const PAYOUT_CONFIRMATION_LABELS = {
  notConfirmed: 'Not confirmed',
  confirmed: 'Confirmed',
  toggleLabel: 'Verified externally',
  helperLine:
    'Operator confirms payout details were collected outside Provvypay.',
} as const;

export const AGREEMENT_SHARE_HELPER =
  'You may also share this agreement link through SMS, WhatsApp, or other messaging platforms.';

export const AGREEMENT_ACTION_COPY = {
  copyLink: {
    label: 'Copy agreement link',
    tooltip: 'Copies the agreement URL for operator reference. Does not enable participant approval.',
  },
  shareForApproval: {
    label: 'Share for approval',
    tooltip:
      'Generates a participant approval link/token. This is the only action that enables agreement approval.',
  },
  preview: {
    label: 'Preview agreement (read-only)',
    tooltip: 'Operator-only preview. Participants cannot approve from this view.',
  },
} as const;

export const SERVICE_CATALOG_ATTRIBUTION_WARNING = {
  title: 'Customer attribution is enabled, but no services or products are available for tracked purchases.',
  description:
    'Participants can only earn commission on catalog items available to customers.',
  cta: 'Add services',
} as const;

export const PAYOUT_GLOSSARY = {
  obligation:
    'An amount owed to a participant after a customer payment — tracked until funded, approved, and released.',
  settlement:
    'The process of grouping approved payout-ready obligations into a release batch and sending funds to participants.',
  releaseBatch:
    'A grouped payout release containing one or more participant payments approved for disbursement.',
  reconciled:
    'Payment records and ledger balances align — no discrepancy between expected and recorded amounts.',
  availableForPayout:
    'This obligation has funding and approvals completed and can be included in a payout release.',
  payoutStatus:
    'Where this obligation sits in the payout lifecycle — from unfunded through to paid or reversed.',
  participantReadiness:
    'Whether the participant has completed payout profile setup required before funds can be released.',
} as const;

export type PayoutGlossaryTerm = keyof typeof PAYOUT_GLOSSARY;

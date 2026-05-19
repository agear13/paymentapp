export const COLLECTION_PREFERENCES = [
  {
    id: 'invoices',
    title: 'Invoice-based collection',
    description:
      'Formal billing and settlement coordination for clients, suppliers, and project work.',
  },
  {
    id: 'payment_links',
    title: 'Link-based collection',
    description: 'Quick payments for bookings, deposits, sponsorships, and events.',
  },
  {
    id: 'manual_transfers',
    title: 'Manual payment tracking',
    description: 'Track external bank transfers, cash payments, or offline settlement activity.',
  },
  {
    id: 'decide_later',
    title: 'Configure later',
    description: 'Skip setup for now and configure collection methods inside your workspace.',
  },
] as const;

export type CollectionPreferenceId = (typeof COLLECTION_PREFERENCES)[number]['id'];

export const COLLECTION_PREFERENCE_VALUES = COLLECTION_PREFERENCES.map(
  (p) => p.id
) as [CollectionPreferenceId, ...CollectionPreferenceId[]];

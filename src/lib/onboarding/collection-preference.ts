export const COLLECTION_PREFERENCES = [
  {
    id: 'invoices',
    title: 'Invoice Collection',
    description:
      'Formal billing and settlement coordination for clients, suppliers, and commercial work.',
  },
  {
    id: 'payment_links',
    title: 'Payment Link Collection',
    description: 'Quick revenue collection for bookings, deposits, sponsorships, and events.',
  },
  {
    id: 'manual_transfers',
    title: 'External Settlement Tracking',
    description: 'Track external bank transfers, cash settlements, or offline settlement activity.',
  },
  {
    id: 'decide_later',
    title: 'Configure Later',
    description: 'Skip setup for now and configure revenue collection inside your workspace.',
  },
] as const;

export type CollectionPreferenceId = (typeof COLLECTION_PREFERENCES)[number]['id'];

export const COLLECTION_PREFERENCE_VALUES = COLLECTION_PREFERENCES.map(
  (p) => p.id
) as [CollectionPreferenceId, ...CollectionPreferenceId[]];

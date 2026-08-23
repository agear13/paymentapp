import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

/**
 * Product-level guidance destinations.
 * Maps a capability the user may want to configure to the existing surface
 * that actually owns it — so guidance can deep-link instead of describing
 * Provvy's information architecture.
 *
 * Do not invent routes here. Branding currently lives on Payments & Settlement.
 */
export type GuidanceCapability =
  | 'accounting'
  | 'payment_rail'
  | 'settlement'
  | 'participant_earnings'
  | 'workflow'
  | 'branding'
  | 'advisor';

export type GuidanceDestination = {
  capability: GuidanceCapability;
  href: string;
  title: string;
  description: string;
  actionLabel: string;
};

export const GUIDANCE_DESTINATIONS: Record<GuidanceCapability, GuidanceDestination> = {
  accounting: {
    capability: 'accounting',
    href: COMMERCIAL_OS_ROUTES.connected,
    title: 'Connect accounting',
    description:
      'Connect Xero so invoice and payment records can be synchronised for accounting reconciliation.',
    actionLabel: 'Open Connected Systems',
  },
  payment_rail: {
    capability: 'payment_rail',
    href: COMMERCIAL_OS_ROUTES.paymentsProviders,
    title: 'Set up payment methods',
    description: 'Configure the payment providers and rails you want customers to use.',
    actionLabel: 'Open Payments & Settlement',
  },
  settlement: {
    capability: 'settlement',
    href: COMMERCIAL_OS_ROUTES.settlement,
    title: 'Configure settlement',
    description: 'Review what the business owes and what is ready to settle.',
    actionLabel: 'Open Settlement',
  },
  participant_earnings: {
    capability: 'participant_earnings',
    href: COMMERCIAL_OS_ROUTES.workflows,
    title: 'Set up a revenue-sharing workflow',
    description:
      'Start from Workflow Library. Participant payout rules live in workflows — not the settlement earnings ledger.',
    actionLabel: 'Open Workflow Library',
  },
  workflow: {
    capability: 'workflow',
    href: COMMERCIAL_OS_ROUTES.workflows,
    title: 'Explore Workflow Library',
    description: 'Choose or start a commercial workflow that matches how you already work.',
    actionLabel: 'Open Workflow Library',
  },
  branding: {
    capability: 'branding',
    href: COMMERCIAL_OS_ROUTES.payments,
    title: 'Customize your invoices and payment pages',
    description: 'Update your branding and how your business appears to customers.',
    actionLabel: 'Open branding',
  },
  advisor: {
    capability: 'advisor',
    href: COMMERCIAL_OS_ROUTES.advisor,
    title: 'Open Advisor',
    description: 'See what Provvy knows from setup and an optional next step.',
    actionLabel: 'Open Advisor',
  },
};

export function guidanceDestination(capability: GuidanceCapability): GuidanceDestination {
  return GUIDANCE_DESTINATIONS[capability];
}

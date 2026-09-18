import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export const LANDING_INFRASTRUCTURE_COPY = {
  eyebrow: 'One intelligence layer',
  headline: 'Your existing payment infrastructure.',
  headlineAccent: 'Connected by Provvy.',
  body: 'Provvy sits above the payment, wallet and accounting systems you already use — helping you decide what should happen, then coordinating the workflow you approve.',
  ctaLabel: 'See all integrations',
  ctaHref: COMMERCIAL_OS_ROUTES.connected,
  centerName: 'Provvy',
  centerRole: 'Payment Intelligence',
  centerFlow: 'Understand → Recommend → Coordinate',
  footer:
    'Built to work across the infrastructure your business already uses.',
  footerCategories: 'Payment rails · Wallets · Financial infrastructure · Accounting',
} as const;

export type LandingInfrastructureCategory =
  | 'Payment rail'
  | 'Wallet'
  | 'Web3'
  | 'Accounting';

export type LandingInfrastructureId =
  | 'stripe'
  | 'wise'
  | 'airwallex'
  | 'metamask'
  | 'hashpack'
  | 'hedera'
  | 'cregis'
  | 'xero';

export type LandingInfrastructureNode = {
  id: LandingInfrastructureId;
  name: string;
  category: LandingInfrastructureCategory;
  detail: string;
  mark: 'stripe' | 'wise' | 'airwallex' | 'wallet' | 'hash' | 'ledger' | 'payout' | 'ledger-book';
  /** Percentage coordinates in the 100×100 network viewBox. */
  x: number;
  y: number;
  /** Hidden below `lg` so the mobile network stays readable. */
  desktopOnly?: boolean;
};

export const LANDING_INFRASTRUCTURE_NODES: readonly LandingInfrastructureNode[] = [
  {
    id: 'wise',
    name: 'Wise',
    category: 'Payment rail',
    detail: 'International transfer',
    mark: 'wise',
    x: 50,
    y: 11,
  },
  {
    id: 'cregis',
    name: 'Cregis',
    category: 'Web3',
    detail: 'Crypto payout rail',
    mark: 'payout',
    x: 76,
    y: 20,
    desktopOnly: true,
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    category: 'Wallet',
    detail: 'EVM wallet checkout',
    mark: 'wallet',
    x: 84,
    y: 38,
  },
  {
    id: 'hashpack',
    name: 'HashPack',
    category: 'Wallet',
    detail: 'Hedera wallet checkout',
    mark: 'hash',
    x: 84,
    y: 64,
  },
  {
    id: 'hedera',
    name: 'Hedera',
    category: 'Web3',
    detail: 'On-ledger settlement',
    mark: 'ledger',
    x: 70,
    y: 84,
    desktopOnly: true,
  },
  {
    id: 'xero',
    name: 'Xero',
    category: 'Accounting',
    detail: 'Financial records',
    mark: 'ledger-book',
    x: 50,
    y: 90,
  },
  {
    id: 'airwallex',
    name: 'Airwallex',
    category: 'Payment rail',
    detail: 'Business international transfer',
    mark: 'airwallex',
    x: 18,
    y: 76,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Payment rail',
    detail: 'Card collection',
    mark: 'stripe',
    x: 16,
    y: 40,
  },
];

export function landingInfrastructureCurve(x: number, y: number): string {
  const mx = (50 + x) / 2;
  const my = (50 + y) / 2;
  const dx = x - 50;
  const dy = y - 50;
  const cx = mx - dy * 0.16;
  const cy = my + dx * 0.16;
  return `M 50 50 Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x} ${y}`;
}

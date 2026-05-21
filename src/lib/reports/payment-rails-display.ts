export type PaymentRailId =
  | 'stripe'
  | 'wise'
  | 'hbar'
  | 'usdc'
  | 'usdt'
  | 'audd';

export const PAYMENT_RAIL_COLORS: Record<PaymentRailId, string> = {
  stripe: '#635BFF',
  wise: '#00B9FF',
  hbar: '#82A4F8',
  usdc: '#2775CA',
  usdt: '#26A17B',
  audd: '#00843D',
};

export const PAYMENT_RAIL_LABELS: Record<PaymentRailId, string> = {
  stripe: 'Stripe',
  wise: 'Wise',
  hbar: 'HBAR',
  usdc: 'USDC',
  usdt: 'USDT',
  audd: 'AUDD',
};

export const PAYMENT_DISTRIBUTION_LABELS: Record<string, string> = {
  Stripe: 'Stripe',
  Wise: 'Wise',
  'Hedera - HBAR': 'HBAR',
  'Hedera - USDC': 'USDC',
  'Hedera - USDT': 'USDT',
  'Hedera - AUDD': 'AUDD',
};

export function colorForDistributionLabel(label: string): string {
  switch (label) {
    case 'Stripe':
      return PAYMENT_RAIL_COLORS.stripe;
    case 'Wise':
      return PAYMENT_RAIL_COLORS.wise;
    case 'Hedera - HBAR':
      return PAYMENT_RAIL_COLORS.hbar;
    case 'Hedera - USDC':
      return PAYMENT_RAIL_COLORS.usdc;
    case 'Hedera - USDT':
      return PAYMENT_RAIL_COLORS.usdt;
    case 'Hedera - AUDD':
      return PAYMENT_RAIL_COLORS.audd;
    default:
      return '#64748b';
  }
}

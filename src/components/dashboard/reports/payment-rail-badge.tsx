import { cn } from '@/lib/utils';
import type { PaymentRailId } from '@/lib/reports/payment-rails-display';
import { PAYMENT_RAIL_COLORS, PAYMENT_RAIL_LABELS } from '@/lib/reports/payment-rails-display';

const RAIL_SHORT: Partial<Record<PaymentRailId, string>> = {
  stripe: 'Stripe',
  wise: 'Wise',
  hbar: 'HBAR',
  usdc: 'USDC',
  usdt: 'USDT',
  audd: 'AUDD',
};

export function PaymentRailBadge({
  rail,
  className,
  size = 'sm',
}: {
  rail: PaymentRailId;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const color = PAYMENT_RAIL_COLORS[rail];
  const text = RAIL_SHORT[rail] ?? PAYMENT_RAIL_LABELS[rail];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded font-bold leading-none text-white shadow-sm',
        size === 'md' ? 'h-6 min-w-[2.75rem] px-1.5 text-[11px]' : 'h-5 min-w-[2.5rem] px-1 text-[10px]',
        rail === 'audd' && 'tracking-tight',
        className
      )}
      style={{ backgroundColor: color }}
      title={PAYMENT_RAIL_LABELS[rail]}
      aria-label={PAYMENT_RAIL_LABELS[rail]}
    >
      {text}
    </span>
  );
}

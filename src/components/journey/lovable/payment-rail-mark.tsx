import type { PaymentRailId } from '@/lib/journey/payment-intelligence-types';

type Mark = {
  label: string;
  short: string;
  bg: string;
  fg: string;
};

const MARKS: Record<PaymentRailId, Mark> = {
  wise: { label: 'Wise', short: 'Wise', bg: '#9FE870', fg: '#163300' },
  airwallex: { label: 'Airwallex', short: 'AWX', bg: '#1B51E5', fg: '#FFFFFF' },
  ofx: { label: 'OFX', short: 'OFX', bg: '#00AEEF', fg: '#082033' },
  stripe: { label: 'Stripe', short: 'Stripe', bg: '#635BFF', fg: '#FFFFFF' },
  paypal: { label: 'PayPal', short: 'PP', bg: '#003087', fg: '#FFFFFF' },
  swift: { label: 'SWIFT', short: 'SWIFT', bg: '#D52B1E', fg: '#FFFFFF' },
  visa: { label: 'Visa', short: 'Visa', bg: '#1A1F71', fg: '#FFFFFF' },
  mastercard: { label: 'Mastercard', short: 'MC', bg: '#EB001B', fg: '#FFFFFF' },
  apple_pay: { label: 'Apple Pay', short: 'Apple', bg: '#111111', fg: '#FFFFFF' },
  google_pay: { label: 'Google Pay', short: 'GPay', bg: '#4285F4', fg: '#FFFFFF' },
  npp: { label: 'NPP', short: 'NPP', bg: '#00A3E0', fg: '#062430' },
  bank: { label: 'Bank', short: 'Bank', bg: '#1F2937', fg: '#F8FAFC' },
  digital_dollar: { label: 'Digital-dollar', short: 'DD', bg: '#6D28D9', fg: '#F5F3FF' },
  rba: { label: 'RBA', short: 'RBA', bg: '#C8102E', fg: '#FFFFFF' },
};

export function PaymentRailMark({
  railId,
  size = 'md',
}: {
  railId: PaymentRailId;
  size?: 'sm' | 'md';
}) {
  const mark = MARKS[railId];
  const box = size === 'sm' ? 'h-8 min-w-8 px-1.5 text-[9px]' : 'h-9 min-w-9 px-1.5 text-[10px]';
  return (
    <div
      className={`grid ${box} shrink-0 place-items-center rounded-md font-semibold tracking-tight`}
      style={{ backgroundColor: mark.bg, color: mark.fg }}
      title={mark.label}
      aria-hidden="true"
    >
      {mark.short}
    </div>
  );
}

export function paymentRailMarkLabel(railId: PaymentRailId): string {
  return MARKS[railId].label;
}

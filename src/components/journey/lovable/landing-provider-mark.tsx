'use client';

import type { LandingProviderId } from '@/lib/journey/landing-provider-catalog';

type MarkSpec = {
  label: string;
  initials: string;
  glyph: 'bars' | 'diamond' | 'split' | 'stack' | 'wave' | 'columns' | 'ring';
};

const MARK: Record<LandingProviderId, MarkSpec> = {
  wise: { label: 'Wise', initials: 'Wi', glyph: 'bars' },
  airwallex: { label: 'Airwallex', initials: 'Aw', glyph: 'diamond' },
  ofx: { label: 'OFX', initials: 'OF', glyph: 'split' },
  stripe: { label: 'Stripe', initials: 'St', glyph: 'stack' },
  paypal: { label: 'PayPal', initials: 'PP', glyph: 'wave' },
  bank: { label: 'Bank', initials: 'Bk', glyph: 'columns' },
  digital_dollar: { label: 'Digital dollar', initials: 'Dd', glyph: 'ring' },
};

function Glyph({ kind }: { kind: MarkSpec['glyph'] }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'bars':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path {...common} d="M3 11.5 V6.5 M8 12.5 V4 M13 11 V7.5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path {...common} d="M8 2.5 13.5 8 8 13.5 2.5 8Z" />
        </svg>
      );
    case 'split':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path {...common} d="M4 4.5h8M4 11.5h8M6.5 4.5v7" />
        </svg>
      );
    case 'stack':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <rect x="3.5" y="3.5" width="9" height="3" rx="0.8" {...common} />
          <rect x="3.5" y="9.5" width="9" height="3" rx="0.8" {...common} />
        </svg>
      );
    case 'wave':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path {...common} d="M2.5 10c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 2.5 0" />
        </svg>
      );
    case 'columns':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path {...common} d="M3 13V6.5h10V13M2.5 6.5h11M8 6.5V13" />
        </svg>
      );
    case 'ring':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <circle cx="8" cy="8" r="5" {...common} />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function LandingProviderMark({
  providerId,
  size = 'md',
}: {
  providerId: LandingProviderId;
  size?: 'sm' | 'md';
}) {
  const mark = MARK[providerId];
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  return (
    <div
      className={`grid ${box} shrink-0 place-items-center rounded-lg border border-border/80 bg-card shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)]`}
      aria-hidden="true"
      title={mark.label}
    >
      <div className="flex flex-col items-center gap-0.5 text-ink-soft">
        <Glyph kind={mark.glyph} />
        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-foreground/80">
          {mark.initials}
        </span>
      </div>
    </div>
  );
}

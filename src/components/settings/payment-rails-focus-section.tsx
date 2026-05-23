'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PAYMENT_RAILS_ANCHOR } from '@/lib/operations/guidance/contextual-next-step';

const HIGHLIGHT_CLASS = 'ring-2 ring-primary/35 shadow-md transition-shadow duration-500';

type PaymentRailsFocusProps = {
  children: React.ReactNode;
  className?: string;
};

/** Scroll + pulse payment rails section when URL hash matches. */
export function PaymentRailsFocusSection({ children, className }: PaymentRailsFocusProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash !== PAYMENT_RAILS_ANCHOR && hash !== 'provider-setup') return;

    const el = ref.current;
    if (!el) return;

    const scrollTimer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlighted(true);
    }, 120);

    const clearTimer = window.setTimeout(() => setHighlighted(false), 3200);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, []);

  return (
    <div
      ref={ref}
      id={PAYMENT_RAILS_ANCHOR}
      className={cn(className, highlighted && HIGHLIGHT_CLASS)}
    >
      {children}
    </div>
  );
}

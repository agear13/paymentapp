'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarketingSectionProps = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function MarketingSection({
  id,
  title,
  description,
  children,
  className,
  action,
}: MarketingSectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-6 space-y-6 animate-in fade-in duration-500', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

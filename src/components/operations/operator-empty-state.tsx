'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { opTypeAction, opTypeBodySnug, opTypeMeta } from '@/lib/design/operational-typography';
import { opSpace } from '@/lib/design/operational-spacing';
import { opCtaButton, opSurface } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

export function OperatorEmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
  className,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        opSurface('inset', cn(opSpace.emptyY, 'text-center max-w-lg mx-auto')),
        className
      )}
    >
      <p className={opTypeMeta}>Current state</p>
      <p className={cn(opTypeAction, 'mt-1')}>{title}</p>
      <p className={cn(opTypeBodySnug, 'mt-2')}>{body}</p>
      {ctaLabel && ctaHref ? (
        <Button asChild variant="outline" size="sm" className={cn('mt-4', opCtaButton)}>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

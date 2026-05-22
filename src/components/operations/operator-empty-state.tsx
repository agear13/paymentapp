'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
    <div className={cn('py-10 text-center space-y-3 max-w-md mx-auto', className)}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      {ctaLabel && ctaHref ? (
        <Button asChild variant="outline" size="sm">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

'use client';

import { Loader2 } from 'lucide-react';

type EntitlementLoadingProps = {
  label?: string;
  className?: string;
};

export function EntitlementLoading({ label = 'Loading plan details…', className }: EntitlementLoadingProps) {
  return (
    <div
      className={`flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

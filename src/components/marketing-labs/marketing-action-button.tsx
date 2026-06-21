'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MarketingActionButtonProps = {
  idleLabel: React.ReactNode;
  loadingLabel: React.ReactNode;
  successLabel: React.ReactNode;
  onAction: () => Promise<void> | void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  successDurationMs?: number;
};

export function MarketingActionButton({
  idleLabel,
  loadingLabel,
  successLabel,
  onAction,
  disabled,
  variant = 'default',
  size = 'default',
  className,
  successDurationMs = 2000,
}: MarketingActionButtonProps) {
  const [phase, setPhase] = React.useState<'idle' | 'loading' | 'success'>('idle');

  const handleClick = async () => {
    if (phase !== 'idle') return;
    setPhase('loading');
    try {
      await onAction();
      setPhase('success');
      window.setTimeout(() => setPhase('idle'), successDurationMs);
    } catch {
      setPhase('idle');
    }
  };

  const label =
    phase === 'loading' ? loadingLabel : phase === 'success' ? successLabel : idleLabel;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || phase === 'loading'}
      onClick={handleClick}
      className={cn(
        'transition-all duration-300',
        phase === 'success' && 'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.08)] text-[rgb(29,111,66)]',
        className
      )}
    >
      {phase === 'success' ? <Check className="mr-2 size-4" /> : null}
      {label}
    </Button>
  );
}

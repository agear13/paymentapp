'use client';

import * as React from 'react';
import { Check, Circle } from 'lucide-react';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { cn } from '@/lib/utils';

/** Live provider + activation checklist on the payment rails onboarding step. */
export function OnboardingProviderChecklist() {
  const { activation, refresh } = useWorkspaceActivation();

  React.useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  if (!activation) return null;

  const providerItems = activation.checklist.filter((item) =>
    ['currency', 'provider', 'revenue'].includes(item.id)
  );

  if (providerItems.length === 0) return null;

  return (
    <ul className="rounded-lg border border-border/30 bg-background/80 px-4 py-3 space-y-1.5">
      {providerItems.map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex items-center gap-2 text-sm transition-colors duration-300',
            item.complete ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {item.complete ? (
            <Check className="h-4 w-4 text-emerald-600 shrink-0 animate-in zoom-in-50 duration-200" />
          ) : (
            <Circle className="h-4 w-4 shrink-0" />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

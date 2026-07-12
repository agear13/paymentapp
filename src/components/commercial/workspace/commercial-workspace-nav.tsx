'use client';

import { cn } from '@/lib/utils';
import type { CommercialWorkspaceSection } from '@/lib/participant-portal/participant-portal-types';

const SECTIONS: { id: CommercialWorkspaceSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'terms', label: 'Commercial Terms' },
  { id: 'payments', label: 'Payments' },
  { id: 'activity', label: 'Activity' },
];

type Props = {
  active: CommercialWorkspaceSection;
  onChange: (section: CommercialWorkspaceSection) => void;
  className?: string;
};

export function CommercialWorkspaceNav({ active, onChange, className }: Props) {
  return (
    <nav
      className={cn(
        'flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none',
        className
      )}
      aria-label="Commercial workspace sections"
    >
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onChange(section.id)}
          className={cn(
            'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            active === section.id
              ? 'bg-foreground text-background'
              : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

'use client';

import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CopilotSuggestions({
  suggestions,
  onSelect,
  disabled,
  className,
}: {
  suggestions: string[];
  onSelect: (s: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn('border-b px-3 py-3', className)}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Lightbulb className="size-3" aria-hidden />
        Suggestions
      </div>
      <div className="flex flex-col gap-1.5">
        {suggestions.map((s) => (
          <Button
            key={s}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 justify-start whitespace-normal px-2.5 py-1.5 text-left text-xs font-normal leading-snug"
            disabled={disabled}
            onClick={() => onSelect(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}

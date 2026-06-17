'use client';

import { Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OnboardingTemplateDraftBannerProps = {
  templateTitle: string;
  onEditTemplate?: () => void;
  className?: string;
  compact?: boolean;
};

const EDITABLE_ITEMS = [
  'Participants',
  'Commercial Terms',
  'Settlement Rules',
  'Payment Structure',
] as const;

export function OnboardingTemplateDraftBanner({
  templateTitle,
  onEditTemplate,
  className,
  compact = false,
}: OnboardingTemplateDraftBannerProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[rgba(124,92,255,0.2)] bg-gradient-to-br from-[rgba(124,92,255,0.08)] to-white p-4 sm:p-5',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(124,92,255)]">
            Template draft
          </p>
          <p className="text-base font-semibold text-foreground">{templateTitle}</p>
          {!compact ? (
            <>
              <p className="text-sm text-muted-foreground leading-snug">
                This template gives you a starting point. Everything below can be edited before you
                begin using it.
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {EDITABLE_ITEMS.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-foreground">
                    <Check className="h-3.5 w-3.5 text-[rgb(124,92,255)] shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground leading-snug">
              Review this draft and adjust participants before continuing.
            </p>
          )}
        </div>
        {onEditTemplate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onEditTemplate}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit Draft
          </Button>
        ) : null}
      </div>
    </div>
  );
}

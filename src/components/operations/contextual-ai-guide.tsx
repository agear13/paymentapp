'use client';

import Link from 'next/link';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

type GuideAction = {
  label: string;
  href: string;
};

type ContextualAIGuideProps = {
  message: string;
  action?: GuideAction;
  tone?: 'default' | 'positive' | 'muted';
  className?: string;
};

/**
 * Per-page guidance banner — answers "What should I do here?" on every agreement section.
 * Appears once, contextually, without cluttering the page with repeated readiness scores.
 *
 * Examples:
 *   Money page:   "Connect Stripe to begin collecting payments." + [Connect]
 *   People page:  "Invite Sarah before payouts can be released." + [Invite]
 *   History page: "No action required."
 */
export function ContextualAIGuide({
  message,
  action,
  tone = 'default',
  className,
}: ContextualAIGuideProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        tone === 'positive' &&
          'border-[rgba(29,111,66,0.2)] bg-[rgba(29,111,66,0.04)]',
        tone === 'muted' && 'border-border/40 bg-muted/10',
        tone === 'default' &&
          'border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.04)]',
        className
      )}
    >
      <Lightbulb
        className={cn(
          'h-3.5 w-3.5 shrink-0 mt-0.5',
          tone === 'positive' && 'text-[rgb(29,111,66)]',
          tone === 'muted' && 'text-muted-foreground/50',
          tone === 'default' && 'text-[rgb(124,92,255)]'
        )}
        aria-hidden
      />
      <p className="text-sm text-muted-foreground leading-snug flex-1">{message}</p>
      {action ? (
        <Link
          href={action.href}
          className={cn(
            'shrink-0 flex items-center gap-1 text-xs font-medium transition-colors',
            tone === 'positive' &&
              'text-[rgb(29,111,66)] hover:text-[rgb(29,111,66)]/80',
            tone === 'default' &&
              'text-[rgb(124,92,255)] hover:text-[rgb(108,78,235)]',
            tone === 'muted' && 'text-muted-foreground hover:text-foreground'
          )}
        >
          {action.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

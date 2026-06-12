'use client';

import type { ExtractionConfidence } from '@/lib/ai-extractor/extraction-types';
import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  confidence: ExtractionConfidence;
  className?: string;
}

const CONFIG: Record<ExtractionConfidence, { dot: string; label: string; text: string }> = {
  high:   { dot: 'bg-emerald-500', label: 'high',    text: 'text-emerald-700 dark:text-emerald-400' },
  medium: { dot: 'bg-amber-400',   label: 'medium',  text: 'text-amber-700 dark:text-amber-400' },
  low:    { dot: 'bg-red-500',     label: 'low',     text: 'text-red-700 dark:text-red-400' },
  absent: { dot: 'bg-muted-foreground/40', label: 'not found', text: 'text-muted-foreground' },
};

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const { dot, label, text } = CONFIG[confidence];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', text, className)}>
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full flex-shrink-0', dot)} />
      {label}
    </span>
  );
}

/** Participant-level badge shown in ReviewPartyCard header. */
export function CurrencyConfidenceBadge({
  label,
  code,
}: {
  label: 'confirmed' | 'assumed' | 'unknown';
  code?: string;
}) {
  const config = {
    confirmed: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      prefix: '✓',
      label: code ? `Confirmed ${code}` : 'Confirmed',
    },
    assumed: {
      dot: 'bg-amber-400',
      text: 'text-amber-700 dark:text-amber-400',
      prefix: '⚠',
      label: code ? `Assumed ${code}` : 'Assumed',
    },
    unknown: {
      dot: 'bg-amber-400',
      text: 'text-amber-700 dark:text-amber-400',
      prefix: '⚠',
      label: 'Currency Unconfirmed',
    },
  }[label];

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', config.text)}>
      <span aria-hidden>{config.prefix}</span>
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full flex-shrink-0', config.dot)} />
      {config.label}
    </span>
  );
}

export function ParticipantConfidenceBadge({ confidence }: { confidence: ExtractionConfidence }) {
  if (confidence === 'high') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
        <span className="text-emerald-500">✓</span> High confidence
      </span>
    );
  }
  if (confidence === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
        <span>⚠</span> Medium confidence
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
      <span>✗</span> {confidence === 'absent' ? 'Not found' : 'Low confidence'}
    </span>
  );
}
'use client';

import * as React from 'react';
import { trackIntelligenceFeedback } from '@/lib/agreements/validation/agreement-intelligence-analytics';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AgreementIntelligenceFeedbackPromptProps = {
  kind: 'recommendation' | 'blocker';
  className?: string;
};

const PROMPT_COPY = {
  recommendation: 'Was this recommendation helpful?',
  blocker: 'Did you understand what was blocking settlement?',
} as const;

const SESSION_KEY_PREFIX = 'provvypay:ai-feedback:';

export function AgreementIntelligenceFeedbackPrompt({
  kind,
  className,
}: AgreementIntelligenceFeedbackPromptProps) {
  const [visible, setVisible] = React.useState(false);
  const [answered, setAnswered] = React.useState<'yes' | 'no' | null>(null);

  React.useEffect(() => {
    const key = `${SESSION_KEY_PREFIX}${kind}`;
    if (sessionStorage.getItem(key)) return;
    const timer = window.setTimeout(() => setVisible(true), 4000);
    return () => window.clearTimeout(timer);
  }, [kind]);

  if (!visible || answered) return null;

  const submit = (helpful: boolean) => {
    trackIntelligenceFeedback(kind, helpful);
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${kind}`, helpful ? 'yes' : 'no');
    setAnswered(helpful ? 'yes' : 'no');
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-[rgba(124,92,255,0.15)] bg-white/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{PROMPT_COPY[kind]}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => submit(true)}>
          Yes
        </Button>
        <Button size="sm" variant="ghost" onClick={() => submit(false)}>
          No
        </Button>
      </div>
    </div>
  );
}

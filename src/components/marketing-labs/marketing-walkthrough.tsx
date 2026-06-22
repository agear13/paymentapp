'use client';

import * as React from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const WALKTHROUGH_STORAGE_KEY = 'provvypay:marketing-walkthrough-dismissed';

export type WalkthroughStep = {
  id: string;
  anchor: string;
  title: string;
  value: string;
};

export const MARKETING_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'company-brain',
    anchor: '#company-brain',
    title: 'Company Brain',
    value: 'Phase 0 — your single source of truth. The AI agency already knows Thirsty Turtl.',
  },
  {
    id: 'generate-campaign',
    anchor: '#marketing-command-centre',
    title: 'Generate Campaign',
    value: 'Phase 1 begins — click Generate Campaign and watch AI specialists research, plan SEO, and build strategy.',
  },
  {
    id: 'strategy-approval',
    anchor: '#campaign-strategy-ready',
    title: 'Campaign Strategy Ready',
    value: 'Download the planning-only Strategy Report, then approve to hand off to the AI Creative Team.',
  },
  {
    id: 'creative-team',
    anchor: '#marketing-command-centre',
    title: 'AI Creative Team',
    value: 'Phase 2 — Creative Director, Brand Designer, QA and Marketing Lead produce your assets.',
  },
  {
    id: 'creative-assets',
    anchor: '#campaign-assets',
    title: 'Creative Assets',
    value: 'Canva previews and downloads unlock as production completes.',
  },
  {
    id: 'marketing-operations',
    anchor: '#marketing-operations',
    title: 'Marketing Operations',
    value: 'Approve publishing and review the campaign schedule.',
  },
  {
    id: 'final-deliverables',
    anchor: '#final-deliverables',
    title: 'Final Deliverables',
    value: 'Download your Canva Client Report, AI Team Performance Report, and complete Campaign Package.',
  },
];

type MarketingWalkthroughProps = {
  onDismiss?: () => void;
};

export function MarketingWalkthrough({ onDismiss }: MarketingWalkthroughProps) {
  const [visible, setVisible] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(WALKTHROUGH_STORAGE_KEY);
    setVisible(dismissed !== 'true');
  }, []);

  const dismiss = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true');
    }
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const replay = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(WALKTHROUGH_STORAGE_KEY);
    }
    setStepIndex(0);
    setVisible(true);
  }, []);

  React.useEffect(() => {
    (window as Window & { replayMarketingWalkthrough?: () => void }).replayMarketingWalkthrough = replay;
    return () => {
      delete (window as Window & { replayMarketingWalkthrough?: () => void }).replayMarketingWalkthrough;
    };
  }, [replay]);

  if (!visible) return null;

  const step = MARKETING_WALKTHROUGH_STEPS[stepIndex]!;
  const isLast = stepIndex >= MARKETING_WALKTHROUGH_STEPS.length - 1;

  const goToStep = () => {
    const el = document.querySelector(step.anchor);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent animate-in fade-in slide-in-from-top-2 duration-500">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Guided tour</CardTitle>
            <CardDescription>
              Step {stepIndex + 1} of {MARKETING_WALKTHROUGH_STEPS.length}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={dismiss} aria-label="Dismiss tour">
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-semibold">{step.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{step.value}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={goToStep}>
            Show section
            <ArrowRight className="ml-2 size-3.5" />
          </Button>
          {!isLast ? (
            <Button size="sm" onClick={() => setStepIndex((i) => i + 1)}>
              Next
            </Button>
          ) : (
            <Button size="sm" onClick={dismiss}>
              Finish tour
            </Button>
          )}
          {stepIndex > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setStepIndex((i) => i - 1)}>
              Back
            </Button>
          ) : null}
        </div>
        <div className="flex gap-1">
          {MARKETING_WALKTHROUGH_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= stepIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MarketingWalkthroughReplayButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() => {
        (window as Window & { replayMarketingWalkthrough?: () => void }).replayMarketingWalkthrough?.();
      }}
    >
      Replay tour
    </Button>
  );
}

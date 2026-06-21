'use client';

import * as React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const REVEAL_STEP_MS = 280;

type CreativeProductionCompletePanelProps = {
  importedCount: number;
  className?: string;
};

export function CreativeProductionCompletePanel({
  importedCount,
  className,
}: CreativeProductionCompletePanelProps) {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    setStep(0);
    const timers = [1, 2, 3, 4].map((s) =>
      window.setTimeout(() => setStep(s), s * REVEAL_STEP_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [importedCount]);

  const assetLabel = importedCount === 1 ? 'asset' : 'assets';

  return (
    <Card
      className={cn(
        'border-[rgba(29,111,66,0.3)] bg-gradient-to-br from-[rgba(29,111,66,0.06)] to-transparent shadow-sm',
        'animate-in fade-in slide-in-from-bottom-2 duration-500',
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">AI Creative Team</CardTitle>
        <CardDescription>Production delivered — assets ready for review</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            'flex items-center gap-3 transition-all duration-500',
            step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          )}
        >
          <CheckCircle2 className="size-6 shrink-0 text-[rgb(29,111,66)]" />
          <p className="text-lg font-semibold tracking-tight">Creative Production Complete</p>
        </div>

        <p
          className={cn(
            'text-sm text-muted-foreground transition-all duration-500 delay-75',
            step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          )}
        >
          <span className="font-semibold tabular-nums text-foreground">{importedCount}</span> {assetLabel}{' '}
          imported successfully
        </p>

        <div
          className={cn(
            'rounded-lg border border-[rgba(29,111,66,0.2)] bg-background/80 px-4 py-3 transition-all duration-500',
            step >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          )}
        >
          <p className="text-xs text-muted-foreground">Next step</p>
          <p className="text-sm font-semibold text-[rgb(29,111,66)]">Ready for Marketing Operations</p>
        </div>

        <div
          className={cn(
            'flex flex-wrap gap-2 transition-all duration-500',
            step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          )}
        >
          <Button variant="outline" size="sm" asChild>
            <a href="#campaign-assets">
              View Creative Assets
              <ArrowRight className="ml-2 size-3.5" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="#marketing-operations">
              Marketing Operations
              <ArrowRight className="ml-2 size-3.5" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

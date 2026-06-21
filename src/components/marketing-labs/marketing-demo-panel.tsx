'use client';

import * as React from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import {
  MARKETING_DEMO_STAGE_LABELS,
  type MarketingDemoStage,
} from '@/lib/marketing-jobs/demo-mode';
import { marketingToasts } from '@/lib/marketing-jobs/notifications';

type MarketingDemoPanelProps = {
  engine: MarketingJobEngine;
};

const DEMO_ACTIONS: Array<{
  label: string;
  run: (engine: MarketingJobEngine) => void;
}> = [
  { label: 'Reset Marketing demo', run: (e) => e.resetMarketingDemo() },
  { label: 'Advance AI Marketing Team', run: (e) => e.fastForwardMarketingTeam() },
  { label: 'Approve Campaign Package', run: (e) => e.demoApprovePackage() },
  { label: 'Dispatch to AI Creative Team', run: (e) => e.demoDispatchSkipAnimation() },
  { label: 'Import demo Creative Assets', run: (e) => e.importDemoAssets() },
  { label: 'Complete Marketing Operations', run: (e) => e.fastForwardMarketingOperations() },
  { label: 'Generate next campaign', run: (e) => e.generateRecommendedCampaign() },
  { label: 'Replay entire demo', run: (e) => e.replayMarketingDemo() },
];

const STAGE_JUMPS: MarketingDemoStage[] = [
  'idle',
  'team_working',
  'package_ready',
  'dispatched',
  'assets_ready',
  'operations_ready',
  'publishing_approved',
  'operations_complete',
];

export function MarketingDemoPanel({ engine }: MarketingDemoPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [tapCount, setTapCount] = React.useState(0);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'm') {
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSecretTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 3) {
      setOpen(true);
      setTapCount(0);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleSecretTap}
        className="fixed bottom-4 right-4 z-40 flex size-9 items-center justify-center rounded-full border bg-background/80 text-muted-foreground opacity-40 shadow-sm backdrop-blur transition-opacity hover:opacity-100"
        aria-label="Marketing demo controls"
      >
        <Settings2 className="size-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <span className="sr-only">Open demo panel</span>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Marketing demo controls</SheetTitle>
            <SheetDescription>
              Demonstration only — does not affect production workflows outside Marketing.
              Shortcut: Shift+Alt+M
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6 px-1">
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quick actions
              </p>
              {DEMO_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    try {
                      action.run(engine);
                      marketingToasts.demoStageApplied(action.label);
                    } catch (error) {
                      marketingToasts.error(error instanceof Error ? error.message : 'Demo action failed');
                    }
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </section>
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Jump to stage
              </p>
              {STAGE_JUMPS.map((stage) => (
                <Button
                  key={stage}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    engine.jumpToDemoStage(stage);
                    marketingToasts.demoStageApplied(MARKETING_DEMO_STAGE_LABELS[stage]);
                  }}
                >
                  {MARKETING_DEMO_STAGE_LABELS[stage]}
                </Button>
              ))}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

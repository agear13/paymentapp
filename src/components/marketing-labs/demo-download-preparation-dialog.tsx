'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DEMO_DOWNLOAD_PREP_STEPS } from '@/lib/demo/demo-download';
import type { DemoDeliverableDownloadTarget } from '@/lib/demo/demo-reports.types';

const PREP_LABELS: Record<DemoDeliverableDownloadTarget, string> = {
  client: 'Final Client Report',
  aiTeam: 'AI Team Performance Report',
  package: 'Campaign Package',
  strategy: 'Campaign Strategy Report',
};

type DemoDownloadPreparationDialogProps = {
  open: boolean;
  step: number;
  target: DemoDeliverableDownloadTarget | null;
};

export function DemoDownloadPreparationDialog({
  open,
  step,
  target,
}: DemoDownloadPreparationDialogProps) {
  const label = target ? PREP_LABELS[target] : 'Deliverable';

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-base">Preparing {label}</DialogTitle>
          <DialogDescription>
            The AI Marketing Team is assembling your campaign deliverables.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 py-2">
          {DEMO_DOWNLOAD_PREP_STEPS.map((stepLabel, index) => {
            const complete = step > index;
            const active = step === index;
            return (
              <li
                key={stepLabel}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-all duration-300',
                  complete && 'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)]',
                  active && !complete && 'border-primary/35 bg-primary/[0.06]',
                  !complete && !active && 'border-border/60 text-muted-foreground'
                )}
              >
                {complete ? (
                  <CheckCircle2 className="size-4 shrink-0 text-[rgb(29,111,66)]" />
                ) : active ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border border-muted-foreground/30" />
                )}
                <span className={cn('font-medium', complete && 'text-foreground')}>
                  {index === 0 && complete ? '✓ ' : ''}
                  {stepLabel}
                </span>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { CheckCircle2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
  getDispatchManifestItems,
} from '@/lib/marketing-jobs';

type CreativeDispatchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirming?: boolean;
};

export function CreativeDispatchDialog({
  open,
  onOpenChange,
  onConfirm,
  confirming = false,
}: CreativeDispatchDialogProps) {
  const manifestItems = getDispatchManifestItems();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Creative Dispatch</DialogTitle>
          <DialogDescription>
            The AI Marketing Team has completed campaign planning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm font-medium">The following will be included:</p>
          <ul className="space-y-2">
            {manifestItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[rgb(29,111,66)]" />
                {item}
              </li>
            ))}
          </ul>

          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estimated Creative Production
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {CREATIVE_PRODUCTION_ESTIMATE_MINUTES} minutes
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            <Send className="mr-2 size-4" />
            Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

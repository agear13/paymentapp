'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { XERO_CONNECT_MODAL } from '@/lib/xero/xero-setup-guidance';

type XeroConnectConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirming?: boolean;
};

export function XeroConnectConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  confirming = false,
}: XeroConnectConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{XERO_CONNECT_MODAL.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-1 text-left text-sm text-muted-foreground">
              <p>{XERO_CONNECT_MODAL.bodyIntro}</p>
              <div>
                <p className="font-medium text-foreground">During setup you&apos;ll:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {XERO_CONNECT_MODAL.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
              <p>{XERO_CONNECT_MODAL.returnNote}</p>
              <p>
                <span className="font-medium text-foreground">Estimated time:</span>{' '}
                {XERO_CONNECT_MODAL.estimatedTime}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            {XERO_CONNECT_MODAL.cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Redirecting…' : XERO_CONNECT_MODAL.continueLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

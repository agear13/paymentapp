'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { XeroConnectConfirmDialog } from '@/components/xero/xero-connect-confirm-dialog';
import { useOrganization } from '@/hooks/use-organization';
import { xeroConnectUrl } from '@/lib/journey/commercial-os-routes';
import { commercialOsXeroOAuthReturnPath } from '@/lib/xero/oauth-return-path';
import { storeXeroOAuthContinueFrom } from '@/lib/xero/xero-oauth-continue-context';
import {
  ACCOUNTING_PROVIDER_OPTIONS,
  CONNECT_ACCOUNTING_MODAL,
} from '@/lib/accounting/accounting-integration-copy';
import { useToast } from '@/hooks/use-toast';

type ConnectAccountingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Workspace path to return the user to after accounting setup (stored client-side). */
  continueFrom?: string;
};

export function ConnectAccountingModal({
  open,
  onOpenChange,
  continueFrom,
}: ConnectAccountingModalProps) {
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const [xeroDialogOpen, setXeroDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const beginXeroConnect = () => {
    if (!organizationId) {
      toast({
        title: 'Workspace not ready',
        description: 'Sign in and complete workspace setup before connecting accounting.',
        variant: 'destructive',
      });
      return;
    }
    setXeroDialogOpen(true);
  };

  const confirmXeroConnect = () => {
    if (!organizationId) return;
    setConnecting(true);
    const originPath =
      continueFrom ??
      (typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : undefined);
    const oauthReturnPath = commercialOsXeroOAuthReturnPath();
    if (originPath && originPath.split('?')[0] !== oauthReturnPath) {
      storeXeroOAuthContinueFrom(originPath);
    }
    window.location.href = xeroConnectUrl(organizationId, oauthReturnPath);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{CONNECT_ACCOUNTING_MODAL.title}</DialogTitle>
            <DialogDescription>{CONNECT_ACCOUNTING_MODAL.subtitle}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 pt-2">
            {ACCOUNTING_PROVIDER_OPTIONS.map((provider) => (
              <li key={provider.id}>
                {provider.available ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (provider.id === 'xero') {
                        beginXeroConnect();
                      }
                    }}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <span>
                      <span className="block text-[14px] font-semibold text-foreground">{provider.name}</span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-soft">{provider.description}</span>
                    </span>
                  </button>
                ) : (
                  <div
                    role="group"
                    aria-disabled="true"
                    aria-label={`${provider.name}, ${CONNECT_ACCOUNTING_MODAL.comingSoon}, unavailable`}
                    className="flex w-full cursor-not-allowed items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-[14px] font-semibold text-foreground/80">{provider.name}</span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-soft">{provider.description}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/70">
                      {CONNECT_ACCOUNTING_MODAL.comingSoon}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <XeroConnectConfirmDialog
        open={xeroDialogOpen}
        onOpenChange={setXeroDialogOpen}
        onConfirm={confirmXeroConnect}
        confirming={connecting}
      />
    </>
  );
}

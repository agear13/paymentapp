'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PaymentLinkRailSetupStatus } from '@/lib/payment-links/setup-status';

export type PaymentLinksGuardrailKind = 'no_rails' | 'stripe' | 'wise' | 'hedera';

const MERCHANT_SETTINGS_HREF = '/dashboard/settings/merchant';

type PaymentLinksGuardrailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: PaymentLinksGuardrailKind | null;
  setup: PaymentLinkRailSetupStatus;
  onSwitchToInvoiceOnly: () => void;
  onChooseAnotherPaymentMethod: () => void;
  /** False when no other rail is configured — hide third action. */
  alternativeAvailable: boolean;
};

export function PaymentLinksGuardrailModal({
  open,
  onOpenChange,
  kind,
  setup,
  onSwitchToInvoiceOnly,
  onChooseAnotherPaymentMethod,
  alternativeAvailable,
}: PaymentLinksGuardrailModalProps) {
  const titleAndBody = React.useMemo(() => {
    switch (kind) {
      case 'no_rails':
        return {
          title: 'Connect a payment method first',
          description:
            'Invoice with payment request needs at least one receiving rail (Stripe, Wise, or Hedera). None are configured for this workspace yet.',
        };
      case 'stripe':
        return {
          title: 'Stripe is not connected',
          description:
            'You selected card payments (Stripe), but Stripe Connect is not configured for this organization. Connect Stripe or choose another way to get paid.',
        };
      case 'wise':
        return {
          title: setup.wiseIncomplete ? 'Finish Wise setup' : 'Wise is not available',
          description: setup.wiseIncomplete
            ? 'Wise is enabled but the Wise profile ID is missing. Complete Wise in merchant settings, or choose another payment method.'
            : 'Wise is not fully configured for this organization. Set up Wise or choose another payment method.',
        };
      case 'hedera':
        return {
          title: 'Hedera wallet not configured',
          description:
            'You selected crypto (Hedera), but no Hedera account ID is on file. Add a wallet in merchant settings or choose another payment method.',
        };
      default:
        return {
          title: 'Setup required',
          description: 'Adjust your payment configuration before creating this invoice.',
        };
    }
  }, [kind, setup.wiseIncomplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 border-primary/20 p-0 sm:max-w-md">
        <div className="border-b border-primary/10 bg-gradient-to-br from-primary/10 to-transparent px-6 py-5">
          <div className="flex gap-3">
            <span className="bg-primary/15 flex size-11 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="text-primary size-5" aria-hidden />
            </span>
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-lg leading-snug">{titleAndBody.title}</DialogTitle>
              <DialogDescription className="text-foreground/90 text-sm leading-relaxed">
                {titleAndBody.description}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Use the actions below — we’ll keep your invoice details as you entered them.
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-col sm:space-x-0">
          <Button type="button" className="w-full" asChild>
            <Link href={MERCHANT_SETTINGS_HREF}>
              {kind === 'stripe'
                ? 'Configure Stripe'
                : kind === 'wise'
                  ? 'Configure Wise'
                  : kind === 'hedera'
                    ? 'Configure wallet'
                    : 'Open merchant settings'}
            </Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              onSwitchToInvoiceOnly();
              onOpenChange(false);
            }}
          >
            Switch to invoice only
          </Button>
          {alternativeAvailable ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                onChooseAnotherPaymentMethod();
                onOpenChange(false);
              }}
            >
              Choose another payment method
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

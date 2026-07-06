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

import {

  isMultiCheckoutRailIncomplete,

  multiCheckoutRailLabelsForGuardrail,

  type PaymentLinkRailSetupStatus,

  type PaymentLinksGuardrailKind,

} from '@/lib/payment-links/setup-status';

import { getPaymentRail, isMultiCheckoutRailId } from '@/lib/payments/payment-rail-registry';



export type { PaymentLinksGuardrailKind };



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

    if (!kind || kind === 'no_rails') {

      return {

        title: 'Connect a payment method first',

        description: `Invoice with payment request needs at least one receiving rail (${multiCheckoutRailLabelsForGuardrail()}). None are configured for this workspace yet.`,

      };

    }



    if (!isMultiCheckoutRailId(kind)) {

      return {

        title: 'Setup required',

        description: 'Connect a payment provider before creating this invoice.',

      };

    }



    const rail = getPaymentRail(kind);

    const incomplete = isMultiCheckoutRailIncomplete(setup, kind);



    if (incomplete) {

      return {

        title: `Finish ${rail.merchantSettingsLabel} setup`,

        description:

          rail.merchantSetupAttentionDescription ??

          `${rail.merchantSettingsLabel} is enabled but missing required configuration. Complete setup in collection & settlement setup or choose another payment method.`,

      };

    }



    return {

      title: `${rail.merchantSettingsLabel} is not available`,

      description: `You selected ${rail.invoiceCreationLabel}, but ${rail.merchantSettingsLabel} is not fully configured for this organization. Set it up or choose another payment method.`,

    };

  }, [kind, setup]);



  const configureLabel = React.useMemo(() => {

    if (!kind || kind === 'no_rails') return 'Open collection & settlement setup';

    const rail = getPaymentRail(kind);

    return `Configure ${rail.merchantSettingsLabel}`;

  }, [kind]);



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

            Use the actions below. Your invoice details stay as you entered them.

          </p>

        </div>

        <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-col sm:space-x-0">

          <Button type="button" className="w-full" asChild>

            <Link href={MERCHANT_SETTINGS_HREF}>{configureLabel}</Link>

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



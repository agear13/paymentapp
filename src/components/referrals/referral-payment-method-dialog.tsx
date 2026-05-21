'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Building2, Coins, FileText } from 'lucide-react';
import type { ReferralPaymentRail } from '@/lib/referrals/referral-payment-rails';
import { customerRailLabel } from '@/lib/referrals/referral-payment-rails';

const RAIL_ICONS: Record<ReferralPaymentRail, typeof CreditCard> = {
  stripe: CreditCard,
  wise: Building2,
  hedera: Coins,
  manual: FileText,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rails: ReferralPaymentRail[];
  onSelect: (rail: ReferralPaymentRail) => void;
  loading?: boolean;
};

export function ReferralPaymentMethodDialog({
  open,
  onOpenChange,
  rails,
  onSelect,
  loading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose payment method</DialogTitle>
          <DialogDescription>Select how you would like to pay.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rails.map((rail) => {
            const Icon = RAIL_ICONS[rail];
            return (
              <Button
                key={rail}
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 py-3"
                disabled={loading}
                onClick={() => onSelect(rail)}
              >
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{customerRailLabel(rail)}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

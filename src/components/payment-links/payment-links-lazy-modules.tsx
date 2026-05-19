'use client';

import dynamic from 'next/dynamic';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function DialogSkeleton() {
  return null;
}

export const CreatePaymentLinkDialog = dynamic(
  () =>
    import('@/components/payment-links/create-payment-link-dialog').then((mod) => ({
      default: mod.CreatePaymentLinkDialog,
    })),
  { loading: DialogSkeleton, ssr: false }
);

export const PaymentLinkDetailDialog = dynamic(
  () =>
    import('@/components/payment-links/payment-link-detail-dialog').then((mod) => ({
      default: mod.PaymentLinkDetailDialog,
    })),
  { loading: DialogSkeleton, ssr: false }
);

export const PaymentLinksOnboardingAssistant = dynamic(
  () =>
    import('@/components/payment-links-onboarding/payment-links-onboarding-assistant').then(
      (mod) => ({
        default: mod.PaymentLinksOnboardingAssistant,
      })
    ),
  {
    loading: () => <PanelSkeleton rows={2} />,
    ssr: false,
  }
);

export const PendingCryptoConfirmations = dynamic(
  () =>
    import('@/components/payment-links/pending-crypto-confirmations').then((mod) => ({
      default: mod.PendingCryptoConfirmations,
    })),
  {
    loading: () => <PanelSkeleton rows={4} />,
    ssr: false,
  }
);

export const PendingManualBankConfirmations = dynamic(
  () =>
    import('@/components/payment-links/pending-manual-bank-confirmations').then((mod) => ({
      default: mod.PendingManualBankConfirmations,
    })),
  {
    loading: () => <PanelSkeleton rows={4} />,
    ssr: false,
  }
);

export type { PaymentLinkDetails as PaymentLinkDetailPayload } from '@/components/payment-links/payment-link-detail-dialog';

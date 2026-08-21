'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCommercialReadiness } from '@/hooks/use-commercial-readiness';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';
import { presentXeroConnectionState } from '@/lib/xero/xero-connection-state';

type CommercialOsXeroReadinessBannerProps = {
  /** connected-systems | xero-setup */
  surface: 'connected-systems' | 'xero-setup';
};

export function CommercialOsXeroReadinessBanner({
  surface,
}: CommercialOsXeroReadinessBannerProps) {
  const readiness = useCommercialReadiness();

  if (readiness.loading) return null;

  // Xero setup page uses the setup status card as the single summary.
  if (surface === 'xero-setup') return null;

  if (surface === 'connected-systems') {
    const presentation = presentXeroConnectionState(readiness.connection.connectionState);

    if (presentation.state === 'DISCONNECTED') return null;

    const href =
      presentation.state === 'READY'
        ? COMMERCIAL_OS_ROUTES.createInvoice
        : COMMERCIAL_OS_ROUTES.connectedXero;

    const ctaLabel =
      presentation.state === 'READY' ? 'Create invoice' : presentation.ctaLabel;

    return (
      <CommercialOsNextStepBanner
        title={presentation.bannerTitle}
        message={presentation.bannerMessage}
        tone={presentation.bannerTone === 'success' ? 'success' : 'default'}
        action={
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
    );
  }

  return null;
}

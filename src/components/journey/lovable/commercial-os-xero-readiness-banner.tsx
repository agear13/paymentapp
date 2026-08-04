'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCommercialReadiness } from '@/hooks/use-commercial-readiness';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';

type CommercialOsXeroReadinessBannerProps = {
  /** connected-systems | xero-setup */
  surface: 'connected-systems' | 'xero-setup';
};

export function CommercialOsXeroReadinessBanner({
  surface,
}: CommercialOsXeroReadinessBannerProps) {
  const readiness = useCommercialReadiness();

  if (readiness.loading) return null;

  if (surface === 'xero-setup' && readiness.overallStatus === 'fully_set_up') {
    return null;
  }

  if (surface === 'connected-systems') {
    if (!readiness.connection.connected) return null;

    if (readiness.overallStatus === 'setup_incomplete') {
      return (
        <CommercialOsNextStepBanner
          title="Xero connected"
          message="One more step. Choose which Xero accounts you want Provvy to use before sending invoices."
          action={
            <Link
              href={COMMERCIAL_OS_ROUTES.connectedXero}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
            >
              Continue setup
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      );
    }

    return (
      <CommercialOsNextStepBanner
        title={readiness.statusLabel}
        message={readiness.statusDetail}
        tone="success"
        action={
          readiness.canCreateInvoice ? (
            <Link
              href={COMMERCIAL_OS_ROUTES.createInvoice}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
            >
              Create your first invoice
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : undefined
        }
      />
    );
  }

  // xero-setup surface
  if (readiness.overallStatus === 'setup_incomplete') {
    return (
      <CommercialOsNextStepBanner
        title={readiness.statusLabel}
        message="Finish choosing your Xero accounts before creating invoices."
        action={
          readiness.nextAction?.sectionId ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
              onClick={() => {
                const el = document.getElementById(readiness.nextAction!.sectionId!);
                if (el instanceof HTMLDetailsElement) {
                  el.open = true;
                }
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {readiness.nextAction.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />
    );
  }

  if (readiness.overallStatus === 'ready_to_invoice') {
    return (
      <CommercialOsNextStepBanner
        title="You're ready to create invoices"
        message={readiness.statusDetail}
        tone="success"
        action={
          <Link
            href={COMMERCIAL_OS_ROUTES.createInvoice}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
          >
            Create your first invoice
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
    );
  }

  return null;
}

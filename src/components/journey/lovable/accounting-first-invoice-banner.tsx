'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import { ConnectAccountingModal } from '@/components/journey/lovable/connect-accounting-modal';

const DISMISS_KEY = 'provvy.accountingFirstInvoiceBannerDismissed';

type AccountingFirstInvoiceBannerProps = {
  returnTo?: string;
};

export function AccountingFirstInvoiceBanner({ returnTo }: AccountingFirstInvoiceBannerProps) {
  const readiness = useCommercialReadinessOptional();
  const [dismissed, setDismissed] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || !readiness || readiness.loading || (readiness.canSyncToAccounting ?? readiness.canCreateInvoice)) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="relative rounded-2xl border border-primary/20 bg-accent/50 p-5 pr-12 shadow-card">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-background hover:text-foreground"
          aria-label={ACCOUNTING_INTEGRATION_COPY.dismissBanner}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[14px] font-semibold text-foreground">
          {ACCOUNTING_INTEGRATION_COPY.firstInvoiceBannerTitle}
        </div>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          {ACCOUNTING_INTEGRATION_COPY.firstInvoiceBannerBody}
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-4 inline-flex items-center rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
        >
          {ACCOUNTING_INTEGRATION_COPY.connectCta}
        </button>
      </div>

      <ConnectAccountingModal open={modalOpen} onOpenChange={setModalOpen} returnTo={returnTo} />
    </>
  );
}

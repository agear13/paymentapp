'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Circle } from 'lucide-react';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { ConnectAccountingModal } from '@/components/journey/lovable/connect-accounting-modal';

type AccountingIntegrationNoticeProps = {
  className?: string;
  returnTo?: string;
};

export function AccountingIntegrationNotice({
  className = '',
  returnTo,
}: AccountingIntegrationNoticeProps) {
  const readiness = useCommercialReadinessOptional();
  const [modalOpen, setModalOpen] = useState(false);

  if (!readiness || readiness.loading) return null;

  const { connected } = readiness.connection;
  const syncReady = readiness.canSyncToAccounting ?? readiness.canCreateInvoice;

  let statusLabel: string = ACCOUNTING_INTEGRATION_COPY.notConnectedStatus;
  if (connected && syncReady) {
    statusLabel = ACCOUNTING_INTEGRATION_COPY.connectedStatus;
  } else if (connected) {
    statusLabel = ACCOUNTING_INTEGRATION_COPY.setupIncompleteStatus;
  }

  return (
    <>
      <div
        className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className}`}
        role="status"
      >
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          {ACCOUNTING_INTEGRATION_COPY.sectionTitle}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[13.5px] font-medium text-foreground">
          <span className="text-[12px] text-ink-soft">Status</span>
          <Circle
            className={`h-2 w-2 fill-current ${
              connected && syncReady ? 'text-emerald-500' : 'text-ink-soft'
            }`}
            aria-hidden
          />
          {statusLabel}
        </div>
        {!syncReady ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            {ACCOUNTING_INTEGRATION_COPY.notConnectedDescription}
          </p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            Invoices sync to your accounting software automatically when you push or receive payment.
          </p>
        )}
        {!connected ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-4 inline-flex items-center rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
          >
            {ACCOUNTING_INTEGRATION_COPY.connectCta}
          </button>
        ) : !syncReady ? (
          <Link
            href={COMMERCIAL_OS_ROUTES.connectedXero}
            className="mt-4 inline-flex items-center rounded-xl border border-border bg-background px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent"
          >
            {ACCOUNTING_INTEGRATION_COPY.continueSetupCta}
          </Link>
        ) : null}
      </div>

      <ConnectAccountingModal open={modalOpen} onOpenChange={setModalOpen} continueFrom={returnTo} />
    </>
  );
}

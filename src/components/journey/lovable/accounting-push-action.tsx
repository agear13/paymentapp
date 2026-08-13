'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import {
  formatAccountingLastSyncedLabel,
  resolveAccountingPushState,
  type AccountingInvoiceSyncRow,
} from '@/lib/accounting/accounting-push-state';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { ConnectAccountingModal } from '@/components/journey/lovable/connect-accounting-modal';

type AccountingLinkSnapshot = {
  amount: unknown;
  currency?: string | null;
  invoiceCurrency?: string | null;
  description?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  invoiceReference?: string | null;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
};

type AccountingPushActionProps = {
  paymentLinkId: string;
  invoiceSync?: AccountingInvoiceSyncRow | null;
  linkUpdatedAt?: Date | string | null;
  link?: AccountingLinkSnapshot | null;
  onQueued?: () => void;
  className?: string;
};

export function AccountingPushAction({
  paymentLinkId,
  invoiceSync,
  linkUpdatedAt,
  link,
  onQueued,
  className = '',
}: AccountingPushActionProps) {
  const readiness = useCommercialReadinessOptional();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const inFlightRef = useRef(false);

  const pushState = useMemo(
    () =>
      resolveAccountingPushState({
        invoiceSync,
        linkUpdatedAt,
        link,
      }),
    [invoiceSync, linkUpdatedAt, link]
  );

  const submitPush = async (update = false) => {
    if (!organizationId || inFlightRef.current) return;

    if (!readiness?.connection.connected) {
      setModalOpen(true);
      return;
    }

    const syncReady = readiness.canSyncToAccounting ?? readiness.canCreateInvoice;
    if (!syncReady) {
      toast({
        title: 'Complete accounting setup',
        description: 'Finish account mapping before pushing invoices to your accounting software.',
      });
      return;
    }

    inFlightRef.current = true;
    setPushing(true);
    try {
      const response = await fetch(
        `/api/xero/sync/queue-invoice?organization_id=${encodeURIComponent(organizationId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentLinkId, update }),
        }
      );
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        alreadySynced?: boolean;
        inProgress?: boolean;
        lastSyncedAt?: string | null;
        queued?: boolean;
        update?: boolean;
      };

      if (!response.ok) {
        if (data.error?.toLowerCase().includes('not connected')) {
          setModalOpen(true);
          return;
        }
        throw new Error(data.error ?? 'Failed to queue accounting sync');
      }

      if (data.alreadySynced) {
        toast({
          title: ACCOUNTING_INTEGRATION_COPY.alreadySyncedLabel,
          description:
            data.lastSyncedAt != null
              ? formatAccountingLastSyncedLabel(data.lastSyncedAt)
              : data.message,
        });
        return;
      }

      if (data.inProgress) {
        toast({
          title: ACCOUNTING_INTEGRATION_COPY.syncInProgressLabel,
          description: data.message,
        });
        return;
      }

      toast({
        title: data.update ? 'Update queued' : 'Queued for accounting',
        description:
          data.message ??
          (data.update
            ? ACCOUNTING_INTEGRATION_COPY.updateQueuedToast
            : 'Provvy is pushing this invoice to your accounting software.'),
      });
      onQueued?.();
    } catch (error: unknown) {
      toast({
        title: 'Could not push to accounting',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      inFlightRef.current = false;
      setPushing(false);
    }
  };

  if (!readiness || readiness.loading) {
    return (
      <span className={`inline-flex items-center gap-2 text-[13px] text-ink-soft ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Checking accounting…
      </span>
    );
  }

  const syncReady = readiness.canSyncToAccounting ?? readiness.canCreateInvoice;
  if (readiness.connection.connected && !syncReady) {
    return (
      <Link
        href={COMMERCIAL_OS_ROUTES.connectedXero}
        className={`inline-flex items-center rounded-xl border border-border bg-background px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent ${className}`}
      >
        {ACCOUNTING_INTEGRATION_COPY.continueSetupCta}
      </Link>
    );
  }

  if (pushState.state === 'already_synced') {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-400 ${className}`}
      >
        <Check className="h-4 w-4" aria-hidden />
        {pushState.lastSyncedAt
          ? formatAccountingLastSyncedLabel(pushState.lastSyncedAt)
          : ACCOUNTING_INTEGRATION_COPY.alreadySyncedLabel}
      </span>
    );
  }

  if (pushState.state === 'sync_pending') {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-ink-soft ${className}`}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {ACCOUNTING_INTEGRATION_COPY.syncInProgressLabel}
      </span>
    );
  }

  const ctaLabel =
    pushState.state === 'update'
      ? ACCOUNTING_INTEGRATION_COPY.updateAccountingCta
      : ACCOUNTING_INTEGRATION_COPY.pushCta;

  return (
    <>
      <button
        type="button"
        onClick={() => void submitPush(pushState.state === 'update')}
        disabled={pushing}
        className={`inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 disabled:opacity-60 ${className}`}
      >
        {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {ctaLabel}
      </button>

      <ConnectAccountingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        continueFrom={
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : undefined
        }
      />
    </>
  );
}

'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Link2,
  Pencil,
  Trash2,
  Share2,
  QrCode,
  ExternalLink,
  FileText,
  ChevronRight,
  Send,
  RefreshCw,
} from 'lucide-react';
import type { PaymentLinkDetails } from '@/components/payment-links/payment-link-detail-dialog';
import { CreatePaymentLinkDialog } from '@/components/payment-links/payment-links-lazy-modules';
import { usePaymentLinkUrl } from '@/components/operational/customer-facing-origin-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePaymentLinkDetail } from '@/hooks/use-payment-link-detail';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { formatCurrency } from '@/lib/formatters/format-currency';
import {
  canCancelPaymentLink,
  canEditPaymentLink,
  canMarkAsPaid,
  canReopenPaymentLink,
  canResendPaymentLink,
  cancelPaymentLink,
  deletePaymentLink,
  archivePaymentLink,
  voidPaymentLink,
  downloadPaymentLinkQrCode,
  postPaymentLinkManualSettlement,
  resendPaymentLinkInvoice,
  sendPaymentLinkInvoice,
  type LifecycleSnapshot,
} from '@/lib/payment-links/payment-link-merchant-actions';
import { PaymentLifecyclePanel } from '@/components/payment-links/payment-lifecycle-panel';
import {
  formatInvoiceCreatedLabel,
  formatInvoiceDueLabel,
  INVOICE_DISPLAY_STATUS_CLS,
  invoiceHeroState,
  invoicePaymentMethodLabel,
  invoicePublicReference,
  toInvoiceDisplayStatus,
  toPaymentDisplayStatus,
} from '@/lib/payment-links/invoice-display-status';
import { buildExplorerUrl } from '@/lib/payments/crypto-confirmation-verification';
import { receivablesInvoiceXeroColumn } from '@/lib/xero/xero-sync-display';
import { isValidShortCode } from '@/lib/short-code';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';
import { InvoicePaymentReviewPanel } from '@/components/journey/lovable/invoice-payment-review-panel';
import { AccountingSyncedInvoiceRemovalDialog } from '@/components/journey/lovable/accounting-synced-invoice-removal-dialog';
import { InvoiceDetailAccountingSection } from '@/components/journey/lovable/invoice-detail-accounting-section';
import { InvoiceDetailCommercialPosition } from '@/components/journey/lovable/invoice-detail-commercial-position';
import { InvoiceDetailSidebar } from '@/components/journey/lovable/invoice-detail-sidebar';
import {
  INVOICE_DETAIL_TONE_RING,
  InvoiceDetailActionButton,
  InvoiceDetailExpandableCard,
  InvoiceDetailField,
  InvoiceDetailSkeleton,
} from '@/components/journey/lovable/invoice-detail-ui';
import { resolveInvoiceRemovalOptions } from '@/lib/accounting/accounting-invoice-deletion-policy';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';

type WorkspaceInvoiceDetailScreenProps = {
  invoiceNumber: string;
  paymentLinkId?: string | null;
};

function buildTimelineEntries(
  detail: PaymentLinkDetails,
  lifecycle: LifecycleSnapshot | null
): { label: string; detail: string; time: string }[] {
  const entries: { label: string; detail: string; time: string; sortAt: number }[] = [];

  for (const step of lifecycle?.invoiceLifecycle?.timeline ?? []) {
    if (!step.reached || !step.occurredAt) continue;
    const at = new Date(step.occurredAt);
    entries.push({
      label: step.label,
      detail: step.state,
      time: format(at, 'd MMM · HH:mm'),
      sortAt: at.getTime(),
    });
  }

  for (const event of detail.paymentEvents ?? []) {
    const at = new Date(event.createdAt);
    entries.push({
      label: event.eventType.replace(/_/g, ' '),
      detail: event.paymentMethod ? `via ${event.paymentMethod}` : '',
      time: format(at, 'd MMM · HH:mm'),
      sortAt: at.getTime(),
    });
  }

  if (entries.length === 0 && detail.createdAt) {
    const at = new Date(detail.createdAt);
    entries.push({
      label: 'Invoice created',
      detail: detail.description || '',
      time: format(at, 'd MMM · HH:mm'),
      sortAt: at.getTime(),
    });
  }

  return entries
    .sort((a, b) => b.sortAt - a.sortAt)
    .map(({ label, detail: d, time }) => ({ label, detail: d, time }));
}

function isCryptoRail(detail: PaymentLinkDetails): boolean {
  const method = detail.paymentMethod?.toUpperCase() ?? '';
  return (
    method === 'CRYPTO' ||
    method === 'HEDERA' ||
    method === 'EVM_WALLET' ||
    Boolean(detail.cryptoNetwork || detail.cryptoAddress || detail.cryptoCurrency)
  );
}

function hasXeroData(detail: PaymentLinkDetails): boolean {
  return Boolean(
    (detail.xeroSyncs && detail.xeroSyncs.length > 0) || detail.xeroInvoiceNumber?.trim()
  );
}

function xeroAccountingSummary(detail: PaymentLinkDetails): {
  tone: 'default' | 'success' | 'info';
  title: string;
  message: React.ReactNode;
} {
  const syncs = detail.xeroSyncs ?? [];
  const invoiceSync = syncs.find((s) => s.syncType === 'INVOICE');
  const paymentSync = syncs.find((s) => s.syncType === 'PAYMENT');
  const isPaid = detail.status === 'PAID' || detail.status === 'PAID_UNVERIFIED';

  if (syncs.length === 0) {
    return {
      tone: 'info',
      title: 'Accounting sync',
      message: isPaid
        ? 'Push this invoice and payment to your accounting software when you are ready — or connect accounting to sync automatically.'
        : 'This invoice has not been pushed to accounting yet. Use Push to Accounting when you want to sync.',
    };
  }

  const anyFailed = syncs.some((s) => s.status === 'FAILED');
  const anyPending = syncs.some((s) => s.status === 'PENDING' || s.status === 'RETRYING');
  const invoiceSuccess = invoiceSync?.status === 'SUCCESS';
  const paymentSuccess = paymentSync?.status === 'SUCCESS';

  if (anyFailed) {
    return {
      tone: 'default',
      title: 'Accounting sync needs attention',
      message:
        'Something went wrong while syncing to accounting. Review the sync history below and check your account mappings.',
    };
  }

  if (anyPending) {
    return {
      tone: 'info',
      title: 'Sync in progress',
      message:
        'Provvy is processing this invoice for your accounting software. This usually completes within a few minutes.',
    };
  }

  if (invoiceSuccess && (paymentSuccess || !isPaid)) {
    return {
      tone: 'success',
      title: 'Synced with accounting',
      message: paymentSuccess
        ? 'This invoice and payment are in your accounting software.'
        : 'This invoice is synced. When payment is received, Provvy can sync the payment too.',
    };
  }

  return {
    tone: 'info',
    title: 'Accounting sync',
    message: 'Provvy keeps your invoices and payments aligned with your accounting software.',
  };
}

export function WorkspaceInvoiceDetailScreen({
  invoiceNumber,
  paymentLinkId,
}: WorkspaceInvoiceDetailScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sendSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const { state, refresh } = usePaymentLinkDetail({
    organizationId,
    isOrgLoading,
    reference: invoiceNumber,
    knownId: paymentLinkId,
  });

  const [sendEmail, setSendEmail] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [confirmMarkPaidOpen, setConfirmMarkPaidOpen] = useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmSyncedRemovalOpen, setConfirmSyncedRemovalOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [aiDismissed, setAiDismissed] = useState<number[]>([]);

  const goToSendSection = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sendSectionRef.current?.focus();
    });
  }, []);

  const goToAccountingSection = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById('accounting-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  useEffect(() => {
    if (searchParams?.get('send') === '1' && state.status === 'ready') {
      goToSendSection();
    }
  }, [searchParams, state.status, goToSendSection]);

  useEffect(() => {
    if (state.status === 'ready') {
      setSendEmail(
        state.detail.customerEmail?.trim() ||
          state.detail.lastSentToEmail?.trim() ||
          ''
      );
    }
  }, [state]);

  const payCode =
    state.status === 'ready' ? state.detail.shortCode?.trim() ?? '' : '';
  const paymentUrl = usePaymentLinkUrl(isValidShortCode(payCode) ? payCode : null);

  const handleCopyUrl = useCallback(() => {
    if (!paymentUrl) {
      toast({
        title: 'Link unavailable',
        description: 'This invoice does not have a valid public pay code.',
        variant: 'destructive',
      });
      return;
    }
    void navigator.clipboard.writeText(paymentUrl);
    toast({ title: 'Payment link copied' });
  }, [paymentUrl, toast]);

  const handleSend = useCallback(async () => {
    if (state.status !== 'ready') return;
    const email = sendEmail.trim();
    if (!email) {
      toast({
        title: 'Could not send invoice',
        description: 'Enter a client email first.',
        variant: 'destructive',
      });
      return;
    }
    setSendLoading(true);
    try {
      await sendPaymentLinkInvoice(state.detail.id, email);
      toast({ title: 'Invoice sent', description: `Invoice sent to ${email}.` });
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not send invoice',
        description: error instanceof Error ? error.message : 'Could not send invoice',
        variant: 'destructive',
      });
    } finally {
      setSendLoading(false);
    }
  }, [state, sendEmail, toast, refresh]);

  const handleResend = useCallback(async () => {
    if (state.status !== 'ready') return;
    setSendLoading(true);
    try {
      await resendPaymentLinkInvoice(state.detail.id);
      toast({ title: 'Invoice resent', description: 'Invoice sent to the last recipient email.' });
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not send invoice',
        description: error instanceof Error ? error.message : 'Could not send invoice',
        variant: 'destructive',
      });
    } finally {
      setSendLoading(false);
    }
  }, [state, toast, refresh]);

  const handleManualSettlement = useCallback(
    async (action: 'mark_paid' | 'reopen') => {
      if (state.status !== 'ready') return;
      setSettlementLoading(true);
      try {
        await postPaymentLinkManualSettlement(state.detail.id, action);
        toast({
          title: action === 'mark_paid' ? 'Payment recorded' : 'Invoice reopened',
          description:
            action === 'mark_paid'
              ? 'This invoice is now marked paid.'
              : 'Status set back to open.',
        });
        setConfirmMarkPaidOpen(false);
        setConfirmReopenOpen(false);
        await refresh();
      } catch (error: unknown) {
        toast({
          title: action === 'mark_paid' ? 'Could not mark invoice as paid' : 'Could not reopen invoice',
          description: error instanceof Error ? error.message : 'Request failed',
          variant: 'destructive',
        });
      } finally {
        setSettlementLoading(false);
      }
    },
    [state, toast, refresh]
  );

  const handleCancel = useCallback(async () => {
    if (state.status !== 'ready') return;
    setCancelLoading(true);
    try {
      await cancelPaymentLink(state.detail.id);
      toast({ title: 'Invoice canceled' });
      setConfirmCancelOpen(false);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not cancel invoice',
        description: error instanceof Error ? error.message : 'Cancel failed',
        variant: 'destructive',
      });
    } finally {
      setCancelLoading(false);
    }
  }, [state, toast, refresh]);

  const handleDownloadQr = useCallback(async () => {
    if (state.status !== 'ready') return;
    const code = state.detail.shortCode?.trim() ?? '';
    if (!isValidShortCode(code)) {
      toast({ title: 'QR unavailable', variant: 'destructive' });
      return;
    }
    try {
      await downloadPaymentLinkQrCode(state.detail.id, code);
      toast({ title: 'QR code downloaded' });
    } catch (error: unknown) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Could not download QR code',
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  const handleDelete = useCallback(async () => {
    if (state.status !== 'ready') return;
    setDeleteLoading(true);
    try {
      await deletePaymentLink(state.detail.id);
      toast({ title: 'Invoice deleted', description: 'The invoice was removed from your workspace.' });
      router.push(COMMERCIAL_OS_ROUTES.invoiceList);
    } catch (error: unknown) {
      const err = error as Error & { requiresAccountingDialog?: boolean };
      if (err.requiresAccountingDialog) {
        setConfirmDeleteOpen(false);
        setConfirmSyncedRemovalOpen(true);
        return;
      }
      toast({
        title: 'Could not delete invoice',
        description: error instanceof Error ? error.message : 'Failed to delete invoice',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteOpen(false);
    }
  }, [state, toast, router]);

  const handleArchiveSyncedInvoice = useCallback(async () => {
    if (state.status !== 'ready') return;
    setDeleteLoading(true);
    try {
      const result = await archivePaymentLink(state.detail.id);
      toast({
        title: ACCOUNTING_INTEGRATION_COPY.archiveSuccessToastTitle,
        description: ACCOUNTING_INTEGRATION_COPY.archiveSuccessToastBody,
      });
      setConfirmSyncedRemovalOpen(false);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not archive invoice',
        description: error instanceof Error ? error.message : 'Failed to archive invoice',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [state, toast, refresh]);

  const handleVoidSyncedInvoice = useCallback(async () => {
    if (state.status !== 'ready') return;
    setDeleteLoading(true);
    try {
      await voidPaymentLink(state.detail.id);
      toast({
        title: ACCOUNTING_INTEGRATION_COPY.voidSuccessToastTitle,
        description: ACCOUNTING_INTEGRATION_COPY.voidSuccessToastBody.replace(/\n\n/g, ' '),
      });
      setConfirmSyncedRemovalOpen(false);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not void invoice',
        description: error instanceof Error ? error.message : 'Failed to void invoice',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [state, toast, refresh]);

  if (state.status === 'loading' || isOrgLoading) {
    return <InvoiceDetailSkeleton />;
  }

  if (state.status === 'error') {
    return (
      <div className="animate-fade-up rounded-2xl border border-border bg-card p-16 text-center shadow-card">
        <h1 className="text-[18px] font-semibold">Could not load invoice</h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">{state.message}</p>
        <Link
          href={COMMERCIAL_OS_ROUTES.receivables}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13.5px] font-medium transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to receivables
        </Link>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="animate-fade-up rounded-2xl border border-border bg-card p-16 text-center shadow-card">
        <FileText className="mx-auto h-6 w-6 text-ink-soft" />
        <h1 className="mt-4 text-[18px] font-semibold">Invoice not found</h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">
          This invoice may have been deleted or you may not have access.
        </p>
        <Link
          href={COMMERCIAL_OS_ROUTES.receivables}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13.5px] font-medium transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to receivables
        </Link>
      </div>
    );
  }

  const ready = state;
  const detail = ready.detail;
  const lifecycle = ready.lifecycle;
  const displayRef = invoicePublicReference(detail);
  const displayStatus = toInvoiceDisplayStatus(detail);
  const amountOutstanding = lifecycle?.invoiceLifecycle?.amountOutstanding;
  const invoiceAmount = lifecycle?.invoiceLifecycle
    ? lifecycle.invoiceLifecycle.amountPaid + lifecycle.invoiceLifecycle.amountOutstanding
    : detail.amount;
  const payStatus = toPaymentDisplayStatus(detail, amountOutstanding, invoiceAmount);
  const xeroDisplay = receivablesInvoiceXeroColumn(detail.xeroSyncs);
  const xeroGuidance = xeroAccountingSummary(detail);
  const canSend = canResendPaymentLink(detail.status);
  const isPaidInvoice =
    detail.status === 'PAID' ||
    detail.status === 'PAID_UNVERIFIED' ||
    displayStatus === 'Paid';
  const hero = invoiceHeroState(detail);
  const timeline = buildTimelineEntries(detail, lifecycle);
  const showCrypto = isCryptoRail(detail) || Boolean(ready.cryptoConfirmation);
  const showFx = Boolean(detail.fxSnapshots && detail.fxSnapshots.length > 0);
  const showXero = hasXeroData(detail);
  const showAttachment = Boolean(detail.attachmentUrl);
  const auditEntries = timeline;
  const showAudit = auditEntries.length > 0;
  const hasManualBank = Boolean(
    detail.manualBankRecipientName ||
      detail.manualBankCurrency ||
      detail.manualBankDestinationType
  );
  const ledgerEntries = detail.ledgerEntries ?? [];

  const invoiceSyncForRemoval = detail.xeroSyncs?.find((s) => s.syncType === 'INVOICE') ?? null;
  const removalOptions = resolveInvoiceRemovalOptions({
    status: detail.status,
    invoiceSync: invoiceSyncForRemoval,
  });

  const handleDeleteClick = () => {
    if (removalOptions.requiresAccountingDialog) {
      setConfirmSyncedRemovalOpen(true);
      return;
    }
    setConfirmDeleteOpen(true);
  };

  const outstandingDisplay =
    typeof amountOutstanding === 'number'
      ? formatCurrency(amountOutstanding, detail.currency)
      : formatCurrency(Number(detail.amount), detail.currency);

  const creationFx = detail.fxSnapshots?.filter((s) => s.snapshotType === 'CREATION') ?? [];
  const settlementFx = detail.fxSnapshots?.filter((s) => s.snapshotType === 'SETTLEMENT') ?? [];

  const explorerUrl = (() => {
    const crypto = ready.cryptoConfirmation;
    if (!crypto?.payerTxHash) return null;
    const network = crypto.payerNetwork || detail.cryptoNetwork;
    if (!network) return null;
    return buildExplorerUrl(network, crypto.payerTxHash);
  })();

  const settlementLabel = (() => {
    const settled = lifecycle?.settlements?.find(
      (s) => s.status === 'SETTLED' || s.status === 'RECONCILED'
    );
    if (settled) {
      return `Settled ${formatCurrency(Number(settled.amount), settled.currency)}`;
    }
    if (detail.settlementCurrency && detail.settlementAmount != null) {
      return formatCurrency(detail.settlementAmount, detail.settlementCurrency);
    }
    if (detail.status === 'PAID') return 'Payment recorded';
    return null;
  })();

  return (
    <div className="animate-fade-up space-y-10 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          <Link href={COMMERCIAL_OS_ROUTES.receivables} className="transition-colors hover:text-foreground">
            Receivables
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={COMMERCIAL_OS_ROUTES.invoiceList} className="transition-colors hover:text-foreground">
            Invoices
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Invoice {displayRef}</span>
        </nav>
      </div>

      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${INVOICE_DISPLAY_STATUS_CLS[displayStatus]}`}
            >
              {displayStatus}
            </span>
            <span className="text-[12.5px] text-ink-soft">{displayRef}</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {detail.customerName || detail.customerEmail || 'Customer'}
          </h1>
          <p className="mt-3 max-w-xl text-[15.5px] text-ink-soft">{detail.description}</p>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            <InvoiceDetailField label="Amount" value={formatCurrency(Number(detail.amount), detail.currency)} />
            <InvoiceDetailField label="Outstanding" value={outstandingDisplay} />
            <InvoiceDetailField label="Payment method" value={invoicePaymentMethodLabel(detail)} />
            <InvoiceDetailField label="Created" value={formatInvoiceCreatedLabel(detail.createdAt)} />
            <InvoiceDetailField label="Due" value={formatInvoiceDueLabel(detail)} />
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditPaymentLink(detail.status) ? (
            <InvoiceDetailActionButton label="Edit" icon={Pencil} onClick={() => setEditOpen(true)} />
          ) : null}
          <InvoiceDetailActionButton label="Duplicate" icon={Copy} onClick={() => setDuplicateOpen(true)} />
          <InvoiceDetailActionButton label="Copy payment link" icon={Link2} onClick={handleCopyUrl} />
          {canCancelPaymentLink(detail.status) ? (
            <InvoiceDetailActionButton label="Cancel" icon={RefreshCw} onClick={() => setConfirmCancelOpen(true)} />
          ) : null}
          <InvoiceDetailActionButton label="Delete" icon={Trash2} danger onClick={handleDeleteClick} />
        </div>
      </header>

      {canSend ? (
        <CommercialOsNextStepBanner
          message="Send this invoice to your customer so they can view details and pay online."
          action={
            <button
              type="button"
              onClick={goToSendSection}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-purple px-4 text-[13px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
            >
              <Send className="h-4 w-4" />
              Send invoice
            </button>
          }
        />
      ) : null}

      <InvoicePaymentReviewPanel
        invoiceStatus={detail.status}
        paymentMethod={detail.paymentMethod}
        cryptoConfirmation={ready.cryptoConfirmation}
        manualBankConfirmation={ready.manualBankConfirmation}
        onReviewComplete={refresh}
      />

      {isPaidInvoice ? (
        <CommercialOsNextStepBanner
          tone="success"
          title="Payment received"
          message="Provvy can sync this payment to your accounting software when connected."
          action={
            <button
              type="button"
              onClick={goToAccountingSection}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13px] font-medium transition-colors hover:bg-secondary"
            >
              View accounting sync
              <ChevronRight className="h-4 w-4" />
            </button>
          }
        />
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 space-y-6 xl:order-1">
          <section className={`rounded-2xl border p-8 shadow-card ${INVOICE_DETAIL_TONE_RING[hero.tone]}`}>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                  Current status
                </div>
                <div className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em]">
                  {hero.headline}
                </div>
                <p className="mt-3 text-[13.5px] text-ink-soft">
                  {formatCurrency(Number(detail.amount), detail.currency)} ·{' '}
                  {detail.customerName || detail.customerEmail || 'Customer'} ·{' '}
                  {formatInvoiceDueLabel(detail)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3">
                <InvoiceDetailField label="Payment status" value={payStatus} />
                <InvoiceDetailField label="Preferred method" value={invoicePaymentMethodLabel(detail)} />
                {xeroDisplay ? (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                      Xero
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[13.5px] font-medium">
                      <span className={`h-1.5 w-1.5 rounded-full ${xeroDisplay.dotClass}`} />
                      {xeroDisplay.label}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <InvoiceDetailCommercialPosition
            currency={detail.currency}
            invoiceAmount={invoiceAmount}
            amountPaid={lifecycle?.invoiceLifecycle?.amountPaid ?? (detail.status === 'PAID' ? Number(detail.amount) : 0)}
            amountOutstanding={
              typeof amountOutstanding === 'number'
                ? amountOutstanding
                : detail.status === 'PAID'
                  ? 0
                  : Number(detail.amount)
            }
            settlementLabel={settlementLabel}
          />

          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-[13.5px] font-semibold">Customer & invoice</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <InvoiceDetailField label="Customer" value={detail.customerName || '—'} />
              <InvoiceDetailField label="Email" value={detail.customerEmail || '—'} />
              <InvoiceDetailField label="Phone" value={detail.customerPhone || '—'} />
              <InvoiceDetailField label="Invoice reference" value={displayRef} />
              <InvoiceDetailField label="Invoice date" value={detail.invoiceDate ? format(new Date(detail.invoiceDate), 'd MMM yyyy') : '—'} />
              <InvoiceDetailField label="Expires" value={detail.expiresAt ? format(new Date(detail.expiresAt), 'd MMM yyyy') : '—'} />
              {detail.paidAt ? (
                <InvoiceDetailField label="Paid" value={format(new Date(detail.paidAt), 'd MMM yyyy · HH:mm')} />
              ) : null}
              {detail.lastSentAt ? (
                <InvoiceDetailField
                  label="Last sent"
                  value={`${format(new Date(detail.lastSentAt), 'd MMM yyyy')} · ${detail.lastSentToEmail || '—'}`}
                />
              ) : null}
            </dl>
          </section>

          {showAttachment ? (
            <InvoiceDetailExpandableCard
              title="Attachments"
              summary={detail.attachmentFilename?.trim() || '1 file'}
              defaultOpen
            >
              <ul className="space-y-2">
                <li className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">
                      {detail.attachmentFilename?.trim() || 'Attachment'}
                    </div>
                    {detail.attachmentSizeBytes ? (
                      <div className="text-[11.5px] text-ink-soft">
                        {Math.round(detail.attachmentSizeBytes / 1024)} KB
                      </div>
                    ) : null}
                  </div>
                  <a
                    href={detail.attachmentUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-secondary"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </li>
              </ul>
            </InvoiceDetailExpandableCard>
          ) : null}

          {timeline.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-[13.5px] font-semibold">Commercial activity</h2>
              <ol className="relative mt-5 space-y-1 pl-1">
                <div className="absolute bottom-3 left-[15px] top-3 w-px bg-border" aria-hidden />
                {timeline.map((e) => (
                  <li key={`${e.label}-${e.time}`} className="relative flex items-start gap-3 py-2">
                    <span className="relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-ink-soft">
                      <Check className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium">{e.label}</div>
                      {e.detail ? <div className="text-[12px] text-ink-soft">{e.detail}</div> : null}
                    </div>
                    <div className="whitespace-nowrap text-[11.5px] text-ink-soft">{e.time}</div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <InvoiceDetailExpandableCard
            id="payment-section"
            title="Payment information"
            summary={`${invoicePaymentMethodLabel(detail)} · ${payStatus}`}
            defaultOpen
          >
            <div className="space-y-6">
              {ready.qrCodeUrl || paymentUrl ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-accent/20 p-5 sm:flex-row sm:items-center">
                  <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl border border-border bg-background">
                    {ready.qrCodeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ready.qrCodeUrl} alt="Payment QR code" className="h-20 w-20" />
                    ) : (
                      <QrCode className="h-12 w-12 text-foreground" aria-label="Payment QR code" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-ink-soft">
                      {paymentUrl || 'Payment link unavailable'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <InvoiceDetailActionButton label="Copy link" icon={Link2} primary onClick={handleCopyUrl} />
                      {paymentUrl ? (
                        <InvoiceDetailActionButton
                          label="Open link"
                          icon={Share2}
                          onClick={() => window.open(paymentUrl, '_blank')}
                        />
                      ) : null}
                      <InvoiceDetailActionButton label="Download QR" icon={Download} onClick={() => void handleDownloadQr()} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-3">
                <InvoiceDetailField label="Payment method" value={invoicePaymentMethodLabel(detail)} />
                <InvoiceDetailField label="Payment status" value={payStatus} />
                <InvoiceDetailField
                  label="Settlement"
                  value={settlementLabel ?? 'No settlement recorded yet'}
                />
              </div>

              {canResendPaymentLink(detail.status) ? (
                <div
                  id="send-invoice-section"
                  ref={sendSectionRef}
                  className="space-y-3 rounded-2xl border border-border bg-background p-5"
                >
                  <label className="text-[11px] font-medium uppercase tracking-wider text-ink-soft" htmlFor="send-email">
                    Send invoice
                  </label>
                  <input
                    id="send-email"
                    type="email"
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
                    placeholder="client@example.com"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    disabled={sendLoading}
                  />
                  <div className="flex flex-wrap gap-2">
                    <InvoiceDetailActionButton
                      label={sendLoading ? 'Sending…' : 'Send invoice'}
                      icon={Send}
                      primary
                      disabled={sendLoading}
                      onClick={() => void handleSend()}
                    />
                    <InvoiceDetailActionButton
                      label={sendLoading ? 'Sending…' : 'Resend invoice'}
                      icon={Send}
                      disabled={sendLoading}
                      onClick={() => void handleResend()}
                    />
                  </div>
                </div>
              ) : null}

              {canMarkAsPaid(detail.status) || canReopenPaymentLink(detail.status) ? (
                <div className="flex flex-wrap gap-2">
                  {canMarkAsPaid(detail.status) ? (
                    <InvoiceDetailActionButton
                      label="Mark as Paid"
                      icon={Check}
                      onClick={() => setConfirmMarkPaidOpen(true)}
                      disabled={settlementLoading}
                    />
                  ) : null}
                  {canReopenPaymentLink(detail.status) ? (
                    <InvoiceDetailActionButton
                      label="Reopen invoice"
                      icon={RefreshCw}
                      onClick={() => setConfirmReopenOpen(true)}
                      disabled={settlementLoading}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </InvoiceDetailExpandableCard>

          {(detail.cryptoNetwork || detail.cryptoAddress) && !ready.cryptoConfirmation ? (
            <InvoiceDetailExpandableCard title="Crypto payment instructions" summary={detail.cryptoNetwork || 'Crypto'}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <InvoiceDetailField label="Network" value={detail.cryptoNetwork || '—'} />
                <InvoiceDetailField label="Currency" value={detail.cryptoCurrency || detail.currency} />
                <InvoiceDetailField label="Address" value={detail.cryptoAddress || '—'} />
                <InvoiceDetailField label="Memo" value={detail.cryptoMemo || '—'} />
                {detail.cryptoInstructions ? (
                  <div className="sm:col-span-2">
                    <InvoiceDetailField label="Instructions" value={detail.cryptoInstructions} />
                  </div>
                ) : null}
              </dl>
            </InvoiceDetailExpandableCard>
          ) : null}

          {hasManualBank ? (
            <InvoiceDetailExpandableCard title="Bank transfer instructions" summary={detail.manualBankCurrency || 'Bank'}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <InvoiceDetailField label="Recipient" value={detail.manualBankRecipientName || '—'} />
                <InvoiceDetailField label="Type" value={detail.manualBankDestinationType || '—'} />
                <InvoiceDetailField label="Currency" value={detail.manualBankCurrency || '—'} />
                <InvoiceDetailField label="Bank" value={detail.manualBankBankName || '—'} />
                <InvoiceDetailField label="Account" value={detail.manualBankAccountNumber || '—'} />
                <InvoiceDetailField label="IBAN" value={detail.manualBankIban || '—'} />
                <InvoiceDetailField label="SWIFT/BIC" value={detail.manualBankSwiftBic || '—'} />
                <InvoiceDetailField label="Sort/routing" value={detail.manualBankRoutingSortCode || '—'} />
                {detail.manualBankInstructions ? (
                  <div className="sm:col-span-2">
                    <InvoiceDetailField label="Instructions" value={detail.manualBankInstructions} />
                  </div>
                ) : null}
              </dl>
            </InvoiceDetailExpandableCard>
          ) : null}

          {showCrypto ? (
            <InvoiceDetailExpandableCard
              title="Crypto settlement"
              summary={
                detail.cryptoNetwork ||
                ready.cryptoConfirmation?.payerNetwork ||
                invoicePaymentMethodLabel(detail)
              }
            >
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-3">
                  <InvoiceDetailField
                    label="Network"
                    value={
                      ready.cryptoConfirmation?.payerNetwork ||
                      detail.cryptoNetwork ||
                      '—'
                    }
                  />
                  <InvoiceDetailField
                    label="Token"
                    value={
                      ready.cryptoConfirmation?.payerCurrency ||
                      detail.cryptoCurrency ||
                      detail.currency
                    }
                  />
                  <InvoiceDetailField
                    label="Wallet used"
                    value={
                      ready.cryptoConfirmation?.payerWalletAddress ||
                      detail.cryptoAddress ||
                      'Not yet received'
                    }
                  />
                  {ready.cryptoConfirmation?.payerTxHash ? (
                    <InvoiceDetailField label="Transaction" value={ready.cryptoConfirmation.payerTxHash} />
                  ) : null}
                  <InvoiceDetailField
                    label="State"
                    value={ready.cryptoConfirmation?.verificationStatus || payStatus}
                  />
                </div>
                {explorerUrl ? (
                  <InvoiceDetailActionButton
                    label="View on block explorer"
                    icon={ExternalLink}
                    onClick={() => window.open(explorerUrl, '_blank')}
                  />
                ) : null}
              </div>
            </InvoiceDetailExpandableCard>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-[13.5px] font-semibold">Payment lifecycle</h2>
            <PaymentLifecyclePanel paymentLinkId={detail.id} linkStatus={detail.status} />
          </section>

          <InvoiceDetailAccountingSection
            detail={detail}
            paymentLinkId={detail.id}
            invoiceSync={invoiceSyncForRemoval}
            linkSnapshot={{
              amount: detail.amount,
              currency: detail.currency,
              invoiceCurrency: detail.invoiceCurrency,
              description: detail.description,
              customerEmail: detail.customerEmail,
              customerName: detail.customerName,
              invoiceReference: detail.invoiceReference,
              invoiceDate: detail.invoiceDate,
              dueDate: detail.dueDate,
            }}
            xeroGuidance={xeroGuidance}
            xeroDisplay={xeroDisplay}
            showXero={showXero}
            showFx={showFx}
            creationFx={creationFx}
            settlementFx={settlementFx}
            ledgerEntries={ledgerEntries}
            onQueued={() => void refresh()}
          />

          {(detail.paymentEvents?.length ?? 0) > 0 ? (
            <InvoiceDetailExpandableCard title="Payment events" summary={`${detail.paymentEvents!.length} events`} defaultOpen>
              <ul className="space-y-2 text-[12.5px]">
                {detail.paymentEvents!.map((e) => (
                  <li key={e.id} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
                    <span>{e.eventType.replace(/_/g, ' ')}</span>
                    <span className="text-ink-soft">{format(new Date(e.createdAt), 'd MMM · HH:mm')}</span>
                  </li>
                ))}
              </ul>
            </InvoiceDetailExpandableCard>
          ) : null}

          {showAudit ? (
            <InvoiceDetailExpandableCard title="Audit log" summary={`${auditEntries.length} entries`}>
              <ol className="space-y-2">
                {auditEntries.map((e) => (
                  <li
                    key={`audit-${e.label}-${e.time}`}
                    className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 text-[13px] last:border-0"
                  >
                    <div>
                      <div className="font-medium">{e.label}</div>
                      {e.detail ? <div className="text-[12px] text-ink-soft">{e.detail}</div> : null}
                    </div>
                    <span className="whitespace-nowrap text-[11.5px] text-ink-soft">{e.time}</span>
                  </li>
                ))}
              </ol>
            </InvoiceDetailExpandableCard>
          ) : null}
        </div>

        <InvoiceDetailSidebar
          displayRef={displayRef}
          summaryRows={[
            { label: 'Amount', value: formatCurrency(Number(detail.amount), detail.currency) },
            { label: 'Outstanding', value: outstandingDisplay },
            { label: 'Due', value: formatInvoiceDueLabel(detail) },
            { label: 'Payment', value: payStatus },
            ...(xeroDisplay ? [{ label: 'Xero', value: xeroDisplay.label }] : []),
            { label: 'Settlement', value: settlementLabel ?? 'Not settled' },
          ]}
          paymentLinkId={detail.id}
          invoiceSync={invoiceSyncForRemoval}
          linkUpdatedAt={detail.updatedAt}
          link={{
            amount: detail.amount,
            currency: detail.currency,
            invoiceCurrency: detail.invoiceCurrency,
            description: detail.description,
            customerEmail: detail.customerEmail,
            customerName: detail.customerName,
            invoiceReference: detail.invoiceReference,
            invoiceDate: detail.invoiceDate,
            dueDate: detail.dueDate,
          }}
          onScrollToAccounting={goToAccountingSection}
          aiDismissed={aiDismissed}
          onDismissAi={() => setAiDismissed((d) => [...d, 0])}
        />
      </div>

      {organizationId && editOpen ? (
        <CreatePaymentLinkDialog
          mode="edit"
          organizationId={organizationId}
          open={editOpen}
          onOpenChange={setEditOpen}
          isAccountingSynced={Boolean(
            detail.xeroSyncs?.some(
              (sync) =>
                sync.syncType === 'INVOICE' &&
                sync.status === 'SUCCESS' &&
                Boolean(sync.xeroInvoiceId)
            )
          )}
          editPaymentLink={{
            id: detail.id,
            amount: Number(detail.amount),
            currency: detail.currency,
            invoiceCurrency: detail.invoiceCurrency ?? detail.currency,
            description: detail.description,
            invoiceReference: detail.invoiceReference ?? null,
            customerEmail: detail.customerEmail ?? null,
            customerName: detail.customerName ?? null,
            customerPhone: detail.customerPhone ?? null,
            invoiceDate: detail.invoiceDate ?? null,
            dueDate: detail.dueDate ?? null,
            expiresAt: detail.expiresAt ?? null,
            invoiceOnlyMode: detail.invoiceOnlyMode,
            paymentMethod: detail.paymentMethod,
            hederaCheckoutMode: detail.hederaCheckoutMode,
            wiseTransferId: detail.wiseTransferId,
            cryptoNetwork: detail.cryptoNetwork ?? null,
            cryptoAddress: detail.cryptoAddress ?? null,
            cryptoCurrency: detail.cryptoCurrency ?? null,
            cryptoMemo: detail.cryptoMemo ?? null,
            cryptoInstructions: detail.cryptoInstructions ?? null,
            manualBankRecipientName: detail.manualBankRecipientName ?? null,
            manualBankCurrency: detail.manualBankCurrency ?? null,
            manualBankDestinationType: detail.manualBankDestinationType ?? null,
            manualBankBankName: detail.manualBankBankName ?? null,
            manualBankAccountNumber: detail.manualBankAccountNumber ?? null,
            manualBankIban: detail.manualBankIban ?? null,
            manualBankSwiftBic: detail.manualBankSwiftBic ?? null,
            manualBankRoutingSortCode: detail.manualBankRoutingSortCode ?? null,
            manualBankWiseReference: detail.manualBankWiseReference ?? null,
            manualBankRevolutHandle: detail.manualBankRevolutHandle ?? null,
            manualBankInstructions: detail.manualBankInstructions ?? null,
            attachmentUrl: detail.attachmentUrl ?? null,
            attachmentFilename: detail.attachmentFilename ?? null,
            attachmentMimeType: detail.attachmentMimeType ?? null,
            attachmentSizeBytes: detail.attachmentSizeBytes ?? null,
          }}
          onSuccess={() => {
            setEditOpen(false);
            void refresh();
          }}
        />
      ) : null}

      {organizationId && duplicateOpen ? (
        <CreatePaymentLinkDialog
          organizationId={organizationId}
          defaultCurrency={detail.invoiceCurrency ?? detail.currency}
          defaultValues={{
            amount: Number(detail.amount),
            currency: detail.invoiceCurrency ?? detail.currency,
            description: `${detail.description} (Copy)`,
            invoiceReference: detail.invoiceReference || '',
            customerEmail: detail.customerEmail || '',
            customerName: detail.customerName || '',
            customerPhone: detail.customerPhone || '',
            invoiceDate: detail.invoiceDate
              ? new Date(detail.invoiceDate as string | Date)
              : new Date(),
          }}
          open={duplicateOpen}
          onOpenChange={setDuplicateOpen}
          onSuccess={() => {
            setDuplicateOpen(false);
            toast({ title: 'Invoice duplicated' });
            void refresh();
          }}
        />
      ) : null}

      <AlertDialog open={confirmMarkPaidOpen} onOpenChange={setConfirmMarkPaidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark payment received?</AlertDialogTitle>
            <AlertDialogDescription>
              Only confirm after payment has actually cleared. This does not process a new charge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settlementLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={settlementLoading}
              onClick={(e) => {
                e.preventDefault();
                void handleManualSettlement('mark_paid');
              }}
            >
              Confirm paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReopenOpen} onOpenChange={setConfirmReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Status will return to open so the pay link can be used again if still valid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settlementLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={settlementLoading}
              onClick={(e) => {
                e.preventDefault();
                void handleManualSettlement('reopen');
              }}
            >
              Reopen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              The payment link will stop accepting payments. You can still delete the invoice later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Keep open</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelLoading}
              onClick={(e) => {
                e.preventDefault();
                void handleCancel();
              }}
            >
              Cancel invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice from your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccountingSyncedInvoiceRemovalDialog
        open={confirmSyncedRemovalOpen}
        onOpenChange={setConfirmSyncedRemovalOpen}
        status={detail.status}
        invoiceSync={invoiceSyncForRemoval}
        xeroSyncs={detail.xeroSyncs}
        loading={deleteLoading}
        onVoid={handleVoidSyncedInvoice}
        onArchive={handleArchiveSyncedInvoice}
      />
    </div>
  );
}

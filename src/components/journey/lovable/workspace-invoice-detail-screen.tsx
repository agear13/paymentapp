'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  Sparkles,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  Link2,
  Pencil,
  Trash2,
  Share2,
  QrCode,
  Landmark,
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
import { getXeroSyncDisplayStatus, receivablesInvoiceXeroColumn } from '@/lib/xero/xero-sync-display';
import { isValidShortCode } from '@/lib/short-code';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';
import { InvoicePaymentReviewPanel } from '@/components/journey/lovable/invoice-payment-review-panel';

type WorkspaceInvoiceDetailScreenProps = {
  invoiceNumber: string;
  paymentLinkId?: string | null;
};

type DetailTab = 'overview' | 'payment' | 'lifecycle' | 'accounting' | 'activity';

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'payment', label: 'Payment' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'activity', label: 'Activity' },
];

const TONE_RING: Record<string, string> = {
  good: 'border-emerald-500/30 bg-emerald-500/[0.06]',
  warn: 'border-amber-500/30 bg-amber-500/[0.06]',
  bad: 'border-destructive/30 bg-destructive/[0.06]',
  info: 'border-primary/25 bg-accent/20',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-1 text-[13.5px] font-medium">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  danger,
  primary,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
        primary
          ? 'bg-gradient-purple font-semibold text-primary-foreground shadow-glow hover:brightness-110'
          : danger
            ? 'border border-destructive/30 text-destructive hover:bg-destructive/10'
            : 'border border-border hover:bg-secondary'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ExpandableCard({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-[13.5px] font-semibold">{title}</span>
        {summary ? <span className="truncate text-[12.5px] text-ink-soft">{summary}</span> : null}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="border-t border-border px-6 py-6">{children}</div> : null}
    </section>
  );
}

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
      title: 'Xero synchronisation',
      message: isPaid
        ? 'Provvy will automatically queue this invoice and payment for synchronisation with Xero. No action is required — check back here for status updates.'
        : 'This invoice has not been synchronised yet. Once payment is received, Provvy will automatically queue it for synchronisation with Xero. No action is required.',
    };
  }

  const anyFailed = syncs.some((s) => s.status === 'FAILED');
  const anyPending = syncs.some((s) => s.status === 'PENDING' || s.status === 'RETRYING');
  const invoiceSuccess = invoiceSync?.status === 'SUCCESS';
  const paymentSuccess = paymentSync?.status === 'SUCCESS';

  if (anyFailed) {
    return {
      tone: 'default',
      title: 'Xero sync needs attention',
      message:
        'Something went wrong while syncing to Xero. Review the sync history below and check your account mappings on the Xero setup page.',
    };
  }

  if (anyPending) {
    return {
      tone: 'info',
      title: 'Sync in progress',
      message:
        'Provvy is processing this invoice for Xero. This usually completes within a few minutes — no action is required.',
    };
  }

  if (invoiceSuccess && (paymentSuccess || !isPaid)) {
    return {
      tone: 'success',
      title: 'Synced with Xero',
      message: paymentSuccess
        ? 'This invoice and payment are in Xero. Your ledger stays aligned automatically.'
        : 'This invoice is in Xero. When payment is received, Provvy will sync the payment too.',
    };
  }

  return {
    tone: 'info',
    title: 'Xero synchronisation',
    message: 'Provvy keeps your invoices and payments aligned with Xero automatically.',
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
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [aiDismissed, setAiDismissed] = useState<number[]>([]);

  const goToSendSection = useCallback(() => {
    setActiveTab('payment');
    window.requestAnimationFrame(() => {
      sendSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  if (state.status === 'loading' || isOrgLoading) {
    return (
      <div className="animate-fade-up rounded-2xl border border-border bg-card p-16 text-center shadow-card">
        <p className="text-[13.5px] text-ink-soft">Loading invoice…</p>
      </div>
    );
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
            <Field label="Amount" value={formatCurrency(Number(detail.amount), detail.currency)} />
            <Field label="Outstanding" value={outstandingDisplay} />
            <Field label="Payment method" value={invoicePaymentMethodLabel(detail)} />
            <Field label="Created" value={formatInvoiceCreatedLabel(detail.createdAt)} />
            <Field label="Due" value={formatInvoiceDueLabel(detail)} />
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditPaymentLink(detail.status) ? (
            <ActionButton label="Edit" icon={Pencil} onClick={() => setEditOpen(true)} />
          ) : null}
          <ActionButton label="Duplicate" icon={Copy} onClick={() => setDuplicateOpen(true)} />
          <ActionButton label="Copy payment link" icon={Link2} onClick={handleCopyUrl} />
          {canCancelPaymentLink(detail.status) ? (
            <ActionButton label="Cancel" icon={RefreshCw} onClick={() => setConfirmCancelOpen(true)} />
          ) : null}
          <ActionButton label="Delete" icon={Trash2} danger onClick={() => setConfirmDeleteOpen(true)} />
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
          message="Provvy will now automatically reconcile this payment with Xero. Check the Accounting tab for sync status."
          action={
            <button
              type="button"
              onClick={() => setActiveTab('accounting')}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13px] font-medium transition-colors hover:bg-secondary"
            >
              View Xero sync
              <ChevronRight className="h-4 w-4" />
            </button>
          }
        />
      ) : null}

      <nav aria-label="Invoice sections" className="flex flex-wrap gap-2 border-b border-border pb-1">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-accent-foreground'
                : 'text-ink-soft hover:bg-secondary hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {activeTab === 'overview' ? (
            <>
          <section className={`rounded-2xl border p-8 shadow-card ${TONE_RING[hero.tone]}`}>
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
                <Field label="Payment status" value={payStatus} />
                <Field label="Preferred method" value={invoicePaymentMethodLabel(detail)} />
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

          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-[13.5px] font-semibold">Customer & invoice</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Customer" value={detail.customerName || '—'} />
              <Field label="Email" value={detail.customerEmail || '—'} />
              <Field label="Phone" value={detail.customerPhone || '—'} />
              <Field label="Invoice reference" value={displayRef} />
              <Field label="Invoice date" value={detail.invoiceDate ? format(new Date(detail.invoiceDate), 'd MMM yyyy') : '—'} />
              <Field label="Expires" value={detail.expiresAt ? format(new Date(detail.expiresAt), 'd MMM yyyy') : '—'} />
              {detail.paidAt ? (
                <Field label="Paid" value={format(new Date(detail.paidAt), 'd MMM yyyy · HH:mm')} />
              ) : null}
              {detail.lastSentAt ? (
                <Field
                  label="Last sent"
                  value={`${format(new Date(detail.lastSentAt), 'd MMM yyyy')} · ${detail.lastSentToEmail || '—'}`}
                />
              ) : null}
            </dl>
          </section>

          {showAttachment ? (
            <ExpandableCard
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
            </ExpandableCard>
          ) : null}
            </>
          ) : null}

          {activeTab === 'payment' ? (
            <>
          <ExpandableCard
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
                      <ActionButton label="Copy link" icon={Link2} primary onClick={handleCopyUrl} />
                      {paymentUrl ? (
                        <ActionButton
                          label="Open link"
                          icon={Share2}
                          onClick={() => window.open(paymentUrl, '_blank')}
                        />
                      ) : null}
                      <ActionButton label="Download QR" icon={Download} onClick={() => void handleDownloadQr()} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Payment method" value={invoicePaymentMethodLabel(detail)} />
                <Field label="Payment status" value={payStatus} />
                <Field
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
                    <ActionButton
                      label={sendLoading ? 'Sending…' : 'Send invoice'}
                      icon={Send}
                      primary
                      disabled={sendLoading}
                      onClick={() => void handleSend()}
                    />
                    <ActionButton
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
                    <ActionButton
                      label="Mark as Paid"
                      icon={Check}
                      onClick={() => setConfirmMarkPaidOpen(true)}
                      disabled={settlementLoading}
                    />
                  ) : null}
                  {canReopenPaymentLink(detail.status) ? (
                    <ActionButton
                      label="Reopen invoice"
                      icon={RefreshCw}
                      onClick={() => setConfirmReopenOpen(true)}
                      disabled={settlementLoading}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </ExpandableCard>

          {(detail.cryptoNetwork || detail.cryptoAddress) && !ready.cryptoConfirmation ? (
            <ExpandableCard title="Crypto payment instructions" summary={detail.cryptoNetwork || 'Crypto'}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Network" value={detail.cryptoNetwork || '—'} />
                <Field label="Currency" value={detail.cryptoCurrency || detail.currency} />
                <Field label="Address" value={detail.cryptoAddress || '—'} />
                <Field label="Memo" value={detail.cryptoMemo || '—'} />
                {detail.cryptoInstructions ? (
                  <div className="sm:col-span-2">
                    <Field label="Instructions" value={detail.cryptoInstructions} />
                  </div>
                ) : null}
              </dl>
            </ExpandableCard>
          ) : null}

          {hasManualBank ? (
            <ExpandableCard title="Bank transfer instructions" summary={detail.manualBankCurrency || 'Bank'}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Recipient" value={detail.manualBankRecipientName || '—'} />
                <Field label="Type" value={detail.manualBankDestinationType || '—'} />
                <Field label="Currency" value={detail.manualBankCurrency || '—'} />
                <Field label="Bank" value={detail.manualBankBankName || '—'} />
                <Field label="Account" value={detail.manualBankAccountNumber || '—'} />
                <Field label="IBAN" value={detail.manualBankIban || '—'} />
                <Field label="SWIFT/BIC" value={detail.manualBankSwiftBic || '—'} />
                <Field label="Sort/routing" value={detail.manualBankRoutingSortCode || '—'} />
                {detail.manualBankInstructions ? (
                  <div className="sm:col-span-2">
                    <Field label="Instructions" value={detail.manualBankInstructions} />
                  </div>
                ) : null}
              </dl>
            </ExpandableCard>
          ) : null}

          {showCrypto ? (
            <ExpandableCard
              title="Crypto settlement"
              summary={
                detail.cryptoNetwork ||
                ready.cryptoConfirmation?.payerNetwork ||
                invoicePaymentMethodLabel(detail)
              }
            >
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field
                    label="Network"
                    value={
                      ready.cryptoConfirmation?.payerNetwork ||
                      detail.cryptoNetwork ||
                      '—'
                    }
                  />
                  <Field
                    label="Token"
                    value={
                      ready.cryptoConfirmation?.payerCurrency ||
                      detail.cryptoCurrency ||
                      detail.currency
                    }
                  />
                  <Field
                    label="Wallet used"
                    value={
                      ready.cryptoConfirmation?.payerWalletAddress ||
                      detail.cryptoAddress ||
                      'Not yet received'
                    }
                  />
                  {ready.cryptoConfirmation?.payerTxHash ? (
                    <Field label="Transaction" value={ready.cryptoConfirmation.payerTxHash} />
                  ) : null}
                  <Field
                    label="State"
                    value={ready.cryptoConfirmation?.verificationStatus || payStatus}
                  />
                </div>
                {explorerUrl ? (
                  <ActionButton
                    label="View on block explorer"
                    icon={ExternalLink}
                    onClick={() => window.open(explorerUrl, '_blank')}
                  />
                ) : null}
              </div>
            </ExpandableCard>
          ) : null}
            </>
          ) : null}

          {activeTab === 'lifecycle' ? (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="mb-4 text-[13.5px] font-semibold">Payment lifecycle</h2>
              <PaymentLifecyclePanel paymentLinkId={detail.id} linkStatus={detail.status} />
            </section>
          ) : null}

          {activeTab === 'accounting' ? (
            <>
              <CommercialOsNextStepBanner
                tone={xeroGuidance.tone}
                title={xeroGuidance.title}
                message={xeroGuidance.message}
              />

              {showXero ? (
                <ExpandableCard title="Xero sync" summary={xeroDisplay?.label ?? 'Xero'} defaultOpen>
                  <div className="space-y-6">
                    {xeroDisplay ? (
                      <div className="flex items-center gap-2 text-[13.5px] font-medium">
                        <span className={`h-1.5 w-1.5 rounded-full ${xeroDisplay.dotClass}`} />
                        {xeroDisplay.label}
                      </div>
                    ) : null}
                    {detail.xeroInvoiceNumber ? (
                      <Field label="Xero invoice" value={detail.xeroInvoiceNumber} />
                    ) : null}
                    {(detail.xeroSyncs?.length ?? 0) > 0 ? (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                          Sync history
                        </div>
                        <ul className="mt-3 space-y-2 text-[12.5px] text-ink-soft">
                          {detail.xeroSyncs!.map((sync) => {
                            const display = getXeroSyncDisplayStatus(sync, detail.xeroSyncs ?? []);
                            return (
                              <li key={sync.id} className="flex justify-between gap-4">
                                <span>
                                  {sync.syncType} · {display.label}
                                  {sync.xeroInvoiceId ? ` · ${sync.xeroInvoiceId}` : ''}
                                </span>
                                <span>
                                  {format(new Date(sync.updatedAt || sync.createdAt), 'd MMM · HH:mm')}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </ExpandableCard>
              ) : null}

              <ExpandableCard
                title="Ledger entries"
                summary={ledgerEntries.length > 0 ? `${ledgerEntries.length} entries` : 'None yet'}
                defaultOpen
              >
                {ledgerEntries.length > 0 ? (
                  <ul className="space-y-3">
                    {ledgerEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3"
                      >
                        <div>
                          <div className="text-[13px] font-medium">
                            {entry.ledgerAccount?.name ?? 'Account'} ({entry.ledgerAccount?.code ?? '—'})
                          </div>
                          <div className="text-[12px] text-ink-soft">{entry.description}</div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-[13px] font-medium ${
                              entry.entryType === 'DEBIT' ? 'text-destructive' : 'text-emerald-600'
                            }`}
                          >
                            {entry.entryType === 'DEBIT' ? 'DR' : 'CR'}{' '}
                            {formatCurrency(Number(entry.amount), entry.currency)}
                          </div>
                          <div className="text-[11px] text-ink-soft">
                            {format(new Date(entry.createdAt), 'd MMM · HH:mm')}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-soft">No ledger entries yet — entries appear after payment reconciliation.</p>
                )}
              </ExpandableCard>

              {showFx ? (
                <ExpandableCard title="FX snapshots" summary="Creation & settlement rates" defaultOpen>
                  <div className="space-y-6">
                    {creationFx.length > 0 ? (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                          At creation
                        </div>
                        <ul className="mt-3 space-y-2 text-[12.5px]">
                          {creationFx.map((snap) => (
                            <li key={snap.id} className="flex justify-between gap-4">
                              <span>
                                1 {snap.baseCurrency} = {snap.rate.toFixed(6)} {snap.quoteCurrency}
                              </span>
                              <span className="text-ink-soft">
                                {format(new Date(snap.capturedAt), 'd MMM · HH:mm')} · {snap.provider}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {settlementFx.length > 0 ? (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                          At settlement
                        </div>
                        <ul className="mt-3 space-y-2 text-[12.5px]">
                          {settlementFx.map((snap) => (
                            <li key={snap.id} className="flex justify-between gap-4">
                              <span>
                                1 {snap.baseCurrency} = {snap.rate.toFixed(6)} {snap.quoteCurrency}
                              </span>
                              <span className="text-ink-soft">
                                {format(new Date(snap.capturedAt), 'd MMM · HH:mm')} · {snap.provider}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </ExpandableCard>
              ) : null}
            </>
          ) : null}

          {activeTab === 'activity' ? (
            <>
              {timeline.length > 0 ? (
                <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h2 className="text-[13.5px] font-semibold">Timeline</h2>
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

              {(detail.paymentEvents?.length ?? 0) > 0 ? (
                <ExpandableCard title="Payment events" summary={`${detail.paymentEvents!.length} events`} defaultOpen>
                  <ul className="space-y-2 text-[12.5px]">
                    {detail.paymentEvents!.map((e) => (
                      <li key={e.id} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
                        <span>{e.eventType.replace(/_/g, ' ')}</span>
                        <span className="text-ink-soft">{format(new Date(e.createdAt), 'd MMM · HH:mm')}</span>
                      </li>
                    ))}
                  </ul>
                </ExpandableCard>
              ) : null}

              {showAudit ? (
                <ExpandableCard title="Audit log" summary={`${auditEntries.length} entries`} defaultOpen>
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
                </ExpandableCard>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <section
            aria-labelledby="ai-detail-heading"
            className="rounded-2xl border border-primary/25 bg-accent/20 p-6 shadow-card"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h2 id="ai-detail-heading" className="text-[13.5px] font-semibold">
                Provvy AI
              </h2>
            </div>
            <p className="mt-4 text-[12.5px] text-ink-soft">Analysis of {displayRef}</p>
            <ul className="mt-4 space-y-3">
              {aiDismissed.includes(0) ? null : (
                <li className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="text-[13px] leading-relaxed text-ink-soft">
                    Nothing needs your attention on this invoice.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAiDismissed((d) => [...d, 0])}
                    className="mt-3 text-[12px] text-ink-soft hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-[13.5px] font-semibold">At a glance</h2>
            <dl className="mt-4 space-y-2.5">
              {[
                { label: 'Amount', value: formatCurrency(Number(detail.amount), detail.currency) },
                { label: 'Outstanding', value: outstandingDisplay },
                { label: 'Due', value: formatInvoiceDueLabel(detail) },
                { label: 'Payment', value: payStatus },
                ...(xeroDisplay ? [{ label: 'Xero', value: xeroDisplay.label }] : []),
                {
                  label: 'Settlement',
                  value: settlementLabel ?? 'Not settled',
                },
              ].map((r) => (
                <div key={r.label} className="flex justify-between gap-4 text-[13px]">
                  <dt className="text-ink-soft">{r.label}</dt>
                  <dd className="max-w-[60%] text-right font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-center gap-2 text-[12px] text-ink-soft">
              <Landmark className="h-3.5 w-3.5" />
              Reconciles into your Commercial OS ledger
            </div>
          </section>
        </aside>
      </div>

      {organizationId && editOpen ? (
        <CreatePaymentLinkDialog
          mode="edit"
          organizationId={organizationId}
          open={editOpen}
          onOpenChange={setEditOpen}
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
    </div>
  );
}

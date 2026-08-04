'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  ExternalLink,
  Files,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Send,
  Trash2,
  XCircle,
  CircleDollarSign,
} from 'lucide-react';
import type { PaymentLink } from '@/components/payment-links/payment-links-table';
import { CreatePaymentLinkDialog } from '@/components/payment-links/payment-links-lazy-modules';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceInvoiceActions } from '@/hooks/use-workspace-invoice-actions';
import { formatCurrency } from '@/lib/formatters/format-currency';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { CommercialOsCreateInvoiceLink } from '@/components/journey/lovable/commercial-os-create-invoice-gate';
import {
  formatInvoiceDueLabel,
  invoicePaymentMethodLabel,
  invoicePublicReference,
  INVOICE_DISPLAY_STATUS_CLS,
  toInvoiceDisplayStatus,
} from '@/lib/payment-links/invoice-display-status';
import { receivablesInvoiceXeroColumn, type XeroSyncRecordLike } from '@/lib/xero/xero-sync-display';
import { fetchAllPaymentLinks } from '@/lib/payment-links/fetch-payment-links-list.client';

const STATUS_FILTER = ['All', 'Draft', 'Sent', 'Overdue', 'Paid', 'Canceled'] as const;

function matchesStatusFilter(link: PaymentLink, filter: (typeof STATUS_FILTER)[number]): boolean {
  if (filter === 'All') return true;
  const display = toInvoiceDisplayStatus(link);
  if (filter === 'Draft') return display === 'Draft';
  if (filter === 'Sent') return display === 'Sent';
  if (filter === 'Overdue') return display === 'Overdue';
  if (filter === 'Paid') return display === 'Paid';
  if (filter === 'Canceled') return link.status === 'CANCELED';
  return true;
}

export function WorkspaceInvoiceListScreen() {
  const { toast } = useToast();
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTER)[number]>('All');
  const [xeroSyncById, setXeroSyncById] = useState<Record<string, XeroSyncRecordLike[] | null>>({});

  const fetchPaymentLinks = useCallback(async () => {
    if (!organizationId) {
      setPaymentLinks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAllPaymentLinks<PaymentLink>({ organizationId });
      setPaymentLinks(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setLoadError(message);
      toast({
        title: 'Could not load invoices',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    if (isOrgLoading) return;
    void fetchPaymentLinks();
  }, [fetchPaymentLinks, isOrgLoading]);

  const actions = useWorkspaceInvoiceActions({ onRefresh: fetchPaymentLinks });

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return paymentLinks.filter((link) => {
      if (!matchesStatusFilter(link, statusFilter)) return false;
      if (!q) return true;
      const ref = invoicePublicReference(link).toLowerCase();
      const customer = (link.customerName || link.customerEmail || '').toLowerCase();
      const desc = (link.description || '').toLowerCase();
      return ref.includes(q) || customer.includes(q) || desc.includes(q);
    });
  }, [paymentLinks, search, statusFilter]);

  const hasActiveFilters = search.trim().length > 0 || statusFilter !== 'All';
  const isEmptyList = !isLoading && !loadError && paymentLinks.length === 0;
  const isFilteredEmpty =
    !isLoading && !loadError && paymentLinks.length > 0 && filteredLinks.length === 0;

  useEffect(() => {
    if (!organizationId || filteredLinks.length === 0) {
      setXeroSyncById({});
      return;
    }
    const ids = filteredLinks.slice(0, 30).map((l) => l.id);
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(`/api/payment-links/${id}`);
          if (!response.ok) return [id, null] as const;
          const result = await response.json();
          return [id, (result.data?.xeroSyncs ?? []) as XeroSyncRecordLike[]] as const;
        } catch {
          return [id, null] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setXeroSyncById(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, filteredLinks]);

  return (
    <div className="animate-fade-up space-y-10 pb-24">
      <Link
        href={COMMERCIAL_OS_ROUTES.receivables}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Receivables
      </Link>

      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Invoices</h1>
          <p className="mt-3 max-w-xl text-[16px] text-ink-soft">
            Manage every invoice without leaving your workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <CommercialOsCreateInvoiceLink
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-5 text-[14px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </CommercialOsCreateInvoiceLink>
          <button
            type="button"
            onClick={() => void fetchPaymentLinks()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, reference, description…"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-[14px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-primary/10 text-primary'
                  : 'text-ink-soft hover:bg-secondary hover:text-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[960px] text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-soft">
              {['Status', 'Reference', 'Customer', 'Amount', 'Due', 'Method', 'Xero', ''].map((h) => (
                <th key={h} scope="col" className="px-5 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-ink-soft">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <p className="text-[14px] font-medium text-foreground">Unable to load invoices</p>
                  <p className="mt-2 text-[13px] text-ink-soft">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchPaymentLinks()}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-secondary"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </button>
                </td>
              </tr>
            ) : isEmptyList ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <p className="text-[14px] font-medium text-foreground">No invoices yet</p>
                  <p className="mt-2 text-[13px] text-ink-soft">
                    Create your first invoice to start collecting payments.
                  </p>
                  <CommercialOsCreateInvoiceLink
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-glow"
                  >
                    <Plus className="h-4 w-4" />
                    Create invoice
                  </CommercialOsCreateInvoiceLink>
                </td>
              </tr>
            ) : isFilteredEmpty ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-ink-soft">
                  No invoices match your filters.
                </td>
              </tr>
            ) : (
              filteredLinks.map((link) => {
                const displayStatus = toInvoiceDisplayStatus(link);
                const ref = invoicePublicReference(link);
                const avail = actions.actionAvailability(link);
                const xeroDisplay = receivablesInvoiceXeroColumn(xeroSyncById[link.id] ?? undefined);
                return (
                  <tr
                    key={link.id}
                    className="border-t border-border/70 transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${INVOICE_DISPLAY_STATUS_CLS[displayStatus]}`}
                      >
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => actions.openInvoice(link)}
                        className="font-medium text-primary hover:underline"
                      >
                        {ref}
                      </button>
                    </td>
                    <td className="px-5 py-4">{link.customerName || link.customerEmail || '—'}</td>
                    <td className="px-5 py-4 font-medium">
                      {formatCurrency(Number(link.amount), link.currency)}
                    </td>
                    <td className="px-5 py-4 text-ink-soft">{formatInvoiceDueLabel(link)}</td>
                    <td className="px-5 py-4 text-ink-soft">{invoicePaymentMethodLabel(link)}</td>
                    <td className="px-5 py-4">
                      {xeroDisplay ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                          <span className={`h-1.5 w-1.5 rounded-full ${xeroDisplay.dotClass}`} />
                          {xeroDisplay.label}
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-soft transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label={`Actions for ${ref}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => actions.openInvoice(link)}>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Open
                          </DropdownMenuItem>
                          {avail.canEdit ? (
                            <DropdownMenuItem onClick={() => actions.startEdit(link)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => actions.startDuplicate(link)}>
                            <Files className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => void actions.copyPaymentLink(link)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy payment link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => actions.openPaymentLink(link)}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open payment link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void actions.downloadQr(link)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download QR
                          </DropdownMenuItem>
                          {avail.canSend ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => actions.startSend(link)}>
                                <Send className="mr-2 h-4 w-4" />
                                Send invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void actions.resendInvoice(link)}>
                                <Send className="mr-2 h-4 w-4" />
                                Resend invoice
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {avail.canMarkPaid ? (
                            <DropdownMenuItem onClick={() => actions.startMarkPaid(link)}>
                              <CircleDollarSign className="mr-2 h-4 w-4" />
                              Mark as Paid
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem asChild>
                            <Link href={actions.createRecurringHref(link)}>
                              <Repeat className="mr-2 h-4 w-4" />
                              Create recurring invoice
                            </Link>
                          </DropdownMenuItem>
                          {avail.canCancel ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => actions.startCancel(link)}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel invoice
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {avail.canDelete ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => actions.startDelete(link)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[12.5px] text-ink-soft">
        Showing {filteredLinks.length} of {paymentLinks.length} invoices
      </p>

      {organizationId && actions.editLink ? (
        <CreatePaymentLinkDialog
          mode="edit"
          organizationId={organizationId}
          open={Boolean(actions.editLink)}
          onOpenChange={(open) => !open && actions.setEditLink(null)}
          editPaymentLink={{
            id: actions.editLink.id,
            amount: Number(actions.editLink.amount),
            currency: actions.editLink.currency,
            invoiceCurrency: actions.editLink.invoiceCurrency ?? actions.editLink.currency,
            description: actions.editLink.description,
            invoiceReference: actions.editLink.invoiceReference ?? null,
            customerEmail: actions.editLink.customerEmail ?? null,
            customerName: actions.editLink.customerName ?? null,
            customerPhone: actions.editLink.customerPhone ?? null,
            invoiceDate: actions.editLink.invoiceDate ?? null,
            dueDate: actions.editLink.dueDate ?? null,
            expiresAt: actions.editLink.expiresAt ?? null,
            invoiceOnlyMode: actions.editLink.invoiceOnlyMode,
            paymentMethod: actions.editLink.paymentMethod,
            hederaCheckoutMode: actions.editLink.hederaCheckoutMode,
            wiseTransferId: actions.editLink.wiseTransferId,
            cryptoNetwork: actions.editLink.cryptoNetwork ?? null,
            cryptoAddress: actions.editLink.cryptoAddress ?? null,
            cryptoCurrency: actions.editLink.cryptoCurrency ?? null,
            cryptoMemo: actions.editLink.cryptoMemo ?? null,
            cryptoInstructions: actions.editLink.cryptoInstructions ?? null,
            manualBankRecipientName: actions.editLink.manualBankRecipientName ?? null,
            manualBankCurrency: actions.editLink.manualBankCurrency ?? null,
            manualBankDestinationType: actions.editLink.manualBankDestinationType ?? null,
            manualBankBankName: actions.editLink.manualBankBankName ?? null,
            manualBankAccountNumber: actions.editLink.manualBankAccountNumber ?? null,
            manualBankIban: actions.editLink.manualBankIban ?? null,
            manualBankSwiftBic: actions.editLink.manualBankSwiftBic ?? null,
            manualBankRoutingSortCode: actions.editLink.manualBankRoutingSortCode ?? null,
            manualBankWiseReference: actions.editLink.manualBankWiseReference ?? null,
            manualBankRevolutHandle: actions.editLink.manualBankRevolutHandle ?? null,
            manualBankInstructions: actions.editLink.manualBankInstructions ?? null,
            attachmentUrl: actions.editLink.attachmentUrl ?? null,
            attachmentFilename: actions.editLink.attachmentFilename ?? null,
            attachmentMimeType: actions.editLink.attachmentMimeType ?? null,
            attachmentSizeBytes: actions.editLink.attachmentSizeBytes ?? null,
          }}
          onSuccess={() => {
            actions.setEditLink(null);
            void actions.refresh();
          }}
        />
      ) : null}

      {organizationId && actions.duplicateLink ? (
        <CreatePaymentLinkDialog
          organizationId={organizationId}
          defaultCurrency={actions.duplicateLink.invoiceCurrency ?? actions.duplicateLink.currency}
          defaultValues={{
            amount: Number(actions.duplicateLink.amount),
            currency: actions.duplicateLink.invoiceCurrency ?? actions.duplicateLink.currency,
            description: `${actions.duplicateLink.description} (Copy)`,
            invoiceReference: actions.duplicateLink.invoiceReference || '',
            customerEmail: actions.duplicateLink.customerEmail || '',
            customerName: actions.duplicateLink.customerName || '',
            customerPhone: actions.duplicateLink.customerPhone || '',
            invoiceDate: actions.duplicateLink.invoiceDate
              ? new Date(actions.duplicateLink.invoiceDate as string | Date)
              : new Date(),
          }}
          open={Boolean(actions.duplicateLink)}
          onOpenChange={(open) => !open && actions.setDuplicateLink(null)}
          onSuccess={() => {
            actions.setDuplicateLink(null);
            toast({ title: 'Invoice duplicated' });
            void actions.refresh();
          }}
        />
      ) : null}

      <AlertDialog open={actions.dialog === 'send'} onOpenChange={(o) => !o && actions.setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Email this invoice to your customer with a payment link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="email"
            value={actions.sendEmail}
            onChange={(e) => actions.setSendEmail(e.target.value)}
            placeholder="client@example.com"
            className="w-full rounded-lg border border-border px-3 py-2 text-[14px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actions.loading}
              onClick={(e) => {
                e.preventDefault();
                void actions.confirmSend();
              }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={actions.dialog === 'markPaid'} onOpenChange={(o) => !o && actions.setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark payment received?</AlertDialogTitle>
            <AlertDialogDescription>
              Only confirm after payment has actually cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actions.loading}
              onClick={(e) => {
                e.preventDefault();
                void actions.confirmMarkPaid();
              }}
            >
              Confirm paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={actions.dialog === 'cancel'} onOpenChange={(o) => !o && actions.setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              The payment link will stop accepting payments. You can still delete the invoice later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.loading}>Keep open</AlertDialogCancel>
            <AlertDialogAction
              disabled={actions.loading}
              onClick={(e) => {
                e.preventDefault();
                void actions.confirmCancel();
              }}
            >
              Cancel invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={actions.dialog === 'delete'} onOpenChange={(o) => !o && actions.setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice from your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actions.loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void actions.confirmDelete();
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

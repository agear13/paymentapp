/**
 * Payment Links Dashboard Page
 * Main page for managing payment links
 */

'use client';

import * as React from 'react';
import { Plus, RefreshCw, Download } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreatePaymentLinkDialog } from '@/components/payment-links/create-payment-link-dialog';
import { PaymentLinksTable } from '@/components/payment-links/payment-links-table';
import { PaymentLinksTableSkeleton } from '@/components/payment-links/payment-links-table-skeleton';
import { PaymentLinksFilters } from '@/components/payment-links/payment-links-filters';
import {
  PaymentLinkDetailDialog,
  type PaymentLinkDetails as PaymentLinkDetailPayload,
} from '@/components/payment-links/payment-link-detail-dialog';
import { BulkActionsToolbar } from '@/components/payment-links/bulk-actions-toolbar';
import type { PaymentLink, PaymentLinkDetails } from '@/components/payment-links/payment-links-table';
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
import { useToast } from '@/hooks/use-toast';
import { usePolling } from '@/hooks/use-polling';
import { exportToCSV, type ExportColumn } from '@/lib/export-csv';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/payment-links/currency-select';
import { PaymentLinksOnboardingAssistant } from '@/components/payment-links-onboarding/payment-links-onboarding-assistant';
import { PendingCryptoConfirmations } from '@/components/payment-links/pending-crypto-confirmations';
import { PendingManualBankConfirmations } from '@/components/payment-links/pending-manual-bank-confirmations';

export default function PaymentLinksPage() {
  const { toast } = useToast();
  const [paymentLinks, setPaymentLinks] = React.useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filters, setFilters] = React.useState<{
    status?: string;
    currency?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: number;
    amountMax?: number;
  }>({});
  
  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  
  // Detail dialog state
  const [selectedPaymentLink, setSelectedPaymentLink] = React.useState<PaymentLinkDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  
  // Edit dialog state
  const [linkToEdit, setLinkToEdit] = React.useState<PaymentLink | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  
  // Duplicate dialog state
  const [linkToDuplicate, setLinkToDuplicate] = React.useState<PaymentLink | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false);
  
  // Cancel confirmation dialog state
  const [linkToCancel, setLinkToCancel] = React.useState<PaymentLink | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [isCanceling, setIsCanceling] = React.useState(false);
  const [linkToDelete, setLinkToDelete] = React.useState<PaymentLink | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Get organization ID from context/hook
  const { organizationId, isLoading: isOrgLoading } = useOrganization();

  type FetchPaymentLinksOpts = { silent?: boolean };

  const fetchPaymentLinks = React.useCallback(
    async (opts?: FetchPaymentLinksOpts) => {
      const silent = opts?.silent === true;
      if (!organizationId) {
        if (!silent) setIsLoading(false);
        return;
      }
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const params = new URLSearchParams({
          organizationId,
          ...filters,
        });

        const response = await fetch(`/api/payment-links?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch payment links');
        }

        const result = await response.json();
        setPaymentLinks(result.data || []);
      } catch (error: unknown) {
        if (!silent) {
          const message = error instanceof Error ? error.message : 'Failed to load invoices';
          toast({
            title: 'Error',
            description: message,
            variant: 'destructive',
          });
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [organizationId, filters, toast]
  );

  React.useEffect(() => {
    if (!isOrgLoading && organizationId) {
      fetchPaymentLinks();
    }
  }, [fetchPaymentLinks, isOrgLoading, organizationId]);

  // Enable real-time polling when there are OPEN or DRAFT payment links
  const hasActiveLinks = React.useMemo(() => {
    return paymentLinks.some(
      (link) =>
        link.status === 'OPEN' ||
        link.status === 'DRAFT' ||
        link.status === 'PAID_UNVERIFIED' ||
        link.status === 'REQUIRES_REVIEW'
    );
  }, [paymentLinks]);

  // Poll for updates every 3 seconds when there are active links (no toast / full-page loading on failure)
  usePolling(
    () => {
      if (organizationId) {
        void fetchPaymentLinks({ silent: true });
      }
    },
    {
      interval: 3000,
      enabled: hasActiveLinks && !!organizationId,
      runOnMount: false,
    }
  );

  const handleCreateSuccess = (newPaymentLink: any) => {
    toast({
      title: 'Success',
      description: 'Invoice created successfully',
    });
    void fetchPaymentLinks({ silent: true });
  };

  const handleViewDetails = async (paymentLink: PaymentLink) => {
    try {
      const response = await fetch(`/api/payment-links/${paymentLink.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment link details');
      }

      const result = await response.json();
      setSelectedPaymentLink(result.data);
      setDetailDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load payment link details',
        variant: 'destructive',
      });
    }
  };

  const handleManualSettlementComplete = React.useCallback(async () => {
    await fetchPaymentLinks({ silent: true });
    const id = selectedPaymentLink?.id;
    if (!id) return;
    try {
      const res = await fetch(`/api/payment-links/${id}`);
      if (res.ok) {
        const result = await res.json();
        setSelectedPaymentLink(result.data);
      }
    } catch {
      /* ignore refresh errors */
    }
  }, [fetchPaymentLinks, selectedPaymentLink?.id]);

  const handleResend = async (paymentLink: PaymentLinkDetails) => {
    try {
      const response = await fetch(`/api/payment-links/${paymentLink.id}/resend`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend notification');
      }

      toast({
        title: 'Notification Sent',
        description: `Payment link notification sent to ${paymentLink.customerEmail}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send notification',
        variant: 'destructive',
      });
    }
  };

  const handleEditClick = (paymentLink: PaymentLink) => {
    if (paymentLink.status !== 'DRAFT' && paymentLink.status !== 'OPEN') {
      toast({
        title: 'Cannot edit',
        description:
          'Only unpaid draft and open invoices can be edited. Paid or closed invoices cannot be changed.',
        variant: 'destructive',
      });
      return;
    }
    setLinkToEdit(paymentLink);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = React.useCallback(async () => {
    const editedId = linkToEdit?.id;
    const shouldRefreshDetail = Boolean(editedId && selectedPaymentLink?.id === editedId);
    setEditDialogOpen(false);
    setLinkToEdit(null);
    await fetchPaymentLinks({ silent: true });
    if (shouldRefreshDetail && editedId) {
      try {
        const res = await fetch(`/api/payment-links/${editedId}`);
        if (res.ok) {
          const result = await res.json();
          setSelectedPaymentLink(result.data);
        }
      } catch {
        /* ignore */
      }
    }
  }, [fetchPaymentLinks, linkToEdit?.id, selectedPaymentLink?.id]);

  const handleEditFromDetail = React.useCallback((pl: PaymentLinkDetailPayload) => {
    setDetailDialogOpen(false);
    setLinkToEdit(pl as PaymentLink);
    setEditDialogOpen(true);
  }, []);

  const handleDuplicateClick = (paymentLink: PaymentLink) => {
    setLinkToDuplicate(paymentLink);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicateSuccess = (newPaymentLink: any) => {
    toast({
      title: 'Success',
      description: 'Invoice duplicated successfully',
    });
    void fetchPaymentLinks({ silent: true });
    setDuplicateDialogOpen(false);
    setLinkToDuplicate(null);
  };

  const handleCancelClick = (paymentLink: PaymentLink) => {
    setLinkToCancel(paymentLink);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!linkToCancel) return;

    const canceledId = linkToCancel.id;
    setIsCanceling(true);
    try {
      const response = await fetch(`/api/payment-links/${canceledId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          typeof error.error === 'string' && error.error.trim()
            ? error.error.trim()
            : 'Failed to cancel payment link'
        );
      }

      toast({
        title: 'Success',
        description: 'Payment link canceled successfully',
      });
      
      setCancelDialogOpen(false);
      setLinkToCancel(null);
      void fetchPaymentLinks({ silent: true });
      setSelectedPaymentLink((prev) => {
        if (prev?.id === canceledId) {
          setDetailDialogOpen(false);
          return null;
        }
        return prev;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(canceledId);
        return next;
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel payment link',
        variant: 'destructive',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const handleDeleteClick = (paymentLink: PaymentLink) => {
    setLinkToDelete(paymentLink);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!linkToDelete) return;

    const deletedId = linkToDelete.id;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/payment-links/${deletedId}/delete`, {
        method: 'POST',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' && payload.error.trim()
            ? payload.error.trim()
            : 'Failed to delete invoice'
        );
      }

      toast({
        title: 'Invoice deleted',
        description: 'The invoice was removed from your workspace.',
      });
      setDeleteDialogOpen(false);
      setLinkToDelete(null);
      void fetchPaymentLinks({ silent: true });
      setSelectedPaymentLink((prev) => {
        if (prev?.id === deletedId) {
          setDetailDialogOpen(false);
          return null;
        }
        return prev;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete invoice';
      toast({
        title: 'Delete blocked',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleRefresh = React.useCallback(() => {
    void fetchPaymentLinks();
  }, [fetchPaymentLinks]);

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    const linksToExport = selectedIds.size > 0
      ? paymentLinks.filter(link => selectedIds.has(link.id))
      : paymentLinks;

    if (linksToExport.length === 0) {
      toast({
        title: 'No Data to Export',
        description: 'No payment links available for export',
        variant: 'destructive',
      });
      return;
    }

    const columns: ExportColumn<PaymentLink>[] = [
      { key: 'shortCode', header: 'Short Code' },
      { key: 'status', header: 'Status' },
      { 
        key: 'amount', 
        header: 'Amount',
        format: (value, row) => formatCurrency(Number(value), row.currency)
      },
      { key: 'currency', header: 'Currency' },
      { key: 'description', header: 'Description' },
      { key: 'invoiceReference', header: 'Invoice Reference' },
      { key: 'customerEmail', header: 'Customer Email' },
      { key: 'customerPhone', header: 'Customer Phone' },
      {
        key: 'invoiceDate',
        header: 'Invoice Date',
        format: (value) => (value ? format(new Date(value), 'yyyy-MM-dd') : ''),
      },
      { 
        key: 'createdAt', 
        header: 'Created At',
        format: (value) => format(new Date(value), 'yyyy-MM-dd HH:mm:ss')
      },
      { 
        key: 'expiresAt', 
        header: 'Expires At',
        format: (value) => value ? format(new Date(value), 'yyyy-MM-dd HH:mm:ss') : ''
      },
    ];

    const filename = `invoices-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    exportToCSV(linksToExport, columns, filename);

    toast({
      title: 'Export Complete',
      description: `Exported ${linksToExport.length} invoice(s)`,
    });

    // Clear selection after export
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  };

  const handleBulkCancel = async () => {
    const selected = paymentLinks.filter(link => selectedIds.has(link.id));
    const cancellable = selected.filter(
      (link) =>
        link.status !== 'PAID' &&
        link.status !== 'PAID_UNVERIFIED' &&
        link.status !== 'REQUIRES_REVIEW' &&
        link.status !== 'EXPIRED' &&
        link.status !== 'CANCELED'
    );

    if (cancellable.length === 0) {
      toast({
        title: 'No Cancellable Links',
        description: 'Selected links cannot be cancelled',
        variant: 'destructive',
      });
      return;
    }

    setIsCanceling(true);
    let successCount = 0;
    let failCount = 0;

    for (const link of cancellable) {
      try {
        const response = await fetch(`/api/payment-links/${link.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    setIsCanceling(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      toast({
        title: 'Bulk Cancellation Complete',
        description: `${successCount} link(s) cancelled successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
      });
      void fetchPaymentLinks({ silent: true });
    } else {
      toast({
        title: 'Cancellation Failed',
        description: 'Failed to cancel selected links',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div id="create-invoice" className="flex items-center justify-between scroll-mt-24">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage invoices for your customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || paymentLinks.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <CreatePaymentLinkDialog
            organizationId={organizationId}
            defaultCurrency="USD"
            onSuccess={handleCreateSuccess}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            }
          />
        </div>
      </div>

      {organizationId ? <PaymentLinksOnboardingAssistant organizationId={organizationId} /> : null}

      {/* Filters */}
      <PaymentLinksFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {organizationId ? (
        <PendingCryptoConfirmations
          organizationId={organizationId}
          onChanged={() => void fetchPaymentLinks({ silent: true })}
        />
      ) : null}
      {organizationId ? (
        <PendingManualBankConfirmations
          organizationId={organizationId}
          onChanged={() => void fetchPaymentLinks({ silent: true })}
        />
      ) : null}

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            All Invoices
            {isLoading && paymentLinks.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Refreshing...
              </span>
            )}
          </CardTitle>
          <CardDescription>
            View and manage all your invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show skeleton ONLY if loading AND no data yet */}
          {isLoading && paymentLinks.length === 0 ? (
            <PaymentLinksTableSkeleton rows={5} showCheckbox={true} />
          ) : (
            <PaymentLinksTable
              paymentLinks={paymentLinks}
              onViewDetails={handleViewDetails}
              onEdit={handleEditClick}
              onDuplicate={handleDuplicateClick}
              onCancel={handleCancelClick}
              onDelete={handleDeleteClick}
              onRefresh={handleRefresh}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </CardContent>
      </Card>

      {/* Payment Link Detail Dialog */}
      <PaymentLinkDetailDialog
        paymentLink={selectedPaymentLink}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onResend={handleResend}
        onManualSettlementComplete={handleManualSettlementComplete}
        onEdit={
          selectedPaymentLink &&
          (selectedPaymentLink.status === 'DRAFT' || selectedPaymentLink.status === 'OPEN')
            ? handleEditFromDetail
            : undefined
        }
      />

      {organizationId && linkToEdit ? (
        <CreatePaymentLinkDialog
          mode="edit"
          organizationId={organizationId}
          editPaymentLink={{
            id: linkToEdit.id,
            amount: Number(linkToEdit.amount),
            currency: linkToEdit.currency,
            description: linkToEdit.description,
            invoiceReference: linkToEdit.invoiceReference,
            customerEmail: linkToEdit.customerEmail,
            customerName: linkToEdit.customerName,
            customerPhone: linkToEdit.customerPhone,
            invoiceDate: linkToEdit.invoiceDate ?? null,
            dueDate: linkToEdit.dueDate,
            expiresAt: linkToEdit.expiresAt,
            invoiceOnlyMode: linkToEdit.invoiceOnlyMode,
            paymentMethod: linkToEdit.paymentMethod,
            hederaCheckoutMode: linkToEdit.hederaCheckoutMode,
            wiseTransferId: linkToEdit.wiseTransferId,
            cryptoNetwork: linkToEdit.cryptoNetwork ?? null,
            cryptoAddress: linkToEdit.cryptoAddress ?? null,
            cryptoCurrency: linkToEdit.cryptoCurrency ?? null,
            cryptoMemo: linkToEdit.cryptoMemo ?? null,
            cryptoInstructions: linkToEdit.cryptoInstructions ?? null,
            manualBankRecipientName: linkToEdit.manualBankRecipientName ?? null,
            manualBankCurrency: linkToEdit.manualBankCurrency ?? null,
            manualBankDestinationType: linkToEdit.manualBankDestinationType ?? null,
            manualBankBankName: linkToEdit.manualBankBankName ?? null,
            manualBankAccountNumber: linkToEdit.manualBankAccountNumber ?? null,
            manualBankIban: linkToEdit.manualBankIban ?? null,
            manualBankSwiftBic: linkToEdit.manualBankSwiftBic ?? null,
            manualBankRoutingSortCode: linkToEdit.manualBankRoutingSortCode ?? null,
            manualBankWiseReference: linkToEdit.manualBankWiseReference ?? null,
            manualBankRevolutHandle: linkToEdit.manualBankRevolutHandle ?? null,
            manualBankInstructions: linkToEdit.manualBankInstructions ?? null,
            attachmentUrl: linkToEdit.attachmentUrl ?? null,
            attachmentStorageKey: linkToEdit.attachmentStorageKey ?? null,
            attachmentBucket: linkToEdit.attachmentBucket ?? null,
            attachmentFilename: linkToEdit.attachmentFilename ?? null,
            attachmentMimeType: linkToEdit.attachmentMimeType ?? null,
            attachmentSizeBytes: linkToEdit.attachmentSizeBytes ?? null,
          }}
          open={editDialogOpen}
          onOpenChange={(o) => {
            setEditDialogOpen(o);
            if (!o) setLinkToEdit(null);
          }}
          onSuccess={handleEditSuccess}
        />
      ) : null}

      {/* Duplicate Payment Link Dialog */}
      {linkToDuplicate && (
        <CreatePaymentLinkDialog
          organizationId={organizationId}
          defaultCurrency={linkToDuplicate.currency}
          defaultValues={{
            amount: Number(linkToDuplicate.amount),
            currency: linkToDuplicate.currency,
            description: `${linkToDuplicate.description} (Copy)`,
            invoiceReference: linkToDuplicate.invoiceReference || '',
            customerEmail: linkToDuplicate.customerEmail || '',
            customerName: linkToDuplicate.customerName || '',
            customerPhone: linkToDuplicate.customerPhone || '',
            invoiceDate: linkToDuplicate.invoiceDate
              ? new Date(linkToDuplicate.invoiceDate as string | Date)
              : new Date(),
          }}
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          onSuccess={handleDuplicateSuccess}
        />
      )}

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
        onExport={handleExport}
        onBulkCancel={handleBulkCancel}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Payment Link?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this payment link? This action cannot be
              undone and the link will no longer be accessible to customers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={isCanceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? 'Canceling...' : 'Yes, Cancel Link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the invoice record from your list. Deletion is blocked when payment or
              settlement evidence exists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

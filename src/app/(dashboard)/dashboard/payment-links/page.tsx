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
import { EditPaymentLinkDialog } from '@/components/payment-links/edit-payment-link-dialog';
import { PaymentLinksTable } from '@/components/payment-links/payment-links-table';
import { PaymentLinksTableSkeleton } from '@/components/payment-links/payment-links-table-skeleton';
import { PaymentLinksFilters } from '@/components/payment-links/payment-links-filters';
import { PaymentLinkDetailDialog } from '@/components/payment-links/payment-link-detail-dialog';
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

  // Get organization ID from context/hook
  const { organizationId, isLoading: isOrgLoading } = useOrganization();

  const fetchPaymentLinks = React.useCallback(async () => {
    // Don't fetch if we don't have an organization ID yet
    if (!organizationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load payment links',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, filters, toast]);

  React.useEffect(() => {
    if (!isOrgLoading && organizationId) {
      fetchPaymentLinks();
    }
  }, [fetchPaymentLinks, isOrgLoading, organizationId]);

  // Enable real-time polling when there are OPEN or DRAFT payment links
  const hasActiveLinks = React.useMemo(() => {
    return paymentLinks.some(link => 
      link.status === 'OPEN' || link.status === 'DRAFT'
    );
  }, [paymentLinks]);

  // Poll for updates every 3 seconds when there are active links
  usePolling(
    () => {
      if (!isLoading) {
        fetchPaymentLinks();
      }
    },
    {
      interval: 3000,
      enabled: hasActiveLinks,
      runOnMount: false,
    }
  );

  const handleCreateSuccess = (newPaymentLink: any) => {
    toast({
      title: 'Success',
      description: 'Payment link created successfully',
    });
    fetchPaymentLinks();
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
    if (paymentLink.status !== 'DRAFT') {
      toast({
        title: 'Cannot Edit',
        description: 'Only DRAFT payment links can be edited',
        variant: 'destructive',
      });
      return;
    }
    setLinkToEdit(paymentLink);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    fetchPaymentLinks();
    setEditDialogOpen(false);
    setLinkToEdit(null);
  };

  const handleDuplicateClick = (paymentLink: PaymentLink) => {
    setLinkToDuplicate(paymentLink);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicateSuccess = (newPaymentLink: any) => {
    toast({
      title: 'Success',
      description: 'Payment link duplicated successfully',
    });
    fetchPaymentLinks();
    setDuplicateDialogOpen(false);
    setLinkToDuplicate(null);
  };

  const handleCancelClick = (paymentLink: PaymentLink) => {
    setLinkToCancel(paymentLink);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!linkToCancel) return;

    setIsCanceling(true);
    try {
      const response = await fetch(`/api/payment-links/${linkToCancel.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel payment link');
      }

      toast({
        title: 'Success',
        description: 'Payment link canceled successfully',
      });
      
      setCancelDialogOpen(false);
      setLinkToCancel(null);
      fetchPaymentLinks();
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

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleRefresh = () => {
    fetchPaymentLinks();
  };

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

    const filename = `payment-links-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    exportToCSV(linksToExport, columns, filename);

    toast({
      title: 'Export Complete',
      description: `Exported ${linksToExport.length} payment link(s)`,
    });

    // Clear selection after export
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  };

  const handleBulkCancel = async () => {
    const selected = paymentLinks.filter(link => selectedIds.has(link.id));
    const cancellable = selected.filter(
      link => link.status !== 'PAID' && link.status !== 'EXPIRED' && link.status !== 'CANCELED'
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
      fetchPaymentLinks();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Links</h1>
          <p className="text-muted-foreground">
            Create and manage payment links for your customers.
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
                Create Link
              </Button>
            }
          />
        </div>
      </div>

      {/* Filters */}
      <PaymentLinksFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {/* Payment Links Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            All Payment Links
            {isLoading && paymentLinks.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Refreshing...
              </span>
            )}
          </CardTitle>
          <CardDescription>
            View and manage all your payment links.
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
      />

      {/* Edit Payment Link Dialog */}
      <EditPaymentLinkDialog
        paymentLink={linkToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
      />

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
            customerPhone: linkToDuplicate.customerPhone || '',
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
    </div>
  );
}

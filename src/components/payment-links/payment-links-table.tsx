/**
 * Payment Links Table Component
 * Displays list of payment links with actions
 */

'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  QrCode,
  XCircle,
  Eye,
  Download,
  Edit,
  Files,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from './currency-select';
import { useToast } from '@/hooks/use-toast';

// Helper to safely format dates
const formatDate = (date: Date | string | null | undefined, formatStr: string = 'MMM d, yyyy'): string | null => {
  if (!date) return null;
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;
    return format(dateObj, formatStr);
  } catch {
    return null;
  }
};

export interface PaymentLink {
  id: string;
  shortCode: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
  amount: number;
  currency: string;
  description: string;
  invoiceReference: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  dueDate: Date | string | null;
  expiresAt: Date | string | null;
  xeroInvoiceNumber: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  paymentEvents?: any[];
}

export interface PaymentLinkDetails extends PaymentLink {
  fxSnapshots?: any[];
  ledgerEntries?: any[];
  xeroSyncs?: any[];
}

export interface PaymentLinksTableProps {
  paymentLinks: PaymentLink[];
  onViewDetails?: (paymentLink: PaymentLink) => void;
  onEdit?: (paymentLink: PaymentLink) => void;
  onDuplicate?: (paymentLink: PaymentLink) => void;
  onCancel?: (paymentLink: PaymentLink) => void;
  onRefresh?: () => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

// Helper to calculate effective status (considering overdue/expired)
const getEffectiveStatus = (link: PaymentLink): string => {
  const now = new Date();
  
  // If already PAID, EXPIRED, or CANCELED, return as-is
  if (link.status === 'PAID' || link.status === 'EXPIRED' || link.status === 'CANCELED') {
    return link.status;
  }
  
  // Check if expired (system expiry date)
  if (link.expiresAt && new Date(link.expiresAt) < now) {
    return 'EXPIRED';
  }
  
  // Check if overdue (customer due date)
  if (link.dueDate && new Date(link.dueDate) < now && link.status !== 'PAID' && link.status !== 'CANCELED') {
    return 'OVERDUE';
  }
  
  return link.status;
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'secondary';
    case 'OPEN':
      return 'default';
    case 'PAID':
      return 'success';
    case 'OVERDUE':
      return 'warning';
    case 'EXPIRED':
      return 'outline';
    case 'CANCELED':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export const PaymentLinksTable: React.FC<PaymentLinksTableProps> = ({
  paymentLinks,
  onViewDetails,
  onEdit,
  onDuplicate,
  onCancel,
  onRefresh,
  selectedIds = new Set(),
  onSelectionChange,
}) => {
  const { toast } = useToast();

  const isAllSelected = paymentLinks.length > 0 && 
    paymentLinks.every(link => selectedIds.has(link.id));
  const isSomeSelected = paymentLinks.some(link => selectedIds.has(link.id));

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      const allIds = new Set(paymentLinks.map(link => link.id));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    onSelectionChange(newSelected);
  };

  const handleCopyUrl = (shortCode: string) => {
    const url = `${window.location.origin}/pay/${shortCode}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'URL Copied',
      description: 'Payment link URL copied to clipboard',
    });
  };

  const handleOpenLink = (shortCode: string) => {
    const url = `${window.location.origin}/pay/${shortCode}`;
    window.open(url, '_blank');
  };

  const handleDownloadQR = async (paymentLink: PaymentLink) => {
    try {
      const response = await fetch(
        `/api/payment-links/${paymentLink.id}/qr-code?format=png&download=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to download QR code');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${paymentLink.shortCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'QR Code Downloaded',
        description: 'QR code image saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download QR code',
        variant: 'destructive',
      });
    }
  };

  const handleCancelLink = async (paymentLink: PaymentLink) => {
    if (onCancel) {
      onCancel(paymentLink);
    }
  };

  if (!paymentLinks || paymentLinks.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            No invoices found. Create your first invoice to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {onSelectionChange && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Invoice Ref</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paymentLinks.map((paymentLink) => {
            const effectiveStatus = getEffectiveStatus(paymentLink);
            return (
            <TableRow key={paymentLink.id}>
              {onSelectionChange && (
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(paymentLink.id)}
                    onCheckedChange={(checked) => 
                      handleSelectOne(paymentLink.id, checked as boolean)
                    }
                    aria-label={`Select ${paymentLink.description}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <Badge variant={getStatusBadgeVariant(effectiveStatus) as any}>
                  {effectiveStatus}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">
                {formatCurrency(
                  Number(paymentLink.amount),
                  paymentLink.currency
                )}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {paymentLink.description}
              </TableCell>
              <TableCell>
                {paymentLink.invoiceReference || (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {paymentLink.customerEmail || paymentLink.customerName || (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {formatDate(paymentLink.dueDate) || (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {formatDate(paymentLink.createdAt) || (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => handleCopyUrl(paymentLink.shortCode)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy URL
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleOpenLink(paymentLink.shortCode)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownloadQR(paymentLink)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download QR
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {onViewDetails && (
                      <DropdownMenuItem onClick={() => onViewDetails(paymentLink)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    )}
                    {paymentLink.status === 'DRAFT' && onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(paymentLink)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Link
                      </DropdownMenuItem>
                    )}
                    {onDuplicate && (
                      <DropdownMenuItem onClick={() => onDuplicate(paymentLink)}>
                        <Files className="mr-2 h-4 w-4" />
                        Duplicate Link
                      </DropdownMenuItem>
                    )}
                    {paymentLink.status !== 'PAID' &&
                      paymentLink.status !== 'EXPIRED' &&
                      paymentLink.status !== 'CANCELED' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleCancelLink(paymentLink)}
                            className="text-destructive"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel Link
                          </DropdownMenuItem>
                        </>
                      )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

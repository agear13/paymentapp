/**
 * Payment Link Detail Dialog
 * Shows comprehensive details of a payment link
 */

'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  Copy,
  ExternalLink,
  QrCode,
  Clock,
  DollarSign,
  FileText,
  Mail,
  Phone,
  Calendar,
  Activity,
  Send,
  TrendingUp,
  ArrowRightLeft,
  User,
  Edit,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { formatCurrency } from './currency-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { isValidShortCode } from '@/lib/short-code';

export interface PaymentLinkDetails {
  id: string;
  shortCode: string;
  status: 'DRAFT' | 'OPEN' | 'PAID_UNVERIFIED' | 'REQUIRES_REVIEW' | 'PAID' | 'EXPIRED' | 'CANCELED';
  amount: number;
  currency: string;
  description: string;
  invoiceReference: string | null;
  customerEmail: string | null;
  customerName?: string | null;
  customerPhone: string | null;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
  expiresAt: Date | null;
  xeroInvoiceNumber?: string | null;
  paymentMethod?: string | null;
  invoiceOnlyMode?: boolean;
  hederaCheckoutMode?: string | null;
  wiseTransferId?: string | null;
  cryptoNetwork?: string | null;
  cryptoAddress?: string | null;
  cryptoCurrency?: string | null;
  cryptoMemo?: string | null;
  cryptoInstructions?: string | null;
  manualBankRecipientName?: string | null;
  manualBankCurrency?: string | null;
  manualBankDestinationType?: string | null;
  manualBankBankName?: string | null;
  manualBankAccountNumber?: string | null;
  manualBankIban?: string | null;
  manualBankSwiftBic?: string | null;
  manualBankRoutingSortCode?: string | null;
  manualBankWiseReference?: string | null;
  manualBankRevolutHandle?: string | null;
  manualBankInstructions?: string | null;
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
  attachmentMimeType?: string | null;
  attachmentSizeBytes?: number | null;
  createdAt: Date;
  updatedAt: Date;
  paymentEvents?: Array<{
    id: string;
    eventType: string;
    paymentMethod: string | null;
    createdAt: Date;
    metadata?: Record<string, unknown> | null;
  }>;
  fxSnapshots?: Array<{
    id: string;
    snapshotType: string;
    tokenType: string | null;
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    provider: string;
    capturedAt: Date;
  }>;
  ledgerEntries?: Array<{
    id: string;
    entryType: string;
    amount: number;
    currency: string;
    description: string;
    createdAt: Date;
    ledgerAccount: {
      code: string;
      name: string;
    };
  }>;
  xeroSyncs?: Array<{
    id: string;
    syncType: string;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}

export interface PaymentLinkDetailDialogProps {
  paymentLink: PaymentLinkDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResend?: (paymentLink: PaymentLinkDetails) => void;
  /** After manual mark paid / reopen — refresh list and detail in parent */
  onManualSettlementComplete?: () => void | Promise<void>;
  /** Open shared edit-invoice flow (draft / open only). */
  onEdit?: (paymentLink: PaymentLinkDetails) => void;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'secondary';
    case 'OPEN':
      return 'default';
    case 'PAID_UNVERIFIED':
      return 'default';
    case 'REQUIRES_REVIEW':
      return 'destructive';
    case 'PAID':
      return 'success';
    case 'EXPIRED':
      return 'outline';
    case 'CANCELED':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getStatusDescription = (status: string): string => {
  switch (status) {
    case 'OPEN':
      return 'Awaiting payment';
    case 'PAID_UNVERIFIED':
      return 'Payment submitted - not yet verified';
    case 'REQUIRES_REVIEW':
      return 'Payment needs review (mismatch detected)';
    case 'PAID':
      return 'Payment confirmed';
    case 'CANCELED':
      return 'Invoice canceled';
    case 'EXPIRED':
      return 'Invoice expired';
    default:
      return '';
  }
};

export const PaymentLinkDetailDialog: React.FC<PaymentLinkDetailDialogProps> = ({
  paymentLink,
  open,
  onOpenChange,
  onResend,
  onManualSettlementComplete,
  onEdit,
}) => {
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null);
  const [confirmMarkPaidOpen, setConfirmMarkPaidOpen] = React.useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = React.useState(false);
  const [settlementLoading, setSettlementLoading] = React.useState(false);

  React.useEffect(() => {
    if (paymentLink && open) {
      // Load QR code
      fetch(`/api/payment-links/${paymentLink.id}/qr-code`)
        .then((res) => res.json())
        .then((data) => setQrCodeUrl(data.data.qrCode))
        .catch(console.error);
    }
  }, [paymentLink, open]);

  if (!paymentLink) return null;

  const payCode = paymentLink.shortCode?.trim() ?? '';
  const paymentUrl =
    typeof window !== 'undefined' && isValidShortCode(payCode)
      ? `${window.location.origin}/pay/${payCode}`
      : '';

  const handleCopyUrl = () => {
    if (!paymentUrl) {
      toast({
        title: 'Link unavailable',
        description: 'This invoice does not have a valid public pay code.',
        variant: 'destructive',
      });
      return;
    }
    navigator.clipboard.writeText(paymentUrl);
  };

  const handleOpenLink = () => {
    if (!paymentUrl) {
      toast({
        title: 'Link unavailable',
        description: 'This invoice does not have a valid public pay code.',
        variant: 'destructive',
      });
      return;
    }
    window.open(paymentUrl, '_blank');
  };

  const handleResend = () => {
    if (onResend && paymentLink) {
      onResend(paymentLink);
    }
  };

  const postManualSettlement = async (action: 'mark_paid' | 'reopen') => {
    if (!paymentLink) return;
    setSettlementLoading(true);
    try {
      const res = await fetch(`/api/payment-links/${paymentLink.id}/manual-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Could not update invoice');
      }
      toast({
        title: action === 'mark_paid' ? 'Payment recorded' : 'Invoice reopened',
        description:
          action === 'mark_paid'
            ? 'This invoice is now marked paid. Use reopen only if that was a mistake.'
            : 'Status set back to open. Customers can use the pay link again if still valid.',
      });
      setConfirmMarkPaidOpen(false);
      setConfirmReopenOpen(false);
      await onManualSettlementComplete?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Request failed';
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    } finally {
      setSettlementLoading(false);
    }
  };

  const canResend =
    paymentLink &&
    paymentLink.customerEmail &&
    paymentLink.status !== 'PAID' &&
    paymentLink.status !== 'PAID_UNVERIFIED' &&
    paymentLink.status !== 'REQUIRES_REVIEW' &&
    paymentLink.status !== 'CANCELED' &&
    paymentLink.status !== 'EXPIRED';

  const canEditInvoice =
    paymentLink &&
    onEdit &&
    (paymentLink.status === 'DRAFT' || paymentLink.status === 'OPEN');

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle>Payment Link Details</DialogTitle>
              <DialogDescription>
                {paymentLink.shortCode}
              </DialogDescription>
            </div>
            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
              {canEditInvoice ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onEdit?.(paymentLink)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              ) : null}
            <div className="flex flex-col items-end gap-1">
              <Badge variant={getStatusBadgeVariant(paymentLink.status) as any}>
                {paymentLink.status}
              </Badge>
              {getStatusDescription(paymentLink.status) ? (
                <p className="text-xs text-muted-foreground text-right">{getStatusDescription(paymentLink.status)}</p>
              ) : null}
              <div className="flex flex-wrap gap-1 justify-end">
                {paymentLink.invoiceOnlyMode ? (
                  <Badge variant="outline" className="text-xs">
                    Invoice only
                  </Badge>
                ) : null}
                {paymentLink.paymentMethod === 'CRYPTO' ? (
                  <Badge variant="outline" className="text-xs">
                    Manual crypto (any wallet)
                  </Badge>
                ) : null}
                {paymentLink.paymentMethod === 'MANUAL_BANK' ? (
                  <Badge variant="outline" className="text-xs">
                    Manual bank instructions
                  </Badge>
                ) : null}
                {paymentLink.paymentMethod === 'HEDERA' &&
                (paymentLink.hederaCheckoutMode ?? 'INTERACTIVE') === 'MANUAL' ? (
                  <Badge variant="outline" className="text-xs">
                    Hedera manual instructions
                  </Badge>
                ) : null}
              </div>
            </div>
            </div>
          </div>
        </DialogHeader>

        {paymentLink.status === 'PAID' ? (
          <p className="text-sm text-muted-foreground -mt-2 mb-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            This invoice is paid and cannot be edited. If you need a correction, create a new invoice or contact support.
          </p>
        ) : null}
        {paymentLink.status === 'PAID_UNVERIFIED' || paymentLink.status === 'REQUIRES_REVIEW' ? (
          <p className="text-sm text-muted-foreground -mt-2 mb-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            A payer submitted payment details; the invoice is recorded automatically. Use payment activity on the list
            page for follow-up. You can reopen here if this was a mistake.
          </p>
        ) : null}
        {(() => {
          const latestVerificationIssues =
            paymentLink.paymentEvents
              ?.filter((e) => e.metadata && typeof e.metadata === 'object')
              .flatMap((e) => {
                const md = e.metadata as Record<string, unknown>;
                const issues = md.verification_issues;
                return Array.isArray(issues) ? issues.filter((x): x is string => typeof x === 'string') : [];
              }) ?? [];
          if (latestVerificationIssues.length === 0) return null;
          return (
            <div className="text-sm -mt-1 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="font-medium text-amber-900">Verification issues</p>
              <ul className="list-disc pl-5 mt-1 text-amber-900/90 text-xs space-y-0.5">
                {latestVerificationIssues.slice(0, 5).map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          );
        })()}

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="fx">FX Rates</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="xero">Xero Sync</TabsTrigger>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <DollarSign className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Amount</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(
                          Number(paymentLink.amount),
                          paymentLink.currency
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <FileText className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Invoice Reference</p>
                      <p className="text-sm">
                        {paymentLink.invoiceReference || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">
                    {paymentLink.description}
                  </p>
                </div>

                {paymentLink.paymentMethod === 'CRYPTO' &&
                (paymentLink.cryptoNetwork ||
                  paymentLink.cryptoAddress ||
                  paymentLink.cryptoCurrency) ? (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Crypto payment instructions</p>
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        {paymentLink.cryptoNetwork ? (
                          <div>
                            <dt className="text-muted-foreground">Network</dt>
                            <dd className="break-all">{paymentLink.cryptoNetwork}</dd>
                          </div>
                        ) : null}
                        {paymentLink.cryptoCurrency ? (
                          <div>
                            <dt className="text-muted-foreground">Asset</dt>
                            <dd>{paymentLink.cryptoCurrency}</dd>
                          </div>
                        ) : null}
                        {paymentLink.cryptoAddress ? (
                          <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">Wallet address</dt>
                            <dd className="font-mono text-xs break-all">{paymentLink.cryptoAddress}</dd>
                          </div>
                        ) : null}
                        {paymentLink.cryptoMemo ? (
                          <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">Memo / tag</dt>
                            <dd className="break-all">{paymentLink.cryptoMemo}</dd>
                          </div>
                        ) : null}
                        {paymentLink.cryptoInstructions ? (
                          <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">Instructions</dt>
                            <dd className="whitespace-pre-wrap text-muted-foreground">
                              {paymentLink.cryptoInstructions}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </>
                ) : null}

                {paymentLink.paymentMethod === 'MANUAL_BANK' &&
                (paymentLink.manualBankRecipientName ||
                  paymentLink.manualBankCurrency ||
                  paymentLink.manualBankDestinationType) ? (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Manual bank transfer instructions</p>
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        {paymentLink.manualBankRecipientName ? (
                          <div>
                            <dt className="text-muted-foreground">Recipient</dt>
                            <dd>{paymentLink.manualBankRecipientName}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankDestinationType ? (
                          <div>
                            <dt className="text-muted-foreground">Destination type</dt>
                            <dd>{paymentLink.manualBankDestinationType}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankCurrency ? (
                          <div>
                            <dt className="text-muted-foreground">Transfer currency</dt>
                            <dd>{paymentLink.manualBankCurrency}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankBankName ? (
                          <div>
                            <dt className="text-muted-foreground">Bank name</dt>
                            <dd>{paymentLink.manualBankBankName}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankAccountNumber ? (
                          <div>
                            <dt className="text-muted-foreground">Account number</dt>
                            <dd className="font-mono text-xs break-all">{paymentLink.manualBankAccountNumber}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankIban ? (
                          <div>
                            <dt className="text-muted-foreground">IBAN</dt>
                            <dd className="font-mono text-xs break-all">{paymentLink.manualBankIban}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankSwiftBic ? (
                          <div>
                            <dt className="text-muted-foreground">SWIFT / BIC</dt>
                            <dd className="font-mono text-xs break-all">{paymentLink.manualBankSwiftBic}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankRoutingSortCode ? (
                          <div>
                            <dt className="text-muted-foreground">Routing / sort code</dt>
                            <dd className="font-mono text-xs break-all">{paymentLink.manualBankRoutingSortCode}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankWiseReference ? (
                          <div>
                            <dt className="text-muted-foreground">Wise reference</dt>
                            <dd className="break-all">{paymentLink.manualBankWiseReference}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankRevolutHandle ? (
                          <div>
                            <dt className="text-muted-foreground">Revolut handle</dt>
                            <dd className="break-all">{paymentLink.manualBankRevolutHandle}</dd>
                          </div>
                        ) : null}
                        {paymentLink.manualBankInstructions ? (
                          <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">Instructions</dt>
                            <dd className="whitespace-pre-wrap text-muted-foreground">
                              {paymentLink.manualBankInstructions}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </>
                ) : null}

                {paymentLink.attachmentUrl ? (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Payment instructions attachment</p>
                      <p className="text-xs text-muted-foreground">
                        Shown to customers on the public invoice link.
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={paymentLink.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {paymentLink.attachmentFilename?.trim() || 'Open attachment'}
                        </a>
                      </Button>
                    </div>
                  </>
                ) : null}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  {paymentLink.customerName ? (
                    <div className="flex items-start gap-2">
                      <User className="mt-1 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Customer name</p>
                        <p className="text-sm">{paymentLink.customerName}</p>
                      </div>
                    </div>
                  ) : null}

                  {paymentLink.customerEmail && (
                    <div className="flex items-start gap-2">
                      <Mail className="mt-1 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Customer Email</p>
                        <p className="text-sm">{paymentLink.customerEmail}</p>
                      </div>
                    </div>
                  )}

                  {paymentLink.customerPhone && (
                    <div className="flex items-start gap-2">
                      <Phone className="mt-1 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Customer Phone</p>
                        <p className="text-sm">{paymentLink.customerPhone}</p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  {paymentLink.invoiceDate ? (
                    <div className="flex items-start gap-2">
                      <Calendar className="mt-1 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Invoice date</p>
                        <p className="text-sm">{format(new Date(paymentLink.invoiceDate), 'PPpp')}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-2">
                    <Calendar className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-sm">
                        {format(new Date(paymentLink.createdAt), 'PPpp')}
                      </p>
                    </div>
                  </div>

                  {paymentLink.dueDate ? (
                    <div className="flex items-start gap-2">
                      <Calendar className="mt-1 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Due date</p>
                        <p className="text-sm">{format(new Date(paymentLink.dueDate), 'PPpp')}</p>
                      </div>
                    </div>
                  ) : null}

                  {paymentLink.expiresAt && (
                    <div className="flex items-start gap-2">
                      <Clock className="mt-1 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Expires</p>
                        <p className="text-sm">
                          {format(new Date(paymentLink.expiresAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
                    {paymentUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleOpenLink}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                {canResend && (
                  <Button 
                    size="sm" 
                    variant="default" 
                    onClick={handleResend}
                    className="w-full"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Resend Notification
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manual payment confirmation (pilot)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  For manual crypto/bank collection or invoice-only links, record payment here when funds have actually
                  been received. Reopen if you marked paid by mistake.
                </p>
                <div className="flex flex-wrap gap-2">
                  {paymentLink.status === 'OPEN' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={settlementLoading}
                      onClick={() => setConfirmMarkPaidOpen(true)}
                    >
                      Mark payment received
                    </Button>
                  ) : null}
                  {paymentLink.status === 'PAID' ||
                  paymentLink.status === 'PAID_UNVERIFIED' ||
                  paymentLink.status === 'REQUIRES_REVIEW' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={settlementLoading}
                      onClick={() => setConfirmReopenOpen(true)}
                    >
                      Reopen invoice
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FX Rates Tab */}
          <TabsContent value="fx" className="space-y-4">
            {(() => {
              const creationSnapshots = paymentLink.fxSnapshots?.filter(
                (s) => s.snapshotType === 'CREATION'
              ) || [];
              const settlementSnapshots = paymentLink.fxSnapshots?.filter(
                (s) => s.snapshotType === 'SETTLEMENT'
              ) || [];

              if (creationSnapshots.length === 0 && settlementSnapshots.length === 0) {
                return (
                  <div className="text-center py-8">
                    <ArrowRightLeft className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No FX snapshots captured yet
                    </p>
                    {process.env.NODE_ENV !== 'production' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        (Dev: Snapshots are created when payment link is created)
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <>
                  {creationSnapshots.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Creation Rates
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-3 py-2 text-left font-medium">Token</th>
                                <th className="px-3 py-2 text-left font-medium">Rate</th>
                                <th className="px-3 py-2 text-left font-medium">Provider</th>
                                <th className="px-3 py-2 text-left font-medium">Captured</th>
                              </tr>
                            </thead>
                            <tbody>
                              {creationSnapshots.map((snapshot) => (
                                <tr key={snapshot.id} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-medium">
                                    {snapshot.tokenType || snapshot.baseCurrency}
                                  </td>
                                  <td className="px-3 py-2 font-mono">
                                    1 {snapshot.baseCurrency} = {snapshot.rate.toFixed(8)} {snapshot.quoteCurrency}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {snapshot.provider}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {format(new Date(snapshot.capturedAt), 'PPp')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {settlementSnapshots.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Settlement Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-3 py-2 text-left font-medium">Token</th>
                                <th className="px-3 py-2 text-left font-medium">Rate</th>
                                <th className="px-3 py-2 text-left font-medium">Provider</th>
                                <th className="px-3 py-2 text-left font-medium">Settled</th>
                              </tr>
                            </thead>
                            <tbody>
                              {settlementSnapshots.map((snapshot) => (
                                <tr key={snapshot.id} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-medium">
                                    <Badge variant="success">
                                      {snapshot.tokenType || snapshot.baseCurrency}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 font-mono">
                                    1 {snapshot.baseCurrency} = {snapshot.rate.toFixed(8)} {snapshot.quoteCurrency}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {snapshot.provider}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {format(new Date(snapshot.capturedAt), 'PPp')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-2">
            {paymentLink.paymentEvents && paymentLink.paymentEvents.length > 0 ? (
              paymentLink.paymentEvents.map((event) => (
                <Card key={event.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{event.eventType}</p>
                        {event.paymentMethod && (
                          <p className="text-xs text-muted-foreground">
                            via {event.paymentMethod}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.createdAt), 'PPp')}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">
                No events recorded yet
              </p>
            )}
          </TabsContent>

          {/* Ledger Tab */}
          <TabsContent value="ledger" className="space-y-2">
            {paymentLink.ledgerEntries && paymentLink.ledgerEntries.length > 0 ? (
              paymentLink.ledgerEntries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {entry.ledgerAccount.name} ({entry.ledgerAccount.code})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        entry.entryType === 'DEBIT' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {entry.entryType === 'DEBIT' ? 'DR' : 'CR'}{' '}
                        {formatCurrency(Number(entry.amount), entry.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.createdAt), 'PPp')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">
                No ledger entries yet
              </p>
            )}
          </TabsContent>

          {/* Xero Sync Tab */}
          <TabsContent value="xero" className="space-y-2">
            {paymentLink.xeroSyncs && paymentLink.xeroSyncs.length > 0 ? (
              paymentLink.xeroSyncs.map((sync) => (
                <Card key={sync.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{sync.syncType}</p>
                          <Badge
                            variant={
                              sync.status === 'SUCCESS'
                                ? 'success'
                                : sync.status === 'FAILED'
                                ? 'destructive'
                                : sync.status === 'RETRYING'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {sync.status}
                          </Badge>
                        </div>
                        {sync.errorMessage && (
                          <p className="text-xs text-destructive mt-1">
                            {sync.errorMessage}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(sync.createdAt), 'PPp')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-2">
                  No Xero sync records
                </p>
                <p className="text-xs text-muted-foreground">
                  Sync records will appear here once the payment is processed
                </p>
              </div>
            )}
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="flex flex-col items-center space-y-4">
            {qrCodeUrl ? (
              <>
                <img
                  src={qrCodeUrl}
                  alt="Payment QR Code"
                  className="w-64 h-64 border rounded-md"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code to access the payment link
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-sm text-muted-foreground">Loading QR code...</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmMarkPaidOpen} onOpenChange={setConfirmMarkPaidOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark payment received?</AlertDialogTitle>
          <AlertDialogDescription>
            Only confirm after payment has actually cleared (manual transfer, external card, etc.). This does not
            process a new charge in Provvypay.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={settlementLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={settlementLoading}
            onClick={(e) => {
              e.preventDefault();
              void postManualSettlement('mark_paid');
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
            Status will return to open so the pay link can be used again (if not expired or canceled). Use this if paid
            status was set incorrectly.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={settlementLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={settlementLoading}
            onClick={(e) => {
              e.preventDefault();
              void postManualSettlement('reopen');
            }}
          >
            Reopen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};


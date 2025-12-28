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

export interface PaymentLinkDetails {
  id: string;
  shortCode: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
  amount: number;
  currency: string;
  description: string;
  invoiceReference: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  paymentEvents?: Array<{
    id: string;
    eventType: string;
    paymentMethod: string | null;
    createdAt: Date;
  }>;
  fxSnapshots?: Array<{
    id: string;
    snapshotType: string;
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
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
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'secondary';
    case 'OPEN':
      return 'default';
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

export const PaymentLinkDetailDialog: React.FC<PaymentLinkDetailDialogProps> = ({
  paymentLink,
  open,
  onOpenChange,
  onResend,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null);

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

  const paymentUrl = `${window.location.origin}/pay/${paymentLink.shortCode}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(paymentUrl);
  };

  const handleOpenLink = () => {
    window.open(paymentUrl, '_blank');
  };

  const handleResend = () => {
    if (onResend && paymentLink) {
      onResend(paymentLink);
    }
  };

  const canResend = paymentLink && 
    paymentLink.customerEmail && 
    paymentLink.status !== 'PAID' && 
    paymentLink.status !== 'CANCELED' && 
    paymentLink.status !== 'EXPIRED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Payment Link Details</DialogTitle>
              <DialogDescription>
                {paymentLink.shortCode}
              </DialogDescription>
            </div>
            <Badge variant={getStatusBadgeVariant(paymentLink.status) as any}>
              {paymentLink.status}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
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

                <Separator />

                <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-sm">
                        {format(new Date(paymentLink.createdAt), 'PPpp')}
                      </p>
                    </div>
                  </div>

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
  );
};


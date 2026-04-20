/**
 * Public invoice-only view: share amount, description, due date — no checkout UI.
 */

'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PaymentAmountDisplay } from '@/components/public/payment-amount-display';
import { MerchantBranding } from '@/components/public/merchant-branding';
import { PublicPaymentLinkAttachment } from '@/components/public/public-payment-link-attachment';

export interface InvoiceOnlyPageContentProps {
  paymentLink: {
    shortCode: string;
    amount: string;
    currency: string;
    description: string;
    invoiceReference: string | null;
    invoiceDate?: string | null;
    customerName: string | null;
    dueDate: string | null;
    expiresAt: string | null;
    merchant: {
      name: string;
      logoUrl: string | null;
    };
    attachmentUrl?: string | null;
    attachmentFilename?: string | null;
    attachmentMimeType?: string | null;
  };
}

export function InvoiceOnlyPageContent({ paymentLink }: InvoiceOnlyPageContentProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl">
        <Card className="border-0 shadow-xl">
          <CardHeader className="border-b bg-slate-50/50 pb-6">
            <MerchantBranding
              merchantName={paymentLink.merchant.name}
              logoUrl={paymentLink.merchant.logoUrl}
            />
          </CardHeader>
          <CardContent className="pt-8 pb-8 space-y-6">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 mb-1">Invoice</h1>
              <p className="text-sm text-slate-600">
                This page is for your records. No online payment is collected here unless your
                merchant contacts you with other instructions.
              </p>
            </div>
            <PaymentAmountDisplay
              amount={paymentLink.amount}
              currency={paymentLink.currency}
              description={paymentLink.description}
              invoiceReference={paymentLink.invoiceReference}
              invoiceDate={paymentLink.invoiceDate}
              dueDate={paymentLink.dueDate}
            />
            {paymentLink.attachmentUrl ? (
              <PublicPaymentLinkAttachment
                payShortCode={paymentLink.shortCode}
                attachmentUrl={paymentLink.attachmentUrl}
                attachmentFilename={paymentLink.attachmentFilename}
                attachmentMimeType={paymentLink.attachmentMimeType}
              />
            ) : null}
            {paymentLink.customerName ? (
              <p className="text-sm text-slate-700">
                <span className="font-medium">Bill to:</span> {paymentLink.customerName}
              </p>
            ) : null}
          </CardContent>
        </Card>
        {paymentLink.expiresAt ? (
          <p className="mt-6 text-center text-xs text-slate-400">
            This link expires on{' '}
            {new Date(paymentLink.expiresAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        ) : null}
        <p className="mt-4 text-center text-xs text-slate-500">
          Powered by <span className="font-semibold">Provvypay</span>
        </p>
      </div>
    </div>
  );
}

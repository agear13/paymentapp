import 'server-only';

import { sendEmail } from '@/lib/email/client';

type SendInvoiceEmailArgs = {
  toEmail: string;
  invoice: {
    id: string;
    shortCode: string;
    amount: number;
    currency: string;
    description: string;
    invoiceReference?: string | null;
  };
  paymentUrl: string;
  merchantName: string;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export async function sendInvoiceEmail({
  toEmail,
  invoice,
  paymentUrl,
  merchantName,
}: SendInvoiceEmailArgs): Promise<{ success: boolean; error?: string; providerMessageId?: string }> {
  const safeMerchant = escapeHtml(merchantName || 'Provvypay');
  const safeDescription = escapeHtml(invoice.description || 'Invoice payment');
  const safeRef = invoice.invoiceReference ? escapeHtml(invoice.invoiceReference) : null;
  const amountLabel = formatAmount(invoice.amount, invoice.currency);

  const subject = `Invoice from ${merchantName}: ${amountLabel}`;
  const text = [
    `You have received an invoice from ${merchantName}.`,
    ``,
    `Amount: ${amountLabel}`,
    `Description: ${invoice.description}`,
    safeRef ? `Reference: ${invoice.invoiceReference}` : null,
    ``,
    `Pay now: ${paymentUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px">
      <p>You have received an invoice from <strong>${safeMerchant}</strong>.</p>
      <p style="margin:0 0 6px 0"><strong>Amount:</strong> ${escapeHtml(amountLabel)}</p>
      <p style="margin:0 0 6px 0"><strong>Description:</strong> ${safeDescription}</p>
      ${safeRef ? `<p style="margin:0 0 12px 0"><strong>Reference:</strong> ${safeRef}</p>` : ''}
      <p style="margin:16px 0">
        <a href="${paymentUrl}" style="background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">
          Pay Now
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">If the button does not work, copy this link:<br/>${escapeHtml(paymentUrl)}</p>
    </div>
  `;

  const response = await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    tags: [
      { name: 'type', value: 'invoice' },
      { name: 'invoice_id', value: invoice.id },
      { name: 'payment_link', value: invoice.shortCode },
    ],
  });

  if (!response.success) {
    return { success: false, error: response.error || 'Email delivery failed' };
  }
  return { success: true, providerMessageId: response.id };
}


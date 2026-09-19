import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type { GuestInvoiceDraft } from '@/lib/invoices/guest-invoice-draft';
import { guestInvoiceNumber } from '@/lib/invoices/guest-invoice-draft';

function pdfEscape(value: string): string {
  return asciiSafe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function asciiSafe(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapText(value: string, width: number): string[] {
  const words = asciiSafe(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export type GuestInvoicePdfInput = {
  draft: GuestInvoiceDraft;
  taxNote?: string | null;
};

export function guestInvoicePdfFilename(draft: GuestInvoiceDraft): string {
  return `${guestInvoiceNumber(draft).replace(/[^\w.-]+/g, '-')}.pdf`;
}

/**
 * Minimal single-page PDF for the free invoice download.
 * No account, no server persistence — generated from the current draft.
 */
export function buildGuestInvoicePdfBytes(input: GuestInvoicePdfInput): Uint8Array {
  const { draft, taxNote } = input;
  const number = guestInvoiceNumber(draft);
  const amountLabel =
    typeof draft.amount === 'number' && draft.amount > 0
      ? formatCurrency(draft.amount, draft.currency)
      : '—';
  const from = draft.fromBusinessName.trim() || 'Your business';
  const customer = draft.customerName.trim() || draft.customerEmail.trim() || 'Customer';

  const lines: Array<{ text: string; size?: number; gap?: number }> = [
    { text: 'INVOICE', size: 22, gap: 18 },
    { text: from, size: 12, gap: 14 },
  ];
  if (draft.fromBusinessEmail.trim()) {
    lines.push({ text: draft.fromBusinessEmail.trim(), size: 10, gap: 16 });
  } else {
    lines.push({ text: ' ', size: 10, gap: 8 });
  }
  lines.push({ text: `Invoice ${number}`, size: 11, gap: 14 });
  lines.push({
    text: `Issue date  ${format(draft.invoiceDate, 'd MMM yyyy')}`,
    size: 10,
    gap: 13,
  });
  if (draft.dueDate) {
    lines.push({ text: `Due date  ${format(draft.dueDate, 'd MMM yyyy')}`, size: 10, gap: 18 });
  }
  lines.push({ text: `Bill to  ${customer}`, size: 11, gap: 14 });
  if (draft.customerEmail.trim() && draft.customerName.trim()) {
    lines.push({ text: draft.customerEmail.trim(), size: 10, gap: 16 });
  }
  lines.push({ text: 'Description', size: 9, gap: 13 });
  for (const wrapped of wrapText(draft.description.trim() || '—', 78)) {
    lines.push({ text: wrapped, size: 11, gap: 14 });
  }
  lines.push({ text: `Total  ${amountLabel}`, size: 14, gap: 20 });
  if (taxNote?.trim()) {
    lines.push({ text: `Tax  ${taxNote.trim()}`, size: 10, gap: 14 });
  }
  if (draft.paymentTermsNote.trim()) {
    lines.push({ text: 'Payment terms', size: 9, gap: 13 });
    for (const wrapped of wrapText(draft.paymentTermsNote.trim(), 78)) {
      lines.push({ text: wrapped, size: 10, gap: 13 });
    }
  }
  lines.push({ text: 'Created with Provvy free invoice generator', size: 8, gap: 12 });

  let y = 800;
  const ops: string[] = ['BT'];
  for (const line of lines) {
    ops.push(`/F1 ${line.size ?? 11} Tf`);
    ops.push(`50 ${y} Td`);
    ops.push(`(${pdfEscape(line.text)}) Tj`);
    ops.push(`${-(line.gap ?? 14)} TL`);
    ops.push('T*');
    y -= line.gap ?? 14;
  }
  ops.push('ET');
  const stream = ops.join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }
  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdf = `${body}${xref}${trailer}`;
  return new TextEncoder().encode(pdf);
}

export function downloadGuestInvoicePdf(input: GuestInvoicePdfInput): void {
  const bytes = buildGuestInvoicePdfBytes(input);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = guestInvoicePdfFilename(input.draft);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

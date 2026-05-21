import { prisma } from '@/lib/server/prisma';
import { buildReconciliationReport } from '@/lib/reports/reconciliation-report.server';
import { RECONCILIATION_RAIL_LABELS } from '@/lib/reports/reconciliation-display';
import type { ReconciliationRailKey } from '@/lib/reports/reconciliation-types';
import { formatReportDateTime } from '@/lib/format/format-report-datetime';

function escapeCsv(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}

export async function buildPaymentsExportCsv(
  organizationId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<string> {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const payments = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      ...(Object.keys(dateFilter).length > 0 && { created_at: dateFilter }),
    },
    include: {
      payment_events: {
        where: { event_type: 'PAYMENT_CONFIRMED' },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const headers = [
    'Date',
    'Short Code',
    'Status',
    'Amount',
    'Currency',
    'Payment Method',
    'Token Type',
    'Description',
    'Invoice Reference',
    'Customer Email',
  ];

  const rows = payments.map((payment) => {
    const paymentEvent = payment.payment_events[0];
    const method = paymentEvent?.payment_method || 'N/A';
    let tokenType = 'N/A';
    if (method === 'HEDERA' && paymentEvent) {
      const metadata = paymentEvent.metadata as Record<string, unknown> | null;
      tokenType = String(metadata?.tokenType ?? metadata?.token_type ?? 'N/A');
    } else if (method === 'STRIPE') {
      tokenType = 'STRIPE';
    } else if (method === 'WISE') {
      tokenType = 'WISE';
    }

    return [
      formatReportDateTime(payment.created_at),
      payment.short_code,
      payment.status,
      payment.amount.toString(),
      payment.currency,
      method,
      tokenType,
      payment.description,
      payment.invoice_reference || '',
      payment.customer_email || '',
    ];
  });

  return toCsv(headers, rows);
}

export async function buildReconciliationExportCsv(
  organizationId: string
): Promise<string> {
  const data = await buildReconciliationReport(organizationId);
  const headers = [
    'Payment Method',
    'Expected Revenue',
    'Ledger Balance',
    'Difference',
    'Payment Count',
    'Status',
  ];

  const rows = (Object.keys(data.report) as ReconciliationRailKey[]).map((key) => {
    const item = data.report[key];
    const balanced = Math.abs(item.difference) < 0.01;
    return [
      RECONCILIATION_RAIL_LABELS[key],
      item.expectedRevenue.toFixed(2),
      item.ledgerBalance.toFixed(2),
      item.difference.toFixed(2),
      item.paymentCount,
      balanced ? 'Balanced' : 'Discrepancy',
    ];
  });

  rows.push([
    'Generated',
    formatReportDateTime(data.timestamp),
    '',
    '',
    '',
    '',
  ]);

  return toCsv(headers, rows);
}

export async function buildLedgerExportCsv(organizationId: string): Promise<string> {
  const entries = await prisma.ledger_entries.findMany({
    where: {
      payment_links: { organization_id: organizationId },
    },
    include: {
      ledger_accounts: { select: { code: true, name: true } },
      payment_links: {
        select: { short_code: true, invoice_reference: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 5000,
  });

  const headers = [
    'Date',
    'Account Code',
    'Account Name',
    'Entry Type',
    'Amount',
    'Currency',
    'Description',
    'Payment Link',
    'Invoice Reference',
  ];

  const rows = entries.map((entry) => [
    formatReportDateTime(entry.created_at),
    entry.ledger_accounts.code,
    entry.ledger_accounts.name,
    entry.entry_type,
    entry.amount.toString(),
    entry.currency,
    entry.description,
    entry.payment_links.short_code,
    entry.payment_links.invoice_reference || '',
  ]);

  return toCsv(headers, rows);
}

export async function buildObligationsExportCsv(organizationId: string): Promise<string> {
  const obligations = await prisma.commission_obligations.findMany({
    where: {
      payment_links: { organization_id: organizationId },
    },
    include: {
      payment_links: { select: { short_code: true, invoice_reference: true } },
      referral_links: { select: { code: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 5000,
  });

  const headers = [
    'Created',
    'Status',
    'Consultant Amount',
    'BD Partner Amount',
    'Currency',
    'Referral Code',
    'Payment Link',
    'Invoice Reference',
  ];

  const rows = obligations.map((o) => [
    formatReportDateTime(o.created_at),
    o.status,
    o.consultant_amount.toString(),
    o.bd_partner_amount.toString(),
    o.currency,
    o.referral_links.code,
    o.payment_links.short_code,
    o.payment_links.invoice_reference || '',
  ]);

  return toCsv(headers, rows);
}

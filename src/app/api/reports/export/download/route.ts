import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  buildLedgerExportCsv,
  buildObligationsExportCsv,
  buildPaymentsExportCsv,
  buildReconciliationExportCsv,
} from '@/lib/reports/reports-export.server';

const EXPORT_TYPES = [
  'payments',
  'revenue-summary',
  'reconciliation',
  'ledger',
  'obligations',
  'commissions',
  'settlements',
  'tax-summary',
] as const;

type ExportType = (typeof EXPORT_TYPES)[number];

/**
 * GET /api/reports/export/download?organizationId=&type=&startDate=&endDate=
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type') as ExportType | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!organizationId || !type) {
      return NextResponse.json(
        { error: 'organizationId and type are required' },
        { status: 400 }
      );
    }

    if (!EXPORT_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    let csv: string;
    let filename: string;

    switch (type) {
      case 'payments':
      case 'revenue-summary':
      case 'tax-summary':
        csv = await buildPaymentsExportCsv(organizationId, startDate, endDate);
        filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      case 'reconciliation':
        csv = await buildReconciliationExportCsv(organizationId);
        filename = `reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      case 'ledger':
        csv = await buildLedgerExportCsv(organizationId);
        filename = `ledger-extract-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      case 'obligations':
      case 'commissions':
        csv = await buildObligationsExportCsv(organizationId);
        filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      case 'settlements':
        csv = await buildPaymentsExportCsv(organizationId, startDate, endDate);
        filename = `settlements-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      default:
        return NextResponse.json({ error: 'Unsupported export type' }, { status: 400 });
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error('[Export Download]', error);
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}

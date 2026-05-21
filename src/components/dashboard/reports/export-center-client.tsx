'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  History,
} from 'lucide-react';
import { formatReportDateTime } from '@/lib/format/format-report-datetime';
import {
  loadRecentExports,
  saveRecentExport,
  type RecentExportRecord,
} from '@/lib/reports/recent-exports';
import { CREATE_INVOICE_HREF } from '@/lib/navigation/payment-routes';
import { cn } from '@/lib/utils';

type ExportFormat = 'csv' | 'pdf';
type ExportStatus = 'idle' | 'generating' | 'ready' | 'failed' | 'downloaded';

type ExportDefinition = {
  id: string;
  title: string;
  description: string;
  type: string;
  formats: ExportFormat[];
};

const EXPORT_DEFINITIONS: ExportDefinition[] = [
  {
    id: 'revenue',
    title: 'Revenue summary',
    description: 'Paid invoices and revenue totals for the selected period.',
    type: 'revenue-summary',
    formats: ['csv'],
  },
  {
    id: 'ledger',
    title: 'Ledger extract',
    description: 'Double-entry ledger lines with account codes and payment references.',
    type: 'ledger',
    formats: ['csv'],
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation report',
    description: 'Expected revenue vs clearing balances by payment method.',
    type: 'reconciliation',
    formats: ['csv'],
  },
  {
    id: 'settlements',
    title: 'Settlement report',
    description: 'Confirmed payments suitable for settlement reconciliation.',
    type: 'settlements',
    formats: ['csv'],
  },
  {
    id: 'tax',
    title: 'Tax summary',
    description: 'Payment-level export for tax and BAS preparation workflows.',
    type: 'tax-summary',
    formats: ['csv'],
  },
  {
    id: 'commissions',
    title: 'Commission allocations',
    description: 'Commission obligations and allocation status.',
    type: 'commissions',
    formats: ['csv'],
  },
  {
    id: 'obligations',
    title: 'Payout obligations',
    description: 'Outstanding and paid payout obligations.',
    type: 'obligations',
    formats: ['csv'],
  },
];

interface ExportCenterClientProps {
  organizationId: string;
}

export function ExportCenterClient({ organizationId }: ExportCenterClientProps) {
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [statusById, setStatusById] = useState<Record<string, ExportStatus>>({});
  const [formatById, setFormatById] = useState<Record<string, ExportFormat>>({});
  const [generatedAtById, setGeneratedAtById] = useState<Record<string, string>>({});
  const [recentExports, setRecentExports] = useState<RecentExportRecord[]>([]);

  useEffect(() => {
    setRecentExports(loadRecentExports());
  }, []);

  const { startDate, endDate } = useMemo(() => {
    if (dateRange === 'custom' && customStart && customEnd) {
      return {
        startDate: new Date(customStart).toISOString(),
        endDate: new Date(customEnd).toISOString(),
      };
    }
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [dateRange, customStart, customEnd]);

  const runExport = async (def: ExportDefinition, fromRecent = false) => {
    const format = formatById[def.id] ?? def.formats[0];
    if (format === 'pdf') {
      setStatusById((s) => ({ ...s, [def.id]: 'failed' }));
      return;
    }

    setStatusById((s) => ({ ...s, [def.id]: 'generating' }));
    try {
      const params = new URLSearchParams({
        organizationId,
        type: def.type,
      });
      if (def.type !== 'reconciliation' && def.type !== 'ledger') {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }

      const response = await fetch(`/api/reports/export/download?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `${def.type}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const generatedAt = new Date().toISOString();
      setGeneratedAtById((g) => ({ ...g, [def.id]: generatedAt }));
      setStatusById((s) => ({ ...s, [def.id]: 'downloaded' }));

      const updated = saveRecentExport({
        name: def.title,
        type: def.type,
        format,
        generatedAt,
        status: 'ready',
      });
      setRecentExports(updated);

      setTimeout(() => {
        setStatusById((s) => ({ ...s, [def.id]: 'ready' }));
      }, 3000);
    } catch {
      setStatusById((s) => ({ ...s, [def.id]: 'failed' }));
      if (!fromRecent) {
        saveRecentExport({
          name: def.title,
          type: def.type,
          format,
          generatedAt: new Date().toISOString(),
          status: 'failed',
        });
        setRecentExports(loadRecentExports());
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Center</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Download audit-ready reports for accounting, reconciliation, and operational review.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Export period</CardTitle>
          <CardDescription>Applies to payment-based exports. Ledger and reconciliation use full history.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {dateRange === 'custom' ? (
            <>
              <input
                type="date"
                className="border rounded-md px-2 py-1.5 text-sm"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Start date"
              />
              <input
                type="date"
                className="border rounded-md px-2 py-1.5 text-sm"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="End date"
              />
            </>
          ) : null}
          <p className="text-xs text-muted-foreground w-full">
            Period: {formatReportDateTime(startDate)} – {formatReportDateTime(endDate)}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {EXPORT_DEFINITIONS.map((def) => {
          const status = statusById[def.id] ?? 'idle';
          const format = formatById[def.id] ?? 'csv';
          const generatedAt = generatedAtById[def.id];

          return (
            <Card key={def.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4" />
                  {def.title}
                </CardTitle>
                <CardDescription>{def.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Export type: <span className="font-mono">{def.type}</span>
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select
                    value={format}
                    onValueChange={(v) =>
                      setFormatById((f) => ({ ...f, [def.id]: v as ExportFormat }))
                    }
                  >
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                  <ExportStatusBadge status={status} />
                </div>
                {generatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Last generated: {formatReportDateTime(generatedAt)}
                  </p>
                ) : null}
                <Button
                  size="sm"
                  disabled={status === 'generating'}
                  onClick={() => void runExport(def)}
                >
                  {status === 'generating' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Recent exports
          </CardTitle>
          <CardDescription>
            Downloads from this browser session are listed here. Server-side async exports will
            appear in this list in a future release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentExports.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center text-sm">
              <p className="font-medium">No exports generated yet</p>
              <p className="mt-1 text-muted-foreground">
                Choose an export above to download your first report.
              </p>
              <Button className="mt-4" variant="secondary" size="sm" asChild>
                <Link href={CREATE_INVOICE_HREF}>Create invoice</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {recentExports.map((record) => {
                const def = EXPORT_DEFINITIONS.find((d) => d.type === record.type);
                return (
                  <li
                    key={record.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{record.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatReportDateTime(record.generatedAt)} · {record.format.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ExportStatusBadge
                        status={record.status === 'ready' ? 'ready' : 'failed'}
                      />
                      {def ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void runExport(def, true)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download again
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExportStatusBadge({ status }: { status: ExportStatus | 'ready' | 'failed' }) {
  if (status === 'idle') return null;

  const config: Record<string, { label: string; className: string; Icon: typeof Loader2 }> = {
    generating: { label: 'Generating…', className: 'text-muted-foreground', Icon: Loader2 },
    ready: { label: 'Ready', className: 'text-emerald-700', Icon: CheckCircle2 },
    failed: { label: 'Failed', className: 'text-destructive', Icon: AlertCircle },
    downloaded: { label: 'Downloaded', className: 'text-emerald-700', Icon: CheckCircle2 },
  };

  const entry = config[status];
  if (!entry) return null;
  const { label, className, Icon } = entry;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'generating' && 'animate-spin')} />
      {label}
    </span>
  );
}

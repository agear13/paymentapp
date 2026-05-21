'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatReportDateTime } from '@/lib/format/format-report-datetime';
import { formatCurrency } from '@/lib/formatters/format-currency';
import {
  RECONCILIATION_RAIL_LABELS,
  getTotalReconciledVolume,
  isReconciliationBalanced,
} from '@/lib/reports/reconciliation-display';
import type {
  ReconciliationRailKey,
  ReconciliationReportData,
} from '@/lib/reports/reconciliation-types';

interface ReconciliationReportProps {
  organizationId: string;
}

const RAIL_ORDER: ReconciliationRailKey[] = [
  'stripe',
  'wise',
  'hedera_hbar',
  'hedera_usdc',
  'hedera_usdt',
  'hedera_audd',
];

export function ReconciliationReport({ organizationId }: ReconciliationReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReconciliationReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/reports/reconciliation?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error('Failed to fetch reconciliation report');
      setData((await response.json()) as ReconciliationReportData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card id="reconciliation-report">
        <CardHeader>
          <CardTitle>Reconciliation report</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card id="reconciliation-report">
        <CardHeader>
          <CardTitle>Reconciliation report</CardTitle>
          <CardDescription>Compare expected revenue with ledger clearing balances.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800">{error ?? 'Reconciliation data unavailable.'}</p>
        </CardContent>
      </Card>
    );
  }

  const reconciledVolume = getTotalReconciledVolume(data.report);

  return (
    <Card id="reconciliation-report">
      <CardHeader>
        <CardTitle>Reconciliation report</CardTitle>
        <CardDescription>
          Compare expected revenue with ledger clearing balances by payment rail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.isReconciled ? (
            <Alert className="border-emerald-200 bg-emerald-50/80">
              <CheckCircle className="h-4 w-4 text-emerald-700" />
              <AlertTitle className="text-emerald-900">All accounts reconciled</AlertTitle>
              <AlertDescription className="text-emerald-800">
                Clearing balances match expected revenue. Total reconciled volume:{' '}
                {formatCurrency(reconciledVolume, 'AUD')}.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Discrepancy detected</AlertTitle>
              <AlertDescription>
                Total difference {formatCurrency(data.totalDifference, 'AUD')}. Review clearing
                accounts below before settlement release.
              </AlertDescription>
            </Alert>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment method</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Ledger balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RAIL_ORDER.map((key) => {
                const item = data.report[key];
                const balanced = isReconciliationBalanced(item.difference);
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      {RECONCILIATION_RAIL_LABELS[key]}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.expectedRevenue, 'AUD')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.ledgerBalance, 'AUD')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={
                          balanced ? 'text-muted-foreground' : 'text-destructive font-semibold'
                        }
                      >
                        {formatCurrency(Math.abs(item.difference), 'AUD')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{item.paymentCount}</TableCell>
                    <TableCell className="text-right">
                      {balanced ? (
                        <Badge variant="outline" className="gap-1 border-emerald-400 text-emerald-800">
                          <CheckCircle className="h-3 w-3" />
                          Balanced
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Off by {formatCurrency(Math.abs(item.difference), 'AUD')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <p className="text-xs text-muted-foreground text-right">
            Last updated: {formatReportDateTime(data.timestamp)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

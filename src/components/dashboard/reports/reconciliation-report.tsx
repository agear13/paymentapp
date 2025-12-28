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

interface ReconciliationItem {
  expectedRevenue: number;
  ledgerBalance: number;
  difference: number;
  paymentCount: number;
}

interface ReconciliationData {
  report: {
    stripe: ReconciliationItem;
    hedera_hbar: ReconciliationItem;
    hedera_usdc: ReconciliationItem;
    hedera_usdt: ReconciliationItem;
    hedera_audd: ReconciliationItem;
  };
  isReconciled: boolean;
  totalDifference: number;
  timestamp: string;
}

interface ReconciliationReportProps {
  organizationId: string;
}

export function ReconciliationReport({ organizationId }: ReconciliationReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports/reconciliation?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error('Failed to fetch reconciliation report');

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Report</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Report</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: 'Stripe', data: data.report.stripe },
    { label: 'Hedera - HBAR', data: data.report.hedera_hbar },
    { label: 'Hedera - USDC', data: data.report.hedera_usdc },
    { label: 'Hedera - USDT', data: data.report.hedera_usdt },
    { label: 'Hedera - AUDD', data: data.report.hedera_audd },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation Report</CardTitle>
        <CardDescription>
          Compare expected revenue with ledger balances
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Alert */}
          {data.isReconciled ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Reconciled</AlertTitle>
              <AlertDescription>
                All accounts are balanced. No discrepancies detected.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Discrepancy Detected</AlertTitle>
              <AlertDescription>
                Total difference: ${data.totalDifference.toFixed(2)}. Please review
                the details below.
              </AlertDescription>
            </Alert>
          )}

          {/* Reconciliation Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Ledger Balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(({ label, data: item }) => {
                const isBalanced = Math.abs(item.difference) < 0.01;
                return (
                  <TableRow key={label}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-right font-mono">
                      ${item.expectedRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${item.ledgerBalance.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={
                          isBalanced
                            ? 'text-muted-foreground'
                            : 'text-destructive font-semibold'
                        }
                      >
                        ${Math.abs(item.difference).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {isBalanced ? (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Balanced
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Off by ${Math.abs(item.difference).toFixed(2)}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Timestamp */}
          <div className="text-xs text-muted-foreground text-right">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}








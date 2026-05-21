'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Download, ChevronRight } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { PAYOUTS_SETTLEMENTS_HREF } from '@/lib/navigation/operator-nav';
interface Batch {
  id: string;
  currency: string;
  status: string;
  payoutCount: number;
  totalAmount: number;
  createdAt: string;
}

export function OperatorSettlementsWorkspace() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const { currency: orgCurrency } = useOrganizationCurrency();
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createCurrency, setCreateCurrency] = React.useState(orgCurrency);
  const [createThreshold, setCreateThreshold] = React.useState('50');

  React.useEffect(() => {
    setCreateCurrency(orgCurrency);
  }, [orgCurrency]);

  const batchDetailHref = (id: string) => `${PAYOUTS_SETTLEMENTS_HREF}/${id}`;

  const fetchBatches = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payout-batches?organizationId=${organizationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setBatches(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load settlement history');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void fetchBatches();
  }, [fetchBatches]);

  const handleCreateBatch = async () => {
    if (!organizationId) return;
    const threshold = parseFloat(createThreshold);
    if (isNaN(threshold) || threshold < 0) {
      toast.error('Enter a valid minimum threshold');
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/payout-batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          currency: createCurrency,
          minThreshold: threshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to create batch');
      toast.success('Release batch created');
      setCreateOpen(false);
      void fetchBatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create batch');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExport = (batchId: string) => {
    if (!organizationId) return;
    window.open(`/api/payout-batches/${batchId}/export`, '_blank', 'noopener');
  };

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Settlement history</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Settlement history</h1>
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settlement history</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Review release batches, settlement dates, and payout status — your record of completed
            participant releases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void fetchBatches()}
                  disabled={loading}
                  aria-label="Refresh settlement history"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh settlement history</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create release batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create release batch</DialogTitle>
                <DialogDescription>
                  Bundle payout-ready obligations into a release batch for review and disbursement.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={createCurrency} onValueChange={setCreateCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="threshold">Minimum threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="0"
                    step="1"
                    value={createThreshold}
                    onChange={(e) => setCreateThreshold(e.target.value)}
                    placeholder="50"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Only include payees at or above this balance
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void handleCreateBatch()} disabled={createLoading}>
                  {createLoading ? 'Creating…' : 'Create release batch'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Payout batches</CardTitle>
            <CardDescription>
              Historical release batches and their settlement status.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
          ) : batches.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center text-sm">
              <p className="font-medium">No release batches yet</p>
              <p className="mt-1 text-muted-foreground">
                Payout-ready obligations will appear here once you create a release batch.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create release batch
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Settlement date</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Payout status</TableHead>
                  <TableHead className="text-right">Payouts</TableHead>
                  <TableHead className="text-right">Total released</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{b.currency}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.status === 'COMPLETED'
                            ? 'default'
                            : b.status === 'SUBMITTED'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {b.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{b.payoutCount}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPayoutCurrency(b.totalAmount, b.currency, orgCurrency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(b.id)}
                          aria-label="Export batch"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={batchDetailHref(b.id)} aria-label="View batch details">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

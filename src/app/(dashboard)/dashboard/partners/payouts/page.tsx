'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Download, ChevronRight } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Batch {
  id: string;
  currency: string;
  status: string;
  payoutCount: number;
  totalAmount: number;
  createdAt: string;
}

export default function PartnerPayoutsPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createCurrency, setCreateCurrency] = React.useState('AUD');
  const [createThreshold, setCreateThreshold] = React.useState('50');
  const [createRoleFilter, setCreateRoleFilter] = React.useState<string>(''); // '' = all, CONSULTANT, BD_PARTNER

  const fetchBatches = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payout-batches?organizationId=${organizationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setBatches(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    fetchBatches();
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
          ...(createRoleFilter && {
            roleFilter: createRoleFilter as 'CONSULTANT' | 'BD_PARTNER',
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to create batch');
      toast.success('Payout batch created');
      fetchBatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create batch');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExport = (batchId: string) => {
    if (!organizationId) return;
    window.open(
      `/api/payout-batches/${batchId}/export`,
      '_blank',
      'noopener'
    );
  };

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Payouts</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Payouts</h1>
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Create payout batches from posted commissions. Mark payouts as paid after transfer.
        </p>
      </div>

      <Card>
        <Tabs defaultValue="create">
          <CardHeader>
            <TabsList>
              <TabsTrigger value="create">Create payout batch</TabsTrigger>
              <TabsTrigger value="batches">Batches</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="create" className="space-y-4 mt-0">
              <div className="grid gap-4 sm:grid-cols-2 max-w-md">
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
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="threshold">Min threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="0"
                    step="1"
                    value={createThreshold}
                    onChange={(e) => setCreateThreshold(e.target.value)}
                    placeholder="50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only include payees with total &ge; this amount
                  </p>
                </div>
                <div>
                  <Label htmlFor="roleFilter">Role filter (optional)</Label>
                  <Select
                    value={createRoleFilter || 'all'}
                    onValueChange={(v) => setCreateRoleFilter(v === 'all' ? '' : v)}
                  >
                    <SelectTrigger id="roleFilter">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="CONSULTANT">Consultant only</SelectItem>
                      <SelectItem value="BD_PARTNER">BD Partner only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateBatch} disabled={createLoading}>
                {createLoading ? 'Creating...' : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create batch
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="batches" className="space-y-4 mt-0">
              <div className="flex justify-end">
                <Button variant="outline" size="icon" onClick={fetchBatches} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">Loading...</p>
              ) : batches.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No payout batches yet. Create one from the first tab.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          {new Date(b.createdAt).toLocaleDateString()}
                        </TableCell>
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
                            {b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{b.payoutCount}</TableCell>
                        <TableCell className="text-right font-medium">
                          {b.currency} {b.totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExport(b.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/partners/payouts/${b.id}`}>
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
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}

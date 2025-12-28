'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCw, Eye, RotateCcw, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type SyncStatus = 'PENDING' | 'RETRYING' | 'SUCCESS' | 'FAILED';

interface SyncRecord {
  id: string;
  payment_link_id: string;
  status: SyncStatus;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  xero_invoice_id: string | null;
  xero_payment_id: string | null;
  request_payload: any;
  response_payload: any;
  payment_links: {
    id: string;
    amount: string;
    currency: string;
    invoice_reference: string | null;
    status: string;
  };
}

interface SyncStatistics {
  total: number;
  pending: number;
  retrying: number;
  success: number;
  failed: number;
  successRate: number;
  failureRate: number;
}

export function SyncQueueDashboard() {
  const { organization } = useOrganization();
  const [syncs, setSyncs] = React.useState<SyncRecord[]>([]);
  const [statistics, setStatistics] = React.useState<SyncStatistics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [selectedSync, setSelectedSync] = React.useState<SyncRecord | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [replayingId, setReplayingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id, statusFilter]);

  async function loadData() {
    if (!organization?.id) return;

    setLoading(true);
    try {
      // Load statistics
      const statsResponse = await fetch(
        `/api/xero/sync/stats?organization_id=${organization.id}`
      );
      if (statsResponse.ok) {
        const { data } = await statsResponse.json();
        setStatistics(data);
      }

      // Load sync records (use failed endpoint for failed filter, otherwise get all)
      let endpoint = statusFilter === 'FAILED'
        ? `/api/xero/sync/failed?organization_id=${organization.id}&limit=50`
        : `/api/xero/sync/failed?organization_id=${organization.id}&limit=200`; // Temp: get all via failed endpoint
      
      const syncsResponse = await fetch(endpoint);
      if (syncsResponse.ok) {
        const { data } = await syncsResponse.json();
        
        // Filter by status if needed
        const filtered = statusFilter === 'all'
          ? data
          : data.filter((s: SyncRecord) => s.status === statusFilter);
        
        setSyncs(filtered);
      }
    } catch (error) {
      console.error('Error loading sync data:', error);
      toast.error('Failed to load sync data');
    } finally {
      setLoading(false);
    }
  }

  async function handleReplay(syncId: string, resetRetryCount: boolean = false) {
    if (!organization?.id) return;

    setReplayingId(syncId);
    try {
      const response = await fetch(
        `/api/xero/sync/replay?organization_id=${organization.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncId, resetRetryCount }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success('Sync replayed successfully');
        loadData(); // Reload data
      } else {
        toast.error(`Replay failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error replaying sync:', error);
      toast.error('Failed to replay sync');
    } finally {
      setReplayingId(null);
    }
  }

  function getStatusBadge(status: SyncStatus) {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Success</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case 'PENDING':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'RETRYING':
        return <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" /> Retrying</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function openDetailDialog(sync: SyncRecord) {
    setSelectedSync(sync);
    setDetailDialogOpen(true);
  }

  if (!organization) {
    return <div>Please select an organization</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.successRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {statistics.success} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending/Retrying</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.pending + statistics.retrying}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics.pending} pending, {statistics.retrying} retrying
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.failed}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.failureRate.toFixed(1)}% failure rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Queue List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync Queue</CardTitle>
              <CardDescription>View and manage sync operations</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="RETRYING">Retrying</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : syncs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync records found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Link</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Retry Count</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncs.map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell>{getStatusBadge(sync.status)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {sync.payment_links.invoice_reference || sync.payment_link_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {sync.payment_links.amount} {sync.payment_links.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sync.retry_count}/5</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(sync.updated_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailDialog(sync)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(sync.status === 'FAILED' || sync.status === 'RETRYING') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReplay(sync.id, sync.retry_count >= 3)}
                            disabled={replayingId === sync.id}
                          >
                            {replayingId === sync.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync Details</DialogTitle>
            <DialogDescription>
              View detailed information about this sync operation
            </DialogDescription>
          </DialogHeader>
          {selectedSync && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <div className="mt-1">{getStatusBadge(selectedSync.status)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Retry Count</div>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedSync.retry_count}/5</Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Payment Link ID</div>
                  <div className="mt-1 font-mono text-sm">{selectedSync.payment_link_id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Invoice Reference</div>
                  <div className="mt-1">{selectedSync.payment_links.invoice_reference || 'N/A'}</div>
                </div>
                {selectedSync.xero_invoice_id && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Xero Invoice ID</div>
                    <div className="mt-1 font-mono text-sm">{selectedSync.xero_invoice_id}</div>
                  </div>
                )}
                {selectedSync.xero_payment_id && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Xero Payment ID</div>
                    <div className="mt-1 font-mono text-sm">{selectedSync.xero_payment_id}</div>
                  </div>
                )}
              </div>

              {selectedSync.error_message && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Error Message</div>
                  <div className="mt-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {selectedSync.error_message}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-muted-foreground">Request Payload</div>
                <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  {JSON.stringify(selectedSync.request_payload, null, 2)}
                </pre>
              </div>

              {selectedSync.response_payload && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Response Payload</div>
                  <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedSync.response_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            {selectedSync && (selectedSync.status === 'FAILED' || selectedSync.status === 'RETRYING') && (
              <Button
                onClick={() => {
                  handleReplay(selectedSync.id, selectedSync.retry_count >= 3);
                  setDetailDialogOpen(false);
                }}
                disabled={replayingId === selectedSync.id}
              >
                {replayingId === selectedSync.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Sync
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Import for lucide-react Database icon
import { Database } from 'lucide-react';








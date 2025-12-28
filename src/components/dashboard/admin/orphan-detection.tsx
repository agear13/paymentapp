'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface OrphanLink {
  id: string;
  amount: string;
  currency: string;
  invoice_reference: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  hasSyncRecord: boolean;
  hasLedgerEntry: boolean;
}

export function OrphanDetection() {
  const { organization } = useOrganization();
  const [orphans, setOrphans] = React.useState<OrphanLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [stats, setStats] = React.useState({ total: 0, noSync: 0, noLedger: 0 });

  React.useEffect(() => {
    if (organization?.id) {
      detectOrphans();
    }
  }, [organization?.id]);

  async function detectOrphans() {
    if (!organization?.id) return;

    setScanning(true);
    try {
      // This is a simplified detection - in production, you'd have a dedicated API endpoint
      // For now, we'll use the existing endpoints to detect orphans
      
      // Get all PAID payment links
      const linksResponse = await fetch(
        `/api/payment-links?organization_id=${organization.id}`
      );
      
      if (!linksResponse.ok) {
        throw new Error('Failed to fetch payment links');
      }

      const { data: allLinks } = await linksResponse.json();
      const paidLinks = allLinks.filter((link: any) => link.status === 'PAID');

      // Check each paid link for sync records
      const orphanList: OrphanLink[] = [];
      let noSyncCount = 0;
      let noLedgerCount = 0;

      for (const link of paidLinks) {
        try {
          // Check for sync record
          const syncResponse = await fetch(
            `/api/xero/sync/status?payment_link_id=${link.id}&organization_id=${organization.id}`
          );
          
          const hasSyncRecord = syncResponse.ok;
          const syncData = hasSyncRecord ? await syncResponse.json() : null;
          const hasSuccessfulSync = syncData?.data?.summary?.hasSuccessful || false;

          if (!hasSuccessfulSync) {
            noSyncCount++;
            orphanList.push({
              ...link,
              hasSyncRecord,
              hasLedgerEntry: true, // Assume ledger exists if status is PAID
            });
          }
        } catch (error) {
          console.error(`Error checking link ${link.id}:`, error);
        }
      }

      setOrphans(orphanList);
      setStats({
        total: orphanList.length,
        noSync: noSyncCount,
        noLedger: noLedgerCount,
      });
    } catch (error) {
      console.error('Error detecting orphans:', error);
      toast.error('Failed to detect orphan records');
    } finally {
      setScanning(false);
      setLoading(false);
    }
  }

  async function queueOrphanSync(linkId: string) {
    if (!organization?.id) return;

    try {
      // Queue the sync manually
      const response = await fetch('/api/xero/sync/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncId: linkId, // This would need to be adapted
          resetRetryCount: true,
        }),
      });

      if (response.ok) {
        toast.success('Sync queued successfully');
        detectOrphans(); // Refresh
      } else {
        toast.error('Failed to queue sync');
      }
    } catch (error) {
      console.error('Error queuing sync:', error);
      toast.error('Failed to queue sync');
    }
  }

  if (!organization) {
    return <div>Please select an organization</div>;
  }

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      {orphans.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Orphan Records Detected</AlertTitle>
          <AlertDescription>
            Found {stats.total} payment link(s) with incomplete sync operations. These may require manual intervention.
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orphans</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Sync</CardTitle>
            <Link2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noSync}</div>
            <p className="text-xs text-muted-foreground">No Xero sync record</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Ledger</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noLedger}</div>
            <p className="text-xs text-muted-foreground">No ledger entry</p>
          </CardContent>
        </Card>
      </div>

      {/* Orphan List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orphan Records</CardTitle>
              <CardDescription>
                Payment links with incomplete sync or ledger entries
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={detectOrphans}
              disabled={scanning}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Again'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orphans.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <p className="text-lg font-medium">No Orphan Records Found</p>
              <p className="text-sm text-muted-foreground">
                All payment links have been properly synced
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Link</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((orphan) => (
                  <TableRow key={orphan.id}>
                    <TableCell className="font-mono text-sm">
                      {orphan.invoice_reference || orphan.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {orphan.amount} {orphan.currency}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!orphan.hasSyncRecord && (
                          <Badge variant="destructive">No Sync</Badge>
                        )}
                        {!orphan.hasLedgerEntry && (
                          <Badge variant="outline" className="text-orange-600">No Ledger</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(orphan.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => queueOrphanSync(orphan.id)}
                      >
                        Queue Sync
                      </Button>
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








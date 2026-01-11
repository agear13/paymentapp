/**
 * Xero Sync Queue Status & Manual Trigger
 * Shows pending syncs and allows manual processing
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface QueueStatus {
  pendingCount: number;
  recentSyncs: Array<{
    id: string;
    payment_link_id: string;
    status: string;
    retry_count: number;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

interface XeroSyncQueueProps {
  organizationId: string;
}

export function XeroSyncQueue({ organizationId }: XeroSyncQueueProps) {
  // organizationId is passed but not currently used - may be needed for filtering in future
  console.log('XeroSyncQueue for organization:', organizationId);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [backfilling, setBackfilling] = React.useState(false);
  const [queueStatus, setQueueStatus] = React.useState<QueueStatus | null>(null);

  // Fetch queue status
  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await fetch('/api/xero/queue/process-now');
      
      if (!response.ok) {
        throw new Error('Failed to fetch queue status');
      }

      const data = await response.json();
      setQueueStatus(data);
    } catch (error) {
      console.error('Error fetching queue status:', error);
      toast.error('Failed to load queue status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Process queue manually
  const processQueue = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/xero/queue/process-now', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to process queue');
      }

      const result = await response.json();
      
      toast.success(
        `Processed ${result.stats.processed} syncs: ${result.stats.succeeded} succeeded, ${result.stats.failed} failed`
      );

      // Refresh status
      await fetchStatus();
    } catch (error) {
      console.error('Error processing queue:', error);
      toast.error('Failed to process queue');
    } finally {
      setProcessing(false);
    }
  };

  // Backfill missing syncs
  const backfillSyncs = async () => {
    setBackfilling(true);
    try {
      const response = await fetch('/api/xero/queue/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to backfill syncs');
      }

      const result = await response.json();
      
      // Handle both response formats: top-level 'queued' or nested in 'results'
      const queuedCount = result.results?.queued ?? result.queued ?? 0;
      
      if (queuedCount > 0) {
        toast.success(
          `Queued ${queuedCount} missed payments for syncing!`
        );
      } else {
        toast.info('No payments need backfilling');
      }

      // Refresh status
      await fetchStatus();
    } catch (error) {
      console.error('Error backfilling syncs:', error);
      toast.error('Failed to backfill syncs');
    } finally {
      setBackfilling(false);
    }
  };

  // Fetch status on mount
  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'RETRYING':
        return <Badge variant="outline" className="bg-blue-50"><RefreshCw className="w-3 h-3 mr-1" /> Retrying</Badge>;
      case 'SUCCESS':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle className="w-3 h-3 mr-1" /> Success</Badge>;
      case 'FAILED':
        return <Badge variant="outline" className="bg-red-50"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Xero Sync Queue</CardTitle>
          <CardDescription>Loading queue status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Xero Sync Queue</CardTitle>
            <CardDescription>
              Monitor and manually trigger Xero payment syncs
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={backfillSyncs}
              disabled={backfilling || loading}
              size="sm"
              variant="outline"
            >
              {backfilling ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Backfilling...
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Queue Missed Payments
                </>
              )}
            </Button>
            <Button
              onClick={processQueue}
              disabled={processing || !queueStatus || queueStatus.pendingCount === 0}
              size="sm"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Process Queue ({queueStatus?.pendingCount || 0})
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {queueStatus && queueStatus.pendingCount > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <strong>{queueStatus.pendingCount} payment(s)</strong> waiting to sync to Xero. 
              Click &quot;Process Queue&quot; to sync them now.
            </div>
          </div>
        )}

        {queueStatus && queueStatus.pendingCount === 0 && queueStatus.recentSyncs.length === 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <strong>No sync queue records found.</strong>
              <p className="mt-1">
                If you&apos;ve made payments, they should appear here after clicking
                {' '}&quot;Process Queue&quot;.
              </p>
            </div>
          </div>
        )}

        {queueStatus && queueStatus.pendingCount === 0 && queueStatus.recentSyncs.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="text-sm text-green-800">
              No pending syncs - recent syncs shown below
            </div>
          </div>
        )}

        {/* Recent Syncs */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Syncs</h4>
          {queueStatus && queueStatus.recentSyncs.length === 0 && (
            <p className="text-sm text-gray-500">No sync records found</p>
          )}
          {queueStatus && queueStatus.recentSyncs.map((sync) => (
            <div
              key={sync.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {getStatusBadge(sync.status)}
                  <span className="text-sm text-gray-600 font-mono">
                    {sync.payment_link_id.substring(0, 8)}...
                  </span>
                  {sync.retry_count > 0 && (
                    <span className="text-xs text-gray-500">
                      (Retry {sync.retry_count})
                    </span>
                  )}
                </div>
                {sync.error_message && (
                  <p className="text-xs text-red-600 mt-1 line-clamp-1">
                    {sync.error_message}
                  </p>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(sync.updated_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> For automatic syncing, you need to set up a cron job or background worker.
            See the setup guide (XERO_SYNC_SETUP.md) for instructions.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            <a 
              href="/api/xero/debug" 
              target="_blank" 
              className="underline hover:text-blue-800"
            >
              View detailed sync diagnostics →
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


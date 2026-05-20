/**
 * Xero payment sync status for operators.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { RefreshCw, Clock, CheckCircle, XCircle, ChevronDown } from 'lucide-react';

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
  const [loading, setLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [backfilling, setBackfilling] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [queueStatus, setQueueStatus] = React.useState<QueueStatus | null>(null);

  const fetchStatus = React.useCallback(async () => {
    setLoadFailed(false);
    try {
      const response = await fetch('/api/xero/queue/process-now');

      if (!response.ok) {
        setLoadFailed(true);
        setQueueStatus(null);
        return;
      }

      const data = await response.json();
      setQueueStatus(data);
    } catch {
      setLoadFailed(true);
      setQueueStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.success(result.message || 'Sync started');
      setTimeout(() => void fetchStatus(), 2000);
    } catch {
      toast.error('Could not run sync');
    } finally {
      setProcessing(false);
    }
  };

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
      const queuedCount = result.results?.queued ?? result.queued ?? 0;

      if (queuedCount > 0) {
        toast.success(`Queued ${queuedCount} payment${queuedCount === 1 ? '' : 's'} for sync`);
      } else {
        toast.info('No additional payments needed syncing');
      }

      await fetchStatus();
    } catch {
      toast.error('Could not queue missed payments');
    } finally {
      setBackfilling(false);
    }
  };

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  React.useEffect(() => {
    if (loadFailed) return;
    const interval = setInterval(() => void fetchStatus(), 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, loadFailed]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-yellow-50">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        );
      case 'RETRYING':
        return (
          <Badge variant="outline" className="bg-blue-50">
            <RefreshCw className="w-3 h-3 mr-1" /> Retrying
          </Badge>
        );
      case 'SUCCESS':
        return (
          <Badge variant="outline" className="bg-green-50">
            <CheckCircle className="w-3 h-3 mr-1" /> Success
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="outline" className="bg-red-50">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Xero payment sync</CardTitle>
          <CardDescription>Loading sync status…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pending = queueStatus?.pendingCount ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Xero payment sync</CardTitle>
        <CardDescription>
          Payment syncs are processed automatically once Xero is connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadFailed ? (
          <p className="text-sm text-muted-foreground rounded-lg border bg-muted/40 p-3">
            Sync status temporarily unavailable.{' '}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setLoading(true);
                void fetchStatus();
              }}
            >
              Try again
            </button>
          </p>
        ) : (
          <>
            {pending > 0 ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{pending}</span> payment
                {pending === 1 ? '' : 's'} waiting to sync to Xero.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No payments are waiting to sync right now.
              </p>
            )}

            {queueStatus && queueStatus.recentSyncs.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent activity</h4>
                {queueStatus.recentSyncs.slice(0, 5).map((sync) => (
                  <div
                    key={sync.id}
                    className="flex items-center justify-between p-3 border rounded-lg text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(sync.status)}
                        <span className="text-muted-foreground font-mono text-xs truncate">
                          {sync.payment_link_id.substring(0, 8)}…
                        </span>
                      </div>
                      {sync.error_message ? (
                        <p className="text-xs text-red-600 mt-1 line-clamp-1">{sync.error_message}</p>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {new Date(sync.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground px-0">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
              Advanced
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void backfillSyncs()}
                disabled={backfilling || loadFailed}
                size="sm"
                variant="outline"
              >
                {backfilling ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Queueing…
                  </>
                ) : (
                  'Queue missed payments'
                )}
              </Button>
              <Button
                onClick={() => void processQueue()}
                disabled={processing || loadFailed || pending === 0}
                size="sm"
                variant="outline"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  `Process queue (${pending})`
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <Link
                href="/api/xero/debug"
                target="_blank"
                className="underline hover:text-foreground"
              >
                View detailed sync diagnostics
              </Link>
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

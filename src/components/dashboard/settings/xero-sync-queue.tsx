/**
 * Xero payment sync status — only shown when post-connect payments need attention.
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { RefreshCw, Clock, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import {
  QUEUE_GUIDANCE,
  SYNC_STATUS_GUIDANCE,
  type SyncStatusKey,
} from '@/lib/xero/xero-setup-guidance';
import { formatSyncIssueForCustomer } from '@/lib/xero/xero-customer-messages';
import { XERO_GUIDED_SECTION_IDS } from '@/lib/xero/xero-guided-setup-config';
import {
  filterPostConnectSyncs,
  type XeroRecentSync,
} from '@/lib/commercial-os/xero-invoice-readiness';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';

interface XeroSyncQueueProps {
  organizationId: string;
  showGuidedSectionId?: boolean;
}

function getStatusDisplay(status: string) {
  const key = status as SyncStatusKey;
  const guidance = SYNC_STATUS_GUIDANCE[key];
  if (!guidance) {
    return { label: status, explanation: null, icon: null };
  }

  switch (status) {
    case 'PENDING':
      return { ...guidance, icon: <Clock className="w-3 h-3 mr-1" /> };
    case 'RETRYING':
      return { ...guidance, icon: <RefreshCw className="w-3 h-3 mr-1" /> };
    case 'SUCCESS':
      return { ...guidance, icon: <CheckCircle className="w-3 h-3 mr-1" /> };
    case 'FAILED':
      return { ...guidance, icon: <XCircle className="w-3 h-3 mr-1" /> };
    default:
      return { ...guidance, icon: null };
  }
}

function getStatusBadge(status: string) {
  const display = getStatusDisplay(status);
  const className =
    status === 'PENDING'
      ? 'bg-yellow-50'
      : status === 'RETRYING'
        ? 'bg-blue-50'
        : status === 'SUCCESS'
          ? 'bg-green-50'
          : status === 'FAILED'
            ? 'bg-red-50'
            : '';

  return (
    <Badge variant="outline" className={className}>
      {display.icon}
      {display.label}
    </Badge>
  );
}

export function XeroSyncQueue({ organizationId, showGuidedSectionId = false }: XeroSyncQueueProps) {
  const readiness = useCommercialReadinessOptional();
  const [loading, setLoading] = React.useState(!readiness);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [backfilling, setBackfilling] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [localSyncs, setLocalSyncs] = React.useState<XeroRecentSync[]>([]);
  const [xeroConnected, setXeroConnected] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    if (readiness) return;

    setLoadFailed(false);
    try {
      const [statsResponse, statusResponse] = await Promise.all([
        fetch(
          `/api/xero/sync/stats?organization_id=${encodeURIComponent(organizationId)}`,
          { cache: 'no-store' }
        ),
        fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
      ]);

      if (!statsResponse.ok) {
        setLoadFailed(true);
        setLocalSyncs([]);
        return;
      }

      const statsPayload = await statsResponse.json();
      const statusPayload = statusResponse.ok
        ? ((await statusResponse.json()) as { connected?: boolean; connectedAt?: string | null })
        : { connected: false };

      setXeroConnected(Boolean(statusPayload.connected));
      const recentSyncs = (statsPayload.recentSyncs ?? []) as XeroRecentSync[];
      setLocalSyncs(filterPostConnectSyncs(recentSyncs, statusPayload.connectedAt ?? null));
    } catch {
      setLoadFailed(true);
      setLocalSyncs([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, readiness]);

  const syncs = readiness?.queue.postConnectSyncs ?? localSyncs;

  const backfillSyncs = async () => {
    setBackfilling(true);
    try {
      const response = await fetch('/api/xero/queue/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          scope: 'organization',
        }),
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
      void readiness?.refresh();
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
    if (readiness || loadFailed) return;
    const interval = setInterval(() => void fetchStatus(), 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, loadFailed, readiness]);

  if (loading) {
    return null;
  }

  if (syncs.length === 0) {
    return null;
  }

  const connected = readiness?.connection.connected ?? xeroConnected;

  return (
    <Card id={showGuidedSectionId ? XERO_GUIDED_SECTION_IDS.syncQueue : undefined}>
      <CardHeader>
        <CardTitle>{QUEUE_GUIDANCE.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{QUEUE_GUIDANCE.context}</p>
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
          <div className="space-y-2">
            {syncs.slice(0, 5).map((sync, index) => {
              const display = getStatusDisplay(sync.status);
              const syncIssue = formatSyncIssueForCustomer(sync.error_message, {
                xeroCurrentlyConnected: connected,
              });
              return (
                <div
                  key={sync.id}
                  className="flex items-start justify-between gap-3 p-3 border rounded-lg text-sm"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(sync.status)}
                      <span className="text-muted-foreground text-xs">
                        {QUEUE_GUIDANCE.paymentLabel(index)}
                      </span>
                    </div>
                    {display.explanation ? (
                      <p className="text-xs text-muted-foreground">{display.explanation}</p>
                    ) : null}
                    {syncIssue ? (
                      <div className="text-xs text-red-600 line-clamp-4 space-y-1">
                        <p>{syncIssue.message}</p>
                        <p className="text-muted-foreground">{syncIssue.action}</p>
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(sync.updated_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground px-0">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
              {QUEUE_GUIDANCE.advancedOptions}
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
                    Searching…
                  </>
                ) : (
                  QUEUE_GUIDANCE.queueMissedLabel
                )}
              </Button>
              {!readiness ? (
                <Button
                  onClick={() => void fetchStatus()}
                  disabled={loadFailed}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh status
                </Button>
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

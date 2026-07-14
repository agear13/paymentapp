'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { PilotReadinessSnapshot } from '@/lib/pilot/types';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

function healthBadge(health: string) {
  switch (health) {
    case 'healthy':
      return <Badge className="bg-emerald-600">Healthy</Badge>;
    case 'degraded':
      return <Badge variant="secondary">Degraded</Badge>;
    case 'disabled':
      return <Badge variant="outline">Disabled</Badge>;
    case 'unknown':
      return <Badge variant="outline">Unknown</Badge>;
    default:
      return <Badge variant="destructive">Unhealthy</Badge>;
  }
}

function boolBadge(ok: boolean, label: string) {
  return (
    <Badge variant={ok ? 'default' : 'destructive'} className={ok ? 'bg-emerald-600' : undefined}>
      {label}: {ok ? 'Yes' : 'No'}
    </Badge>
  );
}

function formatRelative(iso: string | null) {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function PilotCommandCentre() {
  const [data, setData] = React.useState<PilotReadinessSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [replaying, setReplaying] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/pilot/status');
      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load pilot status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  async function handleReplayQueue() {
    setReplaying(true);
    try {
      const res = await csrfAwareFetch('/api/pilot/xero-replay?batchSize=10', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Replay failed');
      toast.success(
        `Queue processed: ${json.stats?.succeeded ?? 0} succeeded, ${json.stats?.failed ?? 0} failed`
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Replay failed');
    } finally {
      setReplaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading pilot readiness…
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Unable to load pilot status</AlertTitle>
        <AlertDescription>Check admin access and try again.</AlertDescription>
      </Alert>
    );
  }

  const isReady = data.pilotStatus === 'READY';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isReady ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          )}
          <div>
            <p className="text-2xl font-bold">{data.pilotStatus}</p>
            <p className="text-sm text-muted-foreground">
              Last checked {formatRelative(data.checkedAt)}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {!isReady && data.blockingReasons.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Platform not ready</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {data.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Production configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              {boolBadge(data.environment.productionMode, 'Production')}
              {boolBadge(data.environment.stripeConfigured, 'Stripe')}
              {boolBadge(data.environment.xeroConfigured, 'Xero')}
              {boolBadge(data.environment.resendConfigured, 'Resend')}
              {boolBadge(data.environment.redisConfigured, 'Redis')}
              {boolBadge(data.environment.cronConfigured, 'Cron')}
            </div>
            <p>
              <span className="text-muted-foreground">App URL:</span>{' '}
              {data.environment.appUrl ?? '—'}
            </p>
            {data.environment.missingRequiredEnv.length > 0 && (
              <p className="text-destructive text-xs">
                Missing: {data.environment.missingRequiredEnv.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danielle org</CardTitle>
            <CardDescription>Pilot workspace validation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{data.danielle.organizationName ?? 'Organization not found'}</p>
            <div className="flex flex-wrap gap-2">
              {boolBadge(data.danielle.pilotEmailConfigured, 'Pilot email')}
              {boolBadge(data.danielle.organizationFound, 'Org found')}
              {boolBadge(data.danielle.merchantConfigured, 'Merchant')}
              {boolBadge(data.danielle.stripeConnected, 'Stripe Connect')}
            </div>
            {data.danielle.organizationId && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                {data.danielle.organizationId}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
            <CardDescription>Cron, webhooks, retry queue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              Cron {healthBadge(data.monitoring.cronStatus)}
            </div>
            <p>Webhook failures: {data.monitoring.webhookFailures}</p>
            <p>Retry queue depth: {data.monitoring.retryQueueDepth}</p>
            {data.monitoring.latestErrors.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                {data.monitoring.latestErrors.slice(0, 3).map((e) => (
                  <li key={`${e.at}-${e.message}`}>
                    {e.message} ({formatRelative(e.at)})
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment rails</CardTitle>
          <CardDescription>Stripe (week 1), Hedera/MetaMask/Wise (week 2+)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Rail</th>
                  <th className="pb-2 pr-4">Enabled</th>
                  <th className="pb-2 pr-4">Configured</th>
                  <th className="pb-2 pr-4">Health</th>
                  <th className="pb-2 pr-4">Last payment</th>
                  <th className="pb-2">Last webhook</th>
                </tr>
              </thead>
              <tbody>
                {data.rails.map((rail) => (
                  <tr key={rail.rail} className="border-b last:border-0">
                    <td className="py-2 pr-4 capitalize font-medium">{rail.rail}</td>
                    <td className="py-2 pr-4">{rail.enabled ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">{rail.configured ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">{healthBadge(rail.health)}</td>
                    <td className="py-2 pr-4">{formatRelative(rail.lastPaymentAt)}</td>
                    <td className="py-2">{formatRelative(rail.lastWebhookAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Xero</CardTitle>
              <CardDescription>Invoice and payment sync</CardDescription>
            </div>
            <Button size="sm" variant="secondary" onClick={handleReplayQueue} disabled={replaying}>
              {replaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="ml-2">Replay queue</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              {boolBadge(data.xero.connected, 'Connected')}
              {healthBadge(data.xero.health)}
              {boolBadge(data.xero.mappingComplete, 'Mappings')}
            </div>
            <p>Last invoice sync: {formatRelative(data.xero.lastInvoiceSyncAt)}</p>
            <p>Last payment sync: {formatRelative(data.xero.lastPaymentSyncAt)}</p>
            <p>Failed syncs: {data.xero.failedSyncCount}</p>
            <p>Pending: {data.xero.pendingSyncCount}</p>
            {data.xero.mappingMissing.length > 0 && (
              <p className="text-amber-600 text-xs">
                Missing mappings: {data.xero.mappingMissing.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
            <CardDescription>Settlement integrity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {healthBadge(data.ledger.health)}
              <span className="text-muted-foreground">Balance: {data.ledger.balanceStatus}</span>
            </div>
            <p>Outstanding invoices: {data.ledger.outstandingInvoices}</p>
            <p>Settlement failures: {data.ledger.settlementFailures}</p>
            <p>Duplicate settlements: {data.ledger.duplicateSettlements}</p>
            <p>Critical issues: {data.ledger.criticalIssues}</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Activity className="h-3 w-3" />
        Auto-refreshes every 30 seconds. Run <code className="font-mono">npm run pilot:smoke</code> from CI or launch terminal.
      </p>
    </div>
  );
}

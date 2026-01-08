/**
 * Beta Operations Panel
 * Admin-only debugging interface for payment processing
 * Shows recent webhooks, confirmations, and sync attempts
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import config, { isAdminEmail } from '@/lib/config/env';
import {
  getRecentStripeWebhooks,
  getRecentHederaConfirmations,
  getRecentXeroSyncs,
  getBetaOpsStats,
} from '@/lib/beta-ops/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

async function checkAccess() {
  // Check if beta ops is enabled
  if (!config.features.betaOps) {
    return { allowed: false, reason: 'Beta ops not enabled' };
  }

  // Get current user
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { allowed: false, reason: 'Not authenticated' };
  }

  // Check if user is admin
  const isAdmin = isAdminEmail(user.email || '');

  if (!isAdmin) {
    return { allowed: false, reason: 'Not authorized' };
  }

  return { allowed: true, user };
}

export default async function BetaOpsPage() {
  // Check access
  const access = await checkAccess();

  if (!access.allowed) {
    redirect('/dashboard');
  }

  // Get data
  const [stripeEvents, hederaEvents, xeroSyncs, stats] = await Promise.all([
    getRecentStripeWebhooks(50),
    getRecentHederaConfirmations(50),
    getRecentXeroSyncs(50),
    getBetaOpsStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Beta Operations Panel</h1>
        <p className="text-muted-foreground mt-2">
          Debugging interface for payment processing pipeline
        </p>
      </div>

      {/* Beta Mode Indicator */}
      {config.isBeta && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-100">
                🧪 BETA MODE
              </Badge>
              <span className="text-sm">
                Stripe: {config.stripe.isTestMode ? 'TEST' : 'LIVE'} | 
                Hedera: {config.hedera.network.toUpperCase()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPaymentEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Stripe Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stripeEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Hedera Confirmations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.hederaEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Xero Syncs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.xeroSyncs.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.xeroSyncs.pending} pending, {stats.xeroSyncs.failed} failed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stripe Webhooks</CardTitle>
          <CardDescription>Last 50 processed Stripe webhook events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Event ID</th>
                  <th className="text-left p-2">Payment Link</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {stripeEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No Stripe webhook events yet
                    </td>
                  </tr>
                ) : (
                  stripeEvents.map((event) => (
                    <tr key={event.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-xs">
                        {event.stripe_event_id.substring(0, 20)}...
                      </td>
                      <td className="p-2">
                        <a
                          href={`/dashboard/payment-links/${event.payment_link_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {event.payment_link?.short_code || 'N/A'}
                        </a>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{event.event_type}</Badge>
                      </td>
                      <td className="p-2">
                        {event.amount_received 
                          ? `$${event.amount_received.toFixed(2)}` 
                          : '-'}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {event.correlation_id 
                          ? event.correlation_id.substring(0, 15) + '...' 
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Hedera Confirmations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Hedera Confirmations</CardTitle>
          <CardDescription>Last 50 confirmed Hedera payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">TX ID</th>
                  <th className="text-left p-2">Payment Link</th>
                  <th className="text-left p-2">Token</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {hederaEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No Hedera confirmations yet
                    </td>
                  </tr>
                ) : (
                  hederaEvents.map((event) => (
                    <tr key={event.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-xs">
                        {event.hedera_tx_id}
                      </td>
                      <td className="p-2">
                        <a
                          href={`/dashboard/payment-links/${event.payment_link_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {event.payment_link?.short_code || 'N/A'}
                        </a>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">
                          {event.currency_received || 'HBAR'}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {event.amount_received 
                          ? `${event.amount_received.toFixed(4)} ${event.currency_received}` 
                          : '-'}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {event.correlation_id 
                          ? event.correlation_id.substring(0, 15) + '...' 
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Xero Syncs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Xero Sync Attempts</CardTitle>
          <CardDescription>Last 50 Xero synchronization attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Payment Link</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Error</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {xeroSyncs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No Xero sync attempts yet
                    </td>
                  </tr>
                ) : (
                  xeroSyncs.map((sync) => (
                    <tr key={sync.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <a
                          href={`/dashboard/payment-links/${sync.payment_link_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {sync.payment_link?.short_code || 'N/A'}
                        </a>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{sync.sync_type}</Badge>
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={
                            sync.status === 'SUCCESS'
                              ? 'default'
                              : sync.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {sync.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-red-600 max-w-xs truncate">
                        {sync.error_message || '-'}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {formatDistanceToNow(new Date(sync.created_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {sync.correlation_id 
                          ? sync.correlation_id.substring(0, 15) + '...' 
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


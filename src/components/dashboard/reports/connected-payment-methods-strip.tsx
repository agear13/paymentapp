'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PaymentRailBadge } from '@/components/dashboard/reports/payment-rail-badge';
import type { PaymentRailId } from '@/lib/reports/payment-rails-display';
import type { ReconciliationReportData } from '@/lib/reports/reconciliation-types';
import { cn } from '@/lib/utils';

type RailStatus = 'connected' | 'configured' | 'available' | 'disconnected';

type RailRow = {
  id: PaymentRailId;
  label: string;
  status: RailStatus;
  hasActivity: boolean;
};

interface ConnectedPaymentMethodsStripProps {
  organizationId: string;
}

const ALL_RAIL_IDS: PaymentRailId[] = ['stripe', 'wise', 'hbar', 'usdc', 'usdt', 'audd'];

export function ConnectedPaymentMethodsStrip({
  organizationId,
}: ConnectedPaymentMethodsStripProps) {
  const [rails, setRails] = useState<RailRow[] | null>(null);
  const [showAllRails, setShowAllRails] = useState(false);

  const loadRails = useCallback(async () => {
    try {
      const [settingsRes, reconRes] = await Promise.all([
        fetch(`/api/merchant-settings?organizationId=${organizationId}`),
        fetch(`/api/reports/reconciliation?organizationId=${organizationId}`),
      ]);

      const settings = settingsRes.ok
        ? ((await settingsRes.json()) as Array<{
            stripe_account_id?: string | null;
            hedera_account_id?: string | null;
            wise_enabled?: boolean;
            wise_profile_id?: string | null;
            _features?: { wiseGloballyEnabled?: boolean };
          }>)
        : [];
      const row = settings[0];
      const stripeConnected = Boolean(row?.stripe_account_id);
      const wiseGlobally = row?._features?.wiseGloballyEnabled ?? false;
      const wiseConnected =
        wiseGlobally && Boolean(row?.wise_enabled && row?.wise_profile_id);
      const hederaConfigured = Boolean(row?.hedera_account_id);

      let activity: Record<PaymentRailId, boolean> = {
        stripe: false,
        wise: false,
        hbar: false,
        usdc: false,
        usdt: false,
        audd: false,
      };

      if (reconRes.ok) {
        const recon = (await reconRes.json()) as ReconciliationReportData;
        activity = {
          stripe: hasRailActivity(recon.report.stripe),
          wise: hasRailActivity(recon.report.wise),
          hbar: hasRailActivity(recon.report.hedera_hbar),
          usdc: hasRailActivity(recon.report.hedera_usdc),
          usdt: hasRailActivity(recon.report.hedera_usdt),
          audd: hasRailActivity(recon.report.hedera_audd),
        };
      }

      setRails(buildRailRows(stripeConnected, wiseConnected, hederaConfigured, activity));
    } catch {
      setRails(buildRailRows(false, false, false, {
        stripe: false,
        wise: false,
        hbar: false,
        usdc: false,
        usdt: false,
        audd: false,
      }));
    }
  }, [organizationId]);

  useEffect(() => {
    void loadRails();
  }, [loadRails]);

  const visibleRails = useMemo(() => {
    if (!rails) return [];
    if (showAllRails) return rails;
    return rails.filter((rail) => {
      if (rail.hasActivity) return true;
      if (rail.id === 'stripe' || rail.id === 'wise') {
        return rail.status === 'connected';
      }
      return rail.status === 'configured' || rail.status === 'connected';
    });
  }, [rails, showAllRails]);

  if (!rails) {
    return (
      <section className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Loading connected payment methods…</p>
      </section>
    );
  }

  const hiddenCount = rails.length - visibleRails.length;

  return (
    <section className="rounded-lg border bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Payments</h2>
          <p className="text-xs text-muted-foreground">
            Your active payment providers and settlement methods.
          </p>
        </div>
        {!showAllRails && hiddenCount > 0 ? (
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => setShowAllRails(true)}
          >
            Show all payment methods
          </Button>
        ) : showAllRails ? (
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => setShowAllRails(false)}
          >
            Show active only
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleRails.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No payment provider connected yet. Connect one in settings to begin accepting payments.
          </p>
        ) : (
          visibleRails.map((rail) => <RailChip key={rail.id} rail={rail} />)
        )}
      </div>
    </section>
  );
}

function hasRailActivity(item: {
  paymentCount: number;
  expectedRevenue: number;
  ledgerBalance: number;
}): boolean {
  return (
    item.paymentCount > 0 || item.expectedRevenue > 0 || Math.abs(item.ledgerBalance) > 0
  );
}

function buildRailRows(
  stripeConnected: boolean,
  wiseConnected: boolean,
  hederaConfigured: boolean,
  activity: Record<PaymentRailId, boolean>
): RailRow[] {
  return ALL_RAIL_IDS.map((id) => {
    const hasActivity = activity[id];
    let status: RailStatus = 'available';
    let label = id === 'stripe' ? 'Stripe' : id === 'wise' ? 'Wise' : id.toUpperCase();

    if (id === 'stripe') {
      status = stripeConnected ? 'connected' : 'disconnected';
      label = 'Stripe';
    } else if (id === 'wise') {
      status = wiseConnected ? 'connected' : 'disconnected';
      label = 'Wise';
    } else if (hederaConfigured) {
      status = 'configured';
      label = id.toUpperCase();
    }

    return { id, label, status, hasActivity };
  });
}

function RailChip({ rail }: { rail: RailRow }) {
  const disconnected = rail.status === 'disconnected';
  const statusLabel =
    rail.status === 'connected'
      ? 'Connected'
      : rail.status === 'configured'
        ? 'Configured'
        : rail.status === 'available'
          ? 'Available'
          : 'Not connected';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs',
        disconnected && 'border-amber-300/80 bg-amber-50/50',
        rail.hasActivity && 'ring-1 ring-emerald-200/80'
      )}
    >
      <PaymentRailBadge rail={rail.id} />
      <span className="font-medium">{rail.label}</span>
      {disconnected ? (
        <Badge variant="outline" className="h-5 gap-1 border-amber-400 text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          {statusLabel}
        </Badge>
      ) : (
        <Badge variant="outline" className="h-5 gap-1 border-emerald-300 text-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {statusLabel}
        </Badge>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountingReadinessBadge } from '@/components/accounting/accounting-readiness-badge';
import {
  evaluateAccountingProfile,
  type AccountingProfile,
} from '@/lib/accounting/accounting-profile';

type XeroAccountingHealthProps = {
  organizationId: string;
};

type ConnectionStatus = {
  connected: boolean;
  tenantId?: string;
  operatorMessage?: string;
};

type XeroMappings = {
  xero_revenue_account_id?: string | null;
  xero_receivable_account_id?: string | null;
  xero_stripe_clearing_account_id?: string | null;
  xero_fee_expense_account_id?: string | null;
  xero_hbar_clearing_account_id?: string | null;
  xero_usdc_clearing_account_id?: string | null;
  xero_usdt_clearing_account_id?: string | null;
  xero_audd_clearing_account_id?: string | null;
};

function itemIcon(status: 'ok' | 'recommendation' | 'attention') {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'recommendation') return <TriangleAlert className="h-4 w-4 text-amber-600" />;
  return <AlertCircle className="h-4 w-4 text-destructive" />;
}

function toAccountingProfile(
  status: ConnectionStatus,
  mappings: XeroMappings | null
): AccountingProfile {
  return {
    provider: 'xero',
    connection: {
      connected: status.connected,
      tenantId: status.tenantId,
      operatorMessage: status.operatorMessage,
    },
    accounts: {
      revenue: mappings?.xero_revenue_account_id,
      accountsReceivable: mappings?.xero_receivable_account_id,
      processorFees: mappings?.xero_fee_expense_account_id,
      stripeClearing: mappings?.xero_stripe_clearing_account_id,
      settlementAccounts: {
        hbar: mappings?.xero_hbar_clearing_account_id,
        usdc: mappings?.xero_usdc_clearing_account_id,
        usdt: mappings?.xero_usdt_clearing_account_id,
        audd: mappings?.xero_audd_clearing_account_id,
      },
    },
    gst: {
      configured: true,
      note: 'GST and tax treatment are handled by Xero account/tax settings.',
    },
  };
}

export function XeroAccountingHealth({ organizationId }: XeroAccountingHealthProps) {
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<AccountingProfile | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      setLoading(true);
      try {
        const [statusResponse, mappingsResponse] = await Promise.all([
          fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
          fetch(`/api/settings/xero-mappings?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
        ]);

        const status = (await statusResponse.json()) as ConnectionStatus;
        const mappingsPayload = mappingsResponse.ok
          ? ((await mappingsResponse.json()) as { data: XeroMappings | null })
          : { data: null };

        if (!cancelled) {
          setProfile(toAccountingProfile(status, mappingsPayload.data));
        }
      } catch {
        if (!cancelled) {
          setProfile(
            toAccountingProfile(
              {
                connected: false,
                operatorMessage: 'Could not load Xero accounting readiness.',
              },
              null
            )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking accounting readiness...
        </CardContent>
      </Card>
    );
  }

  const health = evaluateAccountingProfile(
    profile ??
      toAccountingProfile(
        { connected: false, operatorMessage: 'Could not load Xero accounting readiness.' },
        null
      )
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Accounting Health</CardTitle>
            <CardDescription>
              Provvypay is ready when it can send invoices, supplier bills, and settlement data to Xero.
            </CardDescription>
          </div>
          <AccountingReadinessBadge status={health.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Overall status</p>
          <p className="text-sm font-semibold">{health.title}</p>
        </div>
        <div className="space-y-3">
          {health.items.map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-lg border p-3">
              {itemIcon(item.status)}
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                {item.message ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plug, Check, Plus, Settings, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/use-organization';
import {
  COMMERCIAL_OS_ROUTES,
  xeroConnectUrl,
} from '@/lib/journey/commercial-os-routes';

type ConnectedSystem = {
  name: string;
  detail: string;
  tag: string;
  manageHref?: string;
};

type AvailableSystem = {
  name: string;
  detail: string;
  isRealConnect?: boolean;
};

const AVAILABLE: AvailableSystem[] = [
  { name: 'Outlook', detail: 'Email' },
  { name: 'Stripe', detail: 'Payments' },
  { name: 'Slack', detail: 'Communications' },
  { name: 'WhatsApp', detail: 'Communications' },
  { name: 'Wise', detail: 'Payments' },
];

function readAssessmentWantsXero(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem('provvy.business');
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { accounting?: string };
    return parsed.accounting === 'Xero';
  } catch {
    return true;
  }
}

export function WorkspaceConnectedScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId } = useOrganization();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedSystems, setConnectedSystems] = useState<ConnectedSystem[] | null>(null);
  const [xeroConnected, setXeroConnected] = useState<boolean | null>(null);
  const [wantsXero, setWantsXero] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshSystems = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    setWantsXero(readAssessmentWantsXero());
  }, []);

  useEffect(() => {
    const success = searchParams?.get('xero_success');
    const accounting = searchParams?.get('xero_accounting');
    const error = searchParams?.get('xero_error');
    const selectTenant = searchParams?.get('select_tenant');

    if (!success && !error) return;

    const run = async () => {
      if (success === 'connected') {
        const message =
          accounting === 'configured'
            ? 'Xero connected. Your accounting settings have been configured automatically.'
            : accounting === 'recommendation'
              ? 'Xero connected. Review optional account mappings in Manage when ready.'
              : 'Successfully connected to Xero.';
        toast.success(message);
        if (selectTenant === 'true') {
          toast.message('Multiple Xero organisations found', {
            description: 'Open Manage to select the correct organisation.',
          });
        }
        refreshSystems();
        router.replace(COMMERCIAL_OS_ROUTES.connected);
      }

      if (error) {
        const errorMessages: Record<string, string> = {
          missing_parameters: 'Missing required parameters',
          invalid_state: 'Invalid connection state',
          unauthorized: 'Session mismatch. Sign in again and retry.',
          no_tenants: 'No Xero organisations found',
          connection_failed: 'Failed to establish connection',
          not_configured: 'Xero integration is not configured on this environment',
        };
        toast.error(errorMessages[error] || 'Failed to connect to Xero');
        router.replace(COMMERCIAL_OS_ROUTES.connected);
      }
    };

    void run();
  }, [searchParams, router, refreshSystems]);

  useEffect(() => {
    if (!organizationId) {
      setConnectedSystems(null);
      setXeroConnected(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const cards: ConnectedSystem[] = [];
      let xeroIsConnected = false;

      const [xeroRes, merchantRes] = await Promise.all([
        fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/merchant-settings?organizationId=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
      ]);

      if (!cancelled && xeroRes.ok) {
        const xeroStatus = (await xeroRes.json()) as { connected?: boolean };
        xeroIsConnected = Boolean(xeroStatus.connected);
        if (xeroIsConnected) {
          cards.push({
            name: 'Xero',
            detail: 'Accounting · connected',
            tag: 'Primary ledger',
            manageHref: COMMERCIAL_OS_ROUTES.connectedXero,
          });
        }
      }

      if (!cancelled && merchantRes.ok) {
        const settingsData = (await merchantRes.json()) as Array<{
          stripe_account_id?: string | null;
          wise_enabled?: boolean | null;
          wise_profile_id?: string | null;
          evm_wallet_enabled?: boolean | null;
          evm_wallet_address?: string | null;
          evm_supported_networks?: string[] | null;
          hedera_account_id?: string | null;
        }>;
        const settings = settingsData?.[0];
        if (settings?.stripe_account_id?.trim()) {
          cards.push({
            name: 'Stripe',
            detail: 'Cards · configured',
            tag: 'Collections',
          });
        }
        if (settings?.wise_enabled && settings.wise_profile_id?.trim()) {
          cards.push({
            name: 'Wise',
            detail: 'Multi-currency · configured',
            tag: 'Payments',
          });
        }
        if (settings?.evm_wallet_enabled && settings.evm_wallet_address?.trim()) {
          const networks = settings.evm_supported_networks?.join(', ') || 'EVM';
          cards.push({
            name: 'MetaMask',
            detail: `${networks} · configured`,
            tag: 'Payments',
          });
        }
        if (settings?.hedera_account_id?.trim()) {
          cards.push({
            name: 'Hedera',
            detail: 'Native crypto · configured',
            tag: 'Payments',
          });
        }
      }

      if (!cancelled) {
        setXeroConnected(xeroIsConnected);
        setConnectedSystems(cards);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, refreshKey]);

  const showXeroAvailable = wantsXero && xeroConnected === false;

  const availableSystems = useMemo(() => {
    const connectedNames = new Set((connectedSystems ?? []).map((system) => system.name));
    return AVAILABLE.filter((system) => !connectedNames.has(system.name));
  }, [connectedSystems]);

  const handleConnect = (name: string) => {
    if (name === 'Xero') {
      if (!organizationId) {
        toast.error('Workspace not ready yet. Complete workspace setup first.');
        return;
      }
      setConnecting(name);
      window.location.href = xeroConnectUrl(organizationId, COMMERCIAL_OS_ROUTES.connected);
      return;
    }

    setConnecting(name);
    window.setTimeout(() => {
      setConnecting(null);
      toast.success(`${name} connection request queued`, {
        description: 'Your workspace admin will complete OAuth authorisation.',
      });
    }, 600);
  };

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <Plug className="h-3 w-3" />
          Connected Systems
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Your operating infrastructure.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Every system Provvy is connected to feeds directly into your Commercial Operating System.
        </p>
      </header>

      {connectedSystems && connectedSystems.length > 0 ? (
        <section>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Connected</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {connectedSystems.map((system) => (
              <div key={system.name} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-[13px] font-semibold">
                    {system.name.slice(0, 2)}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Connected
                  </span>
                </div>
                <div className="mt-4 text-[14.5px] font-semibold">{system.name}</div>
                <div className="text-[12px] text-ink-soft">{system.detail}</div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                    {system.tag}
                  </div>
                  {system.manageHref ? (
                    <Link
                      href={system.manageHref}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Manage
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(showXeroAvailable || availableSystems.length > 0) && (
        <section>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Available to connect
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {showXeroAvailable ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[oklch(0.55_0.15_220)] text-[13px] font-bold text-white">
                    X
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold">Xero</div>
                    <div className="text-[11.5px] text-ink-soft">Accounting · not connected</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={connecting === 'Xero'}
                  onClick={() => handleConnect('Xero')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {connecting === 'Xero' ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            ) : null}
            {availableSystems.map((system) => (
              <div
                key={system.name}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-[13px] font-semibold">
                    {system.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold">{system.name}</div>
                    <div className="text-[11.5px] text-ink-soft">{system.detail}</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={connecting === system.name}
                  onClick={() => handleConnect(system.name)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {connecting === system.name ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-primary/20 bg-accent p-5 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
          Next
        </div>
        <div className="mt-2 text-[14px] text-foreground">
          {xeroConnected
            ? 'Your accounting is linked. Continue into your Commercial Operating System.'
            : wantsXero
              ? 'Connect Xero when ready, or continue and configure integrations later.'
              : 'Continue into your Commercial Operating System.'}
        </div>
        <Link
          href={COMMERCIAL_OS_ROUTES.workspace}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
        >
          Enter workspace
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

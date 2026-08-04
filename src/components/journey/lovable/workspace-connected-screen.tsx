'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plug, Check, Plus, Settings, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/use-organization';
import {
  COMMERCIAL_OS_ROUTES,
  xeroConnectUrl,
} from '@/lib/journey/commercial-os-routes';
import { XeroConnectConfirmDialog } from '@/components/xero/xero-connect-confirm-dialog';
import { XeroOAuthSuccessBanner } from '@/components/xero/xero-oauth-success-banner';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';

type ConnectedSystem = {
  name: string;
  detail: string;
  tag: string;
  manageHref?: string;
};

type ComingSoonSystem = {
  name: string;
  detail: string;
  explanation: string;
};

const COMING_SOON: ComingSoonSystem[] = [
  { name: 'Stripe', detail: 'Payments', explanation: 'Accept card payments directly on your invoices.' },
  { name: 'Wise', detail: 'Payments', explanation: 'Collect international bank transfers with Wise.' },
  { name: 'Outlook', detail: 'Email', explanation: 'Send invoices from your work inbox.' },
  { name: 'Slack', detail: 'Communications', explanation: 'Get payment notifications in Slack.' },
  { name: 'WhatsApp', detail: 'Communications', explanation: 'Share payment links via WhatsApp.' },
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

function ConnectedSystemsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-secondary" />
            <div className="h-5 w-20 rounded-full bg-secondary" />
          </div>
          <div className="mt-4 h-4 w-24 rounded bg-secondary" />
          <div className="mt-2 h-3 w-32 rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

export function WorkspaceConnectedScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId } = useOrganization();
  const [connecting, setConnecting] = useState(false);
  const [connectedSystems, setConnectedSystems] = useState<ConnectedSystem[] | null>(null);
  const [xeroConnected, setXeroConnected] = useState<boolean | null>(null);
  const [wantsXero, setWantsXero] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState<string | null>(null);
  const [xeroConnectDialogOpen, setXeroConnectDialogOpen] = useState(false);
  const [showXeroSuccess, setShowXeroSuccess] = useState(false);

  const refreshSystems = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    setWantsXero(readAssessmentWantsXero());
  }, []);

  useEffect(() => {
    const success = searchParams?.get('xero_success');
    const error = searchParams?.get('xero_error');
    const selectTenant = searchParams?.get('select_tenant');

    if (!success && !error) return;

    const run = async () => {
      if (success === 'connected') {
        setShowXeroSuccess(true);
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
      setSystemsLoading(false);
      return;
    }

    let cancelled = false;
    setSystemsLoading(true);
    setSystemsError(null);

    void (async () => {
      try {
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

        if (!xeroRes.ok && !merchantRes.ok) {
          throw new Error('Could not load connected systems. Check your connection and try again.');
        }

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
      } catch (error: unknown) {
        if (!cancelled) {
          setSystemsError(
            error instanceof Error ? error.message : 'Could not load connected systems.'
          );
          setConnectedSystems([]);
          setXeroConnected(false);
        }
      } finally {
        if (!cancelled) setSystemsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, refreshKey]);

  const showXeroAvailable = wantsXero && xeroConnected === false;

  const comingSoonSystems = useMemo(() => {
    const connectedNames = new Set((connectedSystems ?? []).map((system) => system.name));
    return COMING_SOON.filter((system) => !connectedNames.has(system.name));
  }, [connectedSystems]);

  const beginXeroConnect = () => {
    if (!organizationId) {
      toast.error('Workspace not ready yet. Complete workspace setup first.');
      return;
    }
    setXeroConnectDialogOpen(true);
  };

  const confirmXeroConnect = () => {
    if (!organizationId) return;
    setConnecting(true);
    window.location.href = xeroConnectUrl(organizationId, COMMERCIAL_OS_ROUTES.connected);
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

      {showXeroSuccess ? (
        <XeroOAuthSuccessBanner
          variant="commercial"
          continueHref={COMMERCIAL_OS_ROUTES.connectedXero}
          onDismiss={() => setShowXeroSuccess(false)}
        />
      ) : null}

      {xeroConnected && !systemsLoading ? (
        <CommercialOsNextStepBanner
          title="You're ready"
          message="Xero is connected. Complete account mapping on the Xero setup page, then create your first invoice."
          action={
            <Link
              href={COMMERCIAL_OS_ROUTES.createInvoice}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
            >
              Create your first invoice
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : null}

      <XeroConnectConfirmDialog
        open={xeroConnectDialogOpen}
        onOpenChange={setXeroConnectDialogOpen}
        onConfirm={confirmXeroConnect}
        confirming={connecting}
      />

      {systemsLoading ? (
        <section>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading connected systems…
          </div>
          <div className="mt-3">
            <ConnectedSystemsSkeleton />
          </div>
        </section>
      ) : systemsError ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-5">
          <p className="text-[14px] font-medium text-foreground">Could not load connected systems</p>
          <p className="mt-1 text-[13px] text-ink-soft">{systemsError}</p>
          <button
            type="button"
            onClick={refreshSystems}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </section>
      ) : (
        <>
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

          {(showXeroAvailable || comingSoonSystems.length > 0) && (
            <section>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                {showXeroAvailable ? 'Available to connect' : 'More integrations'}
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
                      disabled={connecting}
                      onClick={beginXeroConnect}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {connecting ? 'Connecting…' : 'Connect'}
                    </button>
                  </div>
                ) : null}
                {comingSoonSystems.map((system) => (
                  <div
                    key={system.name}
                    className="rounded-2xl border border-border bg-card p-4 shadow-card opacity-90"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-[13px] font-semibold">
                          {system.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-semibold">{system.name}</div>
                          <div className="text-[11.5px] text-ink-soft">{system.detail}</div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                        Coming soon
                      </span>
                    </div>
                    <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">{system.explanation}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl border border-primary/20 bg-accent p-5 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
          Next
        </div>
        <div className="mt-2 text-[14px] text-foreground">
          {xeroConnected
            ? 'Your accounting is linked. Head to your workspace to create and send invoices.'
            : wantsXero
              ? 'Connect Xero to sync invoices and payments automatically.'
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

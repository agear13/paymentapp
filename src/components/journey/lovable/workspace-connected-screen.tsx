'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plug, Check, Plus, Settings, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/use-organization';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  COMMERCIAL_OS_ROUTES,
  xeroConnectUrl,
} from '@/lib/journey/commercial-os-routes';
import { XeroConnectConfirmDialog } from '@/components/xero/xero-connect-confirm-dialog';
import { XeroOAuthSuccessBanner } from '@/components/xero/xero-oauth-success-banner';
import { formatXeroOAuthError } from '@/lib/xero/xero-customer-messages';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { CommercialOsXeroReadinessBanner } from '@/components/journey/lovable/commercial-os-xero-readiness-banner';
import {
  computeXeroConnectionState,
  presentXeroConnectionState,
  type XeroConnectionState,
} from '@/lib/xero/xero-connection-state';
import {
  hasJourneyAssessmentData,
  parseJourneyAssessmentContext,
  persistJourneyBusiness,
  persistJourneyObjective,
  restoreJourneyAssessment,
} from '@/lib/journey/journey-assessment-storage.client';
import { snapshotFromOnboardingPayload } from '@/lib/journey/workspace-advisor-intro';
import { buildConnectedSystemsPresentation } from '@/lib/journey/workspace-connected-presentation';

type ConnectedSystem = {
  name: string;
  detail: string;
  tag: string;
  manageHref?: string;
  badge?: 'connected' | 'action_required';
  badgeLabel?: string;
  ctaLabel?: string;
};

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
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const readiness = useCommercialReadinessOptional();
  const entitlements = useEntitlements();
  const [connecting, setConnecting] = useState(false);
  const [connectedSystems, setConnectedSystems] = useState<ConnectedSystem[] | null>(null);
  const [xeroConnected, setXeroConnected] = useState<boolean | null>(null);
  const [xeroConnectionState, setXeroConnectionState] = useState<XeroConnectionState | null>(null);
  const [accounting, setAccounting] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState<string | null>(null);
  const [xeroConnectDialogOpen, setXeroConnectDialogOpen] = useState(false);
  const [showXeroSuccess, setShowXeroSuccess] = useState(false);

  const refreshSystems = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const local = restoreJourneyAssessment();
    if (hasJourneyAssessmentData(local)) {
      setAccounting(local.business?.accounting?.trim() || null);
      return;
    }

    let cancelled = false;
    void fetch('/api/onboarding', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: {
        data?: { state?: { onboarding_context?: string; workspace_industry?: string } };
        state?: { onboarding_context?: string; workspace_industry?: string };
      } | null) => {
        if (cancelled || !payload) return;
        const state = payload.state ?? payload.data?.state;
        const fromServer = snapshotFromOnboardingPayload({ state });
        if (!fromServer) return;
        const parsed = parseJourneyAssessmentContext(state?.onboarding_context);
        if (parsed?.objective) persistJourneyObjective(parsed.objective);
        if (parsed?.business) persistJourneyBusiness(parsed.business);
        setAccounting(fromServer.business?.accounting?.trim() || null);
      })
      .catch(() => {
        /* do not invent an assessment selection */
      });

    return () => {
      cancelled = true;
    };
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
        void readiness?.refresh();
        router.replace(COMMERCIAL_OS_ROUTES.connected);
      }

      if (error) {
        const customer = formatXeroOAuthError(error);
        toast.error(customer.message, { description: customer.action });
        router.replace(COMMERCIAL_OS_ROUTES.connected);
      }
    };

    void run();
  }, [searchParams, router, refreshSystems, readiness]);

  useEffect(() => {
    if (!organizationId) {
      if (orgLoading) {
        setSystemsLoading(true);
        return;
      }
      setConnectedSystems([]);
      setXeroConnected(false);
      setXeroConnectionState('DISCONNECTED');
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
        let connectionState: XeroConnectionState = 'DISCONNECTED';

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
          const xeroStatus = (await xeroRes.json()) as {
            connected?: boolean;
            stale?: boolean;
            reauthorizationRequired?: boolean;
            transientRefreshFailure?: boolean;
            internalFailure?: boolean;
            tenantId?: string | null;
            connectionState?: XeroConnectionState;
          };
          connectionState =
            readiness && !readiness.loading
              ? readiness.connection.connectionState
              : computeXeroConnectionState({
                  connected: xeroStatus.connected,
                  stale: xeroStatus.stale,
                  reauthorizationRequired: xeroStatus.reauthorizationRequired,
                  transientRefreshFailure: xeroStatus.transientRefreshFailure,
                  internalFailure: xeroStatus.internalFailure,
                  tenantId: xeroStatus.tenantId,
                  invoiceMappingsComplete: null,
                });
          xeroIsConnected = connectionState !== 'DISCONNECTED';
          if (connectionState !== 'DISCONNECTED') {
            const presentation = presentXeroConnectionState(connectionState);
            cards.push({
              name: 'Xero',
              detail: presentation.detail,
              tag: 'Primary ledger',
              manageHref: COMMERCIAL_OS_ROUTES.connectedXero,
              badge: presentation.badge,
              badgeLabel: presentation.badgeLabel,
              ctaLabel: presentation.ctaLabel,
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
              name: 'Wise profile',
              detail: 'Saved · use Bank transfer (manual verification) for invoices',
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
          setXeroConnectionState(connectionState);
          setConnectedSystems(cards);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setSystemsError(
            error instanceof Error ? error.message : 'Could not load connected systems.'
          );
          setConnectedSystems([]);
          setXeroConnected(false);
          setXeroConnectionState('DISCONNECTED');
        }
      } finally {
        if (!cancelled) setSystemsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, orgLoading, refreshKey]);

  const displayedSystems = useMemo(() => {
    if (!connectedSystems) return connectedSystems;
    if (!readiness || readiness.loading) return connectedSystems;
    const presentation = presentXeroConnectionState(readiness.connection.connectionState);
    if (presentation.state === 'DISCONNECTED') {
      return connectedSystems.filter((system) => system.name !== 'Xero');
    }
    const xeroCard: ConnectedSystem = {
      name: 'Xero',
      detail: presentation.detail,
      tag: 'Primary ledger',
      manageHref: COMMERCIAL_OS_ROUTES.connectedXero,
      badge: presentation.badge,
      badgeLabel: presentation.badgeLabel,
      ctaLabel: presentation.ctaLabel,
    };
    const withoutXero = connectedSystems.filter((system) => system.name !== 'Xero');
    return [xeroCard, ...withoutXero];
  }, [connectedSystems, readiness]);

  const xeroStatusKnown = !systemsLoading && xeroConnected !== null;
  const liveXeroConnected = Boolean(
    displayedSystems?.some((system) => system.name === 'Xero') || xeroConnected
  );
  const liveXeroState =
    readiness && !readiness.loading
      ? readiness.connection.connectionState
      : xeroConnectionState;

  const view = buildConnectedSystemsPresentation({
    accounting,
    xeroConnected: liveXeroConnected,
    xeroConnectionState: liveXeroState,
    connectionKnown: xeroStatusKnown,
    entitlementsLoading: entitlements.loading,
    hasActiveFirstPartyTrial: entitlements.entitlements?.hasActiveFirstPartyTrial ?? false,
    trialExpired: entitlements.entitlements?.trialExpired ?? false,
    trialEndsAt: entitlements.entitlements?.trialEndsAt ?? null,
    xeroAllowed: entitlements.isAllowed('xero_integration'),
    plan: entitlements.plan,
  });

  const beginXeroConnect = () => {
    if (!view.xeroOffer?.showConnect) {
      return;
    }
    if (!organizationId) {
      toast.error('Workspace not ready yet. Complete workspace setup first.');
      return;
    }
    setXeroConnectDialogOpen(true);
  };

  const confirmXeroConnect = () => {
    if (!organizationId || !view.xeroOffer?.showConnect) return;
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
          {view.title}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">{view.description}</p>
        {view.trialNote ? (
          <p className="mt-3 max-w-2xl text-[13px] text-ink-soft">{view.trialNote}</p>
        ) : null}
      </header>

      {showXeroSuccess ? (
        <XeroOAuthSuccessBanner
          variant="commercial"
          continueHref={COMMERCIAL_OS_ROUTES.connectedXero}
          onDismiss={() => setShowXeroSuccess(false)}
        />
      ) : null}

      {organizationId && view.showReadinessBanner ? (
        <CommercialOsXeroReadinessBanner surface="connected-systems" />
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
            Checking connected systems…
          </div>
          <div className="mt-3">
            <ConnectedSystemsSkeleton />
          </div>
        </section>
      ) : systemsError ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-5">
          <p className="text-[14px] font-medium text-foreground">Could not load connected systems</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Check your internet connection, then try again.
          </p>
          <button
            type="button"
            onClick={refreshSystems}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </section>
      ) : displayedSystems && displayedSystems.length > 0 ? (
        <section>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Connected</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {displayedSystems.map((system) => {
              const actionRequired = system.badge === 'action_required';
              return (
              <div key={system.name} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-[13px] font-semibold">
                    {system.name.slice(0, 2)}
                  </div>
                  {actionRequired ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      {system.badgeLabel ?? 'Action required'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      {system.badgeLabel ?? 'Connected'}
                    </span>
                  )}
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
                      {system.ctaLabel ?? 'Manage'}
                    </Link>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        </section>
      ) : view.mode === 'legacy_empty' ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-[14px] font-medium text-foreground">No systems connected</p>
          <p className="mt-1 text-[13px] text-ink-soft">{view.description}</p>
        </section>
      ) : null}

      {view.xeroOffer ? (
        <section>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            {view.xeroOffer.kind === 'unavailable'
              ? 'Professional integrations'
              : view.xeroOffer.recommended
                ? 'Recommended next step'
                : 'Available on your trial'}
          </div>
          <div className="mt-3 max-w-xl">
            <div
              className={`rounded-2xl border bg-card p-5 shadow-card ${
                view.xeroOffer.recommended ? 'border-primary/30' : 'border-border'
              } ${view.xeroOffer.kind === 'unavailable' ? 'opacity-90' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[oklch(0.55_0.15_220)] text-[13px] font-bold text-white">
                    X
                  </div>
                  <div>
                    <div className="text-[14.5px] font-semibold">{view.xeroOffer.title}</div>
                    <div className="text-[12px] text-ink-soft">{view.xeroOffer.detail}</div>
                  </div>
                </div>
                {view.xeroOffer.showConnect ? null : (
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                    Not available
                  </span>
                )}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                {view.xeroOffer.explanation}
              </p>
              {view.xeroOffer.showConnect ? (
                <button
                  type="button"
                  disabled={connecting}
                  onClick={beginXeroConnect}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {connecting ? 'Connecting…' : 'Connect Xero'}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

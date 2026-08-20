'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Share2,
  AlertTriangle,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import { useReferralManagement } from '@/hooks/use-referral-management';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AgreementIntelligenceParticipantDetail } from '@/components/journey/lovable/agreement-intelligence-participant-detail';
import { ParticipantCoordinationSummary } from '@/components/journey/lovable/agreement-intelligence-participant-status';
import type { ReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function AddPromoterForm({
  catalog,
  busy,
  onSubmit,
}: {
  catalog: ReferralManagementContext['catalog'];
  busy: boolean;
  onSubmit: ReturnType<typeof useReferralManagement>['addPromoter'];
}) {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<'revenue_share' | 'fixed'>('revenue_share');

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add promoter
      </Button>
    );
  }

  if (catalog.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] text-amber-900 dark:text-amber-200">
        Add an active catalogue service before creating a promoter. A checkout destination will not be fabricated.
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const serviceId = String(data.get('serviceId') ?? '');
        const ok = await onSubmit(
          kind === 'revenue_share'
            ? {
                name: String(data.get('name') ?? ''),
                email: String(data.get('email') ?? ''),
                phone: String(data.get('phone') ?? '') || undefined,
                role: (String(data.get('role') ?? 'Promoter') || 'Promoter') as
                  | 'Promoter'
                  | 'Affiliate'
                  | 'Partner'
                  | 'Other',
                compensation: {
                  kind: 'revenue_share',
                  percentage: Number(data.get('percentage')),
                  serviceId,
                },
              }
            : {
                name: String(data.get('name') ?? ''),
                email: String(data.get('email') ?? ''),
                phone: String(data.get('phone') ?? '') || undefined,
                role: (String(data.get('role') ?? 'Promoter') || 'Promoter') as
                  | 'Promoter'
                  | 'Affiliate'
                  | 'Partner'
                  | 'Other',
                compensation: {
                  kind: 'fixed',
                  amount: Number(data.get('amount')),
                  currency: 'AUD',
                  serviceId,
                },
              }
        );
        if (ok) {
          toast.success('Promoter added');
          setOpen(false);
          form.reset();
        }
      }}
    >
      <p className="text-[13px] font-semibold">Add promoter</p>
      <Input name="name" required placeholder="Name / business name" />
      <Input name="email" type="email" required placeholder="Email" />
      <Input name="phone" placeholder="Phone (optional)" />
      <select
        name="role"
        className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        defaultValue="Promoter"
      >
        <option>Promoter</option>
        <option>Affiliate</option>
        <option>Partner</option>
        <option>Other</option>
      </select>
      <select
        name="serviceId"
        required
        className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
      >
        {catalog.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2 text-[13px]">
        <button type="button" onClick={() => setKind('revenue_share')} className={kind === 'revenue_share' ? 'font-semibold' : 'text-ink-soft'}>
          Revenue share
        </button>
        <button type="button" onClick={() => setKind('fixed')} className={kind === 'fixed' ? 'font-semibold' : 'text-ink-soft'}>
          Fixed commission
        </button>
      </div>
      {kind === 'revenue_share' ? (
        <Input name="percentage" type="number" min={0.01} max={100} step="0.01" required defaultValue={20} />
      ) : (
        <Input name="amount" type="number" min={0.01} step="0.01" required placeholder="Fixed amount" />
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save promoter
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReferralManagementHubScreen() {
  const { getBySlug, loading: workflowsLoading, refresh: refreshWorkflows } = useDeployedWorkflows();
  const template = getWorkflowBySlug('referral-management');
  const installed = getBySlug('referral-management');
  const { context, loading, error, busy, addPromoter, coordinatePromoter } = useReferralManagement(
    installed?.id ?? null
  );
  const [selectedParticipantId, setSelectedParticipantId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setSelectedParticipantId(new URLSearchParams(window.location.search).get('participant'));
  }, []);

  const selectParticipant = React.useCallback((participantId: string | null) => {
    setSelectedParticipantId(participantId);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (participantId) url.searchParams.set('participant', participantId);
    else url.searchParams.delete('participant');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  const resume = React.useCallback(async () => {
    if (!installed?.id) return;
    const res = await csrfAwareFetch(`/api/workflows/${installed.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'DEPLOYED' }),
    });
    if (res.ok) {
      toast.success('Referral Management resumed');
      await refreshWorkflows();
    }
  }, [installed?.id, refreshWorkflows]);

  if (workflowsLoading || loading) {
    return (
      <div className="animate-fade-up py-16 text-center text-[13px] text-ink-soft">
        Loading workflow…
      </div>
    );
  }

  if (!installed || !context) {
    return (
      <div className="animate-fade-up space-y-6 pb-16">
        <Link
          href={COMMERCIAL_OS_ROUTES.workspace}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workspace
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-xl font-semibold">Referral Management</h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            This workflow is not installed in your workspace yet.
          </p>
          <Link
            href={COMMERCIAL_OS_ROUTES.workflowDetail('referral-management')}
            className="mt-4 inline-flex rounded-xl bg-gradient-purple px-4 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            Add from Workflow Library
          </Link>
        </div>
      </div>
    );
  }

  const selected = context.promoters.find((row) => row.id === selectedParticipantId) ?? null;

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <Link
        href={COMMERCIAL_OS_ROUTES.workspace}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workspace
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-primary">
            <Share2 className="h-5 w-5" />
            <span className="text-[12px] font-semibold uppercase tracking-wide">Workflow</span>
          </div>
          <h1 className="text-2xl font-semibold">{template?.name ?? 'Referral Management'}</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {template?.summary ?? 'Manage promoters, affiliates and referral revenue from one place.'}
          </p>
        </div>
        {!context.paused ? (
          <AddPromoterForm catalog={context.catalog} busy={busy} onSubmit={addPromoter} />
        ) : null}
      </div>

      {context.paused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-[13px] text-amber-900 dark:text-amber-200">{context.pauseMessage}</p>
          <Button type="button" variant="outline" onClick={() => void resume()}>
            Resume workflow
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-[13px] text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Revenue generated" value={context.metrics.revenueGeneratedLabel} />
        <MetricCard label="Commission earned" value={context.metrics.commissionEarnedLabel} />
        <MetricCard label="Active promoters" value={context.metrics.activePromoters} />
        <MetricCard label="Pending payouts" value={context.metrics.pendingPayouts} />
      </div>

      {selected ? (
        <div className="space-y-4">
          <AgreementIntelligenceParticipantDetail
            participant={selected}
            activity={context.activity}
            coordinationBlocked={context.paused}
            busy={busy}
            onBack={() => selectParticipant(null)}
            onAction={(action, extra) => coordinatePromoter(selected.id!, action, extra)}
            showReferralManagementHandoff={false}
          />
          {context.performance[selected.id ?? ''] ? (
            <div className="rounded-xl border border-border bg-secondary/10 p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Performance</p>
              <p className="mt-2 text-[14px]">
                Revenue referred {context.performance[selected.id ?? ''].revenueLabel}
              </p>
              <p className="text-[14px]">
                Commission earned {context.performance[selected.id ?? ''].commissionLabel}
              </p>
              <p className="text-[14px]">
                Conversions {context.performance[selected.id ?? ''].conversions}
              </p>
            </div>
          ) : null}
          <Link
            href={context.handoff.obligationsUrl}
            className="inline-flex text-[13px] font-medium text-primary"
          >
            View in Revenue Sharing
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Needs attention</h2>
            {context.needsAttention.length === 0 ? (
              <p className="text-[13px] text-ink-soft">No promoter actions waiting.</p>
            ) : (
              <ul className="space-y-2">
                {context.needsAttention.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => item.participantId && selectParticipant(item.participantId)}
                      className="flex w-full items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                      <span>
                        <span className="block text-[14px] font-medium">{item.label}</span>
                        <span className="text-[13px] text-ink-soft">{item.detail}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="promoters" className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Promoters</h2>
            {context.promoters.length === 0 ? (
              <p className="text-[13px] text-ink-soft">
                Add a promoter to start acquiring referral revenue. No agreement upload is required.
              </p>
            ) : (
              <ul className="space-y-3">
                {context.promoters.map((promoter) => (
                  <li
                    key={promoter.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <div>
                      <p className="font-medium">{promoter.name}</p>
                      <p className="text-[13px] text-ink-soft">
                        {promoter.compensationLabel ?? 'Compensation not configured'}
                        {promoter.referral?.destinationLabel
                          ? ` · ${promoter.referral.destinationLabel}`
                          : ''}
                      </p>
                      <p className="text-[13px] text-ink-soft">
                        {context.performance[promoter.id ?? '']?.revenueLabel ?? '$0'} referred revenue
                      </p>
                      <div className="mt-2">
                        <ParticipantCoordinationSummary participant={promoter} />
                      </div>
                    </div>
                    <Button type="button" variant="outline" onClick={() => selectParticipant(promoter.id)}>
                      Manage
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Activity</h2>
            {context.activity.length === 0 ? (
              <p className="text-[13px] text-ink-soft">No promoter activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {context.activity.slice(0, 12).map((item) => (
                  <li key={item.id} className="text-[13px]">
                    <span className="font-medium">{item.label}</span>
                    {item.detail ? <span className="text-ink-soft"> — {item.detail}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

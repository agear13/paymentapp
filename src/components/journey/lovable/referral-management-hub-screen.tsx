'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Share2,
  Package,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import { useReferralManagement } from '@/hooks/use-referral-management';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AgreementIntelligenceInputModal } from '@/components/journey/lovable/agreement-intelligence-input-modal';
import { ReferralImportReview } from '@/components/journey/lovable/referral-import-review';
import { candidateToPromoterInput } from '@/lib/workflows/referral-management/import-from-extraction';
import type { ReferralImportPreview } from '@/lib/workflows/referral-management/import-from-extraction';
import type { AddPromoterInput, AddPromoterResult } from '@/hooks/use-referral-management';
import { AgreementIntelligenceParticipantDetail } from '@/components/journey/lovable/agreement-intelligence-participant-detail';
import { ParticipantCoordinationSummary } from '@/components/journey/lovable/agreement-intelligence-participant-status';
import { ReferralEligibleServicesPicker, PromoterEligibleServicesEditor } from '@/components/journey/lovable/referral-management-eligible-services';
import { ReferralManagementServicesPanel } from '@/components/journey/lovable/referral-management-services-panel';
import { ReferralAttentionSummary } from '@/components/journey/lovable/referral-management-attention';
import type { ReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';
import {
  filterCountsForPromoters,
  promoterMatchesFilter,
  type ReferralPromoterFilter,
} from '@/lib/workflows/referral-management/attention';

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
  error,
  onSubmit,
  onExtract,
  onImported,
  onManageServices,
}: {
  catalog: ReferralManagementContext['catalog'];
  busy: boolean;
  error: string | null;
  onSubmit: (body: AddPromoterInput) => Promise<AddPromoterResult>;
  onExtract: ReturnType<typeof useReferralManagement>['extractReferralRelationships'];
  onImported: (participantId?: string) => void;
  onManageServices: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'choose' | 'manual' | 'import'>('choose');
  const [kind, setKind] = React.useState<'revenue_share' | 'fixed'>('revenue_share');
  const [importOpen, setImportOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<ReferralImportPreview | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [serviceIds, setServiceIds] = React.useState<string[]>(() =>
    catalog[0] ? [catalog[0].id] : []
  );

  React.useEffect(() => {
    if (serviceIds.length === 0 && catalog[0]) {
      setServiceIds([catalog[0].id]);
    }
  }, [catalog, serviceIds.length]);

  const reset = () => {
    setOpen(false);
    setMode('choose');
    setPreview(null);
    setImportError(null);
    setImportOpen(false);
  };

  if (!open) {
    return (
      <Button type="button" onClick={() => { setOpen(true); setMode('choose'); }}>
        <Plus className="mr-2 h-4 w-4" />
        Add promoter
      </Button>
    );
  }

  if (mode === 'choose') {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-[13px] font-semibold">Add promoter</p>
        <p className="text-[13px] text-ink-soft">
          Create the referral relationship here. You do not need to leave Referral Management.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setMode('manual')}>
            Manually add
          </Button>
          <Button type="button" variant="outline" onClick={() => { setMode('import'); setImportOpen(true); }}>
            From agreement or conversation
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'import') {
    return (
      <>
        <AgreementIntelligenceInputModal
          open={importOpen}
          onOpenChange={(next) => {
            if (!next && !preview) reset();
            else setImportOpen(next);
          }}
          submitting={busy}
          title="From agreement or conversation"
          uploadDescription="Upload a signed or unsigned agreement, supplier agreement, invoice, or similar commercial document. Provvy uses the existing Agreement Intelligence extractor."
          pasteLabel="Agreement or conversation"
          pastePlaceholder="Paste an agreement, invoice, email, WhatsApp, SMS, Telegram, or other conversation…"
          onUpload={async (file) => {
            const next = await onExtract({ file });
            if (!next) return false;
            setPreview(next);
            setImportOpen(false);
            return true;
          }}
          onPaste={async (text) => {
            const next = await onExtract({
              text,
              sourceLabel: 'Pasted agreement or conversation',
            });
            if (!next) return false;
            setPreview(next);
            setImportOpen(false);
            return true;
          }}
        />
        {preview ? (
          <ReferralImportReview
            preview={preview}
            catalog={catalog}
            busy={busy}
            error={importError ?? error}
            onChange={setPreview}
            onBack={reset}
            onConfirm={async () => {
              setImportError(null);
              const selected = preview.candidates.filter((row) => row.selected);
              if (selected.length === 0) {
                setImportError('Select at least one referral relationship to add.');
                return;
              }
              let lastId: string | undefined;
              let reused = false;
              for (const candidate of selected) {
                const mapped = candidateToPromoterInput(candidate);
                if ('error' in mapped) {
                  setImportError(mapped.error);
                  return;
                }
                const result = await onSubmit({ ...mapped, reuseExisting: true });
                if (!result.ok) return;
                lastId = result.participantId;
                reused = Boolean(result.reused);
              }
              toast.success(reused && selected.length === 1 ? 'Existing promoter opened' : 'Promoter added');
              reset();
              onImported(lastId);
            }}
          />
        ) : !importOpen ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  if (catalog.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] text-amber-900 dark:text-amber-200">
        <p>Add an active service before creating a promoter. A checkout destination will not be fabricated.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onManageServices}>
            Manage services
          </Button>
          <Button type="button" variant="outline" onClick={reset}>
            Back
          </Button>
        </div>
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
        if (serviceIds.length === 0) {
          toast.error('Select at least one eligible service.');
          return;
        }
        const result = await onSubmit(
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
                  serviceIds,
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
                  serviceIds,
                },
              }
        );
        if (result.ok) {
          toast.success('Promoter added');
          reset();
          form.reset();
          onImported(result.participantId);
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
      <ReferralEligibleServicesPicker
        catalog={catalog}
        selectedIds={serviceIds}
        onChange={setServiceIds}
        disabled={busy}
      />
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
        <Button type="button" variant="outline" onClick={reset}>
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
  const { context, loading, error, busy, addPromoter, extractReferralRelationships, coordinatePromoter, updateEligibleServices, refresh } =
    useReferralManagement(installed?.id ?? null);
  const [selectedParticipantId, setSelectedParticipantId] = React.useState<string | null>(null);
  const [hubView, setHubView] = React.useState<'overview' | 'services'>('overview');
  const [promoterFilter, setPromoterFilter] = React.useState<ReferralPromoterFilter>('all');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setSelectedParticipantId(params.get('participant'));
    setHubView(params.get('view') === 'services' ? 'services' : 'overview');
  }, []);

  const syncUrl = React.useCallback((next: { participantId?: string | null; view?: 'overview' | 'services' }) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (next.participantId) {
      url.searchParams.set('participant', next.participantId);
      url.searchParams.delete('view');
    } else {
      url.searchParams.delete('participant');
      if (next.view === 'services') url.searchParams.set('view', 'services');
      else url.searchParams.delete('view');
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  const selectParticipant = React.useCallback((participantId: string | null) => {
    setSelectedParticipantId(participantId);
    setHubView('overview');
    syncUrl({ participantId, view: 'overview' });
  }, [syncUrl]);

  const selectView = React.useCallback((view: 'overview' | 'services') => {
    setSelectedParticipantId(null);
    setHubView(view);
    syncUrl({ participantId: null, view });
  }, [syncUrl]);

  const focusPromoterFilter = React.useCallback((filter: ReferralPromoterFilter) => {
    setSelectedParticipantId(null);
    setHubView('overview');
    setPromoterFilter(filter);
    syncUrl({ participantId: null, view: 'overview' });
    window.requestAnimationFrame(() => {
      document.getElementById('promoters')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [syncUrl]);

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
  const promoterCounts = filterCountsForPromoters(context.promoters);
  const visiblePromoters = context.promoters.filter((row) =>
    promoterMatchesFilter(row, promoterFilter)
  );
  const attentionCount = promoterCounts.attention;

  const filterChips: Array<{ id: ReferralPromoterFilter; label: string }> = [
    { id: 'all', label: `All ${promoterCounts.all}` },
    { id: 'attention', label: `Needs attention ${promoterCounts.attention}` },
    { id: 'commission_review', label: `Ready for review ${promoterCounts.commission_review}` },
    { id: 'approval_required', label: `Awaiting approval ${promoterCounts.approval_required}` },
    { id: 'payout_details', label: `Payout details ${promoterCounts.payout_details}` },
    { id: 'payout_flagged', label: `Payout updates ${promoterCounts.payout_flagged}` },
    { id: 'ready', label: `Ready to activate ${promoterCounts.ready}` },
    { id: 'active', label: `Active ${promoterCounts.active}` },
  ].filter((chip) => chip.id === 'all' || chip.id === promoterFilter || promoterCounts[chip.id] > 0);

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
        <div className="flex flex-wrap gap-2">
          {hubView !== 'services' ? (
            <Button type="button" variant="outline" onClick={() => selectView('services')}>
              <Package className="mr-2 h-4 w-4" />
              Manage services
            </Button>
          ) : null}
          {!context.paused ? (
            <AddPromoterForm
              catalog={context.catalog}
              busy={busy}
              error={error}
              onSubmit={addPromoter}
              onExtract={extractReferralRelationships}
              onImported={(participantId) => {
                if (participantId) selectParticipant(participantId);
              }}
              onManageServices={() => selectView('services')}
            />
          ) : null}
        </div>
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

      {hubView === 'services' ? (
        <div className="space-y-4">
          <Button type="button" variant="ghost" onClick={() => selectView('overview')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Referral Management
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Services</h2>
            <p className="mt-1 text-[14px] text-ink-soft">
              First create the services you want promoted, then assign them to promoters.
            </p>
          </div>
          <ReferralManagementServicesPanel onChanged={() => void refresh()} />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Revenue generated" value={context.metrics.revenueGeneratedLabel} />
            <MetricCard label="Commission earned" value={context.metrics.commissionEarnedLabel} />
            <MetricCard label="Active promoters" value={context.metrics.activePromoters} />
            <MetricCard label="Pending payouts" value={context.metrics.pendingPayouts} />
          </div>

          {context.catalog.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-[13px] text-ink-soft">
                First create the services you want promoted, then assign them to promoters.
              </p>
              <Button type="button" variant="outline" onClick={() => selectView('services')}>
                Manage services
              </Button>
            </div>
          ) : null}

          {selected ? (
            <div className="space-y-4">
              <AgreementIntelligenceParticipantDetail
                participant={selected}
                activity={context.activity}
                coordinationBlocked={context.paused}
                busy={busy}
                onBack={() => selectParticipant(null)}
                onAction={(action, extra) => coordinatePromoter(selected.id!, action, extra)}
                onIdentityUpdated={() => void refresh()}
                onAddReplacement={() => selectParticipant(null)}
                showReferralManagementHandoff={false}
              />
              <PromoterEligibleServicesEditor
                catalog={context.catalog}
                selectedIds={selected.eligibleServiceIds}
                busy={busy || context.paused}
                onSave={async (nextIds) => {
                  if (!selected.id) return;
                  const ok = await updateEligibleServices(selected.id, nextIds);
                  if (ok) toast.success('Eligible services updated');
                }}
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
                <ReferralAttentionSummary
                  items={context.needsAttention}
                  onReviewKind={focusPromoterFilter}
                  onSelectParticipant={selectParticipant}
                />
              </section>

              <section id="promoters" className="space-y-3 scroll-mt-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Promoters</h2>
                    <p className="text-[13px] text-ink-soft">
                      {promoterCounts.all} total
                      {attentionCount > 0 ? ` · ${attentionCount} need attention` : ''}
                    </p>
                  </div>
                </div>
                {context.promoters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {filterChips.map((chip) => (
                      <Button
                        key={chip.id}
                        type="button"
                        size="sm"
                        variant={promoterFilter === chip.id ? 'default' : 'outline'}
                        onClick={() => setPromoterFilter(chip.id)}
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {context.promoters.length === 0 ? (
                  <p className="text-[13px] text-ink-soft">
                    Add a promoter to start acquiring referral revenue. No agreement upload is required.
                  </p>
                ) : visiblePromoters.length === 0 ? (
                  <p className="text-[13px] text-ink-soft">No promoters match this filter.</p>
                ) : (
                  <ul className="space-y-3">
                    {visiblePromoters.map((promoter) => (
                      <li
                        key={promoter.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="min-w-0 flex-1">
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
                          <ParticipantCoordinationSummary participant={promoter} />
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
        </>
      )}
    </div>
  );
}

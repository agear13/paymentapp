'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Landmark } from 'lucide-react';
import {
  COMMERCIAL_OS_ROUTES,
  settlementEarningsHref,
  settlementObligationsHref,
  settlementScopeQuery,
  settlementSectionHref,
  type SettlementWorkspaceSection,
} from '@/lib/journey/commercial-os-routes';
import { useWorkspaceSettlement } from '@/hooks/use-workspace-settlement';
import {
  countSettlementFilters,
  groupAttentionBlockers,
  moneyLabel,
  SETTLEMENT_SOURCE_FILTERS,
  SETTLEMENT_SOURCE_LABELS,
  SETTLEMENT_STATUS_FILTERS,
  SETTLEMENT_STATUS_LABELS,
  type SettlementObligationRow,
  type SettlementReleaseRow,
  type SettlementStatusFilter,
} from '@/lib/settlement/workspace-settlement';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Section = SettlementWorkspaceSection;

function sourceFromParam(value: string | null): string {
  return SETTLEMENT_SOURCE_FILTERS.includes(value as (typeof SETTLEMENT_SOURCE_FILTERS)[number])
    ? (value as string)
    : 'all';
}

function statusFromParam(value: string | null): string {
  return SETTLEMENT_STATUS_FILTERS.includes(value as SettlementStatusFilter)
    ? (value as string)
    : 'all';
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function SettlementChrome({
  section,
  source,
  participant,
  children,
}: {
  section: Section;
  source: string;
  participant: string | null;
  children: ReactNode;
}) {
  const scope = settlementScopeQuery({
    source: source === 'all' ? undefined : source,
    participant: participant ?? undefined,
  });
  const tabs: Array<{ id: Section; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'obligations', label: 'Obligations' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'releases', label: 'Releases' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-ink-soft">
          <Landmark className="h-4 w-4" />
          <p className="text-[12px] font-medium uppercase tracking-wide">Settlement</p>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settlement</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">
          How much the business owes, what can be paid, what needs attention, and what to do next.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={settlementSectionHref(tab.id, scope)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
              section === tab.id
                ? 'bg-accent text-accent-foreground'
                : 'text-ink-soft hover:bg-secondary hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

function ScopeBanner({
  participantName,
  source,
  section,
}: {
  participantName: string;
  source: string;
  section: Section;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
      <p className="text-[14px] font-medium">Showing settlement for {participantName}</p>
      <Link
        href={settlementSectionHref(section, {
          source: source === 'all' ? undefined : source,
        })}
        className="text-[13px] font-medium text-primary"
      >
        Clear filter
      </Link>
    </div>
  );
}

function FilterBar({
  source,
  status,
  participant,
  counts,
  showStatus,
}: {
  source: string;
  status: string;
  participant: string | null;
  counts: ReturnType<typeof countSettlementFilters>;
  showStatus: boolean;
}) {
  const scope = {
    source: source === 'all' ? undefined : source,
    participant: participant ?? undefined,
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SETTLEMENT_SOURCE_FILTERS.filter(
          (value) => value === 'all' || value === source || counts.sources[value] > 0
        ).map((value) => (
          <Link
            key={value}
            href={settlementObligationsHref({
              ...scope,
              source: value === 'all' ? undefined : value,
              status: status !== 'all' ? status : undefined,
            })}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] font-medium',
              source === value
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-ink-soft hover:bg-secondary'
            )}
          >
            {value === 'all' ? 'All sources' : SETTLEMENT_SOURCE_LABELS[value]} {counts.sources[value]}
          </Link>
        ))}
      </div>
      {showStatus ? (
        <div className="flex flex-wrap gap-2">
          {SETTLEMENT_STATUS_FILTERS.map((value) => (
            <Link
              key={value}
              href={settlementObligationsHref({
                ...scope,
                status: value === 'all' ? undefined : value,
              })}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-medium',
                status === value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-ink-soft hover:bg-secondary'
              )}
            >
              {value === 'all' ? 'All statuses' : SETTLEMENT_STATUS_LABELS[value]}{' '}
              {counts.statuses[value]}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ObligationsTable({
  rows,
  empty,
}: {
  rows: SettlementObligationRow[];
  empty: string;
}) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-ink-soft">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-left text-[13px]">
        <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-ink-soft">
          <tr>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Relationship</th>
            <th className="px-3 py-2 font-medium">Participant</th>
            <th className="px-3 py-2 font-medium">Amount owed</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Next action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-t border-border hover:bg-secondary/30"
              onClick={() => router.push(COMMERCIAL_OS_ROUTES.settlementObligation(row.id))}
            >
              <td className="px-3 py-3 font-medium">{row.sourceLabel}</td>
              <td className="px-3 py-3 text-ink-soft">{row.relationshipLabel}</td>
              <td className="px-3 py-3">{row.participantName}</td>
              <td className="px-3 py-3 font-medium">{moneyLabel(row.amountOwed, row.currency)}</td>
              <td className="px-3 py-3">{row.workspaceStatusLabel}</td>
              <td className="px-3 py-3 text-ink-soft">{row.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkspaceSettlementScreen({ section }: { section: Section }) {
  const searchParams = useSearchParams();
  const source = sourceFromParam(searchParams.get('source'));
  const status = statusFromParam(searchParams.get('status'));
  const participant = searchParams.get('participant');
  const data = useWorkspaceSettlement({ source, status, participant });
  const scopedRows = useMemo(
    () =>
      data.obligations.filter((row) => {
        if (source !== 'all' && row.source !== source) return false;
        if (participant && row.participantId !== participant) return false;
        return true;
      }),
    [data.obligations, source, participant]
  );
  const counts = useMemo(() => countSettlementFilters(scopedRows), [scopedRows]);
  const blockers = useMemo(
    () => groupAttentionBlockers(data.filtered),
    [data.filtered]
  );
  const readyRows = data.filtered.filter((row) => row.workspaceStatus === 'ready');
  const recentReleases = data.releases.slice(0, 4);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const participantName =
    data.obligations.find((row) => row.participantId === participant)?.participantName ??
    data.earnings.find((row) => row.participantId === participant)?.participantName ??
    null;
  const scope = settlementScopeQuery({
    source: source === 'all' ? undefined : source,
    participant: participant ?? undefined,
  });

  const selectedRows = data.filtered.filter((row) => selected.includes(row.id));
  const selectedByParticipant = useMemo(() => {
    const groups = new Map<string, SettlementObligationRow[]>();
    for (const row of selectedRows) {
      const key = row.participantId ?? row.id;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.values()];
  }, [selectedRows]);

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const confirmRelease = async () => {
    const participantIds = [
      ...new Set(selectedRows.map((row) => row.participantId).filter(Boolean)),
    ] as string[];
    if (participantIds.length === 0) {
      toast.error('Select ready obligations with a participant to create a release.');
      return;
    }
    const result = await data.createRelease({
      participantIds,
      currency: selectedRows[0]?.currency ?? 'AUD',
    });
    if (result.ok) {
      toast.success('Release batch created.');
      setSelected([]);
      setReviewing(false);
    } else {
      toast.error(result.error);
    }
  };

  if (data.loading) {
    return (
      <SettlementChrome section={section} source={source} participant={participant}>
        <p className="text-[13px] text-ink-soft">Loading settlement…</p>
      </SettlementChrome>
    );
  }

  return (
    <SettlementChrome section={section} source={source} participant={participant}>
      {participant && participantName ? (
        <ScopeBanner participantName={participantName} source={source} section={section} />
      ) : null}
      {data.error ? (
        <p className="rounded-xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-[13px]">
          {data.error}
        </p>
      ) : null}

      {section === 'overview' ? (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Owed" value={moneyLabel(data.summary.owed, data.summary.currency)} />
            <MetricCard
              label="Pending"
              value={moneyLabel(data.summary.pending, data.summary.currency)}
              hint={`${data.summary.pendingCount} obligation${data.summary.pendingCount === 1 ? '' : 's'} with no action required`}
            />
            <MetricCard
              label="Requires action"
              value={moneyLabel(data.summary.requiresAction, data.summary.currency)}
              hint={`${data.summary.requiresActionParticipants} participant${data.summary.requiresActionParticipants === 1 ? '' : 's'}`}
            />
            <MetricCard
              label="Ready for payout"
              value={moneyLabel(data.summary.readyForPayout, data.summary.currency)}
              hint={`${data.summary.readyCount} obligation${data.summary.readyCount === 1 ? '' : 's'}`}
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                Requires attention
              </h2>
              <Link
                href={settlementObligationsHref({ ...scope, status: 'requires_action' })}
                className="text-[13px] font-medium text-primary"
              >
                View all
              </Link>
            </div>
            {blockers.length === 0 ? (
              <p className="text-[13px] text-ink-soft">No settlement actions required right now.</p>
            ) : (
              <ul className="space-y-2">
                {blockers.map((item) => (
                  <li key={item.issue}>
                    <Link
                      href={
                        item.count === 1
                          ? COMMERCIAL_OS_ROUTES.settlementObligation(item.firstObligationId)
                          : settlementObligationsHref({ ...scope, status: 'requires_action' })
                      }
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary/30"
                    >
                      <p className="text-[14px] font-medium">{item.issue}</p>
                      <p className="text-[13px] text-ink-soft">
                        {item.count} · {moneyLabel(item.amount, item.currency)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                Ready for payout
              </h2>
              <Link
                href={settlementObligationsHref({ ...scope, status: 'ready' })}
                className="text-[13px] font-medium text-primary"
              >
                View all
              </Link>
            </div>
            {readyRows.length === 0 ? (
              <p className="text-[13px] text-ink-soft">Nothing is ready to enter a release yet.</p>
            ) : (
              <ul className="space-y-2">
                {readyRows.slice(0, 4).map((row) => (
                  <li key={row.id}>
                    <Link
                      href={COMMERCIAL_OS_ROUTES.settlementObligation(row.id)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary/30"
                    >
                      <p className="text-[14px]">
                        {row.participantName} · {row.relationshipLabel}
                      </p>
                      <p className="font-medium">{moneyLabel(row.amountOwed, row.currency)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-secondary/10 p-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
              Commercial movement · {data.movement.periodLabel}
            </h2>
            <p className="text-[12px] text-ink-soft">
              Activity recorded this month. These figures are not the same as what is currently owed.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Earned"
                value={moneyLabel(data.movement.earned, data.movement.currency)}
                hint="Referral attribution commissions recorded this month"
              />
              <MetricCard
                label="Released"
                value={moneyLabel(data.movement.released, data.movement.currency)}
                hint="Release batches started this month"
              />
              <MetricCard
                label="Paid to date"
                value={moneyLabel(data.movement.paidToDate, data.movement.currency)}
                hint="Payment receipt dates are not available — showing confirmed paid totals"
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                Recent releases
              </h2>
              <Link
                href={settlementSectionHref('releases', scope)}
                className="text-[13px] font-medium text-primary"
              >
                View all
              </Link>
            </div>
            <ReleaseList rows={recentReleases} empty="No payout releases yet." />
          </section>
        </div>
      ) : null}

      {section === 'obligations' ? (
        <div className="space-y-4">
          <FilterBar
            source={source}
            status={status}
            participant={participant}
            counts={counts}
            showStatus
          />
          <ObligationsTable rows={data.filtered} empty="No obligations match this view." />
        </div>
      ) : null}

      {section === 'earnings' ? (
        <div className="space-y-6">
          <p className="rounded-xl border border-border bg-secondary/20 px-4 py-3 text-[13px] text-ink-soft">
            This view currently shows referral attribution commissions. Agreement and revenue-share
            earnings appear on Obligations when those workflows produce payment obligations.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Earned"
              value={moneyLabel(
                data.earnings.reduce((sum, row) => sum + row.earned, 0),
                data.earnings[0]?.currency ?? 'AUD'
              )}
            />
            <MetricCard
              label="Unpaid"
              value={moneyLabel(
                data.earnings.reduce((sum, row) => sum + row.unpaid, 0),
                data.earnings[0]?.currency ?? 'AUD'
              )}
            />
            <MetricCard
              label="Paid"
              value={moneyLabel(
                data.earnings.reduce((sum, row) => sum + row.paid, 0),
                data.earnings[0]?.currency ?? 'AUD'
              )}
            />
          </div>
          {data.earnings.length === 0 ? (
            <p className="text-[13px] text-ink-soft">No attribution commissions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 font-medium">Participant</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Relationship</th>
                    <th className="px-3 py-2 font-medium">Earned</th>
                    <th className="px-3 py-2 font-medium">Unpaid</th>
                    <th className="px-3 py-2 font-medium">Paid</th>
                    <th className="px-3 py-2 font-medium">Settlement status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.earnings.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-3 font-medium">{row.participantName}</td>
                      <td className="px-3 py-3">{row.sourceLabel}</td>
                      <td className="px-3 py-3 text-ink-soft">{row.relationshipLabel}</td>
                      <td className="px-3 py-3">{moneyLabel(row.earned, row.currency)}</td>
                      <td className="px-3 py-3">{moneyLabel(row.unpaid, row.currency)}</td>
                      <td className="px-3 py-3">{moneyLabel(row.paid, row.currency)}</td>
                      <td className="px-3 py-3">
                        <Link
                          href={settlementObligationsHref({
                            ...scope,
                            participant: row.participantId,
                          })}
                          className="text-primary hover:underline"
                        >
                          {row.settlementStatusLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {section === 'releases' ? (
        <div className="space-y-6">
          {data.releasesRestricted ? (
            <p className="rounded-xl border border-border bg-secondary/20 px-4 py-3 text-[13px] text-ink-soft">
              Release history may be restricted in this environment. Ready obligations can still be
              reviewed here.
            </p>
          ) : null}
          {reviewing ? (
            <section className="space-y-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-[15px] font-semibold">Review release</h2>
              <p className="text-[13px] text-ink-soft">
                You selected {selectedRows.length} obligation{selectedRows.length === 1 ? '' : 's'}{' '}
                across {selectedByParticipant.length} participant
                {selectedByParticipant.length === 1 ? '' : 's'}. The existing release engine groups
                these by participant into one release batch.
              </p>
              <ul className="space-y-3">
                {selectedByParticipant.map((group) => (
                  <li key={group[0]?.participantId ?? group[0]?.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{group[0]?.participantName}</p>
                    <ul className="mt-2 space-y-1 text-[13px] text-ink-soft">
                      {group.map((row) => (
                        <li key={row.id}>
                          {row.relationshipLabel} · {moneyLabel(row.amountOwed, row.currency)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={data.creatingRelease} onClick={() => void confirmRelease()}>
                  Confirm release
                </Button>
                <Button type="button" variant="outline" onClick={() => setReviewing(false)}>
                  Back to selection
                </Button>
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                  Ready for payout
                </h2>
                <Button
                  type="button"
                  size="sm"
                  disabled={selected.length === 0}
                  onClick={() => setReviewing(true)}
                >
                  Review release
                </Button>
              </div>
              {readyRows.length === 0 ? (
                <p className="text-[13px] text-ink-soft">
                  No obligations are ready to enter a release batch yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {readyRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <label className="flex items-center gap-3 text-[14px]">
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={() => toggleSelected(row.id)}
                        />
                        <span>
                          {row.participantName} · {row.relationshipLabel}
                        </span>
                      </label>
                      <span className="font-medium">{moneyLabel(row.amountOwed, row.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <ReleaseGroups
            releases={data.releases}
            onCancelDraft={data.cancelRelease}
            cancelling={data.cancellingRelease}
          />
        </div>
      ) : null}
    </SettlementChrome>
  );
}

function ReleaseList({
  rows,
  empty,
  onCancelDraft,
  cancelling,
}: {
  rows: SettlementReleaseRow[];
  empty: string;
  onCancelDraft?: (batchId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  cancelling?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-ink-soft">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <div>
            <p className="text-[14px] font-medium">{row.label}</p>
            <p className="text-[12px] text-ink-soft">
              {row.statusLabel} · {row.payoutCount} participant{row.payoutCount === 1 ? '' : 's'}
              {row.paymentNote ? ` · ${row.paymentNote}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-medium">{moneyLabel(row.totalAmount, row.currency)}</p>
            {row.cancellable && onCancelDraft ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cancelling}
                onClick={() => {
                  void onCancelDraft(row.id).then((result) => {
                    if (result.ok) {
                      toast.success('Draft release cancelled. Obligations are ready for payout again.');
                    } else {
                      toast.error(result.error);
                    }
                  });
                }}
              >
                Cancel draft
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReleaseGroups({
  releases,
  onCancelDraft,
  cancelling,
}: {
  releases: SettlementReleaseRow[];
  onCancelDraft?: (batchId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  cancelling?: boolean;
}) {
  const groups: Array<{ id: SettlementReleaseRow['paymentState']; title: string }> = [
    { id: 'draft', title: 'Draft releases' },
    { id: 'released', title: 'Released' },
    { id: 'paid', title: 'Paid' },
    { id: 'failed', title: 'Failed' },
  ];
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            {group.title}
          </h2>
          <ReleaseList
            rows={releases.filter((row) => row.paymentState === group.id)}
            empty={`No ${group.title.toLowerCase()}.`}
            onCancelDraft={onCancelDraft}
            cancelling={cancelling}
          />
        </section>
      ))}
    </div>
  );
}

export function WorkspaceSettlementObligationDetailScreen({
  obligationId,
}: {
  obligationId: string;
}) {
  const searchParams = useSearchParams();
  const source = sourceFromParam(searchParams.get('source'));
  const participant = searchParams.get('participant');
  const data = useWorkspaceSettlement();
  const row = data.obligations.find((item) => item.id === obligationId);
  const earning = data.earnings.find((item) => item.participantId === row?.participantId);
  const scope = settlementScopeQuery({
    source: row?.source ?? (source === 'all' ? undefined : source),
    participant: row?.participantId ?? participant ?? undefined,
  });

  if (data.loading) {
    return (
      <SettlementChrome section="obligations" source={source} participant={participant}>
        <p className="text-[13px] text-ink-soft">Loading obligation…</p>
      </SettlementChrome>
    );
  }

  if (!row) {
    return (
      <SettlementChrome section="obligations" source={source} participant={participant}>
        <p className="text-[13px] text-ink-soft">This obligation is not available in Settlement.</p>
        <Link href={settlementObligationsHref(scope)} className="text-[13px] font-medium text-primary">
          Back to obligations
        </Link>
      </SettlementChrome>
    );
  }

  return (
    <SettlementChrome section="obligations" source={row.source} participant={row.participantId}>
      <div className="space-y-6">
        <Link
          href={settlementObligationsHref(scope)}
          className="text-[13px] text-ink-soft hover:text-foreground"
        >
          Back to obligations
        </Link>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">
            {row.sourceLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{row.participantName}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{row.relationshipLabel}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Amount owed" value={moneyLabel(row.amountOwed, row.currency)} />
          <MetricCard label="Status" value={row.workspaceStatusLabel} />
          <MetricCard label="Next action" value={row.nextAction} />
        </div>
        {row.reason ? (
          <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 px-4 py-3">
            <p className="text-[12px] font-medium uppercase tracking-wide">Reason</p>
            <p className="mt-1 text-[14px]">{row.reason}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {row.source === 'referral-management' && row.participantId ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={COMMERCIAL_OS_ROUTES.workflowParticipant(
                  'referral-management',
                  row.participantId
                )}
              >
                View participant
              </Link>
            </Button>
          ) : null}
          {row.participantId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={settlementEarningsHref(scope)}>View earnings</Link>
            </Button>
          ) : null}
        </div>
        {earning ? (
          <p className="text-[13px] text-ink-soft">
            Attribution commissions earned {moneyLabel(earning.earned, earning.currency)} · unpaid{' '}
            {moneyLabel(earning.unpaid, earning.currency)} · paid {moneyLabel(earning.paid, earning.currency)}.
          </p>
        ) : null}
      </div>
    </SettlementChrome>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type ObligationRow = {
  id: string;
  deal_id: string;
  participant_id: string | null;
  obligation_type: string;
  amount_owed: unknown;
  currency: string;
  status: string;
  participant: {
    name: string;
    role: string;
    approvalStatus?: string;
    onboardingStatus?: string;
  } | null;
};

function formatMoney(amount: unknown, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency || 'AUD',
    maximumFractionDigits: 2,
  }).format(n);
}

function obligationStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'funded':
    case 'ready':
    case 'available_for_payout':
      return 'Ready to pay';
    case 'pending':
    case 'unfunded':
    case 'draft':
      return 'Awaiting funding';
    case 'released':
    case 'paid':
      return 'Completed';
    case 'blocked':
    case 'pending_approval':
      return 'Blocked';
    case 'partially_funded':
      return 'Partially funded';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function CommercialWorkspaceObligationsPanel() {
  const { deal, projectId } = useProjectWorkspace();
  const [rows, setRows] = React.useState<ObligationRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!deal) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/deal-network-pilot/obligations?dealId=${encodeURIComponent(deal.id)}`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok) {
          if (!cancelled) setRows([]);
          return;
        }
        const json = (await res.json()) as { data: ObligationRow[] };
        if (!cancelled) {
          setRows(Array.isArray(json.data) ? json.data.filter((r) => r.deal_id === deal.id) : []);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deal]);

  if (!deal) return null;

  return (
    <div className="space-y-4" data-testid="commercial-workspace-obligations">
      <div>
        <h2 className="text-[16px] font-semibold">Obligations</h2>
        <p className="mt-1 max-w-xl text-[13px] text-ink-soft">
          Derived from participants and funding on this workspace. These rows are not edited here.
        </p>
      </div>

      {loading ? (
        <p className="text-[13px] text-ink-soft">Loading obligations…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-[14px] text-ink-soft">
            No derived obligations yet. Add participants with earnings, then obligations appear from
            the existing refresh pipeline.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const blockedByApproval =
              row.status.toLowerCase() === 'blocked' ||
              row.status.toLowerCase() === 'pending_approval' ||
              row.participant?.approvalStatus === 'Pending approval';
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
                data-testid="workspace-obligation-row"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold">
                      {row.participant?.name ?? 'Unassigned'}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      {row.obligation_type.replace(/_/g, ' ')}
                      {row.participant?.role ? ` · ${row.participant.role}` : ''}
                    </p>
                    {blockedByApproval ? (
                      <p className="mt-2 text-[12px] text-ink-soft">
                        Blocked by participant coordination or approval.{' '}
                        <Link
                          href={COMMERCIAL_OS_ROUTES.arrangementPeople(projectId)}
                          className="font-medium text-primary hover:underline"
                        >
                          Open People
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-semibold tabular-nums">
                      {formatMoney(row.amount_owed, row.currency)}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-soft">
                      {obligationStatusLabel(row.status)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href={COMMERCIAL_OS_ROUTES.settlementObligations}
        className="inline-flex text-[13px] font-medium text-primary hover:underline"
      >
        Open Settlement obligations
      </Link>
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { ProjectFundingSourcesPanel } from '@/components/projects/project-funding-sources-panel';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import { toOperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-client';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { AttachedWorkspaceInvoice } from '@/lib/commercial-os/attached-invoices';

type OrgInvoiceOption = {
  id: string;
  invoiceReference?: string | null;
  shortCode?: string | null;
  description?: string;
  amount?: number;
  currency?: string;
  status?: string;
  pilotDealId?: string | null;
};

export function CommercialWorkspaceMoneyPanel() {
  const { deal, summary, projectId, projectParticipants, refresh, invalidate } =
    useProjectWorkspace();
  const { reloadCoordinationSnapshot } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    treasury: summary?.treasury ?? undefined,
    enabled: Boolean(deal),
    traceSurface: 'commercial-workspace-money',
  });
  const [attached, setAttached] = React.useState<AttachedWorkspaceInvoice[]>([]);
  const [orgInvoices, setOrgInvoices] = React.useState<OrgInvoiceOption[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState('');
  const [attaching, setAttaching] = React.useState(false);

  const operationalSyncHandlers = React.useMemo(
    () =>
      toOperationalSyncHandlers({
        invalidate,
        refreshSilent: (scope) => refresh({ scope: scope ?? 'all', silent: true, force: true }),
        reloadCoordinationSnapshot,
        notifyActivation: notifyWorkspaceActivationRefresh,
        onAudit: appendOperationalAuditEntry,
      }),
    [invalidate, refresh, reloadCoordinationSnapshot]
  );

  const loadInvoices = React.useCallback(async () => {
    if (!deal) return;
    try {
      const [attachedRes, listRes] = await Promise.all([
        fetch(`/api/deal-network-pilot/deals/${encodeURIComponent(deal.id)}/invoices`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/payment-links?limit=50', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (attachedRes.ok) {
        const json = (await attachedRes.json()) as { data: AttachedWorkspaceInvoice[] };
        setAttached(Array.isArray(json.data) ? json.data : []);
      } else {
        setAttached([]);
      }
      if (listRes.ok) {
        const json = (await listRes.json()) as { data: OrgInvoiceOption[] };
        setOrgInvoices(Array.isArray(json.data) ? json.data : []);
      } else {
        setOrgInvoices([]);
      }
    } catch {
      setAttached([]);
      setOrgInvoices([]);
    }
  }, [deal]);

  React.useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const attachable = orgInvoices.filter((invoice) => !invoice.pilotDealId);

  async function attachSelectedInvoice() {
    if (!deal || !selectedInvoiceId) return;
    setAttaching(true);
    try {
      const res = await csrfAwareFetch(
        `/api/deal-network-pilot/deals/${encodeURIComponent(deal.id)}/attach-invoice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentLinkId: selectedInvoiceId }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'Could not attach invoice');
        return;
      }
      toast.success('Invoice attached to this workspace');
      setSelectedInvoiceId('');
      await loadInvoices();
      void refresh({ scope: 'all', silent: true, force: true });
    } catch {
      toast.error('Could not attach invoice');
    } finally {
      setAttaching(false);
    }
  }

  if (!deal || !summary) return null;

  const defaultCurrency = summary.currencyLabel.includes('AUD') ? 'AUD' : 'USD';

  return (
    <div className="space-y-6" data-testid="commercial-workspace-money">
      <div>
        <h2 className="text-[16px] font-semibold">Money</h2>
        <p className="mt-1 max-w-xl text-[13px] text-ink-soft">
          Workspace funding and attached invoices. Create or manage invoices in Receivables, then
          attach them here so the payment link is bound to this workspace.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Commercial value
          </div>
          <div className="mt-2 text-[15px] font-semibold">{summary.currencyLabel}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Settlement readiness
          </div>
          <div className="mt-2 text-[15px] font-semibold">{summary.payoutLabel}</div>
          <p className="mt-1 text-[12px] text-ink-soft">{summary.fundingLabel}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-[14px] font-semibold">Attached invoices</h3>
        <p className="mt-1 text-[12px] text-ink-soft">
          Invoices are organization-scoped. This list shows payment links already bound to this
          operator-owned workspace.
        </p>
        {attached.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-soft">No invoices attached yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attached.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-3 text-[13px]">
                <Link href={invoice.href} className="font-medium text-primary hover:underline">
                  {invoice.invoiceReference || invoice.shortCode || invoice.id}
                </Link>
                <span className="text-ink-soft">{invoice.status}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block min-w-[16rem] flex-1 text-[12px] text-ink-soft">
            Attach existing invoice
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground"
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              data-testid="workspace-attach-invoice-select"
            >
              <option value="">Select an invoice…</option>
              {attachable.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceReference || invoice.shortCode || invoice.id}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={!selectedInvoiceId || attaching}
            onClick={() => void attachSelectedInvoice()}
            data-testid="workspace-attach-invoice"
          >
            {attaching ? 'Attaching…' : 'Attach invoice'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
          <Link href={COMMERCIAL_OS_ROUTES.createInvoice} className="font-medium text-primary hover:underline">
            Create invoice in Receivables
          </Link>
          <Link href={COMMERCIAL_OS_ROUTES.invoiceList} className="font-medium text-primary hover:underline">
            Open Receivables
          </Link>
          <Link href={COMMERCIAL_OS_ROUTES.settlement} className="font-medium text-primary hover:underline">
            Open Settlement
          </Link>
        </div>
      </div>

      <ProjectFundingSourcesPanel
        projectId={projectId}
        defaultCurrency={defaultCurrency}
        operationalSyncHandlers={operationalSyncHandlers}
        onTreasuryChange={() => void refresh({ scope: 'all', silent: true, force: true })}
      />
    </div>
  );
}

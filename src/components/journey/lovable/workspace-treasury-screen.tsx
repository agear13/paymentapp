'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { TreasuryManualReconciliationPanel } from '@/components/journey/lovable/treasury-manual-reconciliation-panel';
import { TreasuryAccountingPanel } from '@/components/journey/lovable/treasury-accounting-panel';

type ActivityFilter =
  | 'all'
  | 'needs_review'
  | 'unknown'
  | 'ambiguous'
  | 'exceptions'
  | 'awaiting_bank';

type TreasuryTab = 'activity' | 'accounting';

type ActivityRow = {
  id: string;
  occurredAt: string;
  eventType: string;
  asset: string | null;
  destinationAsset: string | null;
  amount: string | null;
  destinationAmount: string | null;
  provider: string;
  status: string;
  invoiceReference: string | null;
  paymentLinkId: string | null;
};

type MetricsPayload = {
  totalCryptoReceived: number;
  totalCryptoTransferred: number;
  totalExchangeDeposits: number;
  totalConvertedToFiatAud: number;
  audAwaitingWithdrawal: number;
  audAwaitingBankConfirmation: number;
  fullyReconciledChains: number;
  exceptionsRequiringReview: number;
  partialChains: number;
  unknownEvents: number;
};

const FILTER_OPTIONS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'unknown', label: 'Unknown' },
  { id: 'ambiguous', label: 'Ambiguous' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'awaiting_bank', label: 'Awaiting bank' },
];

function formatEventLabel(row: ActivityRow): string {
  if (row.eventType === 'CONVERSION') {
    return 'Conversion';
  }
  const meta = row.eventType.replaceAll('_', ' ').toLowerCase();
  return meta.charAt(0).toUpperCase() + meta.slice(1);
}

function formatAmount(row: ActivityRow): string {
  if (row.eventType === 'CONVERSION') {
    return `${row.amount ?? '—'} → ${row.destinationAmount ?? '—'} ${row.destinationAsset ?? 'AUD'}`;
  }
  const sign = row.amount?.startsWith('-') ? '' : '+';
  return `${sign}${row.amount ?? '—'} ${row.asset ?? ''}`.trim();
}

function statusBadge(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'INFERRED':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'EXCEPTION':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    default:
      return 'bg-secondary text-ink-soft';
  }
}

function formatMetric(value: number, suffix = ''): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function DigitalSurgeConnectForm({
  organizationId,
  onConnected,
}: {
  organizationId: string | null;
  onConnected: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    if (!organizationId || !apiKey.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(
        `/api/treasury/connections/digital-surge?organizationId=${encodeURIComponent(organizationId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to connect');
      }
      setApiKey('');
      onConnected();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-[15px] font-semibold">Connect Digital Surge (read-only)</h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        Provvy observes deposits, conversions, and AUD credits. It cannot execute swaps or withdraw funds.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-[12px] text-ink-soft">
          API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-foreground"
            placeholder="Bearer read-only key"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !apiKey.trim()}
          className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Connect'}
        </button>
      </div>
      {formError ? <p className="mt-2 text-[12px] text-red-600">{formError}</p> : null}
    </div>
  );
}

export function WorkspaceTreasuryScreen() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [tab, setTab] = useState<TreasuryTab>('activity');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dsConnected, setDsConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const filterParam = filter !== 'all' ? `&filter=${encodeURIComponent(filter)}` : '';
      const [eventsRes, connRes, metricsRes] = await Promise.all([
        fetch(
          `/api/treasury/events?organizationId=${encodeURIComponent(organizationId)}${filterParam}`
        ),
        fetch(
          `/api/treasury/connections/digital-surge?organizationId=${encodeURIComponent(organizationId)}`
        ),
        fetch(`/api/treasury/metrics?organizationId=${encodeURIComponent(organizationId)}`),
      ]);
      if (!eventsRes.ok) throw new Error('Failed to load treasury activity');
      const eventsData = (await eventsRes.json()) as { activity: ActivityRow[] };
      setActivity(eventsData.activity ?? []);
      if (connRes.ok) {
        const connData = (await connRes.json()) as { connected: boolean };
        setDsConnected(connData.connected);
      }
      if (metricsRes.ok) {
        const metricsData = (await metricsRes.json()) as { metrics: MetricsPayload };
        setMetrics(metricsData.metrics ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load treasury data');
    } finally {
      setLoading(false);
    }
  }, [organizationId, filter]);

  useEffect(() => {
    if (!orgLoading && organizationId) {
      void load();
    }
  }, [orgLoading, organizationId, load]);

  const triggerSync = async () => {
    if (!organizationId) return;
    setSyncing(true);
    try {
      await fetch(
        `/api/treasury/connections/digital-surge?organizationId=${encodeURIComponent(organizationId)}`,
        { method: 'PUT' }
      );
      await load();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={COMMERCIAL_OS_ROUTES.payments}
            className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Payments
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Treasury</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            Reconciliation activity and accountant-grade treasury accounting views
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={COMMERCIAL_OS_ROUTES.connected}
            className="rounded-xl border border-border bg-card px-4 py-2 text-[13px] font-medium"
          >
            Connected Systems
          </Link>
          <button
            type="button"
            onClick={() => void triggerSync()}
            disabled={syncing || !dsConnected}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-[13px] font-medium disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Digital Surge
          </button>
        </div>
      </div>

      {dsConnected === false && (
        <DigitalSurgeConnectForm organizationId={organizationId} onConnected={() => void load()} />
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-800">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(
          [
            { id: 'activity' as const, label: 'Activity & reconciliation' },
            { id: 'accounting' as const, label: 'Accounting intelligence' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${
              tab === t.id
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-card text-ink-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounting' ? (
        <TreasuryAccountingPanel organizationId={organizationId} />
      ) : (
        <>
      {metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Crypto received', value: formatMetric(metrics.totalCryptoReceived) },
            { label: 'Crypto transferred', value: formatMetric(metrics.totalCryptoTransferred) },
            { label: 'DS deposits', value: formatMetric(metrics.totalExchangeDeposits) },
            { label: 'Converted to AUD', value: formatMetric(metrics.totalConvertedToFiatAud, ' AUD') },
            { label: 'AUD at exchange', value: formatMetric(metrics.audAwaitingWithdrawal, ' AUD') },
            {
              label: 'Awaiting bank confirmation',
              value: formatMetric(metrics.audAwaitingBankConfirmation, ' AUD'),
            },
            { label: 'Fully reconciled', value: String(metrics.fullyReconciledChains) },
            { label: 'Exceptions to review', value: String(metrics.exceptionsRequiringReview) },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="text-[11px] uppercase tracking-wide text-ink-soft">{card.label}</div>
              <div className="mt-1 text-[18px] font-semibold">{card.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
              filter === opt.id
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-card text-ink-soft'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <TreasuryManualReconciliationPanel
        organizationId={organizationId}
        visible={filter === 'needs_review' || filter === 'exceptions' || filter === 'ambiguous'}
        onLinked={() => void load()}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-border bg-secondary/40 text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Related invoice</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : activity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                    {filter === 'all'
                      ? 'No treasury events yet. Crypto customer payments will appear here after confirmation.'
                      : 'No events match this filter.'}
                  </td>
                </tr>
              ) : (
                activity.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(row.occurredAt), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">{formatEventLabel(row)}</td>
                    <td className="px-4 py-3">
                      {row.eventType === 'CONVERSION'
                        ? `${row.asset ?? ''} → ${row.destinationAsset ?? 'AUD'}`
                        : (row.asset ?? '—')}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]">{formatAmount(row)}</td>
                    <td className="px-4 py-3 capitalize">{row.provider.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.invoiceReference && row.paymentLinkId ? (
                        <Link
                          href={COMMERCIAL_OS_ROUTES.invoiceDetail(row.invoiceReference, {
                            id: row.paymentLinkId,
                          })}
                          className="text-accent-foreground underline"
                        >
                          {row.invoiceReference}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-ink-soft">
        Reconciliation metrics summarise observed treasury events. They are not accounting balances.
        FACT, INFERRED, UNKNOWN, and EXCEPTION statuses are preserved — Provvy never silently upgrades
        an inference to a fact.
      </p>
        </>
      )}
    </div>
  );
}

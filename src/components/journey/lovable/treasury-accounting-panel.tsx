'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TreasuryAccountingDetailPanel } from '@/components/journey/lovable/treasury-accounting-detail-panel';
import type {
  TreasuryAccountingMetrics,
  TreasuryAccountingSummary,
  TreasuryAccountingView,
} from '@/lib/treasury/accounting/types';

type TreasuryAccountingPanelProps = {
  organizationId: string | null;
};

export function TreasuryAccountingPanel({ organizationId }: TreasuryAccountingPanelProps) {
  const [summaries, setSummaries] = useState<TreasuryAccountingSummary[]>([]);
  const [metrics, setMetrics] = useState<TreasuryAccountingMetrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TreasuryAccountingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/treasury/accounting?organizationId=${encodeURIComponent(organizationId)}&metrics=1`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        summaries: TreasuryAccountingSummary[];
        metrics?: TreasuryAccountingMetrics;
      };
      setSummaries(data.summaries ?? []);
      setMetrics(data.metrics ?? null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const loadDetail = useCallback(
    async (paymentLinkId: string) => {
      if (!organizationId) return;
      setDetailLoading(true);
      try {
        const res = await fetch(
          `/api/treasury/accounting/${encodeURIComponent(paymentLinkId)}?organizationId=${encodeURIComponent(organizationId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { accounting: TreasuryAccountingView };
        setDetail(data.accounting ?? null);
        setSelectedId(paymentLinkId);
      } finally {
        setDetailLoading(false);
      }
    },
    [organizationId]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading treasury accounting…
      </div>
    );
  }

  if (selectedId && detail) {
    return (
      <div>
        {detailLoading ? (
          <Loader2 className="mb-4 h-4 w-4 animate-spin text-ink-soft" />
        ) : null}
        <TreasuryAccountingDetailPanel
          view={detail}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold">Treasury Accounting</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          What Provvy knows, what Xero has recorded, and what still needs accountant attention.
        </p>
      </div>

      {metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Crypto awaiting conversion', value: metrics.cryptoAwaitingConversion },
            { label: 'Payments not at exchange', value: metrics.paymentsNotAtExchange },
            { label: 'AUD at exchange', value: metrics.audAtExchange },
            { label: 'AUD awaiting bank', value: metrics.audAwaitingBankConfirmation },
            { label: 'Exchange fees (observed)', value: metrics.exchangeFeesTotal },
            { label: 'Items requiring review', value: metrics.itemsRequiringAccountantReview },
            { label: 'Fully reconciled chains', value: metrics.fullyReconciledChains },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="text-[11px] uppercase tracking-wide text-ink-soft">{card.label}</div>
              <div className="mt-1 text-[18px] font-semibold">{card.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-border bg-secondary/40 text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Chain status</th>
              <th className="px-4 py-3 font-medium">Xero payment</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {summaries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                  No paid invoices with treasury data yet.
                </td>
              </tr>
            ) : (
              summaries.map((row) => (
                <tr key={row.paymentLinkId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">{row.invoiceReference ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-[12px]">
                    {row.invoiceAmount ?? '—'} {row.invoiceCurrency ?? ''}
                  </td>
                  <td className="px-4 py-3">{row.asset ?? '—'}</td>
                  <td className="px-4 py-3 capitalize">
                    {row.chainStatus.replaceAll('_', ' ').toLowerCase()}
                  </td>
                  <td className="px-4 py-3">
                    {row.xeroPaymentPosted ? 'Posted' : 'Not posted'}
                    {row.requiresReview ? ' · Review' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="rounded-lg bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground"
                      onClick={() => void loadDetail(row.paymentLinkId)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-ink-soft">
        Metrics summarise observed treasury events. They are not accounting balances unless backed by
        confirmed data. Conversion and fees require accountant treatment — Provvy does not post these
        to Xero automatically.
      </p>
    </div>
  );
}

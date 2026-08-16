'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type LifecycleStep = {
  stage: string;
  label: string;
  status: string;
  detail?: string;
};

type ChainNode = {
  stage: string;
  label: string;
  status: string;
  eventType: string;
  asset: string | null;
  destinationAsset?: string | null;
  amount: string | null;
  destinationAmount?: string | null;
  feeAmount?: string | null;
  exchangeRate?: string | null;
  provider: string | null;
  occurredAt: string | null;
  transactionReference: string | null;
  providerReference: string | null;
  evidence: {
    strategy: string | null;
    linkType?: string;
    linkStatus?: string;
    manual: boolean;
  } | null;
};

type ReconciliationException = {
  type: string;
  severity: string;
  observed: string;
  expected: string;
  reason: string;
  suggestedAction: string;
};

type TreasuryReconciliationPayload = {
  chainStatus: string;
  steps: LifecycleStep[];
  nodes: ChainNode[];
  exceptions: ReconciliationException[];
  walletAddress: string | null;
  assetLabel: string | null;
};

function stepIcon(status: string): string {
  if (status === 'CONFIRMED') return '✓';
  if (status === 'INFERRED') return '?';
  if (status === 'EXCEPTION') return '⚠';
  if (status === 'NOT_APPLICABLE') return '—';
  return '?';
}

function chainStatusLabel(status: string): string {
  return status.replaceAll('_', ' ').toLowerCase();
}

function chainStatusBadge(status: string): string {
  if (status === 'RECONCILED') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (status === 'EXCEPTION') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  }
  if (status.startsWith('AWAITING')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  return 'bg-secondary text-ink-soft';
}

function formatNodeAmount(node: ChainNode): string | null {
  if (node.eventType === 'CONVERSION') {
    return `${node.amount ?? '—'} → ${node.destinationAmount ?? '—'} ${node.destinationAsset ?? 'AUD'}`;
  }
  if (node.amount) {
    return `${node.amount} ${node.asset ?? ''}`.trim();
  }
  return null;
}

type InvoiceTreasuryLifecyclePanelProps = {
  paymentLinkId: string;
  invoiceReference?: string | null;
  isPaid?: boolean;
};

export function InvoiceTreasuryLifecyclePanel({
  paymentLinkId,
  invoiceReference,
  isPaid = false,
}: InvoiceTreasuryLifecyclePanelProps) {
  const { organizationId } = useOrganization();
  const [payload, setPayload] = useState<TreasuryReconciliationPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId || !paymentLinkId || !isPaid) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/treasury/reconciliation/${encodeURIComponent(paymentLinkId)}?organizationId=${encodeURIComponent(organizationId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { reconciliation: TreasuryReconciliationPayload };
        setPayload(data.reconciliation ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId, paymentLinkId, isPaid]);

  if (!isPaid) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading treasury lifecycle…
      </div>
    );
  }

  if (!payload?.steps?.length) return null;

  const displayNodes = payload.nodes.length > 0 ? payload.nodes : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">Treasury</h3>
        <div className="flex items-center gap-2">
          {payload.chainStatus ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${chainStatusBadge(payload.chainStatus)}`}
            >
              {chainStatusLabel(payload.chainStatus)}
            </span>
          ) : null}
          <Link
            href={COMMERCIAL_OS_ROUTES.treasury}
            className="text-[12px] text-accent-foreground underline"
          >
            View activity
          </Link>
        </div>
      </div>
      {invoiceReference ? (
        <p className="mt-1 text-[12px] text-ink-soft">{invoiceReference}</p>
      ) : null}

      {displayNodes ? (
        <ol className="mt-4 space-y-4 border-l border-border pl-4">
          {displayNodes.map((node) => (
            <li key={`${node.stage}-${node.label}`} className="relative text-[13px]">
              <span
                className="absolute -left-[1.35rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card text-[11px]"
                aria-label={node.status}
              >
                {stepIcon(node.status)}
              </span>
              <div className="font-medium">{node.label}</div>
              {formatNodeAmount(node) ? (
                <div className="mt-0.5 font-mono text-[11px] text-ink-soft">
                  {formatNodeAmount(node)}
                  {node.feeAmount ? ` · fee ${node.feeAmount}` : ''}
                  {node.exchangeRate ? ` · rate ${node.exchangeRate}` : ''}
                </div>
              ) : null}
              {node.destinationAddress ? (
                <div className="mt-0.5 font-mono text-[11px] text-ink-soft">{node.destinationAddress}</div>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-ink-soft">
                {node.provider ? <span>{node.provider.replaceAll('_', ' ')}</span> : null}
                {node.occurredAt ? (
                  <span>{new Date(node.occurredAt).toLocaleString()}</span>
                ) : null}
                {node.transactionReference ? (
                  <span className="font-mono">tx {node.transactionReference.slice(0, 10)}…</span>
                ) : null}
                {node.evidence ? (
                  <span>
                    {node.evidence.manual ? 'Manual link' : node.evidence.strategy ?? 'Linked'}
                    {node.evidence.linkStatus ? ` (${node.evidence.linkStatus})` : ''}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="mt-4 space-y-3 border-l border-border pl-4">
          {payload.steps.map((step) => (
            <li key={step.stage} className="relative text-[13px]">
              <span
                className="absolute -left-[1.35rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card text-[11px]"
                aria-label={step.status}
              >
                {stepIcon(step.status)}
              </span>
              <div className="font-medium">{step.label}</div>
              {step.detail ? (
                <div className="mt-0.5 font-mono text-[11px] text-ink-soft">{step.detail}</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {payload.exceptions.length > 0 ? (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <h4 className="text-[13px] font-semibold">Reconciliation exceptions</h4>
          {payload.exceptions.map((ex) => (
            <div
              key={`${ex.type}-${ex.observed}`}
              className="rounded-xl border border-border/80 bg-secondary/20 p-3 text-[12px]"
            >
              <div className="font-medium capitalize">{ex.type.replaceAll('_', ' ')}</div>
              <p className="mt-1 text-ink-soft">
                <span className="font-medium">Observed:</span> {ex.observed}
              </p>
              <p className="mt-0.5 text-ink-soft">
                <span className="font-medium">Expected:</span> {ex.expected}
              </p>
              <p className="mt-0.5 text-ink-soft">
                <span className="font-medium">Why:</span> {ex.reason}
              </p>
              <p className="mt-0.5 text-ink-soft">
                <span className="font-medium">Action:</span> {ex.suggestedAction}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-[11px] text-ink-soft">
        {payload.chainStatus === 'RECONCILED'
          ? 'Full money lifecycle reconciled with confirmed bank receipt.'
          : payload.chainStatus === 'AWAITING_BANK_CONFIRMATION'
            ? 'Digital Surge AUD withdrawal is recorded. Bank receipt is not confirmed until independently verified.'
            : payload.exceptions.some((e) => e.type === 'unknown_wallet_movement')
              ? 'An outbound wallet movement was observed but is not deterministically linked to this invoice.'
              : 'Treasury events are factual observations. Conversion and bank settlement are not inferred without evidence.'}
      </p>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { ConnectedWiseInsight, WiseIntelligenceConsentState } from '@/lib/connected-intelligence/types';

function formatAud(amount: number | null): string {
  if (amount === null) return '—';
  return `A$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatIdr(amount: number | null): string {
  if (amount === null) return '—';
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} IDR`;
}

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return rate.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function ConnectedWiseIntelligencePanel({ organizationId }: { organizationId: string }) {
  const [consent, setConsent] = useState<WiseIntelligenceConsentState | null>(null);
  const [insight, setInsight] = useState<ConnectedWiseInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadConsent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/connected-intelligence/wise-consent?organizationId=${encodeURIComponent(organizationId)}`,
        { credentials: 'include', cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error('Could not load Wise intelligence consent');
      }
      setConsent((await response.json()) as WiseIntelligenceConsentState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load consent');
      setConsent(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadConsent();
  }, [loadConsent]);

  const updateConsent = async (consented: boolean) => {
    setBusy(true);
    setError(null);
    setInsight(null);
    try {
      const response = await csrfAwareFetch('/api/connected-intelligence/wise-consent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, consented }),
      });
      if (!response.ok) {
        throw new Error('Could not update Wise intelligence consent');
      }
      setConsent((await response.json()) as WiseIntelligenceConsentState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update consent');
    } finally {
      setBusy(false);
    }
  };

  const loadInsight = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await csrfAwareFetch('/api/connected-intelligence/wise-flagship', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      const payload = (await response.json()) as ConnectedWiseInsight | { error?: string };
      if (!response.ok) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Could not load connected Wise quote');
      }
      setInsight(payload as ConnectedWiseInsight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load connected Wise quote');
      setInsight(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="text-[13px] text-ink-soft">Checking Wise payment intelligence consent…</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Connected payment intelligence
        </div>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em]">Your connected Wise quote</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          Provvy can use your connected Wise account to observe real economics for an AU→ID /
          AUD→IDR supplier payment. Connecting Wise for invoices does not turn this on.
        </p>
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      {!consent?.connected ? (
        <p className="text-[13px] text-ink-soft">
          A Wise profile must be connected before payment intelligence can request a quote.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void updateConsent(!consent.consented)}
            className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
          >
            {consent.consented
              ? 'Stop using Wise for payment intelligence'
              : 'Use my connected Wise account for payment intelligence'}
          </button>
          {consent.consented ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadInsight()}
              className="rounded-xl bg-gradient-purple px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {busy ? 'Reading quote…' : 'Show AU→ID Wise economics'}
            </button>
          ) : (
            <p className="text-[12px] text-ink-soft">Consent is off. No Wise quote will be requested.</p>
          )}
        </div>
      )}

      {insight ? (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <h3 className="text-[14px] font-semibold">Your connected Wise quote</h3>
            <dl className="mt-2 grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-ink-soft">AUD amount</dt>
                <dd className="font-medium">{formatAud(insight.wise.sourceAmount)}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">IDR destination amount</dt>
                <dd className="font-medium">{formatIdr(insight.wise.destinationAmount)}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Explicit Wise fee</dt>
                <dd className="font-medium">
                  {insight.wise.feeAmount === null
                    ? 'Unknown'
                    : formatAud(insight.wise.feeAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">Wise quoted FX</dt>
                <dd className="font-medium">{formatRate(insight.wise.exchangeRate)} IDR per AUD</dd>
              </div>
            </dl>
            <p className="mt-2 text-[12px] text-ink-soft">
              This is a provider-quoted rate for your connected Wise profile. It is not an official
              reference and not an executed payment.
            </p>
          </div>

          <div>
            <h3 className="text-[14px] font-semibold">Official reference</h3>
            <p className="mt-1 text-[13px]">
              RBA AUD→IDR reference: {formatRate(insight.reference.exchangeRate)}{' '}
              <span className="text-ink-soft">
                ({insight.reference.status === 'known' ? 'official reference, not executable' : insight.reference.status})
              </span>
            </p>
          </div>

          <div>
            <h3 className="text-[14px] font-semibold">Provvy interpretation</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
              {insight.interpretation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {insight.unknowns.length > 0 ? (
              <p className="mt-2 text-[12px] text-ink-soft">{insight.unknowns.join(' ')}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

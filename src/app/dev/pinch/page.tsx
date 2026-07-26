'use client';

/**
 * TEMPORARY — Pinch CaptureJS → Source → Payment sandbox verifier.
 * Development only. Not part of the Commercial Workflow.
 *
 * /dev/pinch
 */

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

const CAPTUREJS_SRC = 'https://cdn.getpinch.com.au/capturejs/pinch.capture.v2.js';
const CAPTUREJS_INTEGRITY =
  'sha384-hglYFSKC4AMA/rAQOGB3OiA8u5ri5F4qNMGgw4I+fggDSlTmPyREcj1J+VGnkAX8';

const DEMO_AMOUNT_CENTS = 100;
const DEMO_DESCRIPTION = 'Provvypay Pinch sandbox end-to-end test';

type SourceType = 'bank-account' | 'credit-card';

type PinchCaptureInstance = {
  createToken: (options: Record<string, string>) => Promise<{ token: string }>;
};

declare global {
  interface Window {
    Pinch?: {
      Capture: (config: { publishableKey: string }) => PinchCaptureInstance;
    };
  }
}

function formatTransactionDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isProductionBuild(): boolean {
  return process.env.NODE_ENV === 'production';
}

export default function PinchDevPage() {
  const publishableKey = process.env.NEXT_PUBLIC_PINCH_PUBLISHABLE_KEY ?? '';

  const [captureReady, setCaptureReady] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('bank-account');
  const [payerId, setPayerId] = useState('');
  const [bankAccountName, setBankAccountName] = useState('Jane Smith');
  const [bankAccountRouting, setBankAccountRouting] = useState('000000');
  const [bankAccountNumber, setBankAccountNumber] = useState('000000000');
  const [cardNumber, setCardNumber] = useState('4242424242424242');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState('2030');
  const [cvc, setCvc] = useState('123');
  const [cardHolderName, setCardHolderName] = useState('Jane Smith');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureToken, setCaptureToken] = useState<string | null>(null);
  const [sourceResponse, setSourceResponse] = useState<unknown>(null);
  const [paymentResponse, setPaymentResponse] = useState<unknown>(null);

  useEffect(() => {
    if (isProductionBuild()) {
      return;
    }

    fetch('/api/pinch/dev-config')
      .then((res) => res.json())
      .then((data: { testPayerId?: string | null }) => {
        if (data.testPayerId) {
          setPayerId(data.testPayerId);
        }
      })
      .catch(() => {
        /* optional config */
      });
  }, []);

  const createCaptureToken = useCallback(async (): Promise<string> => {
    if (!publishableKey) {
      throw new Error('NEXT_PUBLIC_PINCH_PUBLISHABLE_KEY is not configured');
    }
    if (!window.Pinch) {
      throw new Error('Pinch CaptureJS is not loaded yet');
    }

    const capture = window.Pinch.Capture({ publishableKey });

    const tokenOptions =
      sourceType === 'bank-account'
        ? {
            sourceType: 'bank-account',
            bankAccountName,
            bankAccountRouting,
            bankAccountNumber,
          }
        : {
            sourceType: 'credit-card',
            cardNumber,
            expiryMonth,
            expiryYear,
            cvc,
            cardHolderName,
          };

    const result = await capture.createToken(tokenOptions);
    if (!result.token) {
      throw new Error('CaptureJS did not return a token');
    }

    return result.token;
  }, [
    publishableKey,
    sourceType,
    bankAccountName,
    bankAccountRouting,
    bankAccountNumber,
    cardNumber,
    expiryMonth,
    expiryYear,
    cvc,
    cardHolderName,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCaptureToken(null);
    setSourceResponse(null);
    setPaymentResponse(null);

    try {
      if (!payerId.trim()) {
        throw new Error('payerId is required (set PINCH_TEST_PAYER_ID or enter manually)');
      }

      const token = await createCaptureToken();
      setCaptureToken(token);

      const sourceRes = await csrfAwareFetch('/api/pinch/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payerId: payerId.trim(), token, sourceType }),
      });

      const sourceJson = await sourceRes.json();
      if (!sourceRes.ok) {
        throw new Error(`Source creation failed (${sourceRes.status}): ${JSON.stringify(sourceJson)}`);
      }

      setSourceResponse(sourceJson);

      const sourceId =
        typeof sourceJson === 'object' &&
        sourceJson !== null &&
        'id' in sourceJson &&
        typeof (sourceJson as { id: unknown }).id === 'string'
          ? (sourceJson as { id: string }).id
          : null;

      if (!sourceId) {
        throw new Error('Source response did not include an id');
      }

      const paymentRes = await csrfAwareFetch('/api/pinch/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: payerId.trim(),
          sourceId,
          amount: DEMO_AMOUNT_CENTS,
          transactionDate: formatTransactionDate(),
          description: DEMO_DESCRIPTION,
        }),
      });

      const paymentJson = await paymentRes.json();
      if (!paymentRes.ok) {
        throw new Error(`Payment creation failed (${paymentRes.status}): ${JSON.stringify(paymentJson)}`);
      }

      setPaymentResponse(paymentJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  };

  if (isProductionBuild()) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Pinch sandbox page is disabled in production builds.
        </p>
      </main>
    );
  }

  return (
    <>
      <Script
        src={CAPTUREJS_SRC}
        integrity={CAPTUREJS_INTEGRITY}
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={() => setCaptureReady(true)}
        onError={() => setError('Failed to load Pinch CaptureJS')}
      />

      <main className="mx-auto max-w-2xl space-y-6 p-8">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Temporary — development only
          </p>
          <h1 className="text-2xl font-semibold">Pinch Sandbox Flow</h1>
          <p className="text-sm text-muted-foreground">
            CaptureJS → POST /sources → POST /payments
          </p>
        </header>

        {!publishableKey && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Set <code className="font-mono">NEXT_PUBLIC_PINCH_PUBLISHABLE_KEY</code> in{' '}
            <code className="font-mono">.env.local</code> (same value as{' '}
            <code className="font-mono">PINCH_PUBLISHABLE_KEY</code>).
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="payerId">
              Payer ID
            </label>
            <input
              id="payerId"
              className="w-full rounded border px-3 py-2 font-mono text-sm"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              placeholder="pyr_..."
              required
            />
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium">Source type</span>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sourceType"
                  checked={sourceType === 'bank-account'}
                  onChange={() => setSourceType('bank-account')}
                />
                Bank account (direct debit)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sourceType"
                  checked={sourceType === 'credit-card'}
                  onChange={() => setSourceType('credit-card')}
                />
                Credit card
              </label>
            </div>
          </div>

          {sourceType === 'bank-account' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-sm font-medium">Account name</span>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">BSB</span>
                <input
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  value={bankAccountRouting}
                  onChange={(e) => setBankAccountRouting(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Account number</span>
                <input
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  required
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-sm font-medium">Cardholder name</span>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-sm font-medium">Card number</span>
                <input
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Expiry month</span>
                <input
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  value={expiryMonth}
                  onChange={(e) => setExpiryMonth(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Expiry year</span>
                <input
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  value={expiryYear}
                  onChange={(e) => setExpiryYear(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">CVC</span>
                <input
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  required
                />
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !captureReady || !publishableKey}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Running flow…' : captureReady ? 'Run Capture → Source → Payment' : 'Loading CaptureJS…'}
          </button>
        </form>

        {error && (
          <section className="rounded-md border border-red-300 bg-red-50 p-3">
            <h2 className="text-sm font-semibold text-red-800">Error</h2>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-red-900">{error}</pre>
          </section>
        )}

        {captureToken && (
          <DebugPanel title="1. CaptureJS token" data={{ token: captureToken }} />
        )}

        {sourceResponse !== null && (
          <DebugPanel title="2. Source response (POST /api/pinch/sources)" data={sourceResponse} />
        )}

        {paymentResponse !== null && (
          <DebugPanel title="3. Payment response (POST /api/pinch/payments)" data={paymentResponse} />
        )}
      </main>
    </>
  );
}

function DebugPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

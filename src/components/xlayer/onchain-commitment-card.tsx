'use client';

import { useCallback, useEffect, useState } from 'react';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { isXlayerCommitmentsEnabled, XLAYER_COMMITMENT_DISCLAIMER } from '@/lib/xlayer/chain';
import {
  connectCommitmentWallet,
  formatWalletAddress,
  getConnectedChainId,
  registerOnchainCommitment,
} from '@/lib/xlayer/metamask-commitment.client';
import type { XlayerCommitmentRecord, XlayerCommitmentView } from '@/lib/xlayer/types';

type UiPhase =
  | 'idle'
  | 'preparing'
  | 'wallet'
  | 'submitting'
  | 'verifying'
  | 'verified'
  | 'failed';

function moneyLabel(minorUnits: number, currency: string): string {
  const major = minorUnits / 100;
  const code = currency.trim() || 'AUD';
  const prefix = code === 'AUD' ? 'A$' : `${code} `;
  return `${prefix}${major.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;
}

export function OnchainCommitmentCard({
  agreementId,
}: {
  agreementId?: string | null;
}) {
  const [view, setView] = useState<XlayerCommitmentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UiPhase>('idle');

  const load = useCallback(async () => {
    if (!agreementId || !isXlayerCommitmentsEnabled()) {
      setView(null);
      return;
    }
    const params = new URLSearchParams({ agreementId });
    const response = await fetch(`/api/xlayer/commitments?${params}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const payload = (await response.json()) as XlayerCommitmentView & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to load on-chain commitment.');
      return;
    }
    setView(payload);
    if (payload.commitment?.verificationStatus === 'verified') setPhase('verified');
  }, [agreementId]);

  useEffect(() => {
    void load().catch(() => setError('Unable to load on-chain commitment.'));
  }, [load]);

  async function createOnchainCommitment() {
    if (!agreementId || !view?.enabled) return;
    setError(null);
    setPhase('preparing');
    try {
      const preparedResponse = await csrfAwareFetch('/api/xlayer/commitments/prepare', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId }),
      });
      const prepared = (await preparedResponse.json()) as XlayerCommitmentView & { error?: string };
      if (!preparedResponse.ok || !prepared.commitment) {
        setPhase('failed');
        setError(prepared.error ?? 'Unable to prepare the commercial commitment.');
        return;
      }
      setView(prepared);

      setPhase('wallet');
      const walletAddress = await connectCommitmentWallet();
      const chainId = await getConnectedChainId();
      const hash = await registerOnchainCommitment(prepared.commitment.registerArgs);

      setPhase('submitting');
      const submittedResponse = await csrfAwareFetch(
        `/api/xlayer/commitments/${prepared.commitment.id}/submit`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionHash: hash,
            walletAddress,
            chainId,
          }),
        }
      );
      const submitted = (await submittedResponse.json()) as {
        commitment?: XlayerCommitmentRecord;
        error?: string;
      };
      if (!submittedResponse.ok || !submitted.commitment) {
        setPhase('failed');
        setError(submitted.error ?? 'Unable to record the X Layer transaction.');
        return;
      }

      setPhase('verifying');
      const verifiedResponse = await csrfAwareFetch(
        `/api/xlayer/commitments/${submitted.commitment.id}/verify`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      const verified = (await verifiedResponse.json()) as {
        commitment?: XlayerCommitmentRecord;
        error?: string;
      };
      if (!verifiedResponse.ok || !verified.commitment) {
        setPhase('failed');
        setError(verified.error ?? 'Unable to verify commitment on X Layer');
        return;
      }
      setView((current) =>
        current ? { ...current, commitment: verified.commitment ?? current.commitment } : current
      );
      if (verified.commitment.verificationStatus === 'verified') {
        setPhase('verified');
      } else {
        setPhase('failed');
        setError('Unable to verify commitment on X Layer');
      }
    } catch (caught) {
      setPhase('failed');
      setError(caught instanceof Error ? caught.message : 'Unable to create the on-chain commitment.');
    }
  }

  if (!agreementId || !isXlayerCommitmentsEnabled()) return null;
  if (!view?.enabled) return null;
  if (!view.commitment && !view.preview) return null;

  const commitment = view.commitment;
  const details = commitment ??
    (view.preview
      ? {
          buyerLabel: view.preview.buyerLabel,
          supplierLabel: view.preview.supplierLabel,
          amountMinorUnits: view.preview.amountMinorUnits,
          sourceCurrency: view.preview.sourceCurrency,
          settlementCurrency: view.preview.settlementCurrency,
          dueDate: view.preview.dueDate,
          purpose: view.preview.purpose,
          originalDueLabel: view.preview.originalDueLabel,
          incentive: view.preview.incentive,
        }
      : null);
  const verified = commitment?.verificationStatus === 'verified';
  const statusLabel =
    phase === 'wallet'
      ? 'Waiting for wallet approval'
      : phase === 'submitting'
        ? 'Submitting to X Layer'
        : phase === 'verifying'
          ? 'Verifying commitment'
          : verified
            ? 'Commitment verified on X Layer'
            : phase === 'failed'
              ? 'Unable to verify commitment on X Layer'
              : phase === 'preparing'
                ? 'Preparing commercial commitment'
                : null;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
      data-testid="onchain-commitment-card"
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
        {verified ? 'X Layer commitment' : 'Commercial commitment'}
      </div>
      <p className="mt-2 text-[15px] font-semibold text-foreground">
        {verified ? 'Commitment verified on X Layer' : 'Create commercial commitment'}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        {verified
          ? 'Provvy recorded a verifiable commitment state on X Layer.'
          : 'Create a verifiable on-chain representation of this commercial commitment on X Layer.'}
      </p>

      {details ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-[13px]">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Buyer</div>
            <p className="mt-1 font-medium">{details.buyerLabel}</p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Supplier</div>
            <p className="mt-1 font-medium">{details.supplierLabel}</p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Amount</div>
            <p className="mt-1 font-medium">
              {moneyLabel(details.amountMinorUnits, details.sourceCurrency)}
            </p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Currencies</div>
            <p className="mt-1 font-medium">
              {details.sourceCurrency} → {details.settlementCurrency}
            </p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Due date</div>
            <p className="mt-1 font-medium">
              {details.dueDate ? new Date(details.dueDate).toISOString().slice(0, 10) : 'Not specified'}
            </p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Purpose</div>
            <p className="mt-1 font-medium">{details.purpose}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-ink-soft">
          Provvy will use the current extracted commercial terms. Nothing is written on-chain until
          you sign in MetaMask.
        </p>
      )}

      {details?.incentive ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-3 text-[13px]">
          <p className="font-medium text-foreground">Approved early-payment incentive</p>
          <ul className="mt-2 space-y-1 text-ink-soft">
            <li>Original agreement: {details.originalDueLabel ?? 'Net 30'}</li>
            <li>
              Provvy recommendation: Pay within {details.incentive.acceleratedDays} days →{' '}
              {details.incentive.incentivePercent}% incentive
            </li>
            <li>Human approved: Yes</li>
          </ul>
        </div>
      ) : null}

      {statusLabel ? (
        <p className="mt-4 text-[13px] font-medium text-foreground" data-testid="onchain-commitment-status">
          {statusLabel}
        </p>
      ) : null}

      {verified && commitment ? (
        <dl className="mt-4 space-y-1 text-[12px] text-ink-soft">
          <div>Network: X Layer Testnet</div>
          <div>Chain ID: {commitment.chainId}</div>
          <div>Commitment ID: {commitment.displayCommitmentId}</div>
          <div>
            Wallet:{' '}
            {commitment.walletAddress ? formatWalletAddress(commitment.walletAddress) : '—'}
          </div>
          <div>Transaction: {commitment.transactionHash}</div>
          <div>Contract: {commitment.contractAddress}</div>
          <div>Block: {commitment.blockNumber ?? '—'}</div>
          <div>On-chain status: {commitment.onchainStatus ?? 'registered'}</div>
          {commitment.explorerUrl ? (
            <div>
              <a
                href={commitment.explorerUrl}
                className="text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                View on explorer
              </a>
            </div>
          ) : null}
        </dl>
      ) : (
        <button
          type="button"
          disabled={phase === 'preparing' || phase === 'wallet' || phase === 'submitting' || phase === 'verifying'}
          onClick={() => void createOnchainCommitment()}
          className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
          data-testid="create-onchain-commitment"
        >
          Create on-chain commitment
        </button>
      )}

      {error ? <p className="mt-3 text-[12px] text-destructive">{error}</p> : null}
      <p className="mt-3 text-[11px] text-ink-soft">{view.disclaimer || XLAYER_COMMITMENT_DISCLAIMER}</p>
    </section>
  );
}

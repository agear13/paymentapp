'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaymentLinkDetails } from '@/components/payment-links/payment-link-detail-dialog';
import {
  fetchCryptoConfirmationsForOrg,
  fetchManualBankConfirmationsForOrg,
  fetchPaymentLinkDetail,
  fetchPaymentLinkLifecycle,
  fetchPaymentLinkQrCodeDataUrl,
  type CryptoConfirmationRow,
  type LifecycleSnapshot,
  type ManualBankConfirmationRow,
} from '@/lib/payment-links/payment-link-merchant-actions';
import { resolvePaymentLinkId } from '@/lib/payment-links/resolve-payment-link-by-reference';

export type PaymentLinkDetailLoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      paymentLinkId: string;
      detail: PaymentLinkDetails;
      lifecycle: LifecycleSnapshot | null;
      qrCodeUrl: string | null;
      cryptoConfirmation: CryptoConfirmationRow | null;
      manualBankConfirmation: ManualBankConfirmationRow | null;
    };

export function usePaymentLinkDetail(options: {
  organizationId: string | null;
  isOrgLoading: boolean;
  reference: string;
  knownId?: string | null;
}) {
  const { organizationId, isOrgLoading, reference, knownId } = options;
  const [state, setState] = useState<PaymentLinkDetailLoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (isOrgLoading) return;
    if (!organizationId) {
      setState({ status: 'error', message: 'Organization not found' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const paymentLinkId = await resolvePaymentLinkId({
        organizationId,
        reference,
        knownId,
      });
      if (!paymentLinkId) {
        setState({ status: 'not-found' });
        return;
      }

      const [detail, lifecycleResult, qrResult, cryptoRows, manualBankRows] = await Promise.all([
        fetchPaymentLinkDetail(paymentLinkId),
        fetchPaymentLinkLifecycle(paymentLinkId).catch(() => null),
        fetchPaymentLinkQrCodeDataUrl(paymentLinkId).catch(() => null),
        fetchCryptoConfirmationsForOrg(organizationId).catch(() => [] as CryptoConfirmationRow[]),
        fetchManualBankConfirmationsForOrg(organizationId).catch(
          () => [] as ManualBankConfirmationRow[]
        ),
      ]);

      const cryptoConfirmation =
        cryptoRows.find((row) => row.paymentLink.id === paymentLinkId) ?? null;
      const manualBankConfirmation =
        manualBankRows.find((row) => row.paymentLink.id === paymentLinkId) ?? null;

      setState({
        status: 'ready',
        paymentLinkId,
        detail,
        lifecycle: lifecycleResult,
        qrCodeUrl: qrResult,
        cryptoConfirmation,
        manualBankConfirmation,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load invoice';
      setState({ status: 'error', message });
    }
  }, [organizationId, isOrgLoading, reference, knownId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (state.status !== 'ready') {
      await load();
      return;
    }
    try {
      const [detail, lifecycleResult, qrResult, cryptoRows, manualBankRows] = await Promise.all([
        fetchPaymentLinkDetail(state.paymentLinkId),
        fetchPaymentLinkLifecycle(state.paymentLinkId).catch(() => null),
        fetchPaymentLinkQrCodeDataUrl(state.paymentLinkId).catch(() => null),
        organizationId
          ? fetchCryptoConfirmationsForOrg(organizationId).catch(() => [] as CryptoConfirmationRow[])
          : Promise.resolve([] as CryptoConfirmationRow[]),
        organizationId
          ? fetchManualBankConfirmationsForOrg(organizationId).catch(
              () => [] as ManualBankConfirmationRow[]
            )
          : Promise.resolve([] as ManualBankConfirmationRow[]),
      ]);
      const cryptoConfirmation =
        cryptoRows.find((row) => row.paymentLink.id === state.paymentLinkId) ?? null;
      const manualBankConfirmation =
        manualBankRows.find((row) => row.paymentLink.id === state.paymentLinkId) ?? null;
      setState({
        status: 'ready',
        paymentLinkId: state.paymentLinkId,
        detail,
        lifecycle: lifecycleResult,
        qrCodeUrl: qrResult,
        cryptoConfirmation,
        manualBankConfirmation,
      });
    } catch {
      await load();
    }
  }, [state, load, organizationId]);

  return { state, refresh, reload: load };
}

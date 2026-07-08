/**
 * Xero export layer — resolves Accounting Layer posting values and audit context.
 * Does not change payment processing; only determines what Xero receives.
 */

import { invoiceDenominationCurrency } from '@/lib/payments/invoice-denomination';
import {
  resolvePaymentTransactionLayers,
  type PaymentLinkLayerInput,
  type PaymentEventLayerInput,
  type FxSnapshotLayerInput,
  type PaymentTransactionLayers,
} from '@/lib/payments/payment-layers';
import {
  buildXeroPaymentContextMetadata,
  enrichXeroRequestPayload,
  type XeroPaymentContextMetadata,
} from '@/lib/payments/xero-payment-context';

export type XeroPostingValues = {
  amount: string;
  currency: string;
  /** True when accounting_currency + accounting_amount were explicitly set. */
  usesAccountingLayer: boolean;
};

export type XeroExportContext = {
  layers: PaymentTransactionLayers;
  metadata: XeroPaymentContextMetadata;
  posting: XeroPostingValues;
  /** Immutable FX rate from snapshot — never live-fetched when accounting layer is active. */
  accountingFxRate: number | null;
  fxSnapshotId: string | null;
};

function toAmountString(value: unknown): string {
  if (value == null) return '0';
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return (value as { toString(): string }).toString();
  }
  return String(value);
}

/** Mask wallet address for Xero audit fields (first 6 + last 4). */
export function maskWalletAddress(wallet: string | null | undefined): string | null {
  if (!wallet) return null;
  const trimmed = wallet.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

/** Shorten transaction hash for Xero reference fields. */
export function shortenTransactionHash(hash: string | null | undefined, maxLen = 16): string | null {
  if (!hash) return null;
  const trimmed = hash.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

/**
 * Resolve amount/currency for Xero posting.
 * Accounting layer is authoritative when it differs from legacy invoice denomination.
 */
export function resolveXeroPostingValues(link: PaymentLinkLayerInput): XeroPostingValues {
  const legacyAmount = toAmountString(link.amount);
  const legacyCurrency = invoiceDenominationCurrency(link);

  if (link.accounting_currency && link.accounting_amount != null) {
    const accountingAmount = toAmountString(link.accounting_amount);
    const accountingCurrency = link.accounting_currency.trim().toUpperCase();
    const commercialCurrency = (
      link.commercial_currency ?? link.invoice_currency ?? link.currency
    )
      .trim()
      .toUpperCase();

    const differsFromLegacy =
      accountingCurrency !== legacyCurrency ||
      accountingAmount !== legacyAmount ||
      (link.commercial_currency != null && commercialCurrency !== legacyCurrency);

    if (differsFromLegacy) {
      return {
        amount: accountingAmount,
        currency: accountingCurrency,
        usesAccountingLayer: true,
      };
    }
  }

  return {
    amount: legacyAmount,
    currency: legacyCurrency,
    usesAccountingLayer: false,
  };
}

/**
 * Pick immutable accounting FX snapshot — ACCOUNTING preferred, then SETTLEMENT.
 * Never returns a rate that would require live recalculation.
 */
export function resolveImmutableAccountingFxSnapshot(
  snapshots: FxSnapshotLayerInput[]
): FxSnapshotLayerInput | null {
  return (
    snapshots.find((s) => s.snapshot_type === 'ACCOUNTING') ??
    snapshots.find((s) => s.snapshot_type === 'SETTLEMENT') ??
    null
  );
}

export function resolveImmutableAccountingFxRate(
  snapshots: FxSnapshotLayerInput[],
  usesAccountingLayer: boolean
): { rate: number | null; snapshotId: string | null } {
  if (!usesAccountingLayer) {
    return { rate: null, snapshotId: null };
  }
  const snapshot = resolveImmutableAccountingFxSnapshot(snapshots);
  if (!snapshot) {
    return { rate: null, snapshotId: null };
  }
  const rate = Number(snapshot.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { rate: null, snapshotId: snapshot.id };
  }
  return { rate, snapshotId: snapshot.id };
}

export function buildXeroExportContext(input: {
  link: PaymentLinkLayerInput & {
    id?: string;
    invoice_reference?: string | null;
    invoice_date?: Date | null;
  };
  paymentEvents?: PaymentEventLayerInput[];
  fxSnapshots?: FxSnapshotLayerInput[];
  merchantDefaultCurrency?: string | null;
  settlementTimestamp?: Date | null;
}): XeroExportContext {
  const layers = resolvePaymentTransactionLayers({
    link: input.link,
    paymentEvents: input.paymentEvents,
    fxSnapshots: input.fxSnapshots,
    merchantDefaultCurrency: input.merchantDefaultCurrency,
  });

  const posting = resolveXeroPostingValues(input.link);
  const { rate: accountingFxRate, snapshotId: fxSnapshotId } = resolveImmutableAccountingFxRate(
    input.fxSnapshots ?? [],
    posting.usesAccountingLayer
  );

  const baseMetadata = buildXeroPaymentContextMetadata(layers);

  const metadata: XeroPaymentContextMetadata = {
    ...baseMetadata,
    commercialInvoiceReference: input.link.invoice_reference ?? null,
    originalInvoiceDate: input.link.invoice_date?.toISOString() ?? null,
    fxSnapshotId,
    settlementTimestamp: input.settlementTimestamp?.toISOString() ?? null,
    confirmations: layers.settlement?.confirmations ?? null,
    walletMasked: maskWalletAddress(layers.settlement?.wallet),
    provvypayPaymentLinkId: input.link.id ?? null,
  };

  return { layers, metadata, posting, accountingFxRate, fxSnapshotId };
}

/** Build compact invoice reference for Xero (max ~255 chars). */
export function buildXeroInvoiceReference(params: {
  invoiceReference?: string | null;
  paymentLinkId: string;
  metadata: XeroPaymentContextMetadata;
  usesAccountingLayer: boolean;
}): string | undefined {
  const parts: string[] = [];
  if (params.invoiceReference?.trim()) {
    parts.push(params.invoiceReference.trim());
  }
  if (params.usesAccountingLayer) {
    parts.push(
      `COM:${params.metadata.commercialAmount} ${params.metadata.commercialCurrency}`,
      `ACC:${params.metadata.accountingAmount} ${params.metadata.accountingCurrency}`
    );
  }
  const shortId = params.paymentLinkId.replace(/-/g, '').slice(0, 8);
  parts.push(`PP:${shortId}`);
  const joined = parts.join(' | ');
  return joined.length > 255 ? joined.slice(0, 252) + '…' : joined || undefined;
}

/** Build compact payment reference for Xero. */
export function buildXeroLayerPaymentReference(params: {
  paymentMethod: string;
  paymentToken?: string;
  transactionId: string;
  metadata: XeroPaymentContextMetadata;
}): string {
  const hash = shortenTransactionHash(params.metadata.transactionHash, 12);
  const rail = params.metadata.paymentRail ?? params.paymentMethod;
  const token = params.metadata.token ?? params.paymentToken ?? '';
  const parts = [
    `${rail}${token ? `_${token}` : ''}`,
    params.metadata.commercialCurrency
      ? `COM:${params.metadata.commercialCurrency}`
      : null,
    params.metadata.settlementCurrency
      ? `STL:${params.metadata.settlementCurrency}`
      : null,
    hash,
  ].filter(Boolean);
  const ref = parts.join(' | ');
  return ref.length > 255 ? ref.slice(0, 252) + '…' : ref;
}

/** Append commercial context to invoice line description for accountant visibility. */
export function enrichXeroLineDescription(
  description: string,
  metadata: XeroPaymentContextMetadata,
  usesAccountingLayer: boolean
): string {
  if (!usesAccountingLayer) {
    return description;
  }
  const auditLines = [
    `[Commercial: ${metadata.commercialAmount} ${metadata.commercialCurrency}]`,
    metadata.commercialInvoiceReference
      ? `[Invoice Ref: ${metadata.commercialInvoiceReference}]`
      : null,
    metadata.originalInvoiceDate
      ? `[Invoice Date: ${metadata.originalInvoiceDate.split('T')[0]}]`
      : null,
    `[Accounting: ${metadata.accountingAmount} ${metadata.accountingCurrency} @ FX ${metadata.fxRate ?? '1'}]`,
    metadata.fxSnapshotId ? `[FX Snapshot: ${metadata.fxSnapshotId}]` : null,
  ].filter(Boolean);
  return `${description}\n${auditLines.join('\n')}`;
}

/** Payment narration with full three-layer audit context. */
export function buildXeroLayerPaymentNarration(params: {
  metadata: XeroPaymentContextMetadata;
  posting: XeroPostingValues;
  paymentMethod: string;
  paymentToken?: string;
  transactionId: string;
  /** Legacy settlement FX for crypto (audit only when not using accounting layer). */
  legacySettlementFxRate?: number;
  legacyCryptoAmount?: string;
}): string {
  const { metadata, posting, paymentMethod, paymentToken, transactionId } = params;
  const lines: string[] = [
    `Provvypay Payment — ${paymentMethod}${paymentToken ? ` (${paymentToken})` : ''}`,
    `Posted to Xero: ${posting.amount} ${posting.currency}`,
    '',
    '— Commercial —',
    `Sold: ${metadata.commercialAmount} ${metadata.commercialCurrency}`,
  ];
  if (metadata.commercialInvoiceReference) {
    lines.push(`Invoice Ref: ${metadata.commercialInvoiceReference}`);
  }
  if (metadata.originalInvoiceDate) {
    lines.push(`Invoice Date: ${metadata.originalInvoiceDate.split('T')[0]}`);
  }
  lines.push('', '— Settlement —');
  if (metadata.settlementCurrency && metadata.settlementAmount) {
    lines.push(`Paid: ${metadata.settlementAmount} ${metadata.settlementCurrency}`);
  } else if (params.legacyCryptoAmount) {
    lines.push(`Paid: ${params.legacyCryptoAmount} ${paymentToken ?? ''}`.trim());
  } else {
    lines.push('Paid: (see transaction)');
  }
  if (metadata.paymentRail) lines.push(`Rail: ${metadata.paymentRail}`);
  if (metadata.network) lines.push(`Network: ${metadata.network}`);
  if (metadata.token) lines.push(`Token: ${metadata.token}`);
  if (metadata.transactionHash) lines.push(`Tx: ${metadata.transactionHash}`);
  if (metadata.walletMasked) lines.push(`Wallet: ${metadata.walletMasked}`);
  if (metadata.settlementTimestamp) {
    lines.push(`Settled: ${metadata.settlementTimestamp}`);
  }
  if (metadata.confirmations != null) {
    lines.push(`Confirmations: ${metadata.confirmations}`);
  }
  lines.push('', '— Accounting —');
  lines.push(`Recognised: ${metadata.accountingAmount} ${metadata.accountingCurrency}`);
  if (metadata.fxRate != null) {
    lines.push(
      `FX Rate: ${metadata.fxRate} (${metadata.fxProvider ?? 'snapshot'}) @ ${metadata.fxCapturedAt ?? 'locked'}`
    );
  }
  if (metadata.valuationMethod) lines.push(`Valuation: ${metadata.valuationMethod}`);
  if (metadata.fxSnapshotId) lines.push(`FX Snapshot ID: ${metadata.fxSnapshotId}`);
  if (params.legacySettlementFxRate && !posting.usesAccountingLayer) {
    lines.push(
      `Settlement FX: ${params.legacySettlementFxRate.toFixed(8)} ${paymentToken}/${posting.currency}`
    );
  }
  lines.push('', `Transaction ID: ${transactionId}`);
  return lines.join('\n');
}

export { enrichXeroRequestPayload };

export type XeroSyncLinkRecord = PaymentLinkLayerInput & {
  id: string;
  status: string;
  description: string;
  customer_email: string | null;
  invoice_reference: string | null;
  invoice_date: Date | null;
  payment_method: string | null;
};

/** Prisma select shape for Xero sync layer resolution. */
export const XERO_SYNC_LINK_SELECT = {
  id: true,
  status: true,
  amount: true,
  currency: true,
  invoice_currency: true,
  commercial_currency: true,
  commercial_amount: true,
  accounting_currency: true,
  accounting_amount: true,
  settlement_currency: true,
  settlement_amount: true,
  base_currency: true,
  base_amount: true,
  description: true,
  customer_email: true,
  invoice_reference: true,
  invoice_date: true,
  payment_method: true,
} as const;

export async function loadXeroExportContext(
  prismaClient: {
    payment_links: {
      findUnique: (args: unknown) => Promise<unknown>;
    };
    merchant_settings: {
      findFirst: (args: unknown) => Promise<{ default_currency: string | null } | null>;
    };
  },
  params: {
    paymentLinkId: string;
    organizationId: string;
    paymentEvents?: PaymentEventLayerInput[];
    fxSnapshots?: FxSnapshotLayerInput[];
    settlementTimestamp?: Date | null;
  }
): Promise<{ link: XeroSyncLinkRecord; exportContext: XeroExportContext } | null> {
  const link = (await prismaClient.payment_links.findUnique({
    where: { id: params.paymentLinkId },
    select: {
      ...XERO_SYNC_LINK_SELECT,
      payment_events: {
        orderBy: { created_at: 'asc' as const },
        select: {
          id: true,
          event_type: true,
          payment_method: true,
          amount_received: true,
          currency_received: true,
          hedera_transaction_id: true,
          metadata: true,
          layer_metadata: true,
          received_at: true,
          created_at: true,
        },
      },
      fx_snapshots: {
        orderBy: { captured_at: 'asc' as const },
      },
    },
  })) as (XeroSyncLinkRecord & {
    payment_events?: PaymentEventLayerInput[];
    fx_snapshots?: FxSnapshotLayerInput[];
  }) | null;

  if (!link) return null;

  const merchantSettings = await prismaClient.merchant_settings.findFirst({
    where: { organization_id: params.organizationId },
    select: { default_currency: true },
  });

  const paymentEvents = params.paymentEvents ?? link.payment_events ?? [];
  const fxSnapshots = params.fxSnapshots ?? link.fx_snapshots ?? [];

  const confirmedEvent = paymentEvents.find((e) => e.event_type === 'PAYMENT_CONFIRMED');
  const settlementTimestamp =
    params.settlementTimestamp ??
    (confirmedEvent && 'received_at' in confirmedEvent
      ? ((confirmedEvent as { received_at?: Date | null }).received_at ??
        (confirmedEvent as { created_at?: Date }).created_at ??
        null)
      : null);

  const exportContext = buildXeroExportContext({
    link,
    paymentEvents,
    fxSnapshots,
    merchantDefaultCurrency: merchantSettings?.default_currency ?? null,
    settlementTimestamp,
  });

  return { link, exportContext };
}

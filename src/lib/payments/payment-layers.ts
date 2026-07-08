/**
 * Commercial / Settlement / Accounting layer types and resolution.
 * Three independent layers — never assume a single invoice currency.
 */

export type CommercialLayer = {
  currency: string;
  amount: string;
};

export type SettlementLayer = {
  currency: string;
  amount: string;
  paymentRail: string | null;
  token: string | null;
  network: string | null;
  transactionHash: string | null;
  wallet: string | null;
  confirmations: number | null;
  providerMetadata: Record<string, unknown> | null;
};

export type AccountingLayer = {
  currency: string;
  amount: string;
  exchangeRate: number | null;
  capturedAt: Date | null;
  valuationMethod: string | null;
};

export type FxLayerSnapshot = {
  id: string;
  commercialCurrency: string;
  commercialAmount: string;
  accountingCurrency: string;
  accountingAmount: string;
  settlementCurrency: string | null;
  settlementAmount: string | null;
  exchangeRate: number;
  provider: string;
  capturedAt: Date;
  valuationMethod: string | null;
  immutable: true;
};

export type PaymentTransactionLayers = {
  commercial: CommercialLayer;
  settlement: SettlementLayer | null;
  accounting: AccountingLayer | null;
  fxSnapshot: FxLayerSnapshot | null;
  layersAligned: boolean;
};

/** Currencies merchants may invoice in directly (commercial layer). */
export const COMMERCIAL_INVOICE_CURRENCIES = [
  'AUD',
  'USD',
  'USDC',
  'USDT',
  'HBAR',
] as const;

export type CommercialInvoiceCurrency = (typeof COMMERCIAL_INVOICE_CURRENCIES)[number];

export function isStablecoinOrCryptoCurrency(currency: string): boolean {
  return ['HBAR', 'USDC', 'USDT'].includes(currency.trim().toUpperCase());
}

export function layersRequireFxConversion(
  commercialCurrency: string,
  settlementCurrency: string
): boolean {
  return commercialCurrency.trim().toUpperCase() !== settlementCurrency.trim().toUpperCase();
}

export type PaymentLinkLayerInput = {
  amount: unknown;
  currency: string;
  invoice_currency?: string | null;
  commercial_currency?: string | null;
  commercial_amount?: unknown | null;
  accounting_currency?: string | null;
  accounting_amount?: unknown | null;
  settlement_currency?: string | null;
  settlement_amount?: unknown | null;
  base_currency?: string | null;
  base_amount?: unknown | null;
  payment_method?: string | null;
};

export type PaymentEventLayerInput = {
  event_type: string;
  payment_method?: string | null;
  amount_received?: unknown | null;
  currency_received?: string | null;
  hedera_transaction_id?: string | null;
  metadata?: unknown;
  layer_metadata?: unknown;
};

export type FxSnapshotLayerInput = {
  id: string;
  snapshot_type: string;
  base_currency: string;
  quote_currency: string;
  rate: unknown;
  provider: string;
  captured_at: Date;
  commercial_currency?: string | null;
  commercial_amount?: unknown | null;
  accounting_currency?: string | null;
  accounting_amount?: unknown | null;
  settlement_currency?: string | null;
  settlement_amount?: unknown | null;
  valuation_method?: string | null;
};

function toAmountString(value: unknown): string {
  if (value == null) return '0';
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return (value as { toString(): string }).toString();
  }
  return String(value);
}

function normalizeCurrency(value: string | null | undefined, fallback: string): string {
  return (value ?? fallback).trim().toUpperCase();
}

export function resolveCommercialLayer(link: PaymentLinkLayerInput): CommercialLayer {
  const currency = normalizeCurrency(
    link.commercial_currency ?? link.invoice_currency ?? link.currency,
    link.currency
  );
  const amount = toAmountString(link.commercial_amount ?? link.amount);
  return { currency, amount };
}

export function resolveAccountingLayer(
  link: PaymentLinkLayerInput,
  options?: {
    merchantDefaultCurrency?: string | null;
    fxSnapshot?: FxSnapshotLayerInput | null;
    paymentEvent?: PaymentEventLayerInput | null;
  }
): AccountingLayer | null {
  const commercial = resolveCommercialLayer(link);
  const currency = normalizeCurrency(
    link.accounting_currency ??
      link.base_currency ??
      options?.merchantDefaultCurrency ??
      commercial.currency,
    commercial.currency
  );

  const fx = options?.fxSnapshot;
  if (fx?.accounting_amount != null && fx.accounting_currency) {
    return {
      currency: normalizeCurrency(fx.accounting_currency, currency),
      amount: toAmountString(fx.accounting_amount),
      exchangeRate: Number(fx.rate),
      capturedAt: fx.captured_at,
      valuationMethod: fx.valuation_method ?? 'FX_SNAPSHOT',
    };
  }

  const amount = toAmountString(
    link.accounting_amount ?? link.base_amount ?? link.commercial_amount ?? link.amount
  );

  if (currency === commercial.currency && amount === commercial.amount) {
    return {
      currency,
      amount,
      exchangeRate: 1,
      capturedAt: null,
      valuationMethod: 'PARITY',
    };
  }

  return {
    currency,
    amount,
    exchangeRate: fx ? Number(fx.rate) : link.base_amount ? null : 1,
    capturedAt: fx?.captured_at ?? null,
    valuationMethod: fx?.valuation_method ?? (link.base_amount ? 'MERCHANT_BASE' : 'LEGACY'),
  };
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function resolveSettlementLayer(
  link: PaymentLinkLayerInput,
  paymentEvent?: PaymentEventLayerInput | null
): SettlementLayer | null {
  if (link.settlement_currency && link.settlement_amount != null) {
    const layerMeta = metadataRecord(paymentEvent?.layer_metadata ?? paymentEvent?.metadata);
    return {
      currency: normalizeCurrency(link.settlement_currency, link.settlement_currency),
      amount: toAmountString(link.settlement_amount),
      paymentRail: link.payment_method ?? paymentEvent?.payment_method ?? null,
      token: typeof layerMeta?.token === 'string' ? layerMeta.token : null,
      network: typeof layerMeta?.network === 'string' ? layerMeta.network : null,
      transactionHash:
        typeof layerMeta?.transaction_hash === 'string'
          ? layerMeta.transaction_hash
          : paymentEvent?.hedera_transaction_id ?? null,
      wallet:
        typeof layerMeta?.wallet_address === 'string'
          ? layerMeta.wallet_address
          : typeof layerMeta?.walletAddress === 'string'
            ? layerMeta.walletAddress
            : null,
      confirmations:
        typeof layerMeta?.confirmations === 'number' ? layerMeta.confirmations : null,
      providerMetadata: layerMeta,
    };
  }

  if (!paymentEvent || paymentEvent.event_type !== 'PAYMENT_CONFIRMED') {
    return null;
  }

  const meta = metadataRecord(paymentEvent.layer_metadata ?? paymentEvent.metadata);
  const currency = normalizeCurrency(
    paymentEvent.currency_received ?? link.settlement_currency ?? link.currency,
    link.currency
  );
  const amount = toAmountString(paymentEvent.amount_received ?? link.settlement_amount);

  return {
    currency,
    amount,
    paymentRail: paymentEvent.payment_method ?? link.payment_method ?? null,
    token:
      typeof meta?.token === 'string'
        ? meta.token
        : typeof meta?.token_type === 'string'
          ? meta.token_type
          : null,
    network: typeof meta?.network === 'string' ? meta.network : null,
    transactionHash:
      typeof meta?.transaction_hash === 'string'
        ? meta.transaction_hash
        : typeof meta?.transactionHash === 'string'
          ? meta.transactionHash
          : paymentEvent.hedera_transaction_id ?? null,
    wallet:
      typeof meta?.wallet_address === 'string'
        ? meta.wallet_address
        : typeof meta?.walletAddress === 'string'
          ? meta.walletAddress
          : null,
    confirmations: typeof meta?.confirmations === 'number' ? meta.confirmations : null,
    providerMetadata: meta,
  };
}

export function resolveFxLayerSnapshot(
  commercial: CommercialLayer,
  accounting: AccountingLayer | null,
  settlement: SettlementLayer | null,
  snapshots: FxSnapshotLayerInput[]
): FxLayerSnapshot | null {
  const preferred =
    snapshots.find((s) => s.snapshot_type === 'SETTLEMENT') ??
    snapshots.find((s) => s.snapshot_type === 'ACCOUNTING') ??
    snapshots[0];

  if (!preferred) return null;

  const commercialCurrency = normalizeCurrency(
    preferred.commercial_currency ?? commercial.currency,
    commercial.currency
  );
  const commercialAmount = toAmountString(preferred.commercial_amount ?? commercial.amount);
  const accountingCurrency = normalizeCurrency(
    preferred.accounting_currency ?? accounting?.currency ?? preferred.quote_currency,
    preferred.quote_currency
  );
  const accountingAmount = toAmountString(
    preferred.accounting_amount ?? accounting?.amount ?? commercialAmount
  );

  return {
    id: preferred.id,
    commercialCurrency,
    commercialAmount,
    accountingCurrency,
    accountingAmount,
    settlementCurrency: settlement?.currency ?? preferred.settlement_currency ?? null,
    settlementAmount: settlement?.amount ?? toAmountString(preferred.settlement_amount),
    exchangeRate: Number(preferred.rate),
    provider: preferred.provider,
    capturedAt: preferred.captured_at,
    valuationMethod: preferred.valuation_method ?? accounting?.valuationMethod ?? 'FX_SNAPSHOT',
    immutable: true,
  };
}

export function resolvePaymentTransactionLayers(input: {
  link: PaymentLinkLayerInput;
  paymentEvents?: PaymentEventLayerInput[];
  fxSnapshots?: FxSnapshotLayerInput[];
  merchantDefaultCurrency?: string | null;
}): PaymentTransactionLayers {
  const confirmedEvent =
    input.paymentEvents?.find((event) => event.event_type === 'PAYMENT_CONFIRMED') ?? null;

  const commercial = resolveCommercialLayer(input.link);
  const settlement = resolveSettlementLayer(input.link, confirmedEvent);
  const fxSnapshotInput =
    input.fxSnapshots?.find((s) => s.snapshot_type === 'SETTLEMENT') ??
    input.fxSnapshots?.find((s) => s.snapshot_type === 'ACCOUNTING') ??
    null;

  const accounting = resolveAccountingLayer(input.link, {
    merchantDefaultCurrency: input.merchantDefaultCurrency,
    fxSnapshot: fxSnapshotInput,
    paymentEvent: confirmedEvent,
  });

  const fxSnapshot = resolveFxLayerSnapshot(
    commercial,
    accounting,
    settlement,
    input.fxSnapshots ?? []
  );

  const layersAligned =
    commercial.currency === accounting?.currency &&
    (settlement == null || commercial.currency === settlement.currency);

  return { commercial, settlement, accounting, fxSnapshot, layersAligned };
}

/** Layer amounts to persist when creating an invoice. */
export function buildLayerFieldsForCreate(input: {
  commercialCurrency: string;
  commercialAmount: number;
  accountingCurrency: string;
  accountingAmount: number;
}) {
  const commercialCode = input.commercialCurrency.slice(0, 3);
  const accountingCode = input.accountingCurrency.slice(0, 3);
  return {
    commercial_currency: input.commercialCurrency,
    commercial_amount: input.commercialAmount,
    accounting_currency: input.accountingCurrency,
    accounting_amount: input.accountingAmount,
    invoice_currency: commercialCode,
    currency: commercialCode,
    amount: input.commercialAmount,
    base_currency: accountingCode,
    base_amount: input.accountingAmount,
  };
}

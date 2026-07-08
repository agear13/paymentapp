'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { PaymentTransactionLayers } from '@/lib/payments/payment-layers';

type PaymentTransactionLayersPanelProps = {
  layers: PaymentTransactionLayers;
  xeroContext?: Record<string, unknown> | null;
};

function LayerRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value ?? '—'}</span>
    </div>
  );
}

export function PaymentTransactionLayersPanel({
  layers,
  xeroContext,
}: PaymentTransactionLayersPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Transaction Layers</span>
        {layers.layersAligned ? (
          <Badge variant="secondary">Single currency</Badge>
        ) : (
          <Badge variant="outline">Multi-currency</Badge>
        )}
      </div>

      <section className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Commercial Transaction</h4>
        <p className="text-xs text-muted-foreground">
          What the merchant agreed to charge — the contractual invoice.
        </p>
        <LayerRow label="Commercial Currency" value={layers.commercial.currency} />
        <LayerRow label="Commercial Amount" value={layers.commercial.amount} />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Settlement</h4>
        <p className="text-xs text-muted-foreground">What was actually transferred on-chain or via the payment rail.</p>
        {layers.settlement ? (
          <>
            <LayerRow label="Settlement Currency" value={layers.settlement.currency} />
            <LayerRow label="Settlement Amount" value={layers.settlement.amount} />
            <LayerRow label="Payment Rail" value={layers.settlement.paymentRail} />
            <LayerRow label="Network" value={layers.settlement.network} />
            <LayerRow label="Token" value={layers.settlement.token} />
            <LayerRow label="Transaction Hash" value={layers.settlement.transactionHash} />
            <LayerRow label="Wallet" value={layers.settlement.wallet} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Awaiting payment confirmation.</p>
        )}
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Accounting</h4>
        <p className="text-xs text-muted-foreground">
          Value recognised for reporting and Xero — independent of settlement currency.
        </p>
        {layers.accounting ? (
          <>
            <LayerRow label="Accounting Currency" value={layers.accounting.currency} />
            <LayerRow label="Accounting Amount" value={layers.accounting.amount} />
            {layers.accounting.valuationMethod ? (
              <LayerRow label="Valuation Method" value={layers.accounting.valuationMethod} />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Accounting valuation pending.</p>
        )}
      </section>

      {layers.fxSnapshot ? (
        <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold">FX Snapshot</h4>
          <p className="text-xs text-muted-foreground">Immutable rate lock — never recalculated.</p>
          <LayerRow
            label="Commercial → Accounting"
            value={`${layers.fxSnapshot.commercialAmount} ${layers.fxSnapshot.commercialCurrency} → ${layers.fxSnapshot.accountingAmount} ${layers.fxSnapshot.accountingCurrency}`}
          />
          {layers.fxSnapshot.settlementCurrency ? (
            <LayerRow
              label="Settlement"
              value={`${layers.fxSnapshot.settlementAmount ?? '—'} ${layers.fxSnapshot.settlementCurrency}`}
            />
          ) : null}
          <LayerRow label="Exchange Rate" value={String(layers.fxSnapshot.exchangeRate)} />
          <LayerRow label="Provider" value={layers.fxSnapshot.provider} />
          <LayerRow
            label="Captured At"
            value={format(new Date(layers.fxSnapshot.capturedAt), 'PPpp')}
          />
        </section>
      ) : null}

      {xeroContext ? (
        <>
          <Separator />
          <section className="rounded-lg border border-dashed p-4 space-y-2">
            <h4 className="text-sm font-semibold">Xero Context (prepared)</h4>
            <p className="text-xs text-muted-foreground">
              Future accounting sync will use accounting currency/amount; original commercial
              terms are preserved in metadata.
            </p>
            <pre className="text-xs overflow-x-auto bg-muted/50 p-2 rounded-md">
              {JSON.stringify(xeroContext, null, 2)}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  );
}

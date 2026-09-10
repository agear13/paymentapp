'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { AccountingReconciliationResult } from '@/lib/commercial/accounting-reconciliation';
import { opSurfaceAction, opSurfaceCritical, opSurfaceSuccess } from '@/lib/design/operational-surfaces';

type Props = {
  reconciliation: AccountingReconciliationResult;
  title?: string;
};

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusIcon(status: AccountingReconciliationResult['status']) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-red-600" />;
}

function statusLabel(status: AccountingReconciliationResult['status']): string {
  if (status === 'passed') return 'Reconciled';
  if (status === 'warning') return 'Explained variance';
  return 'Accounting Reconciliation Warning';
}

function varianceLabel(value: AccountingReconciliationResult['varianceClass']): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function AccountingReconciliationCard({
  reconciliation,
  title = 'Accounting Reconciliation',
}: Props) {
  const borderClass =
    reconciliation.status === 'passed'
      ? opSurfaceSuccess
      : reconciliation.status === 'warning'
        ? opSurfaceAction
        : opSurfaceCritical;

  return (
    <div className={`${borderClass} p-4 space-y-3`}>
      <div className="flex items-start gap-2">
        {statusIcon(reconciliation.status)}
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            {statusLabel(reconciliation.status)} · {varianceLabel(reconciliation.varianceClass)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Commercial Obligations</p>
          <p className="font-medium">
            {fmt(reconciliation.commercialObligationsTotal, reconciliation.currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Supplier Invoice Projection</p>
          <p className="font-medium">
            {fmt(reconciliation.supplierInvoiceTotal, reconciliation.currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">GST</p>
          <p className="font-medium">
            {fmt(reconciliation.supplierInvoiceGstAmount, reconciliation.currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Accounting Status</p>
          <p className="font-medium">
            {reconciliation.xeroTaxCode ?? 'Not exported'} · {reconciliation.gstStatus}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Invoice-backed Obligations</p>
          <p className="font-medium">
            {fmt(reconciliation.invoiceBackedObligationsTotal, reconciliation.currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Reconciliation Status</p>
          <p className="font-medium">{statusLabel(reconciliation.status)}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{reconciliation.reason}</p>
    </div>
  );
}

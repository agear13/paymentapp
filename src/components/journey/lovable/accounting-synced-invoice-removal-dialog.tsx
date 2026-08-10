'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AccountingConsequenceSummary } from '@/components/journey/lovable/accounting-consequence-summary';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import { resolveInvoiceRemovalOptions } from '@/lib/accounting/accounting-invoice-deletion-policy';
import type { AccountingInvoiceSyncRow } from '@/lib/accounting/accounting-push-state';
import {
  archiveInvoiceConsequenceFlow,
  shouldShowPaidVoidWarning,
  voidInvoiceConsequenceFlow,
  type XeroSyncForRemovalUx,
} from '@/lib/accounting/accounting-removal-ux';

type AccountingSyncedInvoiceRemovalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: string;
  invoiceSync?: AccountingInvoiceSyncRow | null;
  xeroSyncs?: XeroSyncForRemovalUx[] | null;
  loading?: boolean;
  onVoid: () => void | Promise<void>;
  onArchive: () => void | Promise<void>;
};

function BenefitList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[12.5px] text-ink-soft">
          <span className="text-emerald-600" aria-hidden>
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AccountingSyncedInvoiceRemovalDialog({
  open,
  onOpenChange,
  status,
  invoiceSync,
  xeroSyncs,
  loading = false,
  onVoid,
  onArchive,
}: AccountingSyncedInvoiceRemovalDialogProps) {
  const options = resolveInvoiceRemovalOptions({ status, invoiceSync });
  const showPaidWarning = shouldShowPaidVoidWarning({ status, xeroSyncs });
  const hasActions = options.canVoid || options.canArchive;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{ACCOUNTING_INTEGRATION_COPY.syncedInvoiceRemovalTitle}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1 text-[13.5px] leading-relaxed text-ink-soft">
              {ACCOUNTING_INTEGRATION_COPY.syncedInvoiceRemovalIntro.split('\n\n').map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {showPaidWarning && options.canVoid ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3"
          >
            <p className="text-[13px] font-semibold text-foreground">
              {ACCOUNTING_INTEGRATION_COPY.paidInvoiceVoidWarningTitle}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              {ACCOUNTING_INTEGRATION_COPY.paidInvoiceVoidWarningBody}
            </p>
          </div>
        ) : null}

        {!hasActions ? (
          <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-[13px] text-ink-soft">
            {ACCOUNTING_INTEGRATION_COPY.syncedInvoiceRemovalNoActions}
          </p>
        ) : (
          <div className="space-y-4 py-1">
            {options.canVoid ? (
              <section className="rounded-xl border border-primary/25 bg-accent/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none" aria-hidden>
                    🗑️
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-foreground">
                        {ACCOUNTING_INTEGRATION_COPY.voidInvoiceAction}
                      </h3>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {ACCOUNTING_INTEGRATION_COPY.voidInvoiceRecommended}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-ink-soft">
                      {ACCOUNTING_INTEGRATION_COPY.voidInvoiceLead}
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-soft">
                      {ACCOUNTING_INTEGRATION_COPY.voidInvoiceWhenRecommended}
                    </p>
                    <BenefitList items={ACCOUNTING_INTEGRATION_COPY.voidInvoiceBenefits} />
                    <AccountingConsequenceSummary
                      flow={voidInvoiceConsequenceFlow()}
                      className="mt-3"
                    />
                    <Button
                      type="button"
                      disabled={loading}
                      className="mt-4 w-full sm:w-auto"
                      onClick={() => void onVoid()}
                    >
                      {ACCOUNTING_INTEGRATION_COPY.voidInvoiceAction}
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}

            {options.canArchive ? (
              <section className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none" aria-hidden>
                    📦
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold text-foreground">
                      {ACCOUNTING_INTEGRATION_COPY.archiveInvoiceAction}
                    </h3>
                    <p className="mt-2 text-[13px] text-ink-soft">
                      {ACCOUNTING_INTEGRATION_COPY.archiveInvoiceLead}
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-soft">
                      {ACCOUNTING_INTEGRATION_COPY.archiveInvoiceWhenRecommended}
                    </p>
                    <BenefitList items={ACCOUNTING_INTEGRATION_COPY.archiveInvoiceBenefits} />
                    <AccountingConsequenceSummary
                      flow={archiveInvoiceConsequenceFlow()}
                      className="mt-3"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      className="mt-4 w-full sm:w-auto"
                      onClick={() => void onArchive()}
                    >
                      {ACCOUNTING_INTEGRATION_COPY.archiveInvoiceAction}
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

'use client';

import type { LucideIcon } from 'lucide-react';
import { Coins, CreditCard, Globe2, Landmark, Wallet } from 'lucide-react';
import type { PaymentMethod } from '@prisma/client';
import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import type { CreateInvoiceWorkflowStepState } from '@/lib/commercial-os/create-invoice-progress';
import { PaymentsProviderStatusBadge } from '@/components/journey/lovable/payments-settlement-ui';

export const CREATE_INVOICE_INPUT_CLS =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-ink-soft focus:border-primary focus:ring-2 focus:ring-primary/20';

export function CreateInvoiceFormCard({
  title,
  icon: Icon,
  children,
  incomplete,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  incomplete?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-card p-6 shadow-card transition-colors ${
        incomplete ? 'border-amber-500/25' : 'border-border'
      }`}
    >
      <div className="mb-5 flex items-center gap-2.5">
        <div
          className={`grid h-8 w-8 place-items-center rounded-xl ${
            incomplete ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-secondary text-foreground'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function CreateInvoiceFieldLabel({
  children,
  required,
  invalid,
}: {
  children: React.ReactNode;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <label
      className={`text-[12px] font-medium ${invalid ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}
    >
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  );
}

export function CreateInvoiceWorkflowProgress({
  steps,
}: {
  steps: CreateInvoiceWorkflowStepState[];
}) {
  return (
    <nav
      aria-label="Product lifecycle"
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-ink-soft"
    >
      {steps.map((step, i) => (
        <span key={step.label} className="inline-flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden className="opacity-40">·</span> : null}
          <span
            className={
              step.status === 'current'
                ? 'font-medium text-foreground'
                : step.status === 'done'
                  ? 'text-ink-soft'
                  : 'opacity-70'
            }
          >
            {step.label}
          </span>
        </span>
      ))}
    </nav>
  );
}

export function CreateInvoicePreviewSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="h-3 w-24 rounded bg-secondary" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full rounded bg-secondary" />
          <div className="h-4 w-3/4 rounded bg-secondary" />
          <div className="h-8 w-1/2 rounded bg-secondary" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="h-4 w-32 rounded bg-secondary" />
        <div className="mt-4 h-12 rounded bg-secondary" />
      </div>
    </div>
  );
}

export function CreateInvoiceFormSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-secondary" />
            <div className="h-4 w-32 rounded bg-secondary" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 rounded-xl bg-secondary sm:col-span-2" />
            <div className="h-10 rounded-xl bg-secondary" />
            <div className="h-10 rounded-xl bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

const PAYMENT_METHOD_ICONS: Partial<Record<CommercialDealDraft['paymentMethod'] & string, LucideIcon>> = {
  STRIPE: CreditCard,
  WISE: Globe2,
  HEDERA: Coins,
  EVM_WALLET: Wallet,
  MANUAL_BANK: Landmark,
  CRYPTO: Coins,
  MANUAL: Landmark,
};

/** Merchant-facing labels for the Create Invoice payment method picker. */
export function merchantCreateInvoicePaymentLabel(value: PaymentMethod): {
  title: string;
  detail?: string;
} {
  switch (value) {
    case 'STRIPE':
      return { title: 'Credit / debit card' };
    case 'WISE':
      return { title: 'Wise checkout', detail: 'Automated · pilot only' };
    case 'MANUAL_BANK':
      return { title: 'Bank transfer', detail: 'Manual verification · working option' };
    case 'HEDERA':
      return { title: 'Crypto', detail: 'HashPack · Hedera' };
    case 'EVM_WALLET':
      return { title: 'Crypto', detail: 'MetaMask · EVM' };
    case 'CRYPTO':
      return { title: 'Crypto', detail: 'Manual wallet' };
    default:
      return { title: value.replace(/_/g, ' ') };
  }
}

export function CreateInvoicePaymentMethodOption({
  value,
  label,
  detail,
  selected,
  available,
  configured,
  unavailableReason,
  onSelect,
  subdued = false,
}: {
  value: NonNullable<CommercialDealDraft['paymentMethod']>;
  /** @deprecated Prefer merchant label via merchantCreateInvoicePaymentLabel */
  label: string;
  detail?: string;
  selected: boolean;
  available: boolean;
  configured: boolean;
  unavailableReason?: string;
  onSelect: () => void;
  subdued?: boolean;
}) {
  const Icon = PAYMENT_METHOD_ICONS[value] ?? CreditCard;
  const display = merchantCreateInvoicePaymentLabel(value);
  const title = display.title || label;
  const secondaryDetail = detail ?? display.detail;

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
        selected ? 'border-primary/40 bg-accent/30' : 'border-border hover:bg-secondary/40'
      } ${subdued ? 'opacity-75' : ''} ${!available ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={selected}
        disabled={!available}
        onChange={onSelect}
        className="mt-1"
      />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-medium">{title}</span>
          <PaymentsProviderStatusBadge
            connected={configured}
            label="Requires setup"
            tone={configured ? 'success' : subdued ? 'neutral' : 'warning'}
          />
        </span>
        {secondaryDetail ? (
          <span className="mt-0.5 block text-[11.5px] text-ink-soft">{secondaryDetail}</span>
        ) : null}
        {!available && unavailableReason ? (
          <span className="mt-0.5 block text-[12px] text-ink-soft">
            Complete setup in Payment settings
          </span>
        ) : null}
      </span>
    </label>
  );
}

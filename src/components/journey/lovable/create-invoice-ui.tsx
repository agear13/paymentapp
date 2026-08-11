'use client';

import type { LucideIcon } from 'lucide-react';
import { Check, Coins, CreditCard, Globe2, Landmark, Wallet } from 'lucide-react';
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
      aria-label="Commercial workflow"
      className="flex flex-wrap items-center gap-2 text-[12px] text-ink-soft"
    >
      {steps.map((step, i) => (
        <span key={step.label} className="inline-flex items-center gap-2">
          {i > 0 ? <span className="text-border" aria-hidden>→</span> : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
              step.status === 'done'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : step.status === 'current'
                  ? 'bg-primary/10 text-primary'
                  : 'text-ink-soft'
            }`}
          >
            {step.status === 'done' ? <Check className="h-3 w-3" aria-hidden /> : null}
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

export function CreateInvoicePaymentMethodOption({
  value,
  label,
  selected,
  available,
  configured,
  unavailableReason,
  onSelect,
}: {
  value: NonNullable<CommercialDealDraft['paymentMethod']>;
  label: string;
  selected: boolean;
  available: boolean;
  /** Merchant rail readiness — drives CONNECTED badge, independent of selectability. */
  configured: boolean;
  unavailableReason?: string;
  onSelect: () => void;
}) {
  const Icon = PAYMENT_METHOD_ICONS[value] ?? CreditCard;

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
        selected ? 'border-primary/40 bg-accent/30' : 'border-border hover:bg-secondary/40'
      } ${!available ? 'cursor-not-allowed opacity-60' : ''}`}
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
          <span className="text-[13.5px] font-medium">{label}</span>
          <PaymentsProviderStatusBadge connected={configured} label="Setup" />
        </span>
        {!available && unavailableReason ? (
          <span className="mt-0.5 block text-[12px] text-ink-soft">{unavailableReason}</span>
        ) : null}
      </span>
    </label>
  );
}

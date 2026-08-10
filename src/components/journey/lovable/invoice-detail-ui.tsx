'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const INVOICE_DETAIL_TONE_RING: Record<string, string> = {
  good: 'border-emerald-500/30 bg-emerald-500/[0.06]',
  warn: 'border-amber-500/30 bg-amber-500/[0.06]',
  bad: 'border-destructive/30 bg-destructive/[0.06]',
  info: 'border-primary/25 bg-accent/20',
};

export function InvoiceDetailSectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      {eyebrow ? (
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{eyebrow}</div>
      ) : null}
      <h2 className={`${eyebrow ? 'mt-1' : ''} text-[15px] font-semibold tracking-tight`}>{title}</h2>
      {description ? <p className="mt-1 text-[13px] text-ink-soft">{description}</p> : null}
    </div>
  );
}

export function InvoiceDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-1 text-[13.5px] font-medium">{value}</div>
    </div>
  );
}

export function InvoiceDetailActionButton({
  label,
  icon: Icon,
  danger,
  primary,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
        primary
          ? 'bg-gradient-purple font-semibold text-primary-foreground shadow-glow hover:brightness-110'
          : danger
            ? 'border border-destructive/30 text-destructive hover:bg-destructive/10'
            : 'border border-border hover:bg-secondary'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export function InvoiceDetailExpandableCard({
  title,
  summary,
  defaultOpen,
  children,
  id,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section id={id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-[13.5px] font-semibold">{title}</span>
        {summary ? <span className="truncate text-[12.5px] text-ink-soft">{summary}</span> : null}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="border-t border-border px-6 py-6">{children}</div> : null}
    </section>
  );
}

export function InvoiceDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-8 pb-24">
      <div className="h-9 w-48 rounded-lg bg-secondary" />
      <div className="space-y-4">
        <div className="h-8 w-2/3 rounded-lg bg-secondary" />
        <div className="h-5 w-1/2 rounded-lg bg-secondary" />
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="h-40 rounded-2xl bg-secondary" />
          <div className="h-32 rounded-2xl bg-secondary" />
          <div className="h-48 rounded-2xl bg-secondary" />
        </div>
        <div className="space-y-6">
          <div className="h-36 rounded-2xl bg-secondary" />
          <div className="h-48 rounded-2xl bg-secondary" />
        </div>
      </div>
    </div>
  );
}

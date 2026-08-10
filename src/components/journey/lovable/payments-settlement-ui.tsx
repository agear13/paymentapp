'use client';

import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';

export function PaymentsSectionCard({
  icon: Icon,
  title,
  description,
  children,
  aside,
  id,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-xl text-[13px] text-ink-soft">{description}</p>
            ) : null}
          </div>
        </div>
        {aside}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

export function PaymentsCheckPill({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          done
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'border border-border text-ink-soft'
        }`}
      >
        {done ? (
          <Check className="h-3 w-3" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
        )}
      </span>
      <span className={done ? 'text-foreground' : 'text-ink-soft'}>{children}</span>
    </li>
  );
}

export function PaymentsProviderStatusBadge({
  connected,
  label,
}: {
  connected: boolean;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
        connected
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
          : 'bg-secondary text-ink-soft'
      }`}
    >
      {connected ? 'Connected' : label ?? 'Not configured'}
    </span>
  );
}

export function PaymentsProviderRow({
  icon: Icon,
  name,
  description,
  connected,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  name: string;
  description: string;
  connected: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card transition-colors ${
        open ? 'border-primary/30 ring-1 ring-primary/10' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[14.5px] font-semibold">{name}</div>
              <PaymentsProviderStatusBadge connected={connected} />
            </div>
            <p className="mt-1 max-w-lg text-[12.5px] text-ink-soft">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {connected ? 'Manage' : 'Configure'}
        </button>
      </div>
      {open ? (
        <div className="animate-fade-up border-t border-border bg-secondary/20 p-5">{children}</div>
      ) : null}
    </div>
  );
}

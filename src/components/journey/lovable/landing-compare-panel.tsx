'use client';

import { X } from 'lucide-react';
import type { LandingProviderResult } from '@/lib/journey/landing-provider-search';

export function LandingCompareTray({
  items,
  onCompare,
}: {
  items: LandingProviderResult[];
  onCompare: () => void;
}) {
  if (items.length < 2) return null;
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
      <p className="text-[12px]">
        <span className="font-semibold">{items.length} routes selected</span>
        <span className="text-ink-soft">
          {' '}
          {items.map((item) => item.offering.providerName).join(' · ')}
        </span>
      </p>
      <button
        type="button"
        onClick={onCompare}
        className="rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-medium text-background"
      >
        Compare selected
      </button>
    </div>
  );
}

export function LandingCompareTable({
  items,
  recommendedName,
  onClose,
}: {
  items: LandingProviderResult[];
  recommendedName: string;
  onClose: () => void;
}) {
  const view = items.some((item) => item.offering.providerName === recommendedName)
    ? recommendedName
    : items[0]?.offering.providerName;
  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Compare selected</h3>
        <button type="button" onClick={onClose} aria-label="Close comparison">
          <X className="h-4 w-4" />
        </button>
      </div>
      <table className="w-full min-w-[480px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-border text-ink-soft">
            <th className="py-1.5 pr-2 font-medium"> </th>
            {items.map((item) => (
              <th key={item.id} className="py-1.5 pr-2 font-semibold text-foreground">
                {item.offering.providerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <CompareRow label="Estimated total" values={items.map((item) => item.pricing.totalLabel)} />
          <CompareRow label="Arrival" values={items.map((item) => item.offering.arrivalLabel)} />
          <CompareRow label="Setup" values={items.map((item) => item.setupScan)} />
          <CompareRow label="Recipient" values={items.map((item) => item.recipientScan)} />
          <CompareRow label="Best for" values={items.map((item) => item.bestFor)} />
        </tbody>
      </table>
      <p className="mt-2 text-[12px]">
        <span className="font-semibold">Provvy&apos;s view</span>
        <span className="text-ink-soft">
          {' '}
          {view} is the strongest starting point for your current priority.
        </span>
      </p>
    </section>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b border-border/60 align-top">
      <th className="py-1.5 pr-2 font-medium text-ink-soft">{label}</th>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="py-1.5 pr-2 text-foreground">
          {value}
        </td>
      ))}
    </tr>
  );
}

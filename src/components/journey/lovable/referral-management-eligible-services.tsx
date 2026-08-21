'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type ReferralServiceOption = {
  id: string;
  name: string;
  description?: string | null;
  price?: number;
  currency?: string;
};

function formatServicePrice(service: ReferralServiceOption): string | null {
  if (typeof service.price !== 'number' || !service.currency) return null;
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: service.currency,
    }).format(service.price);
  } catch {
    return `${service.price.toFixed(2)} ${service.currency}`;
  }
}

export function ReferralEligibleServicesPicker({
  catalog,
  selectedIds,
  onChange,
  disabled,
}: {
  catalog: ReferralServiceOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const selected = new Set(selectedIds);
  const filtered = catalog.filter((service) => {
    if (!query.trim()) return true;
    const haystack = `${service.name} ${service.description ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const toggle = (id: string) => {
    if (disabled) return;
    if (selected.has(id)) onChange(selectedIds.filter((item) => item !== id));
    else onChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[13px] font-semibold">Eligible services</p>
        <p className="text-[13px] text-ink-soft">
          Choose the products or services this promoter can refer customers to.
        </p>
      </div>
      {catalog.length > 6 ? (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search services"
          disabled={disabled}
        />
      ) : null}
      {filtered.length === 0 ? (
        <p className="text-[13px] text-ink-soft">No matching active services.</p>
      ) : (
        <ul className="space-y-1">
          {filtered.map((service) => {
            const price = formatServicePrice(service);
            return (
              <li key={service.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/10 px-3 py-2">
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    checked={selected.has(service.id)}
                    disabled={disabled}
                    onChange={() => toggle(service.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-[14px] font-medium">
                      {service.name}
                      {price ? <span className="font-normal text-ink-soft"> — {price}</span> : null}
                    </span>
                    {service.description ? (
                      <span className="block text-[13px] text-ink-soft">{service.description}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PromoterEligibleServicesEditor({
  catalog,
  selectedIds,
  busy,
  onSave,
}: {
  catalog: ReferralServiceOption[];
  selectedIds: string[];
  busy: boolean;
  onSave: (serviceIds: string[]) => Promise<void>;
}) {
  const [ids, setIds] = React.useState(selectedIds);
  React.useEffect(() => {
    setIds(selectedIds);
  }, [selectedIds]);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <ReferralEligibleServicesPicker catalog={catalog} selectedIds={ids} onChange={setIds} disabled={busy} />
      <Button
        type="button"
        disabled={busy || ids.length === 0}
        onClick={() => void onSave(ids)}
      >
        Save eligible services
      </Button>
    </div>
  );
}

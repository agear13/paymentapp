'use client';

import { ChevronsUpDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  BUSINESS_OPTIONS,
  COST_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PROVIDER_TYPE_OPTIONS,
  RECIPIENT_OPTIONS,
  SETUP_OPTIONS,
  SPEED_OPTIONS,
  activeFilterChips,
} from '@/lib/journey/landing-result-labels';
import {
  EMPTY_LANDING_FILTERS,
  LANDING_SORT_OPTIONS,
  type LandingResultFilters,
  type LandingResultSort,
} from '@/lib/journey/landing-provider-search';
import { LANDING_PRIORITIES } from '@/lib/journey/landing-route-comparison';
import type { LandingPriorityId } from '@/lib/journey/landing-route-comparison';

function toggleFilter<K extends keyof LandingResultFilters>(
  filters: LandingResultFilters,
  key: K,
  id: LandingResultFilters[K][number]
): LandingResultFilters {
  const current = filters[key];
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  return { ...filters, [key]: next };
}

const FILTER_GROUPS = [
  { key: 'paymentMethods', label: 'Payment method', options: PAYMENT_METHOD_OPTIONS },
  { key: 'providerTypes', label: 'Provider', options: PROVIDER_TYPE_OPTIONS },
  { key: 'speed', label: 'Speed', options: SPEED_OPTIONS },
  { key: 'cost', label: 'Cost', options: COST_OPTIONS },
  { key: 'setup', label: 'Setup', options: SETUP_OPTIONS },
  { key: 'recipient', label: 'Recipient', options: RECIPIENT_OPTIONS },
  { key: 'business', label: 'Business', options: BUSINESS_OPTIONS },
] as const;

type LandingResultFilterBarProps = {
  sort: LandingResultSort;
  onSortChange: (sort: LandingResultSort) => void;
  priority: LandingPriorityId;
  onPriorityChange: (priority: LandingPriorityId) => void;
  filters: LandingResultFilters;
  onFiltersChange: (filters: LandingResultFilters) => void;
};

export function LandingResultFilterBar({
  sort,
  onSortChange,
  priority,
  onPriorityChange,
  filters,
  onFiltersChange,
}: LandingResultFilterBarProps) {
  const chips = activeFilterChips(filters);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-[12px] text-ink-soft">
          Sort
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as LandingResultSort)}
            className="bg-transparent text-[12px] font-medium text-foreground outline-none"
            aria-label="Sort routes"
          >
            {LANDING_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {LANDING_PRIORITIES.map((item) => {
          const active = priority === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPriorityChange(item.id)}
              className={`h-8 rounded-lg border px-2.5 text-[12px] font-medium ${
                active
                  ? 'border-primary/35 bg-accent text-foreground'
                  : 'border-border bg-card text-ink-soft hover:text-foreground'
              }`}
            >
              {item.label === 'Lowest total cost' ? 'Lowest cost' : item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_GROUPS.map((group) => {
          const selected = filters[group.key] as string[];
          return (
            <Popover key={group.key}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium ${
                    selected.length
                      ? 'border-primary/35 bg-accent text-foreground'
                      : 'border-border bg-card text-ink-soft hover:text-foreground'
                  }`}
                >
                  {group.label}
                  {selected.length ? ` · ${selected.length}` : ''}
                  <ChevronsUpDown className="h-3 w-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <fieldset>
                  <legend className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                    {group.label}
                  </legend>
                  <div className="space-y-0.5">
                    {group.options.map((option) => (
                      <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[13px] hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={filters[group.key].includes(option.id as never)}
                          onChange={() =>
                            onFiltersChange(toggleFilter(filters, group.key, option.id as never))
                          }
                          className="rounded border-border"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {chips.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={`${chip.group}-${chip.id}`}
              type="button"
              onClick={() =>
                onFiltersChange(toggleFilter(filters, chip.group, chip.id as never))
              }
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] text-foreground"
            >
              {chip.label}
              <X className="h-3 w-3 text-ink-soft" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => onFiltersChange(EMPTY_LANDING_FILTERS)}
            className="h-7 px-1.5 text-[12px] font-medium text-ink-soft hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

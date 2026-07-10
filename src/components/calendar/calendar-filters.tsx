'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { CalendarFilters, CalendarEventCategory } from '@/lib/calendar/types';
import { DEFAULT_CALENDAR_FILTERS } from '@/lib/calendar/types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

type CalendarFiltersBarProps = {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  deals: RecentDeal[];
  currencies: string[];
};

const CATEGORY_OPTIONS: Array<{ value: CalendarEventCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'expected_revenue', label: 'Revenue' },
  { value: 'money_outgoing', label: 'Settlement / payouts' },
  { value: 'project_milestone', label: 'Milestones' },
  { value: 'operational_task', label: 'Tasks' },
];

export function CalendarFiltersBar({
  filters,
  onChange,
  deals,
  currencies,
}: CalendarFiltersBarProps) {
  const hasActive =
    filters.projectId != null ||
    filters.category !== 'all' ||
    filters.currency != null ||
    filters.search.trim() !== '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search events…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="h-8 w-44 text-sm"
      />

      <Select
        value={filters.projectId ?? 'all'}
        onValueChange={(v) =>
          onChange({ ...filters, projectId: v === 'all' ? null : v })
        }
      >
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {deals.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.dealName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.category}
        onValueChange={(v) =>
          onChange({ ...filters, category: v as CalendarFilters['category'] })
        }
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {currencies.length > 0 && (
        <Select
          value={filters.currency ?? 'all'}
          onValueChange={(v) =>
            onChange({ ...filters, currency: v === 'all' ? null : v })
          }
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All currencies</SelectItem>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActive && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange(DEFAULT_CALENDAR_FILTERS)}
        >
          Reset
        </Button>
      )}
    </div>
  );
}

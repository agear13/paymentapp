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
import type { TimelineFilters, TimelineLayer } from '@/lib/workspace-timeline/types';
import { DEFAULT_TIMELINE_FILTERS } from '@/lib/workspace-timeline/types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

type TimelineFiltersBarProps = {
  filters: TimelineFilters;
  onChange: (filters: TimelineFilters) => void;
  deals: RecentDeal[];
  currencies: string[];
};

const LAYER_OPTIONS: Array<{ value: TimelineLayer | 'all'; label: string }> = [
  { value: 'all', label: 'All layers' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'operational', label: 'Operational' },
];

const DIRECTION_OPTIONS = [
  { value: 'all', label: 'All flows' },
  { value: 'incoming', label: 'Revenue' },
  { value: 'outgoing', label: 'Outgoing' },
] as const;

export function TimelineFiltersBar({
  filters,
  onChange,
  deals,
  currencies,
}: TimelineFiltersBarProps) {
  const hasActive =
    filters.projectId != null ||
    filters.layer !== 'all' ||
    filters.direction !== 'all' ||
    filters.currency != null ||
    filters.search.trim() !== '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search timeline…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="h-8 w-44 text-sm"
      />

      <Select
        value={filters.projectId ?? 'all'}
        onValueChange={(v) => onChange({ ...filters, projectId: v === 'all' ? null : v })}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {deals.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.dealName}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.layer}
        onValueChange={(v) => onChange({ ...filters, layer: v as TimelineFilters['layer'] })}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Layer" />
        </SelectTrigger>
        <SelectContent>
          {LAYER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.direction}
        onValueChange={(v) =>
          onChange({ ...filters, direction: v as TimelineFilters['direction'] })
        }
      >
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue placeholder="Flow" />
        </SelectTrigger>
        <SelectContent>
          {DIRECTION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {currencies.length > 0 && (
        <Select
          value={filters.currency ?? 'all'}
          onValueChange={(v) => onChange({ ...filters, currency: v === 'all' ? null : v })}
        >
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
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
          onClick={() => onChange(DEFAULT_TIMELINE_FILTERS)}
        >
          Reset
        </Button>
      )}
    </div>
  );
}

export const CalendarFiltersBar = TimelineFiltersBar;

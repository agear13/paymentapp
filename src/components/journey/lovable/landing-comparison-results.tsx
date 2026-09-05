'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { LANDING_ADVISOR_SLOT_ID, advisorFilterNote } from '@/lib/journey/landing-advisor';
import { useOptionalLandingAdvisor } from '@/components/journey/lovable/landing-advisor-context';
import { LandingCompareTable, LandingCompareTray } from '@/components/journey/lovable/landing-compare-panel';
import { LandingResultCard } from '@/components/journey/lovable/landing-result-card';
import { LandingResultFilterBar } from '@/components/journey/lovable/landing-result-filters';
import {
  EMPTY_LANDING_FILTERS,
  activeFilterCount,
  filterProviderResults,
  resultCountLabel,
  sortProviderResults,
  type LandingResultFilters,
  type LandingResultSort,
} from '@/lib/journey/landing-provider-search';
import type { LandingComparisonResult, LandingPriorityId } from '@/lib/journey/landing-route-comparison';
import { countryName, formatLandingAmount, isDomestic, transactionTypeLabel } from '@/lib/journey/landing-route-model';

type LandingComparisonResultsProps = {
  result: LandingComparisonResult;
  onPriorityChange: (priority: LandingPriorityId) => void;
  onPersonalise: () => void;
  seedFilters?: LandingResultFilters | null;
};

export function LandingComparisonResults({
  result,
  onPriorityChange,
  onPersonalise,
  seedFilters = null,
}: LandingComparisonResultsProps) {
  const [sort, setSort] = useState<LandingResultSort>('recommended');
  const [filters, setFilters] = useState<LandingResultFilters>(seedFilters ?? EMPTY_LANDING_FILTERS);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const advisor = useOptionalLandingAdvisor();
  const advisorUpdate = advisor?.update;
  const registerFilterChange = advisor?.registerFilterChange;

  useEffect(() => {
    setSelected([]);
    setCompareOpen(false);
  }, [result.query]);

  useEffect(() => {
    setFilters(seedFilters ?? EMPTY_LANDING_FILTERS);
  }, [seedFilters]);

  useEffect(() => {
    if (!registerFilterChange) return;
    registerFilterChange(setFilters);
    return () => registerFilterChange(null);
  }, [registerFilterChange]);

  const filtered = useMemo(
    () => sortProviderResults(filterProviderResults(result.offerings, filters), sort),
    [result.offerings, filters, sort]
  );
  const filterActive = activeFilterCount(filters) > 0;
  const query = result.query;

  useEffect(() => {
    const lead = filterActive
      ? (filtered.find((item) => item.isRecommended) ?? filtered[0])
      : undefined;
    advisorUpdate?.({
      visibleResultCount: filtered.length,
      filterNote: filterActive ? advisorFilterNote(filters) : null,
      ...(lead
        ? {
            recommendedProvider: lead.offering.providerName,
            recommendedProviderId: lead.offering.providerId,
            productName: lead.offering.productName,
            indicativeCostLabel: lead.pricing.totalLabel,
            arrivalLabel: lead.offering.arrivalLabel,
            setupLabel: lead.offering.setupLabel,
            knownLimitation: lead.offering.potentialIssues[0] ?? null,
          }
        : {}),
    });
  }, [advisorUpdate, filtered, filterActive, filters]);
  const corridor = isDomestic(query)
    ? countryName(query.originCountry)
    : `${countryName(query.originCountry)} → ${countryName(query.destinationCountry)}`;
  const whyDetail = [
    result.recommendedWhy,
    ...result.recommendation.rankingReasons.slice(0, 3),
    result.confidence.explanation,
  ];

  const handleSelect = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  };

  const handlePriorityChange = (priority: LandingPriorityId) => {
    setSort('recommended');
    onPriorityChange(priority);
  };

  const compared = result.offerings.filter((item) => selected.includes(item.id));

  return (
    <div id="comparison-results" className="space-y-3">
      <header className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px] font-semibold tracking-tight">
          <span>{corridor}</span>
          <span className="font-medium text-ink-soft">{formatLandingAmount(query.amount, query.currency)}</span>
          <span className="font-medium text-ink-soft">{transactionTypeLabel(query.transactionType)}</span>
        </p>
        <p className="mt-1 text-[13px] font-semibold" aria-live="polite">
          {resultCountLabel(filtered.length, result.offerings.length, filterActive)}
        </p>
        <div className="mt-2">
          <LandingResultFilterBar
            sort={sort}
            onSortChange={setSort}
            priority={query.priority}
            onPriorityChange={handlePriorityChange}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      </header>

      <div className="grid gap-1.5">
        {filtered.map((item) => (
          <LandingResultCard
            key={item.id}
            item={item}
            selected={selected.includes(item.id)}
            onToggleSelect={() => handleSelect(item.id)}
            selectDisabled={!selected.includes(item.id) && selected.length >= 3}
            priority={query.priority}
            whyDetail={item.isRecommended ? whyDetail : undefined}
            onPersonalise={onPersonalise}
          />
        ))}
      </div>

      <LandingCompareTray items={compared} onCompare={() => setCompareOpen(true)} />

      {compareOpen && compared.length >= 2 ? (
        <LandingCompareTable
          items={compared}
          recommendedName={result.recommendedOffering.offering.providerName}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}

      <div id={LANDING_ADVISOR_SLOT_ID} />

      <section id="personalise" className="rounded-xl border border-primary/20 bg-card px-3 py-3">
        <h3 className="text-[14px] font-semibold tracking-tight">
          Want Provvy to rank these using your actual business context?
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">
          Your cash position, negotiated FX, existing payment rails, supplier terms and payment
          history can change the answer.
        </p>
        <Link
          href={COMMERCIAL_OS_ROUTES.assessment}
          onClick={onPersonalise}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary"
        >
          Connect your business
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}

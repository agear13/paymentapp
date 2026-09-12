'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { advisorFilterNote } from '@/lib/journey/landing-advisor';
import { useOptionalLandingAdvisor } from '@/components/journey/lovable/landing-advisor-context';
import { LandingAuthoriseReview } from '@/components/journey/lovable/landing-authorise-review';
import { LandingCompareTable, LandingCompareTray } from '@/components/journey/lovable/landing-compare-panel';
import { LandingResultCard } from '@/components/journey/lovable/landing-result-card';
import { explainLandingRecommendation } from '@/lib/journey/landing-recommendation-explanation';
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
import type { LandingComparisonResult, LandingPriorityId, LandingProviderResult } from '@/lib/journey/landing-route-comparison';
import { cheapestOffering } from '@/lib/journey/landing-result-labels';
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
  const [reviewItem, setReviewItem] = useState<LandingProviderResult | null>(null);
  const [authorised, setAuthorised] = useState(false);
  const advisor = useOptionalLandingAdvisor();
  const advisorUpdate = advisor?.update;
  const registerFilterChange = advisor?.registerFilterChange;

  useEffect(() => {
    setSelected([]);
    setCompareOpen(false);
    setReviewItem(null);
    setAuthorised(false);
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
  const cheapest = cheapestOffering(result.offerings);
  const pickDiffersFromCheapest =
    Boolean(cheapest) && result.recommendedOffering.id !== cheapest?.id;

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
  const recommendationExplanation = useMemo(() => explainLandingRecommendation(result), [result]);

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

  const openReview = (item: LandingProviderResult) => {
    setAuthorised(false);
    setReviewItem(item);
    advisorUpdate?.({
      stage: 'detail',
      selectedProvider: item.offering.providerName,
    });
  };

  const closeReview = () => {
    setReviewItem(null);
    setAuthorised(false);
    advisorUpdate?.({
      stage: 'results',
      selectedProvider: null,
    });
  };

  const compared = result.offerings.filter((item) => selected.includes(item.id));

  return (
    <div id="comparison-results" className="space-y-3">
      <header className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px] font-semibold tracking-tight">
          <span>{corridor}</span>
          <span className="font-medium tabular-nums text-ink-soft">
            {formatLandingAmount(query.amount, query.currency)}
          </span>
          <span className="font-medium text-ink-soft">{transactionTypeLabel(query.transactionType)}</span>
        </p>
        <p className="mt-1 text-[13px] font-semibold" aria-live="polite">
          {resultCountLabel(filtered.length, result.offerings.length, filterActive)}
        </p>
        <p className="mt-1 text-[12px] text-ink-soft">
          Indicative costs — not live quotes. Live provider prices can differ.
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

      {pickDiffersFromCheapest ? (
        <p className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-[13px] leading-snug">
          <span className="font-semibold">The cheapest route isn&apos;t always the best route. </span>
          <span className="text-ink-soft">
            {result.recommendedOffering.offering.providerName} is Provvy&apos;s pick for this payment.
            {cheapest ? ` ${cheapest.offering.providerName} is the lowest total cost.` : ''}
          </span>
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <section className="rounded-xl border border-border/70 bg-card px-4 py-5">
          <h3 className="text-[15px] font-semibold tracking-tight">
            {filterActive
              ? 'No routes match these filters'
              : "We couldn't find a route that confidently fits this payment."}
          </h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
            {filterActive
              ? 'Provvy still has routes for this payment — they are hidden by the current filters. Clear them, or change what you are paying, rather than forcing a recommendation.'
              : 'Provvy will not manufacture a recommendation just to fill the page. Try another corridor, currency, or tell Provvy a little more about the payment.'}
          </p>
          {filterActive ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_LANDING_FILTERS)}
              className="mt-3 text-[13px] font-medium text-primary"
            >
              Clear filters
            </button>
          ) : null}
        </section>
      ) : (
        <div className="grid gap-2">
          <div className="hidden px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft sm:grid sm:grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)_minmax(0,1.6fr)_auto]">
            <span>Rank</span>
            <span>Provider</span>
            <span>Total cost</span>
            <span>Arrival</span>
            <span>Why this rank</span>
            <span className="text-right">Action</span>
          </div>
          {filtered.map((item, index) => (
            <LandingResultCard
              key={item.id}
              item={{ ...item, rank: index + 1 }}
              selected={selected.includes(item.id)}
              onToggleSelect={() => handleSelect(item.id)}
              selectDisabled={!selected.includes(item.id) && selected.length >= 3}
              priority={query.priority}
              whyDetail={item.isRecommended ? whyDetail : undefined}
              recommendationExplanation={item.isRecommended ? recommendationExplanation : undefined}
              onPersonalise={onPersonalise}
              onSelectRoute={() => openReview(item)}
            />
          ))}
        </div>
      )}

      <LandingCompareTray items={compared} onCompare={() => setCompareOpen(true)} />

      {compareOpen && compared.length >= 2 ? (
        <LandingCompareTable
          items={compared}
          recommendedName={result.recommendedOffering.offering.providerName}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}

      <section
        id="decision-trust"
        className="rounded-xl border border-border/60 bg-card px-3 py-3"
      >
        <h3 className="text-[14px] font-semibold tracking-tight">You approve every payment.</h3>
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">
          Select a route to review exactly what would happen. Provvy recommends the route and prepares
          what follows. It does not silently take control of your money.
        </p>
      </section>

      <section id="personalise" className="rounded-xl border border-primary/20 bg-card px-3 py-3">
        <h3 className="text-[14px] font-semibold tracking-tight">
          Connect your business to make this recommendation personal.
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">
          Without that context, Provvy can only rank public routes. Your cash position, negotiated FX,
          existing payment rails, supplier terms and payment history can change the answer.
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

      <LandingAuthoriseReview
        item={reviewItem}
        query={query}
        authorised={authorised}
        onClose={closeReview}
        onAuthorise={() => setAuthorised(true)}
        onPersonalise={onPersonalise}
      />
    </div>
  );
}

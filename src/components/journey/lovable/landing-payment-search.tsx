'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { LandingComparisonResults } from '@/components/journey/lovable/landing-comparison-results';
import { useOptionalLandingAdvisor } from '@/components/journey/lovable/landing-advisor-context';
import { useOptionalLandingIntelligence } from '@/components/journey/lovable/landing-intelligence-context';
import {
  persistJourneyBusiness,
  persistJourneyObjective,
} from '@/lib/journey/journey-assessment-storage.client';
import {
  compareLandingRoutes,
  DEFAULT_LANDING_SEARCH,
  LANDING_COUNTRIES,
  LANDING_CURRENCIES,
  LANDING_PRIORITIES,
  LANDING_TRANSACTION_TYPES,
  landingSearchIsValid,
  objectiveFromLandingSearch,
  parseLandingAmount,
  type LandingPriorityId,
  type LandingSearchQuery,
  type LandingTransactionTypeId,
} from '@/lib/journey/landing-route-comparison';
import {
  PAYMENT_METHOD_OPTIONS,
  recommendedWhyLine,
  scanTraits,
  type LandingResultFilters,
} from '@/lib/journey/landing-result-labels';
import { markAdvisorIntroSeen } from '@/lib/journey/landing-advisor';
import { filtersFromSearchHint } from '@/lib/journey/payment-intelligence-rank';
import type { PaymentIntelligenceSearchHint } from '@/lib/journey/payment-intelligence-types';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[14px] text-foreground outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20';

const persistLandingRecommendationIntent = (query: LandingSearchQuery) => {
  persistJourneyObjective(objectiveFromLandingSearch(query));
  persistJourneyBusiness({
    challenge: `${query.transactionType}:${query.originCountry}:${query.destinationCountry}:${query.currency}:${query.amount}`,
  });
};

function Field({
  id,
  label,
  children,
  asQuestion = false,
}: {
  id: string;
  label: string;
  children: ReactNode;
  asQuestion?: boolean;
}) {
  return (
    <label htmlFor={id} className="block min-w-0">
      <span
        className={
          asQuestion
            ? 'text-[12px] font-medium text-ink-soft'
            : 'text-[11px] font-medium uppercase tracking-wider text-ink-soft'
        }
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function LandingPaymentSearch() {
  const [originCountry, setOriginCountry] = useState(DEFAULT_LANDING_SEARCH.originCountry);
  const [destinationCountry, setDestinationCountry] = useState(
    DEFAULT_LANDING_SEARCH.destinationCountry
  );
  const [amountInput, setAmountInput] = useState(String(DEFAULT_LANDING_SEARCH.amount));
  const [currency, setCurrency] = useState(DEFAULT_LANDING_SEARCH.currency);
  const [transactionType, setTransactionType] = useState<LandingTransactionTypeId>(
    DEFAULT_LANDING_SEARCH.transactionType
  );
  const [priority, setPriority] = useState<LandingPriorityId>(DEFAULT_LANDING_SEARCH.priority);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [hasCompared, setHasCompared] = useState(false);
  const [seedFilters, setSeedFilters] = useState<LandingResultFilters | null>(null);
  const advisor = useOptionalLandingAdvisor();
  const intelligence = useOptionalLandingIntelligence();
  const lastReportedPriority = useRef<LandingPriorityId | null>(null);
  const priorityChangedRef = useRef(false);
  const runCompareRef = useRef<(hint?: PaymentIntelligenceSearchHint | null) => void>(() => {});

  const query = useMemo((): LandingSearchQuery | null => {
    const amount = parseLandingAmount(amountInput);
    if (amount === null) return null;
    return {
      originCountry,
      destinationCountry,
      amount,
      currency,
      transactionType,
      priority,
    };
  }, [originCountry, destinationCountry, amountInput, currency, transactionType, priority]);

  const comparison = useMemo(() => {
    if (!hasCompared || !query || !landingSearchIsValid(query)) return null;
    return compareLandingRoutes(query);
  }, [hasCompared, query]);

  const advisorUpdate = advisor?.update;
  const registerPriorityChange = advisor?.registerPriorityChange;
  const registerCompare = intelligence?.registerCompare;
  const setIntelligenceCorridor = intelligence?.setCorridor;

  useEffect(() => {
    setIntelligenceCorridor?.({ origin: originCountry, destination: destinationCountry });
  }, [setIntelligenceCorridor, originCountry, destinationCountry]);

  useEffect(() => {
    if (!registerPriorityChange) return;
    registerPriorityChange(setPriority);
    return () => registerPriorityChange(null);
  }, [registerPriorityChange]);

  useEffect(() => {
    if (!advisorUpdate) return;
    if (!hasCompared || !query || !comparison) {
      lastReportedPriority.current = null;
      priorityChangedRef.current = false;
      advisorUpdate({
        stage: 'search',
        origin: originCountry,
        destination: destinationCountry,
        amount: query?.amount ?? null,
        currency,
        transactionType,
        priority,
        priorityChanged: false,
        resultCount: null,
        visibleResultCount: null,
        recommendedProvider: null,
        recommendedProviderId: null,
        recommendationReason: null,
        productName: null,
        paymentMethodLabel: null,
        indicativeCostLabel: null,
        arrivalLabel: null,
        setupLabel: null,
        characteristics: null,
        knownLimitation: null,
        filterNote: null,
        selectedProvider: null,
      });
      return;
    }
    markAdvisorIntroSeen();
    const recommended = comparison.recommendedOffering;
    const offering = recommended.offering;
    if (lastReportedPriority.current !== query.priority) {
      priorityChangedRef.current = lastReportedPriority.current !== null;
      lastReportedPriority.current = query.priority;
    }
    advisorUpdate({
      stage: 'results',
      origin: query.originCountry,
      destination: query.destinationCountry,
      amount: query.amount,
      currency: query.currency,
      transactionType: query.transactionType,
      priority: query.priority,
      priorityChanged: priorityChangedRef.current,
      resultCount: comparison.offerings.length,
      recommendedProvider: offering.providerName,
      recommendedProviderId: offering.providerId,
      recommendationReason: [comparison.recommendedWhy, recommendedWhyLine(query.priority)]
        .filter(Boolean)
        .join(' '),
      productName: offering.productName,
      paymentMethodLabel: offering.paymentMethods
        .map((id) => PAYMENT_METHOD_OPTIONS.find((option) => option.id === id)?.label ?? id)
        .join(' / '),
      indicativeCostLabel: recommended.pricing.totalLabel,
      arrivalLabel: offering.arrivalLabel,
      setupLabel: offering.setupLabel,
      characteristics: scanTraits(offering).join(', ') || null,
      knownLimitation: offering.potentialIssues[0] ?? null,
      selectedProvider: null,
    });
  }, [
    advisorUpdate,
    hasCompared,
    query,
    comparison,
    originCountry,
    destinationCountry,
    currency,
    transactionType,
    priority,
  ]);

  const handleCompare = (hint?: PaymentIntelligenceSearchHint | null) => {
    const nextPriority = hint?.priority ?? priority;
    const nextQuery = query ? { ...query, priority: nextPriority } : null;
    if (!nextQuery || !landingSearchIsValid(nextQuery)) {
      setAmountError('Enter an amount greater than zero.');
      return;
    }
    if (hint?.priority && hint.priority !== priority) {
      setPriority(hint.priority);
    }
    setSeedFilters(hint ? filtersFromSearchHint(hint) : null);
    setAmountError(null);
    setHasCompared(true);
    window.requestAnimationFrame(() => {
      document.getElementById('comparison-results')?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  runCompareRef.current = handleCompare;

  useEffect(() => {
    if (!registerCompare) return;
    registerCompare((hint) => runCompareRef.current(hint));
    return () => registerCompare(null);
  }, [registerCompare]);

  const handleRecommend = () => {
    if (!query) return;
    persistLandingRecommendationIntent(query);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2
          id="landing-search-heading"
          className="text-balance text-[1.2rem] font-semibold tracking-[-0.02em] sm:text-xl"
        >
          Tell Provvy what you're paying
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-snug text-ink-soft sm:text-[14px]">
          Enter the details of the transaction you want to make. Provvy will compare the available
          routes and explain what matters.
        </p>
      </div>
      <form
        className="rounded-2xl glass p-4 shadow-card sm:p-5"
        aria-labelledby="landing-search-heading"
        onSubmit={(event) => {
          event.preventDefault();
          handleCompare(null);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="landing-origin" label="From">
            <select
              id="landing-origin"
              value={originCountry}
              onChange={(event) =>
                setOriginCountry(event.target.value as LandingSearchQuery['originCountry'])
              }
              className={fieldClass}
            >
              {LANDING_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="landing-destination" label="To">
            <select
              id="landing-destination"
              value={destinationCountry}
              onChange={(event) =>
                setDestinationCountry(event.target.value as LandingSearchQuery['destinationCountry'])
              }
              className={fieldClass}
            >
              {LANDING_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="landing-type" label="What are you paying for?" asQuestion>
            <select
              id="landing-type"
              value={transactionType}
              onChange={(event) =>
                setTransactionType(event.target.value as LandingTransactionTypeId)
              }
              className={fieldClass}
            >
              {LANDING_TRANSACTION_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="landing-amount" label="Amount">
            <input
              id="landing-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountInput}
              onChange={(event) => {
                setAmountInput(event.target.value);
                if (amountError) setAmountError(null);
              }}
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? 'landing-amount-error' : undefined}
              className={fieldClass}
            />
          </Field>
          <Field id="landing-currency" label="Currency">
            <select
              id="landing-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={fieldClass}
            >
              {LANDING_CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="min-w-0 sm:col-span-2 lg:col-span-1">
            <legend className="text-[12px] font-medium text-ink-soft">What matters most?</legend>
            <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="What matters most?">
              {LANDING_PRIORITIES.map((item) => {
                const selected = priority === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPriority(item.id)}
                    className={`rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                      selected
                        ? 'border-primary/40 bg-accent text-foreground'
                        : 'border-border bg-card text-ink-soft hover:border-primary/30 hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        {amountError ? (
          <p id="landing-amount-error" className="mt-3 text-[13px] text-destructive" role="alert">
            {amountError}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[14px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            Compare routes
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-[12px] text-ink-soft">Anyone can explore this payment.</p>
        </div>
      </form>

      {comparison ? (
        <LandingComparisonResults
          result={comparison}
          onPriorityChange={setPriority}
          onPersonalise={handleRecommend}
          seedFilters={seedFilters}
        />
      ) : null}
    </div>
  );
}

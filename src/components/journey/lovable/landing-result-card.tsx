'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { LandingProviderMark } from '@/components/journey/lovable/landing-provider-mark';
import { useOptionalLandingAdvisor } from '@/components/journey/lovable/landing-advisor-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { LANDING_PROVIDER_WEBSITES } from '@/lib/journey/landing-provider-catalog';
import {
  INDICATIVE_ESTIMATE_COPY,
  pricingFreshnessLabel,
} from '@/lib/journey/landing-provider-pricing';
import type { LandingProviderResult } from '@/lib/journey/landing-provider-search';
import { recommendationBadge } from '@/lib/journey/landing-result-labels';
import type { LandingPriorityId } from '@/lib/journey/landing-route-comparison';
import type { RecommendationExplanation } from '@/lib/route-intelligence';
import { LandingRecommendationExplanation } from '@/components/journey/lovable/landing-recommendation-explanation';

const DIGITAL_DOLLAR_EXPLAINER =
  'Fast settlement using a digital-dollar payment rail. Typically requires compatible accounts or wallets on both sides.';

export function IndicativeHint({ pricing }: { pricing: LandingProviderResult['pricing'] }) {
  const label = pricingFreshnessLabel(pricing);
  if (pricing.type === 'live') {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider text-ink-soft">{label}</span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft hover:text-foreground"
          aria-label="Indicative pricing"
        >
          {label}
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 text-[12px] leading-relaxed text-ink-soft">
        {INDICATIVE_ESTIMATE_COPY}
      </PopoverContent>
    </Popover>
  );
}

export function LandingResultCard({
  item,
  selected,
  onToggleSelect,
  selectDisabled,
  priority,
  whyDetail,
  recommendationExplanation,
  onPersonalise,
  onSelectRoute,
}: {
  item: LandingProviderResult;
  selected: boolean;
  onToggleSelect: () => void;
  selectDisabled: boolean;
  priority: LandingPriorityId;
  whyDetail?: string[];
  recommendationExplanation?: RecommendationExplanation;
  onPersonalise: () => void;
  onSelectRoute: () => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [feesOpen, setFeesOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const advisor = useOptionalLandingAdvisor();
  const offering = item.offering;
  const isDigital = offering.providerId === 'digital_dollar';
  const recommended = item.isRecommended;
  const rankLabel = String(item.rank).padStart(2, '0');
  const website = LANDING_PROVIDER_WEBSITES[offering.providerId];

  return (
    <article
      className={`rounded-xl border px-3 py-3 sm:px-4 ${
        recommended
          ? 'border-primary/25 bg-accent/40 shadow-soft'
          : 'border-border/70 bg-card'
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)_minmax(0,1.6fr)_auto] sm:items-start">
        <p
          className={`pt-0.5 text-[13px] font-semibold tabular-nums ${
            recommended ? 'text-foreground' : 'text-ink-soft'
          }`}
        >
          {rankLabel}
        </p>

        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <LandingProviderMark providerId={offering.providerId} size="sm" />
            <div className="min-w-0">
              {recommended ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {recommendationBadge(priority)}
                </p>
              ) : null}
              <h4 className="text-[14px] font-semibold leading-tight tracking-tight">
                {offering.providerName}
              </h4>
              <p className="text-[12px] leading-snug text-ink-soft">{offering.productName}</p>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-soft">Total cost</p>
          <p className="text-[14px] font-semibold tabular-nums leading-tight">
            {item.pricing.totalLabel}
          </p>
          <IndicativeHint pricing={item.pricing} />
          <button
            type="button"
            onClick={() => setFeesOpen((open) => !open)}
            className="mt-1 block text-[12px] font-medium text-primary"
          >
            {feesOpen ? 'Hide fee breakdown' : 'View fee breakdown →'}
          </button>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-soft">Arrival</p>
          <p className="text-[13px] font-medium leading-snug">{offering.arrivalLabel}</p>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-soft">Why this rank</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">{item.whyRank}</p>
          {recommended ? (
            <button
              type="button"
              onClick={() => setWhyOpen((open) => !open)}
              className="mt-1 text-[12px] font-medium text-primary"
            >
              {whyOpen ? 'Hide detail' : 'See why →'}
            </button>
          ) : null}
          {isDigital ? (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="mt-1 block text-[12px] font-medium text-primary">
                  What is this?
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3 text-[12px] leading-relaxed text-ink-soft">
                {DIGITAL_DOLLAR_EXPLAINER}
              </PopoverContent>
            </Popover>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={onSelectRoute}
            className="rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-medium text-background"
          >
            Select
          </button>
          <button
            type="button"
            onClick={() => setRouteOpen(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-accent"
          >
            View route
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-soft sm:justify-center">
            <input
              type="checkbox"
              checked={selected}
              disabled={selectDisabled}
              onChange={onToggleSelect}
              aria-label={`Compare ${offering.providerName}`}
              className="rounded border-border"
            />
            Compare
          </label>
        </div>
      </div>

      {feesOpen ? (
        <dl className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-[12px] sm:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-ink-soft">Provider fee</dt>
            <dd className="tabular-nums font-medium">{item.pricing.feeLabel ?? 'Included in the total'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-ink-soft">FX / conversion</dt>
            <dd className="font-medium">{item.pricing.fxLabel ?? offering.fxLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-ink-soft">Recipient</dt>
            <dd className="font-medium">{item.recipientScan}</dd>
          </div>
        </dl>
      ) : null}

      {recommended && whyOpen ? (
        <div className="mt-3 border-t border-border/60 pt-3 text-[12px] leading-snug">
          {whyDetail?.length ? (
            <ul className="list-disc space-y-0.5 pl-4 text-ink-soft">
              {whyDetail.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {recommendationExplanation ? (
            <LandingRecommendationExplanation explanation={recommendationExplanation} />
          ) : null}
          <p className="mt-2 text-[12px] text-ink-soft">
            Ranking could change with your negotiated FX, existing rails or supplier terms.{' '}
            <Link
              href={COMMERCIAL_OS_ROUTES.assessment}
              onClick={onPersonalise}
              className="font-medium text-primary"
            >
              Connect your business →
            </Link>
          </p>
        </div>
      ) : null}

      <Dialog
        open={routeOpen}
        onOpenChange={(next) => {
          setRouteOpen(next);
          advisor?.update({
            stage: next ? 'detail' : 'results',
            selectedProvider: next ? offering.providerName : null,
          });
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{offering.providerName}</DialogTitle>
            <DialogDescription>{offering.productName}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-ink-soft">Estimated cost</dt>
              <dd className="font-medium tabular-nums">{item.pricing.totalLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-ink-soft">Estimated arrival</dt>
              <dd className="font-medium">{offering.arrivalLabel}</dd>
            </div>
          </dl>
          <DetailList title="Requirements" items={offering.requirements} />
          <DetailList title="How the route works" items={offering.howItWorks} />
          <div>
            <h5 className="text-[12px] font-semibold">What the recipient needs</h5>
            <p className="mt-1 text-[13px] text-ink-soft">{item.recipientScan}</p>
          </div>
          <DetailList title="Caveats" items={offering.potentialIssues} />
          <p className="text-[12px] text-ink-soft">{INDICATIVE_ESTIMATE_COPY}</p>
          <button
            type="button"
            onClick={() => {
              setRouteOpen(false);
              onSelectRoute();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2 text-[13px] font-medium text-background"
          >
            Select {offering.providerName} to review
          </button>
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-ink-soft hover:text-foreground"
            >
              Open {offering.providerName} separately →
            </a>
          ) : null}
          <p className="text-[11px] text-ink-soft">
            Selecting a route opens a review. Provvy does not send this payment until you authorise it.
          </p>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h5 className="text-[12px] font-semibold">{title}</h5>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-soft">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

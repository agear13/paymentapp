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
import {
  recommendationBadge,
  recommendedWhyLine,
  scanTraits,
} from '@/lib/journey/landing-result-labels';
import type { LandingPriorityId } from '@/lib/journey/landing-route-comparison';

const DIGITAL_DOLLAR_EXPLAINER =
  'Fast settlement using a digital-dollar payment rail. Typically requires compatible accounts or wallets on both sides.';

export function IndicativeHint({ pricing }: { pricing: LandingProviderResult['pricing'] }) {
  const label = pricingFreshnessLabel(pricing);
  if (pricing.type === 'live') {
    return <span className="text-[10px] font-medium uppercase tracking-wider text-ink-soft">{label}</span>;
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
  onPersonalise,
}: {
  item: LandingProviderResult;
  selected: boolean;
  onToggleSelect: () => void;
  selectDisabled: boolean;
  priority: LandingPriorityId;
  whyDetail?: string[];
  onPersonalise: () => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const advisor = useOptionalLandingAdvisor();
  const offering = item.offering;
  const isDigital = offering.providerId === 'digital_dollar';
  const recommended = item.isRecommended;
  const traits = scanTraits(offering);
  const breakdown = [item.pricing.feeLabel, item.pricing.fxLabel].filter(Boolean).join(' · ');
  const website = LANDING_PROVIDER_WEBSITES[offering.providerId];

  return (
    <article
      className={`rounded-xl border bg-card px-3 py-2.5 sm:px-3.5 ${
        recommended ? 'border-primary/35 shadow-soft' : 'border-border/70'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <LandingProviderMark providerId={offering.providerId} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {recommended ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                {recommendationBadge(priority)}
              </span>
            ) : null}
            <IndicativeHint pricing={item.pricing} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <div className="min-w-0">
              <h4 className="text-[14px] font-semibold leading-tight tracking-tight">
                {offering.providerName}
              </h4>
              <p className="text-[12px] leading-snug text-ink-soft">{offering.productName}</p>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-semibold leading-tight">{item.pricing.totalLabel}</div>
              {breakdown ? <div className="text-[11px] text-ink-soft">{breakdown}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
        <ScanStat label="Cost" value={item.pricing.totalLabel} />
        <ScanStat label="Arrival" value={offering.arrivalLabel} />
        <ScanStat label="Setup" value={item.setupScan} />
        <ScanStat label="Recipient" value={item.recipientScan} />
      </dl>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
          {item.bestFor}
        </span>
        {recommended
          ? traits.map((trait) => (
              <span key={trait} className="text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                {trait}
              </span>
            ))
          : null}
        {isDigital ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-[11px] font-medium text-primary">
                What is this?
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3 text-[12px] leading-relaxed text-ink-soft">
              {DIGITAL_DOLLAR_EXPLAINER}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {recommended ? (
        <div className="mt-1.5 text-[12px] leading-snug">
          <span className="font-medium">Why #1</span>{' '}
          <span className="text-ink-soft">{recommendedWhyLine(priority)}</span>{' '}
          <button
            type="button"
            onClick={() => setWhyOpen((open) => !open)}
            className="font-medium text-primary"
          >
            See why →
          </button>
          {whyOpen && whyDetail?.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-ink-soft">
              {whyDetail.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 text-[11px] text-ink-soft">
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

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setRouteOpen(true)}
          className="rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-accent"
        >
          View route
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-soft">
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
              <dd className="font-medium">{item.pricing.totalLabel}</dd>
              {breakdown ? <dd className="text-[12px] text-ink-soft">{breakdown}</dd> : null}
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
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2 text-[13px] font-medium text-background"
            >
              Continue with {offering.providerName} →
            </a>
          ) : (
            <Link
              href={COMMERCIAL_OS_ROUTES.assessment}
              onClick={onPersonalise}
              className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2 text-[13px] font-medium text-background"
            >
              Continue with {offering.providerName} →
            </Link>
          )}
          <p className="text-[11px] text-ink-soft">
            Provvy helps you choose the route. It does not send this payment.
          </p>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function ScanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="truncate font-medium text-foreground" title={value}>
        {value}
      </dd>
    </div>
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

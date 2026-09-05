'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useLandingIntelligence } from '@/components/journey/lovable/landing-intelligence-context';
import { PaymentRailMark } from '@/components/journey/lovable/payment-rail-mark';
import {
  PAYMENT_SIGNAL_LABELS,
  corridorFit,
  corridorFitLabel,
  rankPaymentIntelligence,
  searchHintForItem,
} from '@/lib/journey/payment-intelligence-rank';
import { countryName } from '@/lib/journey/landing-route-model';

export function LandingPaymentIntelligence() {
  const { origin, destination, highlightedId, setHighlightedId, requestCompare } =
    useLandingIntelligence();
  const ranked = useMemo(
    () => rankPaymentIntelligence({ origin, destination, scope: 'all' }),
    [origin, destination]
  );
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const first = rankPaymentIntelligence({ origin, destination, scope: 'all' }).items[0];
    if (first) setHighlightedId(first.id);
  }, [origin, destination, setHighlightedId]);

  useEffect(() => {
    if (paused || ranked.items.length < 2) return;
    const timer = window.setInterval(() => {
      const index = ranked.items.findIndex((entry) => entry.id === highlightedId);
      const next = ranked.items[(index + 1 + ranked.items.length) % ranked.items.length];
      if (next) setHighlightedId(next.id);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [paused, ranked.items, highlightedId, setHighlightedId]);

  const activeIndex = Math.max(
    0,
    ranked.items.findIndex((entry) => entry.id === highlightedId)
  );
  const item = ranked.items[activeIndex] ?? ranked.items[0];
  const corridor = `${countryName(origin)} → ${countryName(destination)}`;
  const itemFit = item ? corridorFit(item, origin, destination) : 'adjacent';

  const handleShowAffected = () => {
    if (!item) return;
    requestCompare(searchHintForItem(item));
  };

  return (
    <section id="payment-intelligence">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-4">
        <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-soft sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                Payment rail pulse
              </p>
              <p className="mt-1 text-[13px] font-medium">{corridor}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{ranked.snapshotLabel}</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5">
            {ranked.pulse.map((entry) => {
              const selected = entry.id === item?.id;
              const fit = corridorFit(entry, origin, destination);
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={selected}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${entry.provider}: ${PAYMENT_SIGNAL_LABELS[entry.signal]}`}
                  data-intelligence-id={entry.id}
                  data-corridor-fit={fit}
                  data-signal={entry.signal}
                  onClick={() => {
                    setPaused(true);
                    setHighlightedId(entry.id);
                  }}
                  className={`min-w-[8.75rem] rounded-xl border px-2.5 py-2 text-left transition-opacity sm:min-w-[10.5rem] ${
                    selected
                      ? 'border-primary/50 bg-card ring-1 ring-primary/25'
                      : 'border-border/70 bg-background'
                  } ${selected || fit === 'direct' ? 'opacity-100' : fit === 'cross_border' ? 'opacity-75' : 'opacity-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <PaymentRailMark railId={entry.rails[0] ?? 'bank'} size="sm" />
                    <div>
                      <p className="text-[13px] font-semibold leading-tight">{entry.provider}</p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-soft">
                        {PAYMENT_SIGNAL_LABELS[entry.signal]}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{entry.pulseLabel}</p>
                </button>
              );
            })}
          </div>
        </div>

        {item ? (
          <article
            data-intelligence-highlight={item.id}
            data-corridor-fit={itemFit}
            className="rounded-2xl border border-border/70 border-l-2 border-l-primary/45 bg-card/90 p-4 shadow-soft sm:p-5"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                What changed
              </p>
              {corridorFitLabel(itemFit) ? (
                <p className="text-[11px] text-ink-soft">{corridorFitLabel(itemFit)}</p>
              ) : null}
            </div>
            <h3 className="mt-2.5 text-balance text-[18px] font-semibold leading-snug tracking-tight sm:text-[20px]">
              {item.headline}
            </h3>
            <p className="mt-2 text-[12px] text-ink-soft">
              {item.source} · {formatItemDate(item.publishedAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Affected payment rails">
              {item.rails.map((railId) => (
                <PaymentRailMark key={railId} railId={railId} size="sm" />
              ))}
            </div>
            <div
              data-business-impact={item.id}
              className="mt-3.5 rounded-xl border-l-2 border-l-primary/45 bg-background px-3 py-2.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Business impact
              </p>
              <p className="mt-1 text-[13px] leading-snug">{item.businessImpact}</p>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleShowAffected}
                  className="inline-flex rounded-lg bg-foreground px-2.5 py-1.5 text-[12px] font-medium text-background"
                >
                  Show me routes affected by this
                </button>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-foreground"
                >
                  Source <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
              <div className="flex gap-1">
                {ranked.items.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    aria-label={`Show development ${index + 1}`}
                    aria-current={entry.id === item.id ? 'true' : undefined}
                    onClick={() => {
                      setPaused(true);
                      setHighlightedId(entry.id);
                    }}
                    className={`h-1.5 w-5 rounded-full ${
                      entry.id === item.id ? 'bg-foreground' : 'bg-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          </article>
        ) : null}
      </div>
      <p className="mt-3 text-left text-[11px] text-ink-soft">
        These are public announcements Provvy is interpreting — not live quotes, live FX, or a live
        payment network.
      </p>
    </section>
  );
}

function formatItemDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

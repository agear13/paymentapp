'use client';

import { useLandingIntelligence } from '@/components/journey/lovable/landing-intelligence-context';
import { PaymentRailMark } from '@/components/journey/lovable/payment-rail-mark';
import { intelligenceSnapshotLabel, watchlistForScope } from '@/lib/journey/payment-intelligence-rank';
import type { PaymentWatchScope } from '@/lib/journey/payment-intelligence-types';

const SCOPES: { id: PaymentWatchScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'australia', label: 'Australia' },
  { id: 'asia_pacific', label: 'Asia-Pacific' },
  { id: 'cross_border', label: 'Cross-border' },
  { id: 'business', label: 'Business' },
];

const MOVEMENT = {
  up: '↑',
  down: '↓',
  steady: '→',
} as const;

export function LandingRailWatchlist() {
  const { scope, setScope } = useLandingIntelligence();
  const items = watchlistForScope(scope);

  return (
    <section id="watchlist" className="px-6 pb-6">
      <div className="mx-auto max-w-6xl rounded-2xl border border-border/70 bg-card/90 p-3 shadow-soft sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Provvy&apos;s payment rail watchlist
            </p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight">
              10 payment rails Provvy is watching today
            </h2>
            <p className="mt-1 text-[12px] text-ink-soft">{intelligenceSnapshotLabel()}</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Watchlist scope">
            {SCOPES.map((item) => {
              const selected = scope === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setScope(item.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium ${
                    selected
                      ? 'border-primary/40 bg-accent text-foreground'
                      : 'border-border bg-background text-ink-soft hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <ol className="mt-4 divide-y divide-border/60">
          {items.map((item) => (
            <li key={`${scope}-${item.id}`} className="grid gap-2 py-3 sm:grid-cols-[4.5rem_1fr_auto] sm:items-start">
              <div className="flex items-center gap-2">
                <span className="w-6 text-[12px] font-semibold text-ink-soft">
                  {String(item.rank).padStart(2, '0')}
                </span>
                <PaymentRailMark railId={item.id} size="sm" />
              </div>
              <div>
                <p className="text-[14px] font-semibold tracking-tight">{item.name}</p>
                <p className="text-[12px] text-ink-soft">
                  {item.category} · {item.lens}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-ink-soft">{item.reason}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-medium">
                  {MOVEMENT[item.movement]}
                  {item.movement !== 'steady' ? (
                    <span className="sr-only">
                      {item.movement === 'up' ? ' rising' : ' falling'}
                    </span>
                  ) : null}
                </p>
                {item.movementReason ? (
                  <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-ink-soft">
                    {item.movementReason}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

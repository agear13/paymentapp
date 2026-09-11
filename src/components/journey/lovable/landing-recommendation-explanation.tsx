'use client';

import type { RecommendationExplanation } from '@/lib/route-intelligence';

export function LandingRecommendationExplanation({
  explanation,
}: {
  explanation: RecommendationExplanation;
}) {
  if (explanation.status !== 'explained') {
    return (
      <section
        aria-label="Why Provvy recommends this"
        className="mt-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-2"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Why Provvy recommends this
        </p>
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">{explanation.summary}</p>
      </section>
    );
  }

  return (
    <details className="mt-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-2">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        Why Provvy recommends this
      </summary>
      <div className="mt-2 space-y-2">
        {explanation.reasons.length ? (
          <ul className="space-y-1">
            {explanation.reasons.map((reason) => (
              <li key={reason.kind} className="text-[12px] leading-snug text-foreground">
                <span className="mr-1.5 text-primary" aria-hidden="true">
                  ✓
                </span>
                {reason.text}
              </li>
            ))}
          </ul>
        ) : null}
        {explanation.confidence ? (
          <p className="text-[12px] text-ink-soft">
            Provvy confidence · {explanation.confidence.label}
          </p>
        ) : null}
        {explanation.unknowns.length ? (
          <div>
            <p className="text-[11px] font-semibold text-ink-soft">What Provvy doesn&apos;t know</p>
            <ul className="mt-1 space-y-0.5">
              {explanation.unknowns.map((item) => (
                <li key={item.kind} className="text-[12px] leading-snug text-ink-soft">
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {explanation.tradeoffs.length ? (
          <div>
            <p className="text-[11px] font-semibold text-ink-soft">Trade-offs</p>
            <ul className="mt-1 space-y-0.5">
              {explanation.tradeoffs.map((item) => (
                <li key={item.kind} className="text-[12px] leading-snug text-ink-soft">
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {explanation.evidence.length ? (
          <p className="text-[11px] text-ink-soft">
            Evidence · {explanation.evidence.map((item) => item.label).join(' · ')}
          </p>
        ) : null}
      </div>
    </details>
  );
}

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  LANDING_BUSINESS_FLOW_COPY,
  landingBusinessFlowItems,
  type LandingBusinessFlowItem,
} from '@/lib/journey/landing-business-flows';

const itemFocusClass =
  'outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20';

function WorkflowProofItem({ item }: { item: LandingBusinessFlowItem }) {
  const content = (
    <>
      <p className="text-[13px] font-semibold tracking-tight text-foreground sm:text-[14px]">
        {item.business}
      </p>
      <p className="mt-0.5 text-[12px] font-medium text-primary">{item.workflow}</p>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{item.description}</p>
    </>
  );

  const className = `block h-full min-h-[2.75rem] max-lg:rounded-xl max-lg:border max-lg:border-border/60 max-lg:bg-background max-lg:p-3.5 ${itemFocusClass} max-lg:hover:border-primary/30 lg:px-0`;

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        aria-label={`${item.business}: ${item.workflow}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      <p className="sr-only">Workflow example</p>
      {content}
    </div>
  );
}

export function LandingBusinessFlows() {
  const items = landingBusinessFlowItems();

  return (
    <section aria-labelledby="landing-business-flows-heading">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-2xl text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-soft sm:text-[12px]">
              {LANDING_BUSINESS_FLOW_COPY.eyebrow}
            </p>
            <h2
              id="landing-business-flows-heading"
              className="mt-2 text-balance text-[1.05rem] font-semibold tracking-[-0.02em] sm:text-xl"
            >
              {LANDING_BUSINESS_FLOW_COPY.headline}
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-snug text-ink-soft sm:text-[14px]">
              {LANDING_BUSINESS_FLOW_COPY.body}
            </p>
          </div>
          <Link
            href={LANDING_BUSINESS_FLOW_COPY.ctaHref}
            className={`inline-flex shrink-0 items-center gap-1 self-start rounded-lg py-2 text-[13px] font-medium text-primary ${itemFocusClass} hover:text-foreground`}
          >
            {LANDING_BUSINESS_FLOW_COPY.ctaLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="relative mt-4 lg:mt-5">
          <ul
            className="landing-business-flows-scroller flex gap-3 overflow-x-auto overscroll-x-contain pb-1 max-lg:snap-x max-lg:snap-mandatory max-lg:pr-8 lg:gap-0 lg:overflow-visible lg:pb-0 lg:pr-0 lg:divide-x lg:divide-border/60"
            aria-label="Business workflow examples"
          >
            {items.map((item) => (
              <li
                key={item.business}
                className="max-lg:min-w-[min(16.5rem,78%)] max-lg:snap-start lg:min-w-0 lg:flex-1 lg:px-5 lg:first:pl-0 lg:last:pr-0"
              >
                <WorkflowProofItem item={item} />
              </li>
            ))}
          </ul>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 lg:hidden"
            style={{ background: 'linear-gradient(to left, var(--card), transparent)' }}
          />
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen, Hexagon, Layers, Wallet } from 'lucide-react';
import { PaymentRailMark } from '@/components/journey/lovable/payment-rail-mark';
import {
  LANDING_INFRASTRUCTURE_COPY,
  LANDING_INFRASTRUCTURE_NODES,
  landingInfrastructureCurve,
  type LandingInfrastructureId,
  type LandingInfrastructureNode,
} from '@/lib/journey/landing-infrastructure-layer';

const itemFocusClass =
  'outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20';

function IntegrationMark({ node }: { node: LandingInfrastructureNode }) {
  if (node.mark === 'stripe' || node.mark === 'wise' || node.mark === 'airwallex') {
    return <PaymentRailMark railId={node.mark} size="sm" />;
  }

  const Icon =
    node.mark === 'wallet' ? Wallet : node.mark === 'hash' ? Hexagon : node.mark === 'payout' ? Layers : BookOpen;

  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border/70 bg-card text-primary"
      aria-hidden="true"
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function IntegrationNode({
  node,
  active,
  onFocus,
  onBlur,
}: {
  node: LandingInfrastructureNode;
  active: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <div
      className={`landing-infra-node absolute z-[2] -translate-x-1/2 -translate-y-1/2 ${
        node.desktopOnly ? 'hidden lg:block' : ''
      }`}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <button
        type="button"
        className={`group relative flex min-h-[2.75rem] items-center gap-2 rounded-full border bg-background/90 px-2 py-1.5 shadow-soft backdrop-blur-sm ${itemFocusClass} ${
          active
            ? 'border-primary/45 shadow-glow'
            : 'border-border/70 hover:border-primary/35'
        }`}
        aria-label={`${node.name}: ${node.category}. ${node.detail}`}
        onMouseEnter={onFocus}
        onMouseLeave={onBlur}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <IntegrationMark node={node} />
        <span className="pr-1 text-left">
          <span className="block text-[12px] font-semibold leading-tight tracking-tight">
            {node.name}
          </span>
          <span className="hidden text-[10px] uppercase tracking-wider text-ink-soft sm:block">
            {node.category}
          </span>
        </span>
        <span
          className={`pointer-events-none absolute left-1/2 z-10 w-max max-w-[11rem] -translate-x-1/2 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-left shadow-soft ${
            node.y > 70 ? 'bottom-[calc(100%+0.4rem)]' : 'top-[calc(100%+0.4rem)]'
          } ${active ? 'visible opacity-100' : 'invisible opacity-0'}`}
        >
          <span className="block text-[11px] font-medium text-foreground">{node.category}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{node.detail}</span>
        </span>
      </button>
    </div>
  );
}

export function LandingInfrastructureLayer() {
  const [activeId, setActiveId] = useState<LandingInfrastructureId | null>(null);
  const copy = LANDING_INFRASTRUCTURE_COPY;

  return (
    <section aria-labelledby="landing-infrastructure-heading">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft sm:p-5 lg:p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] lg:gap-8">
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-soft sm:text-[12px]">
              {copy.eyebrow}
            </p>
            <h2
              id="landing-infrastructure-heading"
              className="mt-2 text-balance text-[1.35rem] font-semibold tracking-[-0.03em] sm:text-2xl lg:text-[1.75rem]"
            >
              {copy.headline}
              <span className="mt-1 block text-foreground/90">{copy.headlineAccent}</span>
            </h2>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-ink-soft sm:text-[14px]">
              {copy.body}
            </p>
            <Link
              href={copy.ctaHref}
              className={`mt-4 inline-flex items-center gap-1 rounded-lg py-2 text-[13px] font-medium text-primary ${itemFocusClass} hover:text-foreground`}
            >
              {copy.ctaLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="landing-infra-stage relative mx-auto w-full max-w-[36rem] lg:max-w-none">
            <div className="landing-infra-canvas relative aspect-[1.05] w-full sm:aspect-[1.15] lg:aspect-[1.22]">
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full overflow-visible"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <filter id="landing-infra-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="0.6" />
                  </filter>
                </defs>
                {LANDING_INFRASTRUCTURE_NODES.map((node) => {
                  const d = landingInfrastructureCurve(node.x, node.y);
                  const active = activeId === node.id;
                  return (
                    <g
                      key={node.id}
                      className={node.desktopOnly ? 'landing-infra-desktop-only' : undefined}
                    >
                      <path
                        d={d}
                        fill="none"
                        stroke="oklch(0.62 0.18 293)"
                        strokeOpacity={active ? '0.28' : '0.12'}
                        strokeWidth={active ? '1.6' : '1.1'}
                        filter="url(#landing-infra-glow)"
                      />
                      <path
                        className="landing-infra-path"
                        d={d}
                        fill="none"
                        stroke="oklch(0.72 0.16 293)"
                        strokeOpacity={active ? '0.95' : '0.42'}
                        strokeWidth={active ? '0.55' : '0.38'}
                      />
                      <circle
                        className="landing-infra-dot"
                        r={active ? 0.85 : 0.55}
                        fill="oklch(0.82 0.12 293)"
                      >
                        <animateMotion dur={`${6.8 + (node.x % 5) * 0.4}s`} repeatCount="indefinite" path={d} />
                      </circle>
                    </g>
                  );
                })}
              </svg>

              <div className="landing-infra-hub pointer-events-none absolute left-1/2 top-1/2 z-[1] w-[10.5rem] -translate-x-1/2 -translate-y-1/2 sm:w-[12.25rem]">
                <div className="landing-infra-hub__glow" />
                <div className="relative rounded-2xl border border-primary/30 bg-card/95 px-3 py-3 text-center shadow-glow backdrop-blur-md sm:px-4 sm:py-3.5">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#6A4BFF] shadow-sm sm:h-10 sm:w-10">
                    <Image
                      src="/provvypay-icon.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="brightness-0 invert"
                    />
                  </div>
                  <p className="mt-2 text-[13px] font-semibold tracking-tight sm:text-[14px]">
                    {copy.centerName}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary sm:text-[11px]">
                    {copy.centerRole}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-snug text-ink-soft sm:text-[11px]">
                    {copy.centerFlow}
                  </p>
                </div>
              </div>

              {LANDING_INFRASTRUCTURE_NODES.map((node) => (
                <IntegrationNode
                  key={node.id}
                  node={node}
                  active={activeId === node.id}
                  onFocus={() => setActiveId(node.id)}
                  onBlur={() => setActiveId((current) => (current === node.id ? null : current))}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-ink-soft sm:mt-5">
          {copy.footer}
        </p>
        <p className="mt-1 text-center text-[11px] tracking-wide text-ink-soft">
          {copy.footerCategories}
        </p>
      </div>
    </section>
  );
}

import { Layers, Megaphone, Sparkles } from 'lucide-react';
import {
  LABS_CALENDLY_URL,
  LABS_CREDIT_TIERS,
  LABS_MARKETING_CAPABILITIES,
} from '@/lib/labs/labs-constants';

export function LabsAiMarketingTeam() {
  return (
    <section id="ai-teams" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Deploy <span className="text-gradient">AI Teams</span>
        </h2>
        <p className="mt-5 max-w-2xl text-[16px] text-ink-soft">
          Purchase credits and use them to deploy AI-powered work whenever your business needs it.
        </p>

        <div className="mt-12 overflow-hidden rounded-3xl bg-gradient-purple p-[1px] shadow-glow">
          <div className="rounded-[calc(1.5rem-1px)] bg-card p-8 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
                    <Megaphone className="h-[18px] w-[18px]" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
                <div className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">
                  AI Marketing Team
                </div>
                <p className="mt-2 max-w-md text-[14.5px] text-ink-soft">
                  Your AI marketing department, trained on your business.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LABS_MARKETING_CAPABILITIES.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11.5px] text-ink-soft"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {LABS_CREDIT_TIERS.map((t) => (
                <div
                  key={t.name}
                  className={
                    t.popular
                      ? 'relative rounded-2xl border border-primary/40 bg-accent/40 p-6 shadow-glow'
                      : 'relative rounded-2xl border border-border/60 bg-background p-6 shadow-card'
                  }
                >
                  {t.popular && (
                    <span className="absolute -top-2.5 left-6 rounded-full bg-gradient-purple px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-primary-foreground">
                      Most Popular
                    </span>
                  )}
                  <div className="text-[11px] uppercase tracking-wider text-ink-soft">{t.name}</div>
                  <div className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">
                    {t.price}
                    <span className="text-[14px] font-normal text-ink-soft">/month</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    {t.credits}
                  </div>
                  <a
                    href={LABS_CALENDLY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      t.popular
                        ? 'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13.5px] font-medium text-primary-foreground shadow-glow'
                        : 'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-accent'
                    }
                  >
                    Choose {t.name}
                  </a>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-primary/25 bg-accent/30 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="text-[13.5px] leading-relaxed text-foreground/90">
                  <p>
                    A Campaign Credit gives you access to a complete AI Marketing Team campaign
                    execution — not simply an individual piece of content.
                  </p>
                  <p className="mt-2">Use your credits whenever your business needs marketing work.</p>
                  <p className="mt-2 text-ink-soft">
                    Buy credits, submit a brief, and the AI Marketing Team executes — every campaign
                    is reviewed by a human before anything is published.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

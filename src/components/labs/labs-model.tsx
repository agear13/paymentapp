import { ChevronRight } from 'lucide-react';
import { LABS_CHAIN } from '@/lib/labs/labs-constants';

export function LabsModel() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          One business.
          <br />
          One brain.
          <br />
          <span className="text-gradient">Multiple AI Teams.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-[16px] text-ink-soft">
          The Company Brain provides the context AI systems need to understand your specific
          business — your language, customers, products and processes — so every AI Team starts
          informed rather than generic.
        </p>

        <div className="mt-12 grid gap-3 lg:grid-cols-5">
          {LABS_CHAIN.map(({ label, desc, icon: Icon }, i) => (
            <div key={label} className="relative">
              <div className="h-full rounded-2xl border border-border/60 bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div
                    className={
                      i === 1
                        ? 'grid h-10 w-10 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow'
                        : 'grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary'
                    }
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <span className="text-[11px] tabular-nums text-ink-soft">0{i + 1}</span>
                </div>
                <div className="mt-6 text-[14.5px] font-semibold tracking-tight">{label}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{desc}</p>
              </div>
              {i < LABS_CHAIN.length - 1 && (
                <ChevronRight className="absolute -bottom-1 left-1/2 h-4 w-4 -translate-x-1/2 rotate-90 text-ink-soft lg:-right-3.5 lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 lg:rotate-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

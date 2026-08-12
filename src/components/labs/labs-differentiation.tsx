import { LABS_DIFFERENTIATORS } from '@/lib/labs/labs-constants';

export function LabsDifferentiation() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Not another <span className="text-gradient">AI chatbot.</span>
            </h2>
            <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
              Generic AI starts with a blank page. Provvy Labs starts with your business.
            </p>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
              Your Company Brain gives AI Teams access to your brand, products, customers, processes
              and business context — so the work they produce is grounded in how your business
              actually operates.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {LABS_DIFFERENTIATORS.map(({ label, desc, icon: Icon }, i) => (
              <div
                key={label}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] tabular-nums text-ink-soft">0{i + 1}</span>
                </div>
                <div className="mt-6 text-[14.5px] font-semibold tracking-tight">{label}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

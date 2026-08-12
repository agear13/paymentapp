import { Sparkles } from 'lucide-react';
import { LABS_HOW_IT_WORKS_STEPS } from '@/lib/labs/labs-constants';

export function LabsHowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-[42px]">
          How it <span className="text-gradient">works</span>
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          {LABS_HOW_IT_WORKS_STEPS.map((s, i) => (
            <div key={s} className="bg-card p-6">
              <div className="text-[12px] font-semibold tabular-nums text-primary">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="mt-4 text-[15px] font-semibold leading-snug tracking-tight">{s}</div>
            </div>
          ))}
          <div className="bg-card p-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="mt-4 text-[13px] text-ink-soft">
              Every step stays in your Provvy Labs workspace.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

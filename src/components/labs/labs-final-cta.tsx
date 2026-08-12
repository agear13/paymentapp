import { ArrowRight, Brain, Calendar } from 'lucide-react';
import { LABS_CALENDLY_URL } from '@/lib/labs/labs-constants';

export function LabsFinalCta() {
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-purple p-[1px] shadow-glow">
          <div className="rounded-[calc(1.5rem-1px)] bg-card p-10 text-center sm:p-16">
            <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-purple shadow-glow">
              <Brain className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Your business already has the knowledge.
              <br />
              <span className="text-gradient">Now give AI access to it.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[15px] text-ink-soft">
              Build your Company Brain and start deploying AI Teams.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#company-brain"
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
              >
                Build My Company Brain
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href={LABS_CALENDLY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Calendar className="h-4 w-4" />
                Talk to Provvy Labs
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

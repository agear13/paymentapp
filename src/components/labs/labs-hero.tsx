import { ArrowRight, Beaker, Calendar } from 'lucide-react';
import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';

export function LabsHero() {
  return (
    <section className="px-6 pb-16 pt-20 sm:pt-28">
      <div className="mx-auto max-w-6xl">
        <div className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground">
          <Beaker className="h-3.5 w-3.5" /> Provvy Labs
        </div>
        <h1 className="mt-6 max-w-3xl text-balance text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">
          Build your business&apos;s <span className="text-gradient">AI layer.</span>
        </h1>
        <div className="mt-7 max-w-xl space-y-1.5 text-[16px] text-ink-soft sm:text-[17px]">
          <p>Build your Company Brain once.</p>
          <p>Deploy AI Teams when you need them.</p>
          <p>Connect them to workflows as your business grows.</p>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href="#company-brain"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            Build My Company Brain
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#ai-teams"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            Explore AI Teams
          </a>
          <a
            href={CALENDLY_CONSULTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-2 py-3.5 text-[14px] font-medium text-ink-soft transition-colors hover:text-foreground"
          >
            <Calendar className="h-4 w-4" />
            Talk to Provvy Labs
          </a>
        </div>
      </div>
    </section>
  );
}

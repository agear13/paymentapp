import { ArrowRight, Brain, Sparkles } from 'lucide-react';
import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';
import { LABS_BRAIN_CARDS } from '@/lib/labs/labs-constants';

export function LabsCompanyBrain() {
  return (
    <section id="company-brain" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground">
              <Brain className="h-3.5 w-3.5" /> Foundation
            </div>
            <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-[42px]">
              Build Your <span className="text-gradient">Company Brain</span>
            </h2>
            <p className="mt-5 max-w-md text-[16px] text-ink-soft">
              Turn the knowledge already inside your business into a structured AI-ready source of
              truth.
            </p>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
              Most businesses already have the knowledge AI needs — it&apos;s just scattered across
              documents, systems, conversations and people&apos;s heads.
            </p>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
              We structure that knowledge into a Company Brain that gives every AI Team the context
              it needs to work like it understands your business.
            </p>

            <div className="mt-8 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
              <div className="text-[11px] uppercase tracking-wider text-ink-soft">
                One-time implementation
              </div>
              <div className="mt-2 text-4xl font-semibold tracking-[-0.03em]">A$3,500</div>
              <p className="mt-2 text-[13px] text-ink-soft">
                Delivered with you by the Provvy Labs implementation team.
              </p>
              <a
                href={CALENDLY_CONSULTATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-purple px-5 py-3 text-[14.5px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
              >
                Build My Company Brain
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {LABS_BRAIN_CARDS.map((c) => (
              <div
                key={c.label}
                className="group rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">Knowledge</span>
                </div>
                <div className="mt-4 text-[15.5px] font-semibold tracking-tight">{c.label}</div>
                <p className="mt-1 text-[12.5px] text-ink-soft">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

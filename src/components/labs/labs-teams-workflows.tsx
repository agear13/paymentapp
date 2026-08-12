import Link from 'next/link';
import { ArrowUpRight, Workflow } from 'lucide-react';
import { LABS_WORKFLOWS_HREF } from '@/lib/labs/labs-constants';

export function LabsTeamsWorkflows() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-border/60 bg-card p-10 shadow-card sm:p-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground">
            <Workflow className="h-3.5 w-3.5" /> Connected
          </div>
          <h2 className="mt-6 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-[42px]">
            AI Teams do the work. <span className="text-gradient">Workflows connect it.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[15.5px] text-ink-soft">
            AI Teams produce commercial work. Provvy Workflows are where that work can eventually be
            connected into how your business actually operates — approvals, invoicing, reporting and
            follow-up — so outputs become outcomes rather than documents.
          </p>
          <Link
            href={LABS_WORKFLOWS_HREF}
            className="group mt-8 inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-[14.5px] font-medium transition-colors hover:bg-accent"
          >
            Explore Provvy Workflows
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

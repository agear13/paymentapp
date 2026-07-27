'use client';

import Link from 'next/link';
import { Library, Sparkles, Clock, ArrowRight, Check } from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { WORKFLOW_LIBRARY, getRecommendedWorkflow } from '@/lib/journey/workflow-library-catalog';

export function WorkspaceWorkflowsScreen() {
  const recommended = getRecommendedWorkflow();
  const library = WORKFLOW_LIBRARY.filter((entry) => !entry.recommended);

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <Library className="h-3 w-3" />
          Workflow Library
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Deployable commercial workflows.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Each workflow is a full commercial blueprint — designed, calibrated and monitored by Provvy AI.
        </p>
      </header>

      <section>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Recommended for your business
        </div>
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-purple px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-primary-foreground">
                  <Sparkles className="h-3 w-3" />
                  Recommended
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Ready to Deploy
                </div>
              </div>
              <div className="mt-3 text-xl font-semibold tracking-tight">{recommended.name}</div>
              <p className="mt-1 max-w-xl text-[13.5px] text-ink-soft">{recommended.summary}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft">
                <Clock className="h-3.5 w-3.5" />
                Saves {recommended.impact.timeSaved}
              </div>
            </div>
            <Link
              href={recommended.deployRoute}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
            >
              Continue Workflow
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Additional workflows
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {library.map((workflow) => (
            <div key={workflow.slug} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="text-[15px] font-semibold">{workflow.name}</div>
              <p className="mt-1 text-[13px] text-ink-soft">{workflow.summary}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
                  <Clock className="h-3.5 w-3.5" />
                  Saves {workflow.saved}
                </span>
                <Link
                  href={COMMERCIAL_OS_ROUTES.workflowDetail(workflow.slug)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <Check className="h-3.5 w-3.5" />
                  Preview
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

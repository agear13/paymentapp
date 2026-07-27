'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Sparkles,
  TrendingUp,
  Brain,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <div className="flex items-center gap-2 text-[12px] text-ink-soft">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-2 text-[18px] font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export function WorkflowDetailScreen({
  slug,
  backHref = COMMERCIAL_OS_ROUTES.workflows,
  backLabel = 'Back to Workflow Library',
}: {
  slug: string;
  backHref?: string;
  backLabel?: string;
}) {
  const workflow = getWorkflowBySlug(slug);
  if (!workflow) notFound();

  const Icon = workflow.icon;

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
                Commercial Workflow
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {workflow.name}
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">{workflow.overview}</p>
            </div>
          </div>
          {workflow.recommended ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-medium text-accent-foreground">
              <Sparkles className="h-3 w-3" />
              Recommended for your business
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 border-b border-border p-8 md:grid-cols-3">
          <Metric icon={Clock} label="Estimated time saved" value={workflow.impact.timeSaved} />
          <Metric icon={TrendingUp} label="Business impact" value={workflow.impact.businessImpact} />
          <Metric icon={Sparkles} label="Deployment" value={workflow.impact.deployment} />
        </div>

        <div className="grid gap-8 border-b border-border p-8 lg:grid-cols-2">
          <div className="space-y-6">
            <section>
              <div className="text-[13px] font-semibold text-foreground">Business problem solved</div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{workflow.problem}</p>
            </section>
            <section>
              <div className="text-[13px] font-semibold text-foreground">Expected outcome</div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{workflow.outcome}</p>
            </section>
            <section>
              <div className="text-[13px] font-semibold text-foreground">Systems connected</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {workflow.systems.map((system) => (
                  <span
                    key={system}
                    className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-[12px] font-medium text-foreground"
                  >
                    {system}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <div>
            <div className="text-[13px] font-semibold text-foreground">Included capabilities</div>
            <ul className="mt-4 space-y-2.5">
              {workflow.capabilities.map((capability) => (
                <li key={capability} className="flex items-start gap-2.5 text-[13.5px] text-foreground">
                  <div className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                  {capability}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <Brain className="h-3.5 w-3.5 text-primary" />
              Commercial reasoning
            </div>
            <div className="mt-4 space-y-4 text-[13.5px] leading-relaxed text-ink-soft">
              {workflow.reasoning.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-secondary/40 p-6">
          <div className="text-[12.5px] text-ink-soft">
            Preview the workflow end-to-end or deploy it into your Commercial OS workspace.
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={workflow.previewRoute}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Preview Workflow
            </Link>
            <Link
              href={workflow.deployRoute}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-purple px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
            >
              Deploy Workflow
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

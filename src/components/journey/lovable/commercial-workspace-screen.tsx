'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Briefcase,
  ChevronRight,
  FilePlus2,
  LayoutGrid,
  Library,
  ReceiptText,
  RefreshCw,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  buildInstalledWorkspaceActions,
  buildWorkspaceAttentionItems,
} from '@/lib/journey/installed-workflow-workspace-actions';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';

const QUICK_ACTIONS = [
  {
    label: 'Commercial Workspaces',
    icon: Briefcase,
    href: COMMERCIAL_OS_ROUTES.arrangements,
  },
  {
    label: 'Create Invoice',
    icon: FilePlus2,
    href: COMMERCIAL_OS_ROUTES.createInvoice,
  },
  {
    label: 'Manage Invoices',
    icon: ReceiptText,
    href: COMMERCIAL_OS_ROUTES.receivables,
  },
  {
    label: 'Sync with Accounting',
    icon: RefreshCw,
    href: COMMERCIAL_OS_ROUTES.connected,
  },
  {
    label: 'Collections & Revenue',
    icon: BarChart3,
    href: COMMERCIAL_OS_ROUTES.timeline,
  },
  {
    label: 'Workflow Library',
    icon: Library,
    href: COMMERCIAL_OS_ROUTES.workflowLibrary,
  },
];

export function CommercialWorkspaceScreen() {
  const { workflows, loading } = useDeployedWorkflows();
  const installedActions = buildInstalledWorkspaceActions(workflows);
  const attentionItems = buildWorkspaceAttentionItems(workflows);

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            <LayoutGrid className="h-3 w-3" />
            Operating dashboard
          </div>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Your commercial operating dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
            Operate installed workflows, respond to items needing attention, and jump into
            day-to-day commercial actions.
          </p>
        </div>
        <Link
          href={COMMERCIAL_OS_ROUTES.workspace}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
        >
          Back to Workspace
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Active workflows
          </div>
          <div className="mt-1 text-[15px] font-semibold">Installed in your workspace</div>
          {loading ? (
            <p className="mt-4 text-[13px] text-ink-soft">Loading workflows…</p>
          ) : installedActions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-[13px] text-ink-soft">
              No workflows installed yet. Browse the{' '}
              <Link href={COMMERCIAL_OS_ROUTES.workflowLibrary} className="font-medium text-primary hover:underline">
                Workflow Library
              </Link>{' '}
              to add capabilities to your workspace.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {installedActions.map((action) => {
                const catalog = getWorkflowBySlug(action.slug);
                const Icon = catalog?.icon ?? Brain;
                return (
                  <Link
                    key={action.slug}
                    href={action.href}
                    className="group flex items-start justify-between gap-4 rounded-xl border border-border bg-background px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold">{action.title}</div>
                        <p className="mt-1 text-[13px] text-ink-soft">{action.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Needs attention
          </div>
          <div className="mt-1 text-[15px] font-semibold">Reviews, exceptions, and next steps</div>
          {loading ? (
            <p className="mt-4 text-[13px] text-ink-soft">Loading…</p>
          ) : attentionItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-[13px] text-ink-soft">
              Nothing needs attention right now.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {attentionItems.map((item) => (
                <Link
                  key={`${item.slug}-${item.message}`}
                  href={item.href}
                  className={`block rounded-xl border px-4 py-4 transition-colors hover:bg-accent/40 ${
                    item.severity === 'warning'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="text-[14px] font-semibold">{item.title}</div>
                  <p className="mt-1 text-[13px] text-ink-soft">{item.message}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Quick actions
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 py-3 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-ink-soft group-hover:text-primary" />
                  {action.label}
                </span>
                <ChevronRight className="h-4 w-4 text-ink-soft transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

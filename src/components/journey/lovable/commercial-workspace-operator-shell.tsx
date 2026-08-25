'use client';

import '@/components/journey/lovable/lovable-journey.css';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import {
  agreementIdFromPilotDealId,
  commercialWorkspaceShowsAgreementTab,
  commercialWorkspaceSourceOf,
  sourceAgreementHref,
  toCommercialWorkspaceListItem,
} from '@/lib/commercial-os/commercial-workspace-collection';

type TabId = 'overview' | 'agreement' | 'people' | 'obligations' | 'money' | 'activity';

type SourceAgreementState = {
  id: string;
  title: string;
  href: string;
} | null;

function hrefForTab(workspaceId: string, tab: TabId): string {
  switch (tab) {
    case 'overview':
      return COMMERCIAL_OS_ROUTES.arrangement(workspaceId);
    case 'agreement':
      return COMMERCIAL_OS_ROUTES.arrangementAgreement(workspaceId);
    case 'people':
      return COMMERCIAL_OS_ROUTES.arrangementPeople(workspaceId);
    case 'obligations':
      return COMMERCIAL_OS_ROUTES.arrangementObligations(workspaceId);
    case 'money':
      return COMMERCIAL_OS_ROUTES.arrangementMoney(workspaceId);
    case 'activity':
      return COMMERCIAL_OS_ROUTES.arrangementActivity(workspaceId);
  }
}

function resolveActiveTab(pathname: string, workspaceId: string): TabId {
  const base = COMMERCIAL_OS_ROUTES.arrangement(workspaceId);
  if (pathname.startsWith(`${base}/agreement`)) return 'agreement';
  if (pathname.startsWith(`${base}/people`)) return 'people';
  if (pathname.startsWith(`${base}/obligations`)) return 'obligations';
  if (pathname.startsWith(`${base}/money`)) return 'money';
  if (pathname.startsWith(`${base}/activity`)) return 'activity';
  return 'overview';
}

export function CommercialWorkspaceOperatorShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const ctx = useProjectWorkspace();
  const pathname = usePathname() ?? '';
  const [linkedAgreement, setLinkedAgreement] = React.useState<SourceAgreementState>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/commercial-os/arrangements/${encodeURIComponent(workspaceId)}/source-agreement`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok) return;
        const json = (await res.json()) as { agreement?: SourceAgreementState };
        if (!cancelled) setLinkedAgreement(json.agreement ?? null);
      } catch {
        if (!cancelled) setLinkedAgreement(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (ctx.loading && !ctx.deal) {
    return (
      <div className="animate-fade-up py-16 text-center text-[13px] text-ink-soft">
        Loading Commercial Workspace…
      </div>
    );
  }

  if (ctx.notFound || !ctx.deal) {
    return (
      <div className="animate-fade-up space-y-6 pb-16" data-testid="commercial-workspace-not-found">
        <Link
          href={COMMERCIAL_OS_ROUTES.arrangements}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Commercial Workspaces
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-xl font-semibold">Commercial Workspace not found</h1>
          <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
            This workspace is not available in your current session. Commercial Workspaces are
            currently listed for the signed-in operator who created them.
          </p>
        </div>
      </div>
    );
  }

  const item = toCommercialWorkspaceListItem(ctx.deal, ctx.projectParticipants);
  const inferredAgreementId = agreementIdFromPilotDealId(ctx.deal.id);
  const showAgreementTab = commercialWorkspaceShowsAgreementTab(
    commercialWorkspaceSourceOf(ctx.deal),
    linkedAgreement?.id ?? inferredAgreementId
  );
  const active = resolveActiveTab(pathname, workspaceId);
  const sourceHref =
    linkedAgreement?.href ??
    (inferredAgreementId ? sourceAgreementHref(inferredAgreementId) : null);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(showAgreementTab ? [{ id: 'agreement' as const, label: 'Agreement' }] : []),
    { id: 'people', label: 'People' },
    { id: 'obligations', label: 'Obligations' },
    { id: 'money', label: 'Money' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="animate-fade-up space-y-8 pb-16" data-testid="commercial-workspace-detail">
      <Link
        href={COMMERCIAL_OS_ROUTES.arrangements}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Commercial Workspaces
      </Link>

      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
          <Briefcase className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Commercial Workspace
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
            {item.statusLabel}
            {ctx.deal.partner ? ` · ${ctx.deal.partner}` : ''}
            {' · '}
            {item.sourceLabel}
          </p>
          {item.source === 'agreement_intelligence' && sourceHref ? (
            <Link
              href={sourceHref}
              className="mt-3 inline-flex text-[13px] font-medium text-primary hover:underline"
              data-testid="source-agreement-intelligence"
            >
              View source in Agreement Intelligence
            </Link>
          ) : null}
        </div>
      </div>

      <nav
        className="flex gap-0.5 overflow-x-auto border-b border-border pb-px"
        aria-label="Commercial Workspace sections"
        data-testid="commercial-workspace-tabs"
      >
        {tabs.map((tab) => {
          const href = hrefForTab(workspaceId, tab.id);
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              data-testid={`workspace-tab-${tab.id}`}
              className={cn(
                'whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-[13px] font-medium transition-colors -mb-px',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-ink-soft hover:border-border hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

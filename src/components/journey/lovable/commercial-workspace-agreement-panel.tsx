'use client';

import * as React from 'react';
import Link from 'next/link';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import {
  agreementIdFromPilotDealId,
  commercialWorkspaceSourceOf,
  sourceAgreementHref,
} from '@/lib/commercial-os/commercial-workspace-collection';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type LinkedAgreement = {
  id: string;
  title: string;
  href: string;
  extractionStatus?: string;
};

export function CommercialWorkspaceAgreementPanel() {
  const { deal } = useProjectWorkspace();
  const [linked, setLinked] = React.useState<LinkedAgreement | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!deal) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/commercial-os/arrangements/${encodeURIComponent(deal.id)}/source-agreement`,
          { credentials: 'include', cache: 'no-store' }
        );
        const json = res.ok
          ? ((await res.json()) as { agreement?: LinkedAgreement | null })
          : { agreement: null };
        if (!cancelled) setLinked(json.agreement ?? null);
      } catch {
        if (!cancelled) setLinked(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deal]);

  if (!deal) return null;

  const source = commercialWorkspaceSourceOf(deal);
  const inferredId = agreementIdFromPilotDealId(deal.id);
  const href = linked?.href ?? (inferredId ? sourceAgreementHref(inferredId) : null);
  const title = linked?.title ?? deal.dealName;
  const isLinked = Boolean(linked || inferredId || source === 'agreement_intelligence');

  if (loading) {
    return <p className="text-[13px] text-ink-soft">Loading agreement link…</p>;
  }

  if (!isLinked) {
    return (
      <div
        className="rounded-2xl border border-border bg-card p-5 shadow-card"
        data-testid="workspace-agreement-manual"
      >
        <h2 className="text-[16px] font-semibold">No source agreement</h2>
        <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
          This Commercial Workspace was created manually. It is not linked to an Agreement
          Intelligence extraction. Extract an agreement later from the workflow library if you need
          that source record — do not duplicate terms here.
        </p>
        <Link
          href={COMMERCIAL_OS_ROUTES.workflowInstance('agreement-intelligence')}
          className="mt-3 inline-flex text-[13px] font-medium text-primary hover:underline"
        >
          Open Agreement Intelligence
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="workspace-agreement-linked">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Source agreement
        </div>
        <h2 className="mt-2 text-[16px] font-semibold">{title}</h2>
        <p className="mt-2 text-[14px] text-ink-soft">
          Commercial terms for this workspace come from the linked Agreement Intelligence record.
          Extraction stays on that workflow — this page does not store a second copy.
        </p>
        {href ? (
          <Link
            href={href}
            className="mt-3 inline-flex text-[13px] font-medium text-primary hover:underline"
            data-testid="workspace-agreement-detail-link"
          >
            Open Agreement Intelligence detail
          </Link>
        ) : null}
      </div>
    </div>
  );
}

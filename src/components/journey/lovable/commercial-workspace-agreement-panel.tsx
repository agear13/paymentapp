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
import { EarlyPaymentIncentiveCard } from '@/components/commercial-incentive/early-payment-incentive-card';
import { AgreementPaymentScheduleCard } from '@/components/commercial-os/agreement-payment-schedule-card';
import { CommitmentFulfillmentCard } from '@/components/commercial-os/commitment-fulfillment-card';
import { OnchainCommitmentCard } from '@/components/xlayer/onchain-commitment-card';
import { commitmentRouteContextFromSchedule } from '@/lib/commercial-os/commitment-route-context';
import type { AgreementPaymentScheduleView } from '@/lib/commercial-os/payment-schedule-presentation';
import type { EarlyPaymentIncentiveView } from '@/lib/commercial-incentive/types';

type LinkedAgreement = {
  id: string;
  title: string;
  href: string;
  extractionStatus?: string;
  paymentSchedule?: AgreementPaymentScheduleView | null;
};

export function CommercialWorkspaceAgreementPanel() {
  const { deal } = useProjectWorkspace();
  const [linked, setLinked] = React.useState<LinkedAgreement | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [incentiveApproved, setIncentiveApproved] = React.useState(false);

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
      {linked?.paymentSchedule ? (
        <AgreementPaymentScheduleCard schedule={linked.paymentSchedule} />
      ) : null}
      {linked?.id ? (
        <EarlyPaymentIncentiveCard
          agreementId={linked.id}
          onViewChange={(view: EarlyPaymentIncentiveView | null) =>
            setIncentiveApproved(view?.decision?.status === 'approved')
          }
        />
      ) : null}
      {incentiveApproved ? (
        <CommitmentFulfillmentCard
          payment={commitmentRouteContextFromSchedule(linked?.paymentSchedule)}
        />
      ) : null}
      {linked?.id ? (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-soft">
            Next: register this commercial commitment on X Layer. That is not a payment and does not
            mean the supplier has accepted the incentive.
          </p>
          <OnchainCommitmentCard agreementId={linked.id} />
        </div>
      ) : null}
    </div>
  );
}

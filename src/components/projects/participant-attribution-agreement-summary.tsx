'use client';

import type { ParticipantReferralCommerce } from '@/lib/referrals/referral-commerce-config';
import { ParticipantServiceCommissionTable } from '@/components/projects/participant-service-commission-table';
import {
  buildScopedServiceCommissionRows,
  type ScopedServiceCommissionRow,
} from '@/lib/projects/participant-compensation-copy';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveAgreementEligibleServicesCopy,
  deriveCommissionLinkRoutingLabel,
  deriveCommissionScope,
  isCatalogScopedCommission,
} from '@/lib/operations/derivations/commission-scope';

type Props = {
  participant?: DemoParticipant;
  commerce?: ParticipantReferralCommerce | null;
  serviceRows?: ScopedServiceCommissionRow[];
  allServicesNote?: boolean;
  approved?: boolean;
  catalogItems?: Array<{ id: string; name: string }>;
};

/** Participant agreement view — earnings and attributable services (not customer checkout). */
export function ParticipantAttributionAgreementSummary({
  participant,
  commerce,
  serviceRows,
  allServicesNote,
  approved = false,
  catalogItems = [],
}: Props) {
  const subject = participant ?? ({ referralCommerce: commerce } as DemoParticipant);
  const scope = deriveCommissionScope(subject, { catalogItems });
  const catalogEnabled = isCatalogScopedCommission(subject);

  if (!commerce || commerce.createReferralLink === false) {
    if (!catalogEnabled) {
      return (
        <p className="text-sm text-foreground/70">
          This participant does not earn from customer purchases.
        </p>
      );
    }
  }

  const rows =
    serviceRows ??
    (commerce?.commissionMode === 'referral_commerce'
      ? buildScopedServiceCommissionRows({
          services: catalogItems.map((s) => ({
            id: s.id,
            name: s.name,
            price: 0,
            currency: 'AUD',
          })),
          commerce,
          allServicesFallback: false,
        })
      : []);

  const pct = scope.percentage ?? commerce?.commerceCommissionPct ?? 10;
  const showAll =
    allServicesNote ??
    (commerce?.commissionMode === 'referral_commerce' &&
      (!commerce.enabledServiceIds || commerce.enabledServiceIds.length === 0));
  const eligibleCopy = deriveAgreementEligibleServicesCopy(
    subject,
    { catalogItems },
    rows.map((r) => ({ id: r.id, name: r.name }))
  );
  const linkRouting = deriveCommissionLinkRoutingLabel(subject, { catalogItems });

  return (
    <div className="rounded-md border p-3 bg-background space-y-3 text-sm">
      <p className="font-medium">Customer attribution</p>
      {!approved ? (
        <p className="text-muted-foreground leading-relaxed">
          Customer attribution activates after approval. Your trackable customer payment link will be
          issued once you approve participation.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground leading-relaxed">
            Active tracking is enabled on your customer payment link. You earn{' '}
            <span className="font-medium text-foreground">{pct}% commission</span> on qualifying
            catalog purchases only — not on total project or deal value. Customers do not see your
            commission terms.
          </p>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Eligible services & attribution scope
            </p>
            <p className="text-xs font-medium text-foreground/80 mb-2">{eligibleCopy.heading}</p>
            {eligibleCopy.items.length > 0 ? (
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                {eligibleCopy.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{eligibleCopy.emptyMessage}</p>
            )}
            {rows.length > 0 && !showAll ? (
              <div className="mt-3">
                <ParticipantServiceCommissionTable rows={rows} showAllServicesNote={showAll} />
              </div>
            ) : null}
          </div>
          {linkRouting ? (
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-2">
              {linkRouting}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

'use client';

import type { ParticipantReferralCommerce } from '@/lib/referrals/referral-commerce-config';
import { ParticipantServiceCommissionTable } from '@/components/projects/participant-service-commission-table';
import {
  buildScopedServiceCommissionRows,
  formatCompensationPercent,
  type ScopedServiceCommissionRow,
} from '@/lib/projects/participant-compensation-copy';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveAgreementEligibleServicesCopy,
  deriveCommissionLinkRoutingLabel,
  deriveCommissionScope,
  isCatalogScopedCommission,
} from '@/lib/operations/derivations/commission-scope';
import { isAttributionEnabled } from '@/lib/operations/truth/attribution-eligibility';

type Props = {
  participant?: DemoParticipant;
  commerce?: ParticipantReferralCommerce | null;
  serviceRows?: ScopedServiceCommissionRow[];
  allServicesNote?: boolean;
  approved?: boolean;
  catalogItems?: Array<{ id: string; name: string }>;
  workspaceCurrency?: string | null;
};

/** Participant agreement view — earnings and attributable services (not customer checkout). */
export function ParticipantAttributionAgreementSummary({
  participant,
  commerce,
  serviceRows,
  allServicesNote,
  approved = false,
  catalogItems = [],
  workspaceCurrency,
}: Props) {
  const subject = participant ?? ({ referralCommerce: commerce } as DemoParticipant);
  const scope = deriveCommissionScope(subject, { catalogItems, workspaceCurrency });
  const catalogEnabled = isCatalogScopedCommission(subject);
  const attributionEnabled = isAttributionEnabled(subject);

  if (!attributionEnabled || !catalogEnabled) {
    return (
      <p className="text-sm text-foreground/70">
        This participant does not earn from customer purchases.
      </p>
    );
  }

  if (commerce?.createReferralLink === false) {
    return (
      <p className="text-sm text-foreground/70">
        Customer purchase attribution is disabled for this participant.
      </p>
    );
  }

  const rows =
    serviceRows ??
    (commerce?.commissionMode === 'referral_commerce'
      ? buildScopedServiceCommissionRows({
          services: catalogItems.map((s) => ({
            id: s.id,
            name: s.name,
            price: 0,
            currency: workspaceCurrency ?? 'USD',
          })),
          commerce,
          allServicesFallback: false,
        })
      : []);

  const pctLabel = formatCompensationPercent(
    scope.percentage ?? commerce?.commerceCommissionPct ?? null
  );
  const showAll =
    allServicesNote ??
    (scope.isAllActiveCatalog ||
      (commerce?.commissionMode === 'referral_commerce' &&
        (!commerce.enabledServiceIds || commerce.enabledServiceIds.length === 0)));
  const eligibleCopy = deriveAgreementEligibleServicesCopy(
    subject,
    { catalogItems },
    rows.map((r) => ({ id: r.id, name: r.name }))
  );
  const linkRouting = deriveCommissionLinkRoutingLabel(subject, { catalogItems });

  return (
    <div className="rounded-md border p-3 bg-background space-y-3 text-sm">
      <p className="font-medium">Customer attribution</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Participant earns from customer purchases on qualifying catalog items.
      </p>
      {!approved ? (
        <p className="text-muted-foreground leading-relaxed">
          Customer attribution activates after approval. Your trackable customer payment link will be
          issued once you approve participation.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground leading-relaxed">
            Active tracking is enabled on your customer payment link. You earn{' '}
            <span className="font-medium text-foreground">{pctLabel} commission</span> on qualifying
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

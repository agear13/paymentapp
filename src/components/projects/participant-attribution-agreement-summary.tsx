'use client';

import type { ParticipantReferralCommerce } from '@/lib/referrals/referral-commerce-config';
import { ParticipantServiceCommissionTable } from '@/components/projects/participant-service-commission-table';
import {
  buildScopedServiceCommissionRows,
  type ScopedServiceCommissionRow,
} from '@/lib/projects/participant-compensation-copy';

type Props = {
  commerce?: ParticipantReferralCommerce | null;
  serviceRows?: ScopedServiceCommissionRow[];
  allServicesNote?: boolean;
  approved?: boolean;
};

/** Participant agreement view — earnings and attributable services (not customer checkout). */
export function ParticipantAttributionAgreementSummary({
  commerce,
  serviceRows,
  allServicesNote,
  approved = false,
}: Props) {
  if (!commerce || commerce.createReferralLink === false) {
    return (
      <p className="text-sm text-foreground/70">
        This participant does not earn from customer purchases.
      </p>
    );
  }

  const rows =
    serviceRows ??
    (commerce.commissionMode === 'referral_commerce'
      ? buildScopedServiceCommissionRows({
          services: [],
          commerce,
          allServicesFallback: false,
        })
      : []);

  const pct = commerce.commerceCommissionPct ?? 10;
  const showAll =
    allServicesNote ??
    (commerce.commissionMode === 'referral_commerce' &&
      (!commerce.enabledServiceIds || commerce.enabledServiceIds.length === 0));
  const hasLinkedServices = rows.length > 0 && !showAll;

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
            <span className="font-medium text-foreground">{pct}%</span> on qualifying purchases.
            Customers do not see your commission terms.
          </p>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Eligible services & attribution scope
            </p>
            {hasLinkedServices ? (
              <ParticipantServiceCommissionTable rows={rows} showAllServicesNote={showAll} />
            ) : (
              <p className="text-muted-foreground">
                No services/products currently assigned for attribution.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

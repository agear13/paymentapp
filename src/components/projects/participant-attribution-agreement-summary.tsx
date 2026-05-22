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
};

/** Participant agreement view — earnings and attributable services (not customer checkout). */
export function ParticipantAttributionAgreementSummary({
  commerce,
  serviceRows,
  allServicesNote,
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

  return (
    <div className="rounded-md border p-3 bg-background space-y-3 text-sm">
      <p className="font-medium">How you earn on customer purchases</p>
      {commerce.commissionMode === 'referral_commerce' ? (
        <>
          <p className="text-muted-foreground leading-relaxed">
            After you approve, a trackable customer payment link is issued. You earn{' '}
            <span className="font-medium text-foreground">{pct}%</span> on qualifying purchases
            through that link. Customers do not see your commission terms.
          </p>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Services you earn on
            </p>
            <ParticipantServiceCommissionTable rows={rows} showAllServicesNote={showAll} />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground leading-relaxed">
          Customer attribution may be issued after approval. Project-level payout terms above
          apply to your participation. Payout release follows operator settlement schedules.
        </p>
      )}
    </div>
  );
}

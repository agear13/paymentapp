'use client';

import type { ParticipantReferralCommerce } from '@/lib/referrals/referral-commerce-config';

type Props = {
  commerce?: ParticipantReferralCommerce | null;
  serviceNames?: string[];
};

/** Participant agreement view — operational attribution permissions (not customer checkout). */
export function ParticipantAttributionAgreementSummary({ commerce, serviceNames }: Props) {
  if (!commerce || commerce.createReferralLink === false) {
    return (
      <p className="text-sm text-muted-foreground">
        No customer attribution tracking is configured for this participation.
      </p>
    );
  }

  return (
    <div className="rounded-md border p-3 bg-background space-y-2 text-sm">
      <p className="font-medium">Attribution permissions</p>
      {commerce.commissionMode === 'referral_commerce' ? (
        <>
          <p className="text-muted-foreground">
            After you approve participation, a trackable customer payment link will be issued.
            You may earn revenue participation on attributable purchases through that link
            {commerce.commerceCommissionPct != null
              ? ` (${commerce.commerceCommissionPct}% on qualifying purchases).`
              : '.'}
          </p>
          {commerce.enabledServiceIds && commerce.enabledServiceIds.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Scoped services
              </p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {(serviceNames ?? []).map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">All active merchant services may be attributed.</p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">
          Customer attribution tracking may be issued after approval. Project-level revenue
          participation applies per your payout allocation above.
        </p>
      )}
    </div>
  );
}

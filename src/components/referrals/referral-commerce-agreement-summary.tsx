'use client';

import {
  describeReferralCommerce,
  type ParticipantReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';

type Props = {
  commerce?: ParticipantReferralCommerce | null;
  serviceNames?: string[];
};

export function ReferralCommerceAgreementSummary({ commerce, serviceNames }: Props) {
  if (!commerce || commerce.createReferralLink === false) {
    return (
      <p className="text-sm text-muted-foreground">
        No referral link will be issued for this agreement.
      </p>
    );
  }

  return (
    <div className="rounded-md border p-3 bg-background space-y-2 text-sm">
      <p className="font-medium">Referral commerce</p>
      <p className="text-muted-foreground">{describeReferralCommerce(commerce, serviceNames)}</p>
      {commerce.commissionMode === 'referral_commerce' &&
      commerce.enabledServiceIds &&
      commerce.enabledServiceIds.length > 0 ? (
        <ul className="list-disc pl-5 text-muted-foreground">
          {(serviceNames ?? []).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

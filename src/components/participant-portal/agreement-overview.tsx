'use client';

import type { PortalAgreementSection } from '@/lib/participant-portal/participant-portal-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  agreement: PortalAgreementSection;
};

function AgreementList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={`${title}-${i}`} className="text-sm text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgreementOverview({ agreement }: Props) {
  const hasAny =
    agreement.deliverables.length > 0 ||
    agreement.commercialObligations.length > 0 ||
    agreement.paymentEvents.length > 0 ||
    agreement.settlementRules.length > 0 ||
    agreement.conditionalPayments.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Agreement Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">
            Agreement details will appear once the organiser shares commercial terms.
          </p>
        ) : (
          <>
            <AgreementList title="Deliverables" items={agreement.deliverables} />
            <AgreementList title="Commercial obligations" items={agreement.commercialObligations} />
            <AgreementList title="Payment events" items={agreement.paymentEvents} />
            <AgreementList title="Settlement rules" items={agreement.settlementRules} />
            <AgreementList title="Conditional payments" items={agreement.conditionalPayments} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

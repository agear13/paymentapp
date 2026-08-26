'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  invoiceActivationCompensationKindFromSections,
  participantInvoiceActivationCopy,
  participantInvoiceActivationHref,
} from '@/lib/invoices/participant-invoice-activation';
import { persistInvoiceActivationIntent } from '@/lib/journey/journey-invoice-activation.client';

type Props = {
  sourceParticipantId: string;
  convertedOrganizationId?: string | null;
  commercialSections?: Array<{ kind: string }>;
};

export function ParticipantInvoiceActivationCta({
  sourceParticipantId,
  convertedOrganizationId = null,
  commercialSections = [],
}: Props) {
  const kind = invoiceActivationCompensationKindFromSections(commercialSections);
  const copy = participantInvoiceActivationCopy(kind);
  const href = participantInvoiceActivationHref({
    sourceParticipantId,
    convertedOrganizationId,
  });

  return (
    <div
      data-testid="participant-invoice-activation-cta"
      data-compensation-kind={kind}
      className="rounded-lg border bg-background px-4 py-4 sm:px-5 sm:py-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{copy.heading}</h2>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button asChild>
            <Link
              href={href}
              onClick={() => {
                if (!convertedOrganizationId?.trim()) {
                  persistInvoiceActivationIntent(sourceParticipantId);
                }
              }}
            >
              {copy.action}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

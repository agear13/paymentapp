'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  dismissParticipantWorkspaceCta,
  isParticipantWorkspaceCtaDismissed,
} from '@/lib/journey/journey-source-participant.client';
import { participantWorkspaceConversionHref } from '@/lib/participants/source-participant-hint';

type Props = {
  sourceParticipantId: string;
};

export function ParticipantWorkspaceConversionCta({ sourceParticipantId }: Props) {
  const [dismissed, setDismissed] = React.useState(() =>
    isParticipantWorkspaceCtaDismissed(sourceParticipantId)
  );

  if (dismissed) return null;

  return (
    <div
      data-testid="participant-workspace-conversion-cta"
      className="rounded-lg border bg-background px-4 py-4 sm:px-5 sm:py-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-base font-semibold tracking-tight">
            Create your own Provvy workspace
          </h2>
          <p className="text-sm text-muted-foreground">
            Create invoices, connect payment rails and manage your business payments with Provvy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button asChild>
            <Link href={participantWorkspaceConversionHref(sourceParticipantId)}>
              Create Free Workspace
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              dismissParticipantWorkspaceCta(sourceParticipantId);
              setDismissed(true);
            }}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}

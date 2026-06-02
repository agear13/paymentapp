'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createParticipantReleaseBatch } from '@/lib/payouts/create-participant-release-batch';
import type { OperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-client';
import { applyGlobalOperationalSync } from '@/hooks/use-global-operational-sync';

export type ParticipantReleaseButtonProps = {
  participantId: string;
  participantName: string;
  organizationId: string | null | undefined;
  currency: string;
  releaseReady: boolean;
  canRelease: boolean;
  disabledReason?: string | null;
  syncHandlers: OperationalSyncHandlers;
  className?: string;
};

export function ParticipantReleaseButton({
  participantId,
  participantName,
  organizationId,
  currency,
  releaseReady,
  canRelease,
  disabledReason,
  syncHandlers,
  className,
}: ParticipantReleaseButtonProps) {
  const [loading, setLoading] = React.useState(false);

  if (!releaseReady) return null;

  const handleRelease = async () => {
    if (!organizationId) {
      toast.error('Organization context is required to release payouts');
      return;
    }
    if (!canRelease) {
      toast.error(disabledReason ?? 'Release is not available right now');
      return;
    }

    setLoading(true);
    try {
      const result = await createParticipantReleaseBatch({
        organizationId,
        currency,
        participantId,
      });
      void applyGlobalOperationalSync(
        syncHandlers,
        { operationalSync: result.operationalSync },
        {
          mutation: 'release_batch_generated',
          surface: 'participant-release-button',
        }
      );
      const name = result.releasedParticipantName ?? participantName;
      const amountLabel = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: result.currency,
        maximumFractionDigits: 2,
      }).format(result.totalAmount);
      toast.success('Participant released', {
        description: `Batch created · ${amountLabel} released for ${name}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to release participant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className ?? 'h-7 text-xs shrink-0'}
      disabled={loading || !canRelease || !organizationId}
      title={!canRelease ? (disabledReason ?? undefined) : `Release ${participantName}`}
      onClick={() => void handleRelease()}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        'Release'
      )}
    </Button>
  );
}

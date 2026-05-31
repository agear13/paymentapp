'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ParticipantAgreementShareDialog } from '@/components/projects/participant-agreement-share-dialog';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';
import { earningsStructureSummary } from '@/lib/projects/participant-entitlement';

interface PostExtractionPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: DemoParticipant[];
  projectName?: string;
}

export function PostExtractionPrompt({
  open,
  onOpenChange,
  participants,
  projectName,
}: PostExtractionPromptProps) {
  const [shareParticipant, setShareParticipant] = React.useState<DemoParticipant | null>(null);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);

  const configuredCount = participants.filter((p) => {
    const summary = earningsStructureSummary(p);
    return summary !== 'Earnings not configured';
  }).length;

  const handleGenerateAgreement = (participant: DemoParticipant) => {
    const path = participantAgreementPath(participant.inviteToken);
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    setShareParticipant(participant);
    setShareUrl(`${base}${path}`);
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  if (shareParticipant && shareUrl) {
    return (
      <ParticipantAgreementShareDialog
        participant={shareParticipant}
        agreementUrl={shareUrl}
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setShareParticipant(null);
            setShareUrl(null);
            onOpenChange(false);
          }
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extraction complete</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Conversation imported</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>
                {participants.length} participant{participants.length !== 1 ? 's' : ''} created
                {projectName ? ` for ${projectName}` : ''}
              </span>
            </div>
            {configuredCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>
                  {configuredCount} compensation profile{configuredCount !== 1 ? 's' : ''}{' '}
                  auto-configured
                </span>
              </div>
            )}
          </div>

          {participants.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Would you like to generate an agreement now?
              </p>
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {earningsStructureSummary(p)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleGenerateAgreement(p)}
                    >
                      Generate Agreement
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
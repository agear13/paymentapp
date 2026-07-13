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
import { earningsStructureSummary } from '@/lib/projects/participant-entitlement';
import { persistParticipantAgreementShare } from '@/lib/projects/participant-agreement-share';
import { toast } from 'sonner';

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
  const [sharingParticipantId, setSharingParticipantId] = React.useState<string | null>(null);

  const configuredCount = participants.filter((p) => {
    const summary = earningsStructureSummary(p);
    return summary !== 'Earnings not configured';
  }).length;

  const handleSendWorkspaceInvitation = async (participant: DemoParticipant) => {
    setSharingParticipantId(participant.id);
    try {
      const shared = await persistParticipantAgreementShare(participant);
      setShareParticipant(shared);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Workspace invitation failed');
    } finally {
      setSharingParticipantId(null);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  if (shareParticipant) {
    return (
      <ParticipantAgreementShareDialog
        participant={shareParticipant}
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setShareParticipant(null);
            onOpenChange(false);
          }
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex min-h-0 flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Extraction complete</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-smooth px-6 py-1">
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
                Would you like to send a workspace invitation now?
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
                      onClick={() => void handleSendWorkspaceInvitation(p)}
                      disabled={sharingParticipantId != null}
                    >
                      {sharingParticipantId === p.id ? 'Saving…' : 'Send invitation'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button type="button" variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

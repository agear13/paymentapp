'use client';

import * as React from 'react';
import { Copy, Download, Mail } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { AGREEMENT_SHARE_HELPER } from '@/lib/operations/merchant-operational-copy';
import { buildParticipantWorkspaceUrl } from '@/lib/participant-portal/participant-portal-url';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';

type ParticipantAgreementShareDialogProps = {
  participant: DemoParticipant | null;
  /** @deprecated Single workspace link — kept for QR compatibility during transition */
  agreementUrl?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ParticipantAgreementShareDialog({
  participant,
  open,
  onOpenChange,
}: ParticipantAgreementShareDialogProps) {
  const [workspaceUrl, setWorkspaceUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !participant) return;
    if (participant.participantPortalToken?.trim()) {
      setWorkspaceUrl(buildParticipantWorkspaceUrl(participant.participantPortalToken.trim()));
      return;
    }
    let cancelled = false;
    void fetch(`/api/deal-network-pilot/participants/${participant.id}/portal-token`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { workspaceUrl?: string; portalUrl?: string } | null) => {
        if (!cancelled) setWorkspaceUrl(data?.workspaceUrl ?? data?.portalUrl ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, participant]);

  const qrPath = workspaceUrl
    ? `/api/qr?data=${encodeURIComponent(workspaceUrl)}`
    : null;

  const copyLink = async () => {
    if (!workspaceUrl) return;
    try {
      await navigator.clipboard.writeText(workspaceUrl);
      toast.success('Workspace link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const sendEmail = () => {
    if (!participant?.email?.trim() || !workspaceUrl) return;
    const approved = hasApprovedAgreement(participant);
    const subject = encodeURIComponent(
      approved ? 'Your participant workspace' : 'Your participant workspace — review agreement'
    );
    const body = encodeURIComponent(
      approved
        ? `Hi ${participant.name},\n\nOpen your participant workspace to track your commercial relationship, earnings, and settlement:\n${workspaceUrl}`
        : `Hi ${participant.name},\n\nOpen your participant workspace to review and approve your commercial agreement:\n${workspaceUrl}`
    );
    window.location.href = `mailto:${participant.email.trim()}?subject=${subject}&body=${body}`;
  };

  const downloadQr = () => {
    if (!qrPath) return;
    const a = document.createElement('a');
    a.href = qrPath;
    a.download = `workspace-${participant?.name ?? 'participant'}.png`;
    a.click();
  };

  if (!participant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send workspace invitation · {participant.name}</DialogTitle>
          <DialogDescription>
            Share one permanent link. The participant reviews their agreement and tracks their
            commercial relationship in the same workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Participant workspace link</p>
            <div className="flex gap-2">
              <Input readOnly value={workspaceUrl ?? ''} className="text-xs" placeholder="Loading…" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void copyLink()}
                disabled={!workspaceUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Agreement approval and commercial tracking happen in this single workspace — no
              separate agreement link.
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{AGREEMENT_SHARE_HELPER}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyLink()}
              disabled={!workspaceUrl}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy workspace link
            </Button>
            {participant.email?.trim() ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={sendEmail}
                disabled={!workspaceUrl}
              >
                <Mail className="mr-2 h-3.5 w-3.5" />
                Resend invitation
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground self-center">
                No participant email added.
              </span>
            )}
            {qrPath ? (
              <Button type="button" variant="outline" size="sm" onClick={downloadQr}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download QR code
              </Button>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

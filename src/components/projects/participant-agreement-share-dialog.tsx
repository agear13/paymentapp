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
import { buildParticipantPortalUrl } from '@/lib/participant-portal/participant-portal-url';

type ParticipantAgreementShareDialogProps = {
  participant: DemoParticipant | null;
  agreementUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ParticipantAgreementShareDialog({
  participant,
  agreementUrl,
  open,
  onOpenChange,
}: ParticipantAgreementShareDialogProps) {
  const [portalUrl, setPortalUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !participant) return;
    if (participant.participantPortalToken?.trim()) {
      setPortalUrl(buildParticipantPortalUrl(participant.participantPortalToken.trim()));
      return;
    }
    let cancelled = false;
    void fetch(`/api/deal-network-pilot/participants/${participant.id}/portal-token`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { portalUrl?: string } | null) => {
        if (!cancelled && data?.portalUrl) setPortalUrl(data.portalUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, participant]);

  const qrPath = agreementUrl
    ? `/api/qr?data=${encodeURIComponent(agreementUrl)}`
    : null;

  const copyLink = async () => {
    if (!agreementUrl) return;
    try {
      await navigator.clipboard.writeText(agreementUrl);
      toast.success('Agreement link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const sendEmail = () => {
    if (!participant?.email?.trim() || !agreementUrl) return;
    const subject = encodeURIComponent('Your participation agreement');
    const portalLine = portalUrl
      ? `\n\nYour commercial participant portal:\n${portalUrl}`
      : '';
    const body = encodeURIComponent(
      `Hi ${participant.name},\n\nPlease review and approve your participation agreement:\n${agreementUrl}${portalLine}`
    );
    window.location.href = `mailto:${participant.email.trim()}?subject=${subject}&body=${body}`;
  };

  const downloadQr = () => {
    if (!qrPath) return;
    const a = document.createElement('a');
    a.href = qrPath;
    a.download = `agreement-${participant?.name ?? 'participant'}.png`;
    a.click();
  };

  if (!participant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share agreement · {participant.name}</DialogTitle>
          <DialogDescription>
            Send the agreement link so the participant can review and approve participation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Agreement link</p>
            <div className="flex gap-2">
              <Input readOnly value={agreementUrl ?? ''} className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => void copyLink()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {portalUrl ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Participant workspace</p>
              <div className="flex gap-2">
                <Input readOnly value={portalUrl} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    void navigator.clipboard.writeText(portalUrl);
                    toast.success('Workspace link copied');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The participant&apos;s commercial workspace — included in agreement emails automatically.
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground leading-relaxed">{AGREEMENT_SHARE_HELPER}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy link
            </Button>
            {participant.email?.trim() ? (
              <Button type="button" variant="outline" size="sm" onClick={sendEmail}>
                <Mail className="mr-2 h-3.5 w-3.5" />
                Send email
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

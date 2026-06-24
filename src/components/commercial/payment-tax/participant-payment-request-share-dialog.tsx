'use client';

import * as React from 'react';
import { Copy, Download, Mail, MessageCircle, Smartphone } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  derivePaymentRequestPortalStatus,
  type PaymentRequestPortalStatus,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { PAYMENT_REQUEST_SHARE_HELPER } from '@/lib/operations/merchant-operational-copy';

const PORTAL_STATUS_LABELS: Record<PaymentRequestPortalStatus, string> = {
  not_yet_opened: 'Not yet opened',
  opened: 'Opened',
  payment_information_submitted: 'Payment information submitted',
};

function buildInvitationText(
  participantName: string,
  projectName: string,
  portalUrl: string
): string {
  return `Hi ${participantName},\n\nPlease complete your payment and tax information for ${projectName}:\n${portalUrl}\n\nThis secure link is unique to you.`;
}

function buildSmsText(participantName: string, projectName: string, portalUrl: string): string {
  return `Hi ${participantName}, please complete your payment & tax info for ${projectName}: ${portalUrl}`;
}

function buildWhatsAppText(participantName: string, projectName: string, portalUrl: string): string {
  return `Hi ${participantName}! Please complete your payment and tax information for *${projectName}*: ${portalUrl}`;
}

type ParticipantPaymentRequestShareDialogProps = {
  participant: DemoParticipant | null;
  portalUrl: string | null;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendEmail?: () => Promise<void>;
  sendingEmail?: boolean;
};

export function ParticipantPaymentRequestShareDialog({
  participant,
  portalUrl,
  projectName,
  open,
  onOpenChange,
  onSendEmail,
  sendingEmail = false,
}: ParticipantPaymentRequestShareDialogProps) {
  const [showQr, setShowQr] = React.useState(false);

  React.useEffect(() => {
    if (!open) setShowQr(false);
  }, [open]);

  const qrPath = portalUrl ? `/api/qr?data=${encodeURIComponent(portalUrl)}` : null;
  const portalStatus = participant
    ? derivePaymentRequestPortalStatus(participant)
    : 'not_yet_opened';

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const copyLink = () => {
    if (!portalUrl) return;
    void copyText(portalUrl, 'Secure link copied');
  };

  const copySms = () => {
    if (!participant || !portalUrl) return;
    void copyText(
      buildSmsText(participant.name, projectName, portalUrl),
      'SMS message copied'
    );
  };

  const copyWhatsApp = () => {
    if (!participant || !portalUrl) return;
    void copyText(
      buildWhatsAppText(participant.name, projectName, portalUrl),
      'WhatsApp message copied'
    );
  };

  const copyInvitation = () => {
    if (!participant || !portalUrl) return;
    void copyText(
      buildInvitationText(participant.name, projectName, portalUrl),
      'Invitation text copied'
    );
  };

  const downloadQr = () => {
    if (!qrPath) return;
    const a = document.createElement('a');
    a.href = qrPath;
    a.download = `payment-request-${participant?.name ?? 'participant'}.png`;
    a.click();
  };

  if (!participant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Request Ready</DialogTitle>
          <DialogDescription>
            Share the secure payment & tax information portal with {participant.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Badge variant="outline" className="text-xs">
              {PORTAL_STATUS_LABELS[portalStatus]}
            </Badge>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Secure link</span>
            <div className="flex gap-2">
              <Input readOnly value={portalUrl ?? ''} className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {PAYMENT_REQUEST_SHARE_HELPER}
          </p>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Delivery</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy link
              </Button>
              {participant.email?.trim() && onSendEmail ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingEmail}
                  onClick={() => void onSendEmail()}
                >
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  {sendingEmail ? 'Sending…' : 'Send email'}
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={copySms}>
                <Smartphone className="mr-2 h-3.5 w-3.5" />
                Copy SMS
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyWhatsApp}>
                <MessageCircle className="mr-2 h-3.5 w-3.5" />
                Copy WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowQr((v) => !v)}
              >
                {showQr ? 'Hide QR code' : 'Show QR code'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyInvitation}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy invitation
              </Button>
            </div>
          </div>

          {showQr && qrPath ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border p-4 bg-muted/30">
              <img
                src={qrPath}
                alt="Payment request QR code"
                className="h-40 w-40 rounded-md"
              />
              <Button type="button" variant="ghost" size="sm" onClick={downloadQr}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download QR code
              </Button>
            </div>
          ) : null}
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

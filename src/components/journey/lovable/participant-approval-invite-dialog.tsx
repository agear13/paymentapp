'use client';

import * as React from 'react';
import { Copy, Loader2, Mail } from 'lucide-react';
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
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string | null;
  participantName: string;
  participantEmail: string | null;
  busy: boolean;
  onAction: (
    action: ParticipantCoordinationAction,
    extra?: { sendInvitationEmail?: boolean }
  ) => Promise<{ ok: boolean; invitationEmailSent?: boolean } | boolean>;
};

async function resolveWorkspaceUrl(participantId: string): Promise<string | null> {
  const res = await csrfAwareFetch(
    `/api/deal-network-pilot/participants/${encodeURIComponent(participantId)}/portal-token`,
    { method: 'GET', credentials: 'include' }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { workspaceUrl?: string };
  return data.workspaceUrl ?? null;
}

export function ParticipantApprovalInviteDialog({
  open,
  onOpenChange,
  participantId,
  participantName,
  participantEmail,
  busy,
  onAction,
}: Props) {
  const [sending, setSending] = React.useState(false);
  const [copying, setCopying] = React.useState(false);

  const sendEmail = async () => {
    if (!participantId || !participantEmail) {
      toast.error('Add an email address before sending the invitation.');
      return;
    }
    setSending(true);
    try {
      const result = await onAction('request_approval', { sendInvitationEmail: true });
      const ok = typeof result === 'boolean' ? result : result.ok;
      const invitationEmailSent = typeof result === 'boolean' ? undefined : result.invitationEmailSent;
      if (!ok) {
        toast.error('Could not send the approval request.');
        return;
      }
      if (invitationEmailSent === false) {
        toast.error('Invitation is ready, but the email could not be sent. Copy the secure link instead.');
        return;
      }
      toast.success(`Approval request sent to ${participantEmail}`);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    if (!participantId) return;
    setCopying(true);
    try {
      const result = await onAction('request_approval');
      const ok = typeof result === 'boolean' ? result : result.ok;
      if (!ok) {
        toast.error('Could not prepare the approval link.');
        return;
      }
      const url = await resolveWorkspaceUrl(participantId);
      if (!url) {
        toast.error('Could not copy the approval link.');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Secure approval link copied');
      onOpenChange(false);
    } catch {
      toast.error('Could not copy the approval link.');
    } finally {
      setCopying(false);
    }
  };

  const working = busy || sending || copying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send agreement to {participantName}</DialogTitle>
          <DialogDescription>
            {participantName} needs to review and approve their participation agreement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Send by email</p>
            <p className="text-[13px] text-ink-soft">
              Send a secure approval invitation to:{' '}
              <span className="font-medium text-foreground">
                {participantEmail?.trim() || 'No email on file'}
              </span>
            </p>
            <Button
              type="button"
              disabled={working || !participantEmail?.trim()}
              onClick={() => void sendEmail()}
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send approval request
            </Button>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-[13px] font-medium">Or copy a secure link</p>
            <p className="text-[13px] text-ink-soft">
              Use this link in SMS, WhatsApp, Telegram or another channel. It is the same invitation as
              the email.
            </p>
            <Button type="button" variant="outline" disabled={working} onClick={() => void copyLink()}>
              {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              Copy secure approval link
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

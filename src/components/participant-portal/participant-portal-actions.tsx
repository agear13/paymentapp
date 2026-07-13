'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  buildParticipantWorkspaceUrl,
  participantWorkspacePath,
} from '@/lib/participant-portal/participant-portal-url';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';

async function fetchWorkspaceUrl(participantId: string): Promise<string> {
  const res = await fetch(`/api/deal-network-pilot/participants/${participantId}/portal-token`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Could not load workspace link');
  }
  const data = (await res.json()) as { portalUrl?: string; workspaceUrl?: string };
  return data.workspaceUrl ?? data.portalUrl ?? '';
}

async function regenerateWorkspaceUrl(participantId: string): Promise<string> {
  const res = await fetch(`/api/deal-network-pilot/participants/${participantId}/portal-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regenerate: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Could not regenerate workspace link');
  }
  const data = (await res.json()) as { portalUrl?: string; workspaceUrl?: string };
  return data.workspaceUrl ?? data.portalUrl ?? '';
}

type Props = {
  participant: DemoParticipant;
  variant?: 'menu-items' | 'buttons';
  onWorkspaceUrlResolved?: (url: string) => void;
};

export function ParticipantWorkspaceActions({
  participant,
  variant = 'menu-items',
  onWorkspaceUrlResolved,
}: Props) {
  const [busy, setBusy] = React.useState<'copy' | 'open' | 'regenerate' | 'resend' | null>(null);

  const resolveUrl = React.useCallback(async (): Promise<string> => {
    if (participant.participantPortalToken?.trim()) {
      return buildParticipantWorkspaceUrl(participant.participantPortalToken.trim());
    }
    const url = await fetchWorkspaceUrl(participant.id);
    onWorkspaceUrlResolved?.(url);
    return url;
  }, [participant.id, participant.participantPortalToken, onWorkspaceUrlResolved]);

  const handleCopy = async () => {
    setBusy('copy');
    try {
      const url = await resolveUrl();
      await navigator.clipboard.writeText(url);
      toast.success('Workspace link copied');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Copy failed');
    } finally {
      setBusy(null);
    }
  };

  const handleOpen = async () => {
    setBusy('open');
    try {
      const url = await resolveUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not open workspace');
    } finally {
      setBusy(null);
    }
  };

  const handleRegenerate = async () => {
    setBusy('regenerate');
    try {
      const url = await regenerateWorkspaceUrl(participant.id);
      onWorkspaceUrlResolved?.(url);
      await navigator.clipboard.writeText(url);
      toast.success('Workspace link regenerated and copied');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setBusy(null);
    }
  };

  const handleResend = async () => {
    if (!participant.email?.trim()) {
      toast.error('Add a participant email before resending');
      return;
    }
    setBusy('resend');
    try {
      const url = await resolveUrl();
      const approved = hasApprovedAgreement(participant);
      const subject = encodeURIComponent(
        approved ? 'Your participant workspace' : 'Review your commercial agreement'
      );
      const intro = approved
        ? `Hi ${participant.name},\n\nOpen your participant workspace to track earnings, settlement, and commercial activity:\n${url}`
        : `Hi ${participant.name},\n\nOpen your participant workspace to review and approve your commercial agreement:\n${url}`;
      const body = encodeURIComponent(intro);
      window.location.href = `mailto:${participant.email.trim()}?subject=${subject}&body=${body}`;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not prepare invitation');
    } finally {
      setBusy(null);
    }
  };

  const localPath = participant.participantPortalToken?.trim()
    ? participantWorkspacePath(participant.participantPortalToken.trim())
    : null;

  if (variant === 'buttons') {
    return (
      <div className="flex flex-wrap gap-2">
        {localPath ? (
          <Link
            href={localPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Workspace
          </Link>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            onClick={() => void handleOpen()}
            disabled={busy != null}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {busy === 'open' ? 'Loading…' : 'Open Workspace'}
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => void handleCopy()}
          disabled={busy != null}
        >
          <Copy className="h-3.5 w-3.5" />
          {busy === 'copy' ? 'Copying…' : 'Copy Workspace Link'}
        </button>
        {participant.email?.trim() ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={() => void handleResend()}
            disabled={busy != null}
          >
            <Mail className="h-3.5 w-3.5" />
            {busy === 'resend' ? 'Preparing…' : 'Resend Invitation'}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void handleOpen()} disabled={busy != null}>
        <ExternalLink className="mr-2 h-3.5 w-3.5" />
        {busy === 'open' ? 'Opening…' : 'Open Participant Workspace'}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void handleCopy()} disabled={busy != null}>
        <Copy className="mr-2 h-3.5 w-3.5" />
        {busy === 'copy' ? 'Copying…' : 'Copy Workspace Link'}
      </DropdownMenuItem>
      {participant.email?.trim() ? (
        <DropdownMenuItem onClick={() => void handleResend()} disabled={busy != null}>
          <Mail className="mr-2 h-3.5 w-3.5" />
          {busy === 'resend' ? 'Preparing…' : 'Resend Workspace Invitation'}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onClick={() => void handleRegenerate()} disabled={busy != null}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate Workspace Link'}
      </DropdownMenuItem>
    </>
  );
}

/** @deprecated Use ParticipantWorkspaceActions */
export const ParticipantPortalActions = ParticipantWorkspaceActions;

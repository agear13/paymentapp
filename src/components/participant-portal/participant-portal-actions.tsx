'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  buildParticipantPortalUrl,
  participantPortalPath,
} from '@/lib/participant-portal/participant-portal-url';

async function fetchPortalUrl(participantId: string): Promise<string> {
  const res = await fetch(`/api/deal-network-pilot/participants/${participantId}/portal-token`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Could not load portal link');
  }
  const data = (await res.json()) as { portalUrl: string };
  return data.portalUrl;
}

async function regeneratePortalUrl(participantId: string): Promise<string> {
  const res = await fetch(`/api/deal-network-pilot/participants/${participantId}/portal-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regenerate: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Could not regenerate portal link');
  }
  const data = (await res.json()) as { portalUrl: string };
  return data.portalUrl;
}

type Props = {
  participant: DemoParticipant;
  variant?: 'menu-items' | 'buttons';
  onPortalUrlResolved?: (url: string) => void;
};

export function ParticipantPortalActions({
  participant,
  variant = 'menu-items',
  onPortalUrlResolved,
}: Props) {
  const [busy, setBusy] = React.useState<'copy' | 'open' | 'regenerate' | null>(null);

  const resolveUrl = React.useCallback(async (): Promise<string> => {
    if (participant.participantPortalToken?.trim()) {
      return buildParticipantPortalUrl(participant.participantPortalToken.trim());
    }
    const url = await fetchPortalUrl(participant.id);
    onPortalUrlResolved?.(url);
    return url;
  }, [participant.id, participant.participantPortalToken, onPortalUrlResolved]);

  const handleCopy = async () => {
    setBusy('copy');
    try {
      const url = await resolveUrl();
      await navigator.clipboard.writeText(url);
      toast.success('Portal link copied');
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
      toast.error(e instanceof Error ? e.message : 'Could not open portal');
    } finally {
      setBusy(null);
    }
  };

  const handleRegenerate = async () => {
    setBusy('regenerate');
    try {
      const url = await regeneratePortalUrl(participant.id);
      onPortalUrlResolved?.(url);
      await navigator.clipboard.writeText(url);
      toast.success('Portal link regenerated and copied');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setBusy(null);
    }
  };

  const localPath =
    participant.participantPortalToken?.trim()
      ? participantPortalPath(participant.participantPortalToken.trim())
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
            Open Portal
          </Link>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            onClick={() => void handleOpen()}
            disabled={busy != null}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {busy === 'open' ? 'Loading…' : 'Open Portal'}
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => void handleCopy()}
          disabled={busy != null}
        >
          <Copy className="h-3.5 w-3.5" />
          {busy === 'copy' ? 'Copying…' : 'Copy Link'}
        </button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => void handleOpen()}
        disabled={busy != null}
      >
        <ExternalLink className="mr-2 h-3.5 w-3.5" />
        {busy === 'open' ? 'Opening…' : 'Open Participant Portal'}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => void handleCopy()}
        disabled={busy != null}
      >
        <Copy className="mr-2 h-3.5 w-3.5" />
        {busy === 'copy' ? 'Copying…' : 'Copy Portal Link'}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => void handleRegenerate()}
        disabled={busy != null}
      >
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate Link'}
      </DropdownMenuItem>
    </>
  );
}

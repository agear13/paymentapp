'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  COMMISSION_STRUCTURE_OPTIONS,
  resolveParticipantCommissionUsd,
} from '@/lib/deal-network-demo/commission-structure';

export default function DealInviteApprovalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? '');

  const [deal, setDeal] = React.useState<RecentDeal | null>(null);
  const [participant, setParticipant] = React.useState<DemoParticipant | null>(null);
  const [note, setNote] = React.useState('');
  const [approved, setApproved] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError('Missing invite token');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetch(`/api/deal-network-pilot/invites/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Invite not found');
        }
        return res.json() as Promise<{ deal: RecentDeal; participant: DemoParticipant }>;
      })
      .then((data) => {
        if (cancelled) return;
        setDeal(data.deal);
        setParticipant(data.participant);
        setApproved(data.participant.approvalStatus === 'Approved');
        setNote(data.participant.approvalNote ?? '');
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message || 'Failed to load invite');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function approve() {
    if (!token) return;
    try {
      const res = await fetch(`/api/deal-network-pilot/invites/${encodeURIComponent(token)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Approval failed');
      }
      const data = (await res.json()) as { deal: RecentDeal; participant: DemoParticipant };
      setParticipant(data.participant);
      setDeal(data.deal);
      setApproved(true);
      toast.success('Agreement approved');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Approval failed';
      toast.error(msg);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading invite…</p>
      </div>
    );
  }

  if (loadError || !participant) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Invite link not found</CardTitle>
            <CardDescription>
              {loadError ||
                'This invite token is invalid or no longer exists.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const commissionStructureLabel =
    COMMISSION_STRUCTURE_OPTIONS.find((o) => o.value === participant.commissionKind)?.label ??
    participant.commissionKind;

  const rolePayout =
    deal == null
      ? null
      : resolveParticipantCommissionUsd(
          {
            commissionKind: participant.commissionKind,
            commissionValue: participant.commissionValue,
            baseParticipant: participant.baseParticipant,
            formulaExpression: participant.formulaExpression,
          },
          deal.value,
          {
            Introducer: deal.introducerAmount,
            Closer: deal.closerAmount,
            Platform: deal.platformFee,
          }
        );

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Role &amp; commission agreement</CardTitle>
          <CardDescription>
            Review the role, payout terms, and commission for this Rabbit Hole pilot invite. Approving
            confirms you acknowledge this lightweight agreement record (demo only, not a legal contract).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Deal</p>
              <p className="font-medium">{deal?.dealName ?? participant.dealName ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Partner</p>
              <p className="font-medium">{deal?.partner ?? participant.partner ?? '-'}</p>
            </div>
            {participant.email?.trim() ? (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                <p className="font-medium">{participant.email.trim()}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Assigned role</p>
              <p className="font-medium">{participant.role}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant={approved ? 'success' : 'warning'}>
                {approved ? 'Approved' : 'Pending approval'}
              </Badge>
            </div>
          </div>

          {(participant.roleDetails?.trim() ||
            participant.payoutCondition?.trim() ||
            participant.agreementNotes?.trim() ||
            participant.attachmentUrl?.trim()) && (
            <div className="rounded-md border p-3 bg-background space-y-3">
              <p className="text-sm font-medium">Agreement context</p>
              {participant.roleDetails?.trim() ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Role details / scope</p>
                  <p className="text-sm whitespace-pre-wrap">{participant.roleDetails.trim()}</p>
                </div>
              ) : null}
              {participant.payoutCondition?.trim() ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Payout condition</p>
                  <p className="text-sm whitespace-pre-wrap">{participant.payoutCondition.trim()}</p>
                </div>
              ) : null}
              {participant.agreementNotes?.trim() ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes from inviter</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {participant.agreementNotes.trim()}
                  </p>
                </div>
              ) : null}
              {participant.attachmentUrl?.trim() ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reference</p>
                  <a
                    href={participant.attachmentUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    {participant.attachmentLabel?.trim() || participant.attachmentUrl.trim()}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </a>
                </div>
              ) : null}
            </div>
          )}

          <div className="rounded-md border p-3 bg-background">
            <p className="text-sm font-medium">Commission structure &amp; payout preview</p>
            <p className="text-xs text-muted-foreground mt-0.5">{commissionStructureLabel}</p>
            {rolePayout == null || rolePayout.total <= 0 ? (
              <p className="text-sm text-muted-foreground mt-2">
                No commission structure defined for this deal yet.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-2">{rolePayout.previewLine}</p>
                <p className="font-semibold mt-1">Calculated payout: ${rolePayout.total.toLocaleString()}</p>
              </>
            )}
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!approved) void approve();
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invite-approval-note">
                Your optional confirmation note
              </label>
              <Textarea
                id="invite-approval-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an optional confirmation note"
                disabled={approved}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={approved}>
                {approved ? 'Agreement approved' : 'Approve role and commission'}
              </Button>
              {approved && participant.approvedAt ? (
                <span className="text-xs text-muted-foreground">
                  Approved at{' '}
                  {new Date(participant.approvedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

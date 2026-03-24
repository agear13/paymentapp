'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { loadPilotStore, savePilotStore } from '@/lib/deal-network-demo/pilot-store';
import { resolveParticipantCommissionUsd } from '@/lib/deal-network-demo/commission-structure';

export default function DealInviteApprovalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? '');

  const [deal, setDeal] = React.useState<RecentDeal | null>(null);
  const [participant, setParticipant] = React.useState<DemoParticipant | null>(null);
  const [note, setNote] = React.useState('');
  const [approved, setApproved] = React.useState(false);

  React.useEffect(() => {
    const store = loadPilotStore();
    if (!store || !token) return;
    const p = store.participants.find((row) => row.inviteToken === token);
    if (!p) return;
    const d =
      (p.dealId ? store.deals.find((row) => row.id === p.dealId) : undefined) ??
      (p.dealName ? store.deals.find((row) => row.dealName === p.dealName) : undefined) ??
      null;
    const nextParticipants = store.participants.map((row) =>
      row.inviteToken === token ? { ...row, inviteStatus: 'Opened' as const } : row
    );
    savePilotStore({ deals: store.deals, participants: nextParticipants });
    setDeal(d);
    setParticipant({ ...p, inviteStatus: 'Opened' });
    setApproved(p.approvalStatus === 'Approved');
    setNote(p.approvalNote ?? '');
  }, [token]);

  function approve() {
    const store = loadPilotStore();
    if (!store || !token) return;
    const now = new Date().toISOString();
    const nextParticipants = store.participants.map((row) =>
      row.inviteToken === token
        ? {
            ...row,
            status: 'Confirmed' as const,
            inviteStatus: 'Opened' as const,
            approvalStatus: 'Approved' as const,
            approvedAt: now,
            approvalNote: note.trim() || undefined,
          }
        : row
    );
    savePilotStore({ deals: store.deals, participants: nextParticipants });
    const p = nextParticipants.find((row) => row.inviteToken === token) ?? null;
    setParticipant(p);
    setApproved(true);
  }

  if (!participant) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Invite link not found</CardTitle>
            <CardDescription>This invite token is invalid or has expired in the demo store.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
          <CardTitle>Commission Approval</CardTitle>
          <CardDescription>
            Review your assigned commission for this Rabbit Hole pilot deal and approve once confirmed.
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
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Role</p>
              <p className="font-medium">{participant.role}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant={approved ? 'success' : 'warning'}>
                {approved ? 'Approved' : 'Pending approval'}
              </Badge>
            </div>
          </div>

          <div className="rounded-md border p-3 bg-background">
            <p className="text-sm font-medium">Role allocation ({participant.role})</p>
            {rolePayout == null || rolePayout.total <= 0 ? (
              <p className="text-sm text-muted-foreground">No commission structure defined for this deal yet.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{rolePayout.previewLine}</p>
                <p className="font-semibold mt-1">Calculated payout: ${rolePayout.total.toLocaleString()}</p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Optional note</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an optional confirmation note"
              disabled={approved}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={approve} disabled={approved}>
              {approved ? 'Commission Approved' : 'Approve Commission'}
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
        </CardContent>
      </Card>
    </div>
  );
}


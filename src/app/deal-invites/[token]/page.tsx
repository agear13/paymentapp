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
import { loadPilotStore, savePilotStore } from '@/lib/deal-network-demo/pilot-store';
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
    toast.success('Agreement approved');
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
              if (!approved) approve();
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


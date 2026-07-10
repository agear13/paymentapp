'use client';

import * as React from 'react';
import Link from 'next/link';
import { Briefcase, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { AddCommercialRoleDialog } from '@/components/projects/add-commercial-role-dialog';
import { AssignCommercialRoleDialog } from '@/components/projects/assign-commercial-role-dialog';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import { useOrganization } from '@/hooks/use-organization';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import {
  commercialRoleStatusLabel,
  formatCommercialRoleBudget,
} from '@/lib/projects/commercial-roles/format-commercial-role';
import {
  commercialRolesFromDeal,
  participantNameForCommercialRole,
  removeCommercialRoleFromDeals,
} from '@/lib/projects/commercial-roles/commercial-roles-payload';
import type { CommercialRole } from '@/lib/projects/commercial-roles/types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { projectParticipantsPath } from '@/lib/projects/project-routes';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export function ProjectCommercialRolesView() {
  const {
    projectId,
    summary,
    deal,
    projectParticipants,
    allDeals,
    patchParticipants,
    refresh,
    loading,
    notFound,
  } = useProjectWorkspace();
  const { organizationId } = useOrganization();
  const [addOpen, setAddOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [assignTarget, setAssignTarget] = React.useState<CommercialRole | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const currency = resolveOperationalWorkspaceCurrency({
    projectCurrency: deal?.projectValueCurrency,
  });

  const roles = React.useMemo(() => commercialRolesFromDeal(deal), [deal]);

  const persistDeals = React.useCallback(
    async (nextDeals: typeof allDeals) => {
      setSaving(true);
      try {
        const nextDeal = nextDeals.find((d) => d.id === projectId);
        if (!nextDeal) throw new Error('Project not found');
        const res = await fetch(
          `/api/deal-network-pilot/deals/${encodeURIComponent(projectId)}/commercial-roles`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commercialRoles: nextDeal.commercialRoles ?? [] }),
          }
        );
        if (!res.ok) throw new Error('Save failed');
        await refresh({ scope: 'summary', silent: true, force: true });
        return true;
      } finally {
        setSaving(false);
      }
    },
    [projectId, refresh]
  );

  const handleInviteSubmit = async (participant: DemoParticipant) => {
    patchParticipants((list) => [...list, participant]);
    const res = await fetch('/api/deal-network-pilot/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant }),
    });
    if (!res.ok) {
      patchParticipants((list) => list.filter((p) => p.id !== participant.id));
      throw new Error('Failed to save participant');
    }
    const json = (await res.json()) as { participant?: DemoParticipant };
    if (json.participant) {
      patchParticipants((list) =>
        list.map((p) => (p.id === participant.id ? json.participant! : p))
      );
    }
    await refresh({ scope: 'participants', silent: false, force: true });
    return json.participant ?? participant;
  };

  const handleDelete = async (roleId: string) => {
    setDeletingId(roleId);
    try {
      const nextDeals = removeCommercialRoleFromDeals(allDeals, projectId, roleId);
      const ok = await persistDeals(nextDeals);
      if (!ok) throw new Error('Delete failed');
      toast.success(PRODUCT_TERMINOLOGY.budgetedRoleRemoved);
    } catch {
      toast.error(PRODUCT_TERMINOLOGY.couldNotRemoveBudgetedRole);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !summary) {
    return <p className="text-muted-foreground p-6">Loading…</p>;
  }

  if (notFound || !summary || !deal) {
    return <p className="text-muted-foreground p-6">{PRODUCT_TERMINOLOGY.projectNotFound}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{PRODUCT_TERMINOLOGY.budgetedRoles}</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            {PRODUCT_TERMINOLOGY.budgetedRolesHelper}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refresh({ scope: 'all', silent: false, force: true })}
            disabled={saving}
          >
            <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite participant
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Briefcase className="mr-2 h-4 w-4" />
            {PRODUCT_TERMINOLOGY.addBudgetedRole}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{PRODUCT_TERMINOLOGY.budgetedRoles}</CardTitle>
          <CardDescription>
            {PRODUCT_TERMINOLOGY.budgetedRolesAssignHelper}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="py-10 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {PRODUCT_TERMINOLOGY.noBudgetedRolesYet} Add planned roles such as DJ, promoter, or supplier before
                inviting people.
              </p>
              <Button onClick={() => setAddOpen(true)}>
                <Briefcase className="mr-2 h-4 w-4" />
                {PRODUCT_TERMINOLOGY.addBudgetedRole}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        {r.description ? (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {r.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatCommercialRoleBudget(r, currency)}</TableCell>
                      <TableCell>
                        {participantNameForCommercialRole(r, projectParticipants) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{commercialRoleStatusLabel(r.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setAssignTarget(r)}>
                            <Users className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={deletingId === r.id || saving}
                            onClick={() => void handleDelete(r.id)}
                            aria-label={`Remove ${r.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Next:{' '}
        <Link
          href={projectParticipantsPath(projectId)}
          className="text-primary underline-offset-2 hover:underline"
        >
          Participants
        </Link>{' '}
        for participant agreements and earnings, then obligations, funding, and payouts as today.
      </p>

      <AddCommercialRoleDialog
        projectId={projectId}
        allDeals={allDeals}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={persistDeals}
        onCreated={() => toast.success(PRODUCT_TERMINOLOGY.budgetedRoleAdded)}
      />

      <AssignCommercialRoleDialog
        projectId={projectId}
        role={assignTarget}
        allDeals={allDeals}
        participants={projectParticipants}
        open={assignTarget != null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
        onSave={persistDeals}
        onAssigned={() => toast.success('Participant linked')}
      />

      <InviteProjectParticipantModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        project={deal}
        organizationId={organizationId}
        onSubmit={handleInviteSubmit}
        onAgreementShared={(participant) => {
          patchParticipants((list) =>
            list.map((p) => (p.id === participant.id ? participant : p))
          );
        }}
      />
    </div>
  );
}

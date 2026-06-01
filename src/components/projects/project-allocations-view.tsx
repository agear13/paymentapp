'use client';

import * as React from 'react';
import Link from 'next/link';
import { ClipboardList, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
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
import { AddAllocationDialog } from '@/components/projects/add-allocation-dialog';
import { AssignAllocationDialog } from '@/components/projects/assign-allocation-dialog';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import { useOrganization } from '@/hooks/use-organization';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import {
  allocationStatusLabel,
  formatAllocationBudget,
} from '@/lib/projects/allocations/format-allocation';
import type { ProjectAllocationDto } from '@/lib/projects/allocations/types';
import { projectParticipantsPath } from '@/lib/projects/project-routes';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export function ProjectAllocationsView() {
  const {
    projectId,
    summary,
    deal,
    projectParticipants,
    allDeals,
    allParticipants,
    saveSnapshot,
    refresh,
    loading,
    notFound,
  } = useProjectWorkspace();
  const { organizationId } = useOrganization();
  const [allocations, setAllocations] = React.useState<ProjectAllocationDto[]>([]);
  const [listLoading, setListLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [assignTarget, setAssignTarget] = React.useState<ProjectAllocationDto | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const currency = resolveOperationalWorkspaceCurrency({
    projectCurrency: deal?.projectValueCurrency,
  });

  const loadAllocations = React.useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/allocations`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load');
      const json = (await res.json()) as { data: ProjectAllocationDto[] };
      setAllocations(Array.isArray(json.data) ? json.data : []);
    } catch {
      setAllocations([]);
      toast.error('Could not load allocations');
    } finally {
      setListLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadAllocations();
  }, [loadAllocations]);

  const handleInviteSubmit = async (participant: DemoParticipant) => {
    const next = [...allParticipants, participant];
    const ok = await saveSnapshot(allDeals, next);
    if (!ok) throw new Error('Failed to save participant');
    await refresh({ scope: 'participants', silent: false, force: true });
    return participant;
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/allocations/${encodeURIComponent(id)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Allocation removed');
      await loadAllocations();
    } catch {
      toast.error('Could not remove allocation');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !summary) {
    return <p className="text-muted-foreground p-6">Loading…</p>;
  }

  if (notFound || !summary || !deal) {
    return <p className="text-muted-foreground p-6">Project not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocations</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Plan roles and budgets before participants join. Allocations are not agreements,
            obligations, or payables — they guide how you structure the project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={() => void loadAllocations()} disabled={listLoading}>
            <RefreshCw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite participant
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Add allocation
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Planned allocations</CardTitle>
          <CardDescription>
            Assign participants when ready. Existing agreement, obligation, funding, and payout
            workflows are unchanged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading allocations…</p>
          ) : allocations.length === 0 ? (
            <div className="py-10 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                No allocations yet. Add planned roles such as DJ, promoter, or supplier before
                inviting people.
              </p>
              <Button onClick={() => setAddOpen(true)}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Add allocation
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planned role</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground">{a.role}</div>
                      </TableCell>
                      <TableCell>{formatAllocationBudget(a)}</TableCell>
                      <TableCell>
                        {a.participantName ? (
                          <span>{a.participantName}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{allocationStatusLabel(a.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAssignTarget(a)}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={deletingId === a.id}
                            onClick={() => void handleDelete(a.id)}
                            aria-label={`Remove ${a.title}`}
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
        <Link href={projectParticipantsPath(projectId)} className="text-primary underline-offset-2 hover:underline">
          Participants
        </Link>{' '}
        for agreements and earnings, then obligations, funding, and payouts as today.
      </p>

      <AddAllocationDialog
        projectId={projectId}
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultCurrency={currency}
        onCreated={() => void loadAllocations()}
      />

      <AssignAllocationDialog
        projectId={projectId}
        allocation={assignTarget}
        participants={projectParticipants}
        open={assignTarget != null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
        onAssigned={() => void loadAllocations()}
      />

      <InviteProjectParticipantModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        project={deal}
        organizationId={organizationId}
        onSubmit={handleInviteSubmit}
      />
    </div>
  );
}

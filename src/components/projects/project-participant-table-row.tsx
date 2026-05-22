'use client';

import * as React from 'react';
import { Copy, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import {
  attributionStatusLabel,
  deriveAttributionStatus,
  earningsStructureSummary,
} from '@/lib/projects/participant-entitlement';
import {
  deriveInviteState,
  deriveParticipationLabel,
  derivePayoutOnboardingState,
  inviteStateLabel,
  onboardingSelectValue,
  participationLabelText,
  payoutOnboardingLabel,
} from '@/lib/projects/participant-lifecycle';
import type { PilotParticipantOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';

export type ProjectParticipantTableRowProps = {
  participant: DemoParticipant;
  onCopyAgreement: (p: DemoParticipant) => void;
  onUpdateOnboarding: (id: string, value: PilotParticipantOnboardingStatus | 'BLOCKED') => void;
  onEdit: (p: DemoParticipant) => void;
};

function ProjectParticipantTableRowComponent({
  participant: p,
  onCopyAgreement,
  onUpdateOnboarding,
}: ProjectParticipantTableRowProps) {
  const invite = deriveInviteState(p);
  const participation = deriveParticipationLabel(p);
  const attribution = deriveAttributionStatus(p);
  const payoutOb = derivePayoutOnboardingState(p);
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-muted-foreground">{p.email?.trim() || 'No email'}</div>
      </TableCell>
      <TableCell>{operationalRoleLabel(p)}</TableCell>
      <TableCell>
        <Badge
          variant={
            invite === 'approved' ? 'default' : invite === 'opened' ? 'secondary' : 'outline'
          }
        >
          {inviteStateLabel(invite)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={participation === 'approved' ? 'default' : 'outline'}>
          {participationLabelText(participation)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={attribution === 'active' ? 'default' : 'secondary'}>
          {attributionStatusLabel(attribution)}
        </Badge>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Select
          value={onboardingSelectValue(p)}
          onValueChange={(v) =>
            onUpdateOnboarding(p.id, v as PilotParticipantOnboardingStatus | 'BLOCKED')
          }
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NOT_STARTED">Not started</SelectItem>
            <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
            <SelectItem value="COMPLETE">Ready</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground mt-1 text-[10px]">{payoutOnboardingLabel(payoutOb)}</p>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {earningsStructureSummary(p)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onCopyAgreement(p)}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Agreement
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const ProjectParticipantTableRow = React.memo(ProjectParticipantTableRowComponent);

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { projectPlanningPath } from '@/lib/projects/project-routes';

type TimelineEmptyDayMenuProps = {
  dateKey: string;
  projectId?: string | null;
};

export function TimelineEmptyDayMenu({ dateKey, projectId }: TimelineEmptyDayMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Add event on ${dateKey}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/dashboard/payment-links">Add payment link</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/payment-links">Create invoice</Link>
        </DropdownMenuItem>
        {projectId && (
          <DropdownMenuItem asChild>
            <Link href={projectPlanningPath(projectId)}>Expected revenue</Link>
          </DropdownMenuItem>
        )}
        {projectId && (
          <DropdownMenuItem asChild>
            <Link href={projectPlanningPath(projectId)}>Add budgeted role</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/projects">Create project</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/payouts/settlements">Schedule settlement</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import * as React from 'react';
import { ChevronsUpDown, Plus, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Mock data - will be replaced with real data from API
const organizations = [
  {
    id: '1',
    name: 'Acme Corp',
    role: 'Owner',
  },
  {
    id: '2',
    name: 'Tech Startup Inc',
    role: 'Admin',
  },
  {
    id: '3',
    name: 'Coffee Shop Co',
    role: 'Member',
  },
];

export function OrganizationSwitcher() {
  const [selectedOrg, setSelectedOrg] = React.useState(organizations[0]);
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[240px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs">
                {selectedOrg.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedOrg.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" align="end">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => {
              setSelectedOrg(org);
              setOpen(false);
            }}
            className="gap-2"
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs">
                {org.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col">
              <span className="truncate">{org.name}</span>
              <span className="text-xs text-muted-foreground">{org.role}</span>
            </div>
            {selectedOrg.id === org.id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}














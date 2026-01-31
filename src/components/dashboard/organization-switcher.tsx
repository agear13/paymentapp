'use client';

import * as React from 'react';
import { ChevronsUpDown, Plus, Check, Loader2 } from 'lucide-react';
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
import { useRouter } from 'next/navigation';

type Organization = {
  id: string;
  name: string;
  role: string;
};

export function OrganizationSwitcher() {
  const router = useRouter();
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = React.useState<Organization | null>(null);
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch organizations on mount
  React.useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/organizations');
        
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }

        const orgs = await response.json();
        
        if (orgs && orgs.length > 0) {
          const formattedOrgs = orgs.map((org: any) => ({
            id: org.id,
            name: org.name,
            role: org.role || 'Owner',
          }));
          
          setOrganizations(formattedOrgs);
          setSelectedOrg(formattedOrgs[0]);
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
  }, []);

  if (isLoading) {
    return (
      <Button
        variant="outline"
        disabled
        className="w-[240px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </Button>
    );
  }

  if (!selectedOrg || organizations.length === 0) {
    return (
      <Button
        variant="outline"
        onClick={() => router.push('/onboarding')}
        className="w-[240px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>Create Organization</span>
        </div>
      </Button>
    );
  }

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
                {selectedOrg.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedOrg.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" />
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
        <DropdownMenuItem 
          className="gap-2"
          onSelect={() => {
            router.push('/onboarding');
            setOpen(false);
          }}
        >
          <Plus className="h-4 w-4" />
          <span>Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}














'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { EntitlementPageShell } from '@/components/entitlements/entitlement-page-shell';
import { GatedButton } from '@/components/entitlements/feature-gate';

export default function TeamSettingsPage() {
  return (
    <EntitlementPageShell feature="team_members">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team management</h1>
            <p className="text-muted-foreground">
              Manage your team members and their permissions.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Assign finance, operations, or admin access when inviting team members.
            </p>
          </div>
          <GatedButton feature="team_members">
            <Plus className="mr-2 h-4 w-4" />
            Invite Member
          </GatedButton>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team members</CardTitle>
            <CardDescription>
              Invite colleagues to collaborate on agreements, funding, and settlement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Team invitations will be available when you upgrade to Growth.
            </p>
          </CardContent>
        </Card>
      </div>
    </EntitlementPageShell>
  );
}

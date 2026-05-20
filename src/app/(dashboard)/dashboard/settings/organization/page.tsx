'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrganizationSettingsForm } from '@/components/dashboard/settings/organization-settings-form';
import { DeleteOrganizationDialog } from '@/components/dashboard/settings/delete-organization-dialog';

export default function OrganizationSettingsPage() {
  const [org, setOrg] = React.useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization settings</h1>
        <p className="text-muted-foreground">
          Manage your organization profile and preferences.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization profile</CardTitle>
            <CardDescription>Update your organization name and details.</CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationSettingsForm onOrganizationLoaded={setOrg} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>Irreversible actions that affect your organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-destructive/50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium text-destructive">Delete organization</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently remove this organization and its operational records.
                  </p>
                </div>
                {org ? (
                  <DeleteOrganizationDialog
                    organizationId={org.id}
                    organizationName={org.name}
                  />
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

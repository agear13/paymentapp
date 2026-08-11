'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OrganizationSettingsForm } from '@/components/dashboard/settings/organization-settings-form';
import { DeleteOrganizationDialog } from '@/components/dashboard/settings/delete-organization-dialog';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export function WorkspaceBusinessDetailsPage() {
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="animate-fade-up space-y-6 pb-16">
      <header>
        <Link href={COMMERCIAL_OS_ROUTES.settings} className="text-[13px] text-ink-soft hover:text-foreground">
          ← Workspace Settings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Business details</h1>
        <p className="mt-2 text-[15px] text-ink-soft">Your workspace name and organization profile.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-6">
        <OrganizationSettingsForm onOrganizationLoaded={setOrg} />
        {org ? (
          <div className="rounded-xl border border-destructive/30 p-4">
            <h2 className="text-[15px] font-semibold text-destructive">Delete organization</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              Permanently remove this workspace and its operational records.
            </p>
            <div className="mt-3">
              <DeleteOrganizationDialog organizationId={org.id} organizationName={org.name} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

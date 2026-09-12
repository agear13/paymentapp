'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OrganizationSettingsForm } from '@/components/dashboard/settings/organization-settings-form';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
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
        <p className="mt-2 text-[15px] text-ink-soft">
          Your workspace name, legal/trading name, and organisation logo. The logo appears on
          new affiliate agreements sent by this organisation.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-6">
        <OrganizationSettingsForm onOrganizationLoaded={setOrg} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-6">
        <div>
          <h2 className="text-[15px] font-semibold">Organisation branding</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Upload, preview, replace, or remove the organisation logo. New agreements snapshot
            the current logo; already-issued agreements keep the version they were sent with.
          </p>
        </div>
        <MerchantSettingsForm sections={['branding']} presentation="commercial-os" />
      </div>

      {org ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="rounded-xl border border-destructive/30 p-4">
            <h2 className="text-[15px] font-semibold text-destructive">Delete organization</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              Permanently remove this workspace and its operational records.
            </p>
            <div className="mt-3">
              <DeleteOrganizationDialog organizationId={org.id} organizationName={org.name} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

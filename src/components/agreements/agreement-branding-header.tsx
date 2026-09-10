'use client';

import * as React from 'react';
import type { AgreementBrandingSnapshot } from '@/lib/agreements/agreement-presentation';

type Props = {
  title: string;
  branding: AgreementBrandingSnapshot;
  versionNumber?: number;
};

export function AgreementBrandingHeader({ title, branding, versionNumber }: Props) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const showLogo = Boolean(branding.logoUrl) && !logoFailed;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {showLogo ? (
          <img
            src={branding.logoUrl ?? undefined}
            alt={`${branding.legalName || branding.organizationName} logo`}
            className="h-12 w-auto max-w-[180px] object-contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
          >
            {branding.initials}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {branding.legalName || branding.organizationName}
          </p>
          {branding.legalName &&
          branding.organizationName &&
          branding.legalName !== branding.organizationName ? (
            <p className="text-xs text-muted-foreground">{branding.organizationName}</p>
          ) : null}
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {versionNumber ? (
          <p className="text-xs text-muted-foreground mt-0.5">Version {versionNumber}</p>
        ) : null}
      </div>
    </div>
  );
}

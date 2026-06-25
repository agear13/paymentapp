'use client';

/**
 * Refreshes organization identity from the server on dashboard startup.
 * Overwrites stale localStorage values (e.g. timestamp-like ids).
 */

import * as React from 'react';
import { refreshOrganizationIdentityFromApi } from '@/lib/organization/organization-id.client';

export function OrganizationIdentityBootstrap() {
  React.useEffect(() => {
    void refreshOrganizationIdentityFromApi();
  }, []);

  return null;
}

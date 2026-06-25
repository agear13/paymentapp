'use client';

import {
  ORGANIZATION_ID_STORAGE_KEY,
  isValidOrganizationUuid,
  warnInvalidOrganizationId,
} from './organization-id';

export function getStoredOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ORGANIZATION_ID_STORAGE_KEY);
  if (!raw) return null;
  if (!isValidOrganizationUuid(raw)) {
    warnInvalidOrganizationId(raw, 'localStorage cache');
    return null;
  }
  return raw;
}

export function setStoredOrganizationId(organizationId: string): void {
  if (!isValidOrganizationUuid(organizationId)) {
    warnInvalidOrganizationId(organizationId, 'setStoredOrganizationId');
    return;
  }
  window.localStorage.setItem(ORGANIZATION_ID_STORAGE_KEY, organizationId);
}

export function clearStoredOrganizationId(): void {
  window.localStorage.removeItem(ORGANIZATION_ID_STORAGE_KEY);
}

export type OrganizationIdentityRefreshResult = {
  organizationId: string | null;
  name?: string | null;
  clerkOrgId?: string | null;
  error?: string;
};

/**
 * Refresh organization identity from the server and overwrite any stale localStorage value.
 */
export async function refreshOrganizationIdentityFromApi(): Promise<OrganizationIdentityRefreshResult> {
  try {
    const response = await fetch('/api/user/organization');

    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        clearStoredOrganizationId();
      }
      return {
        organizationId: null,
        error: response.status === 404 ? 'No organization found' : 'Failed to fetch organization',
      };
    }

    const data = (await response.json()) as {
      organizationId?: string;
      name?: string;
      clerkOrgId?: string;
    };

    if (!data.organizationId || !isValidOrganizationUuid(data.organizationId)) {
      warnInvalidOrganizationId(data.organizationId ?? '', 'api/user/organization response');
      clearStoredOrganizationId();
      return { organizationId: null, error: 'Invalid organization id from server' };
    }

    setStoredOrganizationId(data.organizationId);

    return {
      organizationId: data.organizationId,
      name: data.name,
      clerkOrgId: data.clerkOrgId,
    };
  } catch {
    return { organizationId: null, error: 'Failed to fetch organization' };
  }
}

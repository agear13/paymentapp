'use client'

import * as React from 'react'
import {
  refreshOrganizationIdentityFromApi,
} from '@/lib/organization/organization-id.client'

type Organization = {
  id: string
  name?: string | null
}

type UseOrganizationResult = {
  organizationId: string | null
  organization: Organization | null
  isLoading: boolean
  error: string | null
}

/**
 * Resolve the current user's workspace organization from the server.
 * Never trusts stale localStorage — always refreshes from /api/user/organization.
 */
export function useOrganization(): UseOrganizationResult {
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [organizationName, setOrganizationName] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadOrganization() {
      const result = await refreshOrganizationIdentityFromApi()

      if (cancelled) return

      if (result.organizationId) {
        setOrganizationId(result.organizationId)
        setOrganizationName(result.name ?? null)
        setError(null)
      } else {
        setOrganizationId(null)
        setOrganizationName(null)
        setError(result.error ?? 'No organization found')
      }

      setIsLoading(false)
    }

    void loadOrganization()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    organizationId,
    organization: organizationId
      ? { id: organizationId, name: organizationName }
      : null,
    isLoading,
    error,
  }
}

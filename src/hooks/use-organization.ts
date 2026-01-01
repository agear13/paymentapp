'use client'

import * as React from 'react'

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
 * Minimal hook to satisfy dashboard components.
 * Reads org from querystring first (?organizationId=),
 * then from localStorage (provvypay.organizationId).
 *
 * You can later replace with a real org context/provider.
 */
export function useOrganization(): UseOrganizationResult {
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const fromQuery = params.get('organizationId') || params.get('orgId')
      const fromStorage =
        window.localStorage.getItem('provvypay.organizationId') ||
        window.localStorage.getItem('organizationId')

      const id = fromQuery || fromStorage || null
      setOrganizationId(id)
      setIsLoading(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve organization')
      setIsLoading(false)
    }
  }, [])

  return {
    organizationId,
    organization: organizationId ? { id: organizationId } : null,
    isLoading,
    error,
  }
}

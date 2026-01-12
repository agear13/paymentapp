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
 * Hook to fetch and cache the current user's organization.
 * Fetches from API and caches in localStorage.
 */
export function useOrganization(): UseOrganizationResult {
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchOrganization() {
      try {
        // Check localStorage first
        const cached = window.localStorage.getItem('provvypay.organizationId')
        if (cached) {
          setOrganizationId(cached)
          setIsLoading(false)
          // Still fetch in background to ensure it's correct
        }

        // Fetch from API
        const response = await fetch('/api/user/organization')
        
        if (!response.ok) {
          throw new Error('Failed to fetch organization')
        }

        const data = await response.json()
        
        if (data.organizationId) {
          setOrganizationId(data.organizationId)
          // Cache it
          window.localStorage.setItem('provvypay.organizationId', data.organizationId)
        } else {
          setError('No organization found')
        }
        
        setIsLoading(false)
      } catch (e: any) {
        console.error('Error fetching organization:', e)
        setError(e?.message || 'Failed to resolve organization')
        setIsLoading(false)
      }
    }

    fetchOrganization()
  }, [])

  return {
    organizationId,
    organization: organizationId ? { id: organizationId } : null,
    isLoading,
    error,
  }
}

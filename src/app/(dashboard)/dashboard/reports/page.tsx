import { getCurrentUser } from '@/lib/auth/session'
import { getUserOrganization } from '@/lib/auth/get-org'
import { redirect } from 'next/navigation'
import { ReportsPageClient } from '@/components/dashboard/reports/reports-page-client'

export default async function ReportsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Get the user's organization with proper data isolation
  const organization = await getUserOrganization()

  if (!organization) {
    // Redirect to onboarding if user has no organization
    redirect('/onboarding')
  }

  return <ReportsPageClient organizationId={organization.id} />
}

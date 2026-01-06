import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/server/prisma'
import { ReportsPageClient } from '@/components/dashboard/reports/reports-page-client'

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

function first(param?: string | string[]) {
  if (!param) return undefined
  return Array.isArray(param) ? param[0] : param
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Try to get organizationId from query params first
  let organizationId =
    first(searchParams?.organizationId) ||
    first(searchParams?.orgId) ||
    undefined

  // If no organizationId in query params, get the user's first organization
  if (!organizationId) {
    const organization = await prisma.organizations.findFirst({
      select: { id: true },
    })

    if (!organization) {
      // Only redirect to onboarding if truly no organization exists
      redirect('/onboarding')
    }

    organizationId = organization.id
  } else {
    // Validate the provided org exists
    const organization = await prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true },
    })

    if (!organization) {
      redirect('/onboarding')
    }
  }

  return <ReportsPageClient organizationId={organizationId!} />
}

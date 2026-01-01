import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
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
    // match your app’s login route (you can change this to /auth/login if that’s what you use)
    redirect('/auth/login')
  }

  const organizationId =
    first(searchParams?.organizationId) ||
    first(searchParams?.orgId) ||
    undefined

  if (!organizationId) {
    // If you have an org picker/onboarding flow, send them there
    redirect('/onboarding')
  }

  // Validate org exists (optional but good)
  const organization = await prisma.organizations.findUnique({
    where: { id: organizationId },
    select: { id: true },
  })

  if (!organization) {
    redirect('/onboarding')
  }

  return <ReportsPageClient organizationId={organization.id} />
}

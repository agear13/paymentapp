export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { CsrfBootstrap } from '@/components/security/csrf-bootstrap';
import { enforceVerifiedSession } from '@/lib/auth/verified-gate.server';
import { getUserOrganization } from '@/lib/auth/get-org';

export default async function CommercialOsLayout({ children }: { children: React.ReactNode }) {
  await enforceVerifiedSession();

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/onboarding');
  }

  return (
    <>
      <CsrfBootstrap />
      {children}
    </>
  );
}

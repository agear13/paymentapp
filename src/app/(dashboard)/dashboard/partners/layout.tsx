/**
 * Partners section: server-side beta admin gate.
 * Redirects non-admins to main dashboard (middleware may allow through when email parse fails).
 */
import { redirect } from 'next/navigation';
import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';

export default async function PartnersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isBetaAdmin = await getIsBetaAdmin();
  if (!isBetaAdmin) redirect('/dashboard');
  return <>{children}</>;
}

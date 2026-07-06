/**
 * Accountant Partner Dashboard (Preview) — server-side beta admin gate.
 * Only visible to BETA_ADMIN_EMAILS (alishajayne13@gmail.com).
 */
import { notFound } from 'next/navigation';
import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';

export default async function PartnerPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isBetaAdmin = await getIsBetaAdmin();
  if (!isBetaAdmin) notFound();
  return <>{children}</>;
}

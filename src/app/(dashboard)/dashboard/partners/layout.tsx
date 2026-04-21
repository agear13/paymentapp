/**
 * Partners section: server-side gate.
 * Admins: full partners area. Rabbit Hole pilot: only deal-network (middleware + pathname header).
 */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';

export default async function PartnersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getDashboardProductProfile();

  if (profile === 'admin') {
    return <>{children}</>;
  }

  if (profile === 'rabbit_hole_pilot' || profile === 'strait_experiences_pilot') {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') ?? '';
    const allowed =
      pathname === '/dashboard/partners/deal-network' ||
      pathname.startsWith('/dashboard/partners/deal-network/');
    // When x-pathname is missing, rely on middleware; only redirect if we know the path is wrong.
    if (pathname && !allowed) {
      redirect('/dashboard/partners/deal-network');
    }
    return <>{children}</>;
  }

  redirect('/dashboard');
}

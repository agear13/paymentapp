import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { NotificationPreferencesClient } from '@/components/dashboard/notifications/preferences-client';

export default async function NotificationPreferencesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <NotificationPreferencesClient />;
}








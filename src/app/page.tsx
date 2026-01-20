import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';

export default async function Home() {
  const user = await getCurrentUser();
  
  if (!user) {
    // Not logged in - redirect to signup
    redirect('/auth/signup');
  }
  
  // Check if user has completed onboarding
  const organization = await getUserOrganization();
  
  if (!organization) {
    // New user - redirect to onboarding
    redirect('/onboarding');
  }
  
  // Existing user - redirect to dashboard
  redirect('/dashboard');
}

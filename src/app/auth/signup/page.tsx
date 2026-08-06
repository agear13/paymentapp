import { redirect } from 'next/navigation';

type SignupPageProps = {
  searchParams?: Promise<{ redirectedFrom?: string }>;
};

/**
 * Signup Page - Redirects to Login
 *
 * Signup functionality is handled on the login page with a toggle.
 * This page redirects to prevent 404 errors for direct navigation or external links.
 */
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = new URLSearchParams({ mode: 'signup' });
  const resolved = searchParams ? await searchParams : undefined;
  const redirectedFrom = resolved?.redirectedFrom;
  if (redirectedFrom?.startsWith('/') && !redirectedFrom.startsWith('//')) {
    params.set('redirectedFrom', redirectedFrom);
  }
  redirect(`/auth/login?${params.toString()}`);
}

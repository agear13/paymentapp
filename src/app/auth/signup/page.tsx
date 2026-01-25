'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Signup Page - Redirects to Login
 * 
 * This app handles signup on the login page itself.
 * This redirect prevents 404 errors when users navigate to /auth/signup
 */
export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page where signup is handled
    router.replace('/auth/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting to login...</p>
    </div>
  );
}


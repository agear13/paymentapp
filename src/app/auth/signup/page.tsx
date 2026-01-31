import { redirect } from 'next/navigation';

/**
 * Signup Page - Redirects to Login
 * 
 * Signup functionality is handled on the login page with a toggle.
 * This page redirects to prevent 404 errors for direct navigation or external links.
 */
export default function SignupPage() {
  // Server-side redirect to login page where signup is handled
  redirect('/auth/login');
}

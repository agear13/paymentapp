import { redirect } from 'next/navigation';

/**
 * Signup Page - Redirects to Login
 * 
 * Signup functionality is handled on the login page with a toggle.
 * This page redirects to prevent 404 errors for direct navigation or external links.
 */
export default function SignupPage() {
  // Preserve a stable /auth/signup entry URL while rendering signup mode in auth UI.
  redirect('/auth/login?mode=signup');
}

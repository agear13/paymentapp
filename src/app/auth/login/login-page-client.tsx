'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

type AuthMode = 'signin' | 'signup';

export function LoginPageClient() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    const requestedMode = searchParams.get('mode');
    if (requestedMode === 'signup' || requestedMode === 'signin') {
      setMode(requestedMode);
      return;
    }
    setMode('signin');
  }, [searchParams]);

  const getPostAuthDestination = () => {
    const redirectedFrom = searchParams.get('redirectedFrom');
    if (redirectedFrom && redirectedFrom.startsWith('/dashboard')) {
      return redirectedFrom;
    }
    return '/dashboard';
  };

  const waitForSession = async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      await waitForSession();
      router.replace(getPostAuthDestination());
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to login';
      setError(message);
    } finally {
      setLoading(false);
      submissionInFlightRef.current = false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      submissionInFlightRef.current = false;
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      submissionInFlightRef.current = false;
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user && !data.user.identities?.length) {
        setError('An account with this email already exists');
        setLoading(false);
        submissionInFlightRef.current = false;
        return;
      }

      if (!data.session) {
        setNotice('Check your email to confirm your account, then sign in.');
        setMode('signin');
        return;
      }

      await waitForSession();
      router.replace('/onboarding');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
    } finally {
      setLoading(false);
      submissionInFlightRef.current = false;
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/provvypay-icon.svg')] bg-no-repeat bg-center opacity-[0.03] bg-[length:600px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="text-xl font-bold text-primary-foreground">P</span>
            </div>
            <span className="text-2xl font-bold">Provvypay</span>
          </Link>

          <div className="space-y-8 max-w-lg">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">
                Every commercial agreement starts in a conversation.
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                {mode === 'signin'
                  ? 'Sign in to your Agreement Intelligence workspace. Review agreements, obligations, approvals and settlement readiness in one place.'
                  : 'Import agreements from WhatsApp, email and meetings. Generate structured obligations, approvals and settlement workflows automatically.'}
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Agreement Intelligence</h3>
                  <p className="text-sm text-muted-foreground">
                    Extract commercial terms automatically from any conversation channel
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Participant Coordination</h3>
                  <p className="text-sm text-muted-foreground">
                    Track obligations across contractors, suppliers, affiliates and partners
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Settlement Visibility</h3>
                  <p className="text-sm text-muted-foreground">
                    See what is funded, owed and ready to settle before payment leaves
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Audit-Ready Records</h3>
                  <p className="text-sm text-muted-foreground">
                    Structured history of agreements, approvals and obligations
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>© 2026 Provvypay</span>
            <Link href="/legal/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-xl font-bold text-primary-foreground">P</span>
              </div>
              <span className="text-2xl font-bold">Provvypay</span>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </h2>
            <p className="text-muted-foreground mt-2">
              {mode === 'signin'
                ? 'Agreement Intelligence · Obligations · Settlement'
                : 'Create a workspace to start turning conversations into obligations'}
            </p>
          </div>

          <form onSubmit={mode === 'signin' ? handleLogin : handleSignUp} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === 'signin' && (
                    <Link
                      href="/auth/reset-password"
                      className="text-sm text-primary hover:text-[rgb(61,92,224)] transition-colors"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
                {mode === 'signup' && (
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                )}
              </div>

              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <strong className="font-semibold">Authentication failed</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {notice && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {notice}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : mode === 'signin' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <Link
                href={mode === 'signin' ? '/auth/signup' : '/auth/login'}
                className="text-primary hover:text-[rgb(61,92,224)] font-semibold transition-colors"
              >
                {mode === 'signin' ? 'Create account' : 'Sign in'}
              </Link>
            </p>
            {mode === 'signup' ? (
              <p className="text-xs text-muted-foreground">
                No credit card required · Setup in minutes · Audit-ready workflows
              </p>
            ) : null}
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-xs text-center">
              <strong className="font-semibold">Development Mode:</strong> Create an account or sign in with your
              credentials
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

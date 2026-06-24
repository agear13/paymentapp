'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { MessageSquare, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import {
  AuthLegalFooterLinks,
  AuthMobileLegalLinks,
  AuthSignupLegalNotice,
} from '@/components/legal/auth-legal-links';
import { emitAuthAuditEvent } from '@/lib/security/auth-audit.client';
import { TurnstileWidget } from '@/components/auth/turnstile-widget';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from '@/lib/auth/disposable-email';

type AuthMode = 'signin' | 'signup';

const FEATURE_ROWS = [
  {
    icon: MessageSquare,
    title: 'Agreement Intelligence',
    description: 'Extract commercial terms automatically from any conversation channel',
  },
  {
    icon: Users,
    title: 'Participant Coordination',
    description: 'Track obligations across contractors, suppliers, affiliates and partners',
  },
  {
    icon: Wallet,
    title: 'Settlement Visibility',
    description: 'See what is funded, owed and ready to settle before payment leaves',
  },
] as const;

export function LoginPageClient() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    const requestedMode = searchParams?.get('mode');
    if (requestedMode === 'signup' || requestedMode === 'signin') {
      setMode(requestedMode);
      return;
    }
    setMode('signin');
  }, [searchParams]);

  useEffect(() => {
    const scope = mode === 'signup' ? 'signup' : 'login';
    void fetch(`/api/auth/turnstile-config?scope=${scope}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setTurnstileRequired(Boolean(data.required));
        setTurnstileSiteKey(data.siteKey ?? null);
      })
      .catch(() => undefined);
  }, [mode]);

  const getPostAuthDestination = () => {
    const redirectedFrom = searchParams?.get('redirectedFrom');
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.turnstileRequired) {
          setTurnstileRequired(true);
        }
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setNotice('Please verify your email address before signing in.');
          setMode('signin');
          return;
        }
        void emitAuthAuditEvent({
          eventType: 'auth.login.failed',
          email,
          success: false,
          reason: data.error,
        });
        throw new Error(data.error || 'Failed to login');
      }

      await waitForSession();
      const { data: sessionData } = await supabase.auth.getSession();
      void emitAuthAuditEvent({
        eventType: 'auth.login.success',
        email,
        userId: sessionData.session?.user.id,
      });

      if (data.suspiciousLogin) {
        router.replace('/auth/confirm-login');
      } else {
        router.replace(getPostAuthDestination());
      }
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

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      setLoading(false);
      submissionInFlightRef.current = false;
      return;
    }

    if (isDisposableEmail(email)) {
      setError(DISPOSABLE_EMAIL_MESSAGE);
      setLoading(false);
      submissionInFlightRef.current = false;
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.turnstileRequired) {
          setTurnstileRequired(true);
        }
        throw new Error(data.error || 'Failed to create account');
      }

      if (data.requiresVerification) {
        setNotice(data.message ?? 'Check your email to confirm your account, then sign in.');
        setMode('signin');
        return;
      }

      await waitForSession();
      router.replace('/auth/verify-email');
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
      <div className="hidden lg:flex lg:w-1/2 bg-[rgb(var(--intelligence-bg))] text-white relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/provvypay-icon.svg')] bg-no-repeat bg-center opacity-[0.04] bg-[length:720px]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 top-1/2 h-[480px] w-[480px] -translate-y-1/2 opacity-[0.06]">
          <div className="h-full w-full bg-[url('/provvypay-icon.svg')] bg-contain bg-no-repeat bg-center" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <ProvvypayLogoMark size="md" className="[&_span]:text-white" />

          <div className="space-y-10 max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-700">
            <div className="space-y-5">
              <h1 className="text-4xl font-semibold tracking-tight leading-tight">
                Every commercial agreement starts in a conversation.
              </h1>
              <p className="text-lg text-white/70 leading-relaxed">
                Import agreements from WhatsApp, email, meetings and contracts. Provvypay structures
                obligations and settlement workflows automatically.
              </p>
            </div>

            <div className="space-y-6">
              {FEATURE_ROWS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(124,92,255,0.25)] bg-[rgba(124,92,255,0.12)]">
                    <Icon className="h-5 w-5 text-[#9B7CFF]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AuthLegalFooterLinks />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-[rgba(124,92,255,0.03)] to-background">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="lg:hidden flex justify-center mb-8">
            <ProvvypayLogoMark size="md" />
          </div>

          <div className="surface-elevated p-8 sm:p-10 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight">
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {mode === 'signin'
                  ? 'Agreement Intelligence · Obligations · Settlement'
                  : 'Create a workspace to start turning conversations into obligations'}
              </p>
            </div>

            <form onSubmit={mode === 'signin' ? handleLogin : handleSignUp} className="space-y-6">
              <div className="space-y-5">
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
                        className="text-sm text-primary hover:text-[rgb(var(--primary-hover))] transition-colors"
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
                    <p className="text-xs text-muted-foreground">
                      Must be at least {MIN_PASSWORD_LENGTH} characters
                    </p>
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

              {turnstileRequired && turnstileSiteKey ? (
                <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
              ) : null}

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
                <div className="surface-settlement px-4 py-3 rounded-lg text-sm">{notice}</div>
              )}

              {mode === 'signup' ? <AuthSignupLegalNotice /> : null}

              <Button
                type="submit"
                className="w-full h-11 text-base"
                disabled={loading || (turnstileRequired && !turnstileToken)}
              >
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

            <div className="text-center space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <Link
                  href={mode === 'signin' ? '/auth/signup' : '/auth/login'}
                  className="text-primary hover:text-[rgb(var(--primary-hover))] font-semibold transition-colors"
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

            <AuthMobileLegalLinks />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, Sparkles, Workflow } from 'lucide-react';
import {
  COMMERCIAL_OS_ROUTES,
  journeyAuthCallbackUrl,
} from '@/lib/journey/commercial-os-routes';
import { createClient } from '@/lib/supabase/client';
import { completeJourneyOnboarding } from '@/lib/journey/complete-journey-onboarding.client';
import { consumePostProvisioningDestination } from '@/lib/journey/journey-invoice-activation.client';
import {
  fetchAuthorizedParticipantWorkspacePrefill,
  shouldOfferParticipantWorkspaceNameConfirm,
  usableSuggestedWorkspaceName,
} from '@/lib/journey/journey-participant-prefill.client';
import { TurnstileWidget } from '@/components/auth/turnstile-widget';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from '@/lib/auth/disposable-email';
import {
  markJourneyProvisioningPending,
  restoreJourneyAssessment,
} from '@/lib/journey/journey-assessment-storage.client';
import { emitAuthAuditEvent } from '@/lib/security/auth-audit.client';
import { ACCOUNT_EXISTS_CODE, ACCOUNT_EXISTS_MESSAGE } from '@/lib/auth/auth-errors';

type AuthMode = 'signup' | 'signin';

export function WorkspaceCreateScreen() {
  const router = useRouter();
  const supabase = createClient();
  const submissionInFlightRef = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [checkingPrefill, setCheckingPrefill] = useState(false);
  const [awaitingNameConfirm, setAwaitingNameConfirm] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    restoreJourneyAssessment();
  }, []);

  useEffect(() => {
    const scope = authMode === 'signup' ? 'signup' : 'login';
    void fetch(`/api/auth/turnstile-config?scope=${scope}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setTurnstileRequired(Boolean(data.required));
        setTurnstileSiteKey(data.siteKey ?? null);
      })
      .catch(() => undefined);
  }, [authMode]);

  const waitForSession = async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
    return false;
  };

  const finishOnboarding = async (userEmail?: string, confirmedWorkspaceName?: string) => {
    const restoreNameConfirm = Boolean(confirmedWorkspaceName);
    setAwaitingNameConfirm(false);
    setBootstrapping(true);
    setError(null);
    try {
      await completeJourneyOnboarding(userEmail ?? email, {
        confirmedWorkspaceName,
      });
      const next = consumePostProvisioningDestination();
      router.replace(next ?? COMMERCIAL_OS_ROUTES.workspace);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set up workspace';
      setError(message);
      setBootstrapping(false);
      if (restoreNameConfirm) {
        setAwaitingNameConfirm(true);
      }
    }
  };

  const proceedAfterAuthentication = async (userEmail?: string) => {
    setError(null);
    setCheckingPrefill(true);
    try {
      let hasOrganization = false;
      try {
        const existing = await fetch('/api/onboarding', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (existing.ok) {
          const data = (await existing.json()) as { hasOrganization?: boolean };
          hasOrganization = Boolean(data.hasOrganization);
        }
      } catch {
        /* bootstrap remains the source of truth if this check fails */
      }

      if (!hasOrganization) {
        try {
          const prefill = await fetchAuthorizedParticipantWorkspacePrefill();
          if (shouldOfferParticipantWorkspaceNameConfirm(hasOrganization, prefill)) {
            const suggestion = usableSuggestedWorkspaceName(prefill);
            if (suggestion) {
              setPendingEmail(userEmail);
              setWorkspaceNameDraft(suggestion);
              setAwaitingNameConfirm(true);
              setCheckingPrefill(false);
              return;
            }
          }
        } catch {
          /* prefill failure must not block workspace creation */
        }
      }

      setCheckingPrefill(false);
      await finishOnboarding(userEmail);
    } catch (err: unknown) {
      setCheckingPrefill(false);
      const message = err instanceof Error ? err.message : 'Failed to set up workspace';
      setError(message);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function resumeAuthenticatedOnboarding() {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      await proceedAfterAuthentication(data.session.user.email ?? undefined);
    }

    void resumeAuthenticatedOnboarding();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGoogleOAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      restoreJourneyAssessment();
      markJourneyProvisioningPending();
      const redirectTo = journeyAuthCallbackUrl(window.location.origin);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start sign-in';
      setError(message);
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
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
        if (data.turnstileRequired) setTurnstileRequired(true);
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setNotice('Please verify your email address before signing in.');
          return;
        }
        throw new Error(data.error || 'Failed to sign in');
      }

      await waitForSession();
      const { data: sessionData } = await supabase.auth.getSession();
      void emitAuthAuditEvent({
        eventType: 'auth.login.success',
        email,
        userId: sessionData.session?.user.id,
      });

      markJourneyProvisioningPending();
      await proceedAfterAuthentication(email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
    } finally {
      setLoading(false);
      submissionInFlightRef.current = false;
    }
  };

  const handleSignUp = async () => {
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
        if (data.turnstileRequired) setTurnstileRequired(true);
        if (data.code === ACCOUNT_EXISTS_CODE) {
          setAuthMode('signin');
          setShowEmailAuth(true);
          setNotice(typeof data.error === 'string' ? data.error : ACCOUNT_EXISTS_MESSAGE);
          setError(null);
          return;
        }
        throw new Error(data.error || 'Failed to create account');
      }

      if (data.requiresVerification) {
        setNotice(data.message ?? 'Check your email to verify your account, then sign in.');
        setAuthMode('signin');
        return;
      }

      await waitForSession();
      markJourneyProvisioningPending();
      await proceedAfterAuthentication(email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
    } finally {
      setLoading(false);
      submissionInFlightRef.current = false;
    }
  };

  const handleEmailContinue = () => {
    if (!email.trim()) {
      setError('Enter your work email to continue');
      return;
    }
    setError(null);
    setShowEmailAuth(true);
  };

  const handleEmailSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (authMode === 'signin') {
      void handleSignIn();
    } else {
      void handleSignUp();
    }
  };

  const confirmWorkspaceName = () => {
    const nextName = workspaceNameDraft.trim();
    if (nextName.length < 2) {
      setError('Enter a workspace name of at least 2 characters');
      return;
    }
    void finishOnboarding(pendingEmail ?? email, nextName.slice(0, 255));
  };

  const busy = loading || bootstrapping || checkingPrefill;

  return (
    <section className="relative px-6 pt-14 pb-24 animate-fade-up">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          {awaitingNameConfirm ? null : (
            <Link
              href="/journey/assessment/business"
              className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          )}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-[12px] text-ink-soft shadow-soft">
            <Sparkles className="h-3 w-3 text-primary" />
            30-day Professional trial
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Start with 30 days of Provvy Professional
          </h1>
          <p className="mt-4 max-w-lg text-lg text-ink-soft">
            You have 30 days of Provvy Professional and can start using available Professional
            capabilities immediately. You can create invoices now. Add payment methods when you
            are ready so customers can pay. Contextual AI guidance will introduce branding,
            payment methods, workflows and other capabilities when they are relevant — you do not
            need to configure everything now.
          </p>

          <div className="mt-8 space-y-2.5">
            {[
              'Start working immediately — create invoices now and add payment methods when you are ready',
              'Contextual AI introduces branding, payment methods and workflows when useful',
              "Invite your team when you're ready",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5 text-[13.5px] text-foreground">
                <div className="grid h-4 w-4 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-2.5 w-2.5" />
                </div>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">Create your workspace</div>
              <div className="text-[12px] text-ink-soft">30-day Professional trial</div>
            </div>
          </div>

          {bootstrapping || checkingPrefill ? (
            <div className="mt-8 flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-[14px] font-medium text-foreground">Setting up your workspace</div>
              <div className="text-[13px] text-ink-soft">
                Saving your assessment and preparing Commercial OS…
              </div>
            </div>
          ) : awaitingNameConfirm ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                confirmWorkspaceName();
              }}
            >
              <div>
                <div className="text-[13px] font-semibold text-foreground">
                  Confirm your workspace name
                </div>
                <p className="mt-1 text-[12px] text-ink-soft">
                  You can accept this suggestion or edit it before creating the workspace.
                </p>
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground" htmlFor="workspace-name">
                  Workspace name
                </label>
                <input
                  id="workspace-name"
                  type="text"
                  value={workspaceNameDraft}
                  onChange={(event) => setWorkspaceNameDraft(event.target.value)}
                  maxLength={255}
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={busy || workspaceNameDraft.trim().length < 2}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                Create workspace <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <>
              <div className="mt-6">
                <GoogleSsoButton onClick={() => void startGoogleOAuth()} disabled={busy} />
              </div>

              <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-soft">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-foreground">Work email</label>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <Mail className="h-4 w-4 text-ink-soft" />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={busy}
                      className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-ink-soft"
                    />
                  </div>
                </div>

                {showEmailAuth ? (
                  <>
                    <div>
                      <label className="text-[12px] font-medium text-foreground">Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={busy}
                        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      {authMode === 'signup' ? (
                        <p className="mt-1.5 text-[11px] text-ink-soft">
                          Must be at least {MIN_PASSWORD_LENGTH} characters
                        </p>
                      ) : null}
                    </div>

                    {authMode === 'signup' ? (
                      <div>
                        <label className="text-[12px] font-medium text-foreground">
                          Confirm password
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          disabled={busy}
                          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    ) : null}

                    {turnstileRequired && turnstileSiteKey ? (
                      <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
                    ) : null}
                  </>
                ) : null}

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                    {error}
                  </div>
                ) : null}

                {notice ? (
                  <div className="rounded-xl border border-primary/20 bg-accent px-3 py-2.5 text-[13px] text-foreground">
                    {notice}
                  </div>
                ) : null}

                {showEmailAuth ? (
                  <button
                    type="submit"
                    disabled={busy || (turnstileRequired && !turnstileToken)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {authMode === 'signin' ? 'Signing in…' : 'Creating account…'}
                      </>
                    ) : authMode === 'signin' ? (
                      <>
                        Sign in and continue <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Create account and continue <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEmailContinue}
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
                  >
                    Continue with email <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </form>

              {showEmailAuth ? (
                <div className="mt-4 text-center text-[12px] text-ink-soft">
                  {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                      setError(null);
                      setNotice(null);
                      setConfirmPassword('');
                    }}
                    className="font-medium text-primary hover:underline"
                  >
                    {authMode === 'signup' ? 'Sign in' : 'Create account'}
                  </button>
                </div>
              ) : null}
            </>
          )}

          <p className="mt-5 text-center text-[12px] text-ink-soft">
            After you start, check{' '}
            <span className="font-medium text-foreground">Settings → Plan &amp; Billing</span> for
            your current plan, trial status and upgrade options.
          </p>
          <div className="mt-3 text-center text-[11px] text-ink-soft">
            By continuing you agree to Provvy&apos;s terms and privacy policy.
          </div>
        </div>
      </div>
    </section>
  );
}

function GoogleSsoButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-background px-4 py-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          fill="#4285F4"
          d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6c-.2 1.3-1 2.4-2.1 3.2v2.6h3.4c2-1.9 3.1-4.6 3.1-7.6z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7C4.4 19.8 8 22 12 22z"
        />
        <path
          fill="#FBBC05"
          d="M6.2 13.6c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V6.9H2.7C2 8.4 1.6 10.2 1.6 12s.4 3.6 1.1 5.1l3.5-2.7z"
        />
        <path
          fill="#EA4335"
          d="M12 5.7c1.5 0 2.9.5 4 1.5l3-3C17.2 2.4 14.8 1.4 12 1.4 8 1.4 4.4 3.6 2.7 6.9l3.5 2.7C7 7.5 9.3 5.7 12 5.7z"
        />
      </svg>
      Continue with Google
    </button>
  );
}

import { notFound } from 'next/navigation';
import { PROVVYPAY_PRIVACY_PATH } from '@/lib/legal/provvypay-legal-paths';
import { buildJarvisWaitlistWelcomeEmail } from '@/lib/email/templates/jarvis-waitlist-welcome';
import { PROVVY_TODAY_PATH } from '@/lib/marketing/provvy-today';

/**
 * TEMPORARY — development-only visual review of the Jarvis waitlist welcome email.
 * Does not send mail or write to the database. Delete this route after review.
 *
 * http://localhost:3000/dev/jarvis-waitlist-welcome-email
 */

const resolveAppBase = (): string =>
  (process.env.NEXT_PUBLIC_APP_URL || 'https://app.provvypay.com').replace(/\/$/, '');

const resolveExploreUrl = (): string => `${resolveAppBase()}${PROVVY_TODAY_PATH}`;

export default function JarvisWaitlistWelcomeEmailPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const email = buildJarvisWaitlistWelcomeEmail({
    exploreUrl: resolveExploreUrl(),
    privacyUrl: `${resolveAppBase()}${PROVVYPAY_PRIVACY_PATH}`,
  });

  return (
    <main style={{ minHeight: '100vh', background: '#111827', color: '#e5e7eb', padding: '24px 16px 48px' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>
        Temporary dev preview — delete after review
      </p>
      <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Jarvis waitlist welcome email</h1>
      <p style={{ margin: '0 0 6px', fontSize: 14 }}>
        <strong>Subject:</strong> {email.subject}
      </p>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af' }}>
        Template: <code>src/lib/email/templates/jarvis-waitlist-welcome.ts</code> · CTA:{' '}
        <code>{resolveExploreUrl()}</code> · no recipient rendered
      </p>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <figure style={{ margin: 0 }}>
          <figcaption style={{ marginBottom: 8, fontSize: 13, color: '#d1d5db' }}>Desktop · 720px</figcaption>
          <iframe
            title="Jarvis welcome email desktop"
            srcDoc={email.html}
            style={{ width: 720, height: 1180, border: '1px solid #374151', background: '#100e18', borderRadius: 8 }}
          />
        </figure>
        <figure style={{ margin: 0 }}>
          <figcaption style={{ marginBottom: 8, fontSize: 13, color: '#d1d5db' }}>Mobile · 390px</figcaption>
          <iframe
            title="Jarvis welcome email mobile"
            srcDoc={email.html}
            style={{ width: 390, height: 1180, border: '1px solid #374151', background: '#100e18', borderRadius: 8 }}
          />
        </figure>
      </section>
    </main>
  );
}

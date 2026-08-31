import { NextResponse } from 'next/server';
import { PROVVYPAY_PRIVACY_PATH } from '@/lib/legal/provvypay-legal-paths';
import { buildJarvisWaitlistWelcomeEmail } from '@/lib/email/templates/jarvis-waitlist-welcome';
import { PROVVY_TODAY_PATH } from '@/lib/marketing/provvy-today';

/**
 * TEMPORARY — raw HTML of the production Jarvis welcome template.
 * Development only. Does not send mail. Delete with the preview page.
 *
 * http://localhost:3000/dev/jarvis-waitlist-welcome-email/raw
 */

export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.provvypay.com').replace(/\/$/, '');
  const email = buildJarvisWaitlistWelcomeEmail({
    exploreUrl: `${base}${PROVVY_TODAY_PATH}`,
    privacyUrl: `${base}${PROVVYPAY_PRIVACY_PATH}`,
  });

  return new NextResponse(email.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

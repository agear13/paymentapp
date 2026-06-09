import 'server-only';

import { sendEmail, type SendEmailOptions } from '@/lib/email/client';

export function getAgreementAnalyzerFromEmail(): string | null {
  const from = process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
  return from || null;
}

export function getAgreementAnalyzerDemoUrl(): string | null {
  const demoUrl = process.env.AGREEMENT_ANALYZER_DEMO_URL?.trim();
  return demoUrl || null;
}

export function isAgreementAnalyzerEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && getAgreementAnalyzerFromEmail());
}

export async function sendAgreementAnalyzerEmail(
  options: Omit<SendEmailOptions, 'from'> & { from?: string }
) {
  const from = options.from ?? getAgreementAnalyzerFromEmail();
  if (!from) {
    return {
      id: '',
      success: false,
      error: 'EMAIL_FROM is not configured',
    };
  }

  return sendEmail({
    ...options,
    from,
  });
}

import 'server-only';

import { brandedAuthFromAddress } from '@/lib/auth/production-auth-branding';
import { sendEmail } from '@/lib/email/client';
import { log } from '@/lib/logger';

/**
 * Best-effort notification after high-risk account or payment-config changes.
 * Never throws — email outage must not roll back the security action.
 */
export async function notifyAccountSecurityEvent(input: {
  to: string | null | undefined;
  subject: string;
  text: string;
}): Promise<void> {
  const to = input.to?.trim();
  if (!to) return;

  try {
    await sendEmail({
      to,
      from: brandedAuthFromAddress(),
      subject: input.subject,
      text: input.text,
      html: `<p>${input.text.replace(/\n/g, '<br/>')}</p>`,
      tags: [{ name: 'category', value: 'account-security' }],
    });
  } catch (error) {
    log.warn('Account security notification failed', {
      to,
      subject: input.subject,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

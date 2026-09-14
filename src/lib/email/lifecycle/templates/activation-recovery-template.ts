import {
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import {
  escapeHtml,
  renderLifecycleEmailLayout,
} from '@/lib/email/lifecycle/templates/lifecycle-email-layout';

export type ActivationRecoveryEmailParams = {
  userName?: string | null;
  contactConfig?: LifecycleContactConfig;
};

export function buildActivationRecoveryEmail(
  params: ActivationRecoveryEmailParams = {}
): {
  subject: string;
  html: string;
  text: string;
} {
  const config = params.contactConfig || getLifecycleContactConfig();

  const greeting = params.userName
    ? `Hi ${escapeHtml(params.userName)},`
    : 'Hi there,';

  const subject = 'One quick step left to finish your Provvy account';
  const preheader =
    'Verify your email to finish setting up your account and get back into Provvy.';
  const headline = 'Complete your Provvy setup';

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      ${greeting}
    </p>

    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      You started creating your Provvy account, but there&rsquo;s one quick step left.
    </p>

    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Verify your email to finish setting up your account and get back into Provvy.
    </p>

    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      If you haven&rsquo;t received the verification email, sign in and we&rsquo;ll help you resend it.
    </p>
  `;

  const bodyText = [
    params.userName ? `Hi ${params.userName},` : 'Hi there,',
    '',
    "You started creating your Provvy account, but there's one quick step left.",
    '',
    'Verify your email to finish setting up your account and get back into Provvy.',
    '',
    "If you haven't received the verification email, sign in and we'll help you resend it.",
  ].join('\n');

  return renderLifecycleEmailLayout({
    subject,
    preheader,
    headline,
    bodyHtml,
    bodyText,
    primaryCta: {
      label: 'Complete my setup',
      url: `${config.appUrl}/auth/login`,
    },
    showContactBlock: true,
    contactConfig: config,
    footerNotice:
      'You are receiving this email because you started signing up for Provvy but have not verified your email yet.',
  });
}
